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
 * Phonetics are for Castilian Spanish as heard at Barcelona police counters
 * ("c/z" before e/i as "th").
 */

export interface Phrase {
  spanish: string;
  phonetic: string;
  meaning: string;
}

export interface AppointmentSheetContent {
  title: string;
  purpose: string;
  when: { date: string; time: string };
  office: { name: string; address: string; metro: string | null };
  confirmationCode: string | null;
  checklist: string[];
  phrases: Phrase[];
  after: string[];
  footer: string;
}

const COMMON_PHRASES: Phrase[] = [
  {
    spanish: "Aquí tiene mi pasaporte y el justificante de la tasa.",
    phonetic: "ah-KEE TYEH-neh mee pah-sah-POHR-teh ee el hoos-tee-fee-KAHN-teh deh lah TAH-sah",
    meaning: "Here is my passport and the fee receipt.",
  },
  {
    spanish: "Perdone, ¿puede repetirlo más despacio, por favor?",
    phonetic: "pehr-DOH-neh, PWEH-deh reh-peh-TEER-loh mahs dehs-PAH-thyoh, pohr fah-BOHR",
    meaning: "Sorry, could you say that again more slowly, please?",
  },
];

export function appointmentSheetContent(input: {
  ref: string;
  formId: FormId;
  applicantName: string;
  scheduledAt: Date;
  officeName: string;
  officeAddress: string;
  nearestMetro: string | null;
  confirmationCode: string | null;
}): AppointmentSheetContent {
  const tie = input.formId === "EX-17";
  const form = input.formId;

  const checklist = tie
    ? [
        "Passport (original), plus a photocopy of the photo page and of your visa",
        `Your ${form}, printed and signed`,
        "One recent colour photo, 32 × 26 mm, white background (bring a spare)",
        "Modelo 790 Código 012, paid: the stamped copy or the ATM voucher stapled to it",
        "Your printed appointment confirmation (justificante de cita)",
      ]
    : [
        "Passport or national ID card (original), plus a photocopy",
        `Your ${form}, printed and signed`,
        "Modelo 790 Código 012, paid: the stamped copy or the ATM voucher stapled to it",
        "Your printed appointment confirmation (justificante de cita)",
        "Your Ready File documents: enrolment certificate, health insurance and declaration of means",
      ];

  const phrases: Phrase[] = [
    tie
      ? {
          spanish: "Buenos días, tengo cita para toma de huellas.",
          phonetic: "BWEH-nohs DEE-ahs, TEHN-goh THEE-tah PAH-rah TOH-mah deh WEH-yahs",
          meaning: "Good morning, I have an appointment for fingerprints.",
        }
      : {
          spanish: "Buenos días, tengo cita para el certificado de registro de ciudadano de la Unión.",
          phonetic: "BWEH-nohs DEE-ahs, TEHN-goh THEE-tah PAH-rah el thehr-tee-fee-KAH-doh deh reh-HEES-troh deh thyoo-dah-DAH-noh deh lah oo-NYOHN",
          meaning: "Good morning, I have an appointment for the EU registration certificate.",
        },
    COMMON_PHRASES[0]!,
    tie
      ? {
          spanish: "¿Cuándo puedo recoger la tarjeta?",
          phonetic: "KWAHN-doh PWEH-doh reh-koh-HEHR lah tar-HEH-tah",
          meaning: "When can I collect the card?",
        }
      : {
          spanish: "¿Me dan el certificado hoy?",
          phonetic: "meh dahn el thehr-tee-fee-KAH-doh oy",
          meaning: "Will I get the certificate today?",
        },
    COMMON_PHRASES[1]!,
  ];

  const after = tie
    ? [
        "You will be given a receipt (resguardo). Keep it: you need it to collect your card.",
        "Your card is collected later, in person. We will tell you when and where.",
      ]
    : [
        "The certificate is usually handed over at the appointment. Check every detail on it before you leave.",
        "Keep it with your passport: it proves your registration.",
      ];

  return {
    title: "Your appointment day",
    purpose: tie
      ? "Fingerprints for your TIE card (EX-17)"
      : "Your EU registration certificate (EX-18)",
    when: formatMadrid(input.scheduledAt),
    office: { name: input.officeName, address: input.officeAddress, metro: input.nearestMetro },
    confirmationCode: input.confirmationCode,
    checklist,
    phrases,
    after,
    footer:
      `${input.applicantName} · ${input.ref} · BCN Student Concierge — practical guidance, not legal ` +
      "advice. Requirements are set by the Policía Nacional and can change.",
  };
}
