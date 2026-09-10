/**
 * Lifecycle data deletion — GDPR Art. 5(1)(e) storage limitation.
 *
 * Permanently purges passport scans and identity data 30 days after service
 * completion. Run daily from cron / a scheduled function:
 *
 *   0 3 * * *  cd /srv/bcn && npm run purge:expired >> /var/log/bcn-purge.log
 *
 * Idempotent: already-purged cases are skipped, so a retry is always safe.
 * Pass --dry-run to see what would be deleted without deleting it.
 */
import { listCases, purgeCase } from "../src/lib/server/storage.ts";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? "30");
const dryRun = process.argv.includes("--dry-run");

const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

const cases = await listCases();
let purged = 0;
let skipped = 0;

for (const record of cases) {
  if (record.purgedAt) {
    skipped += 1;
    continue;
  }
  // Cases with no completion date are still active engagements; the clock has
  // not started. They are reported so an abandoned case cannot linger unseen.
  if (!record.serviceCompletedAt) {
    const ageDays = Math.floor(
      (Date.now() - Date.parse(record.createdAt)) / 86_400_000,
    );
    if (ageDays > 180) {
      console.warn(
        `[review] case ${record.id} created ${ageDays}d ago and never completed`,
      );
    }
    skipped += 1;
    continue;
  }

  if (Date.parse(record.serviceCompletedAt) > cutoff) {
    skipped += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] would purge ${record.id} (${record.documents.length} docs)`);
  } else {
    await purgeCase(record.id);
    console.log(`[purged] ${record.id}`);
  }
  purged += 1;
}

console.log(
  `\nRetention ${RETENTION_DAYS}d — ${purged} purged, ${skipped} skipped, ` +
    `${cases.length} total.${dryRun ? " (dry run, nothing deleted)" : ""}`,
);
