import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import { WorkHeader } from "@/components/PageHeader";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "intake.complete" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CompletePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("intake.complete");
  const steps = t.raw("steps") as { title: string; body: string }[];

  return (
    <div className="container-x py-16 sm:py-20">
      <WorkHeader label={t("eyebrow")} title={t("title")} intro={t("intro")} />

      {/* What happens next, as a ruled register: this is the one screen a
          student screenshots and comes back to. */}
      <ol className="mt-14 max-w-4xl border-t-2 border-ink">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="grid gap-x-8 gap-y-2 border-b border-paper-line py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)]"
          >
            <span className="font-mono text-sm font-medium text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-display-sm text-ink">{step.title}</h2>
              <p className="prose-body mt-2">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 max-w-4xl">
        <Modelo790Notice />
      </div>

      <div className="mt-12">
        <Link href="/" className="btn-secondary">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
