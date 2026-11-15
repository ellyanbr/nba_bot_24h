import { notFound } from "next/navigation";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui";
import { getStore } from "@/lib/data";
import { listDataSources, listOrganizations } from "@/lib/services/queries";

export const metadata = { title: "Editar evento" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getStore().get("events", id);
  if (!event) notFound();
  const [orgs, sources] = await Promise.all([listOrganizations(), listDataSources()]);
  return (
    <>
      <PageHeader eyebrow="Eventos" title={`Editar ${event.name}`} />
      <EventForm event={event} organizations={orgs} sources={sources} />
    </>
  );
}
