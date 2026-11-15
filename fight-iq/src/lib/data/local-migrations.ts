/**
 * Migrações do arquivo JSON local — equivalentes às migrações SQL em supabase/migrations.
 * Executadas ao carregar o arquivo; são idempotentes.
 */
import { gradePrediction } from "@/lib/analysis/grading";
import type { FightResult, Prediction } from "@/lib/domain/types";

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
