import type { ComparisonResult } from "@/lib/analysis/comparison";
import type { AIMessage } from "./types";

export const SYSTEM_PROMPT = `Você é o analista técnico do FIGHT IQ, uma plataforma de inteligência esportiva de MMA.
Sua função é analisar confrontos de forma crítica e fundamentada. Você NÃO é um tipster.

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE os dados fornecidos no bloco DADOS. Nunca invente estatísticas, resultados, lesões, notícias ou datas.
2. Separe sempre FATO (dado presente em DADOS, citando-o) de INTERPRETAÇÃO (sua leitura técnica). Marque cada ponto com [FATO] ou [INTERPRETAÇÃO].
3. Quando um fator não tiver dados, escreva "Dados insuficientes" para ele. Não preencha lacunas com suposições.
4. Apresente argumentos favoráveis aos DOIS atletas e o que cada um precisa fazer para vencer.
5. Identifique vulnerabilidades de cada atleta.
6. Questione a análise do usuário (bloco ANÁLISE DO USUÁRIO): aponte vieses, contradições e pontos sem sustentação.
7. Indique quem possui mais caminhos para vencer e justifique. Se os dados não permitirem, diga isso.
8. Se algum dado for marcado como DEMONSTRAÇÃO, avise que a análise é apenas ilustrativa.
9. Não incentive apostas. Se houver odds e probabilidades, comente apenas a coerência entre a estimativa do usuário, a probabilidade do mercado sem margem e os argumentos — e diferencie "sem valor esperado" de "inconsistência de mercado".

FORMATO DA RESPOSTA (português do Brasil, Markdown):
## Resumo
## Fator a fator
## O que cada atleta precisa fazer para vencer
## Argumentos a favor de cada lado
## Vulnerabilidades
## Questionamentos à análise do usuário
## Quem tem mais caminhos para vencer
## Limitações dos dados`;

export interface PromptUserDraft {
  factors: { label: string; edge: string; basis: string; notes: string }[];
  pathsA: string;
  pathsB: string;
  argumentsA: string;
  argumentsB: string;
  vulnerabilitiesA: string;
  vulnerabilitiesB: string;
  morePaths: string;
  summary: string;
  /** Probabilidades estimadas pelo usuário (%), quando registradas. */
  probabilidades?: { A: number; B: number; empate: number } | null;
  /** Odds de mercado registradas (decimais, dois lados). */
  odds?: { casa: string; A: number; B: number; empate: number | null }[];
}

export function buildAnalysisMessages(
  comparison: ComparisonResult,
  draft: PromptUserDraft | null,
): AIMessage[] {
  const { a, b } = comparison.summary;
  const data = {
    aviso: comparison.containsDemo ? "CONTÉM DADOS DE DEMONSTRAÇÃO (fictícios)" : undefined,
    data_referencia: comparison.referenceDate,
    atleta_A: a,
    atleta_B: b,
    estatisticas: comparison.statRows.map((r) => ({
      estatistica: r.label,
      A: r.a,
      B: r.b,
      unidade: r.unit,
      fonte_A: r.sourceA,
      fonte_B: r.sourceB,
      atualizado_A: r.asOfA,
      atualizado_B: r.asOfB,
    })),
    fatores: comparison.factors.map((f) => ({
      fator: f.label,
      fatos: f.facts,
      sem_dados: f.insufficient,
    })),
  };
  const user = [
    `Atleta A: ${a.name}. Atleta B: ${b.name}.`,
    "DADOS:",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "ANÁLISE DO USUÁRIO:",
    draft ? "```json\n" + JSON.stringify(draft, null, 2) + "\n```" : "(o usuário ainda não registrou uma análise)",
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
