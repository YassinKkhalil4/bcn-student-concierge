import { NextResponse } from "next/server";
import { attributionFromRequest } from "@/lib/attribution";
import { enforceRateLimit } from "@/lib/rate-limit";
import { LOCALES, TRIAGE_DOCUMENT_KINDS, type Locale, type TriageDocumentKind } from "@/lib/db/schema";
import { triageSchema, daysUntil } from "@/lib/triage";
import { attachTriageDocument, createTriage } from "@/lib/server/triage-store";
import { notifyTriageReceived } from "@/lib/notify/events";
import { validateUpload, sanitizeFilename, MAX_UPLOAD_BYTES } from "@/lib/server/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set<string>(TRIAGE_DOCUMENT_KINDS);

/**
 * Free triage. Unauthenticated by design — the whole point is that someone can
 * find out where they stand without an account, a payment or an obligation.
 *
 * Fields and the three documents arrive together as one multipart request.
 * A single endpoint (rather than "create, then upload against a session")
 * means there is no half-made enquiry to clean up and no short-lived upload
 * credential to issue for an anonymous visitor.
 *
 * The answer is NOT computed here. The deadline is arithmetic; whether a case
 * is still recoverable is a judgement a person makes after reading the
 * documents. The response says when we will reply, never what the answer is.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, "triage");
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const parsed = triageSchema.safeParse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    nationality: form.get("nationality"),
    arrivedOn: form.get("arrivedOn"),
    housing: form.get("housing"),
    notes: form.get("notes") ?? "",
    gdprTriageConsent: form.get("gdprTriageConsent") === "true",
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  /**
   * Validate every file BEFORE creating the enquiry, so a rejected scan does
   * not leave an enquiry in the staff queue that the student believes failed.
   * Bodies are read here once and reused — reading a File twice is not free.
   */
  const uploads: { kind: TriageDocumentKind; name: string; mimeType: string; bytes: Uint8Array }[] = [];
  for (const kind of TRIAGE_DOCUMENT_KINDS) {
    const file = form.get(kind);
    if (file === null || file === "") continue;
    if (!(file instanceof File) || !KINDS.has(kind)) {
      return NextResponse.json({ error: "Unexpected attachment" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large", path: kind }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateUpload(bytes, file.name);
    if (!check.ok || !check.mimeType) {
      return NextResponse.json({ error: check.error, path: kind }, { status: 415 });
    }
    uploads.push({
      kind,
      name: sanitizeFilename(file.name),
      mimeType: check.mimeType,
      bytes,
    });
  }

  const requested = form.get("locale");
  const locale: Locale = (LOCALES as readonly unknown[]).includes(requested)
    ? (requested as Locale)
    : "en";

  try {
    // Where they came from (a school's guide link, a guide download) travels in
    // two first-party cookies, never in the form: see src/lib/attribution.ts.
    const record = await createTriage(parsed.data, { locale, attribution: attributionFromRequest(request) });

    // Attachments are a convenience, not the enquiry: one that fails to store
    // must not lose the enquiry itself, which staff can still answer by asking
    // for the document again.
    const stored: string[] = [];
    for (const upload of uploads) {
      try {
        await attachTriageDocument(
          record.id,
          upload.kind,
          upload.name,
          upload.mimeType,
          Buffer.from(upload.bytes),
        );
        stored.push(upload.kind);
      } catch (error) {
        console.error(`[triage] ${record.ref}: could not store ${upload.kind}`, error);
      }
    }

    await notifyTriageReceived({
      ref: record.ref,
      route: record.route,
      daysLeft: record.deadlineOn ? daysUntil(record.deadlineOn) : null,
      documents: stored.length,
    });

    // The reference only. Nothing about the submission is echoed back, and the
    // deadline is deliberately not returned: the student gets it in the reply a
    // person writes, not from a number a form guessed.
    return NextResponse.json({ ref: record.ref }, { status: 201 });
  } catch (error) {
    console.error("[triage] failed to record enquiry", error);
    return NextResponse.json(
      { error: "Could not send your enquiry. Please try again." },
      { status: 500 },
    );
  }
}
