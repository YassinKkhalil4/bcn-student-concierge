import { randomInt } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { encryptDocument, generateToken, openJson, sealJson } from "@/lib/crypto";
import type { EncryptedPayload } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import {
  triageDocuments,
  triageEnquiries,
  type Locale,
  type TriageDocumentKind,
  type TriageDocumentRow,
  type TriageRow,
  type TriageStatus,
} from "@/lib/db/schema";
import { routeForNationality, selectForm } from "@/lib/forms/field-map";
import type { Attribution } from "@/lib/attribution";
import type { ServiceRoute } from "@/lib/pricing";
import { deadlineFor, type TriageData } from "@/lib/triage";
import { blobStore } from "./blob-store";
import { emailIndexFor, iso } from "./case-codec";
import { isUniqueViolation } from "./storage";

/**
 * Free-triage repository.
 *
 * Separate from the case repository on purpose: a triage enquiry is not a
 * client file, and keeping the two apart is what stops an unpaid enquiry ever
 * being read through a route that expects a paid case, or vice versa.
 *
 * The identifying half of an enquiry (name, email, nationality, free text) is
 * sealed before it reaches Postgres, exactly as the intake is. What stays
 * readable is only what the queue is sorted and filtered on.
 */

/** The sealed half of an enquiry. */
export interface TriageDetails {
  fullName: string;
  email: string;
  nationality: string;
  housing: string;
  notes?: string;
}

export interface TriageDocument {
  id: string;
  kind: TriageDocumentKind;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
}

export interface TriageRecord {
  id: string;
  ref: string;
  locale: Locale;
  route: ServiceRoute;
  formId: string;
  arrivedOn: string;
  deadlineOn: string | null;
  status: TriageStatus;
  /** NULL once purged. */
  details: TriageDetails | null;
  documents: TriageDocument[];
  createdAt: string;
  answeredAt: string | null;
  purgedAt: string | null;
}

export const triageAad = (id: string) => `triage:${id}`;

/** "TRI-" + 5 random digits, same shape and reasoning as a case reference. */
export function generateTriageRef(): string {
  return `TRI-${10000 + randomInt(90000)}`;
}

/** Object key layout, prefixed so a purge is one prefix delete. */
export const triageDocumentKey = (triageId: string, documentId: string) =>
  `triage/${triageId}/documents/${documentId}`;
export const triagePrefix = (triageId: string) => `triage/${triageId}/`;

function toDocument(row: TriageDocumentRow): TriageDocument {
  return {
    id: row.id,
    kind: row.kind,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function toRecord(row: TriageRow, docs: TriageDocumentRow[]): TriageRecord {
  return {
    id: row.id,
    ref: row.ref,
    locale: row.locale,
    route: row.route,
    formId: row.formId,
    arrivedOn: row.arrivedOn,
    deadlineOn: row.deadlineOn,
    status: row.status,
    details: row.enquiryEnvelope
      ? openJson<TriageDetails>(row.enquiryEnvelope, triageAad(row.id))
      : null,
    documents: docs.map(toDocument),
    createdAt: row.createdAt.toISOString(),
    answeredAt: iso(row.answeredAt),
    purgedAt: iso(row.purgedAt),
  };
}

export function isValidTriageId(id: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(id);
}

/**
 * Record an enquiry. Route, form and deadline are all derived here from the
 * nationality and entry date the student gave — never accepted from the
 * browser, so what staff see is what the rules produce.
 */
export async function createTriage(
  data: TriageData,
  options: { locale?: Locale; attribution?: Attribution } = {},
): Promise<TriageRecord> {
  const db = await getDb();
  // The id is part of the AAD, so it must exist before the details are sealed.
  const id = generateToken();
  const route = routeForNationality(data.nationality);
  const values = {
    id,
    locale: options.locale ?? "en",
    route,
    formId: selectForm(data.nationality),
    arrivedOn: data.arrivedOn,
    deadlineOn: deadlineFor(route, data.arrivedOn),
    source: options.attribution?.source ?? null,
    guideVisitorId: options.attribution?.guideVisitorId ?? null,
    emailIndex: emailIndexFor(data.email),
    enquiryEnvelope: sealJson(
      {
        fullName: data.fullName,
        email: data.email,
        nationality: data.nationality,
        housing: data.housing,
        ...(data.notes ? { notes: data.notes } : {}),
      } satisfies TriageDetails,
      triageAad(id),
    ),
  } as const;

  for (let attempt = 1; ; attempt++) {
    try {
      const [row] = await db
        .insert(triageEnquiries)
        .values({ ...values, ref: generateTriageRef() })
        .returning();
      return toRecord(row!, []);
    } catch (error) {
      if (attempt >= 8 || !isUniqueViolation(error, "triage_enquiries_ref_unique")) throw error;
    }
  }
}

export async function getTriage(id: string): Promise<TriageRecord | null> {
  if (!isValidTriageId(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(triageEnquiries).where(eq(triageEnquiries.id, id)).limit(1);
  if (!row) return null;
  const docs = await db
    .select()
    .from(triageDocuments)
    .where(eq(triageDocuments.triageId, id))
    .orderBy(asc(triageDocuments.uploadedAt));
  return toRecord(row, docs);
}

/**
 * Attach one of the three triage documents.
 *
 * Body first, row second — as with case documents, so a failure never leaves a
 * row pointing at an object that is not there. A re-upload of the same kind
 * replaces the previous one, and the superseded body is deleted.
 */
export async function attachTriageDocument(
  triageId: string,
  kind: TriageDocumentKind,
  originalName: string,
  mimeType: string,
  plaintext: Buffer,
): Promise<TriageDocument> {
  const db = await getDb();
  const id = generateToken();
  const byteSize = plaintext.byteLength;

  // AAD binds the ciphertext to this enquiry AND this document kind.
  const { ciphertext, ...envelope } = encryptDocument(plaintext, `${triageId}:${id}:${kind}`);
  plaintext.fill(0);

  const blobKey = triageDocumentKey(triageId, id);
  await blobStore().put(blobKey, Buffer.from(ciphertext, "base64"), mimeType);

  try {
    const [previous] = await db
      .select()
      .from(triageDocuments)
      .where(and(eq(triageDocuments.triageId, triageId), eq(triageDocuments.kind, kind)))
      .limit(1);

    const [row] = await db
      .insert(triageDocuments)
      .values({
        id,
        triageId,
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
      .onConflictDoUpdate({
        target: [triageDocuments.triageId, triageDocuments.kind],
        set: {
          id,
          originalName,
          mimeType,
          byteSize,
          blobKey,
          wrappedKey: envelope.wrappedKey,
          iv: envelope.iv,
          authTag: envelope.authTag,
          algorithm: envelope.algorithm,
          keyVersion: envelope.keyVersion,
          uploadedAt: new Date(),
        },
      })
      .returning();

    // Only once the row points at the new body: drop the one it replaced.
    if (previous && previous.blobKey !== blobKey) {
      await blobStore().delete(previous.blobKey).catch(() => {});
    }
    return toDocument(row!);
  } catch (error) {
    await blobStore().delete(blobKey).catch(() => {});
    throw error;
  }
}

/** The staff queue: still open, soonest deadline first, undated last. */
export async function listOpenTriage(limit = 100): Promise<TriageRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(triageEnquiries)
    .where(and(eq(triageEnquiries.status, "new"), isNull(triageEnquiries.purgedAt)))
    .orderBy(asc(triageEnquiries.deadlineOn), desc(triageEnquiries.createdAt))
    .limit(limit);
  return rows.map((row) => toRecord(row, []));
}

export async function setTriageStatus(id: string, status: TriageStatus): Promise<void> {
  const db = await getDb();
  await db
    .update(triageEnquiries)
    .set({ status, answeredAt: status === "new" ? null : new Date() })
    .where(eq(triageEnquiries.id, id));
}

/**
 * Erase an enquiry's personal data: documents, then the sealed details.
 * Ordered so a crash leaves it retryable, never falsely complete.
 */
export async function purgeTriage(id: string): Promise<void> {
  const db = await getDb();
  await blobStore().deletePrefix(triagePrefix(id));
  await db.delete(triageDocuments).where(eq(triageDocuments.triageId, id));
  await db
    .update(triageEnquiries)
    .set({ enquiryEnvelope: null as unknown as EncryptedPayload, emailIndex: null, purgedAt: new Date() })
    .where(eq(triageEnquiries.id, id));
}
