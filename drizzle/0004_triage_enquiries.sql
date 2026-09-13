CREATE TABLE "triage_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"triage_id" text NOT NULL,
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
	CONSTRAINT "triage_documents_blob_key_unique" UNIQUE("blob_key"),
	CONSTRAINT "triage_documents_kind_unique" UNIQUE("triage_id","kind"),
	CONSTRAINT "triage_documents_kind_check" CHECK ("triage_documents"."kind" IN ('entry-stamp', 'authorisation', 'enrolment-letter'))
);
--> statement-breakpoint
CREATE TABLE "triage_enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"email_index" text,
	"route" text NOT NULL,
	"form_id" text NOT NULL,
	"arrived_on" text NOT NULL,
	"deadline_on" text,
	"status" text DEFAULT 'new' NOT NULL,
	"enquiry_envelope" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "triage_enquiries_ref_unique" UNIQUE("ref"),
	CONSTRAINT "triage_status_check" CHECK ("triage_enquiries"."status" IN ('new', 'answered', 'declined')),
	CONSTRAINT "triage_route_check" CHECK ("triage_enquiries"."route" IN ('eu', 'non-eu')),
	CONSTRAINT "triage_form_id_check" CHECK ("triage_enquiries"."form_id" IN ('EX-17', 'EX-18')),
	CONSTRAINT "triage_locale_check" CHECK ("triage_enquiries"."locale" IN ('en', 'es', 'ca', 'fr', 'it', 'de')),
	CONSTRAINT "triage_ref_format" CHECK ("triage_enquiries"."ref" ~ '^TRI-[0-9]{5}$'),
	CONSTRAINT "triage_arrived_on_format" CHECK ("triage_enquiries"."arrived_on" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "triage_deadline_on_format" CHECK ("triage_enquiries"."deadline_on" IS NULL OR "triage_enquiries"."deadline_on" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "triage_purged_has_no_data" CHECK ("triage_enquiries"."purged_at" IS NULL OR ("triage_enquiries"."enquiry_envelope" IS NULL AND "triage_enquiries"."email_index" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "triage_documents" ADD CONSTRAINT "triage_documents_triage_id_triage_enquiries_id_fk" FOREIGN KEY ("triage_id") REFERENCES "public"."triage_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "triage_documents_triage_id_idx" ON "triage_documents" USING btree ("triage_id");--> statement-breakpoint
CREATE INDEX "triage_created_at_idx" ON "triage_enquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "triage_status_idx" ON "triage_enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "triage_email_index_idx" ON "triage_enquiries" USING btree ("email_index");--> statement-breakpoint
CREATE INDEX "triage_deadline_idx" ON "triage_enquiries" USING btree ("deadline_on") WHERE "triage_enquiries"."status" = 'new';