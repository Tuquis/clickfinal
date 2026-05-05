-- Ajustes finais maio/2026
-- Execute no SQL Editor do Supabase

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'amandamamede2011@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'laelpcss@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'phablocarneirofarm@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'tiellybalima@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'wilgner.santos@ufpe.br');
