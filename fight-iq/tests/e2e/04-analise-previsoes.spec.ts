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

async function analyzeAndPredict(page: Page, eventId: string, a: string, pred: { pA?: string; method?: string; round?: string; full?: string }) {
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  await page.waitForURL(/analyzer\?a=.*&luta=/);
  await page.getByText("Registrar previsão").click();
  await page.getByLabel(`Probabilidade de vitória — ${a} (%)`).fill(pred.pA ?? "60");
  await page.locator('label:has-text("Vencedor previsto") select').selectOption({ label: a });
  if (pred.method) await page.locator('label:has-text("Método") select').selectOption(pred.method);
  if (pred.round) await page.locator('label:has-text("Round") select').selectOption(pred.round);
  if (pred.full) await page.getByLabel("Probabilidade da previsão completa (%)").fill(pred.full);
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
  await expect(page.getByText("A escolha contraria a maioria dos fatores")).toBeVisible();
  await expect(page.getByText("A análise por IA está indisponível.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar análise com IA/ })).toHaveCount(0);
});

test("B1: previsão KO no R1 com vitória por decisão é ERRO, com detalhamento", async ({ page }) => {
  const { src, a, aId, eventId } = await setupFight(page);
  await analyzeAndPredict(page, eventId, a, { method: "KO/TKO", round: "1", full: "20" });
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

test("probabilidades: validação, valor esperado, inconsistências de mercado, aposta e calibração", async ({ page }) => {
  const { src, a, b, aId, eventId } = await setupFight(page);
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("link", { name: "Analisar" }).first().click();
  await page.getByText("Registrar previsão").click();

  // B é o complemento; soma inválida é recusada
  const pA = page.getByLabel(`Probabilidade de vitória — ${a} (%)`);
  await pA.fill("62");
  await expect(page.getByLabel(`Probabilidade de vitória — ${b} (%)`)).toHaveValue("38");
  await page.getByLabel("Probabilidade de empate (%)").fill("50");
  await expect(page.getByText(/devem somar 100%|entre 0% e 100%/)).toBeVisible();
  await page.getByLabel("Probabilidade de empate (%)").fill("0");
  await expect(page.getByText("Odds justas pela sua estimativa")).toContainText("1.61");

  // Escolher o atleta que a própria estimativa considera menos provável gera alerta
  await page.locator('label:has-text("Vencedor previsto") select').selectOption({ label: b });
  await expect(page.getByText(/MENOS probabilidade de vencer/)).toBeVisible();
  await page.locator('label:has-text("Vencedor previsto") select').selectOption({ label: a });

  // Previsão com método exige probabilidade completa ≤ probabilidade do vencedor
  await page.locator('label:has-text("Método") select').selectOption("KO/TKO");
  await page.getByLabel("Probabilidade da previsão completa (%)").fill("70");

  // Duas casas: valor esperado positivo em A e divergência entre casas
  await page.getByRole("button", { name: "Adicionar casa" }).click();
  await page.getByLabel("Casa 1", { exact: true }).fill("Casa Um");
  await page.getByLabel("Odds A casa 1", { exact: true }).fill("1,80");
  await page.getByLabel("Odds B casa 1", { exact: true }).fill("2,05");
  await page.getByRole("button", { name: "Adicionar casa" }).click();
  await page.getByLabel("Casa 2", { exact: true }).fill("Casa Dois");
  await page.getByLabel("Odds A casa 2", { exact: true }).fill("1.45");
  await page.getByLabel("Odds B casa 2", { exact: true }).fill("2.45");
  await expect(page.getByText(new RegExp(`${a}: valor esperado de \\+11\\.6%`))).toBeVisible(); // 0,62 × 1,80 − 1
  await expect(page.getByText(new RegExp(`${b}: sem valor esperado pela sua estimativa`))).toBeVisible();
  await expect(page.getByText(/As casas divergem/).first()).toBeVisible();

  await page.getByText("Registrar aposta no vencedor previsto").click();
  await page.getByRole("button", { name: /Salvar análise e previsão/ }).click();
  await expect(page.getByText(/não pode ser mais provável que a vitória do atleta/)).toBeVisible();
  await page.getByLabel("Probabilidade da previsão completa (%)").fill("30");
  await page.getByRole("button", { name: /Salvar análise e previsão/ }).click();
  await page.waitForURL(/historico\/analises\//);

  // Página da análise guarda o mercado e a estimativa
  await expect(page.getByText("Probabilidades e mercado")).toBeVisible();
  await expect(page.getByText(`${a} 62% × ${b} 38%`)).toBeVisible();

  // Histórico mostra probabilidade, previsão completa e VE da aposta
  await page.goto("/historico");
  const row = page.locator("tr", { hasText: a });
  await expect(row).toContainText("62%");
  await expect(row).toContainText("completa: 30%");
  await expect(row).toContainText("1.80 · Casa Um");
  await expect(row).toContainText("VE +11.6%");

  // Resultado oficial: vencedor certo, método errado → previsão errada; calibração conta a vitória
  await registerResult(page, eventId, a, { method: "Decisão unânime", winnerId: aId, source: src });
  await page.goto("/historico");
  await expect(page.locator("tr", { hasText: a })).toContainText("Errou");
  await expect(page.getByText(/Brier score/)).toBeVisible();
});
