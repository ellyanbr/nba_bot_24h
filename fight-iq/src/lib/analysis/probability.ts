/**
 * Probabilidades, odds e valor esperado.
 *
 * Convenções: probabilidades em PORCENTAGEM (0–100) na interface e no banco;
 * odds no formato DECIMAL (ex.: 1,85). Nenhum cálculo aqui usa IA ou dados externos.
 *
 * Distinção central:
 *  - "Sem valor esperado" é uma conclusão sobre a SUA estimativa frente ao preço.
 *  - "Inconsistência de mercado" é uma propriedade dos PREÇOS, independente da sua opinião.
 */

export type Side = "A" | "B" | "draw";
export const SIDES: Side[] = ["A", "B", "draw"];

export interface Estimate {
  A: number;
  B: number;
  /** 0 quando o usuário não considera o empate. */
  draw: number;
}

export interface MarketOdds {
  bookmaker: string;
  A: number;
  B: number;
  /** Mercado de 3 vias (com empate) quando informado. */
  draw: number | null;
}

/** Probabilidade implícita bruta (%), sem remover a margem: 100 / odds. */
export function impliedPct(odds: number): number | null {
  if (!Number.isFinite(odds) || odds <= 1) return null;
  return 100 / odds;
}

/** Odds justas para uma probabilidade (%): 100 / p. */
export function fairOdds(pct: number): number | null {
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return 100 / pct;
}

/** Valor esperado por unidade apostada: p × odds − 1 (ex.: 0,08 = +8%). */
export function expectedValue(pct: number, odds: number): number {
  return (pct / 100) * odds - 1;
}

export function validateEstimate(e: Estimate): string | null {
  for (const s of SIDES) {
    if (!Number.isFinite(e[s]) || e[s] < 0 || e[s] > 100) return "Cada probabilidade deve estar entre 0% e 100%.";
  }
  const sum = e.A + e.B + e.draw;
  if (Math.abs(sum - 100) > 0.5) return `As probabilidades somam ${sum.toFixed(1)}%; devem somar 100%.`;
  return null;
}

export interface MarketAnalysis {
  bookmaker: string;
  sides: Side[];
  /** Probabilidade implícita bruta (%), por lado. */
  implied: Partial<Record<Side, number>>;
  /** Soma das implícitas − 100 (p.p.). Positiva = margem da casa. */
  overround: number;
  /** Probabilidade sem margem (%), método proporcional: implícita / soma das implícitas. */
  noVig: Partial<Record<Side, number>>;
}

export function analyzeMarket(m: MarketOdds): MarketAnalysis | null {
  const sides: Side[] = m.draw != null ? ["A", "B", "draw"] : ["A", "B"];
  const implied: Partial<Record<Side, number>> = {};
  for (const s of sides) {
    const ip = impliedPct(m[s] as number);
    if (ip == null) return null;
    implied[s] = ip;
  }
  const total = sides.reduce((acc, s) => acc + implied[s]!, 0);
  const noVig: Partial<Record<Side, number>> = {};
  for (const s of sides) noVig[s] = (implied[s]! / total) * 100;
  return { bookmaker: m.bookmaker, sides, implied, overround: total - 100, noVig };
}

export interface ValueRow {
  side: Side;
  estimate: number;
  fairOdds: number | null;
  /** Melhor odd disponível entre as casas registradas. */
  bestOdds: number | null;
  bestBookmaker: string | null;
  /** Valor esperado na melhor odd (fração; 0,05 = +5%). */
  ev: number | null;
  /** Probabilidade de consenso do mercado sem margem (%; média entre casas). */
  marketNoVig: number | null;
  /** Sua estimativa − consenso sem margem (p.p.). */
  edge: number | null;
}

export function valueTable(est: Estimate, markets: MarketOdds[]): ValueRow[] {
  const analyses = markets.map(analyzeMarket).filter((a): a is MarketAnalysis => a != null);
  const sides: Side[] = est.draw > 0 || markets.some((m) => m.draw != null) ? ["A", "B", "draw"] : ["A", "B"];
  return sides.map((side) => {
    let bestOdds: number | null = null;
    let bestBookmaker: string | null = null;
    for (const m of markets) {
      const o = m[side];
      if (o != null && impliedPct(o) != null && (bestOdds == null || o > bestOdds)) {
        bestOdds = o;
        bestBookmaker = m.bookmaker;
      }
    }
    const nv = analyses.map((a) => a.noVig[side]).filter((v): v is number => v != null);
    const marketNoVig = nv.length ? nv.reduce((a, b) => a + b, 0) / nv.length : null;
    return {
      side,
      estimate: est[side],
      fairOdds: fairOdds(est[side]),
      bestOdds,
      bestBookmaker,
      ev: bestOdds != null ? expectedValue(est[side], bestOdds) : null,
      marketNoVig,
      edge: marketNoVig != null ? est[side] - marketNoVig : null,
    };
  });
}

export interface Flag {
  level: "alerta" | "atencao" | "info";
  text: string;
}

/** Limiares explícitos (ajustáveis) usados nas verificações. */
export const THRESHOLDS = {
  /** Margem acima disso (p.p.) é considerada alta para mercados de vitória em MMA. */
  highOverround: 10,
  /** Diferença entre casas, na probabilidade sem margem, que indica preços desalinhados (p.p.). */
  bookDivergence: 5,
  /** Diferença entre sua estimativa e o consenso que merece revisão (p.p.). */
  largeEdge: 15,
};

/** Inconsistências dos PREÇOS — não dependem da sua estimativa. */
export function marketFlags(markets: MarketOdds[]): Flag[] {
  const out: Flag[] = [];
  const analyses = markets.map((m) => ({ m, a: analyzeMarket(m) }));
  for (const { m, a } of analyses) {
    if (!a) {
      out.push({ level: "alerta", text: `${m.bookmaker || "Casa sem nome"}: odds inválidas (devem ser maiores que 1,00).` });
      continue;
    }
    if (a.overround < 0) {
      out.push({ level: "alerta", text: `${m.bookmaker}: a soma das probabilidades implícitas é ${(100 + a.overround).toFixed(1)}% (abaixo de 100%). Confira se as odds foram digitadas corretamente.` });
    } else if (a.overround > THRESHOLDS.highOverround) {
      out.push({ level: "atencao", text: `${m.bookmaker}: margem da casa de ${a.overround.toFixed(1)}%, acima de ${THRESHOLDS.highOverround}%. O preço embute um custo alto.` });
    }
  }
  const valid = analyses.filter((x) => x.a != null);
  if (valid.length >= 2) {
    // Arbitragem: melhores odds de cada lado, entre casas diferentes, somam menos de 100%.
    const threeWay = valid.every((x) => x.m.draw != null);
    const sides: Side[] = threeWay ? ["A", "B", "draw"] : ["A", "B"];
    const best = sides.map((s) => Math.max(...valid.map((x) => x.m[s] as number)));
    const sum = best.reduce((acc, o) => acc + 100 / o, 0);
    if (sum < 100) {
      out.push({ level: "alerta", text: `As melhores odds entre as casas somam ${sum.toFixed(1)}% de probabilidade implícita (arbitragem). Situação rara: confirme as odds e o horário de cada registro.` });
    }
    for (const s of ["A", "B"] as Side[]) {
      const vals = valid.map((x) => x.a!.noVig[s]!);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread > THRESHOLDS.bookDivergence) {
        out.push({ level: "atencao", text: `As casas divergem ${spread.toFixed(1)} p.p. na probabilidade sem margem do atleta ${s}. Verifique se os registros são do mesmo momento.` });
      }
    }
  }
  return out;
}

/** Conclusões sobre a SUA estimativa frente aos preços registrados. */
export function valueFlags(rows: ValueRow[], names: Record<Side, string>): Flag[] {
  const out: Flag[] = [];
  for (const r of rows) {
    if (r.ev == null || r.estimate <= 0) continue;
    const ev = (r.ev * 100).toFixed(1);
    if (r.ev > 0) {
      out.push({ level: "info", text: `${names[r.side]}: valor esperado de +${ev}% na melhor odd (${r.bestOdds!.toFixed(2)}, ${r.bestBookmaker}) — pela sua estimativa de ${r.estimate.toFixed(1)}%. Odds justas: ${r.fairOdds!.toFixed(2)}.` });
    } else {
      out.push({ level: "info", text: `${names[r.side]}: sem valor esperado pela sua estimativa (${ev}% na melhor odd ${r.bestOdds!.toFixed(2)}). Para valer a pena, as odds precisariam ser maiores que ${r.fairOdds!.toFixed(2)}.` });
    }
    if (r.edge != null && Math.abs(r.edge) > THRESHOLDS.largeEdge) {
      out.push({
        level: "atencao",
        text: `${names[r.side]}: sua estimativa difere ${Math.abs(r.edge).toFixed(1)} p.p. do consenso do mercado sem margem (${r.marketNoVig!.toFixed(1)}%). Diferenças grandes costumam refletir informação que o mercado já precificou (lesão, corte de peso, troca de adversário). Revise antes de confiar nela.`,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Calibração                                                           */
/* ------------------------------------------------------------------ */

/**
 * Brier score multiclasse (A, B, empate): soma de (p − resultado)² com p em 0–1.
 * 0 = perfeito; 2 = pior possível. Prever 50/50 sempre resulta em 0,5.
 */
export function brierScore(est: Estimate, outcome: Side): number {
  return SIDES.reduce((acc, s) => acc + (est[s] / 100 - (s === outcome ? 1 : 0)) ** 2, 0);
}

/** Log loss: −ln(p do resultado ocorrido). Probabilidade 0 é limitada a 0,1% para evitar infinito. */
export function logLoss(est: Estimate, outcome: Side): number {
  return -Math.log(Math.max(est[outcome] / 100, 0.001));
}
