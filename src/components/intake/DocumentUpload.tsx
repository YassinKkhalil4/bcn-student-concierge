"use client";

import { useState, useRef } from "react";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";
import type { DocumentKind } from "@/lib/db/schema";

interface SlotCopy {
  label: string;
  description: string;
}

/** What each kind of document is, in words a student understands. */
export const SLOT_COPY: Record<DocumentKind, SlotCopy> = {
  passport: {
    label: "Passport — photo page",
    description: "The page with the machine-readable zone. If your visa is in the passport, add that page too.",
  },
  "acceptance-letter": {
    label: "Certificado de matrícula",
    description: "The official enrolment certificate from your university, stamped and signed.",
  },
  lease: {
    label: "Lease or property deed",
    description: "The full signed contract (or the deed, if the signer owns the flat), all pages.",
  },
  "utility-bill": {
    label: "Recent utility bill",
    description: "Electricity, water or gas, for this address, from the last three months.",
  },
  "padron-authorization": {
    label: "Signed authorisation",
    description: "The authorisation form, signed by hand and dated by the person who authorises you.",
  },
  "authorizer-id": {
    label: "ID of the person who signed",
    description: "A clear photo or scan of their DNI, NIE card or passport — front and back.",
  },
  "collective-authorization": {
    label: "Residence authorisation",
    description: "Barcelona's form for collective homes, signed by the residence and stamped.",
  },
};

/** Slots on the intake form: what most students have to hand on day one. */
const INTAKE_KINDS: DocumentKind[] = ["passport", "acceptance-letter"];

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "done"; name: string; size: number }
  | { state: "error"; message: string };

/**
 * Uploads go straight to the encrypting API route, into the signed-in
 * student's own file (the server reads the case from the session cookie).
 * Files are never held in component state beyond the request, and never
 * written to localStorage — a passport scan in browser storage outlives the
 * session and is readable by any script that later runs on the origin.
 *
 * `uploaded` lists kinds already on file, so a returning student sees what is
 * done without the file itself ever coming back to the browser.
 */
export function DocumentUpload({
  kinds = INTAKE_KINDS,
  uploaded = [],
}: {
  kinds?: readonly DocumentKind[];
  uploaded?: readonly DocumentKind[];
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: DocumentKind, file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatuses((s) => ({
        ...s,
        [kind]: {
          state: "error",
          message: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        },
      }));
      return;
    }

    setStatuses((s) => ({ ...s, [kind]: { state: "uploading" } }));

    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);

    try {
      const res = await fetch("/api/documents", { method: "POST", body });
      const json = (await res.json()) as { error?: string; originalName?: string };
      if (!res.ok) {
        setStatuses((s) => ({
          ...s,
          [kind]: { state: "error", message: json.error ?? "Upload failed." },
        }));
        return;
      }
      setStatuses((s) => ({
        ...s,
        [kind]: { state: "done", name: json.originalName ?? file.name, size: file.size },
      }));
    } catch {
      setStatuses((s) => ({
        ...s,
        [kind]: {
          state: "error",
          message: "Network error. Check your connection and try again.",
        },
      }));
    } finally {
      // Clear the input so re-selecting the same file fires a change event.
      const input = inputs.current[kind];
      if (input) input.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {kinds.map((kind) => {
        const slot = { kind, ...SLOT_COPY[kind] };
        const status = statuses[kind] ?? { state: "idle" as const };
        const onFile = uploaded.includes(kind) || status.state === "done";
        return (
          <div
            key={kind}
            className="rounded-xl border border-bone-line bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-lg">
                <p className="text-sm font-medium text-ink">
                  {slot.label}
                  {onFile && status.state !== "done" && (
                    <span className="ml-2 text-xs font-medium text-olive">✓ on file</span>
                  )}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {slot.description}
                </p>
              </div>

              <label className="btn-secondary cursor-pointer text-xs">
                {onFile ? "Replace" : "Choose file"}
                <input
                  ref={(el) => {
                    inputs.current[slot.kind] = el;
                  }}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(slot.kind, file);
                  }}
                />
              </label>
            </div>

            <div aria-live="polite" className="mt-3">
              {status.state === "uploading" && (
                <p className="text-xs text-ink-soft">Encrypting and uploading…</p>
              )}
              {status.state === "done" && (
                <p className="text-xs font-medium text-olive">
                  ✓ {status.name} — encrypted and stored
                </p>
              )}
              {status.state === "error" && (
                <p role="alert" className="text-xs font-medium text-terracotta">
                  {status.message}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-soft">
        PDF, JPEG or PNG, up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each. Each file is
        encrypted with its own AES-256 key on receipt and permanently deleted 30 days
        after your service completes.
      </p>
    </div>
  );
}
