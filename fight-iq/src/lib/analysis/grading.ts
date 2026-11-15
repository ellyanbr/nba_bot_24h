/**
 * Correção de previsões a partir do resultado oficial.
 *
 * Uma previsão só é "correct" quando TODOS os componentes previstos acertam:
 * vencedor sempre; método se não for "Qualquer"; round se informado.
 * Cada componente é registrado separadamente para permitir métricas parciais.
 */
import type { FightResult, Prediction, PredictionStatus } from "@/lib/domain/types";

export interface Grade {
  status: PredictionStatus;
  winnerCorrect: boolean | null;
  /** null = método não foi previsto ("Qualquer") ou não se aplica (luta anulada). */
  methodCorrect: boolean | null;
  /** null = round não foi previsto ou não se aplica. */
  roundCorrect: boolean | null;
}

type GradableResult = Pick<FightResult, "winnerId" | "method" | "round">;
type GradablePrediction = Pick<Prediction, "pickFighterId" | "method" | "round">;

export function gradePrediction(p: GradablePrediction, r: GradableResult): Grade {
  // Luta sem resultado (NC): previsão anulada, nenhum componente avaliado.
  if (r.method === "Sem resultado") {
    return { status: "void", winnerCorrect: null, methodCorrect: null, roundCorrect: null };
  }
  // Empate: quem previu vencedor errou (não há opção de prever empate como vencedor).
  const winnerCorrect = r.winnerId != null && r.winnerId === p.pickFighterId;
  const methodCorrect = p.method === "Qualquer" ? null : p.method === r.method;
  // Round desconhecido no resultado = não avaliado (nunca deduzido).
  const roundCorrect = p.round == null || r.round == null ? null : p.round === r.round;
  const allCorrect = winnerCorrect && methodCorrect !== false && roundCorrect !== false;
  return { status: allCorrect ? "correct" : "incorrect", winnerCorrect, methodCorrect, roundCorrect };
}
