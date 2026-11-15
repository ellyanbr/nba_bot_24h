"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data";
import type { PredictionStatus } from "@/lib/domain/types";
import { nowIso } from "@/lib/utils";

/** Resolução manual (para previsões sem luta vinculada ou correções). */
export async function resolvePrediction(id: string, status: PredictionStatus) {
  const store = getStore();
  const p = await store.get("predictions", id);
  if (!p) return;
  const now = nowIso();
  await store.update("predictions", id, {
    status,
    resolvedAt: status === "pending" ? null : now,
    actualWinnerId:
      status === "correct" ? p.pickFighterId : status === "incorrect" ? (p.pickFighterId === p.fighterAId ? p.fighterBId : p.fighterAId) : null,
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
}

export async function deletePrediction(id: string) {
  const store = getStore();
  await store.removeWhere("bets", { predictionId: id });
  await store.remove("predictions", id);
  revalidatePath("/", "layout");
}
