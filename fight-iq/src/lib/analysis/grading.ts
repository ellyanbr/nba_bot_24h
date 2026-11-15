/**
 * Correção de previsões e liquidação de apostas a partir do resultado oficial.
 *
 * Previsões:
 * - vitória: "correct" só quando TODOS os componentes previstos acertam (vencedor sempre;
 *   método se não for "Qualquer"; round se informado);
 * - empate, sem resultado (NC) ou resultado anulado: "void" — não conta como acerto nem erro.
 *   O motivo fica em `voidReason`.
 *
 * Apostas (sempre no VENCEDOR previsto, mercado de vitória):
 * - liquidadas pelo acerto do vencedor, não pela previsão completa;
 * - empate: devolvida no mercado de 2 vias; perdida no de 3 vias (o empate era uma opção).
 */
import { resultKind, type BetStatus, type FightResult, type Prediction, type PredictionStatus, type VoidReason } from "@/lib/domain/types";

export interface Grade {
  status: PredictionStatus;
  voidReason: VoidReason | null;
  winnerCorrect: boolean | null;
  /** null = método não foi previsto ("Qualquer") ou não se aplica. */
  methodCorrect: boolean | null;
  /** null = round não foi previsto, é desconhecido ou não se aplica. */
  roundCorrect: boolean | null;
}

type GradableResult = Pick<FightResult, "winnerId" | "method" | "round">;
type GradablePrediction = Pick<Prediction, "pickFighterId" | "method" | "round">;

const VOID: Omit<Grade, "voidReason"> = { status: "void", winnerCorrect: null, methodCorrect: null, roundCorrect: null };

export function gradePrediction(p: GradablePrediction, r: GradableResult): Grade {
  const kind = resultKind(r.method);
  if (kind !== "win") return { ...VOID, voidReason: kind };
  const winnerCorrect = r.winnerId != null && r.winnerId === p.pickFighterId;
  const methodCorrect = p.method === "Qualquer" ? null : p.method === r.method;
  // Round desconhecido no resultado = não avaliado (nunca deduzido).
  const roundCorrect = p.round == null || r.round == null ? null : p.round === r.round;
  const allCorrect = winnerCorrect && methodCorrect !== false && roundCorrect !== false;
  return { status: allCorrect ? "correct" : "incorrect", voidReason: null, winnerCorrect, methodCorrect, roundCorrect };
}

/** Grade de uma previsão cuja luta foi cancelada (não aconteceu). */
export const CANCELLED_GRADE: Grade = { ...VOID, voidReason: "cancelled" };

/** Liquida a aposta no vencedor previsto a partir do resultado oficial. */
export function settleBet(market: "2way" | "3way", grade: Grade): BetStatus {
  if (grade.voidReason === "draw") return market === "3way" ? "lost" : "void";
  if (grade.status === "void") return "void";
  return grade.winnerCorrect ? "won" : "lost";
}

/** Rótulos para exibição do motivo de anulação. */
export const VOID_REASON_LABEL: Record<VoidReason, string> = {
  draw: "empate",
  no_contest: "sem resultado (NC)",
  overturned: "resultado anulado",
  cancelled: "luta cancelada",
  manual: "anulada manualmente",
};
