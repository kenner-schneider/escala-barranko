-- 0001_schema.sql — Escala Barranko: schema base
-- Timezone do sistema: America/Sao_Paulo. Datas de escala são `date` (sem hora).

create extension if not exists pgcrypto;

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active' check (status in ('active','suspended')),
  settings jsonb not null default '{"availability_lead_hours":48,"default_monthly_limit":10}',
  created_at timestamptz not null default now()
);

-- Root e Admin (vinculados ao Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references restaurants(id),  -- null para root
  role text not null check (role in ('root','admin')),
  name text not null
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  name text not null,
  start_time time not null,
  end_time time not null,
  color text not null default '#3b82f6',
  active boolean not null default true
);

create table people (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  type text not null check (type in ('clt','free')),
  full_name text not null,
  display_name text not null,
  icon text,                      -- emoji ou cor
  phone text,                     -- obrigatório p/ free (validado na aplicação), null p/ clt
  monthly_limit int,              -- null = usa default do restaurante
  fixed_days jsonb,               -- clt: ex. {"mon":["<shift_id>"],...} p/ pré-preencher
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table free_credentials (
  person_id uuid primary key references people(id) on delete cascade,
  pin_hash text,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  token_hash text not null,       -- sha256 do token; token em claro nunca é persistido
  expires_at timestamptz not null,
  used_at timestamptz
);

create table availability (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  person_id uuid not null references people(id),
  date date not null,
  shift_id uuid not null references shifts(id),
  created_at timestamptz not null default now(),
  unique (person_id, date, shift_id)
);

create table schedule_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  person_id uuid not null references people(id),
  date date not null,
  shift_id uuid not null references shifts(id),
  status text not null default 'draft'
    check (status in ('draft','convoked','confirmed','declined')),
  convoked_at timestamptz,
  updated_by uuid,                -- profiles.id do admin
  updated_at timestamptz not null default now(),
  unique (person_id, date, shift_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  restaurant_id uuid,
  actor text not null,            -- 'admin:<uuid>' | 'root:<uuid>' | 'free:<uuid>' | 'system'
  action text not null,           -- ex. 'schedule.convoke', 'invite.create', 'person.anonymize'
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);

-- Índices
create index idx_shifts_restaurant on shifts (restaurant_id);
create index idx_people_restaurant on people (restaurant_id);
create index idx_invites_person on invites (person_id);
create index idx_invites_token on invites (token_hash);
create index idx_availability_rest_date on availability (restaurant_id, date);
create index idx_availability_person on availability (person_id, date);
create index idx_entries_rest_date on schedule_entries (restaurant_id, date);
create index idx_entries_person on schedule_entries (person_id, date);
create index idx_audit_rest on audit_log (restaurant_id, at desc);

-- Telefone único entre FREE ativos (login é global por telefone+PIN)
create unique index uniq_free_phone on people (phone) where type = 'free' and active;

-- updated_at automático em schedule_entries
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_entries_updated before update on schedule_entries
  for each row execute function set_updated_at();

-- Janela de antecedência — fonte da verdade NO SERVIDOR.
-- Aberta enquanto now() < (meia-noite de D em America/Sao_Paulo) - lead_hours.
create function is_within_lead_window(d date, rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select now() < (
    (d::text || ' 00:00')::timestamp at time zone 'America/Sao_Paulo'
    - make_interval(hours => coalesce(
        (select (settings->>'availability_lead_hours')::int from restaurants where id = rid), 48))
  )
$$;

-- Contadores mensais derivados (nunca armazenar contador redundante).
-- security_invoker: RLS de schedule_entries se aplica a quem consulta.
create view monthly_counts
with (security_invoker = true) as
with base as (
  select restaurant_id, person_id, date, shift_id,
         to_char(date, 'YYYY-MM') as month
  from schedule_entries
  where status in ('convoked','confirmed')
)
select
  b.restaurant_id,
  b.person_id,
  b.month,
  count(distinct b.date)::int as days_worked,
  (
    select jsonb_object_agg(t.shift_id::text, t.cnt)
    from (
      select b2.shift_id, count(*)::int as cnt
      from base b2
      where b2.person_id = b.person_id
        and b2.month = b.month
      group by b2.shift_id
    ) t
  ) as per_shift
from base b
group by b.restaurant_id, b.person_id, b.month;

grant select on monthly_counts to authenticated;

-- "Exclusão LGPD": anonimiza full_name/phone preservando contagens/histórico.
-- Só o Admin do próprio tenant pode executar (checagem interna; security definer).
create function anonymize_person(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_rest uuid;
  target_rest uuid;
begin
  select restaurant_id into caller_rest from profiles where id = auth.uid() and role = 'admin';
  select restaurant_id into target_rest from people where id = pid;
  if caller_rest is null or target_rest is null or caller_rest <> target_rest then
    raise exception 'não autorizado';
  end if;
  update people
     set full_name = 'Removido (LGPD)', phone = null, active = false
   where id = pid;
  delete from free_credentials where person_id = pid;
  delete from invites where person_id = pid;
  delete from availability where person_id = pid and date >= current_date;
  insert into audit_log (restaurant_id, actor, action, entity, entity_id)
  values (target_rest, 'admin:' || auth.uid(), 'person.anonymize', 'people', pid);
end $$;
