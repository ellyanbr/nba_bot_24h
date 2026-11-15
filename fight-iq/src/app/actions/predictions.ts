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
 * Previsões resolvidas automaticamente (resultado oficial ou luta cancelada) não aceitam
 * marcação manual.
 */
export async function resolvePrediction(id: string, status: PredictionStatus): Promise<{ ok: boolean; message?: string }> {
  return getStore().atomic(async (tx) => {
    const p = await tx.get("predictions", id);
    if (!p) return { ok: false, message: "Previsão não encontrada." };
    if (p.resolution === "auto") {
      return { ok: false, message: "Esta previsão foi resolvida automaticamente (resultado oficial ou luta cancelada). Altere o resultado ou o status da luta no evento." };
    }
    if (p.fightId && (await tx.list("fight_results", { fightId: p.fightId })).length) {
      return { ok: false, message: "Esta luta já tem resultado oficial; a previsão é corrigida automaticamente por ele. Edite o resultado no evento, se necessário." };
    }
    const now = nowIso();
    const pending = status === "pending";
    await tx.update("predictions", id, {
      status,
      resolution: pending ? null : "manual",
      voidReason: status === "void" ? "manual" : null,
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
    for (const b of await tx.list("bets", { predictionId: id })) {
      await tx.update("bets", b.id, {
        status: status === "correct" ? "won" : status === "incorrect" ? "lost" : status === "void" ? "void" : "open",
        updatedAt: now,
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function deletePrediction(id: string) {
  await getStore().atomic(async (tx) => {
    await tx.removeWhere("bets", { predictionId: id });
    await tx.remove("predictions", id);
  });
  revalidatePath("/", "layout");
}
