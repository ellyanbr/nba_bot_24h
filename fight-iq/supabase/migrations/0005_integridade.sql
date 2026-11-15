-- FIGHT IQ — integridade dos resultados, transações e permissões
-- Idempotente: pode ser executada mais de uma vez.

------------------------------------------------------------------------------
-- 1. Resultados: métodos válidos (inclui "Resultado anulado" = overturned)
------------------------------------------------------------------------------
alter table fight_results drop constraint if exists fight_results_method_check;
alter table fight_results add constraint fight_results_method_check check (method in (
  'KO/TKO', 'Finalização', 'Decisão unânime', 'Decisão dividida', 'Decisão majoritária',
  'Desqualificação', 'Sem resultado', 'Empate', 'Resultado anulado', 'Outro'
));
-- Vitória exige vencedor; empate, sem resultado e resultado anulado não têm vencedor.
alter table fight_results drop constraint if exists fight_results_winner_check;
alter table fight_results add constraint fight_results_winner_check check (
  (method in ('Empate', 'Sem resultado', 'Resultado anulado') and winner_id is null)
  or (method not in ('Empate', 'Sem resultado', 'Resultado anulado') and winner_id is not null)
);
alter table fight_results drop constraint if exists fight_results_round_check;
alter table fight_results add constraint fight_results_round_check check (round is null or round between 1 and 5);

------------------------------------------------------------------------------
-- 2. Previsões: motivo de anulação
------------------------------------------------------------------------------
alter table predictions add column if not exists void_reason text;
alter table predictions drop constraint if exists predictions_void_reason_check;
alter table predictions add constraint predictions_void_reason_check
  check (void_reason is null or void_reason in ('draw', 'no_contest', 'overturned', 'cancelled', 'manual'));

-- Dados existentes (equivalente à migração local migrateIntegrity):
-- previsões corrigidas por resultado oficial ficam com resolution = 'auto' (lacuna da 0002)
update predictions p set resolution = 'auto'
where p.status <> 'pending' and p.resolution is null
  and exists (select 1 from fight_results r where r.fight_id = p.fight_id);
-- empate deixa de contar como erro: previsão anulada (motivo empate)
update predictions set status = 'void', void_reason = 'draw',
  winner_correct = null, method_correct = null, round_correct = null
where resolution = 'auto' and actual_method = 'Empate' and void_reason is null;
update predictions set void_reason = case when actual_method = 'Sem resultado' then 'no_contest' else 'manual' end
where status = 'void' and void_reason is null;

alter table predictions drop constraint if exists predictions_void_consistency_check;
alter table predictions add constraint predictions_void_consistency_check
  check ((status = 'void') = (void_reason is not null));

alter table predictions drop constraint if exists predictions_method_check;
alter table predictions add constraint predictions_method_check check (method in (
  'Qualquer', 'KO/TKO', 'Finalização', 'Decisão unânime', 'Decisão dividida', 'Decisão majoritária',
  'Desqualificação', 'Sem resultado', 'Empate', 'Resultado anulado', 'Outro'
));

------------------------------------------------------------------------------
-- 3. Apostas: mercado de 2 ou 3 vias (define o efeito do empate)
------------------------------------------------------------------------------
alter table bets add column if not exists market text not null default '2way';
alter table bets drop constraint if exists bets_market_check;
alter table bets add constraint bets_market_check check (market in ('2way', '3way'));

------------------------------------------------------------------------------
-- 4. Índices para as consultas mais comuns
------------------------------------------------------------------------------
create index if not exists predictions_fight_idx on predictions(fight_id);
create index if not exists predictions_analysis_idx on predictions(analysis_id);
create index if not exists bets_prediction_idx on bets(prediction_id);
create index if not exists fighter_statistics_fighter_key_idx on fighter_statistics(fighter_id, stat_key);

------------------------------------------------------------------------------
-- 5. updated_at mantido pelo banco
------------------------------------------------------------------------------
create or replace function fightiq_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['data_sources','organizations','fighters','fighter_statistics','events','fights',
                           'fight_results','fight_analyses','odds_snapshots','predictions','bets'] loop
    execute format('drop trigger if exists %I on %I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function fightiq_touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 6. Transações: aplica um lote de operações numa única transação (tudo ou nada)
--    ops = [{"op":"insert","table":"...","row":{...}},
--           {"op":"update","table":"...","id":"...","patch":{...}},
--           {"op":"delete","table":"...","id":"..."}]
------------------------------------------------------------------------------
create or replace function fightiq_apply_batch(ops jsonb) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  op jsonb;
  t text;
  payload jsonb;
  cols text;
  bad text;
  n integer;
  total integer := 0;
  allowed constant text[] := array['data_sources','organizations','fighters','fighter_statistics','events','fights',
                                   'fight_results','fight_analyses','odds_snapshots','predictions','bets'];
begin
  if jsonb_typeof(ops) <> 'array' then
    raise exception 'fightiq_apply_batch: ops deve ser um array';
  end if;
  if jsonb_array_length(ops) > 20000 then
    raise exception 'fightiq_apply_batch: lote grande demais (% operações)', jsonb_array_length(ops);
  end if;

  for op in select value from jsonb_array_elements(ops) loop
    t := op->>'table';
    if t is null or not (t = any(allowed)) then
      raise exception 'fightiq_apply_batch: tabela não permitida: %', coalesce(t, '(nula)');
    end if;

    if op->>'op' in ('insert', 'update') then
      payload := case when op->>'op' = 'insert' then op->'row' else op->'patch' end;
      if payload is null or jsonb_typeof(payload) <> 'object' then
        raise exception 'fightiq_apply_batch: % sem dados para %', op->>'op', t;
      end if;
      -- Colunas desconhecidas são erro (evita perder dados por nome de campo errado).
      select string_agg(k, ', ') into bad
      from jsonb_object_keys(payload) k
      where not exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t and c.column_name = k);
      if bad is not null then
        raise exception 'fightiq_apply_batch: coluna(s) inexistente(s) em %: %', t, bad;
      end if;
    end if;

    case op->>'op'
      when 'insert' then
        select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(payload) k;
        execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)', t, cols, cols, t)
          using payload;
      when 'update' then
        select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(payload) k where k <> 'id';
        if cols is null then
          continue;
        end if;
        execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, $1)) where id = $2',
                       t, cols, cols, t)
          using payload, op->>'id';
        get diagnostics n = row_count;
        if n <> 1 then
          raise exception 'fightiq_apply_batch: registro não encontrado: %/%', t, op->>'id';
        end if;
      when 'delete' then
        execute format('delete from %I where id = $1', t) using op->>'id';
      else
        raise exception 'fightiq_apply_batch: operação inválida: %', coalesce(op->>'op', '(nula)');
    end case;
    total := total + 1;
  end loop;
  return total;
end $$;

------------------------------------------------------------------------------
-- 7. Permissões (Supabase)
--    O app acessa o banco SOMENTE pelo servidor, com a service role.
--    As chaves públicas (anon) e de usuários (authenticated) não leem nem gravam nada:
--    além do RLS sem políticas (0001), os privilégios são revogados explicitamente.
------------------------------------------------------------------------------
revoke all on function fightiq_apply_batch(jsonb) from public;
revoke all on function fightiq_touch_updated_at() from public;

do $$
declare
  r text;
  t text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      foreach t in array array['data_sources','organizations','fighters','fighter_statistics','events','fights',
                               'fight_results','fight_analyses','odds_snapshots','predictions','bets'] loop
        execute format('revoke all on table %I from %I', t, r);
      end loop;
      execute format('revoke all on function fightiq_apply_batch(jsonb) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function fightiq_apply_batch(jsonb) to service_role';
  end if;
end $$;
