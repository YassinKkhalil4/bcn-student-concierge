import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { portalCaseId } from "@/lib/portal/guard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "portal.meta" });
  return { title: t("login"), robots: { index: false, follow: false } };
}

const ERRORS = ["email", "link", "locked"] as const;

export default async function PortalLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await portalCaseId()) redirect({ href: "/portal", locale });
  const [query, t] = await Promise.all([searchParams, getTranslations("portal.login")]);
  const error = ERRORS.find((e) => e === query.error);
  const message = query.sent
    ? { tone: "ok" as const, text: t("sent") }
    : error
      ? { tone: "err" as const, text: t(`errors.${error}`) }
      : undefined;

  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md border border-paper-edge border-t-3 border-t-accent bg-white p-7 sm:p-9">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-display-md text-ink">{t("title")}</h1>
        <p className="prose-body mt-3">{t("intro")}</p>

        {message && (
          <p
            role={message.tone === "err" ? "alert" : "status"}
            className={`mt-6 border-l-2 px-4 py-3 text-sm font-medium ${
              message.tone === "ok"
                ? "border-ink bg-paper-dim text-ink"
                : "border-accent bg-accent-tint text-accent-deep"
            }`}
          >
            {message.text}
          </p>
        )}

        <form action="/api/portal/login" method="post" className="mt-8 space-y-4">
          {/* The emailed link, and the page it opens, follow this language. */}
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label htmlFor="email" className="field-label">{t("emailLabel")}</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              className="field-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full">{t("submit")}</button>
        </form>
      </div>
    </div>
  );
}
