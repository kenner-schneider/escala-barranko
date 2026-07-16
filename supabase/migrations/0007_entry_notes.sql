-- 0007_entry_notes.sql — bloco de notas por presença (consumo do funcionário).
-- Ex.: "1 coca, 1 água c/ gás" + valor opcional em R$ p/ desconto.
--
-- Tabela SEPARADA de schedule_entries de propósito: o FREE lê as próprias linhas
-- de schedule_entries (policy entries_free_select) e admin/free compartilham o
-- role Postgres 'authenticated' — não dá p/ esconder coluna por RLS. Aqui a
-- anotação é visível SÓ para o admin do tenant.
--
-- 1:1 com a entrada da escala (PK = entry_id). on delete cascade: removeu a
-- pessoa da escala, a anotação daquele dia/turno vai junto.

create table entry_notes (
  entry_id uuid primary key references schedule_entries(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  note text not null default '',
  value numeric(10,2) check (value is null or value >= 0),  -- R$ a descontar (opcional)
  updated_by uuid,                -- profiles.id do admin
  updated_at timestamptz not null default now()
);

create index idx_entry_notes_restaurant on entry_notes (restaurant_id);

alter table entry_notes enable row level security;

-- Só admin do próprio tenant; nenhuma policy p/ FREE (anotação é privada do gestor).
create policy entry_notes_admin_all on entry_notes
  for all to authenticated
  using (restaurant_id = auth_restaurant_id() and is_admin())
  with check (restaurant_id = auth_restaurant_id() and is_admin());

create trigger trg_entry_notes_updated before update on entry_notes
  for each row execute function set_updated_at();
