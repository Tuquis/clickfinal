-- ============================================================
-- MIGRATION: valor por hora-aula configurável por professor
-- (R$20 ou R$23). Admin alterna em Financeiro → Finanças dos
-- Professores; o valor a pagar do mês é sempre recalculado na
-- hora a partir da contagem de relatórios × esse valor — não
-- precisa de nenhum backfill, só passa a existir a partir de agora.
--
-- Pagamentos já registrados em pagamentos_professores guardam o
-- valor congelado de quando foram pagos — mudar a taxa aqui não
-- reescreve histórico, só afeta o cálculo do mês corrente (ainda
-- não pago) daqui pra frente.
-- ============================================================

ALTER TABLE public.professores_info
    ADD COLUMN IF NOT EXISTS valor_hora_aula NUMERIC(10,2) NOT NULL DEFAULT 20;

ALTER TABLE public.professores_info DROP CONSTRAINT IF EXISTS professores_info_valor_hora_check;
ALTER TABLE public.professores_info ADD CONSTRAINT professores_info_valor_hora_check
    CHECK (valor_hora_aula IN (20, 23));
