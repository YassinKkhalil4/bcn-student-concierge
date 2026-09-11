"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/**
 * Keeps <html lang> right after a client-side language switch. The root
 * layout renders it on the server, but switching language is a soft
 * navigation that does not re-render the root layout — and a stale lang makes
 * screen readers pronounce Catalan with German rules.
 */
export function DocumentLang() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
