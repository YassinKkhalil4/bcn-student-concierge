import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Database access for a long-running server (VPS / Docker).
 *
 * Production: node-postgres with a small connection pool. The app is one
 * persistent Node process, so a pool is the right shape — connections are opened
 * once and reused, rather than per request.
 *
 * Local development without DATABASE_URL: an embedded, file-backed Postgres
 * (PGlite) under DATA_DIR, migrated on first use. It is real Postgres, so the
 * same SQL, constraints and migrations run locally as in production.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | null = null;
let pool: Pool | null = null;
let pending: Promise<Db> | null = null;

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    pool = new Pool({
      connectionString: url,
      // A boutique workload needs few connections; leaving headroom under
      // Postgres' default max_connections (100) for psql, backups and a second
      // instance during a rolling restart.
      max: Number(process.env.DATABASE_POOL_MAX ?? "10"),
      idleTimeoutMillis: 30_000,
      // Fail a request fast rather than queueing forever if Postgres is down.
      connectionTimeoutMillis: 5_000,
    });
    // An idle client erroring (e.g. Postgres restarted) must not crash the
    // process; the pool discards it and opens a fresh one on next use.
    pool.on("error", (error) => console.error("[db] idle client error", error.message));
    return drizzlePg(pool, { schema }) as unknown as Db;
  }

  // A missing DATABASE_URL in production is a hard error, never a fallback to
  // an embedded database: data would live inside the container, outside the
  // Postgres backups, and vanish with it.
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. See docs/DEPLOY.md.");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), ".data"), "pglite");
  // PGlite does not create missing parents; without this a fresh clone's
  // first request fails with ENOENT.
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const local = drizzle(new PGlite(dir), { schema });
  await migrate(local, { migrationsFolder: MIGRATIONS_DIR });
  return local as unknown as Db;
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  // Memoise the promise, not just the result, so concurrent first requests
  // share one pool instead of racing to open several.
  pending ??= connect().then((d) => (db = d));
  try {
    return await pending;
  } catch (error) {
    pending = null; // allow a retry after a transient failure
    throw error;
  }
}

/**
 * Run `fn` only if no other process holds the named lock; returns false when
 * skipped.
 *
 * Uses a Postgres session-level advisory lock on ONE dedicated connection. That
 * matters: an advisory lock belongs to a connection, so taking it through the
 * pool and releasing it through another pooled connection would leak it.
 *
 * With `wait`, blocks until the lock is free (used for migrations, where the
 * second instance should wait and then find nothing to do). Without it, skips
 * (used for the periodic maintenance job, where one run is enough).
 *
 * The embedded dev database has no second process to contend with, but calls
 * within this process still can, so it falls back to an in-process mutex with
 * the same semantics.
 */
const localLocks = new Map<string, Promise<void>>();

export async function withAdvisoryLock(
  name: string,
  fn: () => Promise<void>,
  { wait = false }: { wait?: boolean } = {},
): Promise<boolean> {
  await getDb();
  if (!pool) {
    const held = localLocks.get(name);
    if (held && !wait) return false;
    if (held) await held.catch(() => {});
    const run = fn();
    localLocks.set(name, run);
    try {
      await run;
      return true;
    } finally {
      if (localLocks.get(name) === run) localLocks.delete(name);
    }
  }
  const client = await pool.connect();
  try {
    if (wait) {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [name]);
    } else {
      const { rows } = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
        [name],
      );
      if (!rows[0]?.locked) return false;
    }
    try {
      await fn();
      return true;
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [name]);
    }
  } finally {
    client.release();
  }
}

/** Apply pending migrations. Safe to call from several instances at once. */
export async function runMigrations(): Promise<void> {
  const database = await getDb();
  if (!pool) return; // the embedded database migrates itself in connect()
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  await withAdvisoryLock(
    "bcn:migrations",
    () => migrate(database as never, { migrationsFolder: MIGRATIONS_DIR }),
    { wait: true },
  );
}

/** For graceful shutdown and test teardown. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
  pending = null;
}

/** Test seam: inject an in-memory database. */
export function __setDb(next: Db | null): void {
  db = next;
  pool = null;
  pending = null;
}

export { schema };
