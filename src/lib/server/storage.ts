import { mkdir, readFile, writeFile, readdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import { encryptDocument, decryptDocument, generateToken } from "@/lib/crypto";
import type { EncryptedPayload } from "@/lib/crypto";
import type { IntakeData } from "@/lib/schema";

/**
 * Reference persistence layer.
 *
 * ⚠️ This filesystem implementation exists so the repository runs end-to-end
 * without external infrastructure. It is NOT production storage: it has no
 * transactions, no replication, and no server-side object encryption beneath
 * our own. For production, implement this same interface over Postgres +
 * S3/R2 with SSE-KMS enabled. The envelope encryption in crypto.ts stays
 * either way — it is defence in depth beneath the provider's own encryption.
 */

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const CASES_DIR = path.join(DATA_DIR, "cases");

export type DocumentKind = "passport" | "acceptance-letter" | "lease";

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  payload: EncryptedPayload;
}

export interface CaseRecord {
  id: string;
  tierId: string;
  intake: IntakeData;
  documents: StoredDocument[];
  createdAt: string;
  /** Set when the engagement completes — starts the 30-day retention clock. */
  serviceCompletedAt: string | null;
  /** Set by the purge job. A purged case keeps only non-personal audit fields. */
  purgedAt: string | null;
  paymentStatus: "pending" | "paid" | "refunded";
  stripeSessionId: string | null;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}

function caseFile(id: string): string {
  // `id` is always a server-generated token, never user input, but validate
  // anyway so a future caller cannot traverse out of the data directory.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) throw new Error("Invalid case id");
  return path.join(CASES_DIR, `${id}.json`);
}

export async function createCase(
  intake: IntakeData,
): Promise<CaseRecord> {
  await ensureDir(CASES_DIR);
  const record: CaseRecord = {
    id: generateToken(),
    tierId: intake.tierId,
    intake,
    documents: [],
    createdAt: new Date().toISOString(),
    serviceCompletedAt: null,
    purgedAt: null,
    paymentStatus: "pending",
    stripeSessionId: null,
  };
  await writeFile(caseFile(record.id), JSON.stringify(record, null, 2), {
    mode: 0o600,
  });
  return record;
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  try {
    return JSON.parse(await readFile(caseFile(id), "utf8")) as CaseRecord;
  } catch {
    return null;
  }
}

export async function updateCase(
  id: string,
  patch: Partial<CaseRecord>,
): Promise<CaseRecord> {
  const existing = await getCase(id);
  if (!existing) throw new Error(`Case ${id} not found`);
  const updated = { ...existing, ...patch, id: existing.id };
  await writeFile(caseFile(id), JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}

export async function listCases(): Promise<CaseRecord[]> {
  await ensureDir(CASES_DIR);
  const files = await readdir(CASES_DIR);
  const records: CaseRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      records.push(
        JSON.parse(await readFile(path.join(CASES_DIR, file), "utf8")) as CaseRecord,
      );
    } catch {
      // A corrupt record must not stop the purge job from processing the rest.
    }
  }
  return records;
}

export async function attachDocument(
  caseId: string,
  kind: DocumentKind,
  originalName: string,
  mimeType: string,
  plaintext: Buffer,
): Promise<StoredDocument> {
  const record = await getCase(caseId);
  if (!record) throw new Error(`Case ${caseId} not found`);

  const id = generateToken();
  // AAD binds ciphertext to this case AND this document kind, so a swapped
  // record in the store fails authentication instead of decrypting to the
  // wrong applicant's passport.
  const doc: StoredDocument = {
    id,
    kind,
    originalName,
    mimeType,
    byteSize: plaintext.byteLength,
    uploadedAt: new Date().toISOString(),
    payload: encryptDocument(plaintext, `${caseId}:${id}:${kind}`),
  };
  plaintext.fill(0);

  await updateCase(caseId, { documents: [...record.documents, doc] });
  return doc;
}

export async function readDocument(
  caseId: string,
  documentId: string,
): Promise<Buffer> {
  const record = await getCase(caseId);
  const doc = record?.documents.find((d) => d.id === documentId);
  if (!record || !doc) throw new Error("Document not found");
  return decryptDocument(doc.payload, `${caseId}:${doc.id}:${doc.kind}`);
}

/**
 * Irreversibly remove personal data while keeping the minimum record needed to
 * prove the deletion happened — GDPR Art. 5(1)(e) storage limitation balanced
 * against Art. 5(2) accountability. Spanish commercial law separately requires
 * invoice records for 4 years, which is why payment metadata survives while
 * identity data does not.
 */
export async function purgeCase(id: string): Promise<void> {
  const record = await getCase(id);
  if (!record) return;
  const tombstone: CaseRecord = {
    id: record.id,
    tierId: record.tierId,
    intake: null as unknown as IntakeData,
    documents: [],
    createdAt: record.createdAt,
    serviceCompletedAt: record.serviceCompletedAt,
    purgedAt: new Date().toISOString(),
    paymentStatus: record.paymentStatus,
    stripeSessionId: record.stripeSessionId,
  };
  await writeFile(caseFile(id), JSON.stringify(tombstone, null, 2), { mode: 0o600 });
}

export async function destroyAll(): Promise<void> {
  await rm(CASES_DIR, { recursive: true, force: true });
}

export { unlink };
