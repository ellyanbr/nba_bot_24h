import { Plus, Search, Users } from "lucide-react";
import { FighterCard } from "@/components/fighters/fighter-card";
import { Card, EmptyState, LinkButton, PageHeader, buttonClasses } from "@/components/ui";
import { WEIGHT_CLASSES } from "@/lib/domain/types";
import { listFighters, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Lutadores" };

export default async function FightersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [fighters, orgs] = await Promise.all([
    listFighters({ q: sp.q, weightClass: sp.categoria, organizationId: sp.org }),
    listOrganizations(),
  ]);
  const filtered = Boolean(sp.q || sp.categoria || sp.org);

  return (
    <>
      <PageHeader
        eyebrow="Base de atletas"
        title="Lutadores"
        description="Cartel, histórico e estatísticas com procedência identificada."
        actions={
          <LinkButton href="/lutadores/novo">
            <Plus className="h-4 w-4" /> Novo atleta
          </LinkButton>
        }
      />

      <Card className="mb-6 p-4">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={sp.q} placeholder="Pesquisar por nome, apelido ou equipe" className="field-input pl-9" />
          </div>
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="field-input" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {WEIGHT_CLASSES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <select name="org" defaultValue={sp.org ?? ""} className="field-input" aria-label="Organização">
            <option value="">Todas as organizações</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className={buttonClasses("secondary")}>
              Filtrar
            </button>
            {filtered && (
              <LinkButton href="/lutadores" variant="ghost">
                Limpar
              </LinkButton>
            )}
          </div>
        </form>
      </Card>

      <p className="mb-3 text-xs text-ink-400">{fighters.length} atleta(s)</p>
      {fighters.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fighters.map((f) => (
            <FighterCard key={f.id} fighter={f} organization={f.organization} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={filtered ? "Nenhum atleta encontrado com esses filtros." : "Nenhum atleta cadastrado."}
          description="Cadastre manualmente ou importe um CSV com a fonte dos dados."
          action={
            <div className="flex gap-2">
              <LinkButton href="/lutadores/novo" size="sm">
                Cadastrar atleta
              </LinkButton>
              <LinkButton href="/importar" size="sm" variant="secondary">
                Importar CSV
              </LinkButton>
            </div>
          }
        />
      )}
    </>
  );
}
