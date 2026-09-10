import type { AppointmentKind } from "@/lib/db/schema";

/**
 * Offices staff can pick when recording an appointment. Picking one only
 * PRE-FILLS the form: staff confirm (and can edit) the name, address and Metro,
 * and what they save is frozen onto the appointment.
 *
 * ⚠️ Only add an office after checking its address against a real booking
 * confirmation. A wrong address on the appointment-day sheet sends a student
 * across the city on the one morning they cannot be late. `nearestMetro` is
 * deliberately left empty where it has not been verified — staff fill it in.
 */
export interface OfficePreset {
  code: string;
  kind: AppointmentKind;
  name: string;
  address: string;
  nearestMetro?: string;
}

export const OFFICE_PRESETS: readonly OfficePreset[] = [
  {
    code: "cnp-rambla-guipuscoa",
    kind: "police",
    name: "Comisaría de Policía Nacional",
    address: "Rambla de Guipúscoa, 74, Barcelona",
  },
];

export function officePreset(code: string): OfficePreset | undefined {
  return OFFICE_PRESETS.find((o) => o.code === code);
}
