import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  unique,
  check,
  primaryKey,
  type AnyPgColumn,
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
export const LOCALES = ["en", "es", "ca", "fr", "it", "de"] as const;
/**
 * `lease` doubles as the proof of domicile the city asks for alongside an
 * authorisation (the lease or the property deed), so it keeps its name.
 */
export const DOCUMENT_KINDS = [
  "passport",
  "acceptance-letter",
  "lease",
  "utility-bill",
  "padron-authorization", // signed "Autorització per inscriure-us al domicili"
  "authorizer-id", // ID of whoever signed that authorisation
  "collective-authorization", // student residence form, signed and stamped
] as const;
export const INVOICE_SERIES = ["INV", "RECT"] as const;
export const APPOINTMENT_KINDS = ["padron", "police"] as const;

export type Stage = (typeof STAGES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type Locale = (typeof LOCALES)[number];
export type InvoiceSeries = (typeof INVOICE_SERIES)[number];
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const cases = pgTable(
  "cases",
  {
    /** Opaque 256-bit token. Doubles as the Stripe client_reference_id. */
    id: text("id").primaryKey(),
    /**
     * Human reference for staff, the student and notifications: "BCN-58213".
     * Random rather than sequential — a counting reference would tell every
     * client how many clients came before them.
     */
    ref: text("ref").notNull().unique(),
    /** Language the student uses; their guides and emails are generated in it. */
    locale: text("locale", { enum: LOCALES }).notNull().default("en"),
    /**
     * Blind index for sign-in-by-email: an HMAC of the normalised email under a
     * key derived from the master key. The email itself stays inside the
     * encrypted intake; this lets us find a case by email without storing it
     * readable. Still personal data (it identifies a person), so it is nulled
     * by the purge like the intake.
     */
    emailIndex: text("email_index"),
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
    /**
     * Last successful sign-in-link use. A link is valid only if it was issued
     * AFTER this moment, so using one link invalidates every link issued
     * before it — single-use without a token table.
     */
    portalLoginAt: tstz("portal_login_at"),
    /** The student pressed "Submit for review": all their documents are in. */
    documentsSubmittedAt: tstz("documents_submitted_at"),
  },
  (t) => [
    index("cases_created_at_idx").on(t.createdAt),
    index("cases_stage_idx").on(t.stage),
    index("cases_payment_status_idx").on(t.paymentStatus),
    index("cases_payment_intent_idx").on(t.stripePaymentIntentId),
    index("cases_email_index_idx").on(t.emailIndex),
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
      sql`${t.purgedAt} IS NULL OR (${t.intakeEnvelope} IS NULL AND ${t.emailIndex} IS NULL)`,
    ),
    check("cases_locale_check", sql`${t.locale} IN (${inList(LOCALES)})`),
    check("cases_ref_format", sql`${t.ref} ~ '^BCN-[0-9]{5}$'`),
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

/**
 * Police / Padrón appointments booked for a case. Feeds the appointment-day
 * sheet. `officeCode` refers to the office list in src/lib/offices.ts.
 * Deleted by the purge with everything else.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: APPOINTMENT_KINDS }).notNull(),
    /** Preset key from src/lib/offices.ts, or "custom". */
    officeCode: text("office_code").notNull(),
    /**
     * The office as staff recorded it when booking, frozen onto the
     * appointment: the sheet prints exactly what staff confirmed, and a later
     * edit to a preset cannot move an appointment that is already booked.
     */
    officeName: text("office_name").notNull().default(""),
    officeAddress: text("office_address").notNull().default(""),
    nearestMetro: text("nearest_metro"),
    scheduledAt: tstz("scheduled_at").notNull(),
    /** The number on the "justificante de cita", if staff record it. */
    confirmationCode: text("confirmation_code"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("appointments_case_kind_unique").on(t.caseId, t.kind),
    check("appointments_kind_check", sql`${t.kind} IN (${inList(APPOINTMENT_KINDS)})`),
  ],
);

// ── Invoicing (facturas) ─────────────────────────────────────────────────────
//
// Spanish invoicing law (RD 1619/2012) requires correlative numbering within a
// series, invoices that are never altered after issue, and corrections only by
// a separate *factura rectificativa*. The design follows from that:
//
//  - Numbers come from `invoice_counters`, incremented in the SAME transaction
//    as the invoice insert. A Postgres SEQUENCE is deliberately not used: a
//    sequence value consumed by a rolled-back transaction is lost, leaving a
//    gap in the numbering. The counter rolls back with the insert.
//  - A trigger (migration 0002) rejects UPDATE and DELETE on `invoices`.
//  - Refunds produce RECT-series invoices with negative amounts that point at
//    the invoice they correct.
//  - Invoices are kept after the 30-day purge: tax law requires it. The payer's
//    identity is still encrypted, like the intake.

/** The issuing business, frozen onto each invoice at the moment of issue. */
export interface InvoiceIssuer {
  name: string;
  taxId: string;
  address: string;
}

export const invoiceCounters = pgTable(
  "invoice_counters",
  {
    series: text("series", { enum: INVOICE_SERIES }).notNull(),
    /** Calendar year in Europe/Madrid — numbering restarts each year. */
    year: integer("year").notNull(),
    last: integer("last").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.series, t.year] }),
    check("invoice_counters_series_check", sql`${t.series} IN (${inList(INVOICE_SERIES)})`),
    check("invoice_counters_last_positive", sql`${t.last} > 0`),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    /** "INV-2026-0001" / "RECT-2026-0001". */
    number: text("number").notNull().unique(),
    series: text("series", { enum: INVOICE_SERIES }).notNull(),
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    /** Set on a rectificativa: the invoice it corrects. */
    rectifiesId: text("rectifies_id").references((): AnyPgColumn => invoices.id, {
      onDelete: "restrict",
    }),
    /** Why a rectificativa was issued ("Devolución total", "Devolución parcial"). */
    reason: text("reason"),
    issuedAt: tstz("issued_at").notNull(),
    /** The line as sold, frozen: the package name at the time of sale. */
    description: text("description").notNull(),
    // Integer cents throughout: no floating-point money.
    baseCents: integer("base_cents").notNull(),
    /** Basis points: 2100 = 21 % IVA. */
    ivaRateBp: integer("iva_rate_bp").notNull(),
    ivaCents: integer("iva_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    issuer: jsonb("issuer").$type<InvoiceIssuer>().notNull(),
    /** Payer's name, tax ID and address — encrypted, AAD `invoice:<id>`. */
    billingEnvelope: jsonb("billing_envelope").$type<EncryptedPayload>().notNull(),
    stripeSessionId: text("stripe_session_id"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("invoices_series_year_sequence_unique").on(t.series, t.year, t.sequence),
    // One invoice per paid Checkout Session: the backstop behind the webhook's
    // own idempotency check.
    uniqueIndex("invoices_session_unique")
      .on(t.stripeSessionId)
      .where(sql`${t.series} = 'INV'`),
    index("invoices_case_id_idx").on(t.caseId),
    index("invoices_issued_at_idx").on(t.issuedAt),
    check("invoices_series_check", sql`${t.series} IN (${inList(INVOICE_SERIES)})`),
    check("invoices_totals_add_up", sql`${t.baseCents} + ${t.ivaCents} = ${t.totalCents}`),
    // A rectificativa must name its original and its reason; an invoice must not.
    check(
      "invoices_rect_links_original",
      sql`(${t.series} = 'RECT') = (${t.rectifiesId} IS NOT NULL AND ${t.reason} IS NOT NULL)`,
    ),
    check(
      "invoices_sign_matches_series",
      sql`(${t.series} = 'INV' AND ${t.totalCents} > 0) OR (${t.series} = 'RECT' AND ${t.totalCents} < 0)`,
    ),
    check("invoices_number_matches_parts", sql`${t.number} = ${t.series} || '-' || ${t.year} || '-' || lpad(${t.sequence}::text, 4, '0')`),
  ],
);

export type CaseRow = typeof cases.$inferSelect;
export type DocumentRow = typeof caseDocuments.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;
