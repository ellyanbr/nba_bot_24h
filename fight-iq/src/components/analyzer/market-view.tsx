import { AlertTriangle, Info, Scale, TrendingUp } from "lucide-react";
import { analyzeMarket, marketFlags, valueFlags, valueTable, type Estimate, type Flag, type MarketOdds, type Side } from "@/lib/analysis/probability";
import { cn } from "@/lib/utils";

const fmtPct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)}%`);
const fmtOdds = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

function FlagList({ flags, empty }: { flags: Flag[]; empty: string }) {
  if (!flags.length) return <p className="text-sm text-ink-400">{empty}</p>;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2 rounded-md border px-3 py-2 text-sm",
            f.level === "alerta" ? "border-blood-600/50 bg-blood-600/10 text-blood-300" : f.level === "atencao" ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-ink-600 bg-ink-800 text-ink-200",
          )}
        >
          {f.level === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {f.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Leitura do mercado (margem, probabilidade sem margem) e do valor esperado.
 * Sem estimativa, mostra apenas o mercado. Componente sem estado: usado ao vivo no Analyzer
 * e na página da análise salva.
 */
export function MarketView({ markets, estimate, names }: { markets: MarketOdds[]; estimate: Estimate | null; names: Record<Side, string> }) {
  const analyses = markets.map((m) => ({ m, a: analyzeMarket(m) }));
  const hasDraw = markets.some((m) => m.draw != null);
  const rows = estimate ? valueTable(estimate, markets) : [];
  return (
    <div className="space-y-5">
      {markets.length > 0 && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[10px] tracking-wider text-ink-400 uppercase">
                <th className="px-3 py-2">Casa</th>
                <th className="px-3 py-2 text-right">{names.A}</th>
                <th className="px-3 py-2 text-right">{names.B}</th>
                {hasDraw && <th className="px-3 py-2 text-right">Empate</th>}
                <th className="px-3 py-2 text-right" title="Soma das probabilidades implícitas − 100">
                  Margem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/60">
              {analyses.map(({ m, a }, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium text-ink-100">{m.bookmaker || "—"}</td>
                  {(["A", "B", ...(hasDraw ? ["draw"] : [])] as Side[]).map((s) => (
                    <td key={s} className="tabular px-3 py-2 text-right">
                      <span className="text-white">{fmtOdds(m[s])}</span>
                      <span className="block text-[11px] text-ink-400">
                        impl. {fmtPct(a?.implied[s])} · s/ margem {fmtPct(a?.noVig[s])}
                      </span>
                    </td>
                  ))}
                  <td className={cn("tabular px-3 py-2 text-right", a && a.overround < 0 ? "text-blood-300" : "text-ink-200")}>{a ? `${a.overround.toFixed(1)}%` : "inválidas"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-400">
            Probabilidade implícita = 100 ÷ odds. Sem margem (método proporcional) = implícita ÷ soma das implícitas da mesma casa.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-300 uppercase">
            <TrendingUp className="h-3.5 w-3.5 text-blood-500" /> Valor esperado (sua estimativa × preço)
          </p>
          {!estimate ? (
            <p className="text-sm text-ink-400">Registre suas probabilidades para calcular o valor esperado.</p>
          ) : (
            <>
              <div className="mb-3 overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] tracking-wider text-ink-400 uppercase">
                      <th className="py-1.5 pr-2">Lado</th>
                      <th className="px-2 py-1.5 text-right">Sua prob.</th>
                      <th className="px-2 py-1.5 text-right">Odds justas</th>
                      <th className="px-2 py-1.5 text-right">Melhor odd</th>
                      <th className="px-2 py-1.5 text-right">VE</th>
                      <th className="py-1.5 pl-2 text-right">vs. mercado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700/60">
                    {rows.map((r) => (
                      <tr key={r.side}>
                        <td className="py-1.5 pr-2 text-ink-200">{names[r.side]}</td>
                        <td className="tabular px-2 py-1.5 text-right text-white">{fmtPct(r.estimate)}</td>
                        <td className="tabular px-2 py-1.5 text-right">{fmtOdds(r.fairOdds)}</td>
                        <td className="tabular px-2 py-1.5 text-right">{fmtOdds(r.bestOdds)}</td>
                        <td className={cn("tabular px-2 py-1.5 text-right font-semibold whitespace-nowrap", r.ev == null ? "" : r.ev > 0 ? "text-emerald-300" : "text-ink-300")}>
                          {r.ev == null ? "—" : `${r.ev > 0 ? "+" : ""}${(r.ev * 100).toFixed(1)}%`}
                        </td>
                        <td className="tabular py-1.5 pl-2 text-right whitespace-nowrap">{r.edge == null ? "—" : `${r.edge > 0 ? "+" : ""}${r.edge.toFixed(1)} p.p.`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <FlagList flags={markets.length ? valueFlags(rows, names) : []} empty="Registre odds de mercado para comparar com sua estimativa." />
            </>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-ink-300 uppercase">
            <Scale className="h-3.5 w-3.5 text-blood-500" /> Inconsistências de mercado (independem da sua opinião)
          </p>
          <FlagList flags={marketFlags(markets)} empty={markets.length ? "Nenhuma inconsistência nos preços registrados." : "Nenhuma odd registrada."} />
          {markets.length === 1 && <p className="mt-2 text-[11px] text-ink-400">Com uma única casa, só é possível verificar a margem. Registre mais casas para detectar divergência e arbitragem.</p>}
        </div>
      </div>
    </div>
  );
}
