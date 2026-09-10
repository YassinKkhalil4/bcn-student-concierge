import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { EncryptedPayload } from "../crypto";

/**
 * Postgres schema for case metadata.
 *
 * NO PERSONAL DATA IS STORED IN PLAINTEXT HERE.
 *  - The intake questionnaire (passport number, names, birth data, address) is
 *    an AES-256-GCM envelope in `cases.intake_envelope`, under its own key.
 *  - Document BODIES live in blob storage (blob-store.ts); this database holds
 *    only their object key and per-document envelope metadata.
 * Every envelope's data key is wrapped by the master key, which is held outside
 * the database. A stolen dump or backup of this database decrypts nothing.
 *
 * Enumerated columns are `text` with CHECK constraints rather than Postgres
 * enums: adding a value to a pg enum needs a migration that cannot run inside a
 * transaction, which is a poor trade for a list that will change as the
 * workflow does. The CHECK still stops a bad value reaching disk.
 */

export const STAGES = ["new", "in_progress", "completed"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "refunded"] as const;
export const FORM_IDS = ["EX-17", "EX-18"] as const;
export const DOCUMENT_KINDS = ["passport", "acceptance-letter", "lease"] as const;

export type Stage = (typeof STAGES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const cases = pgTable(
  "cases",
  {
    /** Opaque 256-bit token. Doubles as the Stripe client_reference_id. */
    id: text("id").primaryKey(),
    tierId: text("tier_id").notNull(),
    /** Derived from nationality at intake; stored so the dashboard can filter. */
    formId: text("form_id", { enum: FORM_IDS }).notNull(),
    /** Internal workflow stage, set by staff. */
    stage: text("stage", { enum: STAGES }).notNull().default("new"),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES })
      .notNull()
      .default("pending"),
    stripeSessionId: text("stripe_session_id"),
    /**
     * Refunds arrive as `charge.refunded`, whose object carries the PaymentIntent
     * id — not the Checkout Session's metadata. Storing the PI id is what lets a
     * refund be matched back to its case.
     */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /**
     * The validated intake payload, envelope-encrypted with the case id as AAD
     * (so an envelope copied onto another case fails to decrypt). NULL after
     * purge — nulling it is the erasure.
     */
    intakeEnvelope: jsonb("intake_envelope").$type<EncryptedPayload>(),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
    /** Starts the 30-day retention clock. */
    serviceCompletedAt: tstz("service_completed_at"),
    /** Set last by the purge, only after documents and intake are gone. */
    purgedAt: tstz("purged_at"),
  },
  (t) => [
    index("cases_created_at_idx").on(t.createdAt),
    index("cases_stage_idx").on(t.stage),
    index("cases_payment_status_idx").on(t.paymentStatus),
    index("cases_payment_intent_idx").on(t.stripePaymentIntentId),
    // The purge job's query: completed, not yet purged, oldest first.
    index("cases_retention_idx")
      .on(t.serviceCompletedAt)
      .where(sql`${t.purgedAt} IS NULL`),
    check("cases_stage_check", sql`${t.stage} IN (${inList(STAGES)})`),
    check(
      "cases_payment_status_check",
      sql`${t.paymentStatus} IN (${inList(PAYMENT_STATUSES)})`,
    ),
    check("cases_form_id_check", sql`${t.formId} IN (${inList(FORM_IDS)})`),
    // A purged case must not still hold personal data.
    check(
      "cases_purged_has_no_intake",
      sql`${t.purgedAt} IS NULL OR ${t.intakeEnvelope} IS NULL`,
    ),
  ],
);

export const caseDocuments = pgTable(
  "case_documents",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DOCUMENT_KINDS }).notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    /** Object-storage key for the ciphertext. */
    blobKey: text("blob_key").notNull().unique(),
    // ── Envelope metadata (everything except the ciphertext) ──
    wrappedKey: text("wrapped_key").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    algorithm: text("algorithm").notNull(),
    keyVersion: integer("key_version").notNull(),
    uploadedAt: tstz("uploaded_at").notNull().defaultNow(),
  },
  (t) => [
    index("case_documents_case_id_idx").on(t.caseId),
    check("case_documents_kind_check", sql`${t.kind} IN (${inList(DOCUMENT_KINDS)})`),
  ],
);

/**
 * Sliding-window rate limit counters (see src/lib/rate-limit.ts).
 *
 * `key` is an HMAC of the client IP, never the IP itself — an IP address is
 * personal data under GDPR, and a counter table has no need to know it. Rows
 * older than two windows are useless and are deleted by the maintenance job.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    windowStart: tstz("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.key, t.windowStart] }),
    index("rate_limits_window_start_idx").on(t.windowStart),
  ],
);

export type CaseRow = typeof cases.$inferSelect;
export type DocumentRow = typeof caseDocuments.$inferSelect;
