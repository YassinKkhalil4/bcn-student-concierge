import Link from "next/link";
import { TIERS } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

const UNIVERSITIES = [
  "EU Business School",
  "Harbour.Space",
  "IESE Business School",
  "ESADE",
  "Barcelona Technology School",
];

const PROBLEMS = [
  {
    problem: "Cita previa slots vanish in seconds",
    detail:
      "Padrón and National Police appointments are released irregularly and taken within minutes by automated agents. Families refreshing a Spanish-language portal from another timezone rarely win one.",
    solution:
      "We monitor release windows across Barcelona's districts and secure the appointment in your student's name, then send the confirmation with directions and the exact documents to carry.",
  },
  {
    problem: "One wrong box voids the whole file",
    detail:
      "An EX-17 with a second surname filled in as “N/A”, a representative section completed by a well-meaning parent, or a form printed with shifted field text is refused at the counter — and the next appointment is weeks away.",
    solution:
      "Forms are generated programmatically from your verified data, flattened so nothing shifts on print, and cross-checked against the passport before the file leaves our hands.",
  },
  {
    problem: "The tax form cannot be paid online",
    detail:
      "Modelo 790 Código 012 carries a unique barcode and, for most students, must be paid in cash at a Spanish bank counter or ATM scanner. Students routinely arrive at the police station with an unpaid form.",
    solution:
      "We configure the barcoded form for cash payment and give step-by-step instructions for CaixaBank, BBVA and Santander — including which branches accept non-customer payments.",
  },
  {
    problem: "Housing fraud targets arriving students",
    detail:
      "Listings advertised from abroad are frequently sublet illegally, owned by someone other than the “landlord”, or bound to deposits above the legal cap. Deposits wired before arrival are rarely recovered.",
    solution:
      "On our Turnkey tier we pull the Nota Simple from the property registry to confirm who actually owns the flat, and check the contract's deposit against the statutory limit before anyone transfers money.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Secure intake",
    body: "Your student completes the encrypted questionnaire and uploads their passport, matrícula letter and lease. Documents are encrypted per-file with AES-256.",
  },
  {
    n: "02",
    title: "File assembly",
    body: "We generate the correct form — EX-17 for non-EU students, EX-18 for EU nationals — configure the Modelo 790, and assemble a pre-checked Ready File.",
  },
  {
    n: "03",
    title: "Appointments secured",
    body: "We book the Padrón and TIE/CUE appointments and deliver a dated itinerary: where to go, what to carry, what will be asked.",
  },
  {
    n: "04",
    title: "Landing & tracking",
    body: "Banking, transit and connectivity are set up in the first week. We track the file for 90 days, through to card collection.",
  },
];

const FAQ = [
  {
    q: "Are you lawyers or a gestoría?",
    a: "No. We are an independent administrative facilitation service. We prepare documents from information you provide, book appointments, and guide you through the process. We do not represent you before any authority and we do not give legal advice. Where a case needs legal analysis, we will tell you plainly and recommend you consult a colegiado abogado.",
  },
  {
    q: "Does my student have to attend appointments in person?",
    a: "Yes. Biometric appointments require the applicant to appear personally with original documents. We prepare the file, secure the slot and brief them thoroughly — but the appearance is theirs, in their own name.",
  },
  {
    q: "What happens to the passport scans afterwards?",
    a: "They are encrypted at rest with a unique key per file and permanently deleted 30 days after your service completes, by an automated retention job. You can request earlier deletion at any time.",
  },
  {
    q: "Can you guarantee the residency card is approved?",
    a: "No, and any service that guarantees this is misleading you. Decisions rest entirely with the Spanish authorities. What we control is that the file is complete, correct and submitted on time — which is where most rejections actually originate.",
  },
  {
    q: "Why is the Modelo 790 paid in cash?",
    a: "The Spanish tax agency's process for this form relies on a unique barcode read at a bank counter or ATM scanner. Without a Spanish digital certificate — which new arrivals do not have — online settlement is not available, so the form is configured for payment 'en efectivo'.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-bone-line bg-gradient-to-b from-bone-warm to-bone">
        <div className="container-x py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow">Barcelona · Established for international families</p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Frictionless arrivals and legal landing for international
              university students in Barcelona.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
              Your child has a place at a Barcelona university. What stands between
              them and settling in is a chain of Spanish bureaucracy that is
              unforgiving of small errors — and conducted entirely in Spanish. We
              handle the chain, correctly, the first time.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/intake" className="btn-primary">
                Begin secure intake
              </Link>
              <Link href="/pricing" className="btn-secondary">
                Compare packages
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink-soft">
              Fixed fees, quoted with IVA before you pay. No hourly billing.
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust badges ─────────────────────────────────────────────── */}
      <section className="border-b border-bone-line bg-white/50 py-9">
        <div className="container-x">
          <p className="text-center text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
            Supporting students arriving at
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {UNIVERSITIES.map((name) => (
              <li
                key={name}
                className="font-display text-base text-ink-muted sm:text-lg"
              >
                {name}
              </li>
            ))}
          </ul>
          {/*
            Honest framing: these are institutions whose students we serve, not
            institutions that endorse us. Implying endorsement would be a
            misrepresentation and, for a service that must disclaim official
            status, a genuine liability.
          */}
          <p className="mt-5 text-center text-[11px] text-ink-soft">
            Universities named are those our clients attend. We are an independent
            service and are not affiliated with, endorsed by, or acting on behalf of
            any institution listed.
          </p>
        </div>
      </section>

      {/* ── Problem / solution ───────────────────────────────────────── */}
      <section id="how-it-works" className="container-x py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">What actually goes wrong</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Four failure points, and how we remove each one.
          </h2>
        </div>

        <div className="mt-14 grid gap-x-12 gap-y-12 lg:grid-cols-2">
          {PROBLEMS.map((item) => (
            <div key={item.problem} className="border-t border-bone-line pt-7">
              <h3 className="font-display text-xl font-semibold text-ink">
                {item.problem}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {item.detail}
              </p>
              <p className="mt-4 border-l-2 border-olive-light pl-4 text-sm leading-relaxed text-ink">
                <span className="font-semibold text-olive">Our approach — </span>
                {item.solution}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────────────── */}
      <section className="border-y border-bone-line bg-bone-warm py-20 sm:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">The process</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Four stages, from intake to collected card.
            </h2>
          </div>
          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="font-display text-3xl font-semibold text-olive-light">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="container-x py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Transparent pricing</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Three packages. Fixed fees, stated with IVA.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Government fees (Modelo 790, card issuance) are paid directly by you to
            the Spanish authorities and are not included in our fee.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} compact />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/pricing" className="btn-secondary">
            See full comparison
          </Link>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-bone-line bg-bone-warm py-20 sm:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">Straight answers</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Questions parents ask first.
            </h2>
          </div>

          <div className="mt-12 max-w-3xl divide-y divide-bone-line border-y border-bone-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span className="font-display text-lg font-medium text-ink">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1 flex-none text-xl leading-none text-olive-light transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl pr-8 text-sm leading-relaxed text-ink-muted">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-12 max-w-3xl">
            <LegalDisclaimer variant="prominent" />
          </div>
        </div>
      </section>
    </>
  );
}
