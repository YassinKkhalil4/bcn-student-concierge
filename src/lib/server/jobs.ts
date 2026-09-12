import { runMigrations, withAdvisoryLock } from "@/lib/db/client";
import { assertProductionConfig } from "@/lib/config";
import { missingTemplates, missingTemplatesMessage } from "@/lib/forms/templates";
import { runMaintenance } from "./maintenance";

/**
 * Background work for the long-running server process, started once from
 * src/instrumentation.ts.
 *
 *  - Migrations at boot (MIGRATE_ON_START, default on in production), under a
 *    blocking advisory lock, so a second instance waits and then finds nothing
 *    to do.
 *  - Retention + housekeeping every MAINTENANCE_INTERVAL_MINUTES (default 60),
 *    under a non-blocking lock, so with several instances exactly one runs.
 *
 * Running the purge in-process means it cannot be forgotten: there is no
 * separate cron to install, and it runs wherever the app runs. The privacy
 * notice promises deletion 30 days after completion; this is what keeps it.
 */

let started = false;

export async function startBackgroundJobs(): Promise<void> {
  if (started) return;
  started = true;
  const production = process.env.NODE_ENV === "production";

  // Fail fast and loudly, before serving a single request.
  if (production) assertProductionConfig();

  // Official PDFs are mounted, not shipped in the image. Say so at boot: the
  // alternative is finding out when a student presses Download on their form.
  const missing = await missingTemplates();
  if (missing.length) console.error(`[forms] ${missingTemplatesMessage(missing)}`);
  else console.info("[forms] official templates present");

  if ((process.env.MIGRATE_ON_START ?? (production ? "true" : "false")) === "true") {
    // Awaited: Next waits for register() before serving, so no request ever
    // runs against a schema older than the code.
    await runMigrations();
    console.info("[jobs] migrations up to date");
  }

  if ((process.env.MAINTENANCE_ENABLED ?? (production ? "true" : "false")) !== "true") return;

  const minutes = Number(process.env.MAINTENANCE_INTERVAL_MINUTES ?? "60");
  const interval = Math.max(5, Number.isFinite(minutes) ? minutes : 60) * 60_000;

  const tick = async () => {
    try {
      const ran = await withAdvisoryLock("bcn:maintenance", async () => {
        const r = await runMaintenance();
        // One line per run, even when nothing was due: a quiet log would be
        // indistinguishable from a job that never runs, and this job is what
        // keeps the privacy notice's 30-day promise.
        console.info(
          `[retention] run ok — purged ${r.purged.length}, failed ${r.failed.length}, ` +
            `open >180d ${r.stale.length}, rate-limit rows pruned ${r.rateLimitRowsPruned}`,
        );
        for (const id of r.stale) {
          console.warn(`[retention] case ${id.slice(0, 8)} open >180 days and never completed`);
        }
      });
      if (!ran) console.info("[retention] another instance is running maintenance; skipped");
    } catch (error) {
      console.error("[retention] maintenance run failed", error);
    }
  };

  // First run shortly after boot, then on the interval. unref() so the timers
  // never hold the process open during shutdown.
  setTimeout(() => void tick(), 30_000).unref();
  setInterval(() => void tick(), interval).unref();
  console.info(`[jobs] retention maintenance every ${interval / 60_000} min`);
}
