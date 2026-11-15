/**
 * Entidades de domínio do FIGHT IQ.
 *
 * Regras de confiabilidade:
 * - Toda entidade com dados factuais possui `sourceId` (procedência) e `isDemo`.
 * - Registros `isDemo = true` são DEMONSTRAÇÃO e nunca devem ser exibidos
 *   sem a identificação visual correspondente.
 */

export type ID = string;

export interface Provenance {
  /** Fonte da informação (tabela data_sources). */
  sourceId: ID | null;
  /** true = dado fictício de DEMONSTRAÇÃO. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DataSourceKind = "demo" | "manual" | "csv" | "api" | "official_site" | "other";

export interface DataSource {
  id: ID;
  name: string;
  kind: DataSourceKind;
  url: string | null;
  description: string | null;
  /** Data em que a informação foi obtida/conferida na fonte. */
  retrievedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Organization extends Provenance {
  id: ID;
  name: string;
  slug: string;
  country: string | null;
  website: string | null;
}

export const WEIGHT_CLASSES = [
  "Peso Palha",
  "Peso Mosca",
  "Peso Galo",
  "Peso Pena",
  "Peso Leve",
  "Peso Meio-Médio",
  "Peso Médio",
  "Peso Meio-Pesado",
  "Peso Pesado",
  "Feminino Peso Palha",
  "Feminino Peso Mosca",
  "Feminino Peso Galo",
  "Feminino Peso Pena",
  "Peso Casado",
] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number] | string;

export type Stance = "Ortodoxo" | "Canhoto" | "Trocador de base" | "Outro";

export interface Fighter extends Provenance {
  id: ID;
  organizationId: ID | null;
  name: string;
  nickname: string | null;
  nationality: string | null;
  birthDate: string | null;
  heightCm: number | null;
  reachCm: number | null;
  stance: Stance | null;
  weightClass: WeightClass | null;
  team: string | null;
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
  winsByKo: number | null;
  winsBySub: number | null;
  winsByDec: number | null;
  active: boolean;
  notes: string | null;
}

export interface FighterStatistic extends Provenance {
  id: ID;
  fighterId: ID;
  /** Chave do catálogo em `stat-catalog.ts`. */
  statKey: string;
  value: number;
  /** Data de referência da estatística (ex.: data da última atualização na fonte). */
  asOf: string | null;
}

export type EventStatus = "scheduled" | "completed" | "cancelled";

export interface FightEvent extends Provenance {
  id: ID;
  organizationId: ID | null;
  name: string;
  date: string; // YYYY-MM-DD
  venue: string | null;
  city: string | null;
  country: string | null;
  status: EventStatus;
}

export type FightStatus = "scheduled" | "completed" | "cancelled";

export interface Fight extends Provenance {
  id: ID;
  eventId: ID;
  redFighterId: ID;
  blueFighterId: ID;
  weightClass: WeightClass | null;
  scheduledRounds: number;
  isTitleFight: boolean;
  isMainEvent: boolean;
  boutOrder: number;
  status: FightStatus;
}

export type ResultMethod =
  | "KO/TKO"
  | "Finalização"
  | "Decisão unânime"
  | "Decisão dividida"
  | "Decisão majoritária"
  | "Desqualificação"
  | "Sem resultado"
  | "Empate"
  | "Outro";

export const RESULT_METHODS: ResultMethod[] = [
  "KO/TKO",
  "Finalização",
  "Decisão unânime",
  "Decisão dividida",
  "Decisão majoritária",
  "Desqualificação",
  "Sem resultado",
  "Empate",
  "Outro",
];

export interface FightResult extends Provenance {
  id: ID;
  fightId: ID;
  /** null = empate / sem resultado. */
  winnerId: ID | null;
  method: ResultMethod;
  round: number | null;
  time: string | null;
  details: string | null;
}

/* ------------------------------------------------------------------ */
/* Análises                                                             */
/* ------------------------------------------------------------------ */

export type Edge = "A" | "B" | "even" | "unknown";
/** Distinção obrigatória entre fato verificável e interpretação do analista. */
export type Basis = "fato" | "interpretacao";

export interface FactorAssessment {
  factorKey: string;
  edge: Edge;
  basis: Basis;
  notes: string;
}

export interface AIOutput {
  provider: string;
  model: string;
  content: string;
  generatedAt: string;
}

export interface FightAnalysis {
  id: ID;
  fightId: ID | null;
  fighterAId: ID;
  fighterBId: ID;
  title: string;
  factors: FactorAssessment[];
  pathsToVictoryA: string;
  pathsToVictoryB: string;
  argumentsA: string;
  argumentsB: string;
  vulnerabilitiesA: string;
  vulnerabilitiesB: string;
  /** Quem possui mais caminhos para vencer, na avaliação registrada. */
  morePaths: Edge;
  summary: string;
  aiOutput: AIOutput | null;
  /** Retrato dos dados objetivos no momento da análise (para auditoria). */
  dataSnapshot: unknown;
  containsDemoData: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PredictionStatus = "pending" | "correct" | "incorrect" | "void";

export interface Prediction {
  id: ID;
  analysisId: ID | null;
  fightId: ID | null;
  fighterAId: ID;
  fighterBId: ID;
  pickFighterId: ID;
  method: ResultMethod | "Qualquer";
  round: number | null;
  /** 0–100 */
  confidence: number;
  notes: string | null;
  status: PredictionStatus;
  actualWinnerId: ID | null;
  actualMethod: string | null;
  resolvedAt: string | null;
  containsDemoData: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BetStatus = "open" | "won" | "lost" | "void";

/** Registro de odds/aposta para análise (o FIGHT IQ não processa apostas). */
export interface Bet {
  id: ID;
  predictionId: ID;
  /** Odds decimais (ex.: 1.85). */
  decimalOdds: number;
  stake: number | null;
  bookmaker: string | null;
  status: BetStatus;
  createdAt: string;
  updatedAt: string;
}

/** Mapa de tabelas → tipo de registro. */
export interface TableMap {
  organizations: Organization;
  data_sources: DataSource;
  fighters: Fighter;
  fighter_statistics: FighterStatistic;
  events: FightEvent;
  fights: Fight;
  fight_results: FightResult;
  fight_analyses: FightAnalysis;
  predictions: Prediction;
  bets: Bet;
}
export type TableName = keyof TableMap;
export const TABLES: TableName[] = [
  "organizations",
  "data_sources",
  "fighters",
  "fighter_statistics",
  "events",
  "fights",
  "fight_results",
  "fight_analyses",
  "predictions",
  "bets",
];
