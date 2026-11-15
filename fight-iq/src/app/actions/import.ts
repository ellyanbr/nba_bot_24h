"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data";
import { STAT_CATALOG } from "@/lib/domain/catalog";
import { RESULT_METHODS, type Fight, type FightEvent, type FightResult, type Fighter, type FighterStatistic, type ResultMethod } from "@/lib/domain/types";
import { newId, nowIso } from "@/lib/utils";
import { parseCsv } from "@/lib/utils/csv";
import { keepValues, str } from "@/lib/utils/form";

export interface ImportState {
  values?: Record<string, string>;
  ts?: number;
  ok: boolean;
  message?: string;
  errors?: string[];
  imported?: number;
  skipped?: string[];
}

const MAX_BYTES = 2 * 1024 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STANCES = ["Ortodoxo", "Canhoto", "Trocador de base", "Outro"];

const toNum = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const toBool = (v: string | undefined) => ["1", "true", "sim", "s", "yes", "y"].includes((v ?? "").toLowerCase());
const norm = (s: string) => s.trim().toLowerCase();

export async function importCsv(prev: ImportState, fd: FormData): Promise<ImportState> {
  return keepValues(fd, await importCsvImpl(prev, fd));
}

async function importCsvImpl(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const kind = str(fd, "kind");
  const organizationId = str(fd, "organizationId");
  const sourceId = str(fd, "sourceId");
  const file = fd.get("file");
  if (!kind || !["fighters", "events", "fights"].includes(kind)) return { ok: false, message: "Selecione o tipo de importação." };
  if (!organizationId) return { ok: false, message: "Selecione a organização." };
  if (!sourceId) return { ok: false, message: "Selecione a fonte dos dados — toda importação precisa de procedência." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Selecione um arquivo CSV." };
  if (file.size > MAX_BYTES) return { ok: false, message: "Arquivo maior que 2 MB." };

  const store = getStore();
  const [org, source] = await Promise.all([store.get("organizations", organizationId), store.get("data_sources", sourceId)]);
  if (!org) return { ok: false, message: "Organização não encontrada." };
  if (!source) return { ok: false, message: "Fonte não encontrada." };
  if (source.isDemo || org.isDemo) return { ok: false, message: "Importações não podem usar a organização ou a fonte de DEMONSTRAÇÃO." };

  const { headers, rows } = parseCsv(await file.text());
  if (!rows.length) return { ok: false, message: "O arquivo não possui linhas de dados." };
  const now = nowIso();
  const base = { sourceId, isDemo: false, createdAt: now, updatedAt: now };
  const errors: string[] = [];
  const skipped: string[] = [];
  const need = (cols: string[]) => cols.filter((c) => !headers.includes(c));

  if (kind === "fighters") {
    const missing = need(["name"]);
    if (missing.length) return { ok: false, message: `Colunas obrigatórias ausentes: ${missing.join(", ")}` };
    const existing = new Set((await store.list("fighters", { organizationId })).map((f) => norm(f.name)));
    const fighters: Fighter[] = [];
    const stats: FighterStatistic[] = [];
    rows.forEach((r, i) => {
      const line = i + 2;
      const name = r.name?.trim();
      if (!name) return errors.push(`Linha ${line}: nome vazio.`);
      if (existing.has(norm(name))) return skipped.push(`Linha ${line}: "${name}" já existe nesta organização.`);
      const nums = Object.fromEntries(
        ["height_cm", "reach_cm", "wins", "losses", "draws", "no_contests", "wins_by_ko", "wins_by_sub", "wins_by_dec"].map((k) => [k, toNum(r[k])]),
      );
      const bad = Object.entries(nums).filter(([, v]) => Number.isNaN(v) || (v != null && v < 0));
      if (bad.length) return errors.push(`Linha ${line}: valor numérico inválido em ${bad.map(([k]) => k).join(", ")}.`);
      if (r.birth_date && !DATE.test(r.birth_date)) return errors.push(`Linha ${line}: birth_date deve estar no formato AAAA-MM-DD.`);
      if (r.stance && !STANCES.includes(r.stance)) return errors.push(`Linha ${line}: stance deve ser um de: ${STANCES.join(", ")}.`);
      const id = newId();
      existing.add(norm(name));
      fighters.push({
        id,
        organizationId,
        name,
        nickname: r.nickname || null,
        nationality: r.nationality || null,
        birthDate: r.birth_date || null,
        heightCm: nums.height_cm,
        reachCm: nums.reach_cm,
        stance: (r.stance as Fighter["stance"]) || null,
        weightClass: r.weight_class || null,
        team: r.team || null,
        wins: nums.wins ?? 0,
        losses: nums.losses ?? 0,
        draws: nums.draws ?? 0,
        noContests: nums.no_contests ?? 0,
        winsByKo: nums.wins_by_ko,
        winsBySub: nums.wins_by_sub,
        winsByDec: nums.wins_by_dec,
        active: r.active ? toBool(r.active) : true,
        notes: null,
        ...base,
      });
      const asOf = r.stats_as_of && DATE.test(r.stats_as_of) ? r.stats_as_of : null;
      for (const def of STAT_CATALOG) {
        const v = toNum(r[def.key]);
        if (v == null) continue;
        if (Number.isNaN(v) || v < 0 || (def.unit === "%" && v > 100)) {
          errors.push(`Linha ${line}: valor inválido para ${def.key}.`);
          continue;
        }
        if (!asOf) {
          errors.push(`Linha ${line}: estatísticas exigem a coluna stats_as_of (AAAA-MM-DD).`);
          break;
        }
        stats.push({ id: newId(), fighterId: id, statKey: def.key, value: v, asOf, ...base });
      }
    });
    if (errors.length) return { ok: false, message: "Nenhum registro importado. Corrija os erros:", errors, skipped };
    await store.insertMany("fighters", fighters);
    await store.insertMany("fighter_statistics", stats);
    revalidatePath("/", "layout");
    return { ok: true, message: `${fighters.length} atleta(s) e ${stats.length} estatística(s) importados.`, imported: fighters.length, skipped };
  }

  if (kind === "events") {
    const missing = need(["name", "date"]);
    if (missing.length) return { ok: false, message: `Colunas obrigatórias ausentes: ${missing.join(", ")}` };
    const existing = new Set((await store.list("events", { organizationId })).map((e) => `${norm(e.name)}|${e.date}`));
    const events: FightEvent[] = [];
    rows.forEach((r, i) => {
      const line = i + 2;
      if (!r.name) return errors.push(`Linha ${line}: nome vazio.`);
      if (!DATE.test(r.date ?? "")) return errors.push(`Linha ${line}: date deve estar no formato AAAA-MM-DD.`);
      const status = (r.status || "scheduled") as FightEvent["status"];
      if (!["scheduled", "completed", "cancelled"].includes(status)) return errors.push(`Linha ${line}: status inválido (scheduled, completed ou cancelled).`);
      const key = `${norm(r.name)}|${r.date}`;
      if (existing.has(key)) return skipped.push(`Linha ${line}: "${r.name}" (${r.date}) já existe.`);
      existing.add(key);
      events.push({ id: newId(), organizationId, name: r.name, date: r.date, venue: r.venue || null, city: r.city || null, country: r.country || null, status, ...base });
    });
    if (errors.length) return { ok: false, message: "Nenhum registro importado. Corrija os erros:", errors, skipped };
    await store.insertMany("events", events);
    revalidatePath("/", "layout");
    return { ok: true, message: `${events.length} evento(s) importado(s).`, imported: events.length, skipped };
  }

  // fights
  const missing = need(["event_name", "event_date", "red_fighter", "blue_fighter"]);
  if (missing.length) return { ok: false, message: `Colunas obrigatórias ausentes: ${missing.join(", ")}` };
  const [events, fightersInOrg] = await Promise.all([store.list("events", { organizationId }), store.list("fighters", { organizationId })]);
  const evByKey = new Map(events.map((e) => [`${norm(e.name)}|${e.date}`, e]));
  const fByName = new Map(fightersInOrg.map((f) => [norm(f.name), f]));
  const fights: Fight[] = [];
  const results: FightResult[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const ev = evByKey.get(`${norm(r.event_name ?? "")}|${r.event_date}`);
    if (!ev) return errors.push(`Linha ${line}: evento "${r.event_name}" em ${r.event_date} não encontrado (importe os eventos antes).`);
    const red = fByName.get(norm(r.red_fighter ?? ""));
    const blue = fByName.get(norm(r.blue_fighter ?? ""));
    if (!red) return errors.push(`Linha ${line}: atleta "${r.red_fighter}" não encontrado nesta organização.`);
    if (!blue) return errors.push(`Linha ${line}: atleta "${r.blue_fighter}" não encontrado nesta organização.`);
    if (red.id === blue.id) return errors.push(`Linha ${line}: atletas iguais.`);
    const rounds = toNum(r.rounds) ?? 3;
    if (rounds !== 3 && rounds !== 5) return errors.push(`Linha ${line}: rounds deve ser 3 ou 5.`);
    const fightId = newId();
    const hasResult = Boolean(r.method);
    fights.push({
      id: fightId,
      eventId: ev.id,
      redFighterId: red.id,
      blueFighterId: blue.id,
      weightClass: r.weight_class || red.weightClass,
      scheduledRounds: rounds,
      isTitleFight: toBool(r.title_fight),
      isMainEvent: toBool(r.main_event),
      boutOrder: toNum(r.order) ?? 99,
      status: hasResult ? "completed" : "scheduled",
      ...base,
    });
    if (hasResult) {
      if (!RESULT_METHODS.includes(r.method as ResultMethod)) return errors.push(`Linha ${line}: method inválido. Use: ${RESULT_METHODS.join(", ")}.`);
      const noWinner = r.method === "Empate" || r.method === "Sem resultado";
      let winnerId: string | null = null;
      if (!noWinner) {
        const w = norm(r.winner ?? "");
        if (w === norm(red.name)) winnerId = red.id;
        else if (w === norm(blue.name)) winnerId = blue.id;
        else return errors.push(`Linha ${line}: winner deve ser igual a red_fighter ou blue_fighter.`);
      }
      results.push({ id: newId(), fightId, winnerId, method: r.method as ResultMethod, round: toNum(r.round), time: r.time || null, details: null, ...base });
    }
  });
  if (errors.length) return { ok: false, message: "Nenhum registro importado. Corrija os erros:", errors };
  await store.insertMany("fights", fights);
  await store.insertMany("fight_results", results);
  revalidatePath("/", "layout");
  return { ok: true, message: `${fights.length} luta(s) e ${results.length} resultado(s) importados.`, imported: fights.length };
}
