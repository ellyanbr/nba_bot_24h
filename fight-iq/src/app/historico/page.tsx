import Link from "next/link";
import { Bot, FileText, Target } from "lucide-react";
import { Meter } from "@/components/charts";
import { PredictionTable } from "@/components/history/prediction-table";
import { Badge, Card, CardBody, CardHeader, DemoBadge, EmptyState, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { computePredictionStats, listAnalyses, listPredictions } from "@/lib/services/queries";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Histórico" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.aba === "analises" ? "analises" : "previsoes";
  const [analyses, predictions] = await Promise.all([listAnalyses(), listPredictions()]);
  const stats = computePredictionStats(predictions);

  return (
    <>
      <PageHeader eyebrow="Desempenho" title="Histórico" description="Análises realizadas, previsões registradas e comparação com os resultados reais." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Análises" value={analyses.length} icon={<FileText className="h-4 w-4" />} />
        <StatTile label="Previsões" value={stats.total} hint={`${stats.pending} pendente(s)`} icon={<Target className="h-4 w-4" />} />
        <StatTile label="Taxa de acerto" value={stats.accuracy == null ? "—" : `${stats.accuracy.toFixed(0)}%`} hint={`Previsão completa · ${stats.correct}/${stats.resolved}${stats.manualResolved ? ` (${stats.manualResolved} manual)` : ""}`} accent />
        <StatTile label="Acerto do vencedor" value={stats.winnerAccuracy == null ? "—" : `${stats.winnerAccuracy.toFixed(0)}%`} hint={`${stats.winnerGraded} corrigida(s) por resultado oficial`} />
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Calibração"
          subtitle="Probabilidade que você atribuiu ao escolhido × frequência com que ele venceu. Bem calibrado = as duas próximas."
        />
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Brier score</p>
              <p className="tabular mt-1 text-2xl font-bold text-white">{stats.brier == null ? "—" : stats.brier.toFixed(3)}</p>
              <p className="text-xs text-ink-400">0 = perfeito · prever sempre 50/50 = 0,500 · {stats.scored} previsão(ões)</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Log loss</p>
              <p className="tabular mt-1 text-2xl font-bold text-white">{stats.logLoss == null ? "—" : stats.logLoss.toFixed(3)}</p>
              <p className="text-xs text-ink-400">Menor é melhor · 50/50 = 0,693 · pune certezas erradas</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Prob. média do escolhido</p>
              <p className="tabular mt-1 text-2xl font-bold text-white">{stats.avgPickProbability == null ? "—" : `${stats.avgPickProbability.toFixed(0)}%`}</p>
              <p className="text-xs text-ink-400">Compare com o acerto do vencedor</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {stats.buckets.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-300">Atribuído {b.label}</span>
                  <span className="tabular font-semibold text-white">{b.observed == null ? "—" : `${b.observed.toFixed(0)}%`}</span>
                </div>
                <div className="mt-1.5">
                  <Meter value={b.observed} />
                </div>
                <p className="mt-1 text-[10px] text-ink-400">
                  {b.total ? `venceu ${b.hits}/${b.total} · média atribuída ${b.expected!.toFixed(0)}%` : "sem previsões resolvidas"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-400">
            Brier e log loss usam apenas previsões com probabilidades registradas e corrigidas por resultado oficial.
            {stats.legacyCount > 0 && ` ${stats.legacyCount} previsão(ões) antiga(s), sem probabilidades, entram na calibração pelo antigo campo de confiança.`}
          </p>
        </CardBody>
      </Card>

      <div className="mb-4 flex rounded-lg border border-ink-700 bg-ink-900 p-1 sm:w-fit">
        {[
          ["previsoes", `Previsões (${predictions.length})`],
          ["analises", `Análises (${analyses.length})`],
        ].map(([k, label]) => (
          <Link key={k} href={`/historico?aba=${k}`} className={cn("flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium whitespace-nowrap", tab === k ? "bg-blood-600 text-white" : "text-ink-300 hover:text-white")}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "previsoes" ? (
        <Card>
          {predictions.length ? (
            <PredictionTable rows={predictions} />
          ) : (
            <CardBody>
              <EmptyState title="Nenhuma previsão registrada." description="Registre previsões ao salvar uma análise no Fight Analyzer." action={<LinkButton href="/analyzer" size="sm">Abrir Fight Analyzer</LinkButton>} />
            </CardBody>
          )}
          <p className="border-t border-ink-700 px-4 py-2.5 text-[11px] text-ink-400">
            Previsões vinculadas a uma luta são resolvidas automaticamente quando o resultado é registrado no evento. As demais podem ser resolvidas manualmente.
          </p>
        </Card>
      ) : analyses.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {analyses.map((a) => (
            <Link key={a.id} href={`/historico/analises/${a.id}`} className="rounded-xl border border-ink-700 bg-ink-850/80 p-4 transition hover:border-blood-600/50">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">{a.title}</p>
                <div className="flex gap-1">
                  {a.aiOutput && (
                    <Badge tone="blue">
                      <Bot className="h-3 w-3" /> IA
                    </Badge>
                  )}
                  <DemoBadge show={a.containsDemoData} />
                </div>
              </div>
              <p className="mt-1 text-xs text-ink-400">{formatDateTime(a.createdAt)}</p>
              <p className="mt-2 line-clamp-2 text-sm text-ink-300">{a.summary || "Sem conclusão registrada."}</p>
              <p className="mt-2 text-[11px] text-ink-400">
                Mais caminhos: <span className="text-ink-200">{a.morePaths === "A" ? a.fighterA?.name : a.morePaths === "B" ? a.fighterB?.name : a.morePaths === "even" ? "Equilibrado" : "não definido"}</span> · {a.factors.filter((f) => f.edge !== "unknown").length}/{a.factors.length} fatores avaliados
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma análise salva." action={<LinkButton href="/analyzer" size="sm">Criar análise</LinkButton>} />
      )}
    </>
  );
}
