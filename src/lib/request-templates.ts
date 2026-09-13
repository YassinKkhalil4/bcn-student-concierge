import type { IntakeData } from "@/lib/schema";

/**
 * Ready-to-send messages that students send to their residence or university.
 * Each comes in English or Spanish, chosen by the student — independent of the
 * site's language, because what matters is what the reader speaks: many of
 * Barcelona's business schools work only in English.
 *
 * Pure functions with no server dependencies, so the portal can rebuild them
 * live in the browser as the student fills in details.
 */

export const COLLECTIVE_AUTHORIZATION_URL =
  "https://www.bcn.cat/recursos/tramits/padro/Domicilicolectiu_cat.pdf";

type Person = Pick<IntakeData, "identity" | "address">;

export const REQUEST_LANGUAGES = ["en", "es"] as const;
export type RequestLanguage = (typeof REQUEST_LANGUAGES)[number];

export interface DraftEmail {
  subject: string;
  body: string;
}

/** "CHIDI EMMANUEL" → "Chidi Emmanuel" for greetings and signatures. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0]!.toLocaleUpperCase("es") + w.slice(1) : w))
    .join(" ");
}

function fullName({ identity }: Person): string {
  return [identity.givenName, identity.firstSurname, identity.secondSurname].filter(Boolean).join(" ");
}

function idLine({ identity }: Person, lang: RequestLanguage): string {
  const passport = `${lang === "es" ? "Pasaporte" : "Passport"} ${identity.passportNumber}`;
  return identity.nie ? `${passport} · NIE ${identity.nie}` : passport;
}

function addressLine({ address }: Person): string {
  return [
    `${address.streetName} ${address.buildingNumber}`,
    address.floorDoor,
    `${address.postalCode} ${address.city}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Academic year for a date. From August on it is the year about to start —
 * that is when students ask for the certificate, before term begins.
 */
export function academicYear(date = new Date()): string {
  const y = date.getFullYear();
  return date.getMonth() >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** Student residence → reception: ask for Barcelona's collective-home form. */
export function residenceRequest(person: Person, lang: RequestLanguage): DraftEmail {
  const name = fullName(person);
  const signature = titleCase(name);
  if (lang === "es") {
    return {
      subject: `Autorización de empadronamiento – ${name}`,
      body: [
        "Buenos días:",
        "",
        `Soy ${signature} y vivo en la residencia (${addressLine(person)}).`,
        "",
        "Para darme de alta en el Padrón Municipal de Barcelona necesito el impreso oficial del Ayuntamiento " +
          "«Autorització d'empadronament de domicili col·lectiu», firmado por la persona responsable de la " +
          "residencia y con el sello de la entidad. Está disponible aquí:",
        COLLECTIVE_AUTHORIZATION_URL,
        "",
        "Mis datos para completarlo:",
        `– Nombre y apellidos: ${name}`,
        `– Documento: ${idLine(person, lang)}`,
        `– Fecha de nacimiento: ${person.identity.birthDate}`,
        "",
        "¿Podrían prepararlo? Puedo pasar a recogerlo por recepción cuando les vaya bien.",
        "",
        "Muchas gracias y un saludo,",
        signature,
      ].join("\n"),
    };
  }
  return {
    subject: `Padrón registration authorisation – ${name}`,
    body: [
      "Hello,",
      "",
      `My name is ${signature} and I live in the residence (${addressLine(person)}).`,
      "",
      "To register on Barcelona's Padrón Municipal (city register) I need the City Council's official form " +
        "«Autorització d'empadronament de domicili col·lectiu», signed by the person in charge of the " +
        "residence and stamped with the residence's stamp. The form is available here:",
      COLLECTIVE_AUTHORIZATION_URL,
      "",
      "My details for the form:",
      `– Full name: ${name}`,
      `– Document: ${idLine(person, lang)}`,
      `– Date of birth: ${person.identity.birthDate}`,
      "",
      "Could you prepare it for me? I can collect it from reception whenever suits you.",
      "",
      "Many thanks and kind regards,",
      signature,
    ].join("\n"),
  };
}

/** Student → university registry: ask for a certificate usable at Extranjería. */
export function enrolmentRequest(
  person: Person,
  details: { university?: string; programme?: string; year?: string },
  lang: RequestLanguage,
): DraftEmail {
  const name = fullName(person);
  const signature = titleCase(name);
  const year = details.year?.trim() || academicYear();
  if (lang === "es") {
    const university = details.university?.trim() || "[universidad]";
    const programme = details.programme?.trim() || "[nombre del programa]";
    return {
      subject: `Certificado de matrícula para Extranjería – ${name}`,
      body: [
        "Estimado equipo de Admisiones:",
        "",
        `Soy ${signature}, estudiante de ${programme} en ${university} (${idLine(person, lang)}).`,
        "",
        "Para un trámite ante la Oficina de Extranjería y la Policía Nacional necesito un certificado de " +
          "matrícula oficial. Les agradecería que incluyera:",
        "– Mi nombre completo y número de pasaporte, tal como figuran en el pasaporte.",
        `– El nombre del programa y el curso académico ${year}.`,
        "– Las fechas de inicio y de finalización de los estudios.",
        "– Que los estudios son a tiempo completo, con las horas lectivas semanales o los créditos ECTS.",
        "– Membrete de la universidad, firma y sello.",
        "",
        "Si es posible, en castellano o en catalán y con fecha reciente.",
        "",
        "¿Podrían enviármelo en PDF firmado a este correo, o indicarme cuándo puedo recogerlo?",
        "",
        "Muchas gracias,",
        signature,
      ].join("\n"),
    };
  }
  const university = details.university?.trim() || "[university]";
  const programme = details.programme?.trim() || "[programme name]";
  return {
    subject: `Certificate of enrolment for the immigration office – ${name}`,
    body: [
      "Dear Admissions team,",
      "",
      `My name is ${signature} and I am a student on the ${programme} programme at ${university} ` +
        `(${idLine(person, lang)}).`,
      "",
      "For my residency application at the immigration office (Oficina de Extranjería) and the Policía " +
        "Nacional, I need an official certificate of enrolment (certificado de matrícula). Could it please include:",
      "– My full name and passport number, exactly as they appear in my passport.",
      `– The name of the programme and the academic year ${year}.`,
      "– The start and end dates of my studies.",
      "– That the studies are full-time, with the weekly teaching hours or the ECTS credits.",
      "– The university's letterhead, a signature and the official stamp.",
      "",
      "If possible, please issue it in Spanish or Catalan and with a recent date — the immigration office " +
        "may ask for an official translation of a certificate in English.",
      "",
      "Could you send it to this email address as a signed PDF, or let me know when I can collect it?",
      "",
      "Thank you very much,",
      signature,
    ].join("\n"),
  };
}

/**
 * Ways to start the email. A bare mailto: link does nothing for a student with
 * no desktop mail app set up — most use Gmail or Outlook in the browser — so
 * the webmail compose pages are offered alongside it. They are opened by the
 * student, in their own mail account, with the text they have just read.
 */
export function composeLinks({ to = "", subject, body }: DraftEmail & { to?: string }): {
  mailto: string;
  gmail: string;
  outlook: string;
} {
  const recipient = to.trim();
  const q = (params: Record<string, string>) =>
    Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  return {
    // "@" left readable: some mail apps do not decode it in the address part.
    mailto: `mailto:${encodeURIComponent(recipient).replace(/%40/g, "@")}?${q({ subject, body })}`,
    gmail: `https://mail.google.com/mail/?${q({ view: "cm", fs: "1", to: recipient, su: subject, body })}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?${q({ to: recipient, subject, body })}`,
  };
}
