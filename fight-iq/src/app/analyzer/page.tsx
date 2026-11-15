import { Swords } from "lucide-react";
import { AnalyzerWorkspace } from "@/components/analyzer/workspace";
import { MatchupSelector } from "@/components/analyzer/matchup-selector";
import { TaleOfTape } from "@/components/analyzer/tale-of-tape";
import { Card, CardBody, EmptyState, Notice, PageHeader } from "@/components/ui";
import { getAIStatus } from "@/lib/ai";
import { buildComparison } from "@/lib/analysis/comparison";
import { getStore } from "@/lib/data";
import { getFighterProfile, listEvents, listFighters } from "@/lib/services/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fight Analyzer" };

export default async function AnalyzerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [fighters, upcoming] = await Promise.all([listFighters(), listEvents({ when: "upcoming" })]);
  const fights = upcoming.flatMap((e) =>
    e.fights
      .filter((f) => f.red && f.blue && f.fight.status === "scheduled")
      .map((f) => ({ id: f.fight.id, label: `${e.event.name} (${formatDate(e.event.date)}) — ${f.red!.name} vs ${f.blue!.name}`, redId: f.red!.id, blueId: f.blue!.id })),
  );

  const [A, B] = sp.a && sp.b && sp.a !== sp.b ? await Promise.all([getFighterProfile(sp.a), getFighterProfile(sp.b)]) : [null, null];
  let fightDate: string | undefined;
  let rounds = 3;
  let fightId: string | null = null;
  if (A && B && sp.luta) {
    const fight = await getStore().get("fights", sp.luta);
    if (fight && [fight.redFighterId, fight.blueFighterId].includes(A.fighter.id) && [fight.redFighterId, fight.blueFighterId].includes(B.fighter.id)) {
      fightId = fight.id;
      rounds = fight.scheduledRounds;
      fightDate = (await getStore().get("events", fight.eventId))?.date;
    }
  }
  const comparison = A && B ? buildComparison(A, B, fightDate) : null;
  const ai = getAIStatus();

  return (
    <>
      <PageHeader
        eyebrow="Módulo principal"
        title="Fight Analyzer"
        description="Compare dois atletas com base nos dados cadastrados, avalie cada fator, construa os dois lados do confronto e registre sua previsão."
      />

      <Card className="mb-6">
        <CardBody>
          <MatchupSelector
            key={`${sp.a}-${sp.b}-${sp.luta}`}
            fighters={fighters.map((f) => ({ id: f.id, name: f.name, weightClass: f.weightClass, isDemo: f.isDemo }))}
            fights={fights}
            a={sp.a}
            b={sp.b}
            fightId={sp.luta}
          />
        </CardBody>
      </Card>

      {!comparison || !A || !B ? (
        <EmptyState icon={<Swords className="h-10 w-10" />} title="Selecione dois atletas para iniciar a análise." description="Você também pode carregar uma luta agendada ou iniciar pelo botão Analisar em um evento." />
      ) : (
        <div className="space-y-6">
          {comparison.containsDemo && (
            <Notice tone="warning" title="DEMONSTRAÇÃO">
              Pelo menos um dos atletas é fictício. Esta análise serve apenas para conhecer a ferramenta.
            </Notice>
          )}
          {A.fighter.isDemo !== B.fighter.isDemo && (
            <Notice tone="danger" title="Mistura de dados">
              Você está comparando um atleta de demonstração com um atleta real. O resultado não tem valor analítico.
            </Notice>
          )}
          <TaleOfTape A={A} B={B} comparison={comparison} />
          <AnalyzerWorkspace
            key={`${A.fighter.id}-${B.fighter.id}-${fightId}`}
            comparison={comparison}
            fighterA={{ id: A.fighter.id, name: A.fighter.name }}
            fighterB={{ id: B.fighter.id, name: B.fighter.name }}
            fightId={fightId}
            scheduledRounds={rounds}
            ai={{ configured: ai.configured, label: ai.label, message: ai.message }}
          />
        </div>
      )}
    </>
  );
}
