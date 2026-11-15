import type { Page } from "@playwright/test";
import { createFighter, createSource, expect, fightCard, registerResult, test, uid } from "./helpers";

/** Evento com uma luta entre dois atletas novos. */
async function setup(page: Page, date: string) {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);
  const k = uid();
  const a = `Integ A ${k}`;
  const b = `Integ B ${k}`;
  const aId = await createFighter(page, a, src);
  await createFighter(page, b, src);
  await page.goto("/eventos/novo");
  await page.fill('input[name="name"]', `Integridade ${k}`);
  await page.selectOption('select[name="organizationId"]', "org-ufc");
  await page.fill('input[name="date"]', date);
  await page.selectOption('select[name="sourceId"]', { label: src });
  await page.getByRole("button", { name: "Criar evento" }).click();
  await page.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);
  const eventId = page.url().split("/").pop()!;
  await page.selectOption('select[name="redFighterId"]', { label: `${a} — Peso Leve` });
  await page.selectOption('select[name="blueFighterId"]', { label: `${b} — Peso Leve` });
  await page.getByRole("button", { name: "Adicionar luta" }).click();
  await expect(page.getByText("Luta adicionada ao card.")).toBeVisible();
  return { src, a, b, aId, eventId };
}

/** Salva uma análise com previsão no atleta A e, opcionalmente, aposta numa casa (2 ou 3 vias). */
async function predict(page: Page, eventId: string, a: string, opts: { odds?: { a: string; b: string; draw?: string } } = {}) {
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  await page.waitForURL(/analyzer\?a=.*&luta=/);
  await page.getByText("Registrar previsão").click();
  await page.getByLabel(`Probabilidade de vitória — ${a} (%)`).fill("60");
  await page.locator('label:has-text("Vencedor previsto") select').selectOption({ label: a });
  if (opts.odds) {
    await page.getByRole("button", { name: "Adicionar casa" }).click();
    await page.getByLabel("Casa 1", { exact: true }).fill("Casa Teste");
    await page.getByLabel("Odds A casa 1", { exact: true }).fill(opts.odds.a);
    await page.getByLabel("Odds B casa 1", { exact: true }).fill(opts.odds.b);
    if (opts.odds.draw) await page.getByLabel("Odds empate casa 1", { exact: true }).fill(opts.odds.draw);
    await page.getByText("Registrar aposta no vencedor previsto").click();
  }
  await page.getByRole("button", { name: /Salvar análise e previsão/ }).click();
  await page.waitForURL(/historico\/analises\//);
}

test("evento futuro: formulário de resultado não aparece e o servidor recusa", async ({ page }) => {
  const { eventId } = await setup(page, "2030-06-01");
  await page.goto(`/eventos/${eventId}`);
  await expect(page.getByText(/O resultado oficial poderá ser registrado a partir da data do evento/)).toBeVisible();
  await expect(page.getByText("Registrar resultado oficial")).toHaveCount(0);
});

test("evento futuro: CSV de lutas com resultado é recusado", async ({ page }) => {
  const { src, a, b } = await setup(page, "2030-06-01");
  const { importCsv } = await import("./helpers");
  await importCsv(
    page,
    "fights",
    src,
    `event_name,event_date,red_fighter,blue_fighter,rounds,winner,method,round\nIntegridade x,2030-06-01,${a},${b},3,${a},KO/TKO,1\n`,
    "Nenhum registro importado",
  );
});

test("empate: previsão anulada (não conta) e aposta de 2 vias devolvida", async ({ page }) => {
  const { src, a, eventId } = await setup(page, "2026-01-10");
  await predict(page, eventId, a, { odds: { a: "1.80", b: "2.05" } });
  await registerResult(page, eventId, a, { method: "Empate", round: "3", source: src }, "1 previsão(ões) atualizada(s)");

  await page.goto("/historico");
  const row = page.locator("tr", { hasText: a });
  await expect(row).toContainText("Anulada");
  await expect(row).toContainText("Anulada — empate · não conta como acerto nem erro");
  await expect(row).not.toContainText("Errou");
  await expect(row).toContainText("2 vias · devolvida");

  // Histórico do atleta mostra "E" (empate), não derrota
  await page.getByRole("link", { name: "ver análise" }).first().click();
  await expect(page.getByText(/Anulada — empate/).first()).toBeVisible();
});

test("empate em mercado de 3 vias: aposta perdida (o empate era uma opção)", async ({ page }) => {
  const { src, a, eventId } = await setup(page, "2026-01-10");
  await predict(page, eventId, a, { odds: { a: "1.90", b: "2.10", draw: "26" } });
  await registerResult(page, eventId, a, { method: "Empate", round: "3", source: src });
  await page.goto("/historico");
  const row = page.locator("tr", { hasText: a });
  await expect(row).toContainText("Anulada — empate");
  await expect(row).toContainText("3 vias · perdida");
});

test("no contest e resultado anulado: previsões anuladas com o motivo correto", async ({ page }) => {
  const { src, a, aId, eventId } = await setup(page, "2026-01-10");
  await predict(page, eventId, a);
  await registerResult(page, eventId, a, { method: "Sem resultado", round: "1", source: src });
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Anulada — sem resultado (NC)");

  // Resultado revisado para vitória: a previsão é recorrigida (sem duplicar)
  await registerResult(page, eventId, a, { method: "KO/TKO", winnerId: aId, round: "1", source: src });
  await page.goto("/historico");
  const rows = page.locator("tr", { hasText: a });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Acertou");

  // Depois anulado pela comissão (overturned)
  await registerResult(page, eventId, a, { method: "Resultado anulado", round: "1", source: src });
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Anulada — resultado anulado");

  // Perfil do atleta diferencia o desfecho
  await page.goto(`/lutadores/${aId}`);
  await expect(page.locator("tr", { hasText: "Resultado anulado" })).toContainText("Anulada");
});

test("luta cancelada anula a previsão pendente; reativar devolve a pendente", async ({ page }) => {
  const { a, eventId } = await setup(page, "2030-06-01");
  await predict(page, eventId, a);
  await page.goto(`/eventos/${eventId}`);
  await fightCard(page, a).getByRole("button", { name: "Cancelar luta" }).click();
  await expect(fightCard(page, a)).toContainText("Cancelada");
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Anulada — luta cancelada");
  // Marcação manual não é aceita em previsão resolvida automaticamente
  await expect(page.locator("tr", { hasText: a }).getByTitle("Voltar para pendente")).toHaveCount(0);

  await page.goto(`/eventos/${eventId}`);
  await fightCard(page, a).getByRole("button", { name: "Reativar" }).click();
  await expect(fightCard(page, a)).toContainText("Agendada");
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Pendente");
});

test("reenvio do salvamento (mesma requisição duas vezes) não cria duplicata", async ({ page }) => {
  const { a, eventId } = await setup(page, "2030-06-01");
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  await page.getByText("Registrar previsão").click();
  // Simula uma nova tentativa de rede: a MESMA requisição de salvamento chega duas vezes ao servidor.
  let posts = 0;
  await page.route("**/analyzer**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await route.fetch(); // 1º envio
    const second = await route.fetch(); // 2º envio, idêntico
    await route.fulfill({ response: second });
  });
  await page.getByRole("button", { name: /Salvar análise e previsão/ }).click();
  await page.waitForURL(/historico\/analises\//);
  await expect(page.getByText("Esta análise já estava salva.").or(page.getByText("Previsões vinculadas"))).toBeVisible();
  expect(posts).toBe(1);
  await page.unroute("**/analyzer**");
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toHaveCount(1);
  await page.goto("/historico?aba=analises");
  await expect(page.locator("a", { hasText: a })).toHaveCount(1);
});
