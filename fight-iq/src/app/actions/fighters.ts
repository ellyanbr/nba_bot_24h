"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { statByKey } from "@/lib/domain/catalog";
import type { Fighter, FighterStatistic } from "@/lib/domain/types";
import { newId, nowIso } from "@/lib/utils";
import { bool, keepValues, num, str, zodErrors, type ActionState } from "@/lib/utils/form";

const nonNeg = z.number({ invalid_type_error: "Número inválido" }).int("Use número inteiro").min(0, "Não pode ser negativo");
const optNonNeg = nonNeg.nullable();
const optPositive = z.number({ invalid_type_error: "Número inválido" }).positive("Deve ser positivo").max(260, "Valor fora do esperado").nullable();

const FighterSchema = z
  .object({
    name: z.string({ required_error: "Informe o nome", invalid_type_error: "Informe o nome" }).min(2, "Informe o nome"),
    nickname: z.string().nullable(),
    organizationId: z.string().nullable(),
    nationality: z.string().nullable(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable(),
    heightCm: optPositive,
    reachCm: optPositive,
    stance: z.enum(["Ortodoxo", "Canhoto", "Trocador de base", "Outro"]).nullable(),
    weightClass: z.string().nullable(),
    team: z.string().nullable(),
    wins: nonNeg,
    losses: nonNeg,
    draws: nonNeg,
    noContests: nonNeg,
    winsByKo: optNonNeg,
    winsBySub: optNonNeg,
    winsByDec: optNonNeg,
    active: z.boolean(),
    notes: z.string().nullable(),
    sourceId: z.string({ required_error: "Informe a fonte dos dados", invalid_type_error: "Informe a fonte dos dados" }).min(1, "Informe a fonte dos dados"),
  })
  .refine((d) => (d.winsByKo ?? 0) + (d.winsBySub ?? 0) + (d.winsByDec ?? 0) <= d.wins, {
    message: "A soma de vitórias por método excede o total de vitórias",
    path: ["winsByKo"],
  });

export async function saveFighter(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await saveFighterImpl(prev, fd));
}

async function saveFighterImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const parsed = FighterSchema.safeParse({
    name: str(fd, "name"),
    nickname: str(fd, "nickname"),
    organizationId: str(fd, "organizationId"),
    nationality: str(fd, "nationality"),
    birthDate: str(fd, "birthDate"),
    heightCm: num(fd, "heightCm"),
    reachCm: num(fd, "reachCm"),
    stance: str(fd, "stance"),
    weightClass: str(fd, "weightClass"),
    team: str(fd, "team"),
    wins: num(fd, "wins") ?? 0,
    losses: num(fd, "losses") ?? 0,
    draws: num(fd, "draws") ?? 0,
    noContests: num(fd, "noContests") ?? 0,
    winsByKo: num(fd, "winsByKo"),
    winsBySub: num(fd, "winsBySub"),
    winsByDec: num(fd, "winsByDec"),
    active: bool(fd, "active"),
    notes: str(fd, "notes"),
    sourceId: str(fd, "sourceId"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos destacados.", errors: zodErrors(parsed.error.issues) };

  const store = getStore();
  const source = await store.get("data_sources", parsed.data.sourceId);
  if (!source) return { ok: false, errors: { sourceId: "Fonte não encontrada" } };
  if (parsed.data.organizationId) {
    const org = await store.get("organizations", parsed.data.organizationId);
    if (!org) return { ok: false, errors: { organizationId: "Organização não encontrada" } };
    if (org.isDemo !== source.isDemo) {
      return { ok: false, errors: { sourceId: "Organização e fonte devem ser ambas de demonstração ou ambas reais." } };
    }
  }
  const now = nowIso();
  let savedId = id;
  if (id) {
    const existing = await store.get("fighters", id);
    if (!existing) return { ok: false, message: "Atleta não encontrado." };
    if (existing.isDemo !== source.isDemo) {
      // Mudar a natureza (demo ↔ real) deixaria estatísticas, lutas e análises misturadas.
      const linked = await fighterLinks(id);
      if (linked) {
        return { ok: false, errors: { sourceId: `Não é possível trocar entre fonte de demonstração e fonte real: o atleta já tem ${linked}.` } };
      }
    }
    await store.update("fighters", id, { ...parsed.data, isDemo: source.isDemo, updatedAt: now });
  } else {
    const fighter: Fighter = { id: newId(), ...parsed.data, isDemo: source.isDemo, createdAt: now, updatedAt: now };
    await store.insert("fighters", fighter);
    savedId = fighter.id;
  }
  revalidatePath("/", "layout");
  redirect(`/lutadores/${savedId}`);
}

/** Descreve registros vinculados ao atleta (ou null se não houver). */
async function fighterLinks(id: string): Promise<string | null> {
  const store = getStore();
  const [stats, red, blue, analyses, preds] = await Promise.all([
    store.list("fighter_statistics", { fighterId: id }),
    store.list("fights", { redFighterId: id }),
    store.list("fights", { blueFighterId: id }),
    store.list("fight_analyses"),
    store.list("predictions"),
  ]);
  const parts: string[] = [];
  if (stats.length) parts.push(`${stats.length} estatística(s)`);
  if (red.length + blue.length) parts.push(`${red.length + blue.length} luta(s)`);
  const nA = analyses.filter((a) => a.fighterAId === id || a.fighterBId === id).length;
  const nP = preds.filter((p) => p.fighterAId === id || p.fighterBId === id).length;
  if (nA + nP) parts.push(`${nA + nP} análise(s)/previsão(ões)`);
  return parts.length ? parts.join(", ") : null;
}

export async function deleteFighter(id: string): Promise<ActionState> {
  const store = getStore();
  const [red, blue] = await Promise.all([
    store.list("fights", { redFighterId: id }),
    store.list("fights", { blueFighterId: id }),
  ]);
  if (red.length || blue.length) {
    return { ok: false, message: `Não é possível excluir: o atleta participa de ${red.length + blue.length} luta(s). Exclua as lutas primeiro.` };
  }
  for (const t of ["predictions", "fight_analyses"] as const) {
    const rows = await store.list(t);
    for (const r of rows) {
      if (r.fighterAId === id || r.fighterBId === id) {
        return { ok: false, message: "Não é possível excluir: há análises ou previsões com este atleta no histórico." };
      }
    }
  }
  await store.removeWhere("fighter_statistics", { fighterId: id });
  await store.remove("fighters", id);
  revalidatePath("/", "layout");
  redirect("/lutadores");
}

const StatSchema = z.object({
  fighterId: z.string().min(1),
  statKey: z.string().refine((k) => Boolean(statByKey(k)), "Estatística inválida"),
  value: z.number({ invalid_type_error: "Informe um número" }).min(0, "Não pode ser negativo"),
  asOf: z.string({ required_error: "Informe a data de atualização", invalid_type_error: "Informe a data de atualização" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de atualização"),
  sourceId: z.string({ required_error: "Informe a fonte", invalid_type_error: "Informe a fonte" }).min(1, "Informe a fonte"),
});

export async function saveFighterStat(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await saveFighterStatImpl(prev, fd));
}

async function saveFighterStatImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = StatSchema.safeParse({
    fighterId: str(fd, "fighterId"),
    statKey: str(fd, "statKey"),
    value: num(fd, "value"),
    asOf: str(fd, "asOf"),
    sourceId: str(fd, "sourceId"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos.", errors: zodErrors(parsed.error.issues) };
  const def = statByKey(parsed.data.statKey)!;
  if (def.unit === "%" && parsed.data.value > 100) return { ok: false, errors: { value: "Percentual deve estar entre 0 e 100" } };

  const store = getStore();
  const [fighter, source] = await Promise.all([
    store.get("fighters", parsed.data.fighterId),
    store.get("data_sources", parsed.data.sourceId),
  ]);
  if (!fighter) return { ok: false, message: "Atleta não encontrado." };
  if (!source) return { ok: false, errors: { sourceId: "Fonte não encontrada" } };
  if (source.isDemo !== fighter.isDemo) {
    return { ok: false, errors: { sourceId: "Não misture dados de demonstração com dados reais: a fonte e o atleta devem ter a mesma natureza." } };
  }
  const now = nowIso();
  const existing = (await store.list("fighter_statistics", { fighterId: fighter.id, statKey: def.key }))[0];
  if (existing) {
    await store.update("fighter_statistics", existing.id, { ...parsed.data, isDemo: source.isDemo, updatedAt: now });
  } else {
    const row: FighterStatistic = { id: newId(), ...parsed.data, isDemo: source.isDemo, createdAt: now, updatedAt: now };
    await store.insert("fighter_statistics", row);
  }
  revalidatePath(`/lutadores/${fighter.id}`);
  return { ok: true, message: `${def.short} salvo.` };
}

export async function deleteFighterStat(id: string, fighterId: string) {
  await getStore().remove("fighter_statistics", id);
  revalidatePath(`/lutadores/${fighterId}`);
}
