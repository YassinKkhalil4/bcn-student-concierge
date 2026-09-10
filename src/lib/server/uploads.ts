/**
 * Upload validation for identity documents.
 *
 * Extensions and client-supplied Content-Type are both attacker-controlled, so
 * the real check is the magic-byte sniff below. A polyglot file that passes a
 * `.pdf` extension check but is actually an HTML document is a stored-XSS
 * vector the moment staff open it in a browser tab.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_TYPES = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
} as const satisfies Record<string, readonly (readonly number[])[]>;

export type AllowedMime = keyof typeof ALLOWED_TYPES;

export interface UploadValidation {
  ok: boolean;
  error?: string;
  mimeType?: AllowedMime;
}

function matchesMagic(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

export function validateUpload(
  bytes: Uint8Array,
  declaredName: string,
): UploadValidation {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "File is empty" };
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`,
    };
  }

  for (const [mime, signatures] of Object.entries(ALLOWED_TYPES)) {
    if (signatures.some((sig) => matchesMagic(bytes, sig))) {
      return { ok: true, mimeType: mime as AllowedMime };
    }
  }

  void declaredName;
  return {
    ok: false,
    error: "Only PDF, JPEG and PNG files are accepted. Please re-export the file.",
  };
}

/**
 * Strip path components and anything that could be interpreted by a shell or a
 * filesystem. The stored name is metadata only — files are written under a
 * server-generated id — but this name is echoed back to staff in the UI.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "document";
}
