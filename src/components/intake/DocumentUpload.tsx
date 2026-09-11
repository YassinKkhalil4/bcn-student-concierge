"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";
import type { DocumentKind } from "@/lib/db/schema";

/** Slots on the intake form: what most students have to hand on day one. */
const INTAKE_KINDS: DocumentKind[] = ["passport", "acceptance-letter"];

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "done"; name: string; size: number }
  | { state: "error"; message: ErrorKey };

type ErrorKey = "tooLarge" | "wrongType" | "failed" | "network" | "sessionExpired";

const MAX_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

/** The API's status codes are stable; its English error text is not shown. */
function errorFor(status: number): ErrorKey {
  if (status === 401) return "sessionExpired";
  if (status === 413) return "tooLarge";
  if (status === 415) return "wrongType";
  return "failed";
}

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
  const t = useTranslations("intake.documents");
  const tw = useTranslations("intake.wizard");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: DocumentKind, file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatuses((s) => ({
        ...s,
        [kind]: { state: "error", message: "tooLarge" },
      }));
      return;
    }

    setStatuses((s) => ({ ...s, [kind]: { state: "uploading" } }));

    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);

    try {
      const res = await fetch("/api/documents", { method: "POST", body });
      const json = (await res.json()) as { originalName?: string };
      if (!res.ok) {
        setStatuses((s) => ({
          ...s,
          [kind]: { state: "error", message: errorFor(res.status) },
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
        [kind]: { state: "error", message: "network" },
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
        const slot = {
          kind,
          label: t(`slots.${kind}.label`),
          description: t(`slots.${kind}.description`),
        };
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
                    <span className="ml-2 text-xs font-medium text-olive">{t("onFile")}</span>
                  )}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {slot.description}
                </p>
              </div>

              <label className="btn-secondary cursor-pointer text-xs">
                {onFile ? t("replace") : t("choose")}
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
                <p className="text-xs text-ink-soft">{t("uploading")}</p>
              )}
              {status.state === "done" && (
                <p className="text-xs font-medium text-olive">
                  {t("done", { name: status.name })}
                </p>
              )}
              {status.state === "error" && (
                <p role="alert" className="text-xs font-medium text-terracotta">
                  {status.message === "sessionExpired"
                    ? tw("sessionExpired")
                    : t(status.message, { mb: MAX_MB })}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-soft">{t("footer", { mb: MAX_MB })}</p>
    </div>
  );
}
