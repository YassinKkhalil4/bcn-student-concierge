ALTER TABLE "appointments" ADD COLUMN "office_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "office_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "nearest_metro" text;