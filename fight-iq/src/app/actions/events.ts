"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { RESULT_METHODS, type Fight, type FightEvent, type FightResult, type ResultMethod } from "@/lib/domain/types";
import { gradePrediction } from "@/lib/analysis/grading";
import { newId, nowIso } from "@/lib/utils";
import { bool, keepValues, num, str, zodErrors, type ActionState } from "@/lib/utils/form";

const EventSchema = z.object({
  name: z.string({ required_error: "Informe o nome", invalid_type_error: "Informe o nome" }).min(2, "Informe o nome"),
  organizationId: z.string({ required_error: "Selecione a organização", invalid_type_error: "Selecione a organização" }).min(1, "Selecione a organização"),
  date: z.string({ required_error: "Informe a data", invalid_type_error: "Informe a data" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  venue: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  sourceId: z.string({ required_error: "Informe a fonte", invalid_type_error: "Informe a fonte" }).min(1, "Informe a fonte"),
});

export async function saveEvent(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await saveEventImpl(prev, fd));
}

async function saveEventImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const parsed = EventSchema.safeParse({
    name: str(fd, "name"),
    organizationId: str(fd, "organizationId"),
    date: str(fd, "date"),
    venue: str(fd, "venue"),
    city: str(fd, "city"),
    country: str(fd, "country"),
    status: str(fd, "status") ?? "scheduled",
    sourceId: str(fd, "sourceId"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos destacados.", errors: zodErrors(parsed.error.issues) };
  const store = getStore();
  const [source, org] = await Promise.all([
    store.get("data_sources", parsed.data.sourceId),
    store.get("organizations", parsed.data.organizationId),
  ]);
  if (!source) return { ok: false, errors: { sourceId: "Fonte não encontrada" } };
  if (!org) return { ok: false, errors: { organizationId: "Organização não encontrada" } };
  if (org.isDemo !== source.isDemo) {
    return { ok: false, errors: { sourceId: "Organização e fonte devem ser ambas de demonstração ou ambas reais." } };
  }
  const now = nowIso();
  let savedId = id;
  if (id) {
    const existing = await store.get("events", id);
    if (!existing) return { ok: false, message: "Evento não encontrado." };
    if (existing.isDemo !== source.isDemo && (await store.list("fights", { eventId: id })).length) {
      return { ok: false, errors: { sourceId: "Não é possível trocar entre demonstração e dados reais: o evento já tem lutas cadastradas." } };
    }
    await store.update("events", id, { ...parsed.data, isDemo: source.isDemo, updatedAt: now });
  } else {
    const ev: FightEvent = { id: newId(), ...parsed.data, isDemo: source.isDemo, createdAt: now, updatedAt: now };
    await store.insert("events", ev);
    savedId = ev.id;
  }
  revalidatePath("/", "layout");
  redirect(`/eventos/${savedId}`);
}

export async function deleteEvent(id: string): Promise<ActionState> {
  const store = getStore();
  const fights = await store.list("fights", { eventId: id });
  if (fights.length) return { ok: false, message: `O evento possui ${fights.length} luta(s). Remova-as antes de excluir o evento.` };
  await store.remove("events", id);
  revalidatePath("/", "layout");
  redirect("/eventos");
}

const FightSchema = z
  .object({
    eventId: z.string().min(1),
    redFighterId: z.string({ required_error: "Selecione o atleta", invalid_type_error: "Selecione o atleta" }).min(1, "Selecione o atleta"),
    blueFighterId: z.string({ required_error: "Selecione o atleta", invalid_type_error: "Selecione o atleta" }).min(1, "Selecione o atleta"),
    weightClass: z.string().nullable(),
    scheduledRounds: z.union([z.literal(3), z.literal(5)], { errorMap: () => ({ message: "3 ou 5 rounds" }) }),
    isTitleFight: z.boolean(),
    isMainEvent: z.boolean(),
    boutOrder: z.number({ invalid_type_error: "Número inválido" }).int("Use número inteiro").min(1, "Mínimo 1"),
  })
  .refine((d) => d.redFighterId !== d.blueFighterId, { message: "Selecione atletas diferentes", path: ["blueFighterId"] });

export async function addFight(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await addFightImpl(prev, fd));
}

async function addFightImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = FightSchema.safeParse({
    eventId: str(fd, "eventId"),
    redFighterId: str(fd, "redFighterId"),
    blueFighterId: str(fd, "blueFighterId"),
    weightClass: str(fd, "weightClass"),
    scheduledRounds: num(fd, "scheduledRounds") ?? 3,
    isTitleFight: bool(fd, "isTitleFight"),
    isMainEvent: bool(fd, "isMainEvent"),
    boutOrder: num(fd, "boutOrder") ?? 99,
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos.", errors: zodErrors(parsed.error.issues) };
  const store = getStore();
  const [event, red, blue] = await Promise.all([
    store.get("events", parsed.data.eventId),
    store.get("fighters", parsed.data.redFighterId),
    store.get("fighters", parsed.data.blueFighterId),
  ]);
  if (!event || !red || !blue) return { ok: false, message: "Evento ou atleta não encontrado." };
  if (red.isDemo !== event.isDemo || blue.isDemo !== event.isDemo) {
    return { ok: false, message: "Não misture atletas de demonstração com eventos reais (ou vice-versa)." };
  }
  const now = nowIso();
  const fight: Fight = {
    id: newId(),
    ...parsed.data,
    weightClass: parsed.data.weightClass ?? red.weightClass,
    status: "scheduled",
    sourceId: event.sourceId,
    isDemo: event.isDemo,
    createdAt: now,
    updatedAt: now,
  };
  await store.insert("fights", fight);
  revalidatePath(`/eventos/${event.id}`);
  revalidatePath("/");
  return { ok: true, message: "Luta adicionada ao card." };
}

export async function deleteFight(fightId: string): Promise<ActionState> {
  const store = getStore();
  const fight = await store.get("fights", fightId);
  if (!fight) return { ok: false, message: "Luta não encontrada." };
  await store.removeWhere("fight_results", { fightId });
  await store.remove("fights", fightId);
  revalidatePath(`/eventos/${fight.eventId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFightStatus(fightId: string, status: Fight["status"]) {
  const store = getStore();
  const fight = await store.update("fights", fightId, { status, updatedAt: nowIso() });
  revalidatePath(`/eventos/${fight.eventId}`);
}

const ResultSchema = z.object({
  fightId: z.string().min(1),
  winnerId: z.string().nullable(),
  method: z.enum(RESULT_METHODS as [ResultMethod, ...ResultMethod[]], { errorMap: () => ({ message: "Selecione o método" }) }),
  round: z.number().int().min(1).max(5).nullable(),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Formato m:ss").nullable(),
  details: z.string().nullable(),
  sourceId: z.string({ required_error: "Informe a fonte", invalid_type_error: "Informe a fonte" }).min(1, "Informe a fonte"),
});

export async function saveResult(prev: ActionState, fd: FormData): Promise<ActionState> {
  return keepValues(fd, await saveResultImpl(prev, fd));
}

async function saveResultImpl(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = ResultSchema.safeParse({
    fightId: str(fd, "fightId"),
    winnerId: str(fd, "winnerId"),
    method: str(fd, "method"),
    round: num(fd, "round"),
    time: str(fd, "time"),
    details: str(fd, "details"),
    sourceId: str(fd, "sourceId"),
  });
  if (!parsed.success) return { ok: false, message: "Corrija os campos.", errors: zodErrors(parsed.error.issues) };
  const d = parsed.data;
  const noWinner = d.method === "Empate" || d.method === "Sem resultado";
  if (!noWinner && !d.winnerId) return { ok: false, errors: { winnerId: "Selecione o vencedor" } };

  const store = getStore();
  const [fight, source] = await Promise.all([store.get("fights", d.fightId), store.get("data_sources", d.sourceId)]);
  if (!fight) return { ok: false, message: "Luta não encontrada." };
  if (!source) return { ok: false, errors: { sourceId: "Fonte não encontrada" } };
  if (source.isDemo !== fight.isDemo) return { ok: false, errors: { sourceId: "A fonte deve ter a mesma natureza (demo/real) da luta." } };
  if (d.winnerId && d.winnerId !== fight.redFighterId && d.winnerId !== fight.blueFighterId) {
    return { ok: false, errors: { winnerId: "Vencedor inválido" } };
  }
  // Round: obrigatório quando há vencedor. Em decisões, a luta termina no último round previsto.
  if (d.method.startsWith("Decisão") && d.round == null) d.round = fight.scheduledRounds;
  if (!noWinner && d.round == null) return { ok: false, errors: { round: "Informe o round em que a luta terminou" } };
  if (d.round != null && d.round > fight.scheduledRounds) {
    return { ok: false, errors: { round: `A luta tem ${fight.scheduledRounds} rounds` } };
  }
  const now = nowIso();
  const winnerId = noWinner ? null : d.winnerId;
  const existing = (await store.list("fight_results", { fightId: fight.id }))[0];
  if (existing) {
    await store.update("fight_results", existing.id, { ...d, winnerId, isDemo: source.isDemo, updatedAt: now });
  } else {
    const row: FightResult = { id: newId(), ...d, winnerId, isDemo: source.isDemo, createdAt: now, updatedAt: now };
    await store.insert("fight_results", row);
  }
  await store.update("fights", fight.id, { status: "completed", updatedAt: now });

  // Resolve automaticamente as previsões vinculadas a esta luta (vencedor, método e round).
  // O resultado oficial prevalece sobre qualquer marcação manual anterior.
  const preds = await store.list("predictions", { fightId: fight.id });
  for (const p of preds) {
    const grade = gradePrediction(p, { winnerId, method: d.method, round: d.round });
    await store.update("predictions", p.id, {
      ...grade,
      resolution: "auto",
      actualWinnerId: winnerId,
      actualMethod: d.method,
      actualRound: d.round,
      resolvedAt: now,
      updatedAt: now,
    });
    const bets = await store.list("bets", { predictionId: p.id });
    for (const b of bets) {
      await store.update("bets", b.id, { status: grade.status === "correct" ? "won" : grade.status === "void" ? "void" : "lost", updatedAt: now });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, message: preds.length ? `Resultado salvo. ${preds.length} previsão(ões) atualizada(s).` : "Resultado salvo." };
}
