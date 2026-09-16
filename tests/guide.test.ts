import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { __setDb, type Db } from "../src/lib/db/client";
import { useTestDb } from "./helpers/db";
import {
  GUIDE_SOURCES,
  GUIDE_VISITOR_COOKIE,
  SOURCE_COOKIE,
  attributionFromRequest,
  parseSource,
} from "../src/lib/attribution";
import { GUIDE_FILENAME, GUIDE_PATH } from "../src/lib/guide";
import { PROVIDER } from "../src/lib/provider";
import { guideConversionBySource, recordGuideDownload } from "../src/lib/server/guide-analytics";
import { createTriage } from "../src/lib/server/triage-store";
import { createCase } from "../src/lib/server/storage";
import { triageSchema } from "../src/lib/triage";
import { intakeSchema } from "../src/lib/schema";
import { GET as download, HEAD as downloadHead } from "../src/app/downloads/landing-in-barcelona.pdf/route";

let client: PGlite;
let db: Db;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
});

beforeEach(async () => {
  __setDb(db);
  await client.exec("TRUNCATE guide_downloads, triage_enquiries, cases CASCADE");
});

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15";
const visitor = (n: number) => `visitor-${String(n).padStart(12, "0")}`;

const triage = () =>
  triageSchema.parse({
    fullName: "Amara Okafor",
    email: "amara@example.com",
    nationality: "NG",
    arrivedOn: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
    housing: "hostel-or-airbnb",
    notes: "",
    gdprTriageConsent: true,
  });

const intake = () =>
  intakeSchema.parse({
    tierId: "soft-landing",
    identity: {
      passportNumber: "ab1234567", firstSurname: "okonkwo", givenName: "chidi",
      gender: "H", birthDate: "14/03/2004", birthCity: "lagos",
      birthCountry: "NG", nationality: "NG",
    },
    family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
    address: {
      streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona",
      postalCode: "08036", province: "barcelona",
    },
    contact: { phone: "+34600111222", email: "chidi@example.com" },
    consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
  });

describe("source parameter", () => {
  it("accepts exactly the supported schools, case-insensitively", () => {
    expect([...GUIDE_SOURCES]).toEqual([
      "esade", "iese", "eada", "eubs", "uic", "harbourspace", "ied", "gbsb", "geneva", "esei", "bts", "other",
    ]);
    expect(parseSource("ESADE")).toBe("esade");
    expect(parseSource(" iese ")).toBe("iese");
  });

  it("drops anything else rather than guessing a bucket", () => {
    expect(parseSource("esade2")).toBeNull();
    expect(parseSource("")).toBeNull();
    expect(parseSource(undefined)).toBeNull();
    expect(parseSource("<script>")).toBeNull();
  });

  it("reads source and download id from the request's cookies, validating both", () => {
    const req = (cookie: string) => new Request("https://x.test/api/triage", { headers: { cookie } });
    expect(attributionFromRequest(req(`a=1; ${SOURCE_COOKIE}=eada; ${GUIDE_VISITOR_COOKIE}=${visitor(1)}`))).toEqual({
      source: "eada",
      guideVisitorId: visitor(1),
    });
    expect(attributionFromRequest(req(`${SOURCE_COOKIE}=nope; ${GUIDE_VISITOR_COOKIE}=short`))).toEqual({
      source: null,
      guideVisitorId: null,
    });
    expect(attributionFromRequest(new Request("https://x.test/"))).toEqual({ source: null, guideVisitorId: null });
  });
});

describe("the download", () => {
  const get = (query = "", headers: Record<string, string> = {}) =>
    download(new NextRequest(`https://bcnstudent.com${GUIDE_PATH}${query}`, { headers: { "user-agent": BROWSER, ...headers } }));

  it("lives at a stable, unversioned path and saves under the edition's filename", async () => {
    expect(GUIDE_PATH).toBe("/downloads/landing-in-barcelona.pdf");
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${GUIDE_FILENAME}"`);
    expect(GUIDE_FILENAME).toBe("Landing-in-Barcelona-2026.pdf");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBe(statSync("assets/guide/landing-in-barcelona.pdf").size);
  });

  it("is ungated: no cookie, header or parameter is needed to get the file", async () => {
    const res = await download(new NextRequest(`https://bcnstudent.com${GUIDE_PATH}`));
    expect(res.status).toBe(200);
  });

  it("records the download with its source, and hands out an anonymous download id", async () => {
    const res = await get("?s=esade&l=es");
    const id = res.cookies.get(GUIDE_VISITOR_COOKIE)?.value;
    expect(id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(res.cookies.get(SOURCE_COOKIE)?.value).toBe("esade");
    expect(res.cookies.get(GUIDE_VISITOR_COOKIE)?.maxAge).toBe(30 * 24 * 60 * 60);

    const { rows } = await client.query<{ visitor_id: string; source: string; locale: string }>(
      "SELECT visitor_id, source, locale FROM guide_downloads",
    );
    expect(rows).toEqual([{ visitor_id: id, source: "esade", locale: "es" }]);
  });

  it("keeps the download id a browser already has, and its remembered source", async () => {
    await get("", { cookie: `${GUIDE_VISITOR_COOKIE}=${visitor(7)}; ${SOURCE_COOKIE}=iese` });
    const { rows } = await client.query("SELECT visitor_id, source FROM guide_downloads");
    expect(rows).toEqual([{ visitor_id: visitor(7), source: "iese" }]);
  });

  it("does not count crawlers, link previews or prefetches — but still serves them", async () => {
    expect((await get("", { "user-agent": "WhatsApp/2.23" })).status).toBe(200);
    expect((await get("", { "user-agent": "Googlebot/2.1" })).status).toBe(200);
    expect((await get("", { "sec-purpose": "prefetch" })).status).toBe(200);
    const { rows } = await client.query("SELECT 1 FROM guide_downloads");
    expect(rows).toHaveLength(0);
  });

  it("answers HEAD without recording a download", async () => {
    const res = await downloadHead();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(GUIDE_FILENAME);
    const { rows } = await client.query("SELECT 1 FROM guide_downloads");
    expect(rows).toHaveLength(0);
  });
});

describe("download → triage conversion, per source", () => {
  it("counts distinct downloaders per school and how many of them asked for triage", async () => {
    // Esade: two browsers, one downloads twice; one of them sends triage and pays.
    await recordGuideDownload({ visitorId: visitor(1), source: "esade", locale: "en" });
    await recordGuideDownload({ visitorId: visitor(1), source: null, locale: "en" });
    await recordGuideDownload({ visitorId: visitor(2), source: "esade", locale: "es" });
    // IESE: one browser, no triage.
    await recordGuideDownload({ visitorId: visitor(3), source: "iese", locale: "en" });
    // No school link at all.
    await recordGuideDownload({ visitorId: visitor(4), source: null, locale: null });

    await createTriage(triage(), { attribution: { source: "esade", guideVisitorId: visitor(1) } });
    // Came through the Esade link but never downloaded: not a guide conversion.
    await createTriage(triage(), { attribution: { source: "esade", guideVisitorId: null } });
    const paid = await createCase(intake(), { attribution: { source: "esade", guideVisitorId: visitor(1) } });
    await client.query("UPDATE cases SET payment_status = 'paid' WHERE id = $1", [paid.id]);

    const rows = await guideConversionBySource();
    expect(rows).toEqual([
      { source: "esade", downloads: 3, downloaders: 2, triaged: 1, intakes: 1, paid: 1, triageRate: 0.5 },
      { source: "iese", downloads: 1, downloaders: 1, triaged: 0, intakes: 0, paid: 0, triageRate: 0 },
      { source: null, downloads: 1, downloaders: 1, triaged: 0, intakes: 0, paid: 0, triageRate: 0 },
    ]);
  });

  it("stores the source on the enquiry and the case, and rejects an unknown one at the database", async () => {
    const t = await createTriage(triage(), { attribution: { source: "bts", guideVisitorId: visitor(9) } });
    const { rows } = await client.query("SELECT source, guide_visitor_id FROM triage_enquiries WHERE id = $1", [t.id]);
    expect(rows).toEqual([{ source: "bts", guide_visitor_id: visitor(9) }]);
    await expect(client.query("UPDATE triage_enquiries SET source = 'harvard'")).rejects.toThrow(/triage_source_check/);
  });
});

describe("/guide page invariants", () => {
  const page = readFileSync("src/app/[locale]/guide/page.tsx", "utf8");

  it("puts the download above the single triage link, never the reverse", () => {
    const downloadAt = page.indexOf("href={downloadHref}");
    const triageAt = page.indexOf('pathname: "/triage"');
    expect(downloadAt).toBeGreaterThan(0);
    expect(triageAt).toBeGreaterThan(downloadAt);
    expect(page.match(/pathname: "\/triage"/g)).toHaveLength(1);
  });

  it("has no gate: no form, input, dialog or email capture before the file", () => {
    expect(page).not.toMatch(/<form|<input|<dialog|type="email"|newsletter/i);
  });
});

describe("provider identification", () => {
  it("holds real values or nothing — never a placeholder", () => {
    for (const [field, value] of Object.entries(PROVIDER)) {
      expect(value, field).not.toMatch(/todo|tbd|xxx|lorem|example|placeholder|B?0{6,}/i);
    }
  });
});
