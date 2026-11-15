# FIGHT IQ — MMA Analytics & Fight Intelligence

Plataforma de inteligência esportiva para análise técnica de confrontos de MMA (inicialmente UFC).
MVP com **custo R$ 0,00**: roda localmente, sem APIs pagas, sem cartão de crédito e **totalmente funcional sem IA**.

## Como rodar

```bash
cd fight-iq
npm install
npm run dev          # http://127.0.0.1:3000 (somente esta máquina)
# produção local:
npm run build && npm start
# acessível na rede local (use com senha — veja Segurança):
npm run build && npm run start:lan
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
3. 16 fatores (últimas 3 lutas, qualidade dos adversários, striking, wrestling, defesa de quedas, grappling, jiu-jitsu, cardio, queixo, potência, tamanho/envergadura, idade, inatividade, lesões, corte de peso, camp). Para cada um: fatos extraídos dos dados ou **"Dados insuficientes"**, e **limitações** (histórico que não cobre o cartel, estatísticas com datas/fontes diferentes, ausência de métrica própria). O indicador numérico só aparece quando todas as métricas do fator apontam para o mesmo atleta. Você define vantagem, se é fato ou interpretação, e a justificativa.
4. Caminhos para vitória, argumentos e vulnerabilidades **dos dois lados**; quem tem mais caminhos.
5. **Previsão com probabilidades** (opcional): sua estimativa em % para A, B e empate (soma 100); vencedor, método e round; probabilidade da previsão completa (≤ à do vencedor).
6. **Odds de mercado** (opcional): os dois lados de cada casa. O sistema calcula:
   - probabilidade implícita (100 ÷ odds), **margem da casa** (soma das implícitas − 100) e probabilidade **sem margem** (método proporcional);
   - **valor esperado pela sua estimativa** (p × odds − 1) e odds justas (100 ÷ p) — "sem valor esperado" é uma conclusão sobre a sua estimativa, não um alerta de mercado;
   - **inconsistências de mercado**, independentes da sua opinião: soma abaixo de 100%, margem acima de 10%, divergência entre casas acima de 5 p.p., arbitragem.
7. **Questionamentos automáticos por regras** (escolha contra a maioria dos fatores, escolher o atleta que a própria estimativa considera menos provável, probabilidade extrema com muitos fatores desconhecidos, análise unilateral etc.).
8. Análise por IA, se configurada. Tudo é salvo com um retrato dos dados para auditoria.

Previsões vinculadas a uma luta são corrigidas automaticamente quando o resultado oficial é registrado: **vencedor, método e round são avaliados separadamente**, e a previsão só conta como acerto se todos os componentes previstos acertarem. Marcações manuais nunca gravam resultado real. O Histórico mostra acerto completo, acerto do vencedor, **Brier score**, **log loss** e calibração (probabilidade atribuída ao escolhido × frequência com que ele venceu).

## Importação CSV

`/importar` — lutadores (com estatísticas), eventos e lutas/resultados. Aceita vírgula ou ponto e vírgula, UTF-8.
O arquivo inteiro é validado antes de gravar (tudo ou nada); duplicados são ignorados. Modelos para download na própria página.

## Configurações externas opcionais (todas gratuitas)

### IA local com Ollama
1. Instale em https://ollama.com/download e rode `ollama pull llama3.1:8b`.
2. Em `.env.local`: `AI_PROVIDER=ollama`, `OLLAMA_MODEL=llama3.1:8b`.
3. Reinicie. Limitação: precisa de ~8 GB de RAM; mais lento e menos preciso que modelos comerciais.

### Supabase (PostgreSQL gerenciado)
Passo a passo completo em [`docs/SUPABASE.md`](docs/SUPABASE.md): criar o projeto gratuito, aplicar as migrações `0001` a `0005`, configurar as chaves (somente no servidor) e rodar os testes de persistência, CRUD, transações e permissões contra o projeto real.

## Integridade dos dados

- **Resultado só a partir da data do evento** (formulário, servidor e CSV). Tolerância de fuso: a data precisa já ter começado em algum lugar do mundo (UTC+14).
- **Natureza do resultado**: vitória, empate, sem resultado (NC) e **resultado anulado** (revertido depois da luta); luta **cancelada** é um status da luta, não um resultado. O histórico do atleta mostra V, D, E, NC e Anulada.
- **Previsões anuladas** (empate, NC, resultado anulado, luta cancelada ou anulação manual) não contam como acerto nem como erro. O empate continua avaliável no Brier score, pois a estimativa inclui a probabilidade de empate.
- **Apostas** (no vencedor previsto) são liquidadas pelo acerto do vencedor. Empate: devolvida em mercado de 2 vias, perdida em mercado de 3 vias.
- **Transações**: operações que gravam em várias tabelas usam `store.atomic()` — tudo ou nada (local: gravação única do arquivo; Supabase: função `fightiq_apply_batch` numa transação PostgreSQL). Salvar a mesma análise duas vezes não duplica (id gerado no navegador); o resultado é único por luta.

## Testes

```bash
npm test             # unitários + ponta a ponta
npm run test:unit    # Vitest — regras puras, transações, banco local, segredos no bundle
npm run build && npm run test:e2e   # Playwright — sobe o app com um banco temporário em test-results/
DATABASE_URL=postgres://.../fightiq_test npm run test:db   # PostgreSQL real e descartável: migrações, RLS, permissões, rollback
FIGHTIQ_SUPABASE_TEST=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:supabase  # projeto Supabase real (não destrutivo)
```

Na primeira vez, instale o navegador dos testes: `npx playwright install chromium` (ou defina `PW_CHROMIUM_PATH`).

## Segurança

- O servidor escuta apenas em `127.0.0.1` por padrão. `npm run start:lan` expõe na rede local.
- Proteção opcional por senha (HTTP Basic Auth) em todas as páginas e ações: defina `APP_BASIC_AUTH_USER` e `APP_BASIC_AUTH_PASSWORD`. Fora da sua máquina, use somente atrás de HTTPS. Não substitui um sistema de login com usuários.
- Chaves (Supabase, IA) são lidas apenas no servidor; nenhuma variável `NEXT_PUBLIC_`.

## Limitações conhecidas

- **Armazenamento local** atende um único processo; não use em hospedagem serverless (disco efêmero) — use Supabase.
- **Adaptador Supabase** foi implementado e tipado, mas não testado contra uma instância real neste ambiente.
- **Sem contas de usuário**: há apenas a senha única opcional (Basic Auth). Antes de expor publicamente, adicionar login.
- Consultas compõem relações em memória — adequado ao volume de um MVP.
- Não há integração automática com fontes de dados de MMA; a entrada é manual/CSV por escolha (custo zero e procedência controlada).
- **Dependências**: `npm audit` tem 1 alerta restante (Zod, alto), mitigado sem migrar para o Zod 4 — os tamanhos de arrays são verificados antes da validação (medição e justificativa em `src/lib/utils/input-guards.ts`). O PostCSS embutido no Next e o minimatch do typescript-eslint são corrigidos por `overrides` pontuais no `package.json` (o CSS gerado ficou idêntico, byte a byte).
