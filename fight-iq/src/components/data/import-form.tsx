"use client";

import { useActionState, useState } from "react";
import { importCsv, type ImportState } from "@/app/actions/import";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { DataSource, Organization } from "@/lib/domain/types";

export function ImportForm({ organizations, sources }: { organizations: Organization[]; sources: DataSource[] }) {
  const [state, action] = useActionState<ImportState, FormData>(importCsv, { ok: false });
  const [kind, setKind] = useState("fighters");
  return (
    <form key={state.ts ?? 0} action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Tipo de dado" required>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field-input">
            <option value="fighters">Lutadores (+ estatísticas)</option>
            <option value="events">Eventos</option>
            <option value="fights">Lutas e resultados</option>
          </select>
        </Field>
        <Field label="Organização" required>
          <select name="organizationId" className="field-input" defaultValue={state.values?.organizationId ?? ""}>
            <option value="">— Selecione —</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fonte dos dados" required hint="Cadastre a fonte antes, em Fontes de dados.">
          <select name="sourceId" className="field-input" defaultValue={state.values?.sourceId ?? ""}>
            <option value="">— Selecione —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Arquivo CSV (UTF-8, separado por vírgula ou ponto e vírgula, até 2 MB)" required>
        <input type="file" name="file" accept=".csv,text/csv" className="field-input file:mr-3 file:rounded file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-ink-100" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <a href={`/api/csv-template?tipo=${kind}`} className="text-xs text-blood-300 hover:underline">
          Baixar modelo de CSV para este tipo
        </a>
        <SubmitButton pendingText="Importando…">Validar e importar</SubmitButton>
      </div>
      {state.message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-blood-600/50 bg-blood-600/10 text-blood-300"}`}>
          <p className="font-medium">{state.message}</p>
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 max-h-60 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.skipped && state.skipped.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-medium">Ignorados ({state.skipped.length}):</p>
          <ul className="mt-1 list-disc pl-5">
            {state.skipped.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
