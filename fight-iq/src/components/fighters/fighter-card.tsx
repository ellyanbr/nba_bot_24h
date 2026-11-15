import Link from "next/link";
import { Avatar, Badge, DemoBadge } from "@/components/ui";
import type { Fighter, Organization } from "@/lib/domain/types";
import { ageAt, recordString } from "@/lib/utils";

export function FighterCard({ fighter, organization }: { fighter: Fighter; organization?: Organization | null }) {
  const age = ageAt(fighter.birthDate);
  return (
    <Link
      href={`/lutadores/${fighter.id}`}
      className="group flex flex-col rounded-xl border border-ink-700 bg-ink-850/80 p-4 transition hover:border-blood-600/50 hover:bg-ink-800"
    >
      <div className="flex items-start gap-3">
        <Avatar name={fighter.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white group-hover:text-blood-300">{fighter.name}</p>
          <p className="truncate text-xs text-ink-400">{fighter.nickname ? `"${fighter.nickname}"` : fighter.team ?? "—"}</p>
          {fighter.isDemo && (
            <div className="mt-1.5">
              <DemoBadge />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-wider text-ink-400 uppercase">Cartel</p>
          <p className="tabular text-lg font-bold whitespace-nowrap text-white">{recordString(fighter)}</p>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1 text-right">
          {fighter.weightClass && <Badge>{fighter.weightClass}</Badge>}
          <span className="text-[11px] text-ink-400">
            {[organization?.name, age != null ? `${age} anos` : null].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
    </Link>
  );
}
