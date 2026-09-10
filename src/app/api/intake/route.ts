import { NextResponse } from "next/server";
import { intakeSchema } from "@/lib/schema";
import { createCase } from "@/lib/server/storage";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accept a completed intake questionnaire and open a case.
 *
 * Returns only the opaque case id. Nothing about the submitted personal data is
 * echoed back — a reflected payload is a needless disclosure channel if the
 * response is ever logged by an intermediary.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limit = rateLimit(clientKey(request.headers, "intake"), 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    // Field-level messages are safe to return: they describe the submitter's
    // own input and are what the wizard renders inline.
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  try {
    const record = await createCase(parsed.data);
    return NextResponse.json({ caseId: record.id }, { status: 201 });
  } catch (error) {
    // Never leak the exception message: it can contain file paths or key
    // configuration details. Log server-side, return an opaque error.
    console.error("[intake] failed to create case", error);
    return NextResponse.json(
      { error: "Could not save your submission. Please try again." },
      { status: 500 },
    );
  }
}
