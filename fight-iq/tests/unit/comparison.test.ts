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

describe("revisão dos fatores (A1–A5)", () => {
  const withHistory = (p: FighterProfile, n: number) => {
    const entries = Array.from({ length: n }, (_, i) => ({
      fight: { id: `f${i}` },
      event: { date: `2026-0${i + 1}-10` },
      opponent: { name: `Op${i}` },
      result: { method: "Decisão unânime", round: 3 },
      outcome: "V",
    })) as unknown as FighterProfile["completed"];
    return { ...p, completed: entries, history: entries };
  };

  it("A1: Grappling não duplica o indicador do Jiu-jitsu e explica a falta de métrica própria", () => {
    const c = buildComparison(profile("A", {}, { sub_avg: 2, td_avg: 3 }), profile("B", {}, { sub_avg: 0.5, td_avg: 1 }), "2026-11-15");
    const g = c.factors.find((f) => f.key === "grappling")!;
    const j = c.factors.find((f) => f.key === "jiujitsu")!;
    expect(j.numericIndicator).toBe("A");
    expect(g.numericIndicator).toBe("unknown");
    expect(g.notes.join(" ")).toContain("Sem métrica própria de grappling");
    expect(g.facts.every((x) => x.includes("(contexto)"))).toBe(true);
  });

  it("A2: avisa quando o histórico cadastrado não cobre o cartel", () => {
    const c = buildComparison(withHistory(profile("A", { wins: 10, losses: 2 }), 1), withHistory(profile("B", { wins: 1, losses: 0 }), 1), "2026-11-15");
    const notes = c.factors.find((f) => f.key === "ultimas3")!.notes.join(" ");
    expect(notes).toContain("A: 1 de 12 lutas do cartel");
    expect(notes).not.toContain("B: 1 de 1");
    expect(c.factors.find((f) => f.key === "inatividade")!.notes.join(" ")).toContain("não cobre todo o cartel");
  });

  it("A3: métricas divergentes não geram indicador", () => {
    // A tem mais SLpM e precisão; B tem melhor defesa e absorve menos.
    const c = buildComparison(
      profile("A", {}, { slpm: 6, str_acc: 55, sapm: 5, str_def: 45 }),
      profile("B", {}, { slpm: 3, str_acc: 40, sapm: 2, str_def: 65 }),
      "2026-11-15",
    );
    const s = c.factors.find((f) => f.key === "striking")!;
    expect(s.numericIndicator).toBe("unknown");
    expect(s.notes[0]).toContain("As métricas divergem (2 favorecem A, 2 favorecem B)");
  });

  it("A3: métricas unânimes geram indicador", () => {
    const c = buildComparison(profile("A", {}, { td_avg: 4, td_acc: 50 }), profile("B", {}, { td_avg: 1, td_acc: 30 }), "2026-11-15");
    expect(c.factors.find((f) => f.key === "wrestling")!.numericIndicator).toBe("A");
  });

  it("A4: avisa quando as estatísticas comparadas têm datas distantes", () => {
    const a = profile("A", {}, { td_def: 80 });
    const b = profile("B", {}, { td_def: 60 });
    b.stats[0].asOf = "2024-01-01";
    const notes = buildComparison(a, b, "2026-11-15").factors.find((f) => f.key === "defesa_quedas")!.notes.join(" ");
    expect(notes).toContain("Def. quedas: comparação entre dados de");
  });

  it("A5: inatividade não gera indicador", () => {
    const c = buildComparison(withHistory(profile("A", {}), 3), withHistory(profile("B", {}), 1), "2026-11-15");
    const f = c.factors.find((x) => x.key === "inatividade")!;
    expect(f.facts.length).toBeGreaterThan(0);
    expect(f.numericIndicator).toBe("unknown");
  });
});
