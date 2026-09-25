"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocumentKind } from "@/lib/db/schema";
import type { IntakeData } from "@/lib/schema";
import { enrolmentRequest } from "@/lib/request-templates";
import { UNIVERSITIES } from "@/lib/universities";
import { DocumentUpload } from "@/components/intake/DocumentUpload";
import { DraftEmailPanel } from "./DraftEmailPanel";

/**
 * Enrolment certificate: the upload, plus "How do I get this?" — an email to
 * the university registry, in English or Spanish, asking for a certificate in
 * the form Extranjería expects. University and programme are only used to fill
 * the email in the browser; they are not sent to our server.
 */
export function EnrolmentWizard({
  person,
  uploaded = [],
}: {
  person: Pick<IntakeData, "identity" | "address">;
  /** Kinds already on file — omitted during intake, where nothing is yet. */
  uploaded?: readonly DocumentKind[];
}) {
  const t = useTranslations("portal.enrolment");
  const [university, setUniversity] = useState("");
  const [programme, setProgramme] = useState("");

  return (
    <div className="space-y-4">
      <DocumentUpload kinds={["acceptance-letter"]} uploaded={uploaded} />

      <details className="group border border-paper-line bg-white">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-accent-deep">
          <span className="group-open:hidden">{t("howTo")} ▸</span>
          <span className="hidden group-open:inline">{t("howTo")} ▾</span>
        </summary>
        <div className="space-y-4 border-t border-paper-line px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            {t.rich("intro", { em: (chunks) => <em>{chunks}</em> })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="enr-university" className="field-label">{t("university")}</label>
              <input id="enr-university" list="enr-universities" value={university}
                onChange={(e) => setUniversity(e.target.value)} className="field-input" />
              <datalist id="enr-universities">
                {UNIVERSITIES.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="enr-programme" className="field-label">{t("programme")}</label>
              <input id="enr-programme" value={programme} placeholder={t("programmePlaceholder")}
                onChange={(e) => setProgramme(e.target.value)} className="field-input" />
            </div>
          </div>
          <DraftEmailPanel
            id="enr"
            draft={(lang) => enrolmentRequest(person, { university, programme }, lang)}
            toPlaceholder={t("toPlaceholder")}
          />
        </div>
      </details>
    </div>
  );
}
