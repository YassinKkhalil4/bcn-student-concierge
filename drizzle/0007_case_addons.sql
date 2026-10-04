-- Optional extras ticked at checkout (T-Jove, Carnet Jove, ISIC, eSIM), kept on
-- the case so staff know what to fulfil. Ids only: prices come from the server
-- table in src/lib/pricing.ts, and what was actually charged lives on the
-- invoice. Every case that predates add-ons has none.
ALTER TABLE "cases" ADD COLUMN "addon_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
