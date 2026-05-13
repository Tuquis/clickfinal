-- ============================================================
-- MIGRAÇÃO: novos campos no relatório de aula (v2)
-- Execute no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS meta_atingida          TEXT
      CHECK (meta_atingida IN ('sim','parcialmente','nao')),

  ADD COLUMN IF NOT EXISTS retomar_conteudo        BOOLEAN,
  -- preenchido apenas quando meta_atingida = 'parcialmente' ou 'nao'

  ADD COLUMN IF NOT EXISTS interatividade          TEXT
      CHECK (interatividade IN ('perguntas','passivo','solicitado')),

  ADD COLUMN IF NOT EXISTS ferramentas             TEXT[],
  -- ex: ['material_proprio','exercicios_extras','recursos_digitais','jogos_pedagogicos']

  ADD COLUMN IF NOT EXISTS observacoes             TEXT,
  -- campo livre além das recomendações para casa

  ADD COLUMN IF NOT EXISTS camera_objecao          BOOLEAN,
  -- true = aluno teve objeção em ficar com câmera ligada

  ADD COLUMN IF NOT EXISTS camera_objecao_detalhe  TEXT;
  -- preenchido apenas quando camera_objecao = true
