import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { loadMessages } from "./messages";

/**
 * Messages for the current request. Routes outside the [locale] segment — the
 * staff dashboard and the API — have no locale and get English.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Europe/Madrid",
  };
});
