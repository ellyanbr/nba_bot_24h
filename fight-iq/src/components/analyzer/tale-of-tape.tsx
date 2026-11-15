import Link from "next/link";
import { MirrorBar, FormStrip } from "@/components/charts";
import { Avatar, Card, CardBody, CardHeader, DemoBadge } from "@/components/ui";
import type { ComparisonResult } from "@/lib/analysis/comparison";
import type { FighterProfile } from "@/lib/services/queries";
import { cn, formatDate } from "@/lib/utils";

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-2 text-sm">
      <span className="tabular text-right font-semibold text-white">{a}</span>
      <span className="w-28 text-center text-[10px] tracking-wider text-ink-400 uppercase">{label}</span>
      <span className="tabular font-semibold text-white">{b}</span>
    </div>
  );
}

export function TaleOfTape({ A, B, comparison }: { A: FighterProfile; B: FighterProfile; comparison: ComparisonResult }) {
  const { a, b } = comparison.summary;
  const d = (v: number | null, u: string) => (v == null ? "—" : `${v}${u}`);
  const hasStats = comparison.statRows.some((r) => r.a != null || r.b != null);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="relative overflow-hidden lg:col-span-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-blood-600/15 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-blue-600/15 to-transparent" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-ink-700 p-5">
          {[A, B].map((p, i) => (
            <Link key={p.fighter.id} href={`/lutadores/${p.fighter.id}`} className={cn("flex items-center gap-3", i === 1 && "order-3 flex-row-reverse text-right")}>
              <Avatar name={p.fighter.name} corner={i === 0 ? "red" : "blue"} size="md" />
              <div className="min-w-0">
                <p className="truncate font-bold text-white hover:text-blood-300 sm:text-lg">{p.fighter.name}</p>
                <div className={cn("mt-1 flex items-center gap-2", i === 1 && "justify-end")}>
                  <FormStrip outcomes={p.completed.slice(0, 3).map((h) => h.outcome)} />
                  <DemoBadge show={p.fighter.isDemo} />
                </div>
              </div>
            </Link>
          ))}
          <span className="order-2 text-lg font-black text-blood-500">VS</span>
        </div>
        <CardBody className="relative divide-y divide-ink-700/70 py-2">
          <Row label="Cartel" a={a.record} b={b.record} />
          <Row label="Idade" a={d(a.age, " anos")} b={d(b.age, " anos")} />
          <Row label="Altura" a={d(a.heightCm, " cm")} b={d(b.heightCm, " cm")} />
          <Row label="Envergadura" a={d(a.reachCm, " cm")} b={d(b.reachCm, " cm")} />
          <Row label="Base" a={a.stance ?? "—"} b={b.stance ?? "—"} />
          <Row label="Categoria" a={a.weightClass ?? "—"} b={b.weightClass ?? "—"} />
          <Row label="Vit. KO / Fin." a={`${a.winsByKo ?? "—"} / ${a.winsBySub ?? "—"}`} b={`${b.winsByKo ?? "—"} / ${b.winsBySub ?? "—"}`} />
          <Row label="Última luta" a={a.lastFightDate ? formatDate(a.lastFightDate) : "sem registro"} b={b.lastFightDate ? formatDate(b.lastFightDate) : "sem registro"} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Estatísticas comparadas" subtitle={`Referência: ${formatDate(comparison.referenceDate)}`} />
        <CardBody className="divide-y divide-ink-700/60 py-2">
          {hasStats ? (
            comparison.statRows.map((r) => (
              <MirrorBar
                key={r.key}
                label={r.short}
                a={r.a}
                b={r.b}
                unit={r.unit}
                better={r.better}
                hint={`${r.label}${r.higherIsBetter ? "" : " (menor é melhor)"} — Fonte A: ${r.sourceA ?? "—"} (${formatDate(r.asOfA)}); Fonte B: ${r.sourceB ?? "—"} (${formatDate(r.asOfB)})`}
              />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-amber-200/80">Nenhuma estatística cadastrada para estes atletas. Dados insuficientes para comparação numérica.</p>
          )}
          {hasStats && <p className="pt-3 text-[10px] text-ink-400">Passe o cursor sobre cada métrica para ver fonte e data. SApM: menor é melhor.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
