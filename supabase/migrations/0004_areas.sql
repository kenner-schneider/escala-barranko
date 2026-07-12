-- 0004_areas.sql — "Escalas" (setores): bar, cozinha, atendimento...
-- Eixo SEPARADO do turno. A exclusividade "1 pessoa por escala no mesmo dia+turno"
-- já é garantida pelo unique(person_id, date, shift_id) existente — escalar em outra
-- escala faz UPDATE do area_id (move), sem violar o unique.

create table areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  name text not null,
  color text not null default '#6366f1',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_areas_restaurant on areas (restaurant_id);

alter table schedule_entries add column area_id uuid references areas(id);
create index idx_entries_area on schedule_entries (area_id);

-- Backfill: um setor "Geral" por restaurante + vincula as escalas já existentes.
do $$
declare r record; aid uuid;
begin
  for r in select id from restaurants loop
    insert into areas (restaurant_id, name, sort_order) values (r.id, 'Geral', 0)
    returning id into aid;
    update schedule_entries set area_id = aid where restaurant_id = r.id and area_id is null;
  end loop;
end $$;

-- Fica NULLABLE de propósito: evita quebrar o frontend antigo na janela entre rodar
-- esta migration e publicar o frontend novo (que sempre preenche area_id).

-- RLS: Admin faz CRUD no próprio tenant; FREE lê (p/ ver o setor na escala/mensagem).
alter table areas enable row level security;

create policy areas_admin_all on areas
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create policy areas_free_select on areas
  for select to authenticated using (restaurant_id = free_restaurant_id());
