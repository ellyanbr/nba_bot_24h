/**
 * Migrações do arquivo JSON local — equivalentes às migrações SQL em supabase/migrations.
 * Executadas ao carregar o arquivo; são idempotentes.
 */
import { gradePrediction, settleBet } from "@/lib/analysis/grading";
import type { Bet, FightResult, OddsSnapshot, Prediction } from "@/lib/domain/types";

interface MigratableDb {
  predictions: Prediction[];
  fight_results: FightResult[];
}

/** 0002: correção detalhada de previsões. Retorna true se algo mudou. */
export function migratePredictionGrading(db: MigratableDb): boolean {
  let changed = false;
  const resultByFight = new Map(db.fight_results.map((r) => [r.fightId, r]));
  db.predictions = db.predictions.map((p) => {
    if (p.resolution !== undefined) return p; // já migrada
    changed = true;
    const base: Prediction = { ...p, resolution: null, winnerCorrect: null, methodCorrect: null, roundCorrect: null, actualRound: null };
    if (p.status === "pending") return base;
    const official = p.fightId ? resultByFight.get(p.fightId) : undefined;
    if (official) {
      return {
        ...base,
        ...gradePrediction(p, official),
        resolution: "auto",
        actualWinnerId: official.winnerId,
        actualMethod: official.method,
        actualRound: official.round,
      };
    }
    // Resolução manual antiga: remove o vencedor que havia sido deduzido (não oficial).
    return { ...base, resolution: "manual", actualWinnerId: null, actualMethod: null };
  });
  return changed;
}

interface IntegrityDb extends MigratableDb {
  bets: Bet[];
  odds_snapshots: OddsSnapshot[];
}

/**
 * 0005: integridade dos resultados (equivalente a supabase/migrations/0005_integridade.sql).
 * - Previsões ganham `voidReason`; empates passam de "incorrect" para "void" (motivo empate).
 * - Apostas ganham `market` (3 vias se a casa registrada tinha odd de empate) e são
 *   reliquidadas pelo acerto do VENCEDOR, não da previsão completa.
 * Retorna true se algo mudou. Idempotente.
 */
export function migrateIntegrity(db: IntegrityDb): boolean {
  let changed = false;
  db.predictions = db.predictions.map((p) => {
    if (p.voidReason !== undefined) return p;
    changed = true;
    if (p.resolution === "auto" && p.actualMethod === "Empate") {
      return { ...p, status: "void", voidReason: "draw", winnerCorrect: null, methodCorrect: null, roundCorrect: null };
    }
    if (p.status === "void") {
      return { ...p, voidReason: p.actualMethod === "Sem resultado" ? "no_contest" : "manual" };
    }
    return { ...p, voidReason: null };
  });
  const predById = new Map(db.predictions.map((p) => [p.id, p]));
  db.bets = (db.bets ?? []).map((b) => {
    if (b.market !== undefined) return b;
    changed = true;
    const p = predById.get(b.predictionId);
    const snap = p?.analysisId ? db.odds_snapshots?.find((o) => o.analysisId === p.analysisId && o.bookmaker === b.bookmaker) : undefined;
    const market: Bet["market"] = snap?.oddsDraw != null ? "3way" : "2way";
    const status =
      p && p.resolution === "auto"
        ? settleBet(market, { status: p.status, voidReason: p.voidReason, winnerCorrect: p.winnerCorrect, methodCorrect: p.methodCorrect, roundCorrect: p.roundCorrect })
        : b.status;
    return { ...b, market, status };
  });
  return changed;
}
