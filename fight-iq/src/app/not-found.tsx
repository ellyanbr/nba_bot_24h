import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="py-20">
      <EmptyState title="Página ou registro não encontrado." description="O item pode ter sido removido." action={<LinkButton href="/">Voltar ao dashboard</LinkButton>} />
    </div>
  );
}
