-- Adiciona colunas de ajuste mensal em professores_info
ALTER TABLE public.professores_info
    ADD COLUMN IF NOT EXISTS ajuste_aulas_mes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ajuste_mes_ref   DATE    DEFAULT NULL;

-- Ajustes de maio/2026 para professores da plataforma antiga
UPDATE public.professores_info SET ajuste_aulas_mes = 5, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'wilgner.santos@ufpe.br');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'teomoraes13@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'thaise.j.araujo@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'proflucaslvguimaraes@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 3, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'phablocarneirofarm@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 2, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'laelpcss@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'tiellybalima@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1, ajuste_mes_ref = '2026-05-01'
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'rayssasantana24@yahoo.com');
