import { and, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { FormId } from "@/lib/forms/field-map";
import { getDb } from "@/lib/db/client";
import {
  cases,
  caseDocuments,
  type DocumentKind,
  type PaymentStatus,
  type Stage,
} from "@/lib/db/schema";
import { iso, openIntake } from "./case-codec";

/** Admin dashboard queries: queues, counts and search over encrypted intakes. */

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
  ref: string;
  /** The student pressed "Submit for review". */
  documentsSubmittedAt: string | null;
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
      if (!fold(r.id).startsWith(q) && !fold(r.ref).includes(q) && !haystack.includes(q)) continue;
    }
    summaries.push({
      id: r.id,
      ref: r.ref,
      documentsSubmittedAt: iso(r.documentsSubmittedAt),
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

