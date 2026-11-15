import { expect, test } from "./helpers";

// Executado por último: altera o conjunto de demonstração compartilhado pelos outros testes.
test("demonstração: ocultar, exibir, remover e recarregar", async ({ page }) => {
  await page.goto("/lutadores");
  await expect(page.getByText("Rafael Duarte (DEMO)")).toBeVisible();

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Ocultar demonstração" }).click();
  await expect(page.getByRole("button", { name: "Exibir demonstração" })).toBeVisible();
  await page.goto("/lutadores");
  await expect(page.getByText("(DEMO)")).toHaveCount(0);

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Exibir demonstração" }).click();
  await page.getByRole("button", { name: "Remover demonstração" }).click();
  await expect(page.getByRole("button", { name: "Remover demonstração" })).toBeEnabled();
  await page.goto("/lutadores");
  await expect(page.getByText("(DEMO)")).toHaveCount(0);

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Carregar demonstração" }).click();
  await expect(page.getByRole("button", { name: "Carregar demonstração" })).toBeEnabled();
  await page.goto("/lutadores");
  await expect(page.getByText("Rafael Duarte (DEMO)")).toBeVisible();
});
