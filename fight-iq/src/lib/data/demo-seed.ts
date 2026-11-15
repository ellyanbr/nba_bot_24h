/**
 * Conjunto de dados de DEMONSTRAÇÃO.
 *
 * TODOS os atletas, eventos, lutas, resultados e estatísticas abaixo são FICTÍCIOS,
 * criados apenas para demonstrar a interface. Não representam pessoas reais.
 * Eles pertencem à organização fictícia "Liga Demonstração FIGHT IQ" e
 * são marcados com isDemo = true e com a fonte "DEMONSTRAÇÃO".
 *
 * A organização UFC é cadastrada (dados institucionais apenas) sem nenhum atleta
 * ou estatística — dados reais devem ser inseridos pelo usuário (formulário/CSV)
 * com indicação da fonte.
 */
import type {
  DataSource,
  Fight,
  FightEvent,
  FightResult,
  Fighter,
  FighterStatistic,
  Organization,
  TableMap,
  TableName,
} from "@/lib/domain/types";

export const DEMO_SOURCE_ID = "demo-source";
export const DEMO_ORG_ID = "demo-org";
export const UFC_ORG_ID = "org-ufc";
export const MANUAL_SOURCE_ID = "source-manual-institucional";

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildDemoDataset(): Partial<{ [K in TableName]: TableMap[K][] }> {
  const now = new Date().toISOString();
  const demo = { isDemo: true, sourceId: DEMO_SOURCE_ID, createdAt: now, updatedAt: now };

  const data_sources: DataSource[] = [
    {
      id: DEMO_SOURCE_ID,
      name: "DEMONSTRAÇÃO — dados fictícios",
      kind: "demo",
      url: null,
      description:
        "Dados inventados para demonstrar a interface. Não representam atletas, eventos ou estatísticas reais.",
      retrievedAt: null,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: MANUAL_SOURCE_ID,
      name: "Cadastro manual — dados institucionais",
      kind: "manual",
      url: null,
      description: "Informações institucionais de organizações cadastradas manualmente.",
      retrievedAt: null,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const organizations: Organization[] = [
    {
      id: UFC_ORG_ID,
      name: "UFC",
      slug: "ufc",
      country: "Estados Unidos",
      website: "https://www.ufc.com",
      isDemo: false,
      sourceId: MANUAL_SOURCE_ID,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: DEMO_ORG_ID,
      name: "Liga Demonstração FIGHT IQ",
      slug: "demo",
      country: null,
      website: null,
      ...demo,
    },
  ];

  type FSeed = [string, string, string | null, string, number, number, number, string, number, number, number, number, number, number, string, string];
  // id, nome, apelido, categoria, idade(anos), altura, envergadura, base, V, D, E, KO, SUB, DEC, equipe, país
  const seeds: FSeed[] = [
    ["demo-f-01", "Rafael Duarte (DEMO)", "Martelo", "Peso Leve", 29, 178, 183, "Ortodoxo", 18, 3, 0, 9, 4, 5, "Equipe Alfa (DEMO)", "Brasil"],
    ["demo-f-02", "Mikael Strand (DEMO)", "Lobo", "Peso Leve", 33, 180, 188, "Canhoto", 21, 5, 1, 6, 10, 5, "Nordic Grappling (DEMO)", "Suécia"],
    ["demo-f-03", "Tomás Ibarra (DEMO)", null, "Peso Leve", 26, 175, 180, "Ortodoxo", 13, 1, 0, 3, 2, 8, "Kombat Lab (DEMO)", "México"],
    ["demo-f-04", "Daniyar Seitkali (DEMO)", "Estepe", "Peso Leve", 31, 177, 179, "Ortodoxo", 24, 2, 0, 5, 8, 11, "Steppe Wrestling (DEMO)", "Cazaquistão"],
    ["demo-f-05", "Jordan Vale (DEMO)", "Relâmpago", "Peso Meio-Médio", 30, 185, 193, "Trocador de base", 17, 4, 0, 12, 1, 4, "West Coast MMA (DEMO)", "Estados Unidos"],
    ["demo-f-06", "Henrique Lobato (DEMO)", null, "Peso Meio-Médio", 35, 183, 185, "Ortodoxo", 25, 8, 0, 7, 13, 5, "Equipe Alfa (DEMO)", "Brasil"],
    ["demo-f-07", "Kenji Morita (DEMO)", "Lâmina", "Peso Meio-Médio", 28, 180, 186, "Canhoto", 14, 2, 0, 6, 3, 5, "Tokyo Fight Base (DEMO)", "Japão"],
    ["demo-f-08", "Aslan Kurbanov (DEMO)", null, "Peso Meio-Médio", 32, 182, 184, "Ortodoxo", 19, 1, 0, 4, 6, 9, "Steppe Wrestling (DEMO)", "Rússia"],
    ["demo-f-09", "Camila Reis (DEMO)", "Furacão", "Feminino Peso Palha", 27, 160, 163, "Ortodoxo", 12, 2, 0, 4, 3, 5, "Kombat Lab (DEMO)", "Brasil"],
    ["demo-f-10", "Olga Petrenko (DEMO)", null, "Feminino Peso Palha", 30, 163, 165, "Canhoto", 15, 3, 0, 2, 7, 6, "Nordic Grappling (DEMO)", "Ucrânia"],
  ];

  const fighters: Fighter[] = seeds.map((s) => {
    const birth = new Date();
    birth.setUTCFullYear(birth.getUTCFullYear() - s[4]);
    birth.setUTCMonth(Number(s[0].slice(-2)) % 12);
    return {
      id: s[0],
      organizationId: DEMO_ORG_ID,
      name: s[1],
      nickname: s[2],
      weightClass: s[3],
      birthDate: birth.toISOString().slice(0, 10),
      heightCm: s[5],
      reachCm: s[6],
      stance: s[7] as Fighter["stance"],
      wins: s[8],
      losses: s[9],
      draws: s[10],
      noContests: 0,
      winsByKo: s[11],
      winsBySub: s[12],
      winsByDec: s[13],
      team: s[14],
      nationality: s[15],
      active: true,
      notes: "Atleta fictício — DEMONSTRAÇÃO.",
      ...demo,
    };
  });

  // slpm, str_acc, sapm, str_def, td_avg, td_acc, td_def, sub_avg
  const statSeeds: Record<string, number[]> = {
    "demo-f-01": [5.6, 49, 3.9, 56, 0.8, 35, 71, 0.3],
    "demo-f-02": [3.4, 44, 3.1, 58, 2.6, 41, 66, 1.9],
    "demo-f-03": [6.2, 52, 4.4, 53, 1.1, 38, 80, 0.2],
    "demo-f-04": [3.9, 47, 2.2, 61, 4.8, 52, 88, 0.9],
    "demo-f-05": [5.1, 51, 3.4, 59, 0.4, 30, 74, 0.1],
    "demo-f-06": [3.1, 42, 3.7, 50, 2.1, 37, 58, 1.6],
    "demo-f-07": [4.7, 55, 2.9, 62, 1.3, 44, 77, 0.6],
    "demo-f-08": [3.3, 46, 1.9, 63, 5.2, 55, 91, 1.1],
    "demo-f-09": [6.8, 47, 4.9, 52, 1.5, 40, 68, 0.7],
    "demo-f-10": [3.6, 43, 3.0, 57, 3.1, 46, 72, 1.8],
  };
  const keys = ["slpm", "str_acc", "sapm", "str_def", "td_avg", "td_acc", "td_def", "sub_avg"];
  const fighter_statistics: FighterStatistic[] = Object.entries(statSeeds).flatMap(([fid, vals]) =>
    vals.map((v, i) => ({
      id: `demo-st-${fid.slice(-2)}-${keys[i]}`,
      fighterId: fid,
      statKey: keys[i],
      value: v,
      asOf: isoDaysFromNow(-10),
      ...demo,
    })),
  );

  const events: FightEvent[] = [
    { id: "demo-e-01", organizationId: DEMO_ORG_ID, name: "DEMO Fight Night 1", date: isoDaysFromNow(-200), venue: "Arena Demonstração", city: "São Paulo", country: "Brasil", status: "completed", ...demo },
    { id: "demo-e-02", organizationId: DEMO_ORG_ID, name: "DEMO Fight Night 2", date: isoDaysFromNow(-90), venue: "Pavilhão Exemplo", city: "Lisboa", country: "Portugal", status: "completed", ...demo },
    { id: "demo-e-03", organizationId: DEMO_ORG_ID, name: "DEMO Championship 3", date: isoDaysFromNow(21), venue: "Arena Demonstração", city: "Rio de Janeiro", country: "Brasil", status: "scheduled", ...demo },
    { id: "demo-e-04", organizationId: DEMO_ORG_ID, name: "DEMO Fight Night 4", date: isoDaysFromNow(56), venue: "Centro de Eventos Modelo", city: "Cidade do México", country: "México", status: "scheduled", ...demo },
  ];

  type FightSeed = [string, string, string, string, string, number, boolean, boolean, number, FightEvent["status"]];
  const fightSeeds: FightSeed[] = [
    ["demo-b-01", "demo-e-01", "demo-f-01", "demo-f-06", "Peso Leve", 3, false, true, 1, "completed"],
    ["demo-b-02", "demo-e-01", "demo-f-04", "demo-f-03", "Peso Leve", 3, false, false, 2, "completed"],
    ["demo-b-03", "demo-e-01", "demo-f-09", "demo-f-10", "Feminino Peso Palha", 3, false, false, 3, "completed"],
    ["demo-b-04", "demo-e-02", "demo-f-05", "demo-f-07", "Peso Meio-Médio", 5, false, true, 1, "completed"],
    ["demo-b-05", "demo-e-02", "demo-f-02", "demo-f-03", "Peso Leve", 3, false, false, 2, "completed"],
    ["demo-b-06", "demo-e-02", "demo-f-08", "demo-f-06", "Peso Meio-Médio", 3, false, false, 3, "completed"],
    ["demo-b-07", "demo-e-03", "demo-f-01", "demo-f-04", "Peso Leve", 5, true, true, 1, "scheduled"],
    ["demo-b-08", "demo-e-03", "demo-f-07", "demo-f-08", "Peso Meio-Médio", 3, false, false, 2, "scheduled"],
    ["demo-b-09", "demo-e-04", "demo-f-02", "demo-f-03", "Peso Leve", 3, false, true, 1, "scheduled"],
    ["demo-b-10", "demo-e-04", "demo-f-09", "demo-f-10", "Feminino Peso Palha", 5, true, false, 2, "scheduled"],
  ];
  const fights: Fight[] = fightSeeds.map((s) => ({
    id: s[0],
    eventId: s[1],
    redFighterId: s[2],
    blueFighterId: s[3],
    weightClass: s[4],
    scheduledRounds: s[5],
    isTitleFight: s[6],
    isMainEvent: s[7],
    boutOrder: s[8],
    status: s[9],
    ...demo,
  }));

  const fight_results: FightResult[] = [
    { id: "demo-r-01", fightId: "demo-b-01", winnerId: "demo-f-01", method: "KO/TKO", round: 2, time: "3:12", details: "DEMONSTRAÇÃO", ...demo },
    { id: "demo-r-02", fightId: "demo-b-02", winnerId: "demo-f-04", method: "Decisão unânime", round: 3, time: "5:00", details: "DEMONSTRAÇÃO", ...demo },
    { id: "demo-r-03", fightId: "demo-b-03", winnerId: "demo-f-10", method: "Finalização", round: 1, time: "4:01", details: "DEMONSTRAÇÃO", ...demo },
    { id: "demo-r-04", fightId: "demo-b-04", winnerId: "demo-f-07", method: "Decisão dividida", round: 5, time: "5:00", details: "DEMONSTRAÇÃO", ...demo },
    { id: "demo-r-05", fightId: "demo-b-05", winnerId: "demo-f-03", method: "KO/TKO", round: 3, time: "1:47", details: "DEMONSTRAÇÃO", ...demo },
    { id: "demo-r-06", fightId: "demo-b-06", winnerId: "demo-f-08", method: "Decisão unânime", round: 3, time: "5:00", details: "DEMONSTRAÇÃO", ...demo },
  ];

  return { data_sources, organizations, fighters, fighter_statistics, events, fights, fight_results };
}
