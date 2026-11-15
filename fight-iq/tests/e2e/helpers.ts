import { expect, test as base, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Página com confirmações aceitas e coleta de erros de console/página (falha o teste se houver). */
export const test = base.extend<{ page: Page; allowedConsoleErrors: RegExp[] }>({
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, provide) => {
    const errors: string[] = [];
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !allowedConsoleErrors.some((re) => re.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    await provide(page);
    expect(errors, "erros de console/página").toEqual([]);
  },
});
export { expect };

export const uid = () => Math.random().toString(36).slice(2, 7);

export async function createSource(page: Page, name: string) {
  await page.goto("/fontes");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar fonte" }) });
  await form.locator('input[name="name"]').fill(name);
  await form.locator('select[name="kind"]').selectOption("csv");
  await form.locator('input[name="retrievedAt"]').fill("2026-11-01");
  await form.getByRole("button", { name: "Cadastrar fonte" }).click();
  await expect(page.getByText(`Fonte "${name}" criada.`)).toBeVisible();
}

export async function createFighter(page: Page, name: string, source: string, extra: Record<string, string> = {}) {
  await page.goto("/lutadores/novo");
  await page.fill('input[name="name"]', name);
  await page.selectOption('select[name="organizationId"]', "org-ufc");
  await page.selectOption('select[name="weightClass"]', extra.weightClass ?? "Peso Leve");
  await page.fill('input[name="wins"]', extra.wins ?? "10");
  await page.fill('input[name="losses"]', extra.losses ?? "2");
  if (extra.reachCm) await page.fill('input[name="reachCm"]', extra.reachCm);
  await page.selectOption('select[name="sourceId"]', { label: source });
  await page.getByRole("button", { name: "Cadastrar atleta" }).click();
  await page.waitForURL(/\/lutadores\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

export async function importCsv(page: Page, kind: string, source: string, content: string, expected: string | RegExp) {
  const dir = path.join("test-results", "csv");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}-${uid()}.csv`);
  fs.writeFileSync(file, content);
  await page.goto("/importar");
  await page.selectOption('select[name="kind"]', kind);
  await page.selectOption('select[name="organizationId"]', "org-ufc");
  await page.selectOption('select[name="sourceId"]', { label: source });
  await page.setInputFiles('input[name="file"]', file);
  await page.getByRole("button", { name: "Validar e importar" }).click();
  await expect(page.getByText(expected).first()).toBeVisible();
}

/** Card de uma luta na página do evento, localizado pelo nome de um dos atletas. */
export function fightCard(page: Page, fighterName: string) {
  return page.locator("div.rounded-xl", { has: page.getByRole("link", { name: "Analisar" }) }).filter({ hasText: fighterName });
}

/** Registra o resultado e aguarda a resposta do servidor (sucesso ou mensagem de erro esperada). */
export async function registerResult(
  page: Page,
  eventId: string,
  fighterName: string,
  r: { method: string; winnerId?: string; round?: string; source: string },
  expectMessage: string | RegExp = /Resultado salvo/,
) {
  await page.goto(`/eventos/${eventId}`);
  const card = fightCard(page, fighterName);
  await card.locator("summary").click();
  await card.locator('select[name="method"]').selectOption(r.method);
  if (r.winnerId) await card.locator('select[name="winnerId"]').selectOption(r.winnerId);
  if (r.round) await card.locator('select[name="round"]').selectOption(r.round);
  await card.locator('select[name="sourceId"]').selectOption({ label: r.source });
  await card.getByRole("button", { name: /Registrar resultado|Atualizar resultado/ }).click();
  await expect(card.getByText(expectMessage).first()).toBeVisible();
}
