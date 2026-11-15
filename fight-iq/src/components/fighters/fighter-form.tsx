"use client";

import { useActionState } from "react";
import { saveFighter } from "@/app/actions/fighters";
import { Card, CardBody, CardHeader, Field } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { WEIGHT_CLASSES, type DataSource, type Fighter, type Organization } from "@/lib/domain/types";
import { initialActionState } from "@/lib/utils/form";

export function FighterForm({ fighter, organizations, sources }: { fighter?: Fighter; organizations: Organization[]; sources: DataSource[] }) {
  const [state, action] = useActionState(saveFighter, initialActionState);
  const e = state.errors ?? {};
  const v = <K extends keyof Fighter>(k: K) => (state.values ? state.values[k as string] ?? "" : fighter?.[k] ?? "") as string | number;

  return (
    <form key={state.ts ?? 0} action={action} className="space-y-5">
      {fighter && <input type="hidden" name="id" value={fighter.id} />}
      <FormMessage state={state} />

      <Card>
        <CardHeader title="Identificação" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome" required error={e.name}>
            <input name="name" defaultValue={v("name")} className="field-input" />
          </Field>
          <Field label="Apelido" error={e.nickname}>
            <input name="nickname" defaultValue={v("nickname")} className="field-input" />
          </Field>
          <Field label="Organização" error={e.organizationId}>
            <select name="organizationId" defaultValue={v("organizationId")} className="field-input">
              <option value="">— Sem organização —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.isDemo ? " (DEMONSTRAÇÃO)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nacionalidade" error={e.nationality}>
            <input name="nationality" defaultValue={v("nationality")} className="field-input" />
          </Field>
          <Field label="Data de nascimento" error={e.birthDate}>
            <input type="date" name="birthDate" defaultValue={v("birthDate")} className="field-input" />
          </Field>
          <Field label="Equipe / academia" error={e.team}>
            <input name="team" defaultValue={v("team")} className="field-input" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Físico e estilo" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Categoria" error={e.weightClass}>
            <select name="weightClass" defaultValue={v("weightClass")} className="field-input">
              <option value="">—</option>
              {WEIGHT_CLASSES.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label="Altura (cm)" error={e.heightCm}>
            <input name="heightCm" inputMode="decimal" defaultValue={v("heightCm")} className="field-input" />
          </Field>
          <Field label="Envergadura (cm)" error={e.reachCm}>
            <input name="reachCm" inputMode="decimal" defaultValue={v("reachCm")} className="field-input" />
          </Field>
          <Field label="Base" error={e.stance}>
            <select name="stance" defaultValue={v("stance")} className="field-input">
              <option value="">—</option>
              {["Ortodoxo", "Canhoto", "Trocador de base", "Outro"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cartel profissional" subtitle="Informe exatamente como consta na fonte indicada abaixo." />
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {(
            [
              ["wins", "Vitórias"],
              ["losses", "Derrotas"],
              ["draws", "Empates"],
              ["noContests", "Sem resultado"],
              ["winsByKo", "Vit. KO/TKO"],
              ["winsBySub", "Vit. finalização"],
              ["winsByDec", "Vit. decisão"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} error={e[k]}>
              <input name={k} inputMode="numeric" defaultValue={v(k) === "" && ["wins", "losses", "draws", "noContests"].includes(k) ? 0 : v(k)} className="field-input tabular" />
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Procedência" subtitle="Obrigatório. Dados sem fonte não são aceitos." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fonte dos dados" required error={e.sourceId} hint="Cadastre novas fontes em Fontes de dados.">
            <select name="sourceId" defaultValue={v("sourceId")} className="field-input">
              <option value="">— Selecione —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-200">
            <input type="checkbox" name="active" defaultChecked={state.values ? state.values.active === "on" : fighter?.active ?? true} className="h-4 w-4 accent-blood-600" />
            Atleta em atividade
          </label>
          <Field label="Observações" className="sm:col-span-2" error={e.notes}>
            <textarea name="notes" rows={3} defaultValue={v("notes")} className="field-input" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{fighter ? "Salvar alterações" : "Cadastrar atleta"}</SubmitButton>
      </div>
    </form>
  );
}
