import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { LegalClauses } from "@/components/LegalClauses";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "legal.scope" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Document />;
}

function Document() {
  const t = useTranslations("legal.scope");
  return (
    <LegalPage eyebrow={t("eyebrow")} title={t("title")} updated="2026-09-10">
      <LegalDisclaimer variant="prominent" />
      <LegalClauses doc="scope" />
    </LegalPage>
  );
}
