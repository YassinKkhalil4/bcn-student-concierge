import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Database-backed suites migrate a fresh PGlite in beforeAll; under a full
  // parallel run that can take longer than the 10 s default.
  //
  // testTimeout is raised for the same reason. The appointment-sheet suite
  // renders twelve real PDFs (six languages x two routes) and takes 4-8 s
  // depending on machine load, so against the 5 s default it passed alone and
  // failed about half the time in a full parallel run. The assertions are
  // unchanged — this only stops a slow machine being reported as a layout bug.
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
