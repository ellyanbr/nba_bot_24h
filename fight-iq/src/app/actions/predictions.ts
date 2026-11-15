"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data";
import type { PredictionStatus } from "@/lib/domain/types";
import { nowIso } from "@/lib/utils";

/**
 * Resolução manual — para previsões sem luta vinculada ou cuja luta ainda não tem
 * resultado oficial cadastrado.
 *
 * Registra APENAS a marcação do usuário. Não preenche vencedor, método ou round reais:
 * esses campos só são gravados a partir de um resultado oficial com fonte.
 * Se a luta vinculada já tem resultado oficial, a resolução manual é recusada.
 */
export async function resolvePrediction(id: string, status: PredictionStatus): Promise<{ ok: boolean; message?: string }> {
  const store = getStore();
  const p = await store.get("predictions", id);
  if (!p) return { ok: false, message: "Previsão não encontrada." };
  if (p.fightId) {
    const official = (await store.list("fight_results", { fightId: p.fightId }))[0];
    if (official) {
      return { ok: false, message: "Esta luta já tem resultado oficial; a previsão é corrigida automaticamente por ele. Edite o resultado no evento, se necessário." };
    }
  }
  const now = nowIso();
  const pending = status === "pending";
  await store.update("predictions", id, {
    status,
    resolution: pending ? null : "manual",
    // Na marcação manual sabemos apenas se o usuário considera que acertou.
    winnerCorrect: null,
    methodCorrect: null,
    roundCorrect: null,
    actualWinnerId: null,
    actualMethod: null,
    actualRound: null,
    resolvedAt: pending ? null : now,
    updatedAt: now,
  });
  const bets = await store.list("bets", { predictionId: id });
  for (const b of bets) {
    await store.update("bets", b.id, {
      status: status === "correct" ? "won" : status === "incorrect" ? "lost" : status === "void" ? "void" : "open",
      updatedAt: now,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePrediction(id: string) {
  const store = getStore();
  await store.removeWhere("bets", { predictionId: id });
  await store.remove("predictions", id);
  revalidatePath("/", "layout");
}
