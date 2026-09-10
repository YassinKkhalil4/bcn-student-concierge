import { NextResponse } from "next/server";
import { attachDocument, getCase } from "@/lib/server/storage";
import { validateUpload, sanitizeFilename, MAX_UPLOAD_BYTES } from "@/lib/server/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limiting for this route is enforced in src/middleware.ts, so a new
// route cannot ship unprotected by omission.

const KINDS = new Set(["passport", "acceptance-letter", "lease"]);

/**
 * Encrypted document upload.
 *
 * The uploaded bytes are validated by magic number, encrypted with a per-file
 * AES-256-GCM key, and never written to disk in plaintext at any point.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const caseId = String(form.get("caseId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  // Confirm the case exists before reading the body, so an attacker cannot use
  // this endpoint to burn server memory against arbitrary ids.
  const record = await getCase(caseId);
  if (!record || record.purgedAt) {
    // Same response for "no such case" and "purged" — distinguishing them
    // would let an attacker enumerate valid case ids.
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload(bytes, file.name);
  if (!check.ok || !check.mimeType) {
    return NextResponse.json({ error: check.error }, { status: 415 });
  }

  try {
    const doc = await attachDocument(
      caseId,
      kind as "passport" | "acceptance-letter" | "lease",
      sanitizeFilename(file.name),
      check.mimeType,
      Buffer.from(bytes),
    );
    return NextResponse.json(
      {
        documentId: doc.id,
        kind: doc.kind,
        originalName: doc.originalName,
        byteSize: doc.byteSize,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[documents] upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
