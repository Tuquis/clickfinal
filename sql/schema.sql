-- ============================================================
-- ENSINOCLICK — SCHEMA COMPLETO
-- Execute no SQL Editor do Supabase
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','professor','aluno','psicopedagoga')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: alunos_info
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alunos_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    serie TEXT NOT NULL,
    disciplina TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    telefone TEXT NOT NULL,
    aulas_disponiveis INTEGER NOT NULL DEFAULT 0 CHECK (aulas_disponiveis >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: professores_info
-- ============================================================
CREATE TABLE IF NOT EXISTS public.professores_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    saldo_aulas_dadas INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: disponibilidade
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disponibilidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT horario_valido CHECK (horario_fim > horario_inicio)
);

-- ============================================================
-- TABELA: agenda_meet
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_meet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    horario TIME NOT NULL,
    conteudo TEXT NOT NULL,
    link_meet TEXT,
    status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
    created_by UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT data_futura CHECK (data >= CURRENT_DATE)
);

-- ============================================================
-- TABELA: relatorios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.relatorios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agenda_id UUID NOT NULL UNIQUE REFERENCES public.agenda_meet(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES public.usuarios(id),
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id),
    conteudo_ministrado TEXT NOT NULL,
    comportamento TEXT NOT NULL CHECK (comportamento IN ('excelente','bom','regular','ruim')),
    compreensao TEXT NOT NULL CHECK (compreensao IN ('excelente','boa','regular','baixa')),
    recomendacoes TEXT,
    habilidades JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: cronograma
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cronograma (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.usuarios(id),
    semana_inicio DATE NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: cronograma_tarefas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cronograma_tarefas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cronograma_id UUID NOT NULL REFERENCES public.cronograma(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida')),
    evidencia_url TEXT,
    concluida_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: atividades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    arquivo_url TEXT,
    prazo DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: financeiro
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    vencimento DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado')),
    pago_em TIMESTAMPTZ,
    created_by UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: observacoes_psico
-- ============================================================
CREATE TABLE IF NOT EXISTS public.observacoes_psico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psico_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    categoria TEXT DEFAULT 'geral' CHECK (categoria IN ('geral','comportamental','cognitivo','emocional','social')),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    acao TEXT NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id),
    tabela TEXT NOT NULL,
    registro_id UUID,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alunos_info_usuario ON public.alunos_info(usuario_id);
CREATE INDEX IF NOT EXISTS idx_professores_info_usuario ON public.professores_info(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agenda_aluno ON public.agenda_meet(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_professor ON public.agenda_meet(professor_id);
CREATE INDEX IF NOT EXISTS idx_agenda_data ON public.agenda_meet(data);
CREATE INDEX IF NOT EXISTS idx_relatorios_agenda ON public.relatorios(agenda_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_aluno ON public.relatorios(aluno_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_aluno ON public.cronograma(aluno_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_aluno ON public.financeiro(aluno_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON public.financeiro(status);
CREATE INDEX IF NOT EXISTS idx_observacoes_aluno ON public.observacoes_psico(aluno_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_professor ON public.disponibilidade(professor_id);
