"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { isValidCaseId, purgeCase, setStage } from "@/lib/server/storage";
import { APPOINTMENT_KINDS, STAGES, type AppointmentKind, type Stage } from "@/lib/db/schema";
import { appointmentInputSchema, deleteAppointment, saveAppointment } from "@/lib/server/appointments";

/**
 * Staff actions. Each re-checks the session: server actions are public HTTP
 * endpoints, and middleware alone is not trusted to guard them. Next.js also
 * rejects cross-origin action calls, and the SameSite=Strict cookie means a
 * forged cross-site request arrives unauthenticated anyway.
 */

function readId(formData: FormData): string {
  const id = String(formData.get("caseId") ?? "");
  if (!isValidCaseId(id)) throw new Error("Invalid case id");
  return id;
}

export async function changeStage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readId(formData);
  const stage = String(formData.get("stage") ?? "");
  if (!(STAGES as readonly string[]).includes(stage)) throw new Error("Invalid stage");

  await setStage(id, stage as Stage);
  console.info(`[admin] stage case=${id.slice(0, 8)} -> ${stage}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/cases/${id}`);
}

/** Immediate erasure — for GDPR Art. 17 requests, ahead of the 30-day job. */
export async function eraseNow(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readId(formData);
  if (formData.get("confirm") !== "yes") redirect(`/admin/cases/${id}?error=confirm#erase`);

  await purgeCase(id);
  console.info(`[admin] manual erasure case=${id.slice(0, 8)}`);
  revalidatePath("/admin");
  redirect(`/admin/cases/${id}`);
}

/** Record or rebook an appointment (police or Padrón) for a case. */
export async function saveAppointmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readId(formData);
  const parsed = appointmentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the appointment details";
    redirect(`/admin/cases/${id}?appointment_error=${encodeURIComponent(message)}#appointments`);
  }
  await saveAppointment(id, parsed.data);
  console.info(`[admin] appointment saved case=${id.slice(0, 8)} kind=${parsed.data.kind}`);
  revalidatePath(`/admin/cases/${id}`);
  redirect(`/admin/cases/${id}#appointments`);
}

export async function removeAppointmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = readId(formData);
  const kind = String(formData.get("kind") ?? "");
  if (!(APPOINTMENT_KINDS as readonly string[]).includes(kind)) throw new Error("Invalid kind");
  await deleteAppointment(id, kind as AppointmentKind);
  revalidatePath(`/admin/cases/${id}`);
  redirect(`/admin/cases/${id}#appointments`);
}
