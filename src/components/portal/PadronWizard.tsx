"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DocumentKind } from "@/lib/db/schema";
import type { IntakeData } from "@/lib/schema";
import { residenceRequest, COLLECTIVE_AUTHORIZATION_URL } from "@/lib/request-templates";
import { DocumentUpload } from "@/components/intake/DocumentUpload";
import { AuthorizationForm } from "./AuthorizationForm";
import { DraftEmailPanel } from "./DraftEmailPanel";

type Path = "residence" | "own-lease" | "not-in-name";

const PATHS: Path[] = ["residence", "own-lease", "not-in-name"];

const em = (chunks: ReactNode) => <em>{chunks}</em>;
const strong = (chunks: ReactNode) => <strong className="text-ink">{chunks}</strong>;

/** Start the student on the path their uploads already point to. */
function initialPath(uploaded: readonly DocumentKind[]): Path | null {
  if (uploaded.includes("collective-authorization")) return "residence";
  if (uploaded.includes("padron-authorization") || uploaded.includes("authorizer-id")) return "not-in-name";
  if (uploaded.includes("lease")) return "own-lease";
  return null;
}

/**
 * Padrón (city registration) documents, as a situational wizard. What the city
 * accepts as proof of address depends on how the student lives — this asks
 * that first, then shows only what applies. Rules follow the Ajuntament's own
 * "Alta al Padró municipal d'habitants" procedure page.
 */
export function PadronWizard({
  person,
  uploaded = [],
}: {
  person: Pick<IntakeData, "identity" | "address">;
  /** Kinds already on file — omitted during intake, where nothing is yet. */
  uploaded?: readonly DocumentKind[];
}) {
  const t = useTranslations("portal.padron");
  const [path, setPath] = useState<Path | null>(() => initialPath(uploaded));

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">{t("question")}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PATHS.map((p) => (
            <label key={p}
              className={`flex cursor-pointer flex-col border p-4 text-sm transition-colors ${
                path === p ? "border-ink bg-paper-dim" : "border-paper-line bg-white hover:bg-paper-dim"
              }`}>
              <span className="flex items-center gap-2 font-medium text-ink">
                <input type="radio" name="padron-path" value={p} checked={path === p}
                  onChange={() => setPath(p)} />
                {t(`paths.${p}.title`)}
              </span>
              <span className="mt-1 pl-6 text-xs text-ink-muted">{t(`paths.${p}.detail`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        {path === "residence" && <ResidencePath person={person} uploaded={uploaded} />}
        {path === "own-lease" && <OwnLeasePath uploaded={uploaded} onNotMine={() => setPath("not-in-name")} />}
        {path === "not-in-name" && <NotInNamePath uploaded={uploaded} />}
      </div>
    </div>
  );
}

function ResidencePath({ person, uploaded }: { person: Pick<IntakeData, "identity" | "address">; uploaded: readonly DocumentKind[] }) {
  const t = useTranslations("portal.padron.residence");
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">{t.rich("intro", { em, strong })}</p>
      <DraftEmailPanel
        id="residence"
        draft={(lang) => residenceRequest(person, lang)}
        toPlaceholder={t("toPlaceholder")}
        actions={
          <a href={COLLECTIVE_AUTHORIZATION_URL} target="_blank" rel="noopener noreferrer" className="btn-mini">
            {t("openForm")}
          </a>
        }
      />
      <p className="text-sm text-ink-muted">{t("uploadPrompt")}</p>
      <DocumentUpload kinds={["collective-authorization"]} uploaded={uploaded} />
    </div>
  );
}

function OwnLeasePath({ uploaded, onNotMine }: { uploaded: readonly DocumentKind[]; onNotMine: () => void }) {
  const t = useTranslations("portal.padron.lease");
  const [checks, setChecks] = useState({ inMyName: false, longEnough: false, language: false });
  const toggle = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const allGood = checks.inMyName && checks.longEnough && checks.language;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">{t("intro")}</p>
      <div className="space-y-2">
        {(["inMyName", "longEnough", "language"] as const).map((key) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 border border-paper-line bg-white p-3 text-sm text-ink">
            <input type="checkbox" checked={checks[key]} onChange={() => toggle(key)} className="mt-0.5" />
            {t(key)}
          </label>
        ))}
      </div>

      {!allGood && (
        <ul className="space-y-2 text-sm leading-relaxed text-ink-muted">
          {!checks.inMyName && (
            <li>
              {t.rich("notMine", { strong })}{" "}
              <button type="button" onClick={onNotMine} className="font-medium text-accent-deep underline">
                {t("switch")}
              </button>
            </li>
          )}
          {!checks.longEnough && (
            <li>{t.rich("tooShort", { strong })}</li>
          )}
          {!checks.language && (
            <li>{t.rich("otherLanguage", { strong, em })}</li>
          )}
        </ul>
      )}

      {allGood && (
        <>
          <p className="text-sm leading-relaxed text-ink-muted">{t("upload")}</p>
          <DocumentUpload kinds={["lease", "utility-bill"]} uploaded={uploaded} />
        </>
      )}
    </div>
  );
}

function NotInNamePath({ uploaded }: { uploaded: readonly DocumentKind[] }) {
  const t = useTranslations("portal.padron.sublet");
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">{t.rich("intro", { em })}</p>
      <AuthorizationForm />
      <div className="border border-paper-line bg-white p-5">
        <h4 className="text-sm font-semibold text-ink">{t("signTitle")}</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>{t.rich("signByHand", { strong })}</li>
          <li>{t.rich("signDate", { strong })}</li>
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-ink">{t("uploadTitle")}</h4>
        <p className="mt-1.5 text-sm text-ink-muted">{t("uploadBody")}</p>
        <div className="mt-4">
          <DocumentUpload kinds={["padron-authorization", "authorizer-id", "lease"]} uploaded={uploaded} />
        </div>
      </div>
    </div>
  );
}
