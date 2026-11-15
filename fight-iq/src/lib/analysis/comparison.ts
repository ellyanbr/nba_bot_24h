/**
 * Comparação OBJETIVA entre dois atletas.
 *
 * Este módulo NÃO é inteligência artificial e NÃO faz previsões. Ele organiza os dados
 * cadastrados (com sua procedência) por fator de análise e informa explicitamente
 * quando não há dados suficientes ou quando os dados têm limitações (`notes`).
 *
 * O "indicador numérico" só aparece quando os números apontam, SEM divergência,
 * para o mesmo atleta. A interpretação técnica é responsabilidade do analista.
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
  /** Limitações dos dados deste fator (cobertura, datas, ausência de métrica própria). */
  notes: string[];
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
  /** Lutas concluídas cadastradas no sistema até a data de referência. */
  registeredFights: number;
  /** Total de lutas do cartel informado (V + D + E + NC). */
  cartelFights: number;
  isDemo: boolean;
}

/** Diferença de datas (dias) a partir da qual estatísticas comparadas recebem aviso. */
export const STAT_DATE_GAP_DAYS = 180;

function summarize(p: FighterProfile, ref: Date): FighterSummary {
  const f = p.fighter;
  const refIso = ref.toISOString().slice(0, 10);
  const past = p.completed.filter((h) => !h.event || h.event.date <= refIso);
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
    registeredFights: past.length,
    cartelFights: f.wins + f.losses + f.draws + (f.noContests ?? 0),
    isDemo: f.isDemo,
  };
}

function cmp(a: number | null, b: number | null, higherIsBetter: boolean, tolerance = 0): Edge {
  if (a == null || b == null) return "unknown";
  if (Math.abs(a - b) <= tolerance) return "even";
  return (a > b) === higherIsBetter ? "A" : "B";
}

/** Indicador por unanimidade: só aponta um lado se nenhuma métrica comparável divergir. */
function unanimous(edges: Edge[]): { indicator: Edge; mixed: boolean; a: number; b: number } {
  const comparable = edges.filter((e) => e !== "unknown");
  const a = comparable.filter((e) => e === "A").length;
  const b = comparable.filter((e) => e === "B").length;
  if (!comparable.length) return { indicator: "unknown", mixed: false, a, b };
  if (a && b) return { indicator: "unknown", mixed: true, a, b };
  if (a) return { indicator: "A", mixed: false, a, b };
  if (b) return { indicator: "B", mixed: false, a, b };
  return { indicator: "even", mixed: false, a, b };
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

  /** Aviso de cobertura: histórico cadastrado menor que o cartel informado. */
  const coverageNote = (): string | null => {
    const parts = [sa, sb]
      .filter((s) => s.registeredFights < s.cartelFights)
      .map((s) => `${s.name}: ${s.registeredFights} de ${s.cartelFights} lutas do cartel`);
    return parts.length ? `O histórico cadastrado não cobre todo o cartel (${parts.join("; ")}). Conclusões baseadas no histórico podem estar incompletas.` : null;
  };

  const statFacts = (factorKey: string) => {
    const rows = statRows.filter((r) => STAT_CATALOG.find((d) => d.key === r.key)?.factors.includes(factorKey));
    const facts = rows
      .filter((r) => r.a != null || r.b != null)
      .map((r) => `${r.label}: ${nA} ${fmt(r.a, r.unit)} × ${nB} ${fmt(r.b, r.unit)}`);
    const u = unanimous(rows.map((r) => r.better));
    const notes: string[] = [];
    if (u.mixed) notes.push(`As métricas divergem (${u.a} favorecem ${nA}, ${u.b} favorecem ${nB}); por isso não há indicador numérico.`);
    // A4: datas/fontes diferentes nas métricas comparadas
    for (const r of rows.filter((x) => x.a != null && x.b != null)) {
      const gap = r.asOfA && r.asOfB ? Math.abs(daysBetween(r.asOfA, r.asOfB)) : null;
      if ((gap != null && gap > STAT_DATE_GAP_DAYS) || (r.sourceA && r.sourceB && r.sourceA !== r.sourceB)) {
        notes.push(
          `${r.short}: comparação entre dados de ${r.sourceA ?? "fonte não informada"} (${formatDate(r.asOfA)}) e ${r.sourceB ?? "fonte não informada"} (${formatDate(r.asOfB)}).`,
        );
      }
    }
    return { facts, indicator: u.indicator, notes };
  };

  const factors: FactorFacts[] = ANALYSIS_FACTORS.map((def) => {
    let facts: string[] = [];
    let notes: string[] = [];
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
        if (sa.last3.length < 3 || sb.last3.length < 3) notes.push("Menos de três lutas cadastradas para pelo menos um dos atletas.");
        break;
      }
      case "striking":
      case "wrestling":
      case "defesa_quedas":
      case "jiujitsu": {
        const r = statFacts(def.key);
        facts = r.facts;
        notes = r.notes;
        numericIndicator = r.indicator;
        if (def.key === "jiujitsu" && sa.winsBySub != null && sb.winsBySub != null) {
          facts.push(`Vitórias por finalização no cartel: ${nA} ${sa.winsBySub} × ${nB} ${sb.winsBySub}`);
        }
        break;
      }
      case "grappling": {
        // A1: não há métrica própria de grappling (tempo de controle, raspagens, reversões).
        // Mostra apenas contexto, sem indicador, para não duplicar Wrestling/Jiu-jitsu.
        const ctx = statRows.filter((r) => ["td_avg", "sub_avg"].includes(r.key) && (r.a != null || r.b != null));
        facts = ctx.map((r) => `${r.label} (contexto): ${nA} ${fmt(r.a, r.unit)} × ${nB} ${fmt(r.b, r.unit)}`);
        notes.push("Sem métrica própria de grappling cadastrada (tempo de controle, raspagens, reversões). Os números acima são contexto de Wrestling e Jiu-jitsu — avalie pela observação das lutas.");
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
          notes.push("Nocautes dependem do nível dos adversários; considere a qualidade de quem foi nocauteado.");
        }
        break;
      }
      case "queixo": {
        const r = statFacts("queixo");
        facts = r.facts;
        notes = r.notes;
        numericIndicator = r.indicator;
        if (A.completed.length || B.completed.length) {
          facts.push(`Derrotas por KO/TKO nas lutas cadastradas no sistema: ${nA} ${sa.lossesByKo} × ${nB} ${sb.lossesByKo}`);
          const cov = coverageNote();
          if (cov) notes.push(cov);
        }
        notes.push("SApM mede golpes absorvidos, não resistência a eles; é um indicador indireto do queixo.");
        break;
      }
      case "tamanho_envergadura": {
        if (sa.heightCm != null || sb.heightCm != null || sa.reachCm != null || sb.reachCm != null) {
          facts.push(`Altura: ${nA} ${fmt(sa.heightCm, " cm")} × ${nB} ${fmt(sb.heightCm, " cm")}`);
          facts.push(`Envergadura: ${nA} ${fmt(sa.reachCm, " cm")} × ${nB} ${fmt(sb.reachCm, " cm")}`);
          if (sa.reachCm != null && sb.reachCm != null) {
            const d = sa.reachCm - sb.reachCm;
            facts.push(d === 0 ? "Envergaduras iguais." : `Diferença de envergadura: ${Math.abs(d)} cm a favor de ${d > 0 ? nA : nB}`);
          }
          numericIndicator = cmp(sa.reachCm, sb.reachCm, true, 2);
        }
        break;
      }
      case "idade": {
        if (sa.age != null || sb.age != null) {
          facts.push(`Idade na data de referência (${formatDate(ref.toISOString().slice(0, 10))}): ${nA} ${fmt(sa.age, " anos")} × ${nB} ${fmt(sb.age, " anos")}`);
        }
        // Sem indicador: idade isolada não define vantagem.
        break;
      }
      case "inatividade": {
        if (sa.lastFightDate || sb.lastFightDate) {
          facts.push(
            `Última luta registrada: ${nA} ${sa.lastFightDate ? `${formatDate(sa.lastFightDate)} (${sa.daysSinceLastFight} dias)` : "sem registro"} × ${nB} ${sb.lastFightDate ? `${formatDate(sb.lastFightDate)} (${sb.daysSinceLastFight} dias)` : "sem registro"}`,
          );
          // A5: sem indicador — pouco tempo parado pode significar desgaste; muito, falta de ritmo ou recuperação.
          notes.push("Sem indicador: o efeito da inatividade depende do motivo (lesão, recuperação, contrato) e não é linear.");
          const cov = coverageNote();
          if (cov) notes.push(cov);
        }
        break;
      }
      default:
        // qualidade_adversarios, cardio, lesoes, corte_peso, camp: não há dados estruturados.
        break;
    }

    if (def.key === "ultimas3" && facts.length) {
      const cov = coverageNote();
      if (cov) notes.push(cov);
    }

    return {
      key: def.key,
      label: def.label,
      group: def.group,
      guide: def.guide,
      facts,
      notes,
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
