-- Invoices are immutable once issued (Spanish invoicing rules, RD 1619/2012):
-- a mistake or a refund is corrected by issuing a factura rectificativa, never
-- by editing or deleting the original. Enforced here, in the database, so no
-- code path, admin tool or ad-hoc SQL session can quietly rewrite one.
--
-- TRUNCATE is deliberately not blocked: it needs table-owner rights, i.e. the
-- database administrator, and test suites use it to reset between runs.
CREATE OR REPLACE FUNCTION invoices_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'invoice % is immutable: issue a factura rectificativa instead', OLD.number
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER invoices_immutable
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_reject_change();
