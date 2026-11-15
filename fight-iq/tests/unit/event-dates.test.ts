import { describe, expect, it } from "vitest";
import { eventHasStarted, latestCalendarDate } from "@/lib/domain/event-dates";

describe("eventHasStarted — resultado só a partir da data do evento", () => {
  const now = new Date("2026-11-15T12:00:00Z"); // 09h em Brasília

  it("data futura (dias à frente) é bloqueada", () => {
    expect(eventHasStarted("2026-11-20", now)).toBe(false);
    expect(eventHasStarted("2027-01-01", now)).toBe(false);
  });

  it("hoje e datas passadas são permitidas", () => {
    expect(eventHasStarted("2026-11-15", now)).toBe(true);
    expect(eventHasStarted("2026-01-10", now)).toBe(true);
  });

  it("tolerância de fuso: a data já começou no fuso mais adiantado (UTC+14)", () => {
    // 12h UTC de 15/11 = 02h de 16/11 em UTC+14: um evento de 16/11 na Oceania já começou.
    expect(latestCalendarDate(now)).toBe("2026-11-16");
    expect(eventHasStarted("2026-11-16", now)).toBe(true);
    // Mas não 17/11.
    expect(eventHasStarted("2026-11-17", now)).toBe(false);
    // Às 09h UTC, o dia seguinte ainda não começou em lugar nenhum.
    expect(eventHasStarted("2026-11-16", new Date("2026-11-15T09:00:00Z"))).toBe(false);
  });
});
