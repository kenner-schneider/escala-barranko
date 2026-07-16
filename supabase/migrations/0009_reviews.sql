-- 0009_reviews.sql — avaliações: critérios objetivos c/ peso, avaliação individual
-- semanal e nota da equipe por serviço (dia+turno).
--
-- Score final (calculado na aplicação, nunca armazenado):
--   (1 - peso_equipe) * média ponderada dos critérios + peso_equipe * média das notas
--   de equipe dos serviços em que a pessoa esteve presente (status confirmed).
-- Config (restaurants.settings jsonb): review_team_weight (%, default 20) e
-- ranking_window_weeks (0 = todo o período; N = últimas N semanas).
--
-- Todas admin-only por RLS: avaliações são sensíveis, o FREE não enxerga.

create table criteria (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  name text not null,
  weight numeric(5,2) not null default 1 check (weight > 0),
  sort_order int not null default 0,
  active boolean not null default true
);

-- Avaliação individual: 1 linha por pessoa+semana (week = segunda-feira ISO).
-- scores = {criterion_id: 1..5}; pesos aplicados na leitura (mudou peso, recalcula).
create table person_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  person_id uuid not null references people(id) on delete cascade,
  week date not null,
  scores jsonb not null default '{}',
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (person_id, week)
);

-- Nota da equipe por serviço (dia+turno) — preenchida na aba Presença.
create table team_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  date date not null,
  shift_id uuid not null references shifts(id),
  score int not null check (score between 1 and 5),
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, date, shift_id)
);

create index idx_criteria_restaurant on criteria (restaurant_id);
create index idx_person_reviews_rest_week on person_reviews (restaurant_id, week);
create index idx_team_reviews_rest_date on team_reviews (restaurant_id, date);

alter table criteria       enable row level security;
alter table person_reviews enable row level security;
alter table team_reviews   enable row level security;

create policy criteria_admin_all on criteria
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create policy person_reviews_admin_all on person_reviews
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create policy team_reviews_admin_all on team_reviews
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create trigger trg_person_reviews_updated before update on person_reviews
  for each row execute function set_updated_at();
create trigger trg_team_reviews_updated before update on team_reviews
  for each row execute function set_updated_at();
