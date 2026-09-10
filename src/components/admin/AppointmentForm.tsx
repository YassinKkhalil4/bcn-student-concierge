"use client";

import { useState } from "react";
import type { AppointmentKind } from "@/lib/db/schema";
import type { OfficePreset } from "@/lib/offices";

export interface AppointmentDefaults {
  officeCode: string;
  officeName: string;
  officeAddress: string;
  nearestMetro: string;
  scheduledLocal: string;
  confirmationCode: string;
}

/**
 * Record or edit an appointment. Choosing a preset office fills the fields;
 * staff confirm or correct them, and what they save is frozen onto the
 * appointment — the student's sheet prints exactly this.
 */
export function AppointmentForm({
  caseId,
  kind,
  presets,
  defaults,
  action,
}: {
  caseId: string;
  kind: AppointmentKind;
  presets: readonly OfficePreset[];
  defaults?: AppointmentDefaults;
  action: (formData: FormData) => Promise<void>;
}) {
  const [v, setV] = useState<AppointmentDefaults>(
    defaults ?? { officeCode: "custom", officeName: "", officeAddress: "", nearestMetro: "", scheduledLocal: "", confirmationCode: "" },
  );
  const set = (k: keyof AppointmentDefaults) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  function choosePreset(code: string) {
    const p = presets.find((o) => o.code === code);
    setV((s) => ({
      ...s,
      officeCode: code,
      ...(p ? { officeName: p.name, officeAddress: p.address, nearestMetro: p.nearestMetro ?? "" } : {}),
    }));
  }

  const input = "field-input !mt-1 !py-1.5 text-sm";
  const kindPresets = presets.filter((p) => p.kind === kind);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="officeCode" value={v.officeCode} />
      {kindPresets.length > 0 && (
        <label className="block text-xs text-ink-soft">
          Office
          <select value={v.officeCode} onChange={(e) => choosePreset(e.target.value)} className={input}>
            <option value="custom">Other — type it below</option>
            {kindPresets.map((p) => <option key={p.code} value={p.code}>{p.name} · {p.address}</option>)}
          </select>
        </label>
      )}
      <label className="block text-xs text-ink-soft">
        Date and time (Barcelona)
        <input type="datetime-local" name="scheduledLocal" required value={v.scheduledLocal} onChange={set("scheduledLocal")} className={input} />
      </label>
      <label className="block text-xs text-ink-soft">
        Office name
        <input name="officeName" required value={v.officeName} onChange={set("officeName")} className={input} />
      </label>
      <label className="block text-xs text-ink-soft">
        Address
        <input name="officeAddress" required value={v.officeAddress} onChange={set("officeAddress")} className={input} />
      </label>
      <label className="block text-xs text-ink-soft">
        Nearest Metro <span className="text-ink-soft">(printed on the student&rsquo;s sheet)</span>
        <input name="nearestMetro" value={v.nearestMetro} onChange={set("nearestMetro")} placeholder="e.g. L2 · station name" className={input} />
      </label>
      <label className="block text-xs text-ink-soft">
        Justificante number
        <input name="confirmationCode" value={v.confirmationCode} onChange={set("confirmationCode")} className={input} />
      </label>
      <button type="submit" className="btn-primary w-full !py-2">Save appointment</button>
    </form>
  );
}
