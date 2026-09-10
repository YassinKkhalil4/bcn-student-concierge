import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { encryptDocument, decryptDocument, generateToken, sealJson, openJson } from "@/lib/crypto";
import type { EncryptedPayload } from "@/lib/crypto";
import type { IntakeData } from "@/lib/schema";
import { selectForm, type FormId } from "@/lib/forms/field-map";
import { getDb } from "@/lib/db/client";
import {
  cases,
  caseDocuments,
  type CaseRow,
  type DocumentKind,
  type DocumentRow,
  type PaymentStatus,
  type Stage,
} from "@/lib/db/schema";
import { blobStore, documentKey, casePrefix } from "./blob-store";

/**
 * Case repository — Postgres for metadata, blob storage for document bodies.
 *
 * ENCRYPTED INTAKE
 * The intake questionnaire is sealed before it reaches Postgres and opened only
 * in this module. Nothing outside it ever sees an envelope, and the database
 * never sees a name, passport number or address in the clear.
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
}

/** Case ids are server-generated tokens. Reject anything else before querying. */
export function isValidCaseId(id: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(id);
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** AAD for a case's intake envelope — binds the ciphertext to this case row. */
const intakeAad = (caseId: string) => `case:${caseId}:intake`;

function openIntake(row: CaseRow): IntakeData | null {
  return row.intakeEnvelope ? openJson<IntakeData>(row.intakeEnvelope, intakeAad(row.id)) : null;
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
  };
}

// ── Cases ──────────────────────────────────────────────────────────────────

export async function createCase(intake: IntakeData): Promise<CaseRecord> {
  const db = await getDb();
  // The id is part of the AAD, so it must exist before the intake is sealed.
  const id = generateToken();
  const [row] = await db
    .insert(cases)
    .values({
      id,
      tierId: intake.tierId,
      formId: selectForm(intake.identity.nationality),
      intakeEnvelope: sealJson(intake, intakeAad(id)),
    })
    .returning();
  return toRecord(row!, []);
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

// ── Admin listing ──────────────────────────────────────────────────────────

/**
 * Dashboard queues. Each open case sits in exactly one of the first four, so
 * the tab counts add up and nothing is double-listed:
 *   action      paid, not yet started — the queue staff work from
 *   in_progress being handled
 *   unpaid      intake submitted, payment not received
 *   completed   done; retention clock running
 *   purged      personal data erased, accounting record only
 */
export const BUCKETS = ["action", "in_progress", "unpaid", "completed", "purged", "all"] as const;
export type CaseBucket = (typeof BUCKETS)[number];

function bucketWhere(bucket: CaseBucket): SQL | undefined {
  const open = isNull(cases.purgedAt);
  switch (bucket) {
    case "action":
      return and(open, eq(cases.paymentStatus, "paid"), eq(cases.stage, "new"));
    case "in_progress":
      return and(open, eq(cases.stage, "in_progress"));
    case "unpaid":
      return and(open, eq(cases.stage, "new"), eq(cases.paymentStatus, "pending"));
    case "completed":
      return and(open, eq(cases.stage, "completed"));
    case "purged":
      return isNotNull(cases.purgedAt);
    case "all":
      return undefined;
  }
}

/** Lowercase and strip accents, so "garcia" finds "GARCÍA". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export interface CaseSummary {
  id: string;
  formId: FormId;
  tierId: string;
  stage: Stage;
  paymentStatus: PaymentStatus;
  applicant: string | null;
  nationality: string | null;
  email: string | null;
  documentKinds: DocumentKind[];
  createdAt: string;
  serviceCompletedAt: string | null;
  purgedAt: string | null;
}

/**
 * Upper bound on rows decrypted per search.
 *
 * The intake is encrypted, so Postgres cannot search inside it — matching
 * happens here, after decryption. That is cheap at boutique volumes (thousands
 * of cases decrypt in milliseconds) but it is a scan, so it is capped: a search
 * covers the most recent SEARCH_SCAN_LIMIT cases in the selected queue. Beyond
 * that scale, add blind indexes (HMACs of normalised surname/email/passport).
 */
export const SEARCH_SCAN_LIMIT = 5000;

export async function listCases(options: {
  bucket?: CaseBucket;
  query?: string;
  limit?: number;
} = {}): Promise<CaseSummary[]> {
  const db = await getDb();
  const limit = Math.min(options.limit ?? 200, 500);
  const q = options.query?.trim() ? fold(options.query.trim()) : "";

  const rows = await db
    .select()
    .from(cases)
    .where(bucketWhere(options.bucket ?? "all"))
    .orderBy(desc(cases.createdAt))
    .limit(q ? SEARCH_SCAN_LIMIT : limit);

  const summaries: CaseSummary[] = [];
  for (const r of rows) {
    const intake = openIntake(r);
    const id = intake?.identity;
    if (q) {
      // The reference is not personal data and is matched as a prefix; the
      // rest is matched anywhere in the decrypted fields.
      const haystack = intake
        ? fold(
            [id!.firstSurname, id!.secondSurname, id!.givenName, id!.passportNumber, id!.nie,
              intake.contact.email, intake.contact.phone].filter(Boolean).join(" "),
          )
        : "";
      if (!fold(r.id).startsWith(q) && !haystack.includes(q)) continue;
    }
    summaries.push({
      id: r.id,
      formId: r.formId,
      tierId: r.tierId,
      stage: r.stage,
      paymentStatus: r.paymentStatus,
      applicant: id
        ? [id.firstSurname, id.secondSurname].filter(Boolean).join(" ") + `, ${id.givenName}`
        : null,
      nationality: id?.nationality ?? null,
      email: intake?.contact.email ?? null,
      documentKinds: [],
      createdAt: r.createdAt.toISOString(),
      serviceCompletedAt: iso(r.serviceCompletedAt),
      purgedAt: iso(r.purgedAt),
    });
    if (summaries.length >= limit) break;
  }

  if (summaries.length) {
    const docs = await db
      .select({ caseId: caseDocuments.caseId, kind: caseDocuments.kind })
      .from(caseDocuments)
      .where(inArray(caseDocuments.caseId, summaries.map((c) => c.id)));
    const byCase = new Map<string, Set<DocumentKind>>();
    for (const d of docs) byCase.set(d.caseId, (byCase.get(d.caseId) ?? new Set()).add(d.kind));
    for (const c of summaries) c.documentKinds = [...(byCase.get(c.id) ?? [])];
  }

  return summaries;
}

export async function countCasesByBucket(): Promise<Record<CaseBucket, number>> {
  const db = await getDb();
  const count = (where: SQL | undefined) =>
    (where ? sql<number>`count(*) FILTER (WHERE ${where})` : sql<number>`count(*)`).mapWith(
      Number,
    );
  const [row] = await db
    .select({
      action: count(bucketWhere("action")),
      in_progress: count(bucketWhere("in_progress")),
      unpaid: count(bucketWhere("unpaid")),
      completed: count(bucketWhere("completed")),
      purged: count(bucketWhere("purged")),
      all: count(undefined),
    })
    .from(cases);
  return row!;
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
 *   2. Document rows (wrapped keys)
 *   3. Intake envelope nulled and purged_at set, in ONE statement
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
  await db
    .update(cases)
    .set({ intakeEnvelope: null, purgedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cases.id, id), isNull(cases.purgedAt)));
}
