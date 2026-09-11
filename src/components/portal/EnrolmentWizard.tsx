"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DocumentKind } from "@/lib/db/schema";
import type { IntakeData } from "@/lib/schema";
import { enrolmentRequest } from "@/lib/request-templates";
import { LocalizedCopyButton } from "@/components/LocalizedCopyButton";
import { DocumentUpload } from "@/components/intake/DocumentUpload";

const KNOWN_UNIVERSITIES = [
  "EU Business School",
  "Harbour.Space University",
  "IESE Business School",
  "ESADE",
  "Barcelona Technology School",
];

/**
 * Enrolment certificate: the upload, plus "How do I get this?" — a Spanish
 * email to the university registry asking for a certificate in the form
 * Extranjería expects. University and programme are only used to fill the
 * email in the browser; they are not sent to our server.
 */
export function EnrolmentWizard({
  person,
  uploaded,
}: {
  person: Pick<IntakeData, "identity" | "address">;
  uploaded: readonly DocumentKind[];
}) {
  const t = useTranslations("portal.enrolment");
  const locale = useLocale();
  const [university, setUniversity] = useState("");
  const [programme, setProgramme] = useState("");
  const request = useMemo(
    () => enrolmentRequest(person, { university, programme }),
    [person, university, programme],
  );
  const mailto = `mailto:?subject=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;

  return (
    <div className="space-y-4">
      <DocumentUpload kinds={["acceptance-letter"]} uploaded={uploaded} />

      <details className="group rounded-xl border border-bone-line bg-white">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-olive">
          <span className="group-open:hidden">{t("howTo")} ▸</span>
          <span className="hidden group-open:inline">{t("howTo")} ▾</span>
        </summary>
        <div className="space-y-4 border-t border-bone-line px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            {t.rich("intro", { em: (chunks) => <em>{chunks}</em> })}
          </p>
          {locale !== "es" && <p className="text-xs text-ink-soft">{t("spanishNote")}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="enr-university" className="field-label">{t("university")}</label>
              <input id="enr-university" list="enr-universities" value={university}
                onChange={(e) => setUniversity(e.target.value)} className="field-input" />
              <datalist id="enr-universities">
                {KNOWN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="enr-programme" className="field-label">{t("programme")}</label>
              <input id="enr-programme" value={programme} placeholder={t("programmePlaceholder")}
                onChange={(e) => setProgramme(e.target.value)} className="field-input" />
            </div>
          </div>
          <div className="rounded-lg border border-bone-line">
            <p className="border-b border-bone-line px-4 py-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">{t("subject")}</span>{" "}
              <span lang="es">{request.subject}</span>
            </p>
            <pre lang="es" className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
              {request.body}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <LocalizedCopyButton value={request.body} labelKey="copyMessage" />
            <LocalizedCopyButton value={request.subject} labelKey="copySubject" />
            <a href={mailto} className="rounded-md border border-bone-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bone-warm">
              {t("openEmail")}
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}
