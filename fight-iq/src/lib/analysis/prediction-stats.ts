/**
 * Métricas do histórico de previsões.
 *
 * - Acerto completo: vencedor + método/round quando previstos.
 * - Acerto do vencedor: somente previsões corrigidas por resultado oficial.
 * - Calibração: probabilidade atribuída ao atleta escolhido × frequência com que ele VENCEU.
 * - Brier score e log loss: apenas previsões com probabilidades registradas e resultado oficial.
 */
import type { Prediction } from "@/lib/domain/types";
import { brierScore, logLoss, type Estimate, type Side } from "./probability";

export interface CalibrationBucket {
  label: string;
  total: number;
  hits: number;
  /** Frequência observada de vitória do escolhido (%). */
  observed: number | null;
  /** Probabilidade média atribuída na faixa (%). */
  expected: number | null;
}

export interface PredictionStats {
  total: number;
  pending: number;
  resolved: number;
  correct: number;
  incorrect: number;
  accuracy: number | null;
  winnerAccuracy: number | null;
  winnerGraded: number;
  manualResolved: number;
  /** Probabilidade média atribuída ao escolhido (%). */
  avgPickProbability: number | null;
  brier: number | null;
  logLoss: number | null;
  /** Quantas previsões entraram no Brier/log loss. */
  scored: number;
  /** Previsões antigas (sem probabilidades), calibradas pelo campo de confiança. */
  legacyCount: number;
  buckets: CalibrationBucket[];
}

export function estimateOf(p: Prediction): Estimate | null {
  if (p.probabilityA == null || p.probabilityB == null) return null;
  return { A: p.probabilityA, B: p.probabilityB, draw: p.probabilityDraw ?? 0 };
}

/** Probabilidade atribuída ao atleta escolhido; previsões antigas usam a "confiança". */
export function pickProbability(p: Prediction): number {
  const e = estimateOf(p);
  if (!e) return p.confidence;
  return p.pickFighterId === p.fighterAId ? e.A : e.B;
}

/** Resultado oficial em termos de lado (A, B, empate); null se não houver resultado oficial aplicável. */
export function outcomeSide(p: Prediction): Side | null {
  if (p.resolution !== "auto") return null;
  // Empate é um resultado real: a previsão é anulada para acerto/erro, mas a estimativa
  // de probabilidades (que inclui o empate) continua avaliável pelo Brier/log loss.
  if (p.voidReason === "draw" || (p.actualMethod === "Empate" && p.status === "void")) return "draw";
  if (p.status === "void") return null;
  if (p.actualWinnerId === p.fighterAId) return "A";
  if (p.actualWinnerId === p.fighterBId) return "B";
  if (p.actualMethod === "Empate") return "draw";
  return null;
}

/** O escolhido venceu? Usa o resultado oficial; na marcação manual, a marcação do usuário. */
function pickWon(p: Prediction): boolean | null {
  if (p.winnerCorrect != null) return p.winnerCorrect;
  if (p.resolution === "manual" || p.resolution == null) {
    // Manual/antigo: a marcação refere-se à previsão inteira; sem método/round equivale ao vencedor.
    if (p.method === "Qualquer" && p.round == null && (p.status === "correct" || p.status === "incorrect")) return p.status === "correct";
  }
  return null;
}

const RANGES: [string, number, number][] = [
  ["< 50%", 0, 50],
  ["50–59%", 50, 60],
  ["60–69%", 60, 70],
  ["70–79%", 70, 80],
  ["80–100%", 80, 100.01],
];

export function computePredictionStats(preds: Prediction[]): PredictionStats {
  const resolved = preds.filter((p) => p.status === "correct" || p.status === "incorrect");
  const correct = resolved.filter((p) => p.status === "correct").length;
  const winnerGraded = preds.filter((p) => p.winnerCorrect != null);

  const scoredRows = preds
    .map((p) => ({ e: estimateOf(p), o: outcomeSide(p) }))
    .filter((x): x is { e: Estimate; o: Side } => x.e != null && x.o != null);

  const calib = preds.map((p) => ({ prob: pickProbability(p), won: pickWon(p) })).filter((x): x is { prob: number; won: boolean } => x.won != null);

  return {
    total: preds.length,
    pending: preds.filter((p) => p.status === "pending").length,
    resolved: resolved.length,
    correct,
    incorrect: resolved.length - correct,
    accuracy: resolved.length ? (correct / resolved.length) * 100 : null,
    winnerAccuracy: winnerGraded.length ? (winnerGraded.filter((p) => p.winnerCorrect).length / winnerGraded.length) * 100 : null,
    winnerGraded: winnerGraded.length,
    manualResolved: resolved.filter((p) => p.resolution === "manual").length,
    avgPickProbability: preds.length ? preds.reduce((s, p) => s + pickProbability(p), 0) / preds.length : null,
    brier: scoredRows.length ? scoredRows.reduce((s, x) => s + brierScore(x.e, x.o), 0) / scoredRows.length : null,
    logLoss: scoredRows.length ? scoredRows.reduce((s, x) => s + logLoss(x.e, x.o), 0) / scoredRows.length : null,
    scored: scoredRows.length,
    legacyCount: preds.filter((p) => estimateOf(p) == null).length,
    buckets: RANGES.map(([label, lo, hi]) => {
      const inB = calib.filter((x) => x.prob >= lo && x.prob < hi);
      const hits = inB.filter((x) => x.won).length;
      return {
        label,
        total: inB.length,
        hits,
        observed: inB.length ? (hits / inB.length) * 100 : null,
        expected: inB.length ? inB.reduce((s, x) => s + x.prob, 0) / inB.length : null,
      };
    }),
  };
}
