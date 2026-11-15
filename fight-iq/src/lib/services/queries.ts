import "server-only";
import { getStore } from "@/lib/data";
import type {
  DataSource,
  Fight,
  FightAnalysis,
  FightEvent,
  FightResult,
  Fighter,
  FighterStatistic,
  Organization,
  Prediction,
  Bet,
} from "@/lib/domain/types";
import { resultKind } from "@/lib/domain/types";
import { todayIso } from "@/lib/utils";
import { getShowDemo } from "./preferences";

const byDemoPref = <T extends { isDemo: boolean }>(rows: T[], showDemo: boolean) =>
  showDemo ? rows : rows.filter((r) => !r.isDemo);

export async function listOrganizations() {
  const showDemo = await getShowDemo();
  const orgs = await getStore().list("organizations");
  return byDemoPref(orgs, showDemo).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listDataSources() {
  const showDemo = await getShowDemo();
  const rows = await getStore().list("data_sources");
  return byDemoPref(rows, showDemo).sort((a, b) => a.name.localeCompare(b.name));
}

export async function sourceMap(): Promise<Map<string, DataSource>> {
  const rows = await getStore().list("data_sources");
  return new Map(rows.map((s) => [s.id, s]));
}

export interface FighterListFilters {
  q?: string;
  weightClass?: string;
  organizationId?: string;
}

export async function listFighters(filters: FighterListFilters = {}) {
  const showDemo = await getShowDemo();
  const [fighters, orgs] = await Promise.all([getStore().list("fighters"), getStore().list("organizations")]);
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const q = filters.q?.trim().toLowerCase();
  return byDemoPref(fighters, showDemo)
    .filter((f) => !filters.weightClass || f.weightClass === filters.weightClass)
    .filter((f) => !filters.organizationId || f.organizationId === filters.organizationId)
    .filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.nickname ?? "").toLowerCase().includes(q) ||
        (f.team ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ ...f, organization: f.organizationId ? orgById.get(f.organizationId) ?? null : null }));
}

export interface FightHistoryEntry {
  fight: Fight;
  event: FightEvent | null;
  opponent: Fighter | null;
  result: FightResult | null;
  /** V vitória · D derrota · E empate · NC sem resultado · Anulada (resultado revertido) · Agendada · Cancelada */
  outcome: "V" | "D" | "E" | "NC" | "Anulada" | "Agendada" | "Cancelada";
}

export interface FighterProfile {
  fighter: Fighter;
  organization: Organization | null;
  source: DataSource | null;
  stats: (FighterStatistic & { source: DataSource | null })[];
  history: FightHistoryEntry[];
  /** Somente lutas concluídas, mais recentes primeiro. */
  completed: FightHistoryEntry[];
  upcoming: FightHistoryEntry[];
}

export async function getFighterProfile(id: string): Promise<FighterProfile | null> {
  const store = getStore();
  const fighter = await store.get("fighters", id);
  if (!fighter) return null;
  const [orgs, sources, stats, fightsRed, fightsBlue, events, results, fighters] = await Promise.all([
    store.list("organizations"),
    sourceMap(),
    store.list("fighter_statistics", { fighterId: id }),
    store.list("fights", { redFighterId: id }),
    store.list("fights", { blueFighterId: id }),
    store.list("events"),
    store.list("fight_results"),
    store.list("fighters"),
  ]);
  const evById = new Map(events.map((e) => [e.id, e]));
  const resByFight = new Map(results.map((r) => [r.fightId, r]));
  const fById = new Map(fighters.map((f) => [f.id, f]));

  const history: FightHistoryEntry[] = [...fightsRed, ...fightsBlue]
    .map((fight) => {
      const event = evById.get(fight.eventId) ?? null;
      const oppId = fight.redFighterId === id ? fight.blueFighterId : fight.redFighterId;
      const result = resByFight.get(fight.id) ?? null;
      let outcome: FightHistoryEntry["outcome"] = "Agendada";
      if (fight.status === "cancelled") outcome = "Cancelada";
      else if (result) {
        const kind = resultKind(result.method);
        if (kind === "no_contest") outcome = "NC";
        else if (kind === "overturned") outcome = "Anulada";
        else if (kind === "draw" || !result.winnerId) outcome = "E";
        else outcome = result.winnerId === id ? "V" : "D";
      }
      return { fight, event, opponent: fById.get(oppId) ?? null, result, outcome };
    })
    .sort((a, b) => (b.event?.date ?? "").localeCompare(a.event?.date ?? ""));

  return {
    fighter,
    organization: fighter.organizationId ? orgs.find((o) => o.id === fighter.organizationId) ?? null : null,
    source: fighter.sourceId ? sources.get(fighter.sourceId) ?? null : null,
    stats: stats.map((s) => ({ ...s, source: s.sourceId ? sources.get(s.sourceId) ?? null : null })),
    history,
    completed: history.filter((h) => h.result),
    upcoming: history.filter((h) => !h.result && h.fight.status === "scheduled").reverse(),
  };
}

export interface FightCard {
  fight: Fight;
  red: Fighter | null;
  blue: Fighter | null;
  result: FightResult | null;
}

export interface EventDetail {
  event: FightEvent;
  organization: Organization | null;
  source: DataSource | null;
  fights: FightCard[];
}

async function buildEventDetails(events: FightEvent[]): Promise<EventDetail[]> {
  const store = getStore();
  const [orgs, sources, fights, fighters, results] = await Promise.all([
    store.list("organizations"),
    sourceMap(),
    store.list("fights"),
    store.list("fighters"),
    store.list("fight_results"),
  ]);
  const fById = new Map(fighters.map((f) => [f.id, f]));
  const resByFight = new Map(results.map((r) => [r.fightId, r]));
  return events.map((event) => ({
    event,
    organization: orgs.find((o) => o.id === event.organizationId) ?? null,
    source: event.sourceId ? sources.get(event.sourceId) ?? null : null,
    fights: fights
      .filter((f) => f.eventId === event.id)
      .sort((a, b) => a.boutOrder - b.boutOrder)
      .map((fight) => ({
        fight,
        red: fById.get(fight.redFighterId) ?? null,
        blue: fById.get(fight.blueFighterId) ?? null,
        result: resByFight.get(fight.id) ?? null,
      })),
  }));
}

export async function listEvents(filter: { organizationId?: string; when?: "upcoming" | "past" | "all" } = {}) {
  const showDemo = await getShowDemo();
  const today = todayIso();
  const events = byDemoPref(await getStore().list("events"), showDemo)
    .filter((e) => !filter.organizationId || e.organizationId === filter.organizationId)
    .filter((e) => {
      if (filter.when === "upcoming") return e.date >= today && e.status !== "cancelled";
      if (filter.when === "past") return e.date < today || e.status === "completed";
      return true;
    })
    .sort((a, b) => (filter.when === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  return buildEventDetails(events);
}

export async function getEventDetail(id: string): Promise<EventDetail | null> {
  const event = await getStore().get("events", id);
  if (!event) return null;
  const [detail] = await buildEventDetails([event]);
  return detail;
}

export async function listAnalyses() {
  const showDemo = await getShowDemo();
  const store = getStore();
  const [analyses, fighters] = await Promise.all([store.list("fight_analyses"), store.list("fighters")]);
  const fById = new Map(fighters.map((f) => [f.id, f]));
  return analyses
    .filter((a) => showDemo || !a.containsDemoData)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({ ...a, fighterA: fById.get(a.fighterAId) ?? null, fighterB: fById.get(a.fighterBId) ?? null }));
}

export async function getAnalysis(id: string) {
  const store = getStore();
  const analysis = await store.get("fight_analyses", id);
  if (!analysis) return null;
  const [a, b, predictions, odds] = await Promise.all([
    store.get("fighters", analysis.fighterAId),
    store.get("fighters", analysis.fighterBId),
    store.list("predictions", { analysisId: id }),
    store.list("odds_snapshots", { analysisId: id }),
  ]);
  return { analysis, fighterA: a, fighterB: b, predictions, odds: odds.sort((x, y) => x.capturedAt.localeCompare(y.capturedAt)) };
}

export interface PredictionRow extends Prediction {
  fighterA: Fighter | null;
  fighterB: Fighter | null;
  pick: Fighter | null;
  bets: Bet[];
  analysis: FightAnalysis | null;
}

export async function listPredictions(): Promise<PredictionRow[]> {
  const showDemo = await getShowDemo();
  const store = getStore();
  const [preds, fighters, bets, analyses] = await Promise.all([
    store.list("predictions"),
    store.list("fighters"),
    store.list("bets"),
    store.list("fight_analyses"),
  ]);
  const fById = new Map(fighters.map((f) => [f.id, f]));
  return preds
    .filter((p) => showDemo || !p.containsDemoData)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      ...p,
      fighterA: fById.get(p.fighterAId) ?? null,
      fighterB: fById.get(p.fighterBId) ?? null,
      pick: fById.get(p.pickFighterId) ?? null,
      bets: bets.filter((b) => b.predictionId === p.id),
      analysis: analyses.find((a) => a.id === p.analysisId) ?? null,
    }));
}

export { computePredictionStats, type PredictionStats } from "@/lib/analysis/prediction-stats";
import { computePredictionStats } from "@/lib/analysis/prediction-stats";

export async function getDashboardData() {
  const [fighters, upcoming, past, analyses, predictions] = await Promise.all([
    listFighters(),
    listEvents({ when: "upcoming" }),
    listEvents({ when: "past" }),
    listAnalyses(),
    listPredictions(),
  ]);
  const featuredIds = new Set(
    upcoming.flatMap((e) => e.fights.filter((f) => f.fight.isMainEvent || f.fight.isTitleFight).flatMap((f) => [f.red?.id, f.blue?.id])),
  );
  const featured = fighters.filter((f) => featuredIds.has(f.id)).slice(0, 6);
  return {
    counts: {
      fighters: fighters.length,
      upcomingEvents: upcoming.length,
      pastEvents: past.length,
      analyses: analyses.length,
      predictions: predictions.length,
    },
    upcoming: upcoming.slice(0, 3),
    featured: featured.length ? featured : fighters.slice(0, 6),
    latestAnalyses: analyses.slice(0, 5),
    predictionStats: computePredictionStats(predictions),
    recentPredictions: predictions.slice(0, 5),
    hasDemo: fighters.some((f) => f.isDemo),
  };
}
