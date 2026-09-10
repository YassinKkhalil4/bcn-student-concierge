import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { __setDb, MIGRATIONS_DIR, schema, type Db } from "../../src/lib/db/client";

/**
 * A fresh in-memory Postgres per call, with the real migrations applied.
 *
 * Real Postgres rather than a mock, so CHECK constraints, the FK cascade and the
 * partial retention index are exercised exactly as in production.
 */
export async function useTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  __setDb(db as unknown as Db);
  return { db: db as unknown as Db, client };
}
