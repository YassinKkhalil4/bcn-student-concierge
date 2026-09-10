import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { generateToken } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { APPOINTMENT_KINDS, appointments, cases, type AppointmentRow } from "@/lib/db/schema";
import { madridLocalToUtc } from "@/lib/time";

/** Appointments staff book for a case — one police and one Padrón at most. */

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);

export const appointmentInputSchema = z.object({
  kind: z.enum(APPOINTMENT_KINDS),
  officeCode: z.string().trim().min(1).max(60),
  officeName: text(2, 120, "Office name"),
  officeAddress: text(5, 200, "Office address"),
  nearestMetro: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  /** From a datetime-local input: Barcelona wall-clock time. */
  scheduledLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time")
    .transform((v) => madridLocalToUtc(v)),
  confirmationCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || undefined),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

export async function listAppointments(caseId: string): Promise<AppointmentRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.caseId, caseId))
    .orderBy(asc(appointments.scheduledAt));
}

/**
 * Record or replace a case's appointment of one kind (a rebooked appointment
 * replaces the old one). Refused for an erased case: there is nobody left to
 * attend it, and no data should be re-attached to the tombstone.
 */
export async function saveAppointment(caseId: string, input: AppointmentInput): Promise<boolean> {
  const db = await getDb();
  const [open] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, caseId), isNull(cases.purgedAt)))
    .limit(1);
  if (!open) return false;

  const values = {
    officeCode: input.officeCode,
    officeName: input.officeName,
    officeAddress: input.officeAddress,
    nearestMetro: input.nearestMetro ?? null,
    scheduledAt: input.scheduledLocal,
    confirmationCode: input.confirmationCode ?? null,
    updatedAt: new Date(),
  };
  await db
    .insert(appointments)
    .values({ id: generateToken(), caseId, kind: input.kind, ...values })
    .onConflictDoUpdate({ target: [appointments.caseId, appointments.kind], set: values });
  return true;
}

export async function deleteAppointment(caseId: string, kind: AppointmentRow["kind"]): Promise<void> {
  const db = await getDb();
  await db.delete(appointments).where(and(eq(appointments.caseId, caseId), eq(appointments.kind, kind)));
}
