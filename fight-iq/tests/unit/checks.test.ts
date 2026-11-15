import { describe, expect, it } from "vitest";
import { runConsistencyChecks, type CheckInput } from "@/lib/analysis/checks";
import { impliedProbability } from "@/lib/utils";

const base: CheckInput = {
  factors: [],
  morePaths: "unknown",
  pick: null,
  probabilities: null,
  pathsA: "x",
  pathsB: "y",
  argumentsA: "x",
  argumentsB: "y",
};
const f = (edge: "A" | "B" | "even" | "unknown", basis: "fato" | "interpretacao" = "fato") => ({ factorKey: Math.random().toString(), edge, basis, notes: "" });

describe("impliedProbability", () => {
  it("100 / odds decimais", () => {
    expect(impliedProbability(2)).toBe(50);
    expect(impliedProbability(1.4)).toBeCloseTo(71.43, 2);
  });
  it("odds inválidas", () => {
    expect(impliedProbability(1)).toBeNull();
    expect(impliedProbability(NaN)).toBeNull();
  });
});

describe("runConsistencyChecks", () => {
  it("alerta quando a escolha contraria a maioria dos fatores", () => {
    const out = runConsistencyChecks({ ...base, factors: [f("A"), f("B"), f("B")], pick: "A", probabilities: { A: 60, B: 40 } });
    expect(out.some((c) => c.level === "alerta" && c.text.includes("contraria"))).toBe(true);
  });

  it("alerta de probabilidade extrema com muitos fatores desconhecidos", () => {
    const out = runConsistencyChecks({ ...base, factors: [f("A"), f("unknown"), f("unknown")], pick: "A", probabilities: { A: 80, B: 20 } });
    expect(out.some((c) => c.text.includes("menos extrema"))).toBe(true);
  });

  it("alerta quando o escolhido é o menos provável na própria estimativa", () => {
    const out = runConsistencyChecks({ ...base, pick: "A", probabilities: { A: 40, B: 60 } });
    expect(out.some((c) => c.text.includes("MENOS probabilidade"))).toBe(true);
  });

  it("pede os dois lados quando falta caminho para vitória", () => {
    expect(runConsistencyChecks({ ...base, pathsB: " " }).some((c) => c.text.includes("DOIS atletas"))).toBe(true);
  });

  it("sem pendências quando a análise é coerente", () => {
    expect(runConsistencyChecks({ ...base, factors: [f("A"), f("A"), f("B")], pick: "A", probabilities: { A: 60, B: 40 }, morePaths: "A" })).toEqual([]);
  });
});
