import { createFighter, createSource, expect, importCsv, test, uid } from "./helpers";

test("fonte e organização: cadastro, validação e exclusão protegida", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);

  // SEG2: esquemas perigosos são recusados
  const srcForm = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar fonte" }) });
  await srcForm.locator('input[name="name"]').fill("Fonte Maliciosa");
  await srcForm.locator('input[name="url"]').fill("javascript:alert(document.cookie)");
  await srcForm.getByRole("button", { name: "Cadastrar fonte" }).click();
  await expect(page.getByText("Use um endereço começando com http:// ou https://")).toBeVisible();

  const org = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar organização" }) });
  await org.locator('input[name="name"]').fill("Liga Teste");
  await org.locator('input[name="slug"]').fill("Inválido!");
  await org.getByRole("button", { name: "Cadastrar organização" }).click();
  await expect(page.getByText("Use letras minúsculas, números e hífen")).toBeVisible();
  await expect(org.locator('input[name="name"]')).toHaveValue("Liga Teste"); // valores preservados após erro
  const slug = `liga-${uid()}`;
  await org.locator('input[name="slug"]').fill(slug);
  await org.locator('select[name="sourceId"]').selectOption({ label: src });
  await org.getByRole("button", { name: "Cadastrar organização" }).click();
  await expect(page.getByText(`/${slug}`)).toBeVisible();

  // Fonte em uso não pode ser excluída
  const row = page.locator("li", { hasText: src });
  await row.getByTitle("Excluir").click();
  await expect(page.getByText(/Fonte em uso/)).toBeVisible();
});

test("atleta: validação preserva dados, cadastro, edição, estatística e exclusão", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);

  await page.goto("/lutadores/novo");
  await page.fill('input[name="name"]', "Atleta Sem Fonte");
  await page.fill('input[name="wins"]', "7");
  await page.getByRole("button", { name: "Cadastrar atleta" }).click();
  await expect(page.getByText("Informe a fonte dos dados")).toBeVisible();
  await expect(page.locator('input[name="name"]')).toHaveValue("Atleta Sem Fonte");
  await expect(page.locator('input[name="wins"]')).toHaveValue("7");

  const name = `Atleta ${uid()}`;
  const id = await createFighter(page, name, src);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Edição
  await page.getByRole("link", { name: "Editar" }).click();
  await page.fill('input[name="nickname"]', "Apelido Editado");
  await page.fill('input[name="wins"]', "11");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(new RegExp(`/lutadores/${id}$`));
  await expect(page.getByText("“Apelido Editado”")).toBeVisible();
  await expect(page.getByText("11-2-0").first()).toBeVisible();

  // Estatística com fonte e data
  await page.getByText("Adicionar / atualizar estatística").click();
  const statForm = page.locator("form", { has: page.locator('select[name="statKey"]') });
  await statForm.locator('select[name="statKey"]').selectOption("str_acc");
  await statForm.locator('input[name="value"]').fill("120");
  await statForm.locator('input[name="asOf"]').fill("2026-11-01");
  await statForm.locator('select[name="sourceId"]').selectOption({ label: src });
  await statForm.getByRole("button", { name: "Salvar estatística" }).click();
  await expect(page.getByText("Percentual deve estar entre 0 e 100")).toBeVisible();
  await statForm.locator('input[name="value"]').fill("51");
  await statForm.getByRole("button", { name: "Salvar estatística" }).click();
  await expect(page.getByText("Prec. golpes salvo.")).toBeVisible();
  await expect(page.getByText("51%")).toBeVisible();
  await page.getByRole("button", { name: "remover" }).click();
  await expect(page.getByText("51%")).toHaveCount(0);

  // Exclusão
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.waitForURL(/\/lutadores$/);
  await expect(page.getByText(name)).toHaveCount(0);
});

test("importação CSV: rejeição atômica, atletas, eventos e lutas com resultado", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);
  const k = uid();

  await importCsv(page, "events", src, "name,date\nSem data,31/12/2026\n", "Nenhum registro importado");
  await importCsv(
    page,
    "fighters",
    src,
    `name;weight_class;wins;losses;slpm;str_acc;stats_as_of\nCSV Um ${k};Peso Leve;8;1;4,2;47;2026-11-01\nCSV Dois ${k};Peso Leve;5;0;;;\n`,
    "2 atleta(s) e 2 estatística(s) importados.",
  );
  await importCsv(page, "fighters", src, `name\nCSV Um ${k}\n`, /0 atleta\(s\)/); // duplicado ignorado
  await expect(page.getByText(/já existe nesta organização/)).toBeVisible();
  await importCsv(page, "events", src, `name,date,status\nEvento CSV ${k},2026-01-10,completed\n`, "1 evento(s) importado(s).");
  await importCsv(
    page,
    "fights",
    src,
    `event_name,event_date,red_fighter,blue_fighter,rounds,winner,method,round,time\nEvento CSV ${k},2026-01-10,CSV Um ${k},CSV Dois ${k},3,CSV Um ${k},KO/TKO,,1:00\n`,
    /informe o round/,
  );
  await importCsv(
    page,
    "fights",
    src,
    `event_name,event_date,red_fighter,blue_fighter,rounds,winner,method,round,time\nEvento CSV ${k},2026-01-10,CSV Um ${k},CSV Dois ${k},3,CSV Um ${k},Decisão unânime,,5:00\n`,
    "1 luta(s) e 1 resultado(s) importados.",
  );

  // O resultado importado aparece no histórico do atleta, com o round preenchido (decisão = último round)
  await page.goto(`/lutadores?q=${encodeURIComponent(`CSV Um ${k}`)}`);
  await page.getByText(`CSV Um ${k}`).first().click();
  const row = page.locator("tr", { hasText: `CSV Dois ${k}` });
  await expect(row).toContainText("Decisão unânime");
  await expect(row).toContainText("R3");
});

test("B3: CSV entre 1 e 2 MB é importado; acima de 2 MB é recusado com mensagem clara", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);
  const k = uid();
  // Linhas largas (coluna venue com ~1 KB) para atingir o tamanho com ~1.400 registros.
  let csv = "name,date,status,venue\n";
  let i = 0;
  while (Buffer.byteLength(csv) < 1.4 * 1024 * 1024) csv += `Evento Grande ${k} ${i++},2027-01-01,scheduled,${"x".repeat(1000)}\n`;
  await importCsv(page, "events", src, csv, `${i} evento(s) importado(s).`);

  while (Buffer.byteLength(csv) < 2.3 * 1024 * 1024) csv += `Evento Grande ${k} ${i++},2027-01-01,scheduled,${"x".repeat(1000)}\n`;
  await importCsv(page, "events", src, csv, /O limite é 2 MB/);
});

test("B4: não permite misturar demonstração e dados reais no cadastro e na edição", async ({ page }) => {
  const src = `Fonte ${uid()}`;
  await createSource(page, src);

  // Fonte real + organização de demonstração
  await page.goto("/lutadores/novo");
  await page.fill('input[name="name"]', `Misto ${uid()}`);
  await page.selectOption('select[name="organizationId"]', "demo-org");
  await page.selectOption('select[name="sourceId"]', { label: src });
  await page.getByRole("button", { name: "Cadastrar atleta" }).click();
  await expect(page.getByText("Organização e fonte devem ser ambas de demonstração ou ambas reais.")).toBeVisible();

  // Atleta real com estatística: não pode virar demonstração na edição
  const id = await createFighter(page, `Real ${uid()}`, src);
  await page.getByText("Adicionar / atualizar estatística").click();
  const statForm = page.locator("form", { has: page.locator('select[name="statKey"]') });
  await statForm.locator('input[name="value"]').fill("4");
  await statForm.locator('input[name="asOf"]').fill("2026-11-01");
  await statForm.locator('select[name="sourceId"]').selectOption({ label: src });
  await statForm.getByRole("button", { name: "Salvar estatística" }).click();
  await expect(page.getByText("SLpM salvo.")).toBeVisible();

  await page.goto(`/lutadores/${id}/editar`);
  await page.selectOption('select[name="organizationId"]', "");
  await page.selectOption('select[name="sourceId"]', "demo-source");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/já tem 1 estatística/)).toBeVisible();
});
