import { expect, test } from "./helpers";

const PAGES = ["/", "/lutadores", "/lutadores/demo-f-01", "/eventos", "/eventos/demo-e-03", "/analyzer?a=demo-f-01&b=demo-f-04", "/historico", "/importar", "/fontes", "/configuracoes"];

test("celular: sem rolagem horizontal em nenhuma página", async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

test("celular: menu lateral abre e navega", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Fight Analyzer", exact: true }).click();
  await expect(page).toHaveURL(/\/analyzer$/);
});
