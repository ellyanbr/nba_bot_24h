"use client";

import { useActionState } from "react";
import { saveFighterStat } from "@/app/actions/fighters";
import { Field } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { STAT_CATALOG } from "@/lib/domain/catalog";
import type { DataSource } from "@/lib/domain/types";
import { initialActionState } from "@/lib/utils/form";

export function StatForm({ fighterId, sources, isDemo }: { fighterId: string; sources: DataSource[]; isDemo: boolean }) {
  const [state, action] = useActionState(saveFighterStat, initialActionState);
  const e = state.errors ?? {};
  const sv = (k: string) => (state.ok ? "" : state.values?.[k] ?? "");
  const compatible = sources.filter((s) => s.isDemo === isDemo);
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-3">
      <input type="hidden" name="fighterId" value={fighterId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Estatística" error={e.statKey}>
          <select name="statKey" defaultValue={sv("statKey")} className="field-input">
            {STAT_CATALOG.map((s) => (
              <option key={s.key} value={s.key}>
                {s.short} — {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor" error={e.value}>
          <input name="value" defaultValue={sv("value")} inputMode="decimal" className="field-input tabular" placeholder="ex.: 4.5 ou 56" />
        </Field>
        <Field label="Atualizado em" required error={e.asOf}>
          <input type="date" name="asOf" defaultValue={sv("asOf")} className="field-input" />
        </Field>
        <Field label="Fonte" required error={e.sourceId}>
          <select name="sourceId" defaultValue={sv("sourceId")} className="field-input">
            <option value="">— Selecione —</option>
            {compatible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton variant="secondary">Salvar estatística</SubmitButton>
      </div>
    </form>
  );
}
