import Link from "next/link";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { deletePrediction, resolvePrediction } from "@/app/actions/predictions";
import { Badge, DemoBadge } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import type { Prediction } from "@/lib/domain/types";
import type { PredictionRow } from "@/lib/services/queries";
import { VOID_REASON_LABEL } from "@/lib/analysis/grading";
import { expectedValue } from "@/lib/analysis/probability";
import { estimateOf, pickProbability } from "@/lib/analysis/prediction-stats";
import { formatDate } from "@/lib/utils";

export const BET_STATUS: Record<string, string> = { open: "aberta", won: "ganha", lost: "perdida", void: "devolvida" };

export const PRED_STATUS = {
  pending: { label: "Pendente", tone: "blue" },
  correct: { label: "Acertou", tone: "green" },
  incorrect: { label: "Errou", tone: "red" },
  void: { label: "Anulada", tone: "neutral" },
} as const;

function Mark({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value == null) return null;
  return (
    <span className={value ? "text-emerald-300" : "text-blood-300"}>
      {label} {value ? "✓" : "✗"}
    </span>
  );
}

/** Resultado real + detalhe da correção. Nunca exibe resultado que não foi registrado oficialmente. */
export function ResolutionDetail({ p, nameA, nameB }: { p: Prediction; nameA: string; nameB: string }) {
  if (p.status === "pending") return <span className="text-ink-400">Aguardando resultado</span>;
  if (p.resolution === "manual") {
    return <span className="text-ink-400">{p.status === "void" ? "Anulada manualmente — " : "Marcação manual — "}sem resultado oficial registrado</span>;
  }
  if (p.status === "void" && !p.actualMethod) {
    return <span className="text-ink-400">Anulada{p.voidReason ? ` — ${VOID_REASON_LABEL[p.voidReason]}` : ""} · não conta como acerto nem erro</span>;
  }
  const winner = p.actualWinnerId === p.fighterAId ? nameA : p.actualWinnerId === p.fighterBId ? nameB : "Sem vencedor";
  return (
    <span>
      {p.status === "void" && (
        <span className="block text-[11px] text-ink-400">
          Anulada{p.voidReason ? ` — ${VOID_REASON_LABEL[p.voidReason]}` : ""} · não conta como acerto nem erro
        </span>
      )}
      <span className="text-ink-200">
        {winner}
        {p.actualMethod ? ` · ${p.actualMethod}` : ""}
        {p.actualRound ? ` · R${p.actualRound}` : ""}
      </span>
      <span className="mt-0.5 flex gap-2 text-[11px]">
        <Mark label="vencedor" value={p.winnerCorrect} />
        <Mark label="método" value={p.methodCorrect} />
        <Mark label="round" value={p.roundCorrect} />
      </span>
    </span>
  );
}

export function PredictionTable({ rows, compact }: { rows: PredictionRow[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-ink-700 text-left text-[10px] tracking-wider text-ink-400 uppercase">
            <th className="px-4 py-2.5">Confronto</th>
            <th className="px-3 py-2.5">Escolha</th>
            <th className="px-3 py-2.5">Probabilidade</th>
            {!compact && <th className="px-3 py-2.5">Aposta registrada</th>}
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Resultado real</th>
            {!compact && <th className="px-3 py-2.5 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/60">
          {rows.map((p) => {
            const bet = p.bets[0];
            const legacy = estimateOf(p) == null;
            const pickProb = pickProbability(p);
            // Valor esperado da aposta (no vencedor) pela probabilidade atribuída ao escolhido.
            const ev = bet && !legacy ? expectedValue(pickProb, bet.decimalOdds) : null;
            return (
              <tr key={p.id} className="hover:bg-ink-800/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-100">
                      {p.fighterA?.name ?? "?"} <span className="text-blood-500">×</span> {p.fighterB?.name ?? "?"}
                    </span>
                    <DemoBadge show={p.containsDemoData} />
                  </div>
                  <span className="text-[11px] text-ink-400">
                    {formatDate(p.createdAt)}
                    {p.analysis && (
                      <>
                        {" · "}
                        <Link href={`/historico/analises/${p.analysis.id}`} className="text-blood-300 hover:underline">
                          ver análise
                        </Link>
                      </>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-semibold text-white">{p.pick?.name}</span>
                  <span className="block text-[11px] text-ink-400">
                    {p.method}
                    {p.round ? ` · R${p.round}` : ""}
                  </span>
                </td>
                <td className="tabular px-3 py-2.5">
                  {legacy ? (
                    <span className="text-ink-300" title="Previsão anterior ao sistema de probabilidades">
                      confiança {p.confidence}% <span className="block text-[11px] text-ink-500">registro antigo</span>
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold text-white">{pickProb}%</span>
                      {(p.method !== "Qualquer" || p.round != null) && <span className="block text-[11px] text-ink-400">completa: {p.confidence}%</span>}
                    </>
                  )}
                </td>
                {!compact && (
                  <td className="tabular px-3 py-2.5 text-ink-300">
                    {bet ? (
                      <>
                        {bet.decimalOdds.toFixed(2)}
                        {bet.bookmaker ? ` · ${bet.bookmaker}` : ""}
                        <span className="block text-[11px] text-ink-400">
                          {bet.market === "3way" ? "3 vias" : "2 vias"} · {BET_STATUS[bet.status]}
                        </span>
                        {ev != null && (
                          <span className={ev > 0 ? "block text-[11px] text-emerald-300" : "block text-[11px] text-ink-400"}>
                            VE {ev > 0 ? "+" : ""}
                            {(ev * 100).toFixed(1)}% {ev > 0 ? "" : "(sem valor pela sua estimativa)"}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <Badge tone={PRED_STATUS[p.status].tone}>{PRED_STATUS[p.status].label}</Badge>
                </td>
                <td className="px-3 py-2.5 text-ink-300">
                  <ResolutionDetail p={p} nameA={p.fighterA?.name ?? "A"} nameB={p.fighterB?.name ?? "B"} />
                </td>
                {!compact && (
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {p.status === "pending" ? (
                        <>
                          <ActionButton action={resolvePrediction.bind(null, p.id, "correct")} variant="ghost" title="Marcar como acerto">
                            <Check className="h-3.5 w-3.5 text-emerald-300" />
                          </ActionButton>
                          <ActionButton action={resolvePrediction.bind(null, p.id, "incorrect")} variant="ghost" title="Marcar como erro">
                            <X className="h-3.5 w-3.5 text-blood-300" />
                          </ActionButton>
                        </>
                      ) : p.resolution === "auto" ? null : (
                        <ActionButton action={resolvePrediction.bind(null, p.id, "pending")} variant="ghost" title="Voltar para pendente">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </ActionButton>
                      )}
                      <ActionButton action={deletePrediction.bind(null, p.id)} variant="ghost" confirm="Excluir esta previsão?" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </ActionButton>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
