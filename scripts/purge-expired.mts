/**
 * Run retention by hand. The server already does this hourly (src/lib/server/
 * jobs.ts); use this to preview or to force a run.
 *
 *   npm run purge:expired -- --dry-run     list what would be deleted
 *   npm run purge:expired                  delete it now
 */
import { runMaintenance } from "../src/lib/server/maintenance.ts";
import { closeDb, withAdvisoryLock } from "../src/lib/db/client.ts";

const dryRun = process.argv.includes("--dry-run");
let failed = 0;

const ran = await withAdvisoryLock("bcn:maintenance", async () => {
  const r = await runMaintenance({ dryRun });
  for (const id of r.wouldPurge) console.log(`[dry-run] would purge ${id}`);
  for (const id of r.purged) console.log(`[purged] ${id}`);
  for (const id of r.failed) console.error(`[failed] ${id}`);
  for (const id of r.stale) console.warn(`[review] ${id} open >180 days, never completed`);
  failed = r.failed.length;
  console.log(
    `\nRetention ${r.retentionDays}d — ` +
      (dryRun ? `would purge ${r.wouldPurge.length} (dry run)` : `purged ${r.purged.length}, failed ${failed}`),
  );
});

if (!ran) console.log("Another process is running maintenance right now; nothing done.");
await closeDb();
process.exit(failed > 0 ? 1 : 0);
