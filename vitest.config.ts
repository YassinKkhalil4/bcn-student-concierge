import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Database-backed suites migrate a fresh PGlite in beforeAll; under a full
  // parallel run that can take longer than the 10 s default.
  test: { environment: "node", include: ["tests/**/*.test.ts"], hookTimeout: 30_000 },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
