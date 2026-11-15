import { expect, test } from "./helpers";

const ROUTES = [
  "/",
  "/lutadores",
  "/lutadores/demo-f-01",
  "/lutadores/novo",
  "/lutadores/demo-f-01/editar",
  "/eventos",
  "/eventos?quando=past",
  "/eventos/demo-e-03",
  "/eventos/novo",
  "/analyzer",
  "/analyzer?a=demo-f-01&b=demo-f-04&luta=demo-b-07",
  "/historico",
  "/historico?aba=analises",
  "/importar",
  "/fontes",
  "/configuracoes",
];

test("todas as páginas carregam sem erro", async ({ page }) => {
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await expect(page.locator("main h1").first(), r).toBeVisible();
  }
});

test.describe(() => {
  test.use({ allowedConsoleErrors: [/status of 404/] });
  test("registro inexistente responde 404", async ({ page }) => {
    const res = await page.goto("/lutadores/nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Página ou registro não encontrado.")).toBeVisible();
  });
});

test("modelo de CSV é baixável", async ({ request }) => {
  const res = await request.get("/api/csv-template?tipo=fights");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("event_name,event_date,red_fighter,blue_fighter");
});

test("navegação lateral leva às áreas principais", async ({ page }) => {
  await page.goto("/");
  for (const [label, url] of [
    ["Lutadores", /\/lutadores$/],
    ["Eventos", /\/eventos$/],
    ["Fight Analyzer", /\/analyzer$/],
    ["Histórico", /\/historico$/],
  ] as const) {
    await page.locator("aside").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
});
