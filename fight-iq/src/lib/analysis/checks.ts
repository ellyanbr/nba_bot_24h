/**
 * Verificações de consistência baseadas em REGRAS explícitas (não é IA).
 * Servem para questionar a análise do usuário sem depender de provedores externos.
 */
import type { Edge, FactorAssessment } from "@/lib/domain/types";

export interface CheckInput {
  factors: FactorAssessment[];
  morePaths: Edge;
  pick: "A" | "B" | null;
  /** Sua probabilidade (%) de vitória de cada atleta, quando há previsão. */
  probabilities: { A: number; B: number } | null;
  pathsA: string;
  pathsB: string;
  argumentsA: string;
  argumentsB: string;
}

export interface CheckMessage {
  level: "alerta" | "atencao" | "info";
  text: string;
}

export function runConsistencyChecks(i: CheckInput): CheckMessage[] {
  const out: CheckMessage[] = [];
  const assessed = i.factors.filter((f) => f.edge !== "unknown");
  const unknown = i.factors.length - assessed.length;
  const edgesA = i.factors.filter((f) => f.edge === "A").length;
  const edgesB = i.factors.filter((f) => f.edge === "B").length;
  const interp = i.factors.filter((f) => f.edge !== "unknown" && f.basis === "interpretacao").length;

  if (unknown > i.factors.length / 2) {
    out.push({ level: "atencao", text: `${unknown} de ${i.factors.length} fatores estão sem avaliação ou sem dados. Conclusões fortes não são sustentadas.` });
  }
  const pickProb = i.pick && i.probabilities ? i.probabilities[i.pick] : null;
  if (pickProb != null && pickProb >= 75 && unknown > i.factors.length / 3) {
    out.push({ level: "alerta", text: `Probabilidade de ${pickProb}% para o escolhido com ${unknown} fatores desconhecidos. Considere uma estimativa menos extrema.` });
  }
  if (i.pick && i.probabilities) {
    const other = i.pick === "A" ? "B" : "A";
    if (i.probabilities[i.pick] < i.probabilities[other]) {
      out.push({ level: "alerta", text: `Você escolheu o atleta ao qual atribui MENOS probabilidade de vencer (${i.probabilities[i.pick]}% × ${i.probabilities[other]}%). A previsão deve apontar o mais provável; para avaliar um azarão, use o painel de valor esperado.` });
    }
  }
  if (i.pick) {
    const pickEdges = i.pick === "A" ? edgesA : edgesB;
    const otherEdges = i.pick === "A" ? edgesB : edgesA;
    if (otherEdges > pickEdges) {
      out.push({ level: "alerta", text: `A escolha contraria a maioria dos fatores marcados (${pickEdges} a favor × ${otherEdges} contra). Justifique qual fator pesa mais.` });
    }
    if (i.morePaths !== "unknown" && i.morePaths !== "even" && i.morePaths !== i.pick) {
      out.push({ level: "atencao", text: "O atleta escolhido não é o que você indicou como tendo mais caminhos para vencer." });
    }
  }
  if (assessed.length && interp / assessed.length > 0.7) {
    out.push({ level: "info", text: `${interp} de ${assessed.length} avaliações são interpretações, não fatos. Busque dados verificáveis para sustentá-las.` });
  }
  if (!i.pathsA.trim() || !i.pathsB.trim()) {
    out.push({ level: "atencao", text: "Descreva os caminhos para vitória dos DOIS atletas — uma análise unilateral tende ao viés de confirmação." });
  }
  if (!i.argumentsA.trim() || !i.argumentsB.trim()) {
    out.push({ level: "info", text: "Registre argumentos favoráveis aos dois lados." });
  }
  return out;
}
