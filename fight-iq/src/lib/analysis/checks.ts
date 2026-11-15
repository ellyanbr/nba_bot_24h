/**
 * Verificações de consistência baseadas em REGRAS explícitas (não é IA).
 * Servem para questionar a análise do usuário sem depender de provedores externos.
 */
import type { Edge, FactorAssessment } from "@/lib/domain/types";
import { impliedProbability } from "@/lib/utils";

export interface CheckInput {
  factors: FactorAssessment[];
  morePaths: Edge;
  pick: "A" | "B" | null;
  confidence: number | null;
  decimalOdds: number | null;
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
  if (i.pick && i.confidence != null && i.confidence >= 75 && unknown > i.factors.length / 3) {
    out.push({ level: "alerta", text: `Confiança de ${i.confidence}% com ${unknown} fatores desconhecidos. Considere reduzir a confiança.` });
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
  if (i.decimalOdds != null && i.confidence != null) {
    const ip = impliedProbability(i.decimalOdds);
    if (ip == null) {
      out.push({ level: "atencao", text: "Odds decimais devem ser maiores que 1,00." });
    } else {
      const diff = i.confidence - ip;
      if (diff < 0) {
        out.push({ level: "alerta", text: `Possível armadilha: a probabilidade implícita das odds (${ip.toFixed(1)}%) é maior que sua confiança (${i.confidence}%). Pelo seu próprio julgamento, o preço não compensa.` });
      } else if (diff > 20) {
        out.push({ level: "atencao", text: `Sua confiança supera a probabilidade implícita em ${diff.toFixed(1)} p.p. Diferenças grandes costumam indicar informação que o mercado já precificou (lesão, corte de peso, troca de adversário). Verifique.` });
      } else {
        out.push({ level: "info", text: `Probabilidade implícita das odds: ${ip.toFixed(1)}% (sem remover a margem da casa). Margem a seu favor: ${diff.toFixed(1)} p.p.` });
      }
    }
  }
  return out;
}
