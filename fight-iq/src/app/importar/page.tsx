import { ImportForm } from "@/components/data/import-form";
import { Card, CardBody, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui";
import { CSV_TEMPLATES } from "@/lib/domain/csv-templates";
import { listDataSources, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Importar CSV" };

export default async function ImportPage() {
  const [orgs, sources] = await Promise.all([listOrganizations(), listDataSources()]);
  const realOrgs = orgs.filter((o) => !o.isDemo);
  const realSources = sources.filter((s) => !s.isDemo);
  return (
    <>
      <PageHeader eyebrow="Dados" title="Importar CSV" description="Importe atletas, eventos e lutas sem depender de APIs. Toda importação exige uma fonte identificada." />
      <div className="mb-6 space-y-3">
        <Notice title="Como funciona">
          O arquivo é validado por completo antes de gravar: se houver qualquer erro, nada é importado e as linhas com problema são listadas. Registros já existentes (mesmo nome na mesma organização) são ignorados. Ordem recomendada: lutadores → eventos → lutas.
        </Notice>
        {realSources.length === 0 && (
          <Notice tone="warning" title="Nenhuma fonte real cadastrada">
            Cadastre a fonte de onde os dados foram obtidos (site oficial, planilha própria etc.) antes de importar.{" "}
            <LinkButton href="/fontes" size="sm" variant="secondary" className="ml-2">
              Cadastrar fonte
            </LinkButton>
          </Notice>
        )}
      </div>
      <Card className="mb-6">
        <CardBody>
          <ImportForm organizations={realOrgs} sources={realSources} />
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        {Object.entries(CSV_TEMPLATES).map(([key, t]) => (
          <Card key={key}>
            <CardHeader title={key === "fighters" ? "Colunas — Lutadores" : key === "events" ? "Colunas — Eventos" : "Colunas — Lutas"} subtitle={t.filename} />
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-700/60 text-xs">
                {t.columns.map((c) => (
                  <li key={c.name} className="flex gap-3 px-4 py-1.5">
                    <code className="w-24 shrink-0 font-mono text-ink-100">
                      {c.name}
                      {c.required && <span className="text-blood-400">*</span>}
                    </code>
                    <span className="text-ink-400">{c.description}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
