"use client";

import { useMemo, useState } from "react";
import type { DocumentKind } from "@/lib/db/schema";
import type { IntakeData } from "@/lib/schema";
import { enrolmentRequest } from "@/lib/request-templates";
import { CopyButton } from "@/components/CopyButton";
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
          <span className="group-open:hidden">How do I get this? ▸</span>
          <span className="hidden group-open:inline">How do I get this? ▾</span>
        </summary>
        <div className="space-y-4 border-t border-bone-line px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            Your acceptance letter is not enough. Ask your university&rsquo;s admissions or
            registry office for a <em>certificado de matrícula</em>, stamped and signed. This
            message asks for exactly what the immigration office looks for:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="enr-university" className="field-label">Your university</label>
              <input id="enr-university" list="enr-universities" value={university}
                onChange={(e) => setUniversity(e.target.value)} className="field-input" />
              <datalist id="enr-universities">
                {KNOWN_UNIVERSITIES.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="enr-programme" className="field-label">Your programme</label>
              <input id="enr-programme" value={programme} placeholder="e.g. BBA in International Business"
                onChange={(e) => setProgramme(e.target.value)} className="field-input" />
            </div>
          </div>
          <div className="rounded-lg border border-bone-line">
            <p className="border-b border-bone-line px-4 py-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">Subject:</span> {request.subject}
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
              {request.body}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={request.body} label="Copy message" />
            <CopyButton value={request.subject} label="Copy subject" />
            <a href={mailto} className="rounded-md border border-bone-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bone-warm">
              Open in my email app
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}
