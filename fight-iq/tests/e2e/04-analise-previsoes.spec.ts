import { createFighter, createSource, expect, test, uid, registerResult } from "./helpers";
import type { Page } from "@playwright/test";

async function setupFight(page: Page) {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);
  const k = uid();
  const a = `Alfa ${k}`;
  const b = `Beta ${k}`;
  const aId = await createFighter(page, a, src, { reachCm: "190" });
  const bId = await createFighter(page, b, src, { reachCm: "180" });
  await page.goto("/eventos/novo");
  await page.fill('input[name="name"]', `Card ${k}`);
  await page.selectOption('select[name="organizationId"]', "org-ufc");
  await page.fill('input[name="date"]', "2027-05-01");
  await page.selectOption('select[name="sourceId"]', { label: src });
  await page.getByRole("button", { name: "Criar evento" }).click();
  await page.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);
  const eventId = page.url().split("/").pop()!;
  await page.selectOption('select[name="redFighterId"]', { label: `${a} — Peso Leve` });
  await page.selectOption('select[name="blueFighterId"]', { label: `${b} — Peso Leve` });
  await page.getByRole("button", { name: "Adicionar luta" }).click();
  await expect(page.getByText("Luta adicionada ao card.")).toBeVisible();
  return { src, a, b, aId, bId, eventId };
}

async function analyzeAndPredict(page: Page, eventId: string, a: string, pred: { method?: string; round?: string; odds?: string }) {
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  await page.waitForURL(/analyzer\?a=.*&luta=/);
  await page.getByText("Registrar previsão").click();
  await page.locator('label:has-text("Vencedor previsto") select').selectOption({ label: a });
  if (pred.method) await page.locator('label:has-text("Método") select').selectOption(pred.method);
  if (pred.round) await page.locator('label:has-text("Round") select').selectOption(pred.round);
  if (pred.odds) await page.locator('input[placeholder="1.85"]').fill(pred.odds);
  await page.getByRole("button", { name: /Salvar análise e previsão/ }).click();
  await page.waitForURL(/historico\/analises\//);
}

test("analyzer: fatos objetivos, dados insuficientes, questionamentos e IA indisponível", async ({ page }) => {
  const { eventId } = await setupFight(page);
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  const reach = page.locator("div.rounded-lg", { hasText: "Tamanho e envergadura" }).first();
  await expect(reach).toContainText("10 cm a favor de Alfa");
  await expect(page.locator("div.rounded-lg", { hasText: "Qualidade do camp" }).first()).toContainText("Dados insuficientes");

  await page.selectOption('select[aria-label="Vantagem em Striking"]', "B");
  await page.selectOption('select[aria-label="Vantagem em Wrestling"]', "B");
  await page.getByText("Registrar previsão").click();
  await page.locator('input[placeholder="1.85"]').fill("1.40");
  await expect(page.getByText("A escolha contraria a maioria dos fatores")).toBeVisible();
  await expect(page.getByText("A análise por IA está indisponível.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar análise com IA/ })).toHaveCount(0);
});

test("B1: previsão KO no R1 com vitória por decisão é ERRO, com detalhamento", async ({ page }) => {
  const { src, a, aId, eventId } = await setupFight(page);
  await analyzeAndPredict(page, eventId, a, { method: "KO/TKO", round: "1" });
  await registerResult(page, eventId, a, { method: "Decisão unânime", winnerId: aId, source: src }, "1 previsão(ões) atualizada(s)");

  await page.goto("/historico");
  const row = page.locator("tr", { hasText: a });
  await expect(row).toContainText("Errou");
  await expect(row).toContainText("vencedor ✓");
  await expect(row).toContainText("método ✗");
  await expect(row).toContainText("R3"); // round preenchido automaticamente na decisão

  // Corrigir o resultado oficial recorrige a previsão
  await registerResult(page, eventId, a, { method: "KO/TKO", winnerId: aId, round: "1", source: src });
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Acertou");
});

test("resultado com vencedor exige round (exceto decisão)", async ({ page }) => {
  const { src, a, aId, eventId } = await setupFight(page);
  await registerResult(page, eventId, a, { method: "Finalização", winnerId: aId, source: src }, "Informe o round em que a luta terminou");
});

test("B2: resolução manual não inventa resultado e é recusada após resultado oficial", async ({ page }) => {
  const { src, a, aId, eventId } = await setupFight(page);
  await analyzeAndPredict(page, eventId, a, {});
  await page.goto("/historico");
  let row = page.locator("tr", { hasText: a });
  await row.getByTitle("Marcar como erro").click();
  await expect(row).toContainText("Errou");
  await expect(row).toContainText("Marcação manual — sem resultado oficial registrado");
  await row.getByTitle("Voltar para pendente").click();
  await expect(row).toContainText("Pendente");

  // Com resultado oficial, a previsão é corrigida por ele e não aceita mais marcação manual
  await registerResult(page, eventId, a, { method: "KO/TKO", winnerId: aId, round: "2", source: src });
  await page.goto("/historico");
  row = page.locator("tr", { hasText: a });
  await expect(row).toContainText("Acertou");
  await expect(row.getByTitle("Voltar para pendente")).toHaveCount(0);
});

test("histórico: excluir previsão e análise", async ({ page }) => {
  const { a, eventId } = await setupFight(page);
  await analyzeAndPredict(page, eventId, a, {});
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.waitForURL(/\/historico/);
  await page.goto("/historico");
  const row = page.locator("tr", { hasText: a });
  await row.getByTitle("Excluir").click();
  await expect(page.locator("tr", { hasText: a })).toHaveCount(0);
});
