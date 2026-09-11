"use client";

import { useTranslations } from "next-intl";
import { CopyButton } from "./CopyButton";

/** CopyButton with its labels in the student's language. */
export function LocalizedCopyButton({
  value,
  labelKey = "copy",
  className,
}: {
  value: string;
  labelKey?: "copy" | "copySubject" | "copyMessage";
  className?: string;
}) {
  const t = useTranslations("common.copy");
  return (
    <CopyButton value={value} label={t(labelKey)} copiedLabel={t("copied")} failedLabel={t("failed")} className={className} />
  );
}
