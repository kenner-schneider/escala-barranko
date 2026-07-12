-- 0003_seed_dev.sql — SEED DE DESENVOLVIMENTO. NÃO APLICAR EM PRODUÇÃO.
-- 1 tenant, 2 turnos, 3 CLT, 5 FREE.
-- Credenciais dev:
--   Root:  root@dev.local  / root123456
--   Admin: admin@dev.local / admin123456
--   FREE (PIN 123456): telefones 5511999990001, ...0002, ...0003
--   FREE sem PIN (aguardando convite): ...0004, ...0005

-- Usuários do Supabase Auth (inserção direta só funciona/faz sentido no ambiente local)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'root@dev.local',
   crypt('root123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'admin@dev.local',
   crypt('admin123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
   '33333333-3333-3333-3333-333333333333', 'email',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"root@dev.local"}', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'email',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"admin@dev.local"}', now(), now(), now());

-- Tenant piloto
insert into restaurants (id, name, slug, settings) values
  ('11111111-1111-1111-1111-111111111111', 'Barranko', 'barranko',
   '{"availability_lead_hours":48,"default_monthly_limit":10}');

insert into profiles (id, restaurant_id, role, name) values
  ('33333333-3333-3333-3333-333333333333', null, 'root', 'Root Dev'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'admin', 'Gerente Dev');

-- Turnos padrão do piloto
insert into shifts (id, restaurant_id, name, start_time, end_time, color) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Meio-dia', '11:00', '15:00', '#f59e0b'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Noite', '18:00', '23:00', '#3b82f6');

-- 3 CLT (Carlos com dias fixos seg/qua/sex no Meio-dia)
insert into people (id, restaurant_id, type, full_name, display_name, icon, fixed_days) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'clt', 'Carlos Pereira', 'Carlos', '👨‍🍳',
   '{"mon":["aaaaaaaa-0000-0000-0000-000000000001"],"wed":["aaaaaaaa-0000-0000-0000-000000000001"],"fri":["aaaaaaaa-0000-0000-0000-000000000001"]}'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'clt', 'Cintia Souza', 'Cintia', '🧑‍🍳', null),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'clt', 'Cesar Lima', 'Cesar', '🍳', null);

-- 5 FREE
insert into people (id, restaurant_id, type, full_name, display_name, icon, phone, monthly_limit) values
  ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'free', 'Fernanda Alves', 'Fernanda', '⭐', '5511999990001', null),
  ('ffffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'free', 'Fabio Santos', 'Fabio', '🔥', '5511999990002', null),
  ('ffffffff-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'free', 'Flavia Costa', 'Flavia', '🌟', '5511999990003', 5),
  ('ffffffff-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'free', 'Felipe Rocha', 'Felipe', '⚡', '5511999990004', null),
  ('ffffffff-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'free', 'Fatima Dias', 'Fatima', '🌙', '5511999990005', null);

-- PIN 123456 para os 3 primeiros (bcrypt/bf custo 12 — compatível com bcryptjs)
insert into free_credentials (person_id, pin_hash) values
  ('ffffffff-0000-0000-0000-000000000001', crypt('123456', gen_salt('bf', 12))),
  ('ffffffff-0000-0000-0000-000000000002', crypt('123456', gen_salt('bf', 12))),
  ('ffffffff-0000-0000-0000-000000000003', crypt('123456', gen_salt('bf', 12)));

-- Disponibilidade dos próximos 7 dias (Fernanda nos 2 turnos; Fabio à noite; Flavia meio-dia)
insert into availability (restaurant_id, person_id, date, shift_id)
select '11111111-1111-1111-1111-111111111111', p.person_id, d::date, p.shift_id
from generate_series(current_date + 1, current_date + 7, interval '1 day') d
cross join (values
  ('ffffffff-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid),
  ('ffffffff-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  ('ffffffff-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  ('ffffffff-0000-0000-0000-000000000003'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid)
) as p(person_id, shift_id);

insert into audit_log (restaurant_id, actor, action, entity, entity_id)
values ('11111111-1111-1111-1111-111111111111', 'system', 'seed.dev', 'restaurants',
        '11111111-1111-1111-1111-111111111111');
