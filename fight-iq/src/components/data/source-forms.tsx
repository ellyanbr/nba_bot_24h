"use client";

import { useActionState } from "react";
import { createDataSource, createOrganization } from "@/app/actions/settings";
import { Field } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import type { DataSource } from "@/lib/domain/types";
import { initialActionState } from "@/lib/utils/form";

/** Valor a reexibir após erro de validação (após sucesso, o formulário volta vazio). */
const keep = (state: { ok: boolean; values?: Record<string, string> }, k: string, d = "") => (state.ok || !state.values ? d : state.values[k] ?? d);

export function SourceForm() {
  const [state, action] = useActionState(createDataSource, initialActionState);
  const e = state.errors ?? {};
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-3">
      <Field label="Nome da fonte" required error={e.name}>
        <input name="name" defaultValue={keep(state, "name")} placeholder="Ex.: Site oficial da organização" className="field-input" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo" error={e.kind}>
          <select name="kind" className="field-input" defaultValue={keep(state, "kind", "official_site")}>
            <option value="official_site">Site oficial</option>
            <option value="manual">Levantamento manual</option>
            <option value="csv">Planilha / CSV</option>
            <option value="api">API</option>
            <option value="other">Outro</option>
          </select>
        </Field>
        <Field label="Consultado em" error={e.retrievedAt}>
          <input type="date" name="retrievedAt" defaultValue={keep(state, "retrievedAt")} className="field-input" />
        </Field>
      </div>
      <Field label="URL" error={e.url}>
        <input name="url" defaultValue={keep(state, "url")} placeholder="https://" className="field-input" />
      </Field>
      <Field label="Descrição" error={e.description}>
        <textarea name="description" defaultValue={keep(state, "description")} rows={2} className="field-input" />
      </Field>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Cadastrar fonte</SubmitButton>
      </div>
    </form>
  );
}

export function OrganizationForm({ sources }: { sources: DataSource[] }) {
  const [state, action] = useActionState(createOrganization, initialActionState);
  const e = state.errors ?? {};
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required error={e.name}>
          <input name="name" defaultValue={keep(state, "name")} className="field-input" />
        </Field>
        <Field label="Identificador (slug)" required error={e.slug}>
          <input name="slug" defaultValue={keep(state, "slug")} placeholder="ex.: pfl" className="field-input" />
        </Field>
        <Field label="País" error={e.country}>
          <input name="country" defaultValue={keep(state, "country")} className="field-input" />
        </Field>
        <Field label="Site" error={e.website}>
          <input name="website" defaultValue={keep(state, "website")} placeholder="https://" className="field-input" />
        </Field>
      </div>
      <Field label="Fonte" required error={e.sourceId}>
        <select name="sourceId" className="field-input" defaultValue={keep(state, "sourceId")}>
          <option value="">— Selecione —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Cadastrar organização</SubmitButton>
      </div>
    </form>
  );
}
