-- ============================================================
-- CLICK DO SABER — SQL COMPLETO E FINAL
-- Schema base + triggers + RLS + views + todas as alterações.
-- Execute do início ao fim no SQL Editor do Supabase.
-- Gerado em: 2026-06-18
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. EXTENSÕES
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ══════════════════════════════════════════════════════════════
-- 2. FUNÇÕES UTILITÁRIAS (necessárias antes das políticas RLS)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ══════════════════════════════════════════════════════════════
-- 3. TABELAS BASE (estado final com todas as colunas)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.usuarios (
    id         UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id    UUID     UNIQUE,
    nome       TEXT     NOT NULL,
    email      TEXT     UNIQUE NOT NULL,
    role       TEXT     NOT NULL CHECK (role IN ('admin','professor','aluno','psicopedagoga')),
    ativo      BOOLEAN  DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alunos_info (
    id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id       UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    serie            TEXT    NOT NULL,
    disciplina       TEXT    NOT NULL,
    responsavel      TEXT    NOT NULL,
    telefone         TEXT    NOT NULL,
    aulas_disponiveis INTEGER NOT NULL DEFAULT 0 CHECK (aulas_disponiveis >= 0),
    telefone_aluno   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.professores_info (
    id                    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id            UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    saldo_aulas_dadas     INTEGER NOT NULL DEFAULT 0,
    saldo_aulas_sem_aluno INTEGER NOT NULL DEFAULT 0,
    materia               TEXT,
    chave_pix             TEXT,
    link_meet             TEXT,
    ajuste_aulas_mes      INTEGER NOT NULL DEFAULT 0,
    ajuste_mes_ref        DATE    DEFAULT NULL,
    telefone              TEXT,
    lembrete_manha_data   DATE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.disponibilidade (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professor_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    dia_semana      INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    horario_inicio  TIME NOT NULL,
    horario_fim     TIME NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT horario_valido CHECK (horario_fim > horario_inicio)
);

CREATE TABLE IF NOT EXISTS public.agenda_meet (
    id                               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id                         UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    professor_id                     UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data                             DATE    NOT NULL,
    horario                          TIME    NOT NULL,
    conteudo                         TEXT    NOT NULL,
    link_meet                        TEXT,
    status                           TEXT    NOT NULL DEFAULT 'agendada'
        CHECK (status IN ('agendada','realizada','cancelada')),
    created_by                       UUID    REFERENCES public.usuarios(id) ON DELETE SET NULL,
    lembrete_enviado                 BOOLEAN NOT NULL DEFAULT false,
    lembrete_whatsapp_enviado        BOOLEAN NOT NULL DEFAULT false,
    lembrete_whatsapp_10min_enviado  BOOLEAN NOT NULL DEFAULT false,
    lembrete_whatsapp_prof_enviado   BOOLEAN NOT NULL DEFAULT false,
    created_at                       TIMESTAMPTZ DEFAULT NOW(),
    updated_at                       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT data_futura CHECK (data >= CURRENT_DATE)
);

CREATE TABLE IF NOT EXISTS public.relatorios (
    id                      UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    agenda_id               UUID  REFERENCES public.agenda_meet(id) ON DELETE SET NULL,
    professor_id            UUID  NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id                UUID  NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo_ministrado     TEXT  NOT NULL,
    comportamento           TEXT  NOT NULL CHECK (comportamento IN ('excelente','bom','regular','ruim')),
    compreensao             TEXT  NOT NULL CHECK (compreensao IN ('excelente','boa','regular','baixa')),
    recomendacoes           TEXT,
    habilidades             JSONB DEFAULT '[]'::jsonb,
    sem_aluno               BOOLEAN NOT NULL DEFAULT false,
    meta_atingida           TEXT  CHECK (meta_atingida IN ('sim','parcialmente','nao')),
    retomar_conteudo        BOOLEAN,
    interatividade          TEXT  CHECK (interatividade IN ('perguntas','passivo','solicitado')),
    ferramentas             TEXT[],
    observacoes             TEXT,
    camera_objecao          BOOLEAN,
    camera_objecao_detalhe  TEXT,
    disciplina_ministrada   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cronograma (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id     UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    admin_id     UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    semana_inicio DATE NOT NULL,
    titulo       TEXT NOT NULL,
    descricao    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cronograma_tarefas (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cronograma_id UUID NOT NULL REFERENCES public.cronograma(id) ON DELETE CASCADE,
    descricao     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida')),
    dia_semana    INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    informacoes   TEXT,
    evidencia_url TEXT,
    concluida_em  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.atividades (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id     UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo       TEXT NOT NULL,
    descricao    TEXT,
    arquivo_url  TEXT,
    prazo        DATE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financeiro (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id        UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    descricao       TEXT    NOT NULL,
    valor           NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    vencimento      DATE    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente','pago','atrasado')),
    pago_em         TIMESTAMPTZ,
    recorrente      BOOLEAN DEFAULT false,
    dia_vencimento  INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
    created_by      UUID    REFERENCES public.usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.observacoes_psico (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psico_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo   TEXT NOT NULL,
    categoria  TEXT DEFAULT 'geral'
        CHECK (categoria IN ('geral','comportamental','cognitivo','emocional','social')),
    data       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    acao             TEXT NOT NULL,
    usuario_id       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tabela           TEXT NOT NULL,
    registro_id      UUID,
    dados_anteriores JSONB,
    dados_novos      JSONB,
    ip_address       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════
-- 4. TABELAS ADICIONADAS VIA MIGRATION
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mensagens (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    agenda_id    UUID        NOT NULL REFERENCES public.agenda_meet(id) ON DELETE CASCADE,
    remetente_id UUID        NOT NULL REFERENCES public.usuarios(id),
    conteudo     TEXT        NOT NULL DEFAULT '',
    lida         BOOLEAN     NOT NULL DEFAULT false,
    anexo_url    TEXT,
    anexo_nome   TEXT,
    anexo_tipo   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mensagens_conteudo_check
        CHECK (
            char_length(conteudo) <= 2000
            AND (char_length(conteudo) > 0 OR anexo_url IS NOT NULL)
        )
);

CREATE TABLE IF NOT EXISTS public.respostas_atividades (
    id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    atividade_id UUID    NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
    aluno_id     UUID    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    arquivo_url  TEXT    NOT NULL,
    arquivo_nome TEXT,
    visualizado  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(atividade_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS public.agenda_psico (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    psico_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data        DATE NOT NULL,
    horario     TIME NOT NULL,
    observacoes TEXT,
    link_meet   TEXT,
    status      TEXT NOT NULL DEFAULT 'agendada'
        CHECK (status IN ('agendada','realizada','cancelada')),
    created_by  UUID REFERENCES public.usuarios(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.psico_info (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    link_meet  TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id)
);

CREATE TABLE IF NOT EXISTS public.consultas_psico (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psico_id              UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id              UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data                  DATE NOT NULL DEFAULT CURRENT_DATE,
    areas_trabalhadas     TEXT[],
    humor_aluno           TEXT CHECK (humor_aluno IN ('tranquilo','agitado','ansioso','triste','motivado')),
    engajamento           TEXT CHECK (engajamento IN ('alto','medio','baixo')),
    observacoes           TEXT NOT NULL,
    estrategias           TEXT,
    recomendacoes_familia TEXT,
    encaminhamentos       TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════
-- 5. FUNÇÕES DE TRIGGER E TRIGGERS
-- ══════════════════════════════════════════════════════════════

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.fn_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Ao salvar relatório: marca aula como realizada, decrementa aluno, incrementa professor
CREATE OR REPLACE FUNCTION public.fn_after_relatorio_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_aluno_info_id     UUID;
    v_professor_info_id UUID;
BEGIN
    UPDATE public.agenda_meet
    SET status = 'realizada', updated_at = NOW()
    WHERE id = NEW.agenda_id;

    UPDATE public.alunos_info
    SET aulas_disponiveis = GREATEST(0, aulas_disponiveis - 1),
        updated_at = NOW()
    WHERE usuario_id = NEW.aluno_id
    RETURNING id INTO v_aluno_info_id;

    UPDATE public.professores_info
    SET saldo_aulas_dadas = saldo_aulas_dadas + 1,
        updated_at = NOW()
    WHERE usuario_id = NEW.professor_id
    RETURNING id INTO v_professor_info_id;

    IF v_professor_info_id IS NULL THEN
        INSERT INTO public.professores_info (usuario_id, saldo_aulas_dadas)
        VALUES (NEW.professor_id, 1);
    END IF;

    INSERT INTO public.audit_log (acao, usuario_id, tabela, registro_id, dados_novos)
    VALUES (
        'RELATORIO_CRIADO',
        NEW.professor_id,
        'relatorios',
        NEW.id,
        jsonb_build_object(
            'agenda_id',    NEW.agenda_id,
            'aluno_id',     NEW.aluno_id,
            'professor_id', NEW.professor_id,
            'comportamento', NEW.comportamento,
            'compreensao',  NEW.compreensao,
            'timestamp',    NOW()
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_after_relatorio_insert
    AFTER INSERT ON public.relatorios
    FOR EACH ROW EXECUTE FUNCTION public.fn_after_relatorio_insert();

-- Financeiro: marca pago_em e detecta vencidos automaticamente
CREATE OR REPLACE FUNCTION public.fn_financeiro_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
        NEW.pago_em = NOW();
    END IF;
    IF NEW.status = 'pendente' AND NEW.vencimento < CURRENT_DATE THEN
        NEW.status = 'atrasado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_financeiro_status
    BEFORE INSERT OR UPDATE ON public.financeiro
    FOR EACH ROW EXECUTE FUNCTION public.fn_financeiro_status();

-- Tarefa concluída: registra timestamp
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

-- Audit log da agenda
CREATE OR REPLACE FUNCTION public.fn_audit_agenda()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (acao, tabela, registro_id, dados_novos)
        VALUES ('AULA_AGENDADA', 'agenda_meet', NEW.id,
            jsonb_build_object(
                'aluno_id',     NEW.aluno_id,
                'professor_id', NEW.professor_id,
                'data',         NEW.data,
                'horario',      NEW.horario,
                'status',       NEW.status
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

-- Job manual/periódico: marca financeiros vencidos como atrasados
CREATE OR REPLACE FUNCTION public.fn_atualizar_financeiros_vencidos()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE public.financeiro
    SET status = 'atrasado', updated_at = NOW()
    WHERE status = 'pendente' AND vencimento < CURRENT_DATE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY — ATIVAR EM TODAS AS TABELAS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_info        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores_info   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_meet        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observacoes_psico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_psico       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psico_info         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_psico    ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════
-- 7. POLÍTICAS RLS (versões finais corrigidas)
-- ══════════════════════════════════════════════════════════════

-- usuarios
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR id = public.get_user_id()
        OR public.get_user_role() IN ('professor','psicopedagoga')
    );
CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE
    USING (public.get_user_role() = 'admin' OR id = public.get_user_id());
CREATE POLICY "usuarios_delete" ON public.usuarios FOR DELETE
    USING (public.get_user_role() = 'admin');

-- alunos_info
DROP POLICY IF EXISTS "alunos_info_select" ON public.alunos_info;
DROP POLICY IF EXISTS "alunos_info_insert" ON public.alunos_info;
DROP POLICY IF EXISTS "alunos_info_update" ON public.alunos_info;
DROP POLICY IF EXISTS "alunos_info_delete" ON public.alunos_info;

CREATE POLICY "alunos_info_select" ON public.alunos_info FOR SELECT
    USING (
        public.get_user_role() IN ('admin','professor','psicopedagoga')
        OR usuario_id = public.get_user_id()
    );
CREATE POLICY "alunos_info_insert" ON public.alunos_info FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "alunos_info_update" ON public.alunos_info FOR UPDATE
    USING (public.get_user_role() = 'admin');
CREATE POLICY "alunos_info_delete" ON public.alunos_info FOR DELETE
    USING (public.get_user_role() = 'admin');

-- professores_info (professor pode ver e editar a própria linha)
DROP POLICY IF EXISTS "professores_info_select" ON public.professores_info;
DROP POLICY IF EXISTS "professores_info_insert" ON public.professores_info;
DROP POLICY IF EXISTS "professores_info_update" ON public.professores_info;

CREATE POLICY "professores_info_select" ON public.professores_info FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );
CREATE POLICY "professores_info_insert" ON public.professores_info FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "professores_info_update" ON public.professores_info FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    )
    WITH CHECK (
        public.get_user_role() = 'admin'
        OR usuario_id = public.get_user_id()
    );

-- disponibilidade
DROP POLICY IF EXISTS "disponibilidade_select" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_insert" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_update" ON public.disponibilidade;
DROP POLICY IF EXISTS "disponibilidade_delete" ON public.disponibilidade;

CREATE POLICY "disponibilidade_select" ON public.disponibilidade FOR SELECT
    USING (
        public.get_user_role() IN ('admin','psicopedagoga')
        OR professor_id = public.get_user_id()
    );
CREATE POLICY "disponibilidade_insert" ON public.disponibilidade FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );
CREATE POLICY "disponibilidade_update" ON public.disponibilidade FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );
CREATE POLICY "disponibilidade_delete" ON public.disponibilidade FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- agenda_meet
DROP POLICY IF EXISTS "agenda_select" ON public.agenda_meet;
DROP POLICY IF EXISTS "agenda_insert" ON public.agenda_meet;
DROP POLICY IF EXISTS "agenda_update" ON public.agenda_meet;
DROP POLICY IF EXISTS "agenda_delete" ON public.agenda_meet;

CREATE POLICY "agenda_select" ON public.agenda_meet FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
        OR aluno_id     = public.get_user_id()
        OR public.get_user_role() = 'psicopedagoga'
    );
CREATE POLICY "agenda_insert" ON public.agenda_meet FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "agenda_update" ON public.agenda_meet FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
    );
CREATE POLICY "agenda_delete" ON public.agenda_meet FOR DELETE
    USING (public.get_user_role() = 'admin');

-- relatorios
DROP POLICY IF EXISTS "relatorios_select" ON public.relatorios;
DROP POLICY IF EXISTS "relatorios_insert" ON public.relatorios;
DROP POLICY IF EXISTS "relatorios_update" ON public.relatorios;

CREATE POLICY "relatorios_select" ON public.relatorios FOR SELECT
    USING (
        public.get_user_role() IN ('admin','psicopedagoga')
        OR professor_id = public.get_user_id()
        OR aluno_id     = public.get_user_id()
    );
CREATE POLICY "relatorios_insert" ON public.relatorios FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'professor'
        AND professor_id = public.get_user_id()
    );
CREATE POLICY "relatorios_update" ON public.relatorios FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- cronograma
DROP POLICY IF EXISTS "cronograma_select" ON public.cronograma;
DROP POLICY IF EXISTS "cronograma_insert" ON public.cronograma;
DROP POLICY IF EXISTS "cronograma_update" ON public.cronograma;
DROP POLICY IF EXISTS "cronograma_delete" ON public.cronograma;

CREATE POLICY "cronograma_select" ON public.cronograma FOR SELECT
    USING (
        public.get_user_role() IN ('admin','professor','psicopedagoga')
        OR aluno_id = public.get_user_id()
    );
CREATE POLICY "cronograma_insert" ON public.cronograma FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "cronograma_update" ON public.cronograma FOR UPDATE
    USING (public.get_user_role() = 'admin');
CREATE POLICY "cronograma_delete" ON public.cronograma FOR DELETE
    USING (public.get_user_role() = 'admin');

-- cronograma_tarefas
DROP POLICY IF EXISTS "tarefas_select" ON public.cronograma_tarefas;
DROP POLICY IF EXISTS "tarefas_insert" ON public.cronograma_tarefas;
DROP POLICY IF EXISTS "tarefas_update" ON public.cronograma_tarefas;

CREATE POLICY "tarefas_select" ON public.cronograma_tarefas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cronograma c
            WHERE c.id = cronograma_id
              AND (
                  public.get_user_role() IN ('admin','professor','psicopedagoga')
                  OR c.aluno_id = public.get_user_id()
              )
        )
    );
CREATE POLICY "tarefas_insert" ON public.cronograma_tarefas FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "tarefas_update" ON public.cronograma_tarefas FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.cronograma c
            WHERE c.id = cronograma_id AND c.aluno_id = public.get_user_id()
        )
    );

-- atividades
DROP POLICY IF EXISTS "atividades_select" ON public.atividades;
DROP POLICY IF EXISTS "atividades_insert" ON public.atividades;
DROP POLICY IF EXISTS "atividades_update" ON public.atividades;
DROP POLICY IF EXISTS "atividades_delete" ON public.atividades;

CREATE POLICY "atividades_select" ON public.atividades FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR professor_id = public.get_user_id()
        OR aluno_id     = public.get_user_id()
    );
CREATE POLICY "atividades_insert" ON public.atividades FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'professor'
        AND professor_id = public.get_user_id()
    );
CREATE POLICY "atividades_update" ON public.atividades FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );
CREATE POLICY "atividades_delete" ON public.atividades FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'professor' AND professor_id = public.get_user_id())
    );

-- financeiro
DROP POLICY IF EXISTS "financeiro_select" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_insert" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_update" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_delete" ON public.financeiro;

CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT
    USING (public.get_user_role() = 'admin' OR aluno_id = public.get_user_id());
CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT
    WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE
    USING (public.get_user_role() = 'admin');
CREATE POLICY "financeiro_delete" ON public.financeiro FOR DELETE
    USING (public.get_user_role() = 'admin');

-- observacoes_psico
DROP POLICY IF EXISTS "observacoes_select" ON public.observacoes_psico;
DROP POLICY IF EXISTS "observacoes_insert" ON public.observacoes_psico;
DROP POLICY IF EXISTS "observacoes_update" ON public.observacoes_psico;
DROP POLICY IF EXISTS "observacoes_delete" ON public.observacoes_psico;

CREATE POLICY "observacoes_select" ON public.observacoes_psico FOR SELECT
    USING (public.get_user_role() IN ('admin','psicopedagoga','professor'));
CREATE POLICY "observacoes_insert" ON public.observacoes_psico FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'psicopedagoga'
        AND psico_id = public.get_user_id()
    );
CREATE POLICY "observacoes_update" ON public.observacoes_psico FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'psicopedagoga' AND psico_id = public.get_user_id())
    );
CREATE POLICY "observacoes_delete" ON public.observacoes_psico FOR DELETE
    USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'psicopedagoga' AND psico_id = public.get_user_id())
    );

-- audit_log
DROP POLICY IF EXISTS "audit_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;

CREATE POLICY "audit_select" ON public.audit_log FOR SELECT
    USING (public.get_user_role() = 'admin');
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT
    WITH CHECK (true);

-- mensagens
DROP POLICY IF EXISTS "mensagens_select"      ON public.mensagens;
DROP POLICY IF EXISTS "mensagens_insert"      ON public.mensagens;
DROP POLICY IF EXISTS "mensagens_update_lida" ON public.mensagens;

CREATE POLICY "mensagens_select" ON public.mensagens FOR SELECT
    USING (
        public.get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.agenda_meet am
            WHERE am.id = mensagens.agenda_id
              AND (am.professor_id = public.get_user_id()
                OR am.aluno_id    = public.get_user_id())
        )
    );
CREATE POLICY "mensagens_insert" ON public.mensagens FOR INSERT
    WITH CHECK (
        remetente_id = public.get_user_id()
        AND (
            public.get_user_role() = 'admin'
            OR EXISTS (
                SELECT 1 FROM public.agenda_meet am
                WHERE am.id = mensagens.agenda_id
                  AND (am.professor_id = public.get_user_id()
                    OR am.aluno_id    = public.get_user_id())
            )
        )
    );
CREATE POLICY "mensagens_update_lida" ON public.mensagens FOR UPDATE
    USING (
        public.get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.agenda_meet am
            WHERE am.id = mensagens.agenda_id
              AND (am.professor_id = public.get_user_id()
                OR am.aluno_id    = public.get_user_id())
        )
    );

-- respostas_atividades
DROP POLICY IF EXISTS "respostas_admin_all"        ON public.respostas_atividades;
DROP POLICY IF EXISTS "respostas_aluno_own"        ON public.respostas_atividades;
DROP POLICY IF EXISTS "respostas_professor_select" ON public.respostas_atividades;
DROP POLICY IF EXISTS "respostas_professor_update" ON public.respostas_atividades;

CREATE POLICY "respostas_admin_all" ON public.respostas_atividades
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );
CREATE POLICY "respostas_aluno_own" ON public.respostas_atividades
    FOR ALL USING (
        aluno_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
CREATE POLICY "respostas_professor_select" ON public.respostas_atividades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.atividades a
            WHERE a.id = atividade_id
              AND a.professor_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
        )
    );
CREATE POLICY "respostas_professor_update" ON public.respostas_atividades
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.atividades a
            WHERE a.id = atividade_id
              AND a.professor_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
        )
    );

-- agenda_psico
DROP POLICY IF EXISTS "agenda_psico_admin_all"    ON public.agenda_psico;
DROP POLICY IF EXISTS "agenda_psico_psico_own"    ON public.agenda_psico;
DROP POLICY IF EXISTS "agenda_psico_aluno_select" ON public.agenda_psico;

CREATE POLICY "agenda_psico_admin_all" ON public.agenda_psico
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );
CREATE POLICY "agenda_psico_psico_own" ON public.agenda_psico
    FOR ALL USING (
        psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
CREATE POLICY "agenda_psico_aluno_select" ON public.agenda_psico
    FOR SELECT USING (
        aluno_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

-- psico_info
DROP POLICY IF EXISTS "psico_info_admin_all"  ON public.psico_info;
DROP POLICY IF EXISTS "psico_info_own_select" ON public.psico_info;
DROP POLICY IF EXISTS "psico_info_own_update" ON public.psico_info;

CREATE POLICY "psico_info_admin_all" ON public.psico_info
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
    );
CREATE POLICY "psico_info_own_select" ON public.psico_info
    FOR SELECT USING (
        usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
CREATE POLICY "psico_info_own_update" ON public.psico_info
    FOR UPDATE USING (
        usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );

-- consultas_psico
DROP POLICY IF EXISTS "psico_consulta_select" ON public.consultas_psico;
DROP POLICY IF EXISTS "psico_consulta_insert" ON public.consultas_psico;
DROP POLICY IF EXISTS "psico_consulta_update" ON public.consultas_psico;
DROP POLICY IF EXISTS "psico_consulta_delete" ON public.consultas_psico;

CREATE POLICY "psico_consulta_select" ON public.consultas_psico
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.usuarios u
                WHERE u.auth_id = auth.uid() AND u.role IN ('admin','psicopedagoga'))
    );
CREATE POLICY "psico_consulta_insert" ON public.consultas_psico
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.usuarios u
                WHERE u.auth_id = auth.uid() AND u.role = 'psicopedagoga')
    );
CREATE POLICY "psico_consulta_update" ON public.consultas_psico
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.usuarios u
                WHERE u.auth_id = auth.uid() AND u.role = 'psicopedagoga')
        AND psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );
CREATE POLICY "psico_consulta_delete" ON public.consultas_psico
    FOR DELETE USING (
        psico_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid())
    );


-- ══════════════════════════════════════════════════════════════
-- 8. VIEWS — versões finais
-- ══════════════════════════════════════════════════════════════

-- Dashboard stats (admin)
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM public.usuarios
        WHERE role = 'aluno' AND ativo = true)                          AS total_alunos,
    (SELECT COUNT(*) FROM public.usuarios
        WHERE role = 'professor' AND ativo = true)                      AS total_professores,
    (SELECT COUNT(*) FROM public.agenda_meet
        WHERE data = CURRENT_DATE AND status = 'agendada')              AS aulas_hoje,
    (SELECT COALESCE(SUM(valor), 0) FROM public.financeiro
        WHERE status = 'pago'
          AND DATE_TRUNC('month', pago_em) = DATE_TRUNC('month', NOW())) AS receita_mes,
    (SELECT COUNT(*) FROM public.cronograma_tarefas
        WHERE status = 'concluida'
          AND DATE_TRUNC('week', concluida_em) = DATE_TRUNC('week', NOW())) AS tarefas_concluidas_semana,
    (SELECT COUNT(*) FROM public.financeiro
        WHERE status = 'atrasado')                                       AS cobrancas_atrasadas,
    (SELECT COUNT(*) FROM public.relatorios
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS relatorios_mes;

-- Alunos com informações completas
CREATE OR REPLACE VIEW public.v_alunos_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    ai.serie,
    ai.disciplina,
    ai.responsavel,
    ai.telefone,
    ai.aulas_disponiveis,
    ai.telefone_aluno
FROM public.usuarios u
LEFT JOIN public.alunos_info ai ON ai.usuario_id = u.id
WHERE u.role = 'aluno';

GRANT SELECT ON public.v_alunos_completo TO authenticated, anon;

-- Professores com saldo calculado diretamente de relatórios
CREATE OR REPLACE VIEW public.v_professores_completo AS
SELECT
    u.id,
    u.nome,
    u.email,
    u.ativo,
    u.created_at,
    COALESCE(pi.materia,   '') AS materia,
    COALESCE(pi.chave_pix, '') AS chave_pix,
    COALESCE(pi.link_meet, '') AS link_meet,
    (SELECT COUNT(*) FROM public.relatorios r WHERE r.professor_id = u.id) AS saldo_aulas_dadas
FROM public.usuarios u
LEFT JOIN public.professores_info pi ON pi.usuario_id = u.id
WHERE u.role = 'professor';

GRANT SELECT ON public.v_professores_completo TO authenticated, anon;

-- Agenda com nomes e flags de lembrete
CREATE OR REPLACE VIEW public.v_agenda_completa AS
SELECT
    a.id,
    a.data,
    a.horario,
    a.conteudo,
    a.link_meet,
    a.status,
    a.created_at,
    al.nome AS aluno_nome,
    al.id   AS aluno_id,
    pr.nome AS professor_nome,
    pr.id   AS professor_id,
    ai.serie,
    ai.disciplina,
    r.id    AS relatorio_id,
    a.lembrete_enviado,
    a.lembrete_whatsapp_enviado
FROM public.agenda_meet a
JOIN public.usuarios al ON al.id = a.aluno_id
JOIN public.usuarios pr ON pr.id = a.professor_id
LEFT JOIN public.alunos_info ai ON ai.usuario_id = a.aluno_id
LEFT JOIN public.relatorios   r  ON r.agenda_id  = a.id;

GRANT SELECT ON public.v_agenda_completa TO authenticated, anon;

-- Financeiro com nome do aluno + campos de recorrência
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

GRANT SELECT ON public.v_financeiro_completo TO authenticated, anon;


-- ══════════════════════════════════════════════════════════════
-- 9. FUNÇÕES AUXILIARES
-- ══════════════════════════════════════════════════════════════

-- Contagem de relatórios com SECURITY DEFINER (bypassa RLS)
CREATE OR REPLACE FUNCTION public.count_relatorios_professor(prof_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.relatorios WHERE professor_id = prof_id;
$$;


-- ══════════════════════════════════════════════════════════════
-- 10. ÍNDICES DE PERFORMANCE
-- ══════════════════════════════════════════════════════════════

-- Tabelas base
CREATE INDEX IF NOT EXISTS idx_alunos_info_usuario        ON public.alunos_info(usuario_id);
CREATE INDEX IF NOT EXISTS idx_professores_info_usuario   ON public.professores_info(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agenda_aluno               ON public.agenda_meet(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_professor           ON public.agenda_meet(professor_id);
CREATE INDEX IF NOT EXISTS idx_agenda_data                ON public.agenda_meet(data);
CREATE INDEX IF NOT EXISTS idx_relatorios_agenda          ON public.relatorios(agenda_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_aluno           ON public.relatorios(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_aluno           ON public.cronograma(aluno_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_aluno           ON public.financeiro(aluno_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_status          ON public.financeiro(status);
CREATE INDEX IF NOT EXISTS idx_observacoes_aluno          ON public.observacoes_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario              ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela               ON public.audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_professor  ON public.disponibilidade(professor_id);

-- Lembretes WhatsApp / e-mail
CREATE INDEX IF NOT EXISTS idx_agenda_lembrete
    ON public.agenda_meet(data, status, lembrete_enviado, horario);
CREATE INDEX IF NOT EXISTS idx_agenda_lembrete_whatsapp
    ON public.agenda_meet(data, status, lembrete_whatsapp_enviado, horario);
CREATE INDEX IF NOT EXISTS idx_agenda_lembrete_whatsapp_10min
    ON public.agenda_meet(data, status, lembrete_whatsapp_10min_enviado, horario);
CREATE INDEX IF NOT EXISTS idx_agenda_lembrete_whatsapp_prof
    ON public.agenda_meet(data, status, lembrete_whatsapp_prof_enviado, horario);

-- Financeiro recorrente
CREATE INDEX IF NOT EXISTS idx_financeiro_recorrente
    ON public.financeiro(recorrente) WHERE recorrente = true;

-- Chat
CREATE INDEX IF NOT EXISTS idx_mensagens_agenda
    ON public.mensagens(agenda_id, created_at);

-- Respostas
CREATE INDEX IF NOT EXISTS idx_respostas_atividade
    ON public.respostas_atividades(atividade_id);
CREATE INDEX IF NOT EXISTS idx_respostas_aluno
    ON public.respostas_atividades(aluno_id);
CREATE INDEX IF NOT EXISTS idx_respostas_visualizado
    ON public.respostas_atividades(visualizado);

-- Psico
CREATE INDEX IF NOT EXISTS idx_agenda_psico_aluno  ON public.agenda_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_psico_psico  ON public.agenda_psico(psico_id);
CREATE INDEX IF NOT EXISTS idx_agenda_psico_data   ON public.agenda_psico(data);
CREATE INDEX IF NOT EXISTS idx_psico_info_usuario  ON public.psico_info(usuario_id);
CREATE INDEX IF NOT EXISTS idx_consultas_psico_aluno ON public.consultas_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_consultas_psico_psico ON public.consultas_psico(psico_id);
CREATE INDEX IF NOT EXISTS idx_consultas_psico_data  ON public.consultas_psico(data DESC);


-- ══════════════════════════════════════════════════════════════
-- 11. STORAGE — BUCKETS E POLÍTICAS
-- ══════════════════════════════════════════════════════════════

-- Buckets (criar via Dashboard se ainda não existirem)
INSERT INTO storage.buckets (id, name, public) VALUES ('atividades',  'atividades',  false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias',  'evidencias',  false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materiais',   'materiais',   false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-anexos', 'chat-anexos', true)  ON CONFLICT (id) DO NOTHING;

-- chat-anexos
DROP POLICY IF EXISTS "chat_anexos_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_anexos_read"   ON storage.objects;

CREATE POLICY "chat_anexos_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-anexos' AND auth.role() = 'authenticated');
CREATE POLICY "chat_anexos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-anexos');

-- materiais — respostas de alunos
DROP POLICY IF EXISTS "materiais_aluno_resposta_insert" ON storage.objects;
DROP POLICY IF EXISTS "materiais_aluno_resposta_select" ON storage.objects;

CREATE POLICY "materiais_aluno_resposta_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'materiais'
        AND name LIKE 'respostas/%'
        AND EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.auth_id = auth.uid() AND u.role = 'aluno'
        )
    );
CREATE POLICY "materiais_aluno_resposta_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'materiais' AND name LIKE 'respostas/%');


-- ══════════════════════════════════════════════════════════════
-- 12. REALTIME
-- ══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;


-- ══════════════════════════════════════════════════════════════
-- 13. DADOS — ajustes históricos de aulas (maio/2026)
-- ══════════════════════════════════════════════════════════════
-- Valores FINAIS após todas as revisões aplicadas.
-- Execute apenas uma vez em instância com dados existentes.

UPDATE public.professores_info SET ajuste_aulas_mes = 1,  ajuste_mes_ref = '2026-05-01'
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'wilgner.santos@ufpe.br');

UPDATE public.professores_info SET ajuste_aulas_mes = 1,  ajuste_mes_ref = '2026-05-01'
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'teomoraes13@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 1,  ajuste_mes_ref = '2026-05-01'
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'tiellybalima@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = -1, ajuste_mes_ref = '2026-05-01'
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'phablocarneirofarm@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = -1, ajuste_mes_ref = '2026-05-01'
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'amandamamede2011@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 0,  ajuste_mes_ref = NULL
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'laelpcss@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 0,  ajuste_mes_ref = NULL
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'thaise.j.araujo@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 0,  ajuste_mes_ref = NULL
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'proflucaslvguimaraes@gmail.com');

UPDATE public.professores_info SET ajuste_aulas_mes = 0,  ajuste_mes_ref = NULL
    WHERE usuario_id = (SELECT id FROM public.usuarios WHERE email = 'rayssasantana24@yahoo.com');

-- Sincroniza saldo_aulas_dadas com o número real de relatórios
UPDATE public.professores_info pi
SET saldo_aulas_dadas = (
    SELECT COUNT(*) FROM public.relatorios r WHERE r.professor_id = pi.usuario_id
);


-- ══════════════════════════════════════════════════════════════
-- 14. CRON — disparo automático dos lembretes WhatsApp
-- ══════════════════════════════════════════════════════════════
-- Execute APÓS o deploy da Edge Function 'send-class-reminders'.
-- Substitua <SEU_CRON_SECRET> pelo valor real nas env vars do Supabase.

SELECT cron.unschedule('send-class-reminders')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-class-reminders'
);

SELECT cron.schedule(
    'send-class-reminders',
    '* * * * *',
    $$
    SELECT net.http_post(
        url     := 'https://kverxbbwvmxcdiqwcijp.supabase.co/functions/v1/send-class-reminders',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', '<SEU_CRON_SECRET>'
        ),
        body    := '{}'::jsonb
    );
    $$
);

SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'send-class-reminders';
