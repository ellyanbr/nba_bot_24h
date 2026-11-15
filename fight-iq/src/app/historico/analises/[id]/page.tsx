import { notFound } from "next/navigation";
import { Bot, Swords, Trash2 } from "lucide-react";
import { deleteAnalysis } from "@/app/actions/analyses";
import { Markdown } from "@/components/analyzer/markdown";
import { MarketView } from "@/components/analyzer/market-view";
import { estimateOf } from "@/lib/analysis/prediction-stats";
import type { Estimate } from "@/lib/analysis/probability";
import { PRED_STATUS, ResolutionDetail } from "@/components/history/prediction-table";
import { Badge, Card, CardBody, CardHeader, DemoBadge, LinkButton, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import type { ComparisonResult } from "@/lib/analysis/comparison";
import { ANALYSIS_FACTORS } from "@/lib/domain/catalog";
import { getAnalysis } from "@/lib/services/queries";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAnalysis(id);
  if (!data) notFound();
  const { analysis: a, fighterA, fighterB, predictions, odds } = data;
  const nameA = fighterA?.name ?? "Atleta A";
  const nameB = fighterB?.name ?? "Atleta B";
  const edgeName = (e: string) => (e === "A" ? nameA : e === "B" ? nameB : e === "even" ? "Equilíbrio" : "Sem avaliação");
  const snapshot = a.dataSnapshot as ComparisonResult | null;

  const block = (title: string, body: string, tone: "red" | "blue" | "neutral") => (
    <div className={`rounded-lg border bg-ink-900 p-4 ${tone === "red" ? "border-blood-600/40" : tone === "blue" ? "border-blue-500/40" : "border-ink-700"}`}>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{title}</p>
      <p className="text-sm whitespace-pre-wrap text-ink-200">{body.trim() || <span className="text-ink-500">Não registrado.</span>}</p>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Análise registrada"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {a.title} <DemoBadge show={a.containsDemoData} />
          </span>
        }
        description={`Criada em ${formatDateTime(a.createdAt)}`}
        actions={
          <>
            <LinkButton href={`/analyzer?a=${a.fighterAId}&b=${a.fighterBId}${a.fightId ? `&luta=${a.fightId}` : ""}`} variant="secondary" size="sm">
              <Swords className="h-3.5 w-3.5" /> Nova análise deste confronto
            </LinkButton>
            <ActionButton action={deleteAnalysis.bind(null, a.id)} variant="danger" confirm="Excluir esta análise? Previsões vinculadas serão mantidas.">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </ActionButton>
          </>
        }
      />

      {a.containsDemoData && (
        <div className="mb-6">
          <Notice tone="warning" title="DEMONSTRAÇÃO">
            Esta análise utiliza dados fictícios.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Conclusão" />
            <CardBody className="space-y-3">
              <p className="text-sm whitespace-pre-wrap text-ink-100">{a.summary || "Sem conclusão registrada."}</p>
              <p className="text-sm text-ink-300">
                Mais caminhos para vencer: <strong className="text-white">{edgeName(a.morePaths)}</strong>
              </p>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {block(`Caminhos — ${nameA}`, a.pathsToVictoryA, "red")}
            {block(`Caminhos — ${nameB}`, a.pathsToVictoryB, "blue")}
            {block(`Argumentos — ${nameA}`, a.argumentsA, "red")}
            {block(`Argumentos — ${nameB}`, a.argumentsB, "blue")}
            {block(`Vulnerabilidades — ${nameA}`, a.vulnerabilitiesA, "red")}
            {block(`Vulnerabilidades — ${nameB}`, a.vulnerabilitiesB, "blue")}
          </div>

          <Card>
            <CardHeader title="Fatores" subtitle="Avaliação registrada e fatos disponíveis no momento da análise" />
            <CardBody className="p-0">
              <div className="divide-y divide-ink-700/60">
                {ANALYSIS_FACTORS.map((def) => {
                  const f = a.factors.find((x) => x.factorKey === def.key);
                  const facts = snapshot?.factors?.find((x) => x.key === def.key);
                  return (
                    <div key={def.key} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{def.label}</span>
                        <Badge tone={f?.edge === "A" ? "red" : f?.edge === "B" ? "blue" : "neutral"}>{edgeName(f?.edge ?? "unknown")}</Badge>
                        {f && f.edge !== "unknown" && <Badge tone={f.basis === "fato" ? "green" : "amber"}>{f.basis === "fato" ? "Fato" : "Interpretação"}</Badge>}
                        {facts?.insufficient && <Badge tone="amber">Dados insuficientes</Badge>}
                      </div>
                      {f?.notes && <p className="mt-1 text-sm text-ink-200">{f.notes}</p>}
                      {facts && facts.facts.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-ink-400">
                          {facts.facts.map((x, i) => (
                            <li key={i}>• {x}</li>
                          ))}
                        </ul>
                      )}
                      {(facts?.notes ?? []).length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-sky-200/70">
                          {(facts?.notes ?? []).map((x, i) => (
                            <li key={i}>ⓘ {x}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {(odds.length > 0 || predictions.some((p) => estimateOf(p))) && (
            <Card>
              <CardHeader
                title="Probabilidades e mercado"
                subtitle={odds.length ? `Odds registradas: ${odds.map((o) => `${o.bookmaker} (${formatDateTime(o.capturedAt)})`).join(" · ")}` : "Nenhuma odd registrada nesta análise"}
              />
              <CardBody>
                <MarketView
                  markets={odds.map((o) => ({ bookmaker: o.bookmaker, A: o.oddsA, B: o.oddsB, draw: o.oddsDraw }))}
                  estimate={(predictions.map(estimateOf).find((e) => e != null) as Estimate | undefined) ?? null}
                  names={{ A: nameA, B: nameB, draw: "Empate" }}
                />
              </CardBody>
            </Card>
          )}

          {a.aiOutput && (
            <Card>
              <CardHeader title="Análise por IA" subtitle={`${a.aiOutput.provider} / ${a.aiOutput.model} · ${formatDateTime(a.aiOutput.generatedAt)}`} icon={<Bot className="h-4 w-4" />} />
              <CardBody>
                <Markdown content={a.aiOutput.content} />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Previsões vinculadas" />
            <CardBody className="space-y-3">
              {predictions.length ? (
                predictions.map((p) => (
                  <div key={p.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{p.pickFighterId === a.fighterAId ? nameA : nameB}</span>
                      <Badge tone={PRED_STATUS[p.status].tone}>{PRED_STATUS[p.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">
                      {p.method}
                      {p.round ? ` · R${p.round}` : ""} ·{" "}
                      {estimateOf(p) ? `${nameA} ${p.probabilityA}% × ${nameB} ${p.probabilityB}%${p.probabilityDraw ? ` · empate ${p.probabilityDraw}%` : ""}` : `confiança ${p.confidence}% (registro antigo)`}
                    </p>
                    <div className="mt-1 text-xs">
                      <ResolutionDetail p={p} nameA={nameA} nameB={nameB} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-400">Nenhuma previsão registrada com esta análise.</p>
              )}
            </CardBody>
          </Card>
          {snapshot?.statRows && (
            <Card>
              <CardHeader title="Retrato dos dados" subtitle={`Estatísticas na data de referência ${formatDate(snapshot.referenceDate)}`} />
              <CardBody className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wider text-ink-400 uppercase">
                      <th className="px-4 py-2">Métrica</th>
                      <th className="px-2 py-2 text-right">A</th>
                      <th className="px-4 py-2 text-right">B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700/60">
                    {snapshot.statRows.map((r) => (
                      <tr key={r.key}>
                        <td className="px-4 py-1.5 text-ink-300">{r.short}</td>
                        <td className="tabular px-2 py-1.5 text-right text-white">{r.a ?? "—"}</td>
                        <td className="tabular px-4 py-1.5 text-right text-white">{r.b ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
