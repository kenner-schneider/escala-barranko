-- tests/rls.test.sql — Suite de RLS (critério de aceite nº 1)
-- Requer o seed de dev (0003) aplicado. Roda tudo em transação e faz ROLLBACK.
-- Uso (local): psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f tests/rls.test.sql
-- Sucesso = 4 notices "OK caso N". Falha = exception "RLS FALHOU ...".

begin;

-- Setup: tenant B + uma entrada draft no tenant A (como superusuário, ignora RLS)
insert into restaurants (id, name, slug) values
  ('bbbbbbbb-1111-1111-1111-111111111111', 'Tenant B Teste', 'tenant-b-teste');
insert into people (id, restaurant_id, type, full_name, display_name) values
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-1111-1111-1111-111111111111',
   'clt', 'Pessoa Tenant B', 'PessoaB');
insert into schedule_entries (restaurant_id, person_id, date, shift_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000001',
   current_date + 3, 'aaaaaaaa-0000-0000-0000-000000000001', 'draft')
on conflict (person_id, date, shift_id) do update set status = 'draft';

------------------------------------------------------------------------------
-- CASO 1: Admin do tenant A tentando ler dados do tenant B (deve falhar)
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from restaurants where slug = 'tenant-b-teste';
  if n > 0 then raise exception 'RLS FALHOU caso 1: admin A enxerga restaurante do tenant B'; end if;
  select count(*) into n from people where restaurant_id = 'bbbbbbbb-1111-1111-1111-111111111111';
  if n > 0 then raise exception 'RLS FALHOU caso 1: admin A enxerga pessoas do tenant B'; end if;
  raise notice 'OK caso 1: admin nao cruza tenant';
end $$;

reset role;

------------------------------------------------------------------------------
-- CASO 2: FREE tentando ler disponibilidade de outro FREE (deve falhar)
-- Fernanda (…01) logada; Fabio (…02) tem disponibilidade no seed.
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"person_id":"ffffffff-0000-0000-0000-000000000001","restaurant_id":"11111111-1111-1111-1111-111111111111","app_role":"free","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from availability
   where person_id <> 'ffffffff-0000-0000-0000-000000000001';
  if n > 0 then raise exception 'RLS FALHOU caso 2: FREE enxerga disponibilidade alheia'; end if;
  raise notice 'OK caso 2: FREE so ve a propria disponibilidade';
end $$;

------------------------------------------------------------------------------
-- CASO 3: FREE tentando inserir disponibilidade fora da janela (deve falhar)
-- Amanhã está sempre dentro das 48h de antecedência → janela fechada.
------------------------------------------------------------------------------
do $$
begin
  begin
    insert into availability (restaurant_id, person_id, date, shift_id) values
      ('11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000001',
       current_date + 1, 'aaaaaaaa-0000-0000-0000-000000000002');
    raise exception 'RLS FALHOU caso 3: insert fora da janela foi aceito';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'OK caso 3: janela de antecedencia bloqueou o insert';
  end;
end $$;

------------------------------------------------------------------------------
-- CASO 4: FREE tentando ler entrada draft (deve falhar)
------------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from schedule_entries where status = 'draft';
  if n > 0 then raise exception 'RLS FALHOU caso 4: FREE enxerga rascunho'; end if;
  raise notice 'OK caso 4: FREE nao ve rascunhos';
end $$;

reset role;
rollback;
