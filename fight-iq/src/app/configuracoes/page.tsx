import { Bot, Database, Eye, EyeOff, FlaskConical, Trash2, Upload } from "lucide-react";
import { loadDemoData, removeDemoData, setShowDemo } from "@/app/actions/settings";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/ui/client";
import { getAIStatus } from "@/lib/ai";
import { getBackendStatus } from "@/lib/data";
import { getShowDemo } from "@/lib/services/preferences";

export const metadata = { title: "Configurações" };

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[12px] leading-relaxed text-ink-200 scrollbar-thin">{children}</pre>;
}

export default async function SettingsPage() {
  const backend = getBackendStatus();
  const ai = getAIStatus();
  const showDemo = await getShowDemo();

  return (
    <>
      <PageHeader eyebrow="Sistema" title="Configurações" description="Armazenamento, motor de IA e dados de demonstração. Todas as opções são gratuitas." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dados de demonstração" icon={<FlaskConical className="h-4 w-4" />} />
          <CardBody className="space-y-4 text-sm text-ink-300">
            <p>
              Atletas, eventos e estatísticas fictícios, identificados como <strong className="text-amber-300">DEMONSTRAÇÃO</strong>, para conhecer a ferramenta. Nunca são misturados com dados reais.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton action={setShowDemo.bind(null, !showDemo)} size="md">
                {showDemo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDemo ? "Ocultar demonstração" : "Exibir demonstração"}
              </ActionButton>
              <ActionButton action={loadDemoData} size="md">
                <Upload className="h-4 w-4" /> Carregar demonstração
              </ActionButton>
              <ActionButton action={removeDemoData} size="md" variant="danger" confirm="Remover TODOS os dados de demonstração, incluindo análises e previsões feitas com eles?">
                <Trash2 className="h-4 w-4" /> Remover demonstração
              </ActionButton>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Armazenamento" icon={<Database className="h-4 w-4" />} action={<Badge tone={backend.configured ? "green" : "red"}>{backend.backend === "local" ? "Local" : "Supabase"}</Badge>} />
          <CardBody className="space-y-3 text-sm text-ink-300">
            <p>{backend.message}</p>
            <p>
              <strong className="text-white">Local (padrão):</strong> sem custo, sem internet, sem cadastro. Ideal para desenvolvimento e uso pessoal. Não funciona em hospedagens serverless (disco efêmero).
            </p>
            <p>
              <strong className="text-white">Supabase (opcional, plano gratuito):</strong> PostgreSQL gerenciado. O plano gratuito não exigia cartão quando esta tela foi escrita, mas tem limites de armazenamento e pausa projetos inativos — confira os limites atuais em supabase.com/pricing antes de usar. Para ativar:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[13px]">
              <li>Crie um projeto gratuito em supabase.com.</li>
              <li>
                No SQL Editor, execute <code className="text-ink-100">supabase/migrations/0001_init.sql</code>.
              </li>
              <li>Em Project Settings → API, copie a URL e a service_role key.</li>
              <li>
                Crie <code className="text-ink-100">.env.local</code> (nunca versionado):
              </li>
            </ol>
            <Code>{`DATA_BACKEND=supabase\nSUPABASE_URL=https://SEU-PROJETO.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role`}</Code>
            <p className="text-xs">A chave é usada apenas no servidor e nunca chega ao navegador. Reinicie o servidor e use &ldquo;Carregar demonstração&rdquo; se quiser os dados fictícios no Supabase.</p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Motor de inteligência artificial" icon={<Bot className="h-4 w-4" />} action={<Badge tone={ai.configured ? "green" : "amber"}>{ai.configured ? `${ai.label} · ${ai.model}` : "Não configurado"}</Badge>} />
          <CardBody className="grid gap-6 text-sm text-ink-300 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="font-semibold text-white">Situação atual</p>
              <p>{ai.message}</p>
              <p>
                Sem IA, o FIGHT IQ continua completo: comparação objetiva dos dados, avaliação manual fator a fator, questionamentos por regras, previsões e histórico. Nenhuma análise simulada é exibida.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">Opção gratuita recomendada: Ollama (local)</p>
              <p>Roda modelos abertos no seu computador. Custo zero, sem chave e sem envio de dados a terceiros. Limitação: requer máquina com memória suficiente (≈8 GB de RAM para modelos de 7–8B) e as respostas são mais lentas e menos precisas que modelos comerciais.</p>
              <Code>{`# 1. Instale: https://ollama.com/download\nollama pull llama3.1:8b\n\n# 2. .env.local\nAI_PROVIDER=ollama\nOLLAMA_BASE_URL=http://localhost:11434\nOLLAMA_MODEL=llama3.1:8b`}</Code>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">Alternativa: servidor compatível</p>
              <p>
                Qualquer servidor com a rota <code>/chat/completions</code>, como LM Studio ou llama.cpp (ambos gratuitos e locais). A mesma configuração permite, no futuro, conectar um serviço externo — sem alterar o código.
              </p>
              <Code>{`AI_PROVIDER=openai_compatible\nAI_BASE_URL=http://localhost:1234/v1\nAI_MODEL=nome-do-modelo\n# AI_API_KEY=  (apenas se o servidor exigir)`}</Code>
              <p className="text-xs">Variáveis lidas só no servidor. Reinicie após alterar.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
