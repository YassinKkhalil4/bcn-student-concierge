"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { TickMark } from "@/components/icons";
import { MAX_UPLOAD_BYTES } from "@/lib/server/uploads";
import type { DocumentKind } from "@/lib/db/schema";

/** Slots on the intake form: what most students have to hand on day one. */
const INTAKE_KINDS: DocumentKind[] = ["passport", "acceptance-letter"];

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "done"; name: string; size: number }
  | { state: "error"; message: ErrorKey };

type ErrorKey = "tooLarge" | "wrongType" | "tooMany" | "failed" | "network" | "sessionExpired";

const MAX_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

/** The API's status codes are stable; its English error text is not shown. */
function errorFor(status: number): ErrorKey {
  // 404: the case behind the session no longer exists — sign in again.
  if (status === 401 || status === 404) return "sessionExpired";
  if (status === 413) return "tooLarge";
  if (status === 415) return "wrongType";
  if (status === 429) return "tooMany";
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
      // A proxy in front of the app can answer with an HTML error page.
      const json = (await res.json().catch(() => ({}))) as { originalName?: string };
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
            className="border border-paper-line bg-white p-5 transition-colors hover:border-paper-edge"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-lg">
                <p className="font-sans text-sm font-bold tracking-tight text-ink">
                  {slot.label}
                  {onFile && status.state !== "done" && (
                    <span className="ml-2.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wide text-ink-soft">{t("onFile")}</span>
                  )}
                </p>
                <p className="mt-2 font-sans text-xs leading-relaxed text-ink-muted">
                  {slot.description}
                </p>
              </div>

              {/* The <input> inside is sr-only, so the browser draws its focus ring on a
                  1x1px clipped box. `focus-ring-within` puts it on the label instead —
                  without it this control is reachable by keyboard but invisible while
                  focused, which is most of the way to not being reachable at all. */}
              <label className="btn-secondary focus-ring-within cursor-pointer !px-5 !py-2.5 !text-xs">
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
                <>
                  <p className="font-sans text-xs text-ink-soft">{t("uploading")}</p>
                  {/*
                    The bar is decoration on top of the text, not instead of it:
                    the line above is what a screen reader announces and what
                    survives reduced motion, so it stays. `aria-hidden` keeps
                    the bar out of the announcement entirely — an indeterminate
                    progressbar role would only add noise to a live region that
                    already said the useful thing.
                  */}
                  <div aria-hidden="true" className="progress-indeterminate mt-2.5" />
                </>
              )}
              {status.state === "done" && (
                <p className="flex items-center gap-2 font-sans text-xs font-semibold text-ink">
                  <TickMark className="enter-tick-pop h-3 w-3 flex-none" />
                  {t("done", { name: status.name })}
                </p>
              )}
              {status.state === "error" && (
                <p role="alert" className="enter-alert border-l-2 border-accent pl-2.5 font-sans text-xs font-semibold text-accent-deep">
                  {status.message === "sessionExpired"
                    ? tw("sessionExpired")
                    : t(status.message, { mb: MAX_MB })}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <p className="font-sans text-xs leading-relaxed text-ink-soft">{t("footer", { mb: MAX_MB })}</p>
    </div>
  );
}
