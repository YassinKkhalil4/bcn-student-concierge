import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { encryptDocument, decryptDocument, generateToken } from "@/lib/crypto";
import type { EncryptedPayload } from "@/lib/crypto";
import type { IntakeData } from "@/lib/schema";
import { selectForm, type FormId } from "@/lib/forms/field-map";
import { getDb } from "@/lib/db/client";
import {
  appointments,
  cases,
  caseDocuments,
  type CaseRow,
  type Locale,
  type DocumentKind,
  type DocumentRow,
  type PaymentStatus,
  type Stage,
} from "@/lib/db/schema";
import { blobStore, documentKey, casePrefix } from "./blob-store";
import { emailIndexFor, generateCaseRef, iso, openIntake, sealIntake } from "./case-codec";

/**
 * Case repository — Postgres for metadata, blob storage for document bodies.
 *
 * ENCRYPTED INTAKE
 * The intake questionnaire is sealed before it reaches Postgres (case-codec.ts)
 * and returned to callers already opened. Nothing outside the repository ever
 * handles an envelope, and the database never sees a name, passport number or
 * address in the clear.
 *
 * ORDERING INSTEAD OF TRANSACTIONS
 * Multi-step operations span Postgres AND blob storage, and no transaction can
 * cover both. So each is ordered to be crash-safe on its own terms: every step
 * is idempotent and the marker that says "this happened" is written last. A
 * crash part-way leaves the operation retryable, never falsely complete.
 */

export type { DocumentKind, PaymentStatus, Stage };

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  blobKey: string;
  /** Envelope metadata minus the ciphertext body, which lives in object storage. */
  crypto: Omit<EncryptedPayload, "ciphertext">;
}

export interface CaseRecord {
  id: string;
  /** Human reference, e.g. "BCN-58213". */
  ref: string;
  locale: Locale;
  tierId: string;
  formId: FormId;
  stage: Stage;
  paymentStatus: PaymentStatus;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  /** NULL once purged. */
  intake: IntakeData | null;
  documents: StoredDocument[];
  createdAt: string;
  updatedAt: string;
  /** Set when the engagement completes — starts the 30-day retention clock. */
  serviceCompletedAt: string | null;
  /** Set by the purge. A purged case keeps only non-personal accounting fields. */
  purgedAt: string | null;
  /** The student pressed "Submit for review". */
  documentsSubmittedAt: string | null;
}

/** Case ids are server-generated tokens. Reject anything else before querying. */
export function isValidCaseId(id: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(id);
}

function toDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    kind: row.kind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    uploadedAt: row.uploadedAt.toISOString(),
    blobKey: row.blobKey,
    crypto: {
      wrappedKey: row.wrappedKey,
      iv: row.iv,
      authTag: row.authTag,
      algorithm: row.algorithm as EncryptedPayload["algorithm"],
      keyVersion: row.keyVersion,
    },
  };
}

function toRecord(row: CaseRow, docs: DocumentRow[]): CaseRecord {
  return {
    id: row.id,
    ref: row.ref,
    locale: row.locale,
    tierId: row.tierId,
    formId: row.formId,
    stage: row.stage,
    paymentStatus: row.paymentStatus,
    stripeSessionId: row.stripeSessionId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    intake: openIntake(row),
    documents: docs.map(toDocument),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    serviceCompletedAt: iso(row.serviceCompletedAt),
    purgedAt: iso(row.purgedAt),
    documentsSubmittedAt: iso(row.documentsSubmittedAt),
  };
}

// ── Cases ──────────────────────────────────────────────────────────────────

export async function createCase(
  intake: IntakeData,
  options: { locale?: Locale } = {},
): Promise<CaseRecord> {
  const db = await getDb();
  // The id is part of the AAD, so it must exist before the intake is sealed.
  const id = generateToken();
  const values = {
    id,
    tierId: intake.tierId,
    formId: selectForm(intake.identity.nationality),
    locale: options.locale ?? "en",
    emailIndex: emailIndexFor(intake.contact.email),
    intakeEnvelope: sealIntake(id, intake),
  } as const;

  // The human reference is random, so it can collide with an existing one;
  // retry with a fresh reference on that specific unique violation only.
  for (let attempt = 1; ; attempt++) {
    try {
      const [row] = await db
        .insert(cases)
        .values({ ...values, ref: generateCaseRef() })
        .returning();
      return toRecord(row!, []);
    } catch (error) {
      if (attempt >= 8 || !isUniqueViolation(error, "cases_ref_unique")) throw error;
    }
  }
}

/** True when a Postgres unique constraint named `constraint` was violated. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let e: unknown = error; e instanceof Error || (e && typeof e === "object"); ) {
    const candidate = e as { code?: string; constraint?: string; message?: string; cause?: unknown };
    if (candidate.code === "23505" && (candidate.constraint === constraint || candidate.message?.includes(constraint))) {
      return true;
    }
    e = candidate.cause;
    if (!e) break;
  }
  return false;
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  if (!isValidCaseId(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!row) return null;
  const docs = await db
    .select()
    .from(caseDocuments)
    .where(eq(caseDocuments.caseId, id))
    .orderBy(asc(caseDocuments.uploadedAt));
  return toRecord(row, docs);
}

/** Fields callers may change. Intake and documents have their own paths. */
export interface CasePatch {
  paymentStatus?: PaymentStatus;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}

export async function updateCase(id: string, patch: CasePatch): Promise<void> {
  if (!isValidCaseId(id)) throw new Error("Invalid case id");
  const db = await getDb();
  await db
    .update(cases)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cases.id, id));
}

/**
 * Move a case through the workflow.
 *
 * Completing starts the 30-day retention clock; reopening stops it. Done in one
 * UPDATE so the stage and the clock can never disagree. COALESCE keeps the
 * ORIGINAL completion time if "completed" is set twice, so re-saving a case
 * cannot quietly extend how long its passport scan is retained.
 *
 * Returns false for a purged or unknown case — there is nothing left to manage.
 */
export async function setStage(id: string, stage: Stage): Promise<boolean> {
  if (!isValidCaseId(id)) return false;
  const db = await getDb();
  const updated = await db
    .update(cases)
    .set({
      stage,
      updatedAt: new Date(),
      serviceCompletedAt:
        stage === "completed" ? sql`COALESCE(${cases.serviceCompletedAt}, now())` : null,
    })
    .where(and(eq(cases.id, id), isNull(cases.purgedAt)))
    .returning({ id: cases.id });
  return updated.length > 0;
}

export async function findCaseIdByPaymentIntent(
  paymentIntentId: string,
): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  return row?.id ?? null;
}

// ── Documents ──────────────────────────────────────────────────────────────

export async function attachDocument(
  caseId: string,
  kind: DocumentKind,
  originalName: string,
  mimeType: string,
  plaintext: Buffer,
): Promise<StoredDocument> {
  const record = await getCase(caseId);
  if (!record || record.purgedAt) throw new Error(`Case ${caseId} not found`);

  const id = generateToken();
  const byteSize = plaintext.byteLength;

  // AAD binds ciphertext to this case AND this document kind, so a swapped
  // row fails authentication instead of decrypting as another applicant's
  // passport.
  const { ciphertext, ...envelope } = encryptDocument(plaintext, `${caseId}:${id}:${kind}`);
  plaintext.fill(0);

  const blobKey = documentKey(caseId, id);

  // Body first: if this throws, no row references a missing object.
  await blobStore().put(blobKey, Buffer.from(ciphertext, "base64"), mimeType);

  const db = await getDb();
  try {
    const [row] = await db
      .insert(caseDocuments)
      .values({
        id,
        caseId,
        kind,
        originalName,
        mimeType,
        byteSize,
        blobKey,
        wrappedKey: envelope.wrappedKey,
        iv: envelope.iv,
        authTag: envelope.authTag,
        algorithm: envelope.algorithm,
        keyVersion: envelope.keyVersion,
      })
      .returning();
    return toDocument(row!);
  } catch (error) {
    // Row insert failed: remove the orphaned body rather than leaving an
    // unreferenced passport scan in the bucket past its retention date.
    await blobStore().delete(blobKey).catch(() => {});
    throw error;
  }
}

export async function readDocument(
  caseId: string,
  documentId: string,
): Promise<{ document: StoredDocument; bytes: Buffer }> {
  if (!isValidCaseId(caseId)) throw new Error("Document not found");
  const db = await getDb();
  const [row] = await db
    .select()
    .from(caseDocuments)
    .where(and(eq(caseDocuments.caseId, caseId), eq(caseDocuments.id, documentId)))
    .limit(1);
  if (!row) throw new Error("Document not found");

  const document = toDocument(row);
  const ciphertext = await blobStore().get(document.blobKey);
  const bytes = decryptDocument(
    { ...document.crypto, ciphertext: ciphertext.toString("base64") },
    `${caseId}:${document.id}:${document.kind}`,
  );
  return { document, bytes };
}

// ── Retention ──────────────────────────────────────────────────────────────

export async function listExpiredCaseIds(completedBefore: Date): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(isNull(cases.purgedAt), lte(cases.serviceCompletedAt, completedBefore)))
    .orderBy(asc(cases.serviceCompletedAt));
  return rows.map((r) => r.id);
}

/** Open cases never marked complete — the retention clock has not started. */
export async function listStaleOpenCaseIds(createdBefore: Date): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(
      and(
        isNull(cases.purgedAt),
        isNull(cases.serviceCompletedAt),
        lte(cases.createdAt, createdBefore),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Irreversibly erase personal data, keeping the minimum record needed to prove
 * the deletion happened (GDPR Art. 5(2)) and the payment metadata Spanish
 * commercial law requires for invoices.
 *
 * Order is the whole design — each step idempotent, the marker written last:
 *   1. Document bodies in object storage   (the most sensitive data)
 *   2. Document rows (wrapped keys) and appointments
 *   3. Intake envelope and email index nulled and purged_at set, in ONE
 *      statement
 * Invoices are NOT touched: tax law requires keeping them, and their payer
 * details remain encrypted.
 * A crash between steps leaves purged_at unset, so the next run retries and
 * finishes. purged_at is never recorded for a deletion that did not complete,
 * and the cases_purged_has_no_intake CHECK makes that true at the database.
 */
export async function purgeCase(id: string): Promise<void> {
  if (!isValidCaseId(id)) return;
  const db = await getDb();
  const [row] = await db
    .select({ purgedAt: cases.purgedAt })
    .from(cases)
    .where(eq(cases.id, id))
    .limit(1);
  if (!row || row.purgedAt) return;

  await blobStore().deletePrefix(casePrefix(id));
  await db.delete(caseDocuments).where(eq(caseDocuments.caseId, id));
  await db.delete(appointments).where(eq(appointments.caseId, id));
  await db
    .update(cases)
    .set({ intakeEnvelope: null, emailIndex: null, purgedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cases.id, id), isNull(cases.purgedAt)));
}
