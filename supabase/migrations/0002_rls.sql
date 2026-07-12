-- 0002_rls.sql — Row Level Security (requisito CRÍTICO de segurança)
--
-- Papéis:
--  * Admin: JWT do Supabase Auth (auth.uid() = profiles.id, role 'admin').
--  * FREE:  JWT customizado emitido pelas Edge Functions, assinado com o JWT secret
--           do projeto. Claims: person_id, restaurant_id, app_role='free',
--           role='authenticated' (sem 'sub' → auth.uid() é null; nunca casa policies de Admin).
--  * Root:  NENHUMA policy de acesso direto — opera só via Edge Functions (service role).

-- Helpers -------------------------------------------------------------------

create function auth_restaurant_id() returns uuid language sql stable as $$
  select restaurant_id from profiles where id = auth.uid()
$$;

create function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create function jwt_claims() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create function free_person_id() returns uuid language sql stable as $$
  select case when jwt_claims()->>'app_role' = 'free'
              then (jwt_claims()->>'person_id')::uuid end
$$;

create function free_restaurant_id() returns uuid language sql stable as $$
  select case when jwt_claims()->>'app_role' = 'free'
              then (jwt_claims()->>'restaurant_id')::uuid end
$$;

-- Habilitar RLS em TODAS as tabelas -----------------------------------------

alter table restaurants      enable row level security;
alter table profiles         enable row level security;
alter table shifts           enable row level security;
alter table people           enable row level security;
alter table free_credentials enable row level security;
alter table invites          enable row level security;
alter table availability     enable row level security;
alter table schedule_entries enable row level security;
alter table audit_log        enable row level security;

-- Defesa em profundidade: tabelas sensíveis só via service role (Edge Functions)
revoke all on free_credentials, invites, audit_log from anon, authenticated;

-- profiles: cada um lê o próprio -------------------------------------------

create policy profiles_self_select on profiles
  for select to authenticated using (id = auth.uid());

-- restaurants ----------------------------------------------------------------

create policy rest_admin_select on restaurants
  for select to authenticated using (id = auth_restaurant_id());

create policy rest_admin_update on restaurants
  for update to authenticated
  using (id = auth_restaurant_id() and is_admin())
  with check (id = auth_restaurant_id() and is_admin());

-- FREE lê o próprio restaurante (nome/settings — necessário p/ janela na UI)
create policy rest_free_select on restaurants
  for select to authenticated using (id = free_restaurant_id());

-- shifts ----------------------------------------------------------------------

create policy shifts_admin_all on shifts
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create policy shifts_free_select on shifts
  for select to authenticated using (restaurant_id = free_restaurant_id());

-- people ----------------------------------------------------------------------

create policy people_admin_all on people
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

-- FREE lê somente o próprio registro
create policy people_free_self on people
  for select to authenticated using (id = free_person_id());

-- availability -----------------------------------------------------------------

create policy avail_admin_all on availability
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create policy avail_free_select on availability
  for select to authenticated using (person_id = free_person_id());

-- INSERT/DELETE do FREE restritos pela janela de antecedência (servidor decide)
create policy avail_free_insert on availability
  for insert to authenticated
  with check (
    person_id = free_person_id()
    and restaurant_id = free_restaurant_id()
    and is_within_lead_window(date, restaurant_id)
    and exists (
      select 1 from shifts s
      where s.id = shift_id and s.restaurant_id = free_restaurant_id() and s.active
    )
  );

create policy avail_free_delete on availability
  for delete to authenticated
  using (
    person_id = free_person_id()
    and is_within_lead_window(date, restaurant_id)
  );

-- schedule_entries ---------------------------------------------------------------

create policy entries_admin_all on schedule_entries
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

-- FREE só enxerga entradas próprias e nunca rascunho
create policy entries_free_select on schedule_entries
  for select to authenticated
  using (person_id = free_person_id() and status <> 'draft');

-- free_credentials, invites, audit_log: SEM policies para anon/authenticated.
-- Acesso exclusivo via service role nas Edge Functions.
