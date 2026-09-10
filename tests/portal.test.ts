import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import { intakeSchema } from "../src/lib/schema";
import {
  createLoginLinkToken,
  createPortalSession,
  verifyLoginLinkToken,
  verifyPortalSession,
  LOGIN_LINK_TTL_SECONDS,
  PORTAL_SESSION_TTL_SECONDS,
} from "../src/lib/portal/session";
import { consumeLoginLink, findCasesByEmail, markDocumentsSubmitted } from "../src/lib/server/portal";
import { createCase, getCase, purgeCase } from "../src/lib/server/storage";
import { appointments, cases } from "../src/lib/db/schema";
import { loginLinkEmail } from "../src/lib/email/templates";
import type { Db } from "../src/lib/db/client";
import { generateCaseRef } from "../src/lib/server/case-codec";
import { useTestDb } from "./helpers/db";

// Wrap the reference generator so one test can force a collision; every other
// test gets the real implementation.
vi.mock("../src/lib/server/case-codec", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/server/case-codec")>();
  return { ...actual, generateCaseRef: vi.fn(actual.generateCaseRef) };
});

let db: Db;
let client: PGlite;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  process.env.PORTAL_SESSION_SECRET = randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
});
beforeEach(async () => {
  await client.exec("TRUNCATE case_documents, appointments, cases CASCADE");
});

const raw = {
  tierId: "baseline",
  identity: {
    passportNumber: "ab1234567", firstSurname: "okonkwo", givenName: "chidi", gender: "H",
    birthDate: "14/03/2004", birthCity: "lagos", birthCountry: "nigeria", nationality: "nigerian",
  },
  family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
  address: { streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona", postalCode: "08036", province: "barcelona" },
  contact: { phone: "+34600111222", email: "Chidi@Example.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
};
const intake = intakeSchema.parse(raw);
const CASE = "abcdefghijklmnop_1234";

describe("portal tokens", () => {
  it("round-trips a session", async () => {
    expect(await verifyPortalSession(await createPortalSession(CASE))).toBe(CASE);
  });

  it("expires sessions after the TTL", async () => {
    const t = await createPortalSession(CASE, Date.now() - (PORTAL_SESSION_TTL_SECONDS + 5) * 1000);
    expect(await verifyPortalSession(t)).toBeNull();
  });

  it("rejects a session re-signed for another case", async () => {
    const [, exp, sig] = (await createPortalSession(CASE)).split(".");
    expect(await verifyPortalSession(`zzzzzzzzzzzzzzzz_9999.${exp}.${sig}`)).toBeNull();
  });

  it("never accepts a sign-in link as a session, or a session as a link", async () => {
    const link = await createLoginLinkToken(CASE);
    const session = await createPortalSession(CASE);
    expect(await verifyPortalSession(link)).toBeNull();
    expect(await verifyLoginLinkToken(session)).toBeNull();
    // Same parts, different purpose string in the signature: still refused.
    const [id, iat, exp, sig] = link.split(".");
    expect(await verifyPortalSession(`${id}.${exp}.${sig}`)).toBeNull();
    void iat;
  });

  it("expires links after 30 minutes and refuses stretched lifetimes", async () => {
    const old = await createLoginLinkToken(CASE, Date.now() - (LOGIN_LINK_TTL_SECONDS + 1) * 1000);
    expect(await verifyLoginLinkToken(old)).toBeNull();
    const [id, iat, , sig] = (await createLoginLinkToken(CASE)).split(".");
    expect(await verifyLoginLinkToken(`${id}.${iat}.${Date.now() + 86_400_000}.${sig}`)).toBeNull();
  });

  it("refuses everything when the secret is missing", async () => {
    const t = await createPortalSession(CASE);
    const saved = process.env.PORTAL_SESSION_SECRET;
    delete process.env.PORTAL_SESSION_SECRET;
    try {
      expect(await verifyPortalSession(t)).toBeNull();
      await expect(createPortalSession(CASE)).rejects.toThrow(/not configured/);
    } finally {
      process.env.PORTAL_SESSION_SECRET = saved;
    }
  });
});

describe("single-use sign-in links", () => {
  it("accepts a link once, then refuses it", async () => {
    const c = await createCase(intake);
    const issued = new Date(Date.now() - 1000);
    expect(await consumeLoginLink(c.id, issued)).toBe(true);
    expect(await consumeLoginLink(c.id, issued)).toBe(false);
  });

  it("lets exactly one of two simultaneous uses win", async () => {
    const c = await createCase(intake);
    const issued = new Date(Date.now() - 1000);
    const results = await Promise.all([consumeLoginLink(c.id, issued), consumeLoginLink(c.id, issued)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("kills every older link once any link is used", async () => {
    const c = await createCase(intake);
    const older = new Date(Date.now() - 60_000);
    const newer = new Date(Date.now() - 30_000);
    expect(await consumeLoginLink(c.id, newer)).toBe(true);
    expect(await consumeLoginLink(c.id, older)).toBe(false);
    // A link issued after that sign-in still works.
    expect(await consumeLoginLink(c.id, new Date(Date.now() + 1))).toBe(true);
  });

  it("refuses links for an erased case", async () => {
    const c = await createCase(intake);
    await purgeCase(c.id);
    expect(await consumeLoginLink(c.id, new Date())).toBe(false);
  });
});

describe("finding a file by email", () => {
  it("matches regardless of case and surrounding spaces", async () => {
    const c = await createCase(intake);
    expect((await findCasesByEmail("  CHIDI@example.COM ")).map((r) => r.id)).toEqual([c.id]);
    expect(await findCasesByEmail("someone@else.com")).toEqual([]);
  });

  it("stores no readable email address", async () => {
    await createCase(intake);
    const dump = JSON.stringify((await client.query("SELECT * FROM cases")).rows);
    expect(dump.toLowerCase()).not.toContain("chidi@example.com");
  });

  it("finds every open file under a shared address, none that are erased", async () => {
    const a = await createCase(intake);
    const b = await createCase(intake);
    await purgeCase(b.id);
    expect((await findCasesByEmail("chidi@example.com")).map((r) => r.id)).toEqual([a.id]);
  });
});

describe("case references and erasure", () => {
  it("issues BCN-##### references, unique per case", async () => {
    const refs = await Promise.all(Array.from({ length: 25 }, () => createCase(intake).then((c) => c.ref)));
    for (const r of refs) expect(r).toMatch(/^BCN-\d{5}$/);
    expect(new Set(refs).size).toBe(25);
  });

  it("retries when a random reference collides", async () => {
    const first = await createCase(intake);
    // First attempt reuses an existing reference; the retry must pick another.
    vi.mocked(generateCaseRef).mockReturnValueOnce(first.ref);
    const second = await createCase(intake);
    expect(second.ref).not.toBe(first.ref);
    expect(second.ref).toMatch(/^BCN-\d{5}$/);
  });

  it("gives up after repeated collisions rather than looping forever", async () => {
    const first = await createCase(intake);
    vi.mocked(generateCaseRef).mockReturnValue(first.ref);
    try {
      await expect(createCase(intake)).rejects.toThrow();
    } finally {
      vi.mocked(generateCaseRef).mockReset();
      const actual = await vi.importActual<typeof import("../src/lib/server/case-codec")>("../src/lib/server/case-codec");
      vi.mocked(generateCaseRef).mockImplementation(actual.generateCaseRef);
    }
  });

  it("clears the email index and appointments when erasing", async () => {
    const c = await createCase(intake);
    await db.insert(appointments).values({ id: "appt1", caseId: c.id, kind: "police", officeCode: "x", scheduledAt: new Date() });
    await purgeCase(c.id);
    const [row] = await db.select().from(cases).where(eq(cases.id, c.id));
    expect(row!.emailIndex).toBeNull();
    expect(await db.select().from(appointments).where(eq(appointments.caseId, c.id))).toHaveLength(0);
  });
});

describe("submit for review", () => {
  it("transitions once, so staff are notified once", async () => {
    const c = await createCase(intake);
    expect(await markDocumentsSubmitted(c.id)).toBe(true);
    expect(await markDocumentsSubmitted(c.id)).toBe(false);
    expect((await getCase(c.id))!.documentsSubmittedAt).toBeTruthy();
  });
});

describe("sign-in email", () => {
  it("contains the link and escapes what it interpolates", () => {
    const e = loginLinkEmail("a@b.com", [{ ref: "BCN-12345", url: "https://bcnstudent.com/portal/verify?token=x&y" }]);
    expect(e.text).toContain("https://bcnstudent.com/portal/verify?token=x&y");
    expect(e.html).toContain("token=x&amp;y");
    expect(e.html).not.toMatch(/<img|<script/i);
  });

  it("lists each file when an address has several", () => {
    const e = loginLinkEmail("a@b.com", [
      { ref: "BCN-11111", url: "https://x/1" },
      { ref: "BCN-22222", url: "https://x/2" },
    ]);
    expect(e.text).toContain("BCN-11111");
    expect(e.text).toContain("BCN-22222");
  });
});
