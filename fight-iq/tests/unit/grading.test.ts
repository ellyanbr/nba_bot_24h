import { describe, expect, it } from "vitest";
import { CANCELLED_GRADE, gradePrediction, settleBet } from "@/lib/analysis/grading";
import { resultKind } from "@/lib/domain/types";

const pick = { pickFighterId: "A", method: "Qualquer" as const, round: null };

describe("resultKind — natureza do resultado", () => {
  it("diferencia vitória, empate, no contest e resultado anulado", () => {
    expect(resultKind("KO/TKO")).toBe("win");
    expect(resultKind("Desqualificação")).toBe("win");
    expect(resultKind("Empate")).toBe("draw");
    expect(resultKind("Sem resultado")).toBe("no_contest");
    expect(resultKind("Resultado anulado")).toBe("overturned");
  });
});

describe("gradePrediction", () => {
  it("vencedor certo, sem método/round previstos → acerto", () => {
    expect(gradePrediction(pick, { winnerId: "A", method: "Decisão unânime", round: 3 })).toEqual({
      status: "correct",
      voidReason: null,
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
    expect(g).toEqual({ status: "incorrect", voidReason: null, winnerCorrect: true, methodCorrect: false, roundCorrect: false });
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

  it("vitória por desqualificação conta como vitória", () => {
    expect(gradePrediction(pick, { winnerId: "A", method: "Desqualificação", round: 2 }).status).toBe("correct");
  });

  it.each([
    ["Empate", "draw"],
    ["Sem resultado", "no_contest"],
    ["Resultado anulado", "overturned"],
  ] as const)("%s → previsão ANULADA (não conta como acerto nem erro), motivo %s", (method, reason) => {
    expect(gradePrediction({ pickFighterId: "A", method: "KO/TKO", round: 2 }, { winnerId: null, method, round: 3 })).toEqual({
      status: "void",
      voidReason: reason,
      winnerCorrect: null,
      methodCorrect: null,
      roundCorrect: null,
    });
  });

  it("round desconhecido no resultado não é deduzido", () => {
    expect(gradePrediction({ pickFighterId: "A", method: "Qualquer", round: 2 }, { winnerId: "A", method: "Outro", round: null }).roundCorrect).toBeNull();
  });

  it("luta cancelada: anulada com motivo próprio", () => {
    expect(CANCELLED_GRADE).toMatchObject({ status: "void", voidReason: "cancelled", winnerCorrect: null });
  });
});

describe("settleBet — aposta no vencedor previsto", () => {
  it("é liquidada pelo acerto do VENCEDOR, não da previsão completa", () => {
    // Vencedor certo, método errado: previsão errada, mas a aposta no vencedor ganha.
    const g = gradePrediction({ pickFighterId: "A", method: "KO/TKO", round: 1 }, { winnerId: "A", method: "Decisão unânime", round: 3 });
    expect(g.status).toBe("incorrect");
    expect(settleBet("2way", g)).toBe("won");
    expect(settleBet("2way", gradePrediction(pick, { winnerId: "B", method: "KO/TKO", round: 1 }))).toBe("lost");
  });

  it("empate: devolvida no mercado de 2 vias, perdida no de 3 vias", () => {
    const draw = gradePrediction(pick, { winnerId: null, method: "Empate", round: 3 });
    expect(settleBet("2way", draw)).toBe("void");
    expect(settleBet("3way", draw)).toBe("lost");
  });

  it("no contest, resultado anulado e luta cancelada: devolvida", () => {
    expect(settleBet("3way", gradePrediction(pick, { winnerId: null, method: "Sem resultado", round: 1 }))).toBe("void");
    expect(settleBet("2way", gradePrediction(pick, { winnerId: null, method: "Resultado anulado", round: 3 }))).toBe("void");
    expect(settleBet("2way", CANCELLED_GRADE)).toBe("void");
  });
});
