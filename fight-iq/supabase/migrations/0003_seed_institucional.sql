-- FIGHT IQ — dados institucionais mínimos (S3 da auditoria)
-- Sem isto, um projeto Supabase novo não teria nenhuma organização para associar
-- atletas e eventos. Contém apenas dados institucionais públicos (nome e site),
-- nenhum atleta ou estatística. Idempotente.

insert into data_sources (id, name, kind, description, is_demo)
values ('source-manual-institucional', 'Cadastro manual — dados institucionais', 'manual',
        'Informações institucionais de organizações cadastradas manualmente.', false)
on conflict (id) do nothing;

insert into organizations (id, name, slug, country, website, source_id, is_demo)
values ('org-ufc', 'UFC', 'ufc', 'Estados Unidos', 'https://www.ufc.com', 'source-manual-institucional', false)
on conflict (id) do nothing;
