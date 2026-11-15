/**
 * Comparação OBJETIVA entre dois atletas.
 *
 * Este módulo NÃO é inteligência artificial e NÃO faz previsões. Ele apenas
 * organiza os dados cadastrados (com sua procedência) por fator de análise e
 * informa explicitamente quando não há dados suficientes.
 * Os "indicadores numéricos" apontam qual atleta tem o número melhor; a
 * interpretação técnica é responsabilidade do analista (ou da IA, se configurada).
 */
import { ANALYSIS_FACTORS, STAT_CATALOG } from "@/lib/domain/catalog";
import type { Edge } from "@/lib/domain/types";
import type { FighterProfile } from "@/lib/services/queries";
import { ageAt, daysBetween, formatDate } from "@/lib/utils";

export interface StatRow {
  key: string;
  label: string;
  short: string;
  unit: string;
  higherIsBetter: boolean;
  a: number | null;
  b: number | null;
  better: Edge;
  sourceA: string | null;
  sourceB: string | null;
  asOfA: string | null;
  asOfB: string | null;
}

export interface FactorFacts {
  key: string;
  label: string;
  group: string;
  guide: string;
  facts: string[];
  numericIndicator: Edge;
  insufficient: boolean;
}

export interface ComparisonResult {
  referenceDate: string;
  statRows: StatRow[];
  factors: FactorFacts[];
  containsDemo: boolean;
  summary: { a: FighterSummary; b: FighterSummary };
}

export interface FighterSummary {
  name: string;
  record: string;
  age: number | null;
  heightCm: number | null;
  reachCm: number | null;
  stance: string | null;
  weightClass: string | null;
  daysSinceLastFight: number | null;
  lastFightDate: string | null;
  last3: string[];
  winsByKo: number | null;
  winsBySub: number | null;
  winsByDec: number | null;
  lossesByKo: number;
  lossesBySub: number;
  isDemo: boolean;
}

function summarize(p: FighterProfile, ref: Date): FighterSummary {
  const f = p.fighter;
  const past = p.completed.filter((h) => !h.event || h.event.date <= ref.toISOString().slice(0, 10));
  const last = past[0];
  const losses = past.filter((h) => h.outcome === "D");
  return {
    name: f.name,
    record: `${f.wins}-${f.losses}-${f.draws}`,
    age: ageAt(f.birthDate, ref),
    heightCm: f.heightCm,
    reachCm: f.reachCm,
    stance: f.stance,
    weightClass: f.weightClass,
    lastFightDate: last?.event?.date ?? null,
    daysSinceLastFight: last?.event ? daysBetween(last.event.date, ref) : null,
    last3: past.slice(0, 3).map(
      (h) =>
        `${h.outcome} vs ${h.opponent?.name ?? "?"} — ${h.result?.method ?? "?"}${h.result?.round ? ` (R${h.result.round})` : ""}, ${formatDate(h.event?.date)}`,
    ),
    winsByKo: f.winsByKo,
    winsBySub: f.winsBySub,
    winsByDec: f.winsByDec,
    lossesByKo: losses.filter((h) => h.result?.method === "KO/TKO").length,
    lossesBySub: losses.filter((h) => h.result?.method === "Finalização").length,
    isDemo: f.isDemo,
  };
}

function cmp(a: number | null, b: number | null, higherIsBetter: boolean, tolerance = 0): Edge {
  if (a == null || b == null) return "unknown";
  if (Math.abs(a - b) <= tolerance) return "even";
  return (a > b) === higherIsBetter ? "A" : "B";
}

const fmt = (v: number | null, unit = "") => (v == null ? "sem dado" : `${v}${unit}`);

export function buildComparison(A: FighterProfile, B: FighterProfile, referenceDate?: string): ComparisonResult {
  const ref = referenceDate ? new Date(`${referenceDate}T12:00:00Z`) : new Date();
  const sa = summarize(A, ref);
  const sb = summarize(B, ref);
  const nA = A.fighter.name;
  const nB = B.fighter.name;

  const statRows: StatRow[] = STAT_CATALOG.map((def) => {
    const ra = A.stats.find((s) => s.statKey === def.key);
    const rb = B.stats.find((s) => s.statKey === def.key);
    return {
      key: def.key,
      label: def.label,
      short: def.short,
      unit: def.unit,
      higherIsBetter: def.higherIsBetter,
      a: ra?.value ?? null,
      b: rb?.value ?? null,
      better: cmp(ra?.value ?? null, rb?.value ?? null, def.higherIsBetter),
      sourceA: ra?.source?.name ?? null,
      sourceB: rb?.source?.name ?? null,
      asOfA: ra?.asOf ?? null,
      asOfB: rb?.asOf ?? null,
    };
  });

  const statFacts = (factorKey: string) => {
    const rows = statRows.filter((r) => STAT_CATALOG.find((d) => d.key === r.key)?.factors.includes(factorKey));
    const facts = rows
      .filter((r) => r.a != null || r.b != null)
      .map((r) => `${r.label}: ${nA} ${fmt(r.a, r.unit)} × ${nB} ${fmt(r.b, r.unit)}`);
    const comparable = rows.filter((r) => r.better !== "unknown");
    let indicator: Edge = "unknown";
    if (comparable.length) {
      const a = comparable.filter((r) => r.better === "A").length;
      const b = comparable.filter((r) => r.better === "B").length;
      indicator = a === b ? "even" : a > b ? "A" : "B";
    }
    return { facts, indicator };
  };

  const factors: FactorFacts[] = ANALYSIS_FACTORS.map((def) => {
    let facts: string[] = [];
    let numericIndicator: Edge = "unknown";

    switch (def.key) {
      case "ultimas3": {
        if (sa.last3.length) facts.push(`${nA}: ${sa.last3.join(" | ")}`);
        if (sb.last3.length) facts.push(`${nB}: ${sb.last3.join(" | ")}`);
        const wa = sa.last3.filter((s) => s.startsWith("V")).length;
        const wb = sb.last3.filter((s) => s.startsWith("V")).length;
        if (sa.last3.length && sb.last3.length) {
          facts.push(`Vitórias nas últimas lutas registradas: ${nA} ${wa}/${sa.last3.length} × ${nB} ${wb}/${sb.last3.length}`);
          numericIndicator = cmp(wa / sa.last3.length, wb / sb.last3.length, true);
        }
        break;
      }
      case "striking":
      case "wrestling":
      case "defesa_quedas": {
        const r = statFacts(def.key);
        facts = r.facts;
        numericIndicator = r.indicator;
        break;
      }
      case "grappling":
      case "jiujitsu": {
        const r = statFacts(def.key);
        facts = r.facts;
        numericIndicator = r.indicator;
        if (sa.winsBySub != null && sb.winsBySub != null) {
          facts.push(`Vitórias por finalização no cartel: ${nA} ${sa.winsBySub} × ${nB} ${sb.winsBySub}`);
        }
        break;
      }
      case "potencia": {
        if (sa.winsByKo != null && sb.winsByKo != null) {
          facts.push(`Vitórias por KO/TKO no cartel: ${nA} ${sa.winsByKo} × ${nB} ${sb.winsByKo}`);
          const ra = A.fighter.wins ? sa.winsByKo / A.fighter.wins : null;
          const rb = B.fighter.wins ? sb.winsByKo / B.fighter.wins : null;
          if (ra != null && rb != null) {
            facts.push(`Percentual de vitórias por KO/TKO: ${nA} ${(ra * 100).toFixed(0)}% × ${nB} ${(rb * 100).toFixed(0)}%`);
            numericIndicator = cmp(ra, rb, true, 0.05);
          }
        }
        break;
      }
      case "queixo": {
        const r = statFacts("queixo");
        facts = r.facts;
        if (A.completed.length || B.completed.length) {
          facts.push(`Derrotas por KO/TKO nas lutas registradas no sistema: ${nA} ${sa.lossesByKo} × ${nB} ${sb.lossesByKo}`);
        }
        numericIndicator = r.indicator;
        break;
      }
      case "tamanho_envergadura": {
        facts.push(`Altura: ${nA} ${fmt(sa.heightCm, " cm")} × ${nB} ${fmt(sb.heightCm, " cm")}`);
        facts.push(`Envergadura: ${nA} ${fmt(sa.reachCm, " cm")} × ${nB} ${fmt(sb.reachCm, " cm")}`);
        if (sa.reachCm != null && sb.reachCm != null) {
          const d = sa.reachCm - sb.reachCm;
          facts.push(d === 0 ? "Envergaduras iguais." : `Diferença de envergadura: ${Math.abs(d)} cm a favor de ${d > 0 ? nA : nB}`);
        }
        numericIndicator = cmp(sa.reachCm, sb.reachCm, true, 2);
        if (sa.heightCm == null && sb.heightCm == null && sa.reachCm == null && sb.reachCm == null) facts = [];
        break;
      }
      case "idade": {
        if (sa.age != null || sb.age != null) {
          facts.push(`Idade na data de referência (${formatDate(ref.toISOString().slice(0, 10))}): ${nA} ${fmt(sa.age, " anos")} × ${nB} ${fmt(sb.age, " anos")}`);
        }
        // Não há indicador: idade isolada não define vantagem.
        break;
      }
      case "inatividade": {
        if (sa.lastFightDate || sb.lastFightDate) {
          facts.push(
            `Última luta registrada: ${nA} ${sa.lastFightDate ? `${formatDate(sa.lastFightDate)} (${sa.daysSinceLastFight} dias)` : "sem registro"} × ${nB} ${sb.lastFightDate ? `${formatDate(sb.lastFightDate)} (${sb.daysSinceLastFight} dias)` : "sem registro"}`,
          );
        }
        numericIndicator = cmp(sa.daysSinceLastFight, sb.daysSinceLastFight, false, 60);
        break;
      }
      default:
        // qualidade_adversarios, cardio, lesoes, corte_peso, camp: não há dados estruturados.
        break;
    }

    return {
      key: def.key,
      label: def.label,
      group: def.group,
      guide: def.guide,
      facts,
      numericIndicator,
      insufficient: facts.length === 0,
    };
  });

  return {
    referenceDate: ref.toISOString().slice(0, 10),
    statRows,
    factors,
    containsDemo: A.fighter.isDemo || B.fighter.isDemo,
    summary: { a: sa, b: sb },
  };
}
