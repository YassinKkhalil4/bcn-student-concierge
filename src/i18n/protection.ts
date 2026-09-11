/**
 * The rules that keep a translation safe to ship, shared by the translation
 * script (scripts/i18n-translate.mts) and the tests: which terms are never
 * translated, how text is prepared for DeepL and restored afterwards, and what
 * makes a translated string unacceptable.
 */

export const TARGETS = ["es", "ca", "fr", "it", "de"] as const;
export type Target = (typeof TARGETS)[number];

/**
 * Never translated. Longest first, so "Modelo 790 Código 012" is kept whole
 * rather than as "Modelo 790" plus a translated remainder.
 */
export const PROTECTED_TERMS = [
  "Autorització d’empadronament de domicili col·lectiu",
  "Autorització per inscriure-us al domicili",
  "Modelo 790 Código 012",
  "Pagar impuestos y tasas",
  "Ejemplar para el interesado",
  "certificado de matrícula",
  "Certificado de matrícula",
  "justificante de cita",
  "traducción jurada",
  "traductor jurado",
  "colegiado abogado",
  "BCN Student Concierge",
  "sede.policia.gob.es",
  "Policía Nacional",
  "Forma de pago",
  "cita previa",
  "en efectivo",
  "Extranjería",
  "Nota Simple",
  "Ready File",
  "Modelo 790",
  "Código 012",
  "T-mobilitat",
  "Carnet Jove",
  "Apple Pay",
  "CaixaBank",
  "Santander",
  "WhatsApp",
  "Turnkey",
  "resguardo",
  "gestoría",
  "AES-256",
  "T-jove",
  "Padrón",
  "Stripe",
  "EX-17",
  "EX-18",
  "BBVA",
  "ISIC",
  "IBI",
  "NIE",
  "TIE",
  "CUE",
  "DNI",
  "NIF",
  "CIF",
  "IVA",
  "CARRER",
  "CALLE",
  "AVINGUDA",
  "PASSEIG",
] as const;

/**
 * Where a language has its OWN official name for a protected term, that name
 * is used instead. In Catalonia these are the official Catalan names: the
 * Ajuntament's "Padró", the Generalitat's "traducció jurada", and so on.
 */
export const LOCAL_NAMES: Partial<Record<Target, Record<string, string>>> = {
  ca: {
    Padrón: "Padró",
    gestoría: "gestoria",
    "colegiado abogado": "advocat col·legiat",
    "traducción jurada": "traducció jurada",
    "traductor jurado": "traductor jurat",
  },
};

// ───────────────────────── protection ─────────────────────────
//
// Learned by testing the alternatives: DeepL writes the most natural
// sentences when placeholders are left as plain text, and it fuses words onto
// anything wrapped in protective markup ("Pag{total}", "un gestoríae"). So:
//   - placeholders go as numbered plain text, {0} {1} — named ones get
//     translated ({name} → {nombre});
//   - protected terms go as plain text, enforced by a DeepL GLOSSARY (EN→ES,
//     FR, IT, DE), which also lets DeepL inflect the sentence around them;
//   - only URLs and emails, which no sentence inflects, sit inside <keep>.
// Rich-text tags are real XML tags (tag_handling "xml").

const TAG = /<\/?([a-zA-Z]+)>/g;
const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;
const URL_OR_EMAIL = /(https?:\/\/[^\s<]+|[\w.+-]+@[\w-]+\.[\w.]+)/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const TERM_PATTERN = new RegExp(
  `(?<![\\p{L}\\d])(${PROTECTED_TERMS.map(escapeRegex).join("|")})(?![\\p{L}\\d])`,
  "gu",
);

export interface Prepared {
  text: string;
  /** Placeholder names by number: {0} is names[0]. */
  names: string[];
}

export function protect(source: string): Prepared {
  const names: string[] = [];
  let text = source.replace(/&/g, "&amp;");
  text = text.replace(URL_OR_EMAIL, (m) => `<keep>${m}</keep>`);
  text = text.replace(PLACEHOLDER, (_, name: string) => {
    if (!names.includes(name)) names.push(name);
    return `{${names.indexOf(name)}}`;
  });
  return { text, names };
}

/**
 * Catalan is translated from the Spanish without a glossary (DeepL has none
 * for that pair), so Spanish labels that must stay verbatim — they are what
 * the police website, the form and the ATM show — are put back here.
 */
const CATALAN_REPAIRS: [RegExp, string][] = [
  [/\b[Mm]odel 790\b/g, "Modelo 790"],
  [/\bCodi 012\b/g, "Código 012"],
  [/\bPolicia Nacional\b/g, "Policía Nacional"],
  [/\bd’(Padró|NIE|NIF|DNI|CIF)\b/g, "del $1"],
  [/\bl’(Padró|NIE|NIF|DNI|CIF)\b/g, "el $1"],
  [/\ba el (Padró|NIE|NIF|DNI|CIF)\b/g, "al $1"],
];

export function restore(translated: string, names: string[], target: Target): string {
  let s = translated
    .replace(/<keep>(.*?)<\/keep>/g, "$1")
    .replace(/\{(\d+)\}/g, (m, i: string) => (names[Number(i)] ? `{${names[Number(i)]}}` : m))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  // In ICU messages an ASCII apostrophe can escape the next brace ("l'{name}"
  // would swallow the placeholder). The typographic one is also simply correct.
  s = s.replace(/'/g, "’");
  if (target === "ca") for (const [pattern, fix] of CATALAN_REPAIRS) s = s.replace(pattern, fix);
  return s;
}

// ───────────────────────── validation ─────────────────────────

const setOf = (s: string, re: RegExp) => [...s.matchAll(re)].map((m) => m[0]).sort().join(" ");
const GLUED = /\p{L}\{|\}\p{L}|\p{L}<(?!\/)/u;

/** Problems with one translated string, or [] when it is safe to ship. */
export function problems(source: string, translated: string, target: Target): string[] {
  const out: string[] = [];
  if (!translated.trim()) out.push("empty");
  if (setOf(source, PLACEHOLDER) !== setOf(translated, PLACEHOLDER)) out.push("placeholders differ");
  if (setOf(source, TAG) !== setOf(translated, TAG)) out.push("tags differ");
  if (GLUED.test(translated) && !GLUED.test(source)) out.push("placeholder or tag glued to a word");
  const local = LOCAL_NAMES[target] ?? {};
  // Case-insensitive: German capitalises nouns ("eine Gestoría"), and that is right.
  const haystack = translated.toLocaleLowerCase();
  for (const m of source.matchAll(TERM_PATTERN)) {
    const expected = local[m[1]!] ?? m[1]!;
    if (!haystack.includes(expected.toLocaleLowerCase())) out.push(`lost term “${expected}”`);
  }
  for (const m of source.matchAll(URL_OR_EMAIL)) if (!translated.includes(m[0])) out.push(`lost ${m[0]}`);
  if (/<keep>|\{\d+\}|&amp;|&lt;/.test(translated)) out.push("protection markup leaked");
  return out;
}


/**
 * Non-breaking spaces where a line break would strand a symbol: "21 %",
 * "299 €", and French punctuation (« Bonjour ! »). Applied to every shipped
 * string, hand-written overrides included.
 */
export function typography(text: string, target: Target): string {
  let s = text.replace(/([\d}]) (%|€)/g, "$1\u00A0$2");
  if (target === "fr") s = s.replace(/ ([:;?!»])/g, "\u202F$1").replace(/« /g, "«\u202F");
  return s;
}
