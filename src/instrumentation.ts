/**
 * Runs once when the Next.js server process starts (not per request, and not
 * during `next build`). Starts migrations and the retention scheduler.
 */
export async function register(): Promise<void> {
  // This file is compiled for the Edge runtime too. Keep the import INSIDE this
  // condition: Next inlines NEXT_RUNTIME per build, so for Edge the block is
  // dead code and the Node-only modules (pg, fs) are never bundled. An early
  // `return` instead leaves the import reachable and breaks the Edge build.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundJobs } = await import("./lib/server/jobs");
    await startBackgroundJobs();
  }
}
