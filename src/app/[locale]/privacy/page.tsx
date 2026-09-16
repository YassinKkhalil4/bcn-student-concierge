import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { LegalClauses } from "@/components/LegalClauses";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "legal.privacy" });
  return { title: t("metaTitle"), description: t("metaDescription") };
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
