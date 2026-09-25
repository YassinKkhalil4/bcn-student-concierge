import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { mockNextHeaders, setSessionSecrets, signOut, formRequest, FIXTURES } from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { intake } from "../helpers/intake";

mockNextHeaders();
setSessionSecrets();

let postIntake: (r: Request) => Promise<Response>;
let postTriage: (r: Request) => Promise<Response>;
let PORTAL_COOKIE: string;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY ??= randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
  ({ POST: postIntake } = await import("../../src/app/api/intake/route"));
  ({ POST: postTriage } = await import("../../src/app/api/triage/route"));
  ({ PORTAL_COOKIE } = await import("../../src/lib/portal/session"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec(
    "TRUNCATE rate_limits, triage_documents, triage_enquiries, case_documents, appointments, cases CASCADE",
  );
});

const json = (body: unknown) =>
  new Request("http://localhost/api/intake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/intake", () => {
  it("opens a case and signs the student in", async () => {
    const res = await postIntake(json({ ...intake, locale: "es" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ref).toMatch(/^BCN-\d{5}$/);
    // The case id is a credential and stays in the cookie, never the body.
    expect(body.id).toBeUndefined();
    expect(res.headers.get("set-cookie")).toContain(PORTAL_COOKIE);
  });

  it("echoes back none of the personal data it was sent", async () => {
    // A reflected payload is a needless disclosure channel if the response is
    // ever logged by an intermediary.
    const res = await postIntake(json(intake));
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain(intake.contact.email);
    expect(raw).not.toContain(intake.identity.passportNumber.toUpperCase());
    expect(raw.toLowerCase()).not.toContain("okonkwo");
  });

  it("answers a malformed body with 400, not a crash", async () => {
    expect((await postIntake(json("{not json"))).status).toBe(400);
  });

  it("reports field paths on a validation failure", async () => {
    const broken = { ...intake, contact: { ...intake.contact, email: "not-an-email" } };
    const res = await postIntake(json(broken));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues.map((i: { path: string }) => i.path)).toContain("contact.email");
  });

  it("derives the form from nationality, whatever the body claims", async () => {
    // formId is never taken from the browser: it decides the price and the
    // government form, so a client-chosen value would be a discount.
    const { getCase } = await import("../../src/lib/server/storage");
    const res = await postIntake(json({ ...intake, formId: "EX-18", tierId: intake.tierId }));
    expect(res.status).toBe(201);
    const { rows } = await client.query<{ id: string; form_id: string }>("SELECT id, form_id FROM cases");
    // Nigerian nationality is the non-EU route.
    expect(rows[0]!.form_id).toBe("EX-17");
    expect((await getCase(rows[0]!.id))!.formId).toBe("EX-17");
  });

  it("falls back to English for an unknown locale", async () => {
    await postIntake(json({ ...intake, locale: "klingon" }));
    const { rows } = await client.query<{ locale: string }>("SELECT locale FROM cases");
    expect(rows[0]!.locale).toBe("en");
  });
});

const triageFields = {
  fullName: "Chidi Okonkwo",
  email: "chidi@example.com",
  nationality: "NG",
  // Relative, so the one-month window stays open however long this test lives.
  arrivedOn: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
  housing: "hostel-or-airbnb",
  notes: "",
  gdprTriageConsent: "true",
};

describe("POST /api/triage", () => {
  it("records an enquiry with no attachments at all", async () => {
    const res = await postTriage(formRequest("http://localhost/api/triage", triageFields));
    expect(res.status).toBe(201);
    expect((await res.json()).ref).toMatch(/^TRI-\d{5}$/);
  });

  it("returns only the reference, never the deadline it computed", async () => {
    // The student gets the answer in a reply a person writes, not from a
    // number a form guessed.
    const res = await postTriage(formRequest("http://localhost/api/triage", triageFields));
    expect(Object.keys(await res.json())).toEqual(["ref"]);
  });

  it("rejects a disguised file and records no enquiry at all", async () => {
    // A rejected scan must not leave an enquiry in the staff queue that the
    // student believes failed.
    const res = await postTriage(
      formRequest("http://localhost/api/triage", { ...triageFields, "entry-stamp": FIXTURES.html() }),
    );
    expect(res.status).toBe(415);
    expect((await res.json()).path).toBe("entry-stamp");
    const { rows } = await client.query("SELECT id FROM triage_enquiries");
    expect(rows, "an enquiry was created despite the rejected file").toHaveLength(0);
  });

  it("refuses to proceed without consent", async () => {
    const res = await postTriage(
      formRequest("http://localhost/api/triage", { ...triageFields, gdprTriageConsent: "false" }),
    );
    expect(res.status).toBe(422);
  });

  it("stores an accepted attachment against the enquiry", async () => {
    const res = await postTriage(
      formRequest("http://localhost/api/triage", { ...triageFields, "entry-stamp": FIXTURES.pdf() }),
    );
    expect(res.status).toBe(201);
    const { rows } = await client.query("SELECT kind FROM triage_documents");
    expect(rows).toHaveLength(1);
  });
});
