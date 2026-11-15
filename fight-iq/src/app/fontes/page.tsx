import { ExternalLink, Trash2 } from "lucide-react";
import { deleteDataSource } from "@/app/actions/settings";
import { OrganizationForm, SourceForm } from "@/components/data/source-forms";
import { Badge, Card, CardBody, CardHeader, DemoBadge, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import { listDataSources, listOrganizations } from "@/lib/services/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fontes de dados" };

const KIND: Record<string, string> = { demo: "Demonstração", manual: "Manual", csv: "CSV", api: "API", official_site: "Site oficial", other: "Outro" };

export default async function SourcesPage() {
  const [sources, orgs] = await Promise.all([listDataSources(), listOrganizations()]);
  return (
    <>
      <PageHeader eyebrow="Procedência" title="Fontes de dados e organizações" description="Toda informação estatística importante aponta para uma fonte com data de consulta." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title={`Fontes (${sources.length})`} />
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-700/60">
                {sources.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{s.name}</span>
                        <Badge>{KIND[s.kind] ?? s.kind}</Badge>
                        <DemoBadge show={s.isDemo} />
                      </div>
                      {s.description && <p className="mt-0.5 text-xs text-ink-400">{s.description}</p>}
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
                        Consultado em: {formatDate(s.retrievedAt)}
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blood-300 hover:underline">
                            {s.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    </div>
                    {!s.isDemo && (
                      <ActionButton action={deleteDataSource.bind(null, s.id)} variant="ghost" confirm={`Excluir a fonte "${s.name}"?`} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Organizações (${orgs.length})`} subtitle="Atletas e eventos são associados à organização correspondente" />
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-700/60">
                {orgs.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <span className="font-medium text-white">{o.name}</span> <span className="text-xs text-ink-400">/{o.slug}</span>
                      <p className="text-[11px] text-ink-400">{[o.country, o.website].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <DemoBadge show={o.isDemo} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Nova fonte" />
            <CardBody>
              <SourceForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Nova organização" subtitle="Ex.: outras ligas de MMA" />
            <CardBody>
              <OrganizationForm sources={sources.filter((s) => !s.isDemo)} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
