-- 0008_entry_overlap.sql — proíbe a mesma pessoa em turnos com HORÁRIO sobreposto no mesmo dia.
-- Ex.: "Atendimento 17:30–00:00" e "Atendimento 18:00–00:00" não podem coexistir p/ a mesma pessoa.
-- O unique (person_id, date, shift_id) já cobre o MESMO turno; aqui cobrimos turnos DIFERENTES
-- cujas faixas se cruzam. A UI também bloqueia (pill "conflito"); o trigger é a fonte da verdade.

-- end <= start = turno cruza a meia-noite (ex.: 18:00–02:00) → soma 24h no fim.
-- Fronteiras coincidentes (11–15 e 15–23) NÃO contam como sobreposição.
create or replace function shifts_overlap(a_start time, a_end time, b_start time, b_end time)
returns boolean language sql immutable as $$
  with n as (
    select extract(epoch from a_start)::int as s1,
           case when a_end <= a_start then extract(epoch from a_end)::int + 86400
                else extract(epoch from a_end)::int end as e1,
           extract(epoch from b_start)::int as s2,
           case when b_end <= b_start then extract(epoch from b_end)::int + 86400
                else extract(epoch from b_end)::int end as e2
  )
  select s1 < e2 and s2 < e1 from n
$$;

create or replace function entries_no_overlap() returns trigger
language plpgsql as $$
declare
  conflito record;
begin
  select s_old.name into conflito
  from schedule_entries e
  join shifts s_new on s_new.id = new.shift_id
  join shifts s_old on s_old.id = e.shift_id
  where e.person_id = new.person_id
    and e.date = new.date
    and e.id is distinct from new.id
    and e.shift_id <> new.shift_id
    and e.status <> 'declined'
    and shifts_overlap(s_new.start_time, s_new.end_time, s_old.start_time, s_old.end_time)
  limit 1;
  if found then
    raise exception 'Conflito de horário: já escalado em "%" neste dia.', conflito.name;
  end if;
  return new;
end $$;

create trigger trg_entries_no_overlap before insert or update on schedule_entries
  for each row execute function entries_no_overlap();
