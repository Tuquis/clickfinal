-- ============================================================
-- ENSINOCLICK — TRIGGERS E FUNÇÕES
-- Execute APÓS schema.sql
-- ============================================================

-- ============================================================
-- FUNÇÃO GENÉRICA: atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger updated_at em todas as tabelas relevantes
CREATE OR REPLACE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_alunos_info_updated_at
    BEFORE UPDATE ON public.alunos_info
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_professores_info_updated_at
    BEFORE UPDATE ON public.professores_info
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_agenda_updated_at
    BEFORE UPDATE ON public.agenda_meet
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_relatorios_updated_at
    BEFORE UPDATE ON public.relatorios
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_cronograma_updated_at
    BEFORE UPDATE ON public.cronograma
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_cronograma_tarefas_updated_at
    BEFORE UPDATE ON public.cronograma_tarefas
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_financeiro_updated_at
    BEFORE UPDATE ON public.financeiro
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE TRIGGER trg_observacoes_updated_at
    BEFORE UPDATE ON public.observacoes_psico
    FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

-- ============================================================
-- FUNÇÃO: Ao salvar relatório → atualizar agenda, saldos e audit
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_after_relatorio_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_aluno_info_id UUID;
    v_professor_info_id UUID;
BEGIN
    -- 1. Marcar aula como realizada
    UPDATE public.agenda_meet
    SET status = 'realizada', updated_at = NOW()
    WHERE id = NEW.agenda_id;

    -- 2. Decrementar aulas_disponiveis do aluno (não vai abaixo de 0)
    UPDATE public.alunos_info
    SET aulas_disponiveis = GREATEST(0, aulas_disponiveis - 1),
        updated_at = NOW()
    WHERE usuario_id = NEW.aluno_id
    RETURNING id INTO v_aluno_info_id;

    -- 3. Incrementar saldo_aulas_dadas do professor
    UPDATE public.professores_info
    SET saldo_aulas_dadas = saldo_aulas_dadas + 1,
        updated_at = NOW()
    WHERE usuario_id = NEW.professor_id
    RETURNING id INTO v_professor_info_id;

    -- Se professor_info não existe ainda, criar
    IF v_professor_info_id IS NULL THEN
        INSERT INTO public.professores_info (usuario_id, saldo_aulas_dadas)
        VALUES (NEW.professor_id, 1);
    END IF;

    -- 4. Registrar no audit_log
    INSERT INTO public.audit_log (
        acao, usuario_id, tabela, registro_id, dados_novos
    ) VALUES (
        'RELATORIO_CRIADO',
        NEW.professor_id,
        'relatorios',
        NEW.id,
        jsonb_build_object(
            'agenda_id', NEW.agenda_id,
            'aluno_id', NEW.aluno_id,
            'professor_id', NEW.professor_id,
            'comportamento', NEW.comportamento,
            'compreensao', NEW.compreensao,
            'timestamp', NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_after_relatorio_insert
    AFTER INSERT ON public.relatorios
    FOR EACH ROW EXECUTE FUNCTION public.fn_after_relatorio_insert();

-- ============================================================
-- FUNÇÃO: Financeiro — atualizar status automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_financeiro_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Se marcado como pago
    IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
        NEW.pago_em = NOW();
    END IF;

    -- Se vencido e ainda pendente (verificação no INSERT e UPDATE)
    IF NEW.status = 'pendente' AND NEW.vencimento < CURRENT_DATE THEN
        NEW.status = 'atrasado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_financeiro_status
    BEFORE INSERT OR UPDATE ON public.financeiro
    FOR EACH ROW EXECUTE FUNCTION public.fn_financeiro_status();

-- ============================================================
-- FUNÇÃO: Tarefa concluída → registrar timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_tarefa_concluida()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status != 'concluida') THEN
        NEW.concluida_em = NOW();
    ELSIF NEW.status = 'pendente' THEN
        NEW.concluida_em = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_tarefa_concluida
    BEFORE INSERT OR UPDATE ON public.cronograma_tarefas
    FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_concluida();

-- ============================================================
-- FUNÇÃO: Audit log genérico para agenda_meet
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_agenda()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (acao, tabela, registro_id, dados_novos)
        VALUES ('AULA_AGENDADA', 'agenda_meet', NEW.id,
            jsonb_build_object(
                'aluno_id', NEW.aluno_id,
                'professor_id', NEW.professor_id,
                'data', NEW.data,
                'horario', NEW.horario,
                'status', NEW.status
            ));
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO public.audit_log (acao, tabela, registro_id, dados_anteriores, dados_novos)
        VALUES ('AULA_STATUS_ALTERADO', 'agenda_meet', NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_audit_agenda
    AFTER INSERT OR UPDATE ON public.agenda_meet
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_agenda();

-- ============================================================
-- FUNÇÃO: Job periódico — atualizar financeiros vencidos
-- Chame via cron ou manualmente: SELECT public.fn_atualizar_financeiros_vencidos();
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_atualizar_financeiros_vencidos()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.financeiro
    SET status = 'atrasado', updated_at = NOW()
    WHERE status = 'pendente'
      AND vencimento < CURRENT_DATE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
