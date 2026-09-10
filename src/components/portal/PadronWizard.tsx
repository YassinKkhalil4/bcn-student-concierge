"use client";

import { useState } from "react";
import type { DocumentKind } from "@/lib/db/schema";
import type { IntakeData } from "@/lib/schema";
import { residenceRequest, COLLECTIVE_AUTHORIZATION_URL } from "@/lib/request-templates";
import { CopyButton } from "@/components/CopyButton";
import { DocumentUpload } from "@/components/intake/DocumentUpload";
import { AuthorizationForm } from "./AuthorizationForm";

type Path = "residence" | "own-lease" | "not-in-name";

const PATHS: { value: Path; title: string; detail: string }[] = [
  { value: "residence", title: "A student residence", detail: "Halls or a residence with a reception desk" },
  { value: "own-lease", title: "A flat I rent", detail: "The lease is in my name" },
  { value: "not-in-name", title: "A room or sublet", detail: "The lease is in someone else's name, or I live with family or friends" },
];

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
  uploaded,
}: {
  person: Pick<IntakeData, "identity" | "address">;
  uploaded: readonly DocumentKind[];
}) {
  const [path, setPath] = useState<Path | null>(() => initialPath(uploaded));

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Where are you living?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PATHS.map((p) => (
            <label key={p.value}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 text-sm transition-colors ${
                path === p.value ? "border-olive bg-olive/[0.04]" : "border-bone-line bg-white hover:bg-bone-warm/50"
              }`}>
              <span className="flex items-center gap-2 font-medium text-ink">
                <input type="radio" name="padron-path" value={p.value} checked={path === p.value}
                  onChange={() => setPath(p.value)} />
                {p.title}
              </span>
              <span className="mt-1 pl-6 text-xs text-ink-muted">{p.detail}</span>
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
  const request = residenceRequest(person);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">
        Residences register their students with a special city form, the{" "}
        <em>Autorització d&rsquo;empadronament de domicili col·lectiu</em>. The residence
        fills it in, signs it and <strong className="text-ink">stamps it</strong> — without
        the stamp it is not accepted. Send this message to reception:
      </p>
      <div className="rounded-xl border border-bone-line bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-bone-line px-4 py-2.5">
          <p className="min-w-0 truncate text-xs text-ink-muted">
            <span className="font-medium text-ink">Subject:</span> {request.subject}
          </p>
          <CopyButton value={request.subject} label="Copy subject" />
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-ink">
          {request.body}
        </pre>
        <div className="flex flex-wrap gap-2 border-t border-bone-line px-4 py-3">
          <CopyButton value={request.body} label="Copy message" />
          <a href={COLLECTIVE_AUTHORIZATION_URL} target="_blank" rel="noopener noreferrer"
            className="rounded-md border border-bone-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bone-warm">
            Open the official form ↗
          </a>
        </div>
      </div>
      <p className="text-sm text-ink-muted">When the residence gives it back, upload it here:</p>
      <DocumentUpload kinds={["collective-authorization"]} uploaded={uploaded} />
    </div>
  );
}

function OwnLeasePath({ uploaded, onNotMine }: { uploaded: readonly DocumentKind[]; onNotMine: () => void }) {
  const [checks, setChecks] = useState({ inMyName: false, longEnough: false, language: false });
  const toggle = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const allGood = checks.inMyName && checks.longEnough && checks.language;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">
        The city accepts your lease only if all three are true. Check each one:
      </p>
      <div className="space-y-2">
        {([
          ["inMyName", "My name is on the lease as a tenant."],
          ["longEnough", "It lasts more than three months, or says explicitly that it extends."],
          ["language", "It is written in Spanish or Catalan."],
        ] as const).map(([key, text]) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-bone-line bg-white p-3 text-sm text-ink">
            <input type="checkbox" checked={checks[key]} onChange={() => toggle(key)} className="mt-0.5" />
            {text}
          </label>
        ))}
      </div>

      {!allGood && (
        <ul className="space-y-2 text-sm leading-relaxed text-ink-muted">
          {!checks.inMyName && (
            <li>
              <strong className="text-ink">Not in your name?</strong> Then the person on the lease must
              authorise you.{" "}
              <button type="button" onClick={onNotMine} className="font-medium text-olive underline">
                Switch to that option
              </button>
            </li>
          )}
          {!checks.longEnough && (
            <li>
              <strong className="text-ink">Three months or less?</strong> Ask your landlord for an extension
              in writing, or to authorise you with the city&rsquo;s form instead.
            </li>
          )}
          {!checks.language && (
            <li>
              <strong className="text-ink">In another language?</strong> The city needs an official
              translation (a <em>traducción jurada</em>, or one from your consulate). A Spanish version
              from your landlord is often quicker — ask first.
            </li>
          )}
        </ul>
      )}

      {allGood && (
        <>
          <p className="text-sm leading-relaxed text-ink-muted">
            Upload the full signed lease and a recent utility bill for the flat. The city asks for the
            bill when the lease is a copy or has expired; we ask for it every time so nothing holds you up.
          </p>
          <DocumentUpload kinds={["lease", "utility-bill"]} uploaded={uploaded} />
        </>
      )}
    </div>
  );
}

function NotInNamePath({ uploaded }: { uploaded: readonly DocumentKind[] }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-muted">
        When the flat is not in your name, whoever holds it authorises you on Barcelona&rsquo;s
        official form, the <em>Autorització per inscriure-us al domicili</em>.
      </p>
      <AuthorizationForm />
      <div className="rounded-xl border border-bone-line bg-white p-5">
        <h4 className="text-sm font-semibold text-ink">2. Get it signed</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>Print it. The person who authorises you signs it <strong className="text-ink">by hand</strong>; the signature must match their ID.</li>
          <li>They write the date next to the signature. The authorisation is valid for <strong className="text-ink">three months</strong> from that date.</li>
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-ink">3. Upload all three</h4>
        <p className="mt-1.5 text-sm text-ink-muted">
          The city will not accept the form on its own. It needs the signer&rsquo;s ID and proof that
          the flat is theirs to offer: the lease in their name, or the deed if they own it.
        </p>
        <div className="mt-4">
          <DocumentUpload kinds={["padron-authorization", "authorizer-id", "lease"]} uploaded={uploaded} />
        </div>
      </div>
    </div>
  );
}
