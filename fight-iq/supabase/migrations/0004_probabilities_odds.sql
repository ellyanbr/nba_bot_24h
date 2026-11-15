-- FIGHT IQ — sistema de probabilidades e odds de mercado (D1/D2 da auditoria)

-- Estimativa de probabilidade de vitória (%), somando 100 com o empate.
alter table predictions
  add column if not exists probability_a numeric(5,2),
  add column if not exists probability_b numeric(5,2),
  add column if not exists probability_draw numeric(5,2);

alter table predictions drop constraint if exists predictions_probabilities_check;
alter table predictions add constraint predictions_probabilities_check check (
  (probability_a is null and probability_b is null and probability_draw is null)
  or (
    probability_a between 0 and 100 and probability_b between 0 and 100
    and coalesce(probability_draw, 0) between 0 and 100
    and abs(probability_a + probability_b + coalesce(probability_draw, 0) - 100) <= 0.5
  )
);

comment on column predictions.confidence is
  'Probabilidade (%) da previsão completa (vencedor + método/round). Antes da migração 0004: confiança de 50 a 100.';

create table if not exists odds_snapshots (
  id text primary key default gen_random_uuid()::text,
  analysis_id text references fight_analyses(id) on delete cascade,
  fight_id text references fights(id) on delete set null,
  fighter_a_id text not null references fighters(id) on delete cascade,
  fighter_b_id text not null references fighters(id) on delete cascade,
  bookmaker text not null,
  odds_a numeric(8,3) not null check (odds_a > 1),
  odds_b numeric(8,3) not null check (odds_b > 1),
  odds_draw numeric(8,3) check (odds_draw is null or odds_draw > 1),
  captured_at timestamptz not null default now(),
  contains_demo_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists odds_snapshots_analysis_idx on odds_snapshots(analysis_id);
create index if not exists odds_snapshots_fight_idx on odds_snapshots(fight_id);
alter table odds_snapshots enable row level security;
