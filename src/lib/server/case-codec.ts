import { randomInt } from "node:crypto";
import { openJson, pseudonymize, sealJson } from "@/lib/crypto";
import type { IntakeData } from "@/lib/schema";
import type { CaseRow } from "@/lib/db/schema";

/**
 * How case data is sealed, opened and indexed. Shared by the repository
 * (storage.ts) and the admin listing (case-listing.ts), and nothing else: no
 * other module should ever handle an intake envelope directly.
 */

export const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** AAD for a case's intake envelope — binds the ciphertext to this case row. */
export const intakeAad = (caseId: string) => `case:${caseId}:intake`;

export function sealIntake(caseId: string, intake: IntakeData) {
  return sealJson(intake, intakeAad(caseId));
}

export function openIntake(row: CaseRow): IntakeData | null {
  return row.intakeEnvelope ? openJson<IntakeData>(row.intakeEnvelope, intakeAad(row.id)) : null;
}

/**
 * Blind index for finding a case by email without storing the email readably.
 * Normalised first so "Chidi@Example.com " and "chidi@example.com" match.
 */
export function emailIndexFor(email: string): string {
  return pseudonymize(email.trim().toLowerCase(), "email-lookup");
}

/**
 * Human reference, "BCN-" + 5 random digits. 90,000 possible values: collisions
 * are retried on insert, and the space stays comfortable into the tens of
 * thousands of cases. Random, so a reference reveals nothing about volume.
 */
export function generateCaseRef(): string {
  return `BCN-${10000 + randomInt(90000)}`;
}
