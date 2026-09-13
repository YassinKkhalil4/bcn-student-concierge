import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { __setDb, type Db } from "../src/lib/db/client";
import { useTestDb } from "./helpers/db";
import { addOneMonth, daysUntil, deadlineFor, triageSchema, HOUSING_SITUATIONS } from "../src/lib/triage";
import {
  createTriage,
  getTriage,
  listOpenTriage,
  purgeTriage,
  setTriageStatus,
  generateTriageRef,
} from "../src/lib/server/triage-store";
import { triageAlertText } from "../src/lib/notify/events";

let client: PGlite;
let db: Db;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
});

beforeEach(async () => {
  __setDb(db);
  await client.exec("TRUNCATE triage_enquiries CASCADE");
});

/** A submission that passes the schema, so each test varies only what it tests. */
const submission = (over: Record<string, unknown> = {}) =>
  triageSchema.parse({
    fullName: "Amara Okafor",
    email: "Amara@Example.com ",
    nationality: "ng",
    arrivedOn: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
    housing: "hostel-or-airbnb",
    notes: "",
    gdprTriageConsent: true,
    ...over,
  });

describe("the one-month window", () => {
  it("counts de fecha a fecha, same day of the following month", () => {
    expect(addOneMonth("2026-09-05")).toBe("2026-10-05");
    expect(addOneMonth("2026-12-15")).toBe("2027-01-15");
  });

  it("falls back to the last day when the following month is shorter", () => {
    // 31 January + 1 month is 28 February, not 3 March.
    expect(addOneMonth("2026-01-31")).toBe("2026-02-28");
    expect(addOneMonth("2024-01-31")).toBe("2024-02-29"); // leap year
    expect(addOneMonth("2026-03-31")).toBe("2026-04-30");
  });

  it("applies only to the non-EU route", () => {
    // Quoting an EU student a one-month deadline would invent urgency: their
    // registration duty starts at three months' residence.
    expect(deadlineFor("non-eu", "2026-09-05")).toBe("2026-10-05");
    expect(deadlineFor("eu", "2026-09-05")).toBeNull();
  });

  it("counts whole days, and goes negative once the window has closed", () => {
    const today = new Date("2026-09-12T00:00:00Z");
    expect(daysUntil("2026-09-12", today)).toBe(0);
    expect(daysUntil("2026-09-20", today)).toBe(8);
    expect(daysUntil("2026-09-01", today)).toBe(-11);
  });
});

describe("triage schema", () => {
  it("normalises the email and the nationality code", () => {
    const parsed = submission();
    expect(parsed.email).toBe("amara@example.com");
    expect(parsed.nationality).toBe("NG");
  });

  it("refuses an entry date in the future", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(triageSchema.safeParse({ ...submission(), arrivedOn: tomorrow }).success).toBe(false);
  });

  it("refuses an arrival more than a year ago — that is a legal conversation", () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    expect(triageSchema.safeParse({ ...submission(), arrivedOn: old }).success).toBe(false);
  });

  it("refuses a date that does not exist on the calendar", () => {
    expect(triageSchema.safeParse({ ...submission(), arrivedOn: "2026-02-31" }).success).toBe(false);
  });

  it("cannot be submitted without consent", () => {
    const { gdprTriageConsent: _drop, ...rest } = submission();
    expect(triageSchema.safeParse({ ...rest, gdprTriageConsent: false }).success).toBe(false);
  });

  it("accepts every housing situation the form offers, and nothing else", () => {
    for (const housing of HOUSING_SITUATIONS) {
      expect(triageSchema.safeParse({ ...submission(), housing }).success, housing).toBe(true);
    }
    expect(triageSchema.safeParse({ ...submission(), housing: "castle" }).success).toBe(false);
  });
});

describe("triage enquiries", () => {
  it("derives route, form and deadline from the submission — never from the browser", () => {
    // Nothing in the posted body names a route: it follows from nationality,
    // exactly as the EX-17 / EX-18 decision does.
    expect(Object.keys(submission())).not.toContain("route");
  });

  it("records a non-EU enquiry with its deadline", async () => {
    const record = await createTriage(submission({ nationality: "US", arrivedOn: "2026-09-05" }));
    expect(record.route).toBe("non-eu");
    expect(record.formId).toBe("EX-17");
    expect(record.deadlineOn).toBe("2026-10-05");
    expect(record.ref).toMatch(/^TRI-\d{5}$/);
    expect(record.status).toBe("new");
  });

  it("records an EU enquiry with no deadline", async () => {
    const record = await createTriage(submission({ nationality: "FR", arrivedOn: "2026-09-05" }));
    expect(record.route).toBe("eu");
    expect(record.formId).toBe("EX-18");
    expect(record.deadlineOn).toBeNull();
  });

  it("stores the enquirer's details encrypted, and returns them opened", async () => {
    const created = await createTriage(submission({ notes: "Landlord refuses to sign" }));
    // What reaches Postgres is an envelope, not a name, an email or a note.
    const dump = JSON.stringify((await client.query("SELECT * FROM triage_enquiries")).rows);
    for (const secret of ["Amara", "Okafor", "amara@example.com", "Landlord refuses"]) {
      expect(dump, secret).not.toContain(secret);
    }

    const read = await getTriage(created.id);
    expect(read!.details!.fullName).toBe("Amara Okafor");
    expect(read!.details!.email).toBe("amara@example.com");
    expect(read!.details!.notes).toBe("Landlord refuses to sign");
  });

  it("omits notes entirely when the student left them blank", async () => {
    const created = await createTriage(submission({ notes: "" }));
    expect((await getTriage(created.id))!.details!.notes).toBeUndefined();
  });

  it("rejects a malformed id rather than querying with it", async () => {
    expect(await getTriage("../../etc/passwd")).toBeNull();
    expect(await getTriage("short")).toBeNull();
  });

  it("queues the open enquiries by soonest deadline", async () => {
    await createTriage(submission({ nationality: "US", arrivedOn: "2026-09-01" })); // closes 10-01
    await createTriage(submission({ nationality: "IN", arrivedOn: "2026-08-20" })); // closes 09-20
    const queue = await listOpenTriage();
    expect(queue.map((q) => q.deadlineOn)).toEqual(["2026-09-20", "2026-10-01"]);
  });

  it("drops an answered enquiry out of the queue and timestamps it", async () => {
    const created = await createTriage(submission());
    await setTriageStatus(created.id, "answered");
    expect(await listOpenTriage()).toHaveLength(0);
    const read = await getTriage(created.id);
    expect(read!.status).toBe("answered");
    expect(read!.answeredAt).not.toBeNull();
  });

  it("erases personal data on purge but keeps the non-identifying record", async () => {
    const created = await createTriage(submission());
    await purgeTriage(created.id);
    const read = await getTriage(created.id);
    expect(read!.details).toBeNull();
    expect(read!.purgedAt).not.toBeNull();
    // The route and the dates are not personal data and are kept for counting.
    expect(read!.route).toBe("non-eu");
  });

  it("generates references in the documented shape", () => {
    for (let i = 0; i < 50; i++) expect(generateTriageRef()).toMatch(/^TRI-\d{5}$/);
  });
});

describe("the staff alert", () => {
  it("leads with the time left, which is what decides what staff do next", () => {
    expect(triageAlertText({ ref: "TRI-10001", route: "non-eu", daysLeft: 9, documents: 3 })).toContain("9d left");
  });

  it("flags a closed window rather than printing a negative number", () => {
    const text = triageAlertText({ ref: "TRI-10002", route: "non-eu", daysLeft: -4, documents: 1 });
    expect(text).toContain("window closed 4d ago");
    expect(text).not.toContain("-4");
  });

  it("says plainly that an EU enquiry has no clock", () => {
    expect(triageAlertText({ ref: "TRI-10003", route: "eu", daysLeft: null, documents: 0 })).toContain("no one-month clock");
  });

  it("carries the reference and no personal data", () => {
    const text = triageAlertText({ ref: "TRI-10004", route: "eu", daysLeft: null, documents: 2 });
    expect(text).toContain("TRI-10004");
    expect(text).toMatch(/^[^@]*$/); // no email address ever reaches Telegram
  });
});
