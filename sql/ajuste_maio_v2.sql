-- Ajustes maio/2026 — versão 2
-- Execute no SQL Editor do Supabase

-- Wilgner: 5 → 1
UPDATE public.professores_info SET ajuste_aulas_mes = 1
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'wilgner.santos@ufpe.br');

-- Lael: 2 → 1
UPDATE public.professores_info SET ajuste_aulas_mes = 1
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'laelpcss@gmail.com');

-- Lucas Guimarães: 1 → 0
UPDATE public.professores_info SET ajuste_aulas_mes = 0, ajuste_mes_ref = NULL
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'proflucaslvguimaraes@gmail.com');

-- Phablo: 3 → 1
UPDATE public.professores_info SET ajuste_aulas_mes = 1
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'phablocarneirofarm@gmail.com');

-- Rayssa: 1 → 0
UPDATE public.professores_info SET ajuste_aulas_mes = 0, ajuste_mes_ref = NULL
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'rayssasantana24@yahoo.com');

-- Amanda: +1
UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'amandamamede2011@gmail.com');
