import { FighterForm } from "@/components/fighters/fighter-form";
import { Notice, PageHeader } from "@/components/ui";
import { listDataSources, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Novo atleta" };

export default async function NewFighterPage() {
  const [orgs, sources] = await Promise.all([listOrganizations(), listDataSources()]);
  return (
    <>
      <PageHeader eyebrow="Lutadores" title="Cadastrar atleta" />
      <div className="mb-5">
        <Notice title="Confiabilidade">
          Registre apenas informações verificáveis e selecione a fonte correspondente. Se a fonte for de DEMONSTRAÇÃO, o atleta será marcado como fictício.
        </Notice>
      </div>
      <FighterForm organizations={orgs} sources={sources} />
    </>
  );
}
