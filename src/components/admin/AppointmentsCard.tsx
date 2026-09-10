import type { AppointmentRow } from "@/lib/db/schema";
import { OFFICE_PRESETS } from "@/lib/offices";
import { formatMadrid, utcToMadridLocal } from "@/lib/time";
import { removeAppointmentAction, saveAppointmentAction } from "@/app/admin/cases/[id]/actions";
import { AppointmentForm } from "./AppointmentForm";
import { Card } from "./ui";

const LABEL = { police: "Police (TIE / CUE)", padron: "Padrón" } as const;

export function AppointmentsCard({
  caseId,
  appointments,
  error,
}: {
  caseId: string;
  appointments: AppointmentRow[];
  error?: string;
}) {
  const police = appointments.find((a) => a.kind === "police");
  return (
    <Card title="Appointments">
      <div id="appointments" className="space-y-5">
        {error && <p role="alert" className="rounded bg-terracotta/5 px-2 py-1.5 text-xs text-terracotta">{error}</p>}
        {(["police", "padron"] as const).map((kind) => {
          const a = appointments.find((x) => x.kind === kind);
          return (
            <div key={kind} className="border-b border-bone-line pb-4 last:border-0 last:pb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{LABEL[kind]}</p>
              {a ? (
                <>
                  <p className="mt-1.5 text-sm font-medium text-ink">
                    {formatMadrid(a.scheduledAt).date} · {formatMadrid(a.scheduledAt).time}
                  </p>
                  <p className="text-xs text-ink-muted">{a.officeName}, {a.officeAddress}</p>
                  <p className="text-xs text-ink-muted">
                    Metro: {a.nearestMetro ?? <span className="text-amber-800">not recorded — add it for the sheet</span>}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-olive">Edit</summary>
                    <div className="mt-3">
                      <AppointmentForm caseId={caseId} kind={kind} presets={OFFICE_PRESETS} action={saveAppointmentAction}
                        defaults={{
                          officeCode: a.officeCode, officeName: a.officeName, officeAddress: a.officeAddress,
                          nearestMetro: a.nearestMetro ?? "", scheduledLocal: utcToMadridLocal(a.scheduledAt),
                          confirmationCode: a.confirmationCode ?? "",
                        }} />
                      <form action={removeAppointmentAction} className="mt-2">
                        <input type="hidden" name="caseId" value={caseId} />
                        <input type="hidden" name="kind" value={kind} />
                        <button type="submit" className="text-xs text-terracotta hover:underline">Remove appointment</button>
                      </form>
                    </div>
                  </details>
                </>
              ) : (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs font-medium text-olive">Record appointment</summary>
                  <div className="mt-3">
                    <AppointmentForm caseId={caseId} kind={kind} presets={OFFICE_PRESETS} action={saveAppointmentAction} />
                  </div>
                </details>
              )}
            </div>
          );
        })}
        {police && (
          <a href={`/api/admin/cases/${caseId}/appointment-sheet`} className="btn-secondary w-full !py-2 text-xs">
            Download appointment-day sheet
          </a>
        )}
      </div>
    </Card>
  );
}
