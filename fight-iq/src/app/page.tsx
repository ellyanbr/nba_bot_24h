import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, Swords, Target, Users } from "lucide-react";
import { RingGauge, Meter } from "@/components/charts";
import { EventCard } from "@/components/events/event-card";
import { FighterCard } from "@/components/fighters/fighter-card";
import { PredictionTable } from "@/components/history/prediction-table";
import { Badge, Card, CardBody, CardHeader, DemoBadge, EmptyState, LinkButton, Notice, StatTile } from "@/components/ui";
import { getAIStatus } from "@/lib/ai";
import { getDashboardData } from "@/lib/services/queries";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const d = await getDashboardData();
  const ai = getAIStatus();
  const s = d.predictionStats;

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-blood-600/25 blur-3xl" />
        <div className="pointer-events-none absolute right-6 bottom-0 hidden text-[120px] leading-none font-black tracking-tighter text-white/[0.03] select-none md:block">IQ</div>
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-blood-500 uppercase">MMA Analytics & Fight Intelligence</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Análise técnica de confrontos, <span className="text-blood-500">sem achismo.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-300">
            Compare atletas com dados de procedência identificada, avalie fator a fator, construa os dois lados do confronto e meça a calibração das suas previsões.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href="/analyzer">
              <Swords className="h-4 w-4" /> Abrir Fight Analyzer
            </LinkButton>
            <LinkButton href="/eventos" variant="secondary">
              Ver próximos eventos
            </LinkButton>
          </div>
        </div>
      </section>

      {d.hasDemo && (
        <div className="mb-6">
          <Notice tone="warning" title="Dados de DEMONSTRAÇÃO visíveis">
            Os atletas e eventos marcados com <DemoBadge /> são fictícios. Oculte-os ou remova-os em{" "}
            <Link href="/configuracoes" className="underline">
              Configurações
            </Link>{" "}
            e cadastre dados reais com fonte em Lutadores, Eventos ou Importar CSV.
          </Notice>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Lutadores" value={d.counts.fighters} icon={<Users className="h-4 w-4" />} />
        <StatTile label="Próximos eventos" value={d.counts.upcomingEvents} hint={`${d.counts.pastEvents} realizados`} icon={<CalendarDays className="h-4 w-4" />} />
        <StatTile label="Análises" value={d.counts.analyses} icon={<FileText className="h-4 w-4" />} />
        <StatTile label="Taxa de acerto" value={s.accuracy == null ? "—" : `${s.accuracy.toFixed(0)}%`} hint={`${s.resolved} previsão(ões) resolvida(s)`} icon={<Target className="h-4 w-4" />} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Próximos eventos"
              icon={<CalendarDays className="h-4 w-4" />}
              action={
                <Link href="/eventos" className="flex items-center gap-1 text-xs text-ink-300 hover:text-white">
                  Calendário <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <CardBody className="space-y-3">
              {d.upcoming.length ? d.upcoming.map((e) => <EventCard key={e.event.id} detail={e} />) : <EmptyState title="Nenhum evento agendado." action={<LinkButton href="/eventos/novo" size="sm">Criar evento</LinkButton>} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Lutadores em destaque"
              subtitle="Atletas em lutas principais e disputas de cinturão agendadas"
              icon={<Users className="h-4 w-4" />}
              action={
                <Link href="/lutadores" className="flex items-center gap-1 text-xs text-ink-300 hover:text-white">
                  Todos <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <CardBody>
              {d.featured.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {d.featured.map((f) => (
                    <FighterCard key={f.id} fighter={f} organization={f.organization} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum atleta cadastrado." action={<LinkButton href="/lutadores/novo" size="sm">Cadastrar atleta</LinkButton>} />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Resumo de previsões" icon={<Target className="h-4 w-4" />} />
            <CardBody>
              <div className="flex items-center gap-5">
                <RingGauge value={s.accuracy} label="acerto" />
                <dl className="flex-1 space-y-2 text-sm">
                  {[
                    ["Registradas", s.total],
                    ["Pendentes", s.pending],
                    ["Acertos", s.correct],
                    ["Erros", s.incorrect],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-ink-400">{k}</dt>
                      <dd className="tabular font-semibold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="mt-5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-ink-400">Prob. média atribuída ao escolhido</span>
                  <span className="tabular text-ink-200">{s.avgPickProbability == null ? "—" : `${s.avgPickProbability.toFixed(0)}%`}</span>
                </div>
                <Meter value={s.avgPickProbability} tone="neutral" />
              </div>
              <Link href="/historico" className="mt-4 flex items-center gap-1 text-xs text-blood-300 hover:underline">
                Ver histórico completo <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Últimas análises" icon={<FileText className="h-4 w-4" />} />
            <CardBody className="space-y-2">
              {d.latestAnalyses.length ? (
                d.latestAnalyses.map((a) => (
                  <Link key={a.id} href={`/historico/analises/${a.id}`} className="block rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 hover:border-blood-600/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{a.title}</span>
                      <DemoBadge show={a.containsDemoData} />
                    </div>
                    <span className="text-[11px] text-ink-400">{formatDateTime(a.createdAt)}</span>
                  </Link>
                ))
              ) : (
                <EmptyState title="Nenhuma análise ainda." action={<LinkButton href="/analyzer" size="sm">Criar a primeira</LinkButton>} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Motor de inteligência" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Comparação objetiva</span>
                <Badge tone="green">Ativa</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Questionamentos por regras</span>
                <Badge tone="green">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">Análise por IA</span>
                {ai.configured ? <Badge tone="green">{ai.label}</Badge> : <Badge tone="amber">Não configurada</Badge>}
              </div>
              {!ai.configured && (
                <p className="pt-1 text-xs text-ink-400">
                  O sistema funciona sem IA.{" "}
                  <Link href="/configuracoes" className="text-blood-300 hover:underline">
                    Como habilitar gratuitamente
                  </Link>
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {d.recentPredictions.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Previsões recentes" />
          <PredictionTable rows={d.recentPredictions} compact />
        </Card>
      )}
    </>
  );
}
