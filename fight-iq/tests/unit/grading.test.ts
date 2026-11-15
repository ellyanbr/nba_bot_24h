import { describe, expect, it } from "vitest";
import { gradePrediction } from "@/lib/analysis/grading";

const pick = { pickFighterId: "A", method: "Qualquer" as const, round: null };

describe("gradePrediction", () => {
  it("vencedor certo, sem método/round previstos → acerto", () => {
    expect(gradePrediction(pick, { winnerId: "A", method: "Decisão unânime", round: 3 })).toEqual({
      status: "correct",
      winnerCorrect: true,
      methodCorrect: null,
      roundCorrect: null,
    });
  });

  it("vencedor errado → erro", () => {
    expect(gradePrediction(pick, { winnerId: "B", method: "KO/TKO", round: 1 }).status).toBe("incorrect");
  });

  it("B1: KO no R1 previsto, vitória por decisão → ERRO, com vencedor certo registrado", () => {
    const g = gradePrediction({ pickFighterId: "A", method: "KO/TKO", round: 1 }, { winnerId: "A", method: "Decisão unânime", round: 3 });
    expect(g).toEqual({ status: "incorrect", winnerCorrect: true, methodCorrect: false, roundCorrect: false });
  });

  it("método certo e round errado → erro", () => {
    const g = gradePrediction({ pickFighterId: "A", method: "KO/TKO", round: 1 }, { winnerId: "A", method: "KO/TKO", round: 2 });
    expect(g.status).toBe("incorrect");
    expect(g.methodCorrect).toBe(true);
    expect(g.roundCorrect).toBe(false);
  });

  it("vencedor, método e round certos → acerto", () => {
    expect(gradePrediction({ pickFighterId: "A", method: "Finalização", round: 2 }, { winnerId: "A", method: "Finalização", round: 2 }).status).toBe("correct");
  });

  it("decisão dividida não conta como decisão unânime", () => {
    expect(gradePrediction({ pickFighterId: "A", method: "Decisão unânime", round: null }, { winnerId: "A", method: "Decisão dividida", round: 3 }).methodCorrect).toBe(false);
  });

  it("sem resultado (NC) → anulada, nada avaliado", () => {
    expect(gradePrediction(pick, { winnerId: null, method: "Sem resultado", round: 2 })).toEqual({
      status: "void",
      winnerCorrect: null,
      methodCorrect: null,
      roundCorrect: null,
    });
  });

  it("empate → erro para quem previu vencedor", () => {
    expect(gradePrediction(pick, { winnerId: null, method: "Empate", round: 3 })).toMatchObject({ status: "incorrect", winnerCorrect: false });
  });

  it("round desconhecido no resultado não é deduzido", () => {
    expect(gradePrediction({ pickFighterId: "A", method: "Qualquer", round: 2 }, { winnerId: null, method: "Empate", round: null }).roundCorrect).toBeNull();
  });
});
