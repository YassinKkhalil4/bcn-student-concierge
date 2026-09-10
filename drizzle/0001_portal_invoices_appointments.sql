CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"kind" text NOT NULL,
	"office_code" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"confirmation_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_case_kind_unique" UNIQUE("case_id","kind"),
	CONSTRAINT "appointments_kind_check" CHECK ("appointments"."kind" IN ('padron', 'police'))
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"series" text NOT NULL,
	"year" integer NOT NULL,
	"last" integer NOT NULL,
	CONSTRAINT "invoice_counters_series_year_pk" PRIMARY KEY("series","year"),
	CONSTRAINT "invoice_counters_series_check" CHECK ("invoice_counters"."series" IN ('INV', 'RECT')),
	CONSTRAINT "invoice_counters_last_positive" CHECK ("invoice_counters"."last" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"series" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"case_id" text NOT NULL,
	"rectifies_id" text,
	"reason" text,
	"issued_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"base_cents" integer NOT NULL,
	"iva_rate_bp" integer NOT NULL,
	"iva_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"issuer" jsonb NOT NULL,
	"billing_envelope" jsonb NOT NULL,
	"stripe_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_series_year_sequence_unique" UNIQUE("series","year","sequence"),
	CONSTRAINT "invoices_series_check" CHECK ("invoices"."series" IN ('INV', 'RECT')),
	CONSTRAINT "invoices_totals_add_up" CHECK ("invoices"."base_cents" + "invoices"."iva_cents" = "invoices"."total_cents"),
	CONSTRAINT "invoices_rect_links_original" CHECK (("invoices"."series" = 'RECT') = ("invoices"."rectifies_id" IS NOT NULL AND "invoices"."reason" IS NOT NULL)),
	CONSTRAINT "invoices_sign_matches_series" CHECK (("invoices"."series" = 'INV' AND "invoices"."total_cents" > 0) OR ("invoices"."series" = 'RECT' AND "invoices"."total_cents" < 0)),
	CONSTRAINT "invoices_number_matches_parts" CHECK ("invoices"."number" = "invoices"."series" || '-' || "invoices"."year" || '-' || lpad("invoices"."sequence"::text, 4, '0'))
);
--> statement-breakpoint
ALTER TABLE "case_documents" DROP CONSTRAINT "case_documents_kind_check";--> statement-breakpoint
ALTER TABLE "cases" DROP CONSTRAINT "cases_purged_has_no_intake";--> statement-breakpoint
-- Hand-edited: adding "ref" as NOT NULL outright fails on any database that
-- already holds cases. Add it nullable, give existing rows unique random
-- references in the same format the app uses, then enforce NOT NULL.
ALTER TABLE "cases" ADD COLUMN "ref" text;--> statement-breakpoint
DO $$
DECLARE
  r record;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM "cases" WHERE "ref" IS NULL LOOP
    LOOP
      candidate := 'BCN-' || (10000 + floor(random() * 90000))::int::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "cases" WHERE "ref" = candidate);
    END LOOP;
    UPDATE "cases" SET "ref" = candidate WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "ref" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "email_index" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "portal_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "documents_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rectifies_id_invoices_id_fk" FOREIGN KEY ("rectifies_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_session_unique" ON "invoices" USING btree ("stripe_session_id") WHERE "invoices"."series" = 'INV';--> statement-breakpoint
CREATE INDEX "invoices_case_id_idx" ON "invoices" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_at_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "cases_email_index_idx" ON "cases" USING btree ("email_index");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_ref_unique" UNIQUE("ref");--> statement-breakpoint
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_kind_check" CHECK ("case_documents"."kind" IN ('passport', 'acceptance-letter', 'lease', 'utility-bill', 'padron-authorization', 'authorizer-id', 'collective-authorization'));--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_locale_check" CHECK ("cases"."locale" IN ('en', 'es', 'ca', 'fr', 'it', 'de'));--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_ref_format" CHECK ("cases"."ref" ~ '^BCN-[0-9]{5}$');--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_purged_has_no_intake" CHECK ("cases"."purged_at" IS NULL OR ("cases"."intake_envelope" IS NULL AND "cases"."email_index" IS NULL));