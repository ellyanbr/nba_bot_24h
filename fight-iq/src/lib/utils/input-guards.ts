/**
 * Proteção contra entradas superdimensionadas ANTES da validação com Zod.
 *
 * Motivo (GHSA-mrhx-c7xc-m3w5): no Zod 3, `z.array().max(n)` registra o erro de tamanho
 * mas continua validando TODOS os elementos, acumulando um erro por elemento inválido.
 * Medido neste projeto: 100 mil elementos (≈2,6 MB, abaixo do limite de 3 MB das
 * Server Actions) geraram 200 mil erros e ≈60 MB de memória. Rejeitar pelo tamanho antes
 * evita esse custo sem migrar para o Zod 4.
 */
export function oversizedArray(input: unknown, limits: Record<string, number>): string | null {
  if (typeof input !== "object" || input === null) return null;
  for (const [key, max] of Object.entries(limits)) {
    const v = (input as Record<string, unknown>)[key];
    if (Array.isArray(v) && v.length > max) return `Entrada inválida: "${key}" excede ${max} itens.`;
  }
  return null;
}
