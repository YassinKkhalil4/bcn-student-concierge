"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  REQUEST_LANGUAGES,
  composeLinks,
  type DraftEmail,
  type RequestLanguage,
} from "@/lib/request-templates";
import { LocalizedCopyButton } from "@/components/LocalizedCopyButton";

const ACTION =
  "rounded-md border border-bone-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bone-warm";

/**
 * A ready-to-send email, in the language the recipient reads. English by
 * default — most of the business schools our students attend work in English —
 * with Spanish one click away. Nothing typed here leaves the browser except
 * through the student's own mail app or webmail, when they choose to open it.
 */
export function DraftEmailPanel({
  id,
  draft,
  toPlaceholder,
  actions,
}: {
  /** Prefix for element ids, unique on the page. */
  id: string;
  draft: (lang: RequestLanguage) => DraftEmail;
  toPlaceholder: string;
  /** Extra buttons shown after the email actions. */
  actions?: ReactNode;
}) {
  const t = useTranslations("portal.request");
  const [lang, setLang] = useState<RequestLanguage>("en");
  const [to, setTo] = useState("");
  const email = draft(lang);
  const links = composeLinks({ ...email, to });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <fieldset>
          <legend className="field-label">{t("language")}</legend>
          <div className="inline-flex rounded-lg border border-bone-line bg-white p-0.5">
            {REQUEST_LANGUAGES.map((l) => (
              <label key={l}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === l ? "bg-olive text-bone" : "text-ink-muted hover:bg-bone-warm"
                }`}>
                <input type="radio" name={`${id}-lang`} value={l} checked={lang === l}
                  onChange={() => setLang(l)} className="sr-only" />
                {t(`languages.${l}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor={`${id}-to`} className="field-label">{t("to")}</label>
          <input id={`${id}-to`} type="email" value={to} placeholder={toPlaceholder}
            autoComplete="off" onChange={(e) => setTo(e.target.value)} className="field-input" />
        </div>
      </div>

      <div className="rounded-lg border border-bone-line bg-white">
        <p className="border-b border-bone-line px-4 py-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">{t("subject")}</span>{" "}
          <span lang={lang}>{email.subject}</span>
        </p>
        <pre lang={lang} className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
          {email.body}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <LocalizedCopyButton value={email.body} labelKey="copyMessage" />
        <LocalizedCopyButton value={email.subject} labelKey="copySubject" />
        <a href={links.gmail} target="_blank" rel="noopener noreferrer" className={ACTION}>
          {t("openGmail")}
        </a>
        <a href={links.outlook} target="_blank" rel="noopener noreferrer" className={ACTION}>
          {t("openOutlook")}
        </a>
        <a href={links.mailto} className={ACTION}>
          {t("openEmail")}
        </a>
        {actions}
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">{t("fallback")}</p>
    </div>
  );
}
