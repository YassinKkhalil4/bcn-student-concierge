CREATE TABLE "case_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"kind" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"blob_key" text NOT NULL,
	"wrapped_key" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"algorithm" text NOT NULL,
	"key_version" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_documents_blob_key_unique" UNIQUE("blob_key"),
	CONSTRAINT "case_documents_kind_check" CHECK ("case_documents"."kind" IN ('passport', 'acceptance-letter', 'lease'))
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"tier_id" text NOT NULL,
	"form_id" text NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"intake_envelope" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"service_completed_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "cases_stage_check" CHECK ("cases"."stage" IN ('new', 'in_progress', 'completed')),
	CONSTRAINT "cases_payment_status_check" CHECK ("cases"."payment_status" IN ('pending', 'paid', 'refunded')),
	CONSTRAINT "cases_form_id_check" CHECK ("cases"."form_id" IN ('EX-17', 'EX-18')),
	CONSTRAINT "cases_purged_has_no_intake" CHECK ("cases"."purged_at" IS NULL OR "cases"."intake_envelope" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_scope_key_window_start_pk" PRIMARY KEY("scope","key","window_start")
);
--> statement-breakpoint
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_documents_case_id_idx" ON "case_documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "cases_created_at_idx" ON "cases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cases_stage_idx" ON "cases" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "cases_payment_status_idx" ON "cases" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "cases_payment_intent_idx" ON "cases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "cases_retention_idx" ON "cases" USING btree ("service_completed_at") WHERE "cases"."purged_at" IS NULL;--> statement-breakpoint
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits" USING btree ("window_start");