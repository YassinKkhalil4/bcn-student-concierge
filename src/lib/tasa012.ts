import type { IntakeData } from "@/lib/schema";
import type { FormId } from "@/lib/forms/field-map";
import { formatEur } from "@/lib/pricing";

/**
 * Modelo 790 Código 012 — the state fee paid before the police appointment.
 *
 * This form cannot be pre-filled by the PDF overlay: the Policía Nacional
 * portal generates it dynamically with a unique barcode (the justificante
 * number), and a copy without that barcode is worthless at the bank. So instead
 * of a PDF, this module produces a precise, copy-pasteable summary of exactly
 * what the student types into the portal.
 *
 * Field labels below are quoted verbatim from the live portal
 * (sede.policia.gob.es/Tasa790_012/ImpresoRellenar), checked 10 Sep 2026.
 */

export const TASA_012_PORTAL_URL = "https://sede.policia.gob.es/Tasa790_012/ImpresoRellenar";

interface Tramite {
  cents: number;
  /** The option the student ticks, quoted as the portal words it. */
  label: string;
}

/**
 * ⚠️ AMOUNTS ARE SET ANNUALLY by the Presupuestos Generales del Estado. These
 * are the figures the business provided; the portal shows the live amount on
 * mouse-over of the selected trámite and is authoritative. Update here — and
 * only here — when it changes.
 */
export const TASA_012_FEES: Record<FormId, Tramite> = {
  "EX-17": {
    cents: 1608,
    label:
      "TIE que documenta la primera concesión de la autorización de residencia " +
      "temporal, de estancia o para trabajadores transfronterizos",
  },
  "EX-18": {
    cents: 1200,
    label: "Certificado de registro de residente comunitario",
  },
};

export const TASA_012_PAYMENT_METHOD = "En efectivo";

export interface Tasa012Field {
  /** Portal label, verbatim. */
  label: string;
  /** Empty string = leave the portal field blank. */
  value: string;
  required: boolean;
  /** Set when staff must check the value before sending it to the student. */
  review?: string;
}

export interface Tasa012Summary {
  url: string;
  formId: FormId;
  tramite: string;
  feeCents: number;
  feeFormatted: string;
  paymentMethod: string;
  fields: Tasa012Field[];
  /** Blocking problems — do not send the summary until these are resolved. */
  warnings: string[];
  /** Plain-text instructions ready to paste into WhatsApp or email. */
  studentMessage: string;
}

/**
 * Street-type prefixes, Catalan and Spanish, mapped to the value in the
 * portal's "Tipo de vía" dropdown. Barcelona addresses arrive in Catalan
 * ("CARRER DE MALLORCA") but the dropdown lists Spanish types ("CALLE").
 * Longest prefixes first so "GRAN VIA" is not read as "VIA".
 */
const VIA_TYPES: readonly [RegExp, string][] = [
  [/^GRAN VIA\b/, "GRAN VIA"],
  [/^(CARRER|CALLE|C\/|C\.)\s*/, "CALLE"],
  [/^(AVINGUDA|AVENIDA|AVDA\.?|AV\.?)\s+/, "AVENIDA"],
  [/^(PASSEIG|PASEO|PG\.?|P\.º)\s+/, "PASEO"],
  [/^(PLAÇA|PLACA|PLAZA|PL\.?)\s+/, "PLAZA"],
  [/^(PASSATGE|PASAJE|PTGE\.?)\s+/, "PASAJE"],
  [/^(TRAVESSERA|TRAVESSIA|TRAVESIA|TRAVESÍA)\s+/, "TRAVESIA"],
  [/^RAMBLA\s+/, "RAMBLA"],
  [/^RONDA\s+/, "RONDA"],
  [/^(CAMÍ|CAMI|CAMINO)\s+/, "CAMINO"],
  [/^(CARRETERA|CTRA\.?)\s+/, "CARRETERA"],
  [/^VIA\s+/, "VIA"],
];

/** Leading connectors dropped from the street name: "DE MALLORCA" → "MALLORCA". */
const CONNECTOR = /^(DE LA|DE LES|DE LOS|DE LAS|DELS|DELS|DEL|DE|D'|D’)\s*/;

export function splitStreet(street: string): { type: string | null; name: string } {
  const s = street.trim().toUpperCase();
  for (const [pattern, type] of VIA_TYPES) {
    const match = s.match(pattern);
    if (match) {
      // "GRAN VIA" is itself the name on the portal; keep it whole.
      const rest = type === "GRAN VIA" ? s : s.slice(match[0].length);
      const name = type === "GRAN VIA" ? rest : rest.replace(CONNECTOR, "").trim();
      return { type, name: name || rest.trim() };
    }
  }
  return { type: null, name: s };
}

/** "3 2A" → piso 3, puerta 2A. Anything less regular goes whole into Piso, flagged. */
export function splitFloorDoor(floorDoor: string | undefined): {
  piso: string;
  puerta: string;
  irregular: boolean;
} {
  if (!floorDoor) return { piso: "", puerta: "", irregular: false };
  const parts = floorDoor.trim().split(/\s+/);
  if (parts.length === 1) return { piso: parts[0]!, puerta: "", irregular: false };
  if (parts.length === 2) return { piso: parts[0]!, puerta: parts[1]!, irregular: false };
  return { piso: floorDoor.trim(), puerta: "", irregular: true };
}

export function buildTasa012(intake: IntakeData, formId: FormId): Tasa012Summary {
  const { identity, address, contact } = intake;
  const tramite = TASA_012_FEES[formId];
  const street = splitStreet(address.streetName);
  const floor = splitFloorDoor(address.floorDoor);
  const warnings: string[] = [];

  // The portal requires an NIF/NIE and there is no passport alternative on the
  // form. Inventing one, or putting the passport number there, produces a
  // justificante that does not match the applicant at the police counter.
  if (!identity.nie) {
    warnings.push(
      formId === "EX-17"
        ? "No NIE on file. The portal requires one — it is printed on the student's " +
            "visa or resolution letter. Get it before sending these instructions."
        : // EU citizens have no visa, and many have no NIE until this very
          // registration assigns one. Don't guess a workaround on their behalf.
          "No NIE on file. EU citizens often have none before registering. Confirm " +
            "with the Oficina de Extranjería how this applicant should complete the " +
            "N.I.F./N.I.E. field before sending these instructions.",
    );
  }

  // "Apellidos y nombre": surnames first, as the label says.
  const fullName = [identity.firstSurname, identity.secondSurname, identity.givenName]
    .filter(Boolean)
    .join(" ");

  const fields: Tasa012Field[] = [
    { label: "N.I.F./N.I.E.", value: identity.nie ?? "", required: true },
    { label: "Apellidos y nombre o razón social", value: fullName, required: true },
    {
      label: "Tipo de vía",
      value: street.type ?? "",
      required: true,
      ...(street.type
        ? {}
        : { review: `Could not detect the street type in "${address.streetName}" — pick it from the portal list.` }),
    },
    { label: "Nombre de la vía pública", value: street.name, required: true },
    { label: "Núm.", value: address.buildingNumber, required: true },
    { label: "Escalera", value: "", required: false },
    {
      label: "Piso",
      value: floor.piso,
      required: false,
      ...(floor.irregular
        ? { review: `Floor/door "${address.floorDoor}" did not split cleanly into Piso and Puerta.` }
        : {}),
    },
    { label: "Puerta", value: floor.puerta, required: false },
    { label: "Teléfono", value: contact.phone, required: false },
    { label: "Municipio", value: address.city, required: true },
    { label: "Provincia", value: address.province, required: true },
    { label: "Código Postal", value: address.postalCode, required: true },
    { label: "Localidad", value: address.city, required: true },
  ];

  const feeFormatted = formatEur(tramite.cents);

  return {
    url: TASA_012_PORTAL_URL,
    formId,
    tramite: tramite.label,
    feeCents: tramite.cents,
    feeFormatted,
    paymentMethod: TASA_012_PAYMENT_METHOD,
    fields,
    warnings,
    studentMessage: buildStudentMessage(fields, tramite.label, feeFormatted),
  };
}

function buildStudentMessage(fields: Tasa012Field[], tramite: string, fee: string): string {
  const lines = fields
    .filter((f) => f.value)
    .map((f) => `  ${f.label}: ${f.value}`);

  return [
    "Modelo 790 Código 012 — how to generate and pay your police fee",
    "",
    `1. Open the official Policía Nacional form:`,
    `   ${TASA_012_PORTAL_URL}`,
    "",
    "2. In the identification section, type EXACTLY the following (leave any other box empty):",
    ...lines,
    "",
    "3. In the list of fees, tick ONLY this option:",
    `   "${tramite}"`,
    `   The amount shown should be ${fee}. If the portal shows a different amount, the portal is correct — pay what it shows and let us know.`,
    "",
    '4. Fecha: today\'s date.',
    "",
    `5. Under "Forma de pago", select "${TASA_012_PAYMENT_METHOD}" (cash).`,
    '   Do NOT choose "Adeudo en cuenta" — it needs a Spanish bank account and a digital certificate.',
    "",
    "6. Download the completed form and print it on paper at 100% scale. Do not resize it — the barcode must scan.",
    "",
    "7. Take the printout to a branch of CaixaBank, BBVA or Santander and pay in cash at the counter or at an ATM with a barcode reader. The bank will stamp it.",
    "",
    "8. Keep the stamped copy and bring it to your police appointment together with your EX form. An unpaid form will end the appointment.",
  ].join("\n");
}
