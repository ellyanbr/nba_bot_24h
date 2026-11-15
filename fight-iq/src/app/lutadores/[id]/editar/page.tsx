import { notFound } from "next/navigation";
import { FighterForm } from "@/components/fighters/fighter-form";
import { PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";
import { listDataSources, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Editar atleta" };

export default async function EditFighterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fighter = await getStore().get("fighters", id);
  if (!fighter) notFound();
  const [orgs, sources] = await Promise.all([listOrganizations(), listDataSources()]);
  return (
    <>
      <PageHeader eyebrow="Lutadores" title={`Editar ${fighter.name}`} />
      <FighterForm fighter={fighter} organizations={orgs} sources={sources} />
    </>
  );
}
