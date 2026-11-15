-- FIGHT IQ — correção detalhada de previsões (B1/B2 da auditoria)
-- Separa acerto de vencedor, método e round, e distingue resolução automática
-- (resultado oficial) de marcação manual (sem resultado oficial).

alter table predictions
  add column if not exists resolution text check (resolution in ('auto','manual')),
  add column if not exists winner_correct boolean,
  add column if not exists method_correct boolean,
  add column if not exists round_correct boolean,
  add column if not exists actual_round integer;

-- Registros antigos resolvidos manualmente gravavam um vencedor deduzido (não oficial).
-- Limpa esses valores quando a luta vinculada não tem resultado oficial.
update predictions p
set actual_winner_id = null, actual_method = null, resolution = 'manual'
where p.status in ('correct','incorrect')
  and not exists (select 1 from fight_results r where r.fight_id = p.fight_id);
