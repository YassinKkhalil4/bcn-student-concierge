-- The PaymentIntent behind an invoice, so a refund can be matched to the
-- invoice for the payment actually refunded rather than to the case's oldest
-- invoice. A case can hold more than one: a full refund leaves the case no
-- longer "paid", so it can legitimately be paid again.
--
-- Nullable: rows issued before this migration have no value, and the
-- rectification path falls back to the previous behaviour for them — which is
-- correct whenever a case has only one invoice, as every existing one does.
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_intent_id" text;
--> statement-breakpoint
CREATE INDEX "invoices_payment_intent_idx" ON "invoices" ("stripe_payment_intent_id") WHERE "stripe_payment_intent_id" IS NOT NULL;
