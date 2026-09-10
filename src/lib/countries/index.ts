import { COUNTRY_CODES, isCountryCode, type CountryCode } from "./codes";
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

/** A country's name in the reader's language, from the platform's own data. */
export function countryDisplayName(code: string, locale: string): string {
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
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.filter((c) => !exclude.includes(c))
    .map((value) => ({ value, label: countryDisplayName(value, locale) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
