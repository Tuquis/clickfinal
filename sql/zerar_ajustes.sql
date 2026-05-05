-- Zera todos os ajustes mensais para ver o valor real de relatorios
UPDATE public.professores_info
SET ajuste_aulas_mes = 0,
    ajuste_mes_ref   = NULL;
