import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TIERS } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { UNIVERSITIES } from "@/lib/universities";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "home" });
  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Landing />;
}

function Landing() {
  const t = useTranslations("home");
  const tt = useTranslations("triage");
  const problems = t.raw("problems.items") as { problem: string; detail: string; solution: string }[];
  const steps = t.raw("process.steps") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-bone-line bg-gradient-to-b from-bone-warm to-bone">
        <div className="container-x py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
              {t("hero.body")}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/triage" className="btn-primary">
                {t("hero.primaryCta")}
              </Link>
              <Link href="/pricing" className="btn-secondary">
                {t("hero.secondaryCta")}
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink-soft">
              {t("hero.note")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Trust badges ─────────────────────────────────────────────── */}
      <section className="border-b border-bone-line bg-white/50 py-9">
        <div className="container-x">
          <p className="text-center text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
            {t("trust.heading")}
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
            {t("trust.disclaimer")}
          </p>
        </div>
      </section>

      {/* ── Problem / solution ───────────────────────────────────────── */}
      <section id="how-it-works" className="container-x py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("problems.eyebrow")}</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {t("problems.title")}
          </h2>
        </div>

        <div className="mt-14 grid gap-x-12 gap-y-12 lg:grid-cols-2">
          {problems.map((item) => (
            <div key={item.problem} className="border-t border-bone-line pt-7">
              <h3 className="font-display text-xl font-semibold text-ink">
                {item.problem}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {item.detail}
              </p>
              <p className="mt-4 border-l-2 border-olive-light pl-4 text-sm leading-relaxed text-ink">
                <span className="font-semibold text-olive">{t("problems.approach")}</span>
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
            <p className="eyebrow">{t("process.eyebrow")}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {t("process.title")}
            </h2>
          </div>
          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="font-display text-3xl font-semibold text-olive-light">
                  {String(i + 1).padStart(2, "0")}
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

      {/*
        ── Free triage ───────────────────────────────────────────────
        Sits directly above the packages on purpose. It is the primary call to
        action: it converts, it filters out the cases we should decline, and a
        student who is out of time needs to reach it before a price list.
      */}
      <section className="border-t border-bone-line bg-olive/5 py-16 sm:py-20">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{tt("cta.eyebrow")}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {tt("cta.title")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">{tt("cta.body")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/triage" className="btn-primary">
                {tt("cta.button")}
              </Link>
              <span className="text-xs text-ink-soft">{tt("cta.note")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="container-x py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("pricing.eyebrow")}</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            {t("pricing.body")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} compact />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/pricing" className="btn-secondary">
            {t("pricing.cta")}
          </Link>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-bone-line bg-bone-warm py-20 sm:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">{t("faq.eyebrow")}</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {t("faq.title")}
            </h2>
          </div>

          <div className="mt-12 max-w-3xl divide-y divide-bone-line border-y border-bone-line">
            {faq.map((item) => (
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
