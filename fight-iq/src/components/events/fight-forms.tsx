"use client";

import { useActionState, useState } from "react";
import { addFight, saveResult } from "@/app/actions/events";
import { Field } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { RESULT_METHODS, WEIGHT_CLASSES, type DataSource, type Fighter, type FightResult } from "@/lib/domain/types";
import { initialActionState } from "@/lib/utils/form";

export function AddFightForm({ eventId, fighters, nextOrder }: { eventId: string; fighters: Fighter[]; nextOrder: number }) {
  const [state, action] = useActionState(addFight, initialActionState);
  const e = state.errors ?? {};
  const fv = (k: string, d = "") => (state.ok || !state.values ? d : state.values[k] ?? d);
  const options = fighters.map((f) => (
    <option key={f.id} value={f.id}>
      {f.name} {f.weightClass ? `— ${f.weightClass}` : ""}
    </option>
  ));
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Córner vermelho" required error={e.redFighterId}>
          <select name="redFighterId" className="field-input" defaultValue={fv("redFighterId")}>
            <option value="">— Selecione —</option>
            {options}
          </select>
        </Field>
        <Field label="Córner azul" required error={e.blueFighterId}>
          <select name="blueFighterId" className="field-input" defaultValue={fv("blueFighterId")}>
            <option value="">— Selecione —</option>
            {options}
          </select>
        </Field>
        <Field label="Categoria" hint="Vazio = categoria do córner vermelho">
          <select name="weightClass" className="field-input" defaultValue={fv("weightClass")}>
            <option value="">—</option>
            {WEIGHT_CLASSES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rounds" error={e.scheduledRounds}>
            <select name="scheduledRounds" className="field-input" defaultValue={fv("scheduledRounds", "3")}>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </Field>
          <Field label="Ordem no card" error={e.boutOrder} hint="1 = luta principal">
            <input name="boutOrder" inputMode="numeric" defaultValue={fv("boutOrder", String(nextOrder))} className="field-input" />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-ink-200">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isMainEvent" defaultChecked={fv("isMainEvent") === "on"} className="h-4 w-4 accent-blood-600" /> Luta principal
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isTitleFight" defaultChecked={fv("isTitleFight") === "on"} className="h-4 w-4 accent-blood-600" /> Disputa de cinturão
        </label>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Adicionar luta</SubmitButton>
      </div>
    </form>
  );
}

export function ResultForm({
  fightId,
  red,
  blue,
  sources,
  existing,
  rounds,
}: {
  fightId: string;
  red: Fighter;
  blue: Fighter;
  sources: DataSource[];
  existing: FightResult | null;
  rounds: number;
}) {
  const [state, action] = useActionState(saveResult, initialActionState);
  const [method, setMethod] = useState<string>(existing?.method ?? "");
  const e = state.errors ?? {};
  const rv = (k: string, d: string) => (!state.ok && state.values ? state.values[k] ?? "" : d);
  const noWinner = method === "Empate" || method === "Sem resultado";
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-3">
      <input type="hidden" name="fightId" value={fightId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Método" required error={e.method}>
          <select name="method" value={method} onChange={(ev) => setMethod(ev.target.value)} className="field-input">
            <option value="">— Selecione —</option>
            {RESULT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Vencedor" required={!noWinner} error={e.winnerId}>
          <select name="winnerId" defaultValue={rv("winnerId", existing?.winnerId ?? "")} disabled={noWinner} className="field-input">
            <option value="">—</option>
            <option value={red.id}>{red.name}</option>
            <option value={blue.id}>{blue.name}</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Round" error={e.round}>
            <select name="round" defaultValue={rv("round", existing?.round != null ? String(existing.round) : "")} className="field-input">
              <option value="">—</option>
              {Array.from({ length: rounds }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </select>
          </Field>
          <Field label="Tempo" error={e.time}>
            <input name="time" placeholder="4:32" defaultValue={rv("time", existing?.time ?? "")} className="field-input" />
          </Field>
        </div>
        <Field label="Fonte do resultado" required error={e.sourceId} className="sm:col-span-2">
          <select name="sourceId" defaultValue={rv("sourceId", existing?.sourceId ?? "")} className="field-input">
            <option value="">— Selecione —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Detalhes" error={e.details}>
          <input name="details" defaultValue={rv("details", existing?.details ?? "")} className="field-input" placeholder="ex.: golpe, finalização" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton variant="secondary">{existing ? "Atualizar resultado" : "Registrar resultado"}</SubmitButton>
      </div>
    </form>
  );
}
