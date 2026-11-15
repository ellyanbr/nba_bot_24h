import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Swords, Trash2 } from "lucide-react";
import { deleteFighter, deleteFighterStat } from "@/app/actions/fighters";
import { FormStrip, Meter, MethodDonut } from "@/components/charts";
import { StatForm } from "@/components/fighters/stat-form";
import { Avatar, Badge, Card, CardBody, CardHeader, DemoBadge, EmptyState, LinkButton } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import { STAT_CATALOG } from "@/lib/domain/catalog";
import { getFighterProfile, listDataSources } from "@/lib/services/queries";
import { ageAt, daysBetween, formatDate, recordString } from "@/lib/utils";

export default async function FighterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getFighterProfile(id);
  if (!profile) notFound();
  const { fighter: f, organization, source, stats, history, completed, upcoming } = profile;
  const sources = await listDataSources();
  const age = ageAt(f.birthDate);
  const last = completed[0];
  const inactivity = last?.event ? daysBetween(last.event.date, new Date()) : null;

  const info: [string, string][] = [
    ["Organização", organization?.name ?? "—"],
    ["Categoria", f.weightClass ?? "—"],
    ["Idade", age != null ? `${age} anos` : "—"],
    ["Nascimento", formatDate(f.birthDate)],
    ["Nacionalidade", f.nationality ?? "—"],
    ["Altura", f.heightCm ? `${f.heightCm} cm` : "—"],
    ["Envergadura", f.reachCm ? `${f.reachCm} cm` : "—"],
    ["Base", f.stance ?? "—"],
    ["Equipe", f.team ?? "—"],
    ["Situação", f.active ? "Em atividade" : "Inativo"],
  ];

  return (
    <>
      {f.isDemo && (
        <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
          <strong className="text-amber-300">DEMONSTRAÇÃO:</strong> este atleta e todos os seus dados são fictícios.
        </div>
      )}

      <Card className="relative mb-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blood-600/15 to-transparent" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center">
          <Avatar name={f.name} size="lg" corner="red" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{f.name}</h1>
              <DemoBadge show={f.isDemo} />
            </div>
            {f.nickname && <p className="mt-0.5 text-sm text-blood-300">&ldquo;{f.nickname}&rdquo;</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {f.weightClass && <Badge tone="red">{f.weightClass}</Badge>}
              {organization && <Badge>{organization.name}</Badge>}
              {!f.active && <Badge tone="amber">Inativo</Badge>}
            </div>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-[10px] tracking-wider text-ink-400 uppercase">Cartel</p>
              <p className="tabular text-3xl font-black text-white">{recordString(f)}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider text-ink-400 uppercase">Inatividade</p>
              <p className="tabular text-3xl font-black text-white">{inactivity != null ? `${inactivity}d` : "—"}</p>
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2 border-t border-ink-700 px-6 py-3">
          <LinkButton href={`/analyzer?a=${f.id}`} size="sm">
            <Swords className="h-3.5 w-3.5" /> Analisar confronto
          </LinkButton>
          <LinkButton href={`/lutadores/${f.id}/editar`} size="sm" variant="secondary">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </LinkButton>
          <ActionButton action={deleteFighter.bind(null, f.id)} variant="danger" confirm={`Excluir ${f.name}? Esta ação não pode ser desfeita.`}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </ActionButton>
          <span className="ml-auto text-[11px] text-ink-400">
            Fonte: <span className="text-ink-200">{source?.name ?? "não informada"}</span> · Atualizado {formatDate(f.updatedAt)}
          </span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Dados do atleta" />
            <CardBody className="p-0">
              <dl className="divide-y divide-ink-700">
                {info.map(([k, v]) => (
                  <div key={k} className="flex justify-between px-5 py-2.5 text-sm">
                    <dt className="text-ink-400">{k}</dt>
                    <dd className="text-right font-medium text-ink-100">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Métodos de vitória" subtitle="Conforme cartel informado" />
            <CardBody>
              <MethodDonut ko={f.winsByKo} sub={f.winsBySub} dec={f.winsByDec} />
            </CardBody>
          </Card>
          {f.notes && (
            <Card>
              <CardHeader title="Observações" />
              <CardBody>
                <p className="text-sm whitespace-pre-wrap text-ink-200">{f.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Estatísticas" subtitle="Cada valor exibe sua fonte e data de atualização" />
            <CardBody>
              {stats.length ? (
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {STAT_CATALOG.map((def) => {
                    const s = stats.find((x) => x.statKey === def.key);
                    return (
                      <div key={def.key}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-ink-300" title={def.description}>
                            {def.label}
                          </span>
                          <span className="tabular text-sm font-bold text-white">{s ? `${s.value}${def.unit === "%" ? "%" : ""}` : "—"}</span>
                        </div>
                        {def.unit === "%" ? <div className="mt-1.5"><Meter value={s?.value ?? null} /></div> : null}
                        {s ? (
                          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-400">
                            <span>
                              {s.source?.name ?? "fonte não informada"} · {formatDate(s.asOf)}
                            </span>
                            <ActionButton action={deleteFighterStat.bind(null, s.id, f.id)} variant="ghost" className="px-1 py-0 text-[10px]" confirm="Remover esta estatística?">
                              remover
                            </ActionButton>
                          </div>
                        ) : (
                          <p className="mt-1 text-[10px] text-ink-500">Sem dado cadastrado</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Nenhuma estatística cadastrada." description="Adicione estatísticas abaixo, sempre com fonte e data." />
              )}
              <details className="mt-6 rounded-lg border border-ink-700 bg-ink-900 p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink-200">Adicionar / atualizar estatística</summary>
                <div className="mt-4">
                  <StatForm fighterId={f.id} sources={sources} isDemo={f.isDemo} />
                </div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Histórico de confrontos" subtitle="Lutas registradas no FIGHT IQ" action={<FormStrip outcomes={completed.slice(0, 5).map((h) => h.outcome)} />} />
            <CardBody className="p-0">
              {history.length ? (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-ink-700 text-left text-[10px] tracking-wider text-ink-400 uppercase">
                        <th className="px-5 py-2.5">Res.</th>
                        <th className="px-3 py-2.5">Adversário</th>
                        <th className="px-3 py-2.5">Método</th>
                        <th className="px-3 py-2.5">R / Tempo</th>
                        <th className="px-3 py-2.5">Evento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/60">
                      {history.map((h) => (
                        <tr key={h.fight.id} className="hover:bg-ink-800/60">
                          <td className="px-5 py-2.5">
                            <Badge tone={h.outcome === "V" ? "green" : h.outcome === "D" ? "red" : h.outcome === "Agendada" ? "blue" : "neutral"}>{h.outcome}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            {h.opponent ? (
                              <Link href={`/lutadores/${h.opponent.id}`} className="font-medium text-ink-100 hover:text-blood-300">
                                {h.opponent.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-ink-300">{h.result?.method ?? "—"}</td>
                          <td className="tabular px-3 py-2.5 text-ink-300">{h.result ? `R${h.result.round ?? "?"} · ${h.result.time ?? "—"}` : `${h.fight.scheduledRounds} rounds`}</td>
                          <td className="px-3 py-2.5">
                            {h.event ? (
                              <Link href={`/eventos/${h.event.id}`} className="text-ink-200 hover:text-blood-300">
                                {h.event.name}
                                <span className="block text-[11px] text-ink-400">{formatDate(h.event.date)}</span>
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="Nenhuma luta registrada." description="Adicione lutas pelos eventos ou importe um CSV de lutas." />
                </div>
              )}
            </CardBody>
          </Card>
          {upcoming.length > 0 && (
            <p className="text-xs text-ink-400">
              Próxima luta: {upcoming[0].opponent?.name} em {upcoming[0].event?.name} ({formatDate(upcoming[0].event?.date)}).
            </p>
          )}
        </div>
      </div>
    </>
  );
}
