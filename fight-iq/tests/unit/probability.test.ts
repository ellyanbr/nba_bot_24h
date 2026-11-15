import { describe, expect, it } from "vitest";
import {
  analyzeMarket,
  brierScore,
  expectedValue,
  fairOdds,
  impliedPct,
  logLoss,
  marketFlags,
  validateEstimate,
  valueFlags,
  valueTable,
} from "@/lib/analysis/probability";

const names = { A: "Alfa", B: "Beta", draw: "Empate" };

describe("conversões básicas", () => {
  it("probabilidade implícita = 100 / odds", () => {
    expect(impliedPct(2)).toBe(50);
    expect(impliedPct(1.5)).toBeCloseTo(66.667, 2);
    expect(impliedPct(1)).toBeNull();
  });
  it("odds justas = 100 / p", () => {
    expect(fairOdds(40)).toBe(2.5);
    expect(fairOdds(0)).toBeNull();
  });
  it("valor esperado = p × odds − 1", () => {
    expect(expectedValue(50, 2.2)).toBeCloseTo(0.1, 10);
    expect(expectedValue(40, 2.5)).toBeCloseTo(0, 10);
  });
});

describe("validateEstimate", () => {
  it("exige soma 100", () => {
    expect(validateEstimate({ A: 60, B: 40, draw: 0 })).toBeNull();
    expect(validateEstimate({ A: 60, B: 30, draw: 0 })).toMatch(/somam 90/);
    expect(validateEstimate({ A: 110, B: -10, draw: 0 })).toMatch(/entre 0% e 100%/);
  });
});

describe("analyzeMarket — margem da casa", () => {
  it("calcula margem e probabilidade sem margem (proporcional)", () => {
    // 1,80 / 2,10 → 55,56% + 47,62% = 103,17% → margem 3,17 p.p.
    const a = analyzeMarket({ bookmaker: "X", A: 1.8, B: 2.1, draw: null })!;
    expect(a.overround).toBeCloseTo(3.175, 2);
    expect(a.noVig.A! + a.noVig.B!).toBeCloseTo(100, 10);
    expect(a.noVig.A).toBeCloseTo(53.85, 2);
  });
  it("mercado de 3 vias", () => {
    const a = analyzeMarket({ bookmaker: "X", A: 1.9, B: 2.0, draw: 51 })!;
    expect(a.sides).toEqual(["A", "B", "draw"]);
    expect(a.noVig.A! + a.noVig.B! + a.noVig.draw!).toBeCloseTo(100, 10);
  });
  it("odds inválidas", () => {
    expect(analyzeMarket({ bookmaker: "X", A: 0.9, B: 2, draw: null })).toBeNull();
  });
});

describe("valueTable + valueFlags — ausência de valor esperado", () => {
  it("usa a melhor odd entre as casas e compara com o consenso sem margem", () => {
    const rows = valueTable({ A: 60, B: 40, draw: 0 }, [
      { bookmaker: "X", A: 1.8, B: 2.1, draw: null },
      { bookmaker: "Y", A: 1.75, B: 2.2, draw: null },
    ]);
    const a = rows.find((r) => r.side === "A")!;
    expect(a.bestOdds).toBe(1.8);
    expect(a.bestBookmaker).toBe("X");
    expect(a.ev).toBeCloseTo(0.08, 10);
    expect(a.edge).toBeGreaterThan(0);
  });

  it("sem valor esperado é informação sobre a estimativa, não alerta de mercado", () => {
    const rows = valueTable({ A: 50, B: 50, draw: 0 }, [{ bookmaker: "X", A: 1.8, B: 2.1, draw: null }]);
    const flags = valueFlags(rows, names);
    const a = flags.find((f) => f.text.startsWith("Alfa"))!;
    expect(a.level).toBe("info");
    expect(a.text).toContain("sem valor esperado pela sua estimativa");
    expect(a.text).toContain("maiores que 2.00");
  });

  it("divergência grande em relação ao mercado gera atenção", () => {
    const rows = valueTable({ A: 80, B: 20, draw: 0 }, [{ bookmaker: "X", A: 2.5, B: 1.6, draw: null }]);
    expect(valueFlags(rows, names).some((f) => f.level === "atencao" && f.text.includes("difere"))).toBe(true);
  });
});

describe("marketFlags — inconsistência de mercado", () => {
  it("margem normal não gera alerta", () => {
    expect(marketFlags([{ bookmaker: "X", A: 1.8, B: 2.1, draw: null }])).toEqual([]);
  });
  it("soma abaixo de 100% (provável erro de digitação)", () => {
    expect(marketFlags([{ bookmaker: "X", A: 2.2, B: 2.2, draw: null }])[0].text).toMatch(/abaixo de 100%/);
  });
  it("margem alta", () => {
    expect(marketFlags([{ bookmaker: "X", A: 1.5, B: 2.2, draw: null }])[0].text).toMatch(/margem da casa de 12/);
  });
  it("arbitragem entre casas", () => {
    const flags = marketFlags([
      { bookmaker: "X", A: 2.1, B: 1.8, draw: null },
      { bookmaker: "Y", A: 1.7, B: 2.15, draw: null },
    ]);
    expect(flags.some((f) => f.text.includes("arbitragem"))).toBe(true);
  });
  it("divergência entre casas", () => {
    const flags = marketFlags([
      { bookmaker: "X", A: 1.5, B: 2.6, draw: null },
      { bookmaker: "Y", A: 1.9, B: 1.95, draw: null },
    ]);
    expect(flags.some((f) => f.text.includes("divergem"))).toBe(true);
  });
});

describe("calibração", () => {
  it("Brier score", () => {
    expect(brierScore({ A: 100, B: 0, draw: 0 }, "A")).toBe(0);
    expect(brierScore({ A: 50, B: 50, draw: 0 }, "A")).toBeCloseTo(0.5, 10);
    expect(brierScore({ A: 0, B: 100, draw: 0 }, "A")).toBe(2);
  });
  it("log loss", () => {
    expect(logLoss({ A: 50, B: 50, draw: 0 }, "A")).toBeCloseTo(Math.log(2), 10);
    expect(Number.isFinite(logLoss({ A: 100, B: 0, draw: 0 }, "B"))).toBe(true);
  });
});
