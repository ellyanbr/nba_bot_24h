/**
 * Regra de data para registrar resultados.
 *
 * As datas de evento são datas LOCAIS do local da luta (sem hora). Para não bloquear um
 * resultado legítimo por diferença de fuso, consideramos que o evento "já começou" quando
 * a sua data já chegou em algum lugar do mundo — o fuso mais adiantado é UTC+14.
 * Assim, um evento de amanhã (no horário de Brasília) só pode receber resultado quando
 * essa data já for "hoje" no fuso mais adiantado; eventos de dias futuros são sempre bloqueados.
 */
const EARLIEST_UTC_OFFSET_HOURS = 14;

/** Data (AAAA-MM-DD) atual no fuso mais adiantado do mundo. */
export function latestCalendarDate(now: Date = new Date()): string {
  return new Date(now.getTime() + EARLIEST_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

export function eventHasStarted(eventDate: string, now: Date = new Date()): boolean {
  return eventDate <= latestCalendarDate(now);
}
