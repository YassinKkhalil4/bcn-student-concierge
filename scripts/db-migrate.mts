/**
 * Apply pending migrations to DATABASE_URL by hand.
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 *
 * The Docker deployment does this automatically at startup (MIGRATE_ON_START),
 * under an advisory lock, so this script is for non-Docker setups and for
 * applying a migration before a deploy.
 */
import { runMigrations, closeDb } from "../src/lib/db/client.ts";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
await runMigrations();
await closeDb();
console.log("Migrations applied.");
