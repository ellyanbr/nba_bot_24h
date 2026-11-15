import { describe, expect, it } from "vitest";
import { buildComparison } from "@/lib/analysis/comparison";
import type { Fighter } from "@/lib/domain/types";
import type { FighterProfile } from "@/lib/services/queries";

function profile(id: string, over: Partial<Fighter>, stats: Record<string, number> = {}): FighterProfile {
  const fighter = {
    id,
    organizationId: null,
    name: id,
    nickname: null,
    nationality: null,
    birthDate: "1995-06-15",
    heightCm: 180,
    reachCm: 185,
    stance: "Ortodoxo",
    weightClass: "Peso Leve",
    team: null,
    wins: 10,
    losses: 2,
    draws: 0,
    noContests: 0,
    winsByKo: 5,
    winsBySub: 2,
    winsByDec: 3,
    active: true,
    notes: null,
    sourceId: "s",
    isDemo: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  } as Fighter;
  return {
    fighter,
    organization: null,
    source: null,
    stats: Object.entries(stats).map(([statKey, value]) => ({
      id: statKey,
      fighterId: id,
      statKey,
      value,
      asOf: "2026-01-01",
      sourceId: "s",
      isDemo: false,
      createdAt: "",
      updatedAt: "",
      source: null,
    })),
    history: [],
    completed: [],
    upcoming: [],
  };
}

describe("buildComparison", () => {
  it("marca como 'dados insuficientes' fatores sem dados estruturados", () => {
    const c = buildComparison(profile("A", {}), profile("B", {}), "2026-11-15");
    for (const key of ["qualidade_adversarios", "cardio", "lesoes", "corte_peso", "camp", "ultimas3", "inatividade"]) {
      expect(c.factors.find((f) => f.key === key)?.insufficient, key).toBe(true);
    }
  });

  it("calcula diferença de envergadura e indicador", () => {
    const c = buildComparison(profile("A", { reachCm: 190 }), profile("B", { reachCm: 180 }), "2026-11-15");
    const f = c.factors.find((x) => x.key === "tamanho_envergadura")!;
    expect(f.numericIndicator).toBe("A");
    expect(f.facts.join(" ")).toContain("10 cm a favor de A");
  });

  it("menor SApM é melhor", () => {
    const c = buildComparison(profile("A", {}, { sapm: 2 }), profile("B", {}, { sapm: 4 }), "2026-11-15");
    expect(c.statRows.find((r) => r.key === "sapm")?.better).toBe("A");
  });

  it("estatística ausente em um dos lados não gera vantagem", () => {
    const c = buildComparison(profile("A", {}, { td_def: 80 }), profile("B", {}), "2026-11-15");
    expect(c.statRows.find((r) => r.key === "td_def")?.better).toBe("unknown");
  });

  it("idade calculada na data de referência e sem indicador", () => {
    const c = buildComparison(profile("A", { birthDate: "1990-12-01" }), profile("B", {}), "2026-11-15");
    expect(c.summary.a.age).toBe(35);
    expect(c.factors.find((f) => f.key === "idade")?.numericIndicator).toBe("unknown");
  });

  it("sinaliza dados de demonstração", () => {
    expect(buildComparison(profile("A", { isDemo: true }), profile("B", { isDemo: true })).containsDemo).toBe(true);
  });
});
