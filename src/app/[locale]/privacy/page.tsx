import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { LegalClauses } from "@/components/LegalClauses";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/privacy", locale),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Document />;
}

function Document() {
  const t = useTranslations("legal.privacy");
  return (
    <LegalPage eyebrow={t("eyebrow")} title={t("title")} updated="2026-09-16">

      <LegalClauses doc="privacy" />
    </LegalPage>
  );
}
