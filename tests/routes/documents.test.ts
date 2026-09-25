import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  mockNextHeaders,
  setSessionSecrets,
  signOut,
  signInAsCase,
  formRequest,
  FIXTURES,
} from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { intake } from "../helpers/intake";

mockNextHeaders();
setSessionSecrets();

let POST: (r: Request) => Promise<Response>;
let createCase: typeof import("../../src/lib/server/storage").createCase;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
  ({ POST } = await import("../../src/app/api/documents/route"));
  ({ createCase } = await import("../../src/lib/server/storage"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, case_documents, appointments, cases CASCADE");
});

describe("POST /api/documents — the gate comes before the body", () => {
  it("rejects an unauthenticated upload without parsing its body", async () => {
    // formData() buffers the whole multipart payload, so an anonymous caller
    // must be turned away before it costs us that. Asserted directly: the
    // handler's own formData() is spied on and must never be called.
    //
    // (A throwing body stream cannot be used for this — undici drains a
    // Request's stream on its own, so it would measure undici, not the gate.)
    const request = formRequest("http://localhost/api/documents", {
      kind: "passport",
      file: FIXTURES.pdf(),
    });
    let parsed = false;
    const real = request.formData.bind(request);
    request.formData = () => {
      parsed = true;
      return real();
    };

    expect((await POST(request)).status).toBe(401);
    expect(parsed, "handler parsed the body before checking the session").toBe(false);
  });

  it("answers an anonymous caller with 401, not a complaint about the body", async () => {
    // Before the gate was moved, a body that failed to parse produced 400
    // ("Expected multipart form data") — proof the parse ran first. The
    // session verdict must not depend on the body at all.
    const res = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "not actually multipart",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts a PDF from a signed-in student", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "passport", file: FIXTURES.pdf() }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).kind).toBe("passport");
  });

  it("rejects an HTML file wearing a PDF content type", async () => {
    // The stored-XSS vector the magic-byte sniff exists for.
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "passport", file: FIXTURES.html() }),
    );
    expect(res.status).toBe(415);
  });

  it("rejects an unknown document kind", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "not-a-kind", file: FIXTURES.pdf() }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a request with no file at all", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(formRequest("http://localhost/api/documents", { kind: "passport" }));
    expect(res.status).toBe(400);
  });
});
