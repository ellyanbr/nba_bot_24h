import { describe, expect, it } from "vitest";
import { migrateIntegrity, migratePredictionGrading } from "@/lib/data/local-migrations";
import type { FightResult, Prediction } from "@/lib/domain/types";

// Registro no formato antigo (sem os campos de correção detalhada).
const legacy = (over: Partial<Prediction>) =>
  ({
    id: "p",
    analysisId: null,
    fightId: null,
    fighterAId: "A",
    fighterBId: "B",
    pickFighterId: "A",
    method: "Qualquer",
    round: null,
    confidence: 60,
    notes: null,
    status: "pending",
    actualWinnerId: null,
    actualMethod: null,
    resolvedAt: null,
    containsDemoData: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as unknown as Prediction;

const result = (over: Partial<FightResult>) => ({ id: "r", fightId: "f1", winnerId: "A", method: "Decisão unânime", round: 3, ...over }) as FightResult;

describe("migratePredictionGrading", () => {
  it("B2: remove vencedor deduzido de resolução manual antiga", () => {
    const db = { predictions: [legacy({ status: "incorrect", actualWinnerId: "B" })], fight_results: [] };
    expect(migratePredictionGrading(db)).toBe(true);
    expect(db.predictions[0]).toMatchObject({ status: "incorrect", resolution: "manual", actualWinnerId: null, actualMethod: null });
  });

  it("recorrige pelo resultado oficial quando existe (B1)", () => {
    const db = {
      predictions: [legacy({ fightId: "f1", status: "correct", method: "KO/TKO", round: 1, actualWinnerId: "A" })],
      fight_results: [result({})],
    };
    migratePredictionGrading(db);
    expect(db.predictions[0]).toMatchObject({ status: "incorrect", resolution: "auto", winnerCorrect: true, methodCorrect: false, actualRound: 3 });
  });

  it("é idempotente", () => {
    const db = { predictions: [legacy({ status: "pending" })], fight_results: [] };
    expect(migratePredictionGrading(db)).toBe(true);
    expect(migratePredictionGrading(db)).toBe(false);
  });
});

describe("migrateIntegrity (0005)", () => {
  const base = (over: Partial<Prediction>) => ({ ...legacy(over), resolution: "auto", winnerCorrect: false, methodCorrect: null, roundCorrect: null, actualRound: 3 }) as Prediction;

  it("empate antigo (contado como erro) vira anulada com motivo empate", () => {
    const db = { predictions: [base({ status: "incorrect", actualMethod: "Empate", actualWinnerId: null })], fight_results: [], bets: [], odds_snapshots: [] };
    expect(migrateIntegrity(db)).toBe(true);
    expect(db.predictions[0]).toMatchObject({ status: "void", voidReason: "draw", winnerCorrect: null });
  });

  it("classifica anuladas antigas e preserva as demais", () => {
    const db = {
      predictions: [
        base({ id: "nc", status: "void", actualMethod: "Sem resultado" }),
        { ...legacy({ id: "m", status: "void" }), resolution: "manual" } as Prediction,
        base({ id: "ok", status: "correct", actualMethod: "KO/TKO", actualWinnerId: "A" }),
      ],
      fight_results: [],
      bets: [],
      odds_snapshots: [],
    };
    migrateIntegrity(db);
    expect(db.predictions.map((p) => p.voidReason)).toEqual(["no_contest", "manual", null]);
  });

  it("aposta antiga é reliquidada pelo acerto do vencedor e recebe o mercado", () => {
    const p = base({ id: "p", analysisId: "a", status: "incorrect", method: "KO/TKO", actualMethod: "Decisão unânime", actualWinnerId: "A" });
    (p as { winnerCorrect: boolean }).winnerCorrect = true; // vencedor certo, método errado
    const db = {
      predictions: [p],
      fight_results: [],
      bets: [{ id: "b", predictionId: "p", decimalOdds: 1.8, stake: null, bookmaker: "Casa", status: "lost" } as never],
      odds_snapshots: [{ id: "o", analysisId: "a", bookmaker: "Casa", oddsDraw: 30 } as never],
    };
    migrateIntegrity(db);
    expect(db.bets[0]).toMatchObject({ market: "3way", status: "won" });
    expect(migrateIntegrity(db)).toBe(false); // idempotente
  });
});
