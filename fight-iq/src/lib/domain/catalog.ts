/** Catálogo de estatísticas suportadas (definições no padrão usado por estatísticas de MMA). */
export interface StatDefinition {
  key: string;
  label: string;
  short: string;
  unit: "%" | "/min" | "/15min" | "";
  higherIsBetter: boolean;
  description: string;
  /** Fatores de análise a que a estatística se relaciona. */
  factors: string[];
}

export const STAT_CATALOG: StatDefinition[] = [
  {
    key: "slpm",
    label: "Golpes significativos conectados por minuto",
    short: "SLpM",
    unit: "/min",
    higherIsBetter: true,
    description: "Média de golpes significativos conectados por minuto de luta.",
    factors: ["striking", "potencia"],
  },
  {
    key: "str_acc",
    label: "Precisão de golpes significativos",
    short: "Prec. golpes",
    unit: "%",
    higherIsBetter: true,
    description: "Percentual de golpes significativos conectados sobre os tentados.",
    factors: ["striking"],
  },
  {
    key: "sapm",
    label: "Golpes significativos absorvidos por minuto",
    short: "SApM",
    unit: "/min",
    higherIsBetter: false,
    description: "Média de golpes significativos sofridos por minuto.",
    factors: ["striking", "queixo"],
  },
  {
    key: "str_def",
    label: "Defesa de golpes significativos",
    short: "Def. golpes",
    unit: "%",
    higherIsBetter: true,
    description: "Percentual de golpes significativos do adversário que não conectaram.",
    factors: ["striking"],
  },
  {
    key: "td_avg",
    label: "Quedas por 15 minutos",
    short: "TD/15",
    unit: "/15min",
    higherIsBetter: true,
    description: "Média de quedas conectadas a cada 15 minutos.",
    factors: ["wrestling"],
  },
  {
    key: "td_acc",
    label: "Precisão de quedas",
    short: "Prec. quedas",
    unit: "%",
    higherIsBetter: true,
    description: "Percentual de quedas conectadas sobre as tentadas.",
    factors: ["wrestling"],
  },
  {
    key: "td_def",
    label: "Defesa de quedas",
    short: "Def. quedas",
    unit: "%",
    higherIsBetter: true,
    description: "Percentual de tentativas de queda do adversário defendidas.",
    factors: ["defesa_quedas"],
  },
  {
    key: "sub_avg",
    label: "Tentativas de finalização por 15 minutos",
    short: "Sub/15",
    unit: "/15min",
    higherIsBetter: true,
    description: "Média de tentativas de finalização a cada 15 minutos.",
    factors: ["jiujitsu"],
  },
];

export const statByKey = (key: string) => STAT_CATALOG.find((s) => s.key === key);

/** Fatores do Fight Analyzer. `auto` indica que há dados objetivos calculáveis. */
export interface FactorDefinition {
  key: string;
  label: string;
  group: "Forma" | "Técnico" | "Físico" | "Contexto";
  guide: string;
}

export const ANALYSIS_FACTORS: FactorDefinition[] = [
  { key: "ultimas3", label: "Últimas três lutas", group: "Forma", guide: "Resultados, métodos e desempenho nas três lutas mais recentes registradas." },
  { key: "qualidade_adversarios", label: "Qualidade dos adversários", group: "Forma", guide: "Nível dos oponentes enfrentados (cartel, ranking, estilo)." },
  { key: "striking", label: "Striking", group: "Técnico", guide: "Volume, precisão, defesa, variedade e repertório em pé." },
  { key: "wrestling", label: "Wrestling", group: "Técnico", guide: "Capacidade de derrubar, controlar e manter a posição." },
  { key: "defesa_quedas", label: "Defesa de quedas", group: "Técnico", guide: "Defesa de quedas, retorno ao pé e uso da grade." },
  { key: "grappling", label: "Grappling", group: "Técnico", guide: "Controle no solo, transições, raspagens e scrambles." },
  { key: "jiujitsu", label: "Jiu-jitsu", group: "Técnico", guide: "Ameaça de finalização e defesa de finalizações." },
  { key: "cardio", label: "Cardio", group: "Físico", guide: "Manutenção de ritmo nos rounds finais, lutas de 3 vs 5 rounds." },
  { key: "queixo", label: "Queixo", group: "Físico", guide: "Resistência a golpes, knockdowns sofridos, derrotas por nocaute." },
  { key: "potencia", label: "Potência", group: "Físico", guide: "Poder de nocaute, knockdowns aplicados, vitórias por KO/TKO." },
  { key: "tamanho_envergadura", label: "Tamanho e envergadura", group: "Físico", guide: "Altura, envergadura e massa relativa na categoria." },
  { key: "idade", label: "Idade", group: "Físico", guide: "Idade na data da luta e desgaste acumulado." },
  { key: "inatividade", label: "Inatividade", group: "Contexto", guide: "Tempo desde a última luta registrada." },
  { key: "lesoes", label: "Lesões e cirurgias", group: "Contexto", guide: "Lesões relatadas e cirurgias recentes (citar a fonte)." },
  { key: "corte_peso", label: "Corte de peso", group: "Contexto", guide: "Histórico de falhas na balança, mudança de categoria, aparência na pesagem." },
  { key: "camp", label: "Qualidade do camp", group: "Contexto", guide: "Equipe, parceiros de treino, mudanças de camp, tempo de preparação." },
];
