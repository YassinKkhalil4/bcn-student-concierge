import { COUNTRY_CODES, isCountryCode, type CountryCode } from "./codes";
import { COUNTRY_DISPLAY_NAMES } from "./display-names.generated";
import { SPANISH_FORM_NAMES } from "./es-names.generated";

/**
 * Countries are stored as ISO 3166-1 alpha-2 codes. Two things follow from a
 * code rather than free text:
 *   - the EX-17 / EX-18 route is decided exactly (no "UK" vs "BRITISH" vs
 *     "UNITED KINGDOM" guesswork);
 *   - the forms print the Spanish name ("REINO UNIDO"), so officers never see
 *     an English country name.
 */
export { COUNTRY_CODES, isCountryCode, type CountryCode };

/**
 * EU + EEA + Switzerland: the citizens who register via EX-18 (certificado de
 * registro de ciudadano de la UE). Spain is deliberately absent — Spanish
 * citizens need neither form.
 */
export const EU_EEA_CH = new Set<CountryCode>([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "SE", // EU (without ES)
  "IS", "LI", "NO", // EEA
  "CH", // Switzerland
]);

/** Spanish, uppercase, as printed on the official forms. */
export function spanishFormName(value: string): string {
  const v = value.trim().toUpperCase();
  // Legacy free-text values (from before the picker) print as entered.
  return isCountryCode(v) ? SPANISH_FORM_NAMES[v] : v;
}

function isSiteLocale(locale: string): locale is keyof typeof COUNTRY_DISPLAY_NAMES {
  return Object.hasOwn(COUNTRY_DISPLAY_NAMES, locale);
}

const DISPLAY_NAME_LOOKUP = new Map(
  Object.entries(COUNTRY_DISPLAY_NAMES).map(([locale, rows]) => [locale, new Map<string, string>(rows)]),
);

/**
 * A country's name in the reader's language. Site locales read the committed
 * table, so the server and the browser agree (their ICU data does not);
 * anything else falls back to the platform's own data.
 */
export function countryDisplayName(code: string, locale: string): string {
  const pinned = DISPLAY_NAME_LOOKUP.get(locale)?.get(code);
  if (pinned) return pinned;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Options for a picker, sorted by name in the reader's language. */
export function countryOptions(
  locale: string,
  exclude: readonly CountryCode[] = [],
): { value: CountryCode; label: string }[] {
  if (isSiteLocale(locale)) {
    // Already sorted at generation time — see scripts/generate-country-names.mts.
    return COUNTRY_DISPLAY_NAMES[locale]
      .filter(([value]) => !exclude.includes(value))
      .map(([value, label]) => ({ value, label }));
  }
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.filter((c) => !exclude.includes(c))
    .map((value) => ({ value, label: countryDisplayName(value, locale) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
