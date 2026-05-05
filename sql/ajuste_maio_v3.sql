-- Ajustes maio/2026 — versão 3
-- Execute no SQL Editor do Supabase

-- Phablo: 6 → 4 (ajuste -1 sobre 5 relatorios reais)
UPDATE public.professores_info SET ajuste_aulas_mes = -1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'phablocarneirofarm@gmail.com');

-- Lael: 3 → 2 (ajuste 0 sobre 2 relatorios reais)
UPDATE public.professores_info SET ajuste_aulas_mes = 0, ajuste_mes_ref = NULL
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'laelpcss@gmail.com');

-- Thaise: 2 → 1 (ajuste 0 sobre 1 relatorio real)
UPDATE public.professores_info SET ajuste_aulas_mes = 0, ajuste_mes_ref = NULL
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'thaise.j.araujo@gmail.com');

-- Amanda: 5 → 3 (ajuste -1 sobre 4 relatorios reais)
UPDATE public.professores_info SET ajuste_aulas_mes = -1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'amandamamede2011@gmail.com');
