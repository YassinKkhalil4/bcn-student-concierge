import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { cases, type Locale } from "@/lib/db/schema";
import { emailIndexFor } from "./case-codec";

/** Repository functions the student portal needs. */

export interface PortalCaseRef {
  id: string;
  ref: string;
  locale: Locale;
}

/**
 * Open cases filed under this email. Uses the blind index — the email itself is
 * encrypted and cannot be queried. More than one match is legitimate (a parent
 * filing for two children with one address).
 */
export async function findCasesByEmail(email: string): Promise<PortalCaseRef[]> {
  const db = await getDb();
  return db
    .select({ id: cases.id, ref: cases.ref, locale: cases.locale })
    .from(cases)
    .where(and(eq(cases.emailIndex, emailIndexFor(email)), isNull(cases.purgedAt)));
}

/**
 * Accept a sign-in link exactly once. A single compare-and-set UPDATE: it only
 * matches while the link is newer than the last sign-in, and it moves the
 * last-sign-in marker forward in the same statement. Two simultaneous uses of
 * one link cannot both succeed — the second finds the marker already moved.
 *
 * The marker uses the APP clock (the same clock that stamped the link), not the
 * database's now(): if the two clocks drifted, a fresh link could otherwise be
 * judged older than a sign-in that happened before it.
 */
export async function consumeLoginLink(
  caseId: string,
  issuedAt: Date,
  now = new Date(),
): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(cases)
    .set({ portalLoginAt: now })
    .where(
      and(
        eq(cases.id, caseId),
        isNull(cases.purgedAt),
        or(isNull(cases.portalLoginAt), lt(cases.portalLoginAt, issuedAt)),
      ),
    )
    .returning({ id: cases.id });
  return updated.length === 1;
}

/**
 * The student pressed "Submit for review". True only on the first transition,
 * so the staff notification fires once however many times the button is hit.
 */
export async function markDocumentsSubmitted(caseId: string): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(cases)
    .set({ documentsSubmittedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(cases.id, caseId), isNull(cases.documentsSubmittedAt), isNull(cases.purgedAt)))
    .returning({ id: cases.id });
  return updated.length === 1;
}

/** Just the human reference — for notifications, which must carry nothing else. */
export async function getCaseRef(caseId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ ref: cases.ref }).from(cases).where(eq(cases.id, caseId)).limit(1);
  return row?.ref ?? null;
}

/**
 * The student switched language in the portal. Emails and the appointment
 * sheet follow the file's language, so it is saved on the case.
 */
export async function setCaseLocale(caseId: string, locale: Locale): Promise<void> {
  const db = await getDb();
  await db
    .update(cases)
    .set({ locale, updatedAt: new Date() })
    .where(and(eq(cases.id, caseId), isNull(cases.purgedAt)));
}
