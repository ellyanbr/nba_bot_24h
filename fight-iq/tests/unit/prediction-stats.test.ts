import { describe, expect, it } from "vitest";
import { computePredictionStats, outcomeSide, pickProbability } from "@/lib/analysis/prediction-stats";
import type { Prediction } from "@/lib/domain/types";

const pred = (over: Partial<Prediction>): Prediction => ({
  id: Math.random().toString(),
  analysisId: null,
  fightId: "f",
  fighterAId: "A",
  fighterBId: "B",
  pickFighterId: "A",
  method: "Qualquer",
  round: null,
  probabilityA: 70,
  probabilityB: 30,
  probabilityDraw: 0,
  confidence: 70,
  notes: null,
  status: "pending",
  resolution: null,
  voidReason: null,
  winnerCorrect: null,
  methodCorrect: null,
  roundCorrect: null,
  actualWinnerId: null,
  actualMethod: null,
  actualRound: null,
  resolvedAt: null,
  containsDemoData: false,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const won = (over: Partial<Prediction> = {}) => pred({ status: "correct", resolution: "auto", winnerCorrect: true, actualWinnerId: "A", actualMethod: "KO/TKO", ...over });
const lost = (over: Partial<Prediction> = {}) => pred({ status: "incorrect", resolution: "auto", winnerCorrect: false, actualWinnerId: "B", actualMethod: "KO/TKO", ...over });

describe("pickProbability / outcomeSide", () => {
  it("usa a probabilidade do lado escolhido", () => {
    expect(pickProbability(pred({ pickFighterId: "B", probabilityA: 45, probabilityB: 55 }))).toBe(55);
  });
  it("registro antigo usa o campo de confiança", () => {
    expect(pickProbability(pred({ probabilityA: null, probabilityB: null, confidence: 65 }))).toBe(65);
  });
  it("resultado só conta quando é oficial", () => {
    expect(outcomeSide(won())).toBe("A");
    expect(outcomeSide(pred({ status: "incorrect", resolution: "manual" }))).toBeNull();
    expect(outcomeSide(pred({ status: "incorrect", resolution: "auto", actualWinnerId: null, actualMethod: "Empate" }))).toBe("draw");
  });
});

describe("computePredictionStats", () => {
  it("Brier e log loss com resultados oficiais", () => {
    // 70% no vencedor real: Brier = 0,3² + 0,3² = 0,18; 70% no perdedor: 0,7² + 0,7² = 0,98
    const s = computePredictionStats([won(), lost()]);
    expect(s.scored).toBe(2);
    expect(s.brier).toBeCloseTo((0.18 + 0.98) / 2, 10);
    expect(s.logLoss).toBeCloseTo((-Math.log(0.7) - Math.log(0.3)) / 2, 10);
  });

  it("calibração compara probabilidade do escolhido com vitória do escolhido, não com a previsão completa", () => {
    // Vencedor certo mas método errado → previsão completa errada, porém o escolhido VENCEU.
    const s = computePredictionStats([won({ status: "incorrect", method: "Finalização", methodCorrect: false })]);
    const b = s.buckets.find((x) => x.label === "70–79%")!;
    expect(b).toMatchObject({ total: 1, hits: 1, observed: 100, expected: 70 });
    expect(s.accuracy).toBe(0);
    expect(s.winnerAccuracy).toBe(100);
  });

  it("marcação manual entra na taxa de acerto mas não no Brier", () => {
    const s = computePredictionStats([pred({ status: "correct", resolution: "manual" })]);
    expect(s.accuracy).toBe(100);
    expect(s.manualResolved).toBe(1);
    expect(s.scored).toBe(0);
    expect(s.brier).toBeNull();
  });

  it("anuladas e pendentes ficam de fora", () => {
    const s = computePredictionStats([pred({}), pred({ status: "void", resolution: "auto" })]);
    expect(s.resolved).toBe(0);
    expect(s.scored).toBe(0);
    expect(s.pending).toBe(1);
  });
});

describe("anuladas (empate, NC, resultado anulado, cancelada)", () => {
  const voided = (voidReason: Prediction["voidReason"], actualMethod: string | null) =>
    pred({ status: "void", resolution: "auto", voidReason, actualMethod, actualWinnerId: null });

  it("não contam como acerto nem como erro, nem na calibração", () => {
    const s = computePredictionStats([won(), voided("draw", "Empate"), voided("no_contest", "Sem resultado"), voided("overturned", "Resultado anulado"), voided("cancelled", null)]);
    expect(s.resolved).toBe(1);
    expect(s.accuracy).toBe(100);
    expect(s.winnerGraded).toBe(1);
    expect(s.buckets.reduce((n, b) => n + b.total, 0)).toBe(1);
  });

  it("empate entra no Brier (resultado real avaliável pela probabilidade de empate); NC e anulada não", () => {
    const s = computePredictionStats([voided("draw", "Empate"), voided("no_contest", "Sem resultado"), voided("overturned", "Resultado anulado")]);
    expect(s.scored).toBe(1);
    // estimativa 70/30/0 e resultado empate: (0,7)² + (0,3)² + (0 − 1)² = 1,58
    expect(s.brier).toBeCloseTo(1.58, 10);
  });
});
