import type { FormId } from "@/lib/forms/field-map";
import { formatMadrid } from "@/lib/time";

/**
 * What the appointment-day sheet says — kept apart from how it is drawn, so
 * the route-specific rules can be tested directly.
 *
 * The two routes differ in ways that matter on the day:
 *   EX-17 (TIE card): fingerprints are taken and a 32 × 26 mm photo is needed.
 *   EX-18 (EU registration certificate): no fingerprints, no photo.
 * Telling an EU student to bring photos and ask for "toma de huellas" makes
 * them look unprepared at the counter; omitting the photo for a TIE applicant
 * ends the appointment.
 *
 * The sheet is written in the student's language (messages/<locale>/guides.json
 * → "sheet"). The phrases to SAY stay in Spanish, since that is what the
 * officer hears; only their meaning is translated.
 */

export interface Phrase {
  spanish: string;
  phonetic: string;
  meaning: string;
}

export interface AppointmentSheetContent {
  title: string;
  purpose: string;
  labels: {
    when: string;
    where: string;
    arrive: string;
    metro: string;
    bring: string;
    phrases: string;
    after: string;
  };
  when: { date: string; time: string };
  office: { name: string; address: string; metro: string | null };
  confirmationCode: string | null;
  checklist: string[];
  /** Empty when the reader already speaks Spanish. */
  phrases: Phrase[];
  /** How to read the respellings, in the reader's own spelling habits. */
  phoneticKey: string | null;
  after: string[];
  footer: string;
}

type PhraseId = "greetTie" | "greetEu" | "handOver" | "collectCard" | "certificateToday" | "repeat";

const SPANISH: Record<PhraseId, string> = {
  greetTie: "Buenos días, tengo cita para toma de huellas.",
  greetEu: "Buenos días, tengo cita para el certificado de registro de ciudadano de la Unión.",
  handOver: "Aquí tiene mi pasaporte y el justificante de la tasa.",
  collectCard: "¿Cuándo puedo recoger la tarjeta?",
  certificateToday: "¿Me dan el certificado hoy?",
  repeat: "Perdone, ¿puede repetirlo más despacio, por favor?",
};

/**
 * Respellings, per reading language — hand-written, never machine-translated:
 * a respelling only works in the spelling habits of its reader. Capitals mark
 * the stressed syllable.
 *
 * English keeps Castilian "th" for c/z before e/i, as heard at Barcelona
 * police counters. French, Italian and German have no letter for that sound,
 * so they use "s" (the seseo of Latin America and the Canaries, understood by
 * every officer). The jota is "kh" for French and Italian readers and "ch"
 * (as in "Bach") for German ones.
 */
const PHONETIC: Record<"en" | "fr" | "it" | "de", Record<PhraseId, string>> = {
  en: {
    greetTie: "BWEH-nohs DEE-ahs, TEHN-goh THEE-tah PAH-rah TOH-mah deh WEH-yahs",
    greetEu: "BWEH-nohs DEE-ahs, TEHN-goh THEE-tah PAH-rah el thehr-tee-fee-KAH-doh deh reh-HEES-troh deh thyoo-dah-DAH-noh deh lah oo-NYOHN",
    handOver: "ah-KEE TYEH-neh mee pah-sah-POHR-teh ee el hoos-tee-fee-KAHN-teh deh lah TAH-sah",
    collectCard: "KWAHN-doh PWEH-doh reh-koh-HEHR lah tar-HEH-tah",
    certificateToday: "meh dahn el thehr-tee-fee-KAH-doh oy",
    repeat: "pehr-DOH-neh, PWEH-deh reh-peh-TEER-loh mahs dehs-PAH-thyoh, pohr fah-BOHR",
  },
  fr: {
    greetTie: "BOUÉ-noss DI-ass, TÈN-go SSI-ta PA-ra TO-ma dé OUÉ-yass",
    greetEu: "BOUÉ-noss DI-ass, TÈN-go SSI-ta PA-ra èl ssèr-ti-fi-KA-do dé rré-KHISS-tro dé ssiou-da-DA-no dé la ou-NIONE",
    handOver: "a-KI TIÉ-né mi pa-ssa-POR-té i èl khouss-ti-fi-KANN-té dé la TA-ssa",
    collectCard: "KOUANN-do POUÉ-do rré-ko-KHÈR la tar-KHÉ-ta",
    certificateToday: "mé DANN èl ssèr-ti-fi-KA-do OÏ",
    repeat: "pèr-DO-né, POUÉ-dé rré-pé-TIR-lo MASS déss-PA-ssio, por fa-BOR",
  },
  it: {
    greetTie: "BUÈ-nos DÌ-as, TÈN-go SÌ-ta PA-ra TÒ-ma de UÈ-ias",
    greetEu: "BUÈ-nos DÌ-as, TÈN-go SÌ-ta PA-ra el ser-ti-fi-KÀ-do de re-KHÌS-tro de siu-da-DÀ-no de la u-NIÒN",
    handOver: "a-KÌ TIÈ-ne mi pa-sa-PÒR-te i el khus-ti-fi-KÀN-te de la TÀ-sa",
    collectCard: "KUÀN-do PUÈ-do re-ko-KHÈR la tar-KHÈ-ta",
    certificateToday: "me DÀN el ser-ti-fi-KÀ-do ÒI",
    repeat: "per-DÒ-ne, PUÈ-de re-pe-TÌR-lo MÀS des-PÀ-sio, por fa-BÒR",
  },
  de: {
    greetTie: "bu-E-nos DI-as, TEN-go SSI-ta PA-ra TO-ma de u-E-jas",
    greetEu: "bu-E-nos DI-as, TEN-go SSI-ta PA-ra el sser-ti-fi-KA-do de re-CHIS-tro de ssju-da-DA-no de la u-NJON",
    handOver: "a-KI TJE-ne mi pa-ssa-POR-te i el chus-ti-fi-KAN-te de la TA-ssa",
    collectCard: "KU-an-do pu-E-do re-ko-CHER la tar-CHE-ta",
    certificateToday: "me DAN el sser-ti-fi-KA-do OJ",
    repeat: "per-DO-ne, pu-E-de re-pe-TIR-lo MAS des-PA-ssjo, por fa-BOR",
  },
};

const PHONETIC_KEY: Record<keyof typeof PHONETIC, string> = {
  en: "Capitals mark the stressed syllable; “th” as in “think”.",
  fr: "Majuscules : syllabe accentuée. « kh » : un souffle rauque du fond de la gorge, comme le « ch » de « Bach ».",
  it: "Maiuscole: sillaba accentata. «kh»: una «h» aspirata e forte, come il «ch» tedesco di «Bach».",
  de: "Großbuchstaben: betonte Silbe. „ch“ immer wie in „Bach“.",
};

/**
 * The "guides" catalogue: next-intl's `t` and `t.raw`. Loosely typed so a
 * translator from createTranslator or useTranslations can be passed as it is.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GuidesText {
  (key: any, values?: any): string;
  raw: (key: any) => unknown;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const DATE_LOCALE: Record<string, string> = { en: "en-GB" };

export function appointmentSheetContent(
  input: {
    ref: string;
    formId: FormId;
    applicantName: string;
    scheduledAt: Date;
    officeName: string;
    officeAddress: string;
    nearestMetro: string | null;
    confirmationCode: string | null;
  },
  t: GuidesText,
  locale: string,
): AppointmentSheetContent {
  const tie = input.formId === "EX-17";
  const list = (key: string) =>
    (t.raw(`sheet.${key}`) as string[]).map((line) => line.replaceAll("{form}", input.formId));

  const phraseIds: PhraseId[] = tie
    ? ["greetTie", "handOver", "collectCard", "repeat"]
    : ["greetEu", "handOver", "certificateToday", "repeat"];
  // Spanish and Catalan readers already speak Spanish: no phrasebook for them.
  const speaksSpanish = locale === "es" || locale === "ca";
  const reading = (locale in PHONETIC ? locale : "en") as keyof typeof PHONETIC;
  const phrases: Phrase[] = speaksSpanish
    ? []
    : phraseIds.map((id) => ({
        spanish: SPANISH[id],
        phonetic: PHONETIC[reading][id],
        meaning: t(`sheet.meaning.${id}`),
      }));

  return {
    title: t("sheet.title"),
    purpose: t(tie ? "sheet.purposeTie" : "sheet.purposeEu"),
    labels: {
      when: t("sheet.when"),
      where: t("sheet.where"),
      arrive: t("sheet.arrive"),
      metro: t("sheet.metro"),
      bring: t("sheet.bring"),
      phrases: t("sheet.phrases"),
      after: t("sheet.after"),
    },
    when: formatMadrid(input.scheduledAt, DATE_LOCALE[locale] ?? locale),
    office: { name: input.officeName, address: input.officeAddress, metro: input.nearestMetro },
    confirmationCode: input.confirmationCode,
    checklist: list(tie ? "checklistTie" : "checklistEu"),
    phrases,
    phoneticKey: speaksSpanish ? null : PHONETIC_KEY[reading],
    after: list(tie ? "afterTie" : "afterEu"),
    footer: t("sheet.footer", { name: input.applicantName, ref: input.ref }),
  };
}
