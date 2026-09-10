import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only needed for `drizzle-kit studio` / introspection. `generate` is offline.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
