"use client";

import { useState, useRef } from "react";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";

export type DocumentKind = "passport" | "acceptance-letter" | "lease";

interface UploadSlot {
  kind: DocumentKind;
  label: string;
  description: string;
  required: boolean;
}

export const UPLOAD_SLOTS: readonly UploadSlot[] = [
  {
    kind: "passport",
    label: "Passport — photo page",
    description:
      "The page showing the machine-readable zone. If your visa is in the passport, include that page too.",
    required: true,
  },
  {
    kind: "acceptance-letter",
    label: "University acceptance letter (matrícula)",
    description:
      "The official enrolment confirmation from your university, on letterhead, showing course dates.",
    required: true,
  },
  {
    kind: "lease",
    label: "Lease or accommodation contract",
    description:
      "Needed for the Padrón. Student residence confirmation letters are accepted in place of a lease.",
    required: false,
  },
];

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "done"; name: string; size: number }
  | { state: "error"; message: string };

/**
 * Uploads go straight to the encrypting API route. Files are never held in
 * component state beyond the request, and never written to localStorage — a
 * passport scan sitting in browser storage outlives the session and is
 * readable by any script that later runs on the origin.
 */
export function DocumentUpload({ caseId }: { caseId: string }) {
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
    body.append("caseId", caseId);
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
      {UPLOAD_SLOTS.map((slot) => {
        const status = statuses[slot.kind] ?? { state: "idle" as const };
        return (
          <div
            key={slot.kind}
            className="rounded-xl border border-bone-line bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-lg">
                <p className="text-sm font-medium text-ink">
                  {slot.label}
                  {!slot.required && (
                    <span className="ml-2 text-xs font-normal text-ink-soft">
                      optional
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {slot.description}
                </p>
              </div>

              <label className="btn-secondary cursor-pointer text-xs">
                {status.state === "done" ? "Replace" : "Choose file"}
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
