import { getCase } from "@/lib/server/storage";
import { listAppointments } from "@/lib/server/appointments";
import { appointmentSheetContent } from "./appointment-content";
import { renderAppointmentSheet } from "./appointment-sheet";
import { titleCase } from "@/lib/request-templates";
import { translatorFor } from "@/i18n/messages";

/**
 * The appointment-day sheet for a case's POLICE appointment, or null when the
 * case has none yet (or has been erased). Shared by the student and staff
 * download routes so both always produce the identical document.
 */
export async function appointmentSheetForCase(
  caseId: string,
): Promise<{ bytes: Uint8Array; ref: string } | null> {
  const record = await getCase(caseId);
  if (!record?.intake) return null;
  const police = (await listAppointments(caseId)).find((a) => a.kind === "police");
  if (!police) return null;

  const { identity } = record.intake;
  // In the student's language, whoever downloads it: staff print it for them.
  const t = await translatorFor(record.locale, "guides");
  const content = appointmentSheetContent({
    ref: record.ref,
    formId: record.formId,
    applicantName: titleCase(
      [identity.givenName, identity.firstSurname, identity.secondSurname].filter(Boolean).join(" "),
    ),
    scheduledAt: police.scheduledAt,
    officeName: police.officeName,
    officeAddress: police.officeAddress,
    nearestMetro: police.nearestMetro,
    confirmationCode: police.confirmationCode,
  }, t, record.locale);
  return { bytes: await renderAppointmentSheet(content), ref: record.ref };
}
