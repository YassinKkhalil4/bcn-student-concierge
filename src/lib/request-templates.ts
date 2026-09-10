import type { IntakeData } from "@/lib/schema";

/**
 * Ready-to-send Spanish messages that students send to Spanish institutions.
 * They stay in Spanish whatever language the site is shown in — the reader is
 * a residence receptionist or a university registry in Barcelona.
 *
 * Pure functions with no server dependencies, so the portal can rebuild them
 * live in the browser as the student fills in details.
 */

export const COLLECTIVE_AUTHORIZATION_URL =
  "https://www.bcn.cat/recursos/tramits/padro/Domicilicolectiu_cat.pdf";

type Person = Pick<IntakeData, "identity" | "address">;

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

function idLine({ identity }: Person): string {
  return identity.nie
    ? `Pasaporte ${identity.passportNumber} · NIE ${identity.nie}`
    : `Pasaporte ${identity.passportNumber}`;
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
export function residenceRequest(person: Person): { subject: string; body: string } {
  const name = fullName(person);
  return {
    subject: `Autorización de empadronamiento – ${name}`,
    body: [
      "Buenos días:",
      "",
      `Soy ${titleCase(name)} y vivo en la residencia (${addressLine(person)}).`,
      "",
      "Para darme de alta en el Padrón Municipal de Barcelona necesito el impreso oficial del Ayuntamiento " +
        "«Autorització d'empadronament de domicili col·lectiu», firmado por la persona responsable de la " +
        "residencia y con el sello de la entidad. Está disponible aquí:",
      COLLECTIVE_AUTHORIZATION_URL,
      "",
      "Mis datos para completarlo:",
      `– Nombre y apellidos: ${name}`,
      `– Documento: ${idLine(person)}`,
      `– Fecha de nacimiento: ${person.identity.birthDate}`,
      "",
      "¿Podrían prepararlo? Puedo pasar a recogerlo por recepción cuando les vaya bien.",
      "",
      "Muchas gracias y un saludo,",
      titleCase(name),
    ].join("\n"),
  };
}

/** Student → university registry: ask for a certificate usable at Extranjería. */
export function enrolmentRequest(
  person: Person,
  details: { university?: string; programme?: string; year?: string },
): { subject: string; body: string } {
  const name = fullName(person);
  const university = details.university?.trim() || "[universidad]";
  const programme = details.programme?.trim() || "[nombre del programa]";
  const year = details.year?.trim() || academicYear();
  return {
    subject: `Certificado de matrícula para Extranjería – ${name}`,
    body: [
      "Estimado equipo de Admisiones:",
      "",
      `Soy ${titleCase(name)}, estudiante de ${programme} en ${university} (${idLine(person)}).`,
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
      titleCase(name),
    ].join("\n"),
  };
}
