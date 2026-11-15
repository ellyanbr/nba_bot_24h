# FIGHT IQ — MMA Analytics & Fight Intelligence

Plataforma de inteligência esportiva para análise técnica de confrontos de MMA (inicialmente UFC).
MVP com **custo R$ 0,00**: roda localmente, sem APIs pagas, sem cartão de crédito e **totalmente funcional sem IA**.

## Como rodar

```bash
cd fight-iq
npm install
npm run dev          # http://localhost:3000
# produção local:
npm run build && npm start
```

Na primeira execução é criado `data/fightiq.local.json` com dados de **DEMONSTRAÇÃO** (fictícios, sempre identificados).
Nenhuma variável de ambiente é obrigatória. Veja `.env.example` para as opcionais.

## Arquitetura

```
Navegador ──► Next.js App Router (Server Components + Server Actions)
                 │
                 ├── lib/services   consultas compostas (perfil, eventos, histórico, calibração)
                 ├── lib/analysis   comparação objetiva + verificações por regras (NÃO é IA)
                 ├── lib/ai         camada de IA independente de provedor (opcional)
                 └── lib/data       contrato DataStore
                        ├── LocalJsonStore  (padrão — arquivo JSON, sem internet)
                        └── SupabaseStore   (opcional — PostgreSQL, plano gratuito)
```

- **Toda escrita passa por Server Actions** com validação Zod. Chaves (Supabase, IA) são lidas apenas no servidor (`server-only`); nada vai para o navegador.
- **Persistência desacoplada**: o resto do sistema só conhece `DataStore` (list/get/insert/update/remove). Trocar de banco = trocar `DATA_BACKEND`.
- **IA desacoplada**: provedores implementam `AIProvider.complete()`. Hoje: `ollama` (local, gratuito) e `openai_compatible` (LM Studio, llama.cpp ou qualquer serviço futuro com `/chat/completions`). Sem provedor, a interface informa claramente a limitação — **não existe análise simulada**.

### Organização das pastas

```
src/
  app/                    rotas (páginas) e server actions
    actions/              fighters, events, analyses, predictions, settings, import
    analyzer/             Fight Analyzer (módulo principal)
    lutadores/ eventos/ historico/ importar/ fontes/ configuracoes/
    api/csv-template/     download dos modelos de CSV
  components/             ui (primitivos), charts (SVG próprios), layout, módulos
  lib/
    domain/               tipos, catálogo de estatísticas e fatores, modelos CSV
    data/                 DataStore, adaptadores local/Supabase, seed de demonstração
    analysis/             comparison.ts (fatos por fator), checks.ts (questionamentos)
    ai/                   registro de provedores, prompt, provedores
    services/             consultas e preferências
supabase/migrations/      esquema PostgreSQL (0001_init.sql)
```

## Confiabilidade dos dados

- Atletas, estatísticas, eventos, lutas e resultados têm `source_id` (tabela `data_sources`) e `is_demo`.
- Cada estatística exige **fonte e data de atualização**; o perfil e o Analyzer exibem ambas.
- Dados de demonstração ficam numa organização fictícia separada ("Liga Demonstração FIGHT IQ"). O sistema **bloqueia misturas**: estatística demo em atleta real, luta com atletas de naturezas diferentes, análise salva misturando demo e real.
- A organização UFC é cadastrada apenas com dados institucionais. **Nenhum atleta ou estatística real foi inventado** — dados reais entram por formulário ou CSV, com fonte.
- Em Configurações é possível ocultar, remover ou recarregar a demonstração.

## Fight Analyzer

1. Selecione dois atletas (ou carregue uma luta agendada).
2. *Tale of the tape* e estatísticas espelhadas, com fonte/data em cada métrica.
3. 16 fatores (últimas 3 lutas, qualidade dos adversários, striking, wrestling, defesa de quedas, grappling, jiu-jitsu, cardio, queixo, potência, tamanho/envergadura, idade, inatividade, lesões, corte de peso, camp). Para cada um: fatos extraídos dos dados ou **"Dados insuficientes"**; você define vantagem, se é fato ou interpretação, e a justificativa.
4. Caminhos para vitória, argumentos e vulnerabilidades **dos dois lados**; quem tem mais caminhos.
5. Previsão opcional (vencedor, método, round, confiança, odds) com detecção de **armadilha de preço** (probabilidade implícita > sua confiança).
6. **Questionamentos automáticos por regras** (escolha contra a maioria dos fatores, confiança alta com muitos desconhecidos, análise unilateral etc.).
7. Análise por IA, se configurada. Tudo é salvo com um retrato dos dados para auditoria.

Previsões vinculadas a uma luta são resolvidas automaticamente quando o resultado é registrado no evento; o Histórico mostra taxa de acerto e **calibração por faixa de confiança**.

## Importação CSV

`/importar` — lutadores (com estatísticas), eventos e lutas/resultados. Aceita vírgula ou ponto e vírgula, UTF-8.
O arquivo inteiro é validado antes de gravar (tudo ou nada); duplicados são ignorados. Modelos para download na própria página.

## Configurações externas opcionais (todas gratuitas)

### IA local com Ollama
1. Instale em https://ollama.com/download e rode `ollama pull llama3.1:8b`.
2. Em `.env.local`: `AI_PROVIDER=ollama`, `OLLAMA_MODEL=llama3.1:8b`.
3. Reinicie. Limitação: precisa de ~8 GB de RAM; mais lento e menos preciso que modelos comerciais.

### Supabase (PostgreSQL gerenciado)
1. Crie um projeto no plano gratuito (confira os limites atuais em supabase.com/pricing).
2. SQL Editor → execute `supabase/migrations/0001_init.sql` (RLS ativado, sem políticas públicas).
3. `.env.local`: `DATA_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Reinicie e, se quiser, use "Carregar demonstração" em Configurações.

## Limitações conhecidas

- **Armazenamento local** atende um único processo; não use em hospedagem serverless (disco efêmero) — use Supabase.
- **Adaptador Supabase** foi implementado e tipado, mas não testado contra uma instância real neste ambiente.
- **Sem autenticação** (MVP de uso pessoal). Antes de expor publicamente com Supabase, adicionar login.
- Consultas compõem relações em memória — adequado ao volume de um MVP.
- Não há integração automática com fontes de dados de MMA; a entrada é manual/CSV por escolha (custo zero e procedência controlada).
- O Next.js 15 inclui internamente uma versão do PostCSS com alertas no `npm audit` que afetam apenas o build; a correção exige migrar para Next 16.
