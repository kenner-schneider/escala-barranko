-- 0006_person_areas.sql — elegibilidade: em quais escalas (setores) a pessoa concorre.
-- Uma pessoa pode concorrer a mais de uma escala (ex.: cozinha E bar, mas não atendimento).
-- Definido no cadastro. Array de area_id (jsonb, mesmo padrão de fixed_days).
-- NULL ou [] = concorre a TODAS as escalas ativas (compatível com o piloto atual —
-- ninguém some das escalas até o gerente restringir).

alter table people add column if not exists area_ids jsonb;

-- Sem nova policy: as policies de people já cobrem a coluna.
