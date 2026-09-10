import { intakeSchema } from "./src/lib/schema.ts";
import { createCase, getCase, attachDocument, setStage, purgeCase, listCases } from "./src/lib/server/storage.ts";
import { rateLimit } from "./src/lib/rate-limit.ts";
import { withAdvisoryLock, closeDb } from "./src/lib/db/client.ts";
import { runMaintenance } from "./src/lib/server/maintenance.ts";

const intake = intakeSchema.parse({
  tierId: "baseline",
  identity: { passportNumber: "ab1234567", nie: "X1234567L", firstSurname: "garcía", givenName: "chidi", gender: "H", birthDate: "14/03/2004", birthCity: "lagos", birthCountry: "nigeria", nationality: "nigerian" },
  family: { maritalStatus: "S", fatherFirstName: "a", motherFirstName: "b" },
  address: { streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona", postalCode: "08036", province: "barcelona" },
  contact: { phone: "+34600111222", email: "chidi@example.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
});
const ok = (label: string, cond: boolean) => { console.log(`${cond ? "✓" : "✗"} ${label}`); if (!cond) process.exitCode = 1; };

const c = await createCase(intake);
ok("create + read back through node-postgres", JSON.stringify((await getCase(c.id))!.intake) === JSON.stringify(intake));
await Promise.all(["passport", "acceptance-letter", "lease"].map((k) =>
  attachDocument(c.id, k as never, "x.pdf", "application/pdf", Buffer.from("%PDF-1.4 x"))));
ok("3 concurrent uploads all recorded (pool, not one connection)", (await getCase(c.id))!.documents.length === 3);
ok("accent-insensitive search", (await listCases({ query: "garcia" })).some((r) => r.id === c.id));

const hits = [];
for (let i = 0; i < 6; i++) hits.push((await rateLimit("203.0.113.5", "intake")).allowed);
ok("limiter: 5 allowed then denied", JSON.stringify(hits) === JSON.stringify([true, true, true, true, true, false]));
const burst = await Promise.all(Array.from({ length: 20 }, () => rateLimit("203.0.113.6", "intake")));
ok(`limiter: 20 concurrent requests -> exactly 5 allowed (got ${burst.filter((r) => r.allowed).length})`, burst.filter((r) => r.allowed).length === 5);

// Two contenders for the maintenance lock at once: exactly one may run.
let running = 0, maxRunning = 0;
const contend = () => withAdvisoryLock("bcn:maintenance", async () => {
  running++; maxRunning = Math.max(maxRunning, running);
  await new Promise((r) => setTimeout(r, 300)); running--;
});
const ran = await Promise.all([contend(), contend(), contend()]);
ok(`advisory lock: one of three ran (${ran.filter(Boolean).length}), never concurrently (max ${maxRunning})`, ran.filter(Boolean).length === 1 && maxRunning === 1);

await setStage(c.id, "completed");
const { getDb } = await import("./src/lib/db/client.ts");
const { cases } = await import("./src/lib/db/schema.ts");
const { eq } = await import("drizzle-orm");
await (await getDb()).update(cases).set({ serviceCompletedAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(cases.id, c.id));
const report = await runMaintenance();
ok("maintenance purged the expired case", report.purged.includes(c.id));
ok("purged case holds no intake", (await getCase(c.id))!.intake === null);
await purgeCase(c.id);
ok("purge idempotent", true);
await closeDb();
