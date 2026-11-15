import { describe, expect, it } from "vitest";
import { migratePredictionGrading } from "@/lib/data/local-migrations";
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
