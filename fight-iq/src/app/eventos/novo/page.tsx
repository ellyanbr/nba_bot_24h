import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui";
import { listDataSources, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Novo evento" };

export default async function NewEventPage() {
  const [orgs, sources] = await Promise.all([listOrganizations(), listDataSources()]);
  return (
    <>
      <PageHeader eyebrow="Eventos" title="Criar evento" description="Depois de criado, adicione as lutas do card na página do evento." />
      <EventForm organizations={orgs} sources={sources} />
    </>
  );
}
