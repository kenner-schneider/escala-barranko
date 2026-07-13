-- 0005_shift_label.sql — rótulo curto (ícone) do turno.
-- Ex.: "M11", "N", "ALM". Até 3 caracteres alfanuméricos (validado na aplicação).
-- Usado no lugar da inicial automática do nome, p/ diferenciar turnos com nomes parecidos
-- (ex.: "Noite 1º turno" e "Noite" apareciam ambos como "N").
-- Nullable: quando vazio, o frontend cai na inicial do nome.

alter table shifts add column if not exists label text;

-- Sem nova policy: as policies de shifts (admin CRUD no próprio tenant) já cobrem a coluna.
