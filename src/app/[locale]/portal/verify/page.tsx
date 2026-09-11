import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { verifyLoginLinkToken } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "portal.meta" });
  return { title: t("verify"), robots: { index: false, follow: false } };
}

/**
 * Landing page for the emailed link. It checks the link's signature and expiry
 * but does NOT use it up: redeeming happens only when the student presses the
 * button. Email security scanners open links automatically; if opening this
 * page consumed the token, the student's single-use link would already be spent.
 */
export default async function PortalVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ token }, t] = await Promise.all([searchParams, getTranslations("portal.verify")]);
  const link = await verifyLoginLinkToken(token);

  return (
    <div className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md text-center">
        {link ? (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{t("title")}</h1>
            <p className="mt-3 text-sm text-ink-muted">{t("once")}</p>
            <form action="/api/portal/verify" method="post" className="mt-8">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="btn-primary w-full">{t("open")}</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{t("expiredTitle")}</h1>
            <p className="mt-3 text-sm text-ink-muted">{t("expiredBody")}</p>
            <Link href="/portal/login" className="btn-primary mt-8 w-full">
              {t("newLink")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
