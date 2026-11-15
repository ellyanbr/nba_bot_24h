# Conectar o FIGHT IQ a um projeto Supabase gratuito

O FIGHT IQ funciona sem banco externo (arquivo JSON local). O Supabase é **opcional** e serve para
usar um PostgreSQL real e gerenciado — por exemplo, para hospedar o app fora da sua máquina.

> Custo: o plano gratuito do Supabase atende o MVP. Confira os limites atuais em supabase.com/pricing
> antes de usar (armazenamento, pausa de projetos inativos etc.).

## 1. Criar o projeto

1. Acesse supabase.com, crie uma conta e um projeto no plano **Free**.
2. Anote a senha do banco definida na criação (necessária só para o teste de banco, passo 6).

## 2. Aplicar as migrações (em ordem)

No painel do projeto: **SQL Editor → New query**. Cole e execute, um por vez, **nesta ordem**:

| Arquivo | O que faz |
|---|---|
| `supabase/migrations/0001_init.sql` | Tabelas, chaves estrangeiras, RLS ativado |
| `supabase/migrations/0002_prediction_grading.sql` | Correção detalhada de previsões |
| `supabase/migrations/0003_seed_institucional.sql` | Organização UFC (apenas dados institucionais) |
| `supabase/migrations/0004_probabilities_odds.sql` | Probabilidades e odds de mercado |
| `supabase/migrations/0005_integridade.sql` | Regras de resultado, transações, `updated_at`, permissões |

Todas são **idempotentes**: executar de novo não causa erro nem duplica dados.
Verificado num PostgreSQL 16 real pela suíte `npm run test:db` (inclusive a segunda execução).

## 3. Copiar as chaves

**Project Settings → API**:

- **Project URL** → `SUPABASE_URL`
- **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`
- **anon / public** → `SUPABASE_ANON_KEY` (usada **apenas** no teste de permissões; o app não precisa dela)

> ⚠️ A `service_role` ignora o RLS e dá acesso total ao banco. Ela é lida **somente no servidor**
> (módulos `server-only`), nunca vai para o navegador e não deve ser versionada. O teste
> `tests/unit/client-bundle.test.ts` verifica, após o build, que nomes e valores de segredos
> não aparecem no código enviado ao navegador.

## 4. Configurar o app

Crie `fight-iq/.env.local` (já ignorado pelo Git):

```bash
DATA_BACKEND=supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

Reinicie o app (`npm run build && npm start`). Em **Configurações**, o card "Armazenamento" deve
mostrar **Supabase**. Para ter os dados fictícios, use "Carregar demonstração".

## 5. Testar persistência, CRUD, transações e permissões (API real)

```bash
FIGHTIQ_SUPABASE_TEST=1 \
SUPABASE_URL=https://SEU-PROJETO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role \
SUPABASE_ANON_KEY=sua-chave-anon \
npm run test:supabase
```

O que é verificado (`tests/supabase/supabase.test.ts`):

- conexão e esquema migrado (organização UFC presente);
- função de transação `fightiq_apply_batch` disponível para a service role;
- CRUD com tipos preservados (números decimais, datas, booleanos) e `updated_at` pelo banco;
- persistência entre conexões diferentes;
- transação com várias tabelas e **rollback** quando uma operação falha;
- restrição de unicidade aplicada pela API;
- com `SUPABASE_ANON_KEY`: a chave pública **não lê, não grava e não executa** a função de transação.

Os testes **não são destrutivos**: criam registros com o prefixo `zz-teste-` e os removem ao final.

## 6. (Opcional) Testar as migrações direto no PostgreSQL

A suíte `npm run test:db` **recria o schema `public`** — use somente num banco descartável
(local ou um projeto Supabase criado só para testes; nunca no projeto com dados reais).

```bash
# PostgreSQL local:
DATABASE_URL=postgres://postgres@127.0.0.1:5432/fightiq_test npm run test:db
```

Por segurança, a suíte recusa bancos cujo nome não contenha "test" (a menos que
`FIGHTIQ_ALLOW_DB_RESET=1`). Ela simula os papéis do Supabase (`anon`, `authenticated`,
`service_role`) e verifica migrações, idempotência, RLS, mapeamento de todas as entidades,
restrições de domínio, rollback e permissões.

## Como as transações funcionam

O PostgREST (API do Supabase) não oferece transações com várias requisições. Por isso, as
operações que gravam em várias tabelas (salvar análise, registrar resultado, cancelar luta,
importar CSV, carregar/remover demonstração) acumulam as escritas e as enviam **juntas** à função
`fightiq_apply_batch`, que executa tudo numa única transação PostgreSQL: ou tudo é gravado, ou nada.

Limitação conhecida: as leituras feitas antes do envio não bloqueiam linhas. A consistência entre
requisições simultâneas é garantida pelas restrições do banco (chaves primárias, unicidade —
por exemplo, um único resultado por luta — e chaves estrangeiras). Em caso de conflito, a operação
inteira é recusada e pode ser repetida.
