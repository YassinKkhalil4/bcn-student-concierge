CREATE TABLE "guide_downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"source" text,
	"locale" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_downloads_source_check" CHECK ("guide_downloads"."source" IS NULL OR "guide_downloads"."source" IN ('esade', 'iese', 'eada', 'eubs', 'uic', 'harbourspace', 'ied', 'gbsb', 'geneva', 'esei', 'bts', 'other')),
	CONSTRAINT "guide_downloads_locale_check" CHECK ("guide_downloads"."locale" IS NULL OR "guide_downloads"."locale" IN ('en', 'es', 'ca', 'fr', 'it', 'de'))
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "guide_visitor_id" text;--> statement-breakpoint
ALTER TABLE "triage_enquiries" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "triage_enquiries" ADD COLUMN "guide_visitor_id" text;--> statement-breakpoint
CREATE INDEX "guide_downloads_visitor_idx" ON "guide_downloads" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "guide_downloads_downloaded_at_idx" ON "guide_downloads" USING btree ("downloaded_at");--> statement-breakpoint
CREATE INDEX "cases_guide_visitor_idx" ON "cases" USING btree ("guide_visitor_id");--> statement-breakpoint
CREATE INDEX "triage_guide_visitor_idx" ON "triage_enquiries" USING btree ("guide_visitor_id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_source_check" CHECK ("cases"."source" IS NULL OR "cases"."source" IN ('esade', 'iese', 'eada', 'eubs', 'uic', 'harbourspace', 'ied', 'gbsb', 'geneva', 'esei', 'bts', 'other'));--> statement-breakpoint
ALTER TABLE "triage_enquiries" ADD CONSTRAINT "triage_source_check" CHECK ("triage_enquiries"."source" IS NULL OR "triage_enquiries"."source" IN ('esade', 'iese', 'eada', 'eubs', 'uic', 'harbourspace', 'ied', 'gbsb', 'geneva', 'esei', 'bts', 'other'));