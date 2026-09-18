import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TIERS } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { JsonLd } from "@/components/JsonLd";
import { UNIVERSITIES } from "@/lib/universities";
import { alternatesFor } from "@/lib/seo";
import { faqPage, graph, organization, serviceOffers, website } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: alternatesFor("/", locale),
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Structured data, built from the same catalogues and the same tier table
  // the page itself renders — so it cannot publish a price or an answer the
  // page does not show. See src/lib/structured-data.ts.
  const t = await getTranslations({ locale, namespace: "home" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const tierCopy = Object.fromEntries(
    TIERS.map((tier) => [
      tier.id,
      { name: tp(`tiers.${tier.id}.name`), tagline: tp(`tiers.${tier.id}.tagline`) },
    ]),
  );

  return (
    <>
      <JsonLd
        json={graph(
          organization(tc("brand"), t("metaDescription")),
          website(tc("brand"), locale),
          serviceOffers(tierCopy, locale),
          faqPage(t.raw("faq.items") as { q: string; a: string }[]),
        )}
      />
      <Landing />
    </>
  );
}

/**
 * THE PAGE IS A DOCUMENT.
 *
 * Navy is cover stock, paper is the interior. The hero is the front cover and
 * the footer is the back one; everything between them sits on paper. Those are
 * the only two dark surfaces on the site, and no section inverts on its own.
 *
 * Label rules (the small crimson-ruled caps above a heading) are rationed to
 * three on this page — hero, failure points, pricing. They used to sit above
 * all eight sections, which gave every heading the same three-part chord and
 * made the page read as a template. The remaining headings carry themselves.
 */
function Landing() {
  const t = useTranslations("home");
  const tt = useTranslations("triage");
  const problems = t.raw("problems.items") as { problem: string; detail: string; solution: string }[];
  const steps = t.raw("process.steps") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const proof = t.raw("proof.items") as string[];
  return (
    <>
      {/* ── The cover ─────────────────────────────────────────────────────
          Three elements and nothing else: the label, the promise, the two
          doors. The long paragraph that used to sit here ran to seventy words
          and pushed the buttons off a laptop screen; it is now the opening
          paragraph of the section directly below, where it has room to be
          read rather than skimmed past. */}
      <section className="on-ink relative">
        <div className="container-x py-20 sm:py-28 lg:py-32">
          <p className="rule-label">{t("hero.eyebrow")}</p>
          <h1 className="mt-7 max-w-[20ch] text-display-xl text-onink sm:max-w-[26ch] lg:max-w-[30ch]">
            {t("hero.title")}
          </h1>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/triage" className="btn-primary">
              {t("hero.primaryCta")}
            </Link>
            <Link href="/pricing" className="btn-secondary">
              {t("hero.secondaryCta")}
            </Link>
          </div>
        </div>
      </section>

      {/*
        ── The opening, and what you can hold us to ──────────────────────
        Two bands used to sit here, both `bg-white/50 py-9`, one above the
        other: the commitments and the university names. They were the same
        layout twice running and the eye slid off both. The commitments now
        open the interior with the argument beside them, which is where a
        high-ticket purchase from a stranger actually needs them.
      */}
      <section className="section border-b border-paper-line">
        <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div>
            <h2 className="text-display-lg text-ink">{t("proof.heading")}</h2>
            <p className="prose-lede measure mt-6">{t("hero.body")}</p>
            <p className="mt-6 max-w-narrow border-l-2 border-accent pl-4 font-sans text-sm leading-relaxed text-ink-muted">
              {t("hero.note")}
            </p>
          </div>

          {/* Numbered, because these are four separate promises and a student
              comparing services should be able to cite one of them back. */}
          <ol className="border-t border-paper-edge lg:mt-2.5">
            {proof.map((item, i) => (
              <li key={item} className="flex gap-6 border-b border-paper-line py-5">
                <span className="w-7 flex-none pt-0.5 font-mono text-sm font-medium text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="prose-body text-ink">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Where our students study ──────────────────────────────────────
          A quiet typographic line-up, not a logo wall: these are institutions
          whose students we serve, not institutions that endorse us. Implying
          endorsement would be a misrepresentation and, for a service that must
          disclaim official status, a genuine liability — so the names are set
          as names, in the site's own type, and the disclaimer runs beneath. */}
      <section className="border-b border-paper-line bg-paper-dim section-tight">
        <div className="container-x text-center">
          <h2 className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-ink-soft">
            {t("trust.heading")}
          </h2>
          <ul className="mx-auto mt-7 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {UNIVERSITIES.map((name) => (
              <li key={name} className="font-sans text-base font-semibold tracking-tight text-ink sm:text-lg">
                {name}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-7 max-w-2xl font-sans text-xs leading-relaxed text-ink-soft">
            {t("trust.disclaimer")}
          </p>
        </div>
      </section>

      {/* ── Failure points ────────────────────────────────────────────────
          A numbered spread. The problem is stated in the display face, the
          detail reads in the serif, and the answer hangs off a crimson rule —
          so a reader scanning only the crimson gets the whole argument. */}
      <section id="how-it-works" className="section">
        <div className="container-x">
          <div className="max-w-3xl">
            <p className="rule-label">{t("problems.eyebrow")}</p>
            <h2 className="mt-5 text-display-lg text-ink">{t("problems.title")}</h2>
          </div>

          <div className="mt-16 grid gap-x-20 gap-y-14 lg:grid-cols-2">
            {problems.map((item, i) => (
              <article key={item.problem} className="border-t-2 border-ink pt-6">
                <p className="font-mono text-sm font-medium text-accent">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-display-sm text-ink">{item.problem}</h3>
                <p className="prose-body mt-4">{item.detail}</p>
                <p className="mt-5 border-l-2 border-accent pl-5 font-sans text-sm leading-relaxed text-ink">
                  <span className="font-bold text-accent-deep">{t("problems.approach")}</span>
                  {item.solution}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── The four stages ───────────────────────────────────────────────
          Ruled rows rather than four cards in a row: this is a sequence, and a
          sequence reads down a page the way a contents list does. */}
      <section className="border-y border-paper-line bg-paper-dim section">
        <div className="container-x">
          <h2 className="max-w-2xl text-display-lg text-ink">{t("process.title")}</h2>
          <ol className="mt-14 border-t border-paper-edge">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-x-10 gap-y-2 border-b border-paper-line py-7
                           sm:grid-cols-[3.5rem_minmax(0,14rem)_minmax(0,1fr)] sm:py-8"
              >
                <span className="font-mono text-lg font-medium text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-display-sm text-ink">{step.title}</h3>
                <p className="prose-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/*
        ── Free triage ───────────────────────────────────────────────────
        Sits directly above the packages on purpose. It is the primary call to
        action: it converts, it filters out the cases we should decline, and a
        student who is out of time needs to reach it before a price list.
      */}
      <section className="section-band">
        <div className="container-x">
          <div className="border-t-3 border-accent pt-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
              <div>
                <h2 className="max-w-xl text-display-lg text-ink">{tt("cta.title")}</h2>
                <p className="prose-lede measure mt-5">{tt("cta.body")}</p>
              </div>
              <div className="lg:pb-2">
                <Link href="/triage" className="btn-primary w-full sm:w-auto">
                  {tt("cta.button")}
                </Link>
                <p className="mt-4 max-w-xs font-sans text-xs leading-relaxed text-ink-soft">
                  {tt("cta.note")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Packages ──────────────────────────────────────────────────────
          Three columns divided by hairlines, not three boxes floating on the
          page. The card chrome was carrying no information: the prices are
          what distinguish these, so the rules let the three price rows line up
          across the spread and be compared. */}
      <section className="section">
        <div className="container-x">
          <div className="max-w-3xl">
            <p className="rule-label">{t("pricing.eyebrow")}</p>
            <h2 className="mt-5 text-display-lg text-ink">{t("pricing.title")}</h2>
            <p className="prose-lede measure mt-6">{t("pricing.body")}</p>
          </div>

          <div className="mt-16 grid border-t-2 border-ink lg:grid-cols-3">
            {TIERS.map((tier) => (
              <PricingCard key={tier.id} tier={tier} compact />
            ))}
          </div>

          <div className="mt-12">
            <Link href="/pricing" className="btn-secondary">
              {t("pricing.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Straight answers ──────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-paper-line bg-paper-dim section">
        <div className="container-x">
          <h2 className="max-w-2xl text-display-lg text-ink">{t("faq.title")}</h2>

          <div className="mt-12 max-w-4xl border-t-2 border-ink">
            {faq.map((item) => (
              <details key={item.q} className="group border-b border-paper-line py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <span className="text-display-sm text-ink transition-colors group-hover:text-accent-deep">
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1 flex-none font-sans text-2xl font-light leading-none text-accent
                               transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="prose-body measure mt-4">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 max-w-4xl">
            <LegalDisclaimer variant="prominent" />
          </div>
        </div>
      </section>

      {/*
        ── Close ─────────────────────────────────────────────────────────
        The page used to end on the legal disclaimer, which is a dead end for a
        reader whose objections have just been answered. Two doors, because the
        homepage serves two people: one who has decided, and one who has not.
      */}
      <section className="section">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-20">
          <h2 className="text-display-xl text-ink">{t("close.title")}</h2>
          <div className="lg:pt-3">
            <p className="prose-lede">{t("close.body")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/triage" className="btn-primary">
                {t("close.primaryCta")}
              </Link>
              <Link href="/intake" className="btn-secondary">
                {t("close.secondaryCta")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
