-- ============================================================
-- MIGRATION: atividade enviada pelo professor cai automaticamente
-- no cronograma do aluno (visível para o admin, com professor e prazo).
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- Rastreabilidade: de qual atividade/professor/prazo veio a tarefa do cronograma
ALTER TABLE public.cronograma_tarefas
    ADD COLUMN IF NOT EXISTS atividade_id  UUID REFERENCES public.atividades(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS professor_id  UUID REFERENCES public.usuarios(id)   ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS prazo         DATE;

CREATE INDEX IF NOT EXISTS idx_cronograma_tarefas_atividade
    ON public.cronograma_tarefas(atividade_id);

-- Ao criar uma atividade, joga automaticamente no cronograma semanal do aluno
-- (cria o cronograma da semana se ainda não existir). SECURITY DEFINER porque
-- a policy de INSERT em cronograma/cronograma_tarefas só libera para admin,
-- e aqui quem está inserindo é o professor.
CREATE OR REPLACE FUNCTION public.fn_atividade_to_cronograma()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cronograma_id UUID;
    v_semana_fim    DATE;
    v_dia_semana    INTEGER;
BEGIN
    -- Slides para fixação não entram no mural do cronograma, ficam só na tela Atividades
    IF NEW.tipo_material = 'slide' THEN
        RETURN NEW;
    END IF;

    -- "Semana" do cronograma = prazo da atividade; sem prazo, usa a próxima sexta-feira
    v_semana_fim := COALESCE(
        NEW.prazo,
        (CURRENT_DATE + ((5 - EXTRACT(DOW FROM CURRENT_DATE)::INT + 7) % 7 || ' days')::INTERVAL)::DATE
    );
    v_dia_semana := CASE WHEN NEW.prazo IS NOT NULL THEN EXTRACT(DOW FROM NEW.prazo)::INT END;

    SELECT id INTO v_cronograma_id
    FROM public.cronograma
    WHERE aluno_id      = NEW.aluno_id
      AND titulo        = 'Atividades enviadas pelos professores'
      AND semana_inicio = v_semana_fim
    LIMIT 1;

    IF v_cronograma_id IS NULL THEN
        INSERT INTO public.cronograma (aluno_id, admin_id, semana_inicio, titulo, descricao)
        VALUES (NEW.aluno_id, NULL, v_semana_fim, 'Atividades enviadas pelos professores', NULL)
        RETURNING id INTO v_cronograma_id;
    END IF;

    INSERT INTO public.cronograma_tarefas
        (cronograma_id, descricao, informacoes, dia_semana, status, atividade_id, professor_id, prazo)
    VALUES
        (v_cronograma_id, NEW.titulo, NEW.descricao, v_dia_semana, 'pendente', NEW.id, NEW.professor_id, NEW.prazo);

    INSERT INTO public.audit_log (acao, usuario_id, tabela, registro_id, dados_novos)
    VALUES (
        'ATIVIDADE_ADICIONADA_CRONOGRAMA',
        NEW.professor_id,
        'cronograma_tarefas',
        v_cronograma_id,
        jsonb_build_object('atividade_id', NEW.id, 'aluno_id', NEW.aluno_id, 'prazo', NEW.prazo)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividade_to_cronograma ON public.atividades;
CREATE TRIGGER trg_atividade_to_cronograma
    AFTER INSERT ON public.atividades
    FOR EACH ROW EXECUTE FUNCTION public.fn_atividade_to_cronograma();
