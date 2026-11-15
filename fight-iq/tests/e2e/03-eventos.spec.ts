import { createFighter, createSource, expect, fightCard, test, uid } from "./helpers";

test("evento: criar, adicionar luta, cancelar/reativar, remover e exclusões protegidas", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);
  const k = uid();
  const a = `Vermelho ${k}`;
  const b = `Azul ${k}`;
  const aId = await createFighter(page, a, src);
  await createFighter(page, b, src);

  await page.goto("/eventos/novo");
  await page.getByRole("button", { name: "Criar evento" }).click();
  await expect(page.getByText("Informe o nome")).toBeVisible();
  await page.fill('input[name="name"]', `Evento ${k}`);
  await page.selectOption('select[name="organizationId"]', "org-ufc");
  await page.fill('input[name="date"]', "2027-03-01");
  await page.selectOption('select[name="sourceId"]', { label: src });
  await page.getByRole("button", { name: "Criar evento" }).click();
  await page.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `Evento ${k}` })).toBeVisible();

  // Atletas de demonstração não aparecem para eventos reais
  await expect(page.locator('select[name="redFighterId"] option', { hasText: "(DEMO)" })).toHaveCount(0);

  await page.selectOption('select[name="redFighterId"]', { label: `${a} — Peso Leve` });
  await page.selectOption('select[name="blueFighterId"]', { label: `${a} — Peso Leve` });
  await page.getByRole("button", { name: "Adicionar luta" }).click();
  await expect(page.getByText("Selecione atletas diferentes")).toBeVisible();
  await page.selectOption('select[name="blueFighterId"]', { label: `${b} — Peso Leve` });
  await page.check('input[name="isMainEvent"]');
  await page.getByRole("button", { name: "Adicionar luta" }).click();
  await expect(page.getByText("Luta adicionada ao card.")).toBeVisible();

  const card = fightCard(page, a);
  await expect(card).toContainText("Luta principal");
  await card.getByRole("button", { name: "Cancelar luta" }).click();
  await expect(card).toContainText("Cancelada");
  await card.getByRole("button", { name: "Reativar" }).click();
  await expect(card).toContainText("Agendada");

  // Evento com lutas e atleta com lutas não podem ser excluídos
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByText(/O evento possui 1 luta/)).toBeVisible();
  const eventUrl = page.url();
  await page.goto(`/lutadores/${aId}`);
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText(/participa de 1 luta/)).toBeVisible();

  await page.goto(eventUrl);
  await fightCard(page, a).getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText("Nenhuma luta neste card.")).toBeVisible();
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await page.waitForURL(/\/eventos$/);
});

test("eventos: abas e filtro por organização", async ({ page }) => {
  await page.goto("/eventos?quando=past");
  await expect(page.getByText("DEMO Fight Night 1")).toBeVisible();
  await page.getByRole("link", { name: "Próximos" }).click();
  await expect(page.getByText("DEMO Championship 3")).toBeVisible();
  await expect(page.getByText("DEMO Fight Night 1")).toHaveCount(0);
});
