import { listExpiredCaseIds, listStaleOpenCaseIds, purgeCase } from "./storage";
import { pruneRateLimits } from "@/lib/rate-limit";

/**
 * Retention and housekeeping — GDPR Art. 5(1)(e) storage limitation.
 *
 * Run hourly by the app process itself (src/instrumentation.ts) and on demand
 * by `npm run purge:expired`. Idempotent: purgeCase() writes its "purged"
 * marker last, so a run that dies part-way is finished by the next one.
 */

const DAY = 86_400_000;
const STALE_DAYS = 180;

export function retentionDays(): number {
  const days = Number(process.env.RETENTION_DAYS ?? "30");
  // A typo like RETENTION_DAYS=O must not produce a NaN cutoff that silently
  // matches nothing — or, worse, a negative one that matches everything.
  if (!Number.isFinite(days) || days < 1) {
    throw new Error(`Invalid RETENTION_DAYS: ${process.env.RETENTION_DAYS}`);
  }
  return days;
}

export interface RetentionReport {
  retentionDays: number;
  purged: string[];
  failed: string[];
  wouldPurge: string[];
  stale: string[];
  rateLimitRowsPruned: number;
}

export async function runMaintenance({ dryRun = false } = {}): Promise<RetentionReport> {
  const days = retentionDays();
  const expired = await listExpiredCaseIds(new Date(Date.now() - days * DAY));
  const report: RetentionReport = {
    retentionDays: days,
    purged: [],
    failed: [],
    wouldPurge: dryRun ? expired : [],
    stale: await listStaleOpenCaseIds(new Date(Date.now() - STALE_DAYS * DAY)),
    rateLimitRowsPruned: 0,
  };

  if (!dryRun) {
    for (const id of expired) {
      try {
        await purgeCase(id);
        report.purged.push(id);
      } catch (error) {
        // Keep going: one unreachable object must not shield every other case
        // from deletion. The failed case stays unmarked and is retried next run.
        report.failed.push(id);
        console.error(`[retention] purge failed for ${id.slice(0, 8)}`, error);
      }
    }
    report.rateLimitRowsPruned = await pruneRateLimits();
  }

  return report;
}
