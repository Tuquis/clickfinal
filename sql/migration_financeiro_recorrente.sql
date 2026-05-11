-- ============================================================
-- MIGRAÇÃO: Cobrança Recorrente no Financeiro
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar colunas de recorrência na tabela financeiro
ALTER TABLE public.financeiro
    ADD COLUMN IF NOT EXISTS recorrente     BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
    ADD COLUMN IF NOT EXISTS pago_em        DATE;   -- caso ainda não exista

-- 2. Atualizar a view v_financeiro_completo para incluir os novos campos
-- (DROP + CREATE necessário pois PostgreSQL não permite reordenar colunas com CREATE OR REPLACE)
DROP VIEW IF EXISTS public.v_financeiro_completo;

CREATE VIEW public.v_financeiro_completo AS
SELECT
    f.id,
    f.descricao,
    f.valor,
    f.vencimento,
    f.status,
    f.pago_em,
    f.created_at,
    f.recorrente,
    f.dia_vencimento,
    u.nome AS aluno_nome,
    u.id   AS aluno_id
FROM public.financeiro f
JOIN public.usuarios u ON u.id = f.aluno_id;

-- Regrant de permissões para anon/authenticated após recriar a view
GRANT SELECT ON public.v_financeiro_completo TO anon, authenticated;

-- 3. Garantir que a RLS permite leitura dos novos campos
-- (as políticas existentes já cobrem a tabela inteira, não precisa alterar)

-- 4. Índice opcional para filtrar por recorrente rapidamente
CREATE INDEX IF NOT EXISTS idx_financeiro_recorrente
    ON public.financeiro (recorrente)
    WHERE recorrente = true;
