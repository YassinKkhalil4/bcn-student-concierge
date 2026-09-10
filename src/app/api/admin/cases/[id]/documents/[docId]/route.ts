import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { readDocument } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Decrypt and download one identity document.
 *
 * Always served as an ATTACHMENT, never inline: even with upload-time
 * magic-byte checks, rendering a user-supplied file in the admin origin is a
 * needless risk when a download costs staff one click.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;
  try {
    const { document, bytes } = await readDocument(id, docId);
    // Access to a passport scan is worth a log line (GDPR Art. 5(2)).
    console.info(`[admin] document download case=${id.slice(0, 8)} kind=${document.kind}`);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${document.kind}-${id.slice(0, 8)}${extension(document.mimeType)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}

function extension(mime: string): string {
  return mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : ".jpg";
}
