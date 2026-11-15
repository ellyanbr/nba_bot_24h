-- FIGHT IQ — esquema inicial (PostgreSQL / Supabase)
-- Executar no SQL Editor do Supabase (plano gratuito) ou via `supabase db push`.
-- Convenção: colunas snake_case; a aplicação converte para camelCase.
-- IDs são texto para aceitar UUIDs gerados pela aplicação e IDs fixos de demonstração.

create table if not exists data_sources (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  kind text not null check (kind in ('demo','manual','csv','api','official_site','other')),
  url text,
  description text,
  retrieved_at date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  country text,
  website text,
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fighters (
  id text primary key default gen_random_uuid()::text,
  organization_id text references organizations(id) on delete set null,
  name text not null,
  nickname text,
  nationality text,
  birth_date date,
  height_cm numeric(5,1),
  reach_cm numeric(5,1),
  stance text,
  weight_class text,
  team text,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  no_contests integer not null default 0 check (no_contests >= 0),
  wins_by_ko integer,
  wins_by_sub integer,
  wins_by_dec integer,
  active boolean not null default true,
  notes text,
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fighters_org_idx on fighters(organization_id);
create index if not exists fighters_weight_idx on fighters(weight_class);

create table if not exists fighter_statistics (
  id text primary key default gen_random_uuid()::text,
  fighter_id text not null references fighters(id) on delete cascade,
  stat_key text not null,
  value numeric not null,
  as_of date,
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fighter_statistics_fighter_idx on fighter_statistics(fighter_id);

create table if not exists events (
  id text primary key default gen_random_uuid()::text,
  organization_id text references organizations(id) on delete set null,
  name text not null,
  date date not null,
  venue text,
  city text,
  country text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_date_idx on events(date);

create table if not exists fights (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references events(id) on delete cascade,
  red_fighter_id text not null references fighters(id) on delete restrict,
  blue_fighter_id text not null references fighters(id) on delete restrict,
  weight_class text,
  scheduled_rounds integer not null default 3 check (scheduled_rounds in (3,5)),
  is_title_fight boolean not null default false,
  is_main_event boolean not null default false,
  bout_order integer not null default 99,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (red_fighter_id <> blue_fighter_id)
);
create index if not exists fights_event_idx on fights(event_id);

create table if not exists fight_results (
  id text primary key default gen_random_uuid()::text,
  fight_id text not null unique references fights(id) on delete cascade,
  winner_id text references fighters(id) on delete set null,
  method text not null,
  round integer,
  time text,
  details text,
  source_id text references data_sources(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fight_analyses (
  id text primary key default gen_random_uuid()::text,
  fight_id text references fights(id) on delete set null,
  fighter_a_id text not null references fighters(id) on delete cascade,
  fighter_b_id text not null references fighters(id) on delete cascade,
  title text not null,
  factors jsonb not null default '[]'::jsonb,
  paths_to_victory_a text not null default '',
  paths_to_victory_b text not null default '',
  arguments_a text not null default '',
  arguments_b text not null default '',
  vulnerabilities_a text not null default '',
  vulnerabilities_b text not null default '',
  more_paths text not null default 'unknown' check (more_paths in ('A','B','even','unknown')),
  summary text not null default '',
  ai_output jsonb,
  data_snapshot jsonb,
  contains_demo_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists predictions (
  id text primary key default gen_random_uuid()::text,
  analysis_id text references fight_analyses(id) on delete set null,
  fight_id text references fights(id) on delete set null,
  fighter_a_id text not null references fighters(id) on delete cascade,
  fighter_b_id text not null references fighters(id) on delete cascade,
  pick_fighter_id text not null references fighters(id) on delete cascade,
  method text not null default 'Qualquer',
  round integer,
  confidence integer not null check (confidence between 0 and 100),
  notes text,
  status text not null default 'pending' check (status in ('pending','correct','incorrect','void')),
  actual_winner_id text references fighters(id) on delete set null,
  actual_method text,
  resolved_at timestamptz,
  contains_demo_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bets (
  id text primary key default gen_random_uuid()::text,
  prediction_id text not null references predictions(id) on delete cascade,
  decimal_odds numeric(7,3) not null check (decimal_odds > 1),
  stake numeric(12,2),
  bookmaker text,
  status text not null default 'open' check (status in ('open','won','lost','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Segurança: RLS ativado sem políticas públicas. A aplicação acessa somente pelo
-- servidor com a service role key; a chave anônima não lê nem grava nada.
alter table data_sources enable row level security;
alter table organizations enable row level security;
alter table fighters enable row level security;
alter table fighter_statistics enable row level security;
alter table events enable row level security;
alter table fights enable row level security;
alter table fight_results enable row level security;
alter table fight_analyses enable row level security;
alter table predictions enable row level security;
alter table bets enable row level security;
