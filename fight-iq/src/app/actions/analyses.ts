"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAIProvider, getAIStatus } from "@/lib/ai";
import { buildAnalysisMessages, type PromptUserDraft } from "@/lib/ai/prompt";
import { buildComparison } from "@/lib/analysis/comparison";
import { getStore } from "@/lib/data";
import { ANALYSIS_FACTORS } from "@/lib/domain/catalog";
import { RESULT_METHODS, type AIOutput, type Bet, type FightAnalysis, type Prediction } from "@/lib/domain/types";
import { getFighterProfile } from "@/lib/services/queries";
import { newId, nowIso } from "@/lib/utils";

const EdgeEnum = z.enum(["A", "B", "even", "unknown"]);

const DraftSchema = z.object({
  fighterAId: z.string().min(1),
  fighterBId: z.string().min(1),
  fightId: z.string().nullable(),
  title: z.string().max(200),
  factors: z.array(
    z.object({
      factorKey: z.string(),
      edge: EdgeEnum,
      basis: z.enum(["fato", "interpretacao"]),
      notes: z.string().max(4000),
    }),
  ),
  pathsToVictoryA: z.string().max(8000),
  pathsToVictoryB: z.string().max(8000),
  argumentsA: z.string().max(8000),
  argumentsB: z.string().max(8000),
  vulnerabilitiesA: z.string().max(8000),
  vulnerabilitiesB: z.string().max(8000),
  morePaths: EdgeEnum,
  summary: z.string().max(8000),
  aiOutput: z
    .object({ provider: z.string(), model: z.string(), content: z.string(), generatedAt: z.string() })
    .nullable(),
  prediction: z
    .object({
      pick: z.enum(["A", "B"]),
      method: z.enum(["Qualquer", ...RESULT_METHODS] as [string, ...string[]]),
      round: z.number().int().min(1).max(5).nullable(),
      confidence: z.number().int().min(0).max(100),
      notes: z.string().max(4000).nullable(),
      decimalOdds: z.number().gt(1, "Odds devem ser maiores que 1,00").nullable(),
      bookmaker: z.string().max(120).nullable(),
      stake: z.number().min(0).nullable(),
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
      confidence: p.confidence,
      notes: p.notes,
      status: "pending",
      actualWinnerId: null,
      actualMethod: null,
      resolvedAt: null,
      containsDemoData: comparison.containsDemo,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("predictions", prediction);
    if (p.decimalOdds != null) {
      const bet: Bet = {
        id: newId(),
        predictionId: prediction.id,
        decimalOdds: p.decimalOdds,
        stake: p.stake,
        bookmaker: p.bookmaker,
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
