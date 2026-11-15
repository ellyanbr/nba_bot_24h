import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listEvents, listOrganizations } from "@/lib/services/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Eventos" };

const TABS = [
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Realizados" },
  { key: "all", label: "Todos" },
] as const;

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const when = (TABS.find((t) => t.key === sp.quando)?.key ?? "upcoming") as (typeof TABS)[number]["key"];
  const [events, orgs] = await Promise.all([listEvents({ when, organizationId: sp.org }), listOrganizations()]);

  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ quando: when, org: sp.org, ...p }).forEach(([k, v]) => v && u.set(k, v));
    return `/eventos?${u}`;
  };

  // Agrupa por mês para visão de calendário
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Date(`${e.event.date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Calendário"
        title="Eventos"
        description="Cards completos, organização responsável e situação de cada luta."
        actions={
          <LinkButton href="/eventos/novo">
            <Plus className="h-4 w-4" /> Novo evento
          </LinkButton>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-ink-700 bg-ink-900 p-1">
          {TABS.map((t) => (
            <Link key={t.key} href={qs({ quando: t.key })} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition", when === t.key ? "bg-blood-600 text-white" : "text-ink-300 hover:text-white")}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ org: undefined })} className={cn("rounded-full border px-3 py-1 text-xs", !sp.org ? "border-blood-600/60 bg-blood-600/15 text-white" : "border-ink-600 text-ink-300 hover:text-white")}>
            Todas
          </Link>
          {orgs.map((o) => (
            <Link key={o.id} href={qs({ org: o.id })} className={cn("rounded-full border px-3 py-1 text-xs", sp.org === o.id ? "border-blood-600/60 bg-blood-600/15 text-white" : "border-ink-600 text-ink-300 hover:text-white")}>
              {o.name}
            </Link>
          ))}
        </div>
      </div>

      {events.length ? (
        <div className="space-y-8">
          {[...groups.entries()].map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-ink-400 uppercase">{month}</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {list.map((d) => (
                  <EventCard key={d.event.id} detail={d} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="Nenhum evento nesta visão."
          description="Crie um evento manualmente ou importe um CSV."
          action={
            <LinkButton href="/eventos/novo" size="sm">
              Criar evento
            </LinkButton>
          }
        />
      )}
    </>
  );
}
