import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Modelo790Notice } from "@/components/Modelo790Notice";

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
      <div className="max-w-2xl">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{t("intro")}</p>
      </div>

      <ol className="mt-12 max-w-3xl space-y-7">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-olive text-sm font-semibold text-bone">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 max-w-3xl">
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
