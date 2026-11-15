import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge, DemoBadge } from "@/components/ui";
import type { EventDetail } from "@/lib/services/queries";
import { daysBetween, formatDate, todayIso } from "@/lib/utils";

export const EVENT_STATUS: Record<string, { label: string; tone: "blue" | "green" | "red" }> = {
  scheduled: { label: "Agendado", tone: "blue" },
  completed: { label: "Concluído", tone: "green" },
  cancelled: { label: "Cancelado", tone: "red" },
};

export function EventCard({ detail, compact }: { detail: EventDetail; compact?: boolean }) {
  const { event, organization, fights } = detail;
  const main = fights.find((f) => f.fight.isMainEvent) ?? fights[0];
  const days = daysBetween(todayIso(), event.date);
  const d = new Date(`${event.date}T12:00:00Z`);
  return (
    <Link href={`/eventos/${event.id}`} className="group flex gap-4 rounded-xl border border-ink-700 bg-ink-850/80 p-4 transition hover:border-blood-600/50 hover:bg-ink-800">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-ink-600 bg-ink-900 py-2">
        <span className="text-[10px] font-semibold tracking-wider text-blood-400 uppercase">{d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "")}</span>
        <span className="tabular text-xl leading-tight font-black text-white">{d.getUTCDate()}</span>
        <span className="text-[10px] text-ink-400">{d.getUTCFullYear()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={EVENT_STATUS[event.status].tone}>{EVENT_STATUS[event.status].label}</Badge>
          {organization && <Badge>{organization.name}</Badge>}
          <DemoBadge show={event.isDemo} />
        </div>
        <p className="mt-1.5 truncate font-semibold text-white group-hover:text-blood-300">{event.name}</p>
        {main?.red && main.blue && (
          <p className="mt-0.5 truncate text-sm text-ink-300">
            {main.red.name} <span className="text-blood-500">vs</span> {main.blue.name}
          </p>
        )}
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            <span className="flex min-w-0 max-w-full items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{[event.venue, event.city, event.country].filter(Boolean).join(", ") || "Local não informado"}</span>
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(event.date)} {event.status === "scheduled" && days >= 0 ? `· em ${days} dia(s)` : ""}
            </span>
            <span>{fights.length} luta(s)</span>
          </div>
        )}
      </div>
    </Link>
  );
}
