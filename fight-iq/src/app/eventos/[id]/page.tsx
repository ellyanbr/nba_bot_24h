import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Crown, Pencil, RotateCcw, Swords, Trash2 } from "lucide-react";
import { deleteEvent, deleteFight, setFightStatus } from "@/app/actions/events";
import { EVENT_STATUS } from "@/components/events/event-card";
import { AddFightForm, ResultForm } from "@/components/events/fight-forms";
import { Avatar, Badge, Card, CardBody, CardHeader, DemoBadge, EmptyState, LinkButton } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import { getStore } from "@/lib/data";
import { eventHasStarted } from "@/lib/domain/event-dates";
import { getEventDetail, listDataSources } from "@/lib/services/queries";
import { cn, formatDate, recordString } from "@/lib/utils";

const FIGHT_STATUS = {
  scheduled: { label: "Agendada", tone: "blue" },
  completed: { label: "Concluída", tone: "green" },
  cancelled: { label: "Cancelada", tone: "red" },
} as const;

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();
  const { event, organization, source, fights } = detail;
  const [allFighters, sources] = await Promise.all([getStore().list("fighters"), listDataSources()]);
  const eligible = allFighters.filter((f) => f.isDemo === event.isDemo).sort((a, b) => a.name.localeCompare(b.name));
  const resultSources = sources.filter((s) => s.isDemo === event.isDemo);
  const started = eventHasStarted(event.date);

  return (
    <>
      {event.isDemo && (
        <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
          <strong className="text-amber-300">DEMONSTRAÇÃO:</strong> evento, lutas e resultados fictícios.
        </div>
      )}
      <Card className="relative mb-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blood-600/20 blur-3xl" />
        <div className="relative p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={EVENT_STATUS[event.status].tone}>{EVENT_STATUS[event.status].label}</Badge>
            {organization && <Badge>{organization.name}</Badge>}
            <DemoBadge show={event.isDemo} />
          </div>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl">{event.name}</h1>
          <p className="mt-2 text-sm text-ink-300">
            {formatDate(event.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · {[event.venue, event.city, event.country].filter(Boolean).join(", ") || "Local não informado"}
          </p>
          <p className="mt-1 text-[11px] text-ink-400">
            Organização responsável: {organization?.name ?? "—"} · Fonte: {source?.name ?? "não informada"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={`/eventos/${event.id}/editar`} size="sm" variant="secondary">
              <Pencil className="h-3.5 w-3.5" /> Editar evento
            </LinkButton>
            <ActionButton action={deleteEvent.bind(null, event.id)} variant="danger" confirm={`Excluir o evento ${event.name}?`}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </ActionButton>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-ink-400 uppercase">Card de lutas ({fights.length})</h2>
          {fights.length === 0 && <EmptyState title="Nenhuma luta neste card." description="Adicione lutas no formulário ao lado." />}
          {fights.map(({ fight, red, blue, result }) => {
            if (!red || !blue) return null;
            const st = FIGHT_STATUS[fight.status];
            return (
              <Card key={fight.id} className={cn(fight.isMainEvent && "border-blood-600/40")}>
                <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-4 py-2.5">
                  <span className="text-[11px] font-semibold text-ink-400">#{fight.boutOrder}</span>
                  {fight.isMainEvent && <Badge tone="red">Luta principal</Badge>}
                  {fight.isTitleFight && (
                    <Badge tone="amber">
                      <Crown className="h-3 w-3" /> Cinturão
                    </Badge>
                  )}
                  <Badge>{fight.weightClass ?? "Categoria não informada"}</Badge>
                  <Badge>{fight.scheduledRounds} rounds</Badge>
                  <span className="ml-auto">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-4">
                  {[red, blue].map((f, idx) => {
                    const won = result?.winnerId === f.id;
                    const lost = result && result.winnerId && result.winnerId !== f.id;
                    return (
                      <Link
                        key={f.id}
                        href={`/lutadores/${f.id}`}
                        className={cn("flex items-center gap-3", idx === 1 && "order-3 flex-row-reverse text-right", lost && "opacity-55")}
                      >
                        <Avatar name={f.name} corner={idx === 0 ? "red" : "blue"} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white hover:text-blood-300">{f.name}</p>
                          <p className="tabular text-xs text-ink-400">{recordString(f)}</p>
                          {won && <span className="mt-0.5 inline-block text-[10px] font-bold tracking-wider text-emerald-300 uppercase">Vencedor</span>}
                        </div>
                      </Link>
                    );
                  })}
                  <div className="order-2 text-center">
                    <span className="text-xs font-black text-blood-500">VS</span>
                    {result && (
                      <p className="mt-1 text-[11px] whitespace-nowrap text-ink-300">
                        {result.method}
                        {result.round ? ` · R${result.round}` : ""}
                        {result.time ? ` ${result.time}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 px-4 py-2.5">
                  <LinkButton href={`/analyzer?a=${red.id}&b=${blue.id}&luta=${fight.id}`} size="sm">
                    <Swords className="h-3.5 w-3.5" /> Analisar
                  </LinkButton>
                  {fight.status !== "cancelled" && !result && (
                    <ActionButton action={setFightStatus.bind(null, fight.id, "cancelled")} confirm="Marcar luta como cancelada? As previsões pendentes desta luta serão anuladas.">
                      <Ban className="h-3.5 w-3.5" /> Cancelar luta
                    </ActionButton>
                  )}
                  {fight.status === "cancelled" && (
                    <ActionButton action={setFightStatus.bind(null, fight.id, "scheduled")}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reativar
                    </ActionButton>
                  )}
                  <ActionButton action={deleteFight.bind(null, fight.id)} variant="danger" confirm="Remover esta luta do card (e seu resultado)?">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </ActionButton>
                </div>
                {fight.status !== "cancelled" && !started && (
                  <p className="border-t border-ink-700 px-4 py-3 text-xs text-ink-400">
                    O resultado oficial poderá ser registrado a partir da data do evento ({formatDate(event.date)}).
                  </p>
                )}
                {fight.status !== "cancelled" && started && (
                  <details className="border-t border-ink-700 px-4 py-3">
                    <summary className="cursor-pointer text-xs font-medium text-ink-300 hover:text-white">{result ? "Editar resultado" : "Registrar resultado oficial"}</summary>
                    <div className="mt-3">
                      <ResultForm fightId={fight.id} red={red} blue={blue} sources={resultSources} existing={result} rounds={fight.scheduledRounds} />
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>

        <div>
          <Card className="xl:sticky xl:top-6">
            <CardHeader title="Adicionar luta" subtitle={event.isDemo ? "Somente atletas de DEMONSTRAÇÃO" : "Somente atletas reais (não demonstração)"} />
            <CardBody>
              {eligible.length >= 2 ? (
                <AddFightForm eventId={event.id} fighters={eligible} nextOrder={fights.length + 1} />
              ) : (
                <EmptyState title="Cadastre pelo menos dois atletas compatíveis." action={<LinkButton href="/lutadores/novo" size="sm">Cadastrar atleta</LinkButton>} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
