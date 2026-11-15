"use client";

import { useActionState } from "react";
import { saveEvent } from "@/app/actions/events";
import { Card, CardBody, Field } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import type { DataSource, FightEvent, Organization } from "@/lib/domain/types";
import { initialActionState } from "@/lib/utils/form";

export function EventForm({ event, organizations, sources }: { event?: FightEvent; organizations: Organization[]; sources: DataSource[] }) {
  const [state, action] = useActionState(saveEvent, initialActionState);
  const e = state.errors ?? {};
  const ev = (k: keyof FightEvent) => (state.values ? state.values[k] ?? "" : (event?.[k] as string | null | undefined) ?? "");
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-5">
      {event && <input type="hidden" name="id" value={event.id} />}
      <FormMessage state={state} />
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do evento" required error={e.name} className="sm:col-span-2">
            <input name="name" defaultValue={ev("name") || ""} className="field-input" />
          </Field>
          <Field label="Organização responsável" required error={e.organizationId}>
            <select name="organizationId" defaultValue={ev("organizationId") || ""} className="field-input">
              <option value="">— Selecione —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.isDemo ? " (DEMONSTRAÇÃO)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data" required error={e.date}>
            <input type="date" name="date" defaultValue={ev("date") || ""} className="field-input" />
          </Field>
          <Field label="Local (arena)" error={e.venue}>
            <input name="venue" defaultValue={ev("venue") || ""} className="field-input" />
          </Field>
          <Field label="Cidade" error={e.city}>
            <input name="city" defaultValue={ev("city") || ""} className="field-input" />
          </Field>
          <Field label="País" error={e.country}>
            <input name="country" defaultValue={ev("country") || ""} className="field-input" />
          </Field>
          <Field label="Situação" error={e.status}>
            <select name="status" defaultValue={ev("status") || "scheduled"} className="field-input">
              <option value="scheduled">Agendado</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </Field>
          <Field label="Fonte dos dados" required error={e.sourceId} className="sm:col-span-2">
            <select name="sourceId" defaultValue={ev("sourceId") || ""} className="field-input">
              <option value="">— Selecione —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </CardBody>
      </Card>
      <div className="flex justify-end">
        <SubmitButton>{event ? "Salvar alterações" : "Criar evento"}</SubmitButton>
      </div>
    </form>
  );
}
