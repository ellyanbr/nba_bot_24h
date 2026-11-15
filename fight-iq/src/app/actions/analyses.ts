"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAIProvider, getAIStatus } from "@/lib/ai";
import { buildAnalysisMessages, type PromptUserDraft } from "@/lib/ai/prompt";
import { buildComparison } from "@/lib/analysis/comparison";
import { validateEstimate } from "@/lib/analysis/probability";
import { getStore } from "@/lib/data";
import { ANALYSIS_FACTORS } from "@/lib/domain/catalog";
import { RESULT_METHODS, type AIOutput, type Bet, type FightAnalysis, type OddsSnapshot, type Prediction } from "@/lib/domain/types";
import { getFighterProfile } from "@/lib/services/queries";
import { newId, nowIso } from "@/lib/utils";

const EdgeEnum = z.enum(["A", "B", "even", "unknown"]);
const pct = z.number({ invalid_type_error: "Probabilidade inválida" }).min(0, "Mínimo 0%").max(100, "Máximo 100%");
const odds = z.number({ invalid_type_error: "Odds inválidas" }).gt(1, "Odds devem ser maiores que 1,00").lt(1000, "Odds fora do esperado");

// Todos os arrays têm tamanho máximo (mitigação do alerta de consumo de memória do Zod).
const DraftSchema = z.object({
  fighterAId: z.string().min(1),
  fighterBId: z.string().min(1),
  fightId: z.string().nullable(),
  title: z.string().max(200),
  factors: z
    .array(
      z.object({
        factorKey: z.string().max(60),
        edge: EdgeEnum,
        basis: z.enum(["fato", "interpretacao"]),
        notes: z.string().max(4000),
      }),
    )
    .max(ANALYSIS_FACTORS.length),
  pathsToVictoryA: z.string().max(8000),
  pathsToVictoryB: z.string().max(8000),
  argumentsA: z.string().max(8000),
  argumentsB: z.string().max(8000),
  vulnerabilitiesA: z.string().max(8000),
  vulnerabilitiesB: z.string().max(8000),
  morePaths: EdgeEnum,
  summary: z.string().max(8000),
  aiOutput: z
    .object({ provider: z.string().max(100), model: z.string().max(200), content: z.string().max(100_000), generatedAt: z.string().max(40) })
    .nullable(),
  /** Odds de mercado (vitória), dos dois lados, por casa. */
  odds: z
    .array(
      z.object({
        bookmaker: z.string().trim().min(1, "Informe o nome da casa").max(120),
        oddsA: odds,
        oddsB: odds,
        oddsDraw: odds.nullable(),
        capturedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data/hora inválida"),
      }),
    )
    .max(20, "No máximo 20 casas por análise"),
  prediction: z
    .object({
      pick: z.enum(["A", "B"]),
      method: z.enum(["Qualquer", ...RESULT_METHODS] as [string, ...string[]]),
      round: z.number().int().min(1).max(5).nullable(),
      probabilityA: pct,
      probabilityB: pct,
      probabilityDraw: pct,
      /** Probabilidade da previsão completa; ignorada (= prob. do escolhido) sem método/round. */
      confidence: pct.nullable(),
      notes: z.string().max(4000).nullable(),
      /** Aposta registrada: índice da casa em `odds` e valor. */
      bet: z.object({ oddsIndex: z.number().int().min(0), stake: z.number().min(0).nullable() }).nullable(),
    })
    .nullable(),
});

export type AnalysisDraft = z.infer<typeof DraftSchema>;

export interface SaveAnalysisResult {
  ok: boolean;
  message: string;
  analysisId?: string;
}

export async function saveAnalysis(input: AnalysisDraft): Promise<SaveAnalysisResult> {
  const parsed = DraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  if (d.fighterAId === d.fighterBId) return { ok: false, message: "Selecione dois atletas diferentes." };

  // Validação da previsão antes de gravar qualquer coisa.
  let pickProbability = 0;
  let fullProbability = 0;
  if (d.prediction) {
    const p = d.prediction;
    const err = validateEstimate({ A: p.probabilityA, B: p.probabilityB, draw: p.probabilityDraw });
    if (err) return { ok: false, message: err };
    pickProbability = p.pick === "A" ? p.probabilityA : p.probabilityB;
    if (pickProbability <= 0) return { ok: false, message: "O atleta escolhido não pode ter probabilidade 0%." };
    const hasDetail = p.method !== "Qualquer" || p.round != null;
    if (hasDetail) {
      if (p.confidence == null || p.confidence <= 0) return { ok: false, message: "Informe a probabilidade da previsão completa (com método/round)." };
      if (p.confidence > pickProbability + 0.5) {
        return { ok: false, message: `A previsão com método/round (${p.confidence}%) não pode ser mais provável que a vitória do atleta (${pickProbability}%).` };
      }
      fullProbability = p.confidence;
    } else fullProbability = pickProbability;
    if (p.bet && !d.odds[p.bet.oddsIndex]) return { ok: false, message: "A aposta deve usar uma das odds registradas." };
  }

  const [pa, pb] = await Promise.all([getFighterProfile(d.fighterAId), getFighterProfile(d.fighterBId)]);
  if (!pa || !pb) return { ok: false, message: "Atleta não encontrado." };
  if (pa.fighter.isDemo !== pb.fighter.isDemo) {
    return { ok: false, message: "Não é possível salvar: a análise mistura um atleta de DEMONSTRAÇÃO com um atleta real." };
  }
  const store = getStore();
  let fightDate: string | undefined;
  if (d.fightId) {
    const fight = await store.get("fights", d.fightId);
    const ids = fight ? [fight.redFighterId, fight.blueFighterId] : [];
    if (!fight || !ids.includes(d.fighterAId) || !ids.includes(d.fighterBId)) {
      return { ok: false, message: "A luta selecionada não corresponde aos atletas." };
    }
    fightDate = (await store.get("events", fight.eventId))?.date;
  }
  const comparison = buildComparison(pa, pb, fightDate);
  const now = nowIso();
  const validKeys = new Set(ANALYSIS_FACTORS.map((f) => f.key));

  const analysis: FightAnalysis = {
    id: newId(),
    fightId: d.fightId,
    fighterAId: d.fighterAId,
    fighterBId: d.fighterBId,
    title: d.title.trim() || `${pa.fighter.name} × ${pb.fighter.name}`,
    factors: d.factors.filter((f) => validKeys.has(f.factorKey)),
    pathsToVictoryA: d.pathsToVictoryA,
    pathsToVictoryB: d.pathsToVictoryB,
    argumentsA: d.argumentsA,
    argumentsB: d.argumentsB,
    vulnerabilitiesA: d.vulnerabilitiesA,
    vulnerabilitiesB: d.vulnerabilitiesB,
    morePaths: d.morePaths,
    summary: d.summary,
    aiOutput: d.aiOutput,
    dataSnapshot: comparison,
    containsDemoData: comparison.containsDemo,
    createdAt: now,
    updatedAt: now,
  };
  await store.insert("fight_analyses", analysis);

  const snapshots: OddsSnapshot[] = d.odds.map((o) => ({
    id: newId(),
    analysisId: analysis.id,
    fightId: d.fightId,
    fighterAId: d.fighterAId,
    fighterBId: d.fighterBId,
    bookmaker: o.bookmaker,
    oddsA: o.oddsA,
    oddsB: o.oddsB,
    oddsDraw: o.oddsDraw,
    capturedAt: new Date(o.capturedAt).toISOString(),
    containsDemoData: comparison.containsDemo,
    createdAt: now,
    updatedAt: now,
  }));
  if (snapshots.length) await store.insertMany("odds_snapshots", snapshots);

  if (d.prediction) {
    const p = d.prediction;
    const prediction: Prediction = {
      id: newId(),
      analysisId: analysis.id,
      fightId: d.fightId,
      fighterAId: d.fighterAId,
      fighterBId: d.fighterBId,
      pickFighterId: p.pick === "A" ? d.fighterAId : d.fighterBId,
      method: p.method as Prediction["method"],
      round: p.round,
      probabilityA: p.probabilityA,
      probabilityB: p.probabilityB,
      probabilityDraw: p.probabilityDraw,
      confidence: fullProbability,
      notes: p.notes,
      status: "pending",
      resolution: null,
      winnerCorrect: null,
      methodCorrect: null,
      roundCorrect: null,
      actualWinnerId: null,
      actualMethod: null,
      actualRound: null,
      resolvedAt: null,
      containsDemoData: comparison.containsDemo,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("predictions", prediction);
    if (p.bet) {
      const snap = snapshots[p.bet.oddsIndex];
      const bet: Bet = {
        id: newId(),
        predictionId: prediction.id,
        decimalOdds: p.pick === "A" ? snap.oddsA : snap.oddsB,
        stake: p.bet.stake,
        bookmaker: snap.bookmaker,
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      await store.insert("bets", bet);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Análise salva no histórico.", analysisId: analysis.id };
}

export async function deleteAnalysis(id: string) {
  const store = getStore();
  const preds = await store.list("predictions", { analysisId: id });
  for (const p of preds) await store.update("predictions", p.id, { analysisId: null, updatedAt: nowIso() });
  await store.removeWhere("odds_snapshots", { analysisId: id });
  await store.remove("fight_analyses", id);
  revalidatePath("/", "layout");
}

export interface AIRunResult {
  ok: boolean;
  message: string;
  output?: AIOutput;
}

/** Executa a análise com o provedor de IA configurado. Sem provedor, retorna a limitação claramente. */
export async function runAIAnalysis(input: {
  fighterAId: string;
  fighterBId: string;
  fightId: string | null;
  draft: PromptUserDraft | null;
}): Promise<AIRunResult> {
  const status = getAIStatus();
  const provider = getAIProvider();
  if (!provider) return { ok: false, message: `IA indisponível: ${status.message}` };

  const [pa, pb] = await Promise.all([getFighterProfile(input.fighterAId), getFighterProfile(input.fighterBId)]);
  if (!pa || !pb) return { ok: false, message: "Atleta não encontrado." };
  let fightDate: string | undefined;
  if (input.fightId) {
    const fight = await getStore().get("fights", input.fightId);
    if (fight) fightDate = (await getStore().get("events", fight.eventId))?.date;
  }
  const comparison = buildComparison(pa, pb, fightDate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? 180_000));
  try {
    const res = await provider.complete(buildAnalysisMessages(comparison, input.draft), { signal: controller.signal });
    return {
      ok: true,
      message: "Análise da IA gerada.",
      output: { provider: res.provider, model: res.model, content: res.content, generatedAt: nowIso() },
    };
  } catch (err) {
    const msg = (err as Error).name === "AbortError" ? "Tempo limite excedido." : (err as Error).message;
    return { ok: false, message: `Falha ao consultar ${status.label}: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}
