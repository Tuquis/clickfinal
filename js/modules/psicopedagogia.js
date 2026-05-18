// ============================================================
// MÓDULO: PSICOPEDAGOGIA
// ============================================================

Modules.Psicopedagogia = {
    _page: 1,
    _alunos: [],

    async render() {
        if (!Auth.requireRole('psicopedagoga', 'admin')) return;
        if (Auth.can('admin')) {
            await this._renderAdmin();
        } else {
            await this._renderPsico();
        }
    },

    // ── VISÃO ADMIN ──────────────────────────────────────────────

    async _renderAdmin() {
        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Psicopedagogia</h1>
            </div>

            <div class="card">
                <div class="card-toolbar">
                    <select class="input" id="adm-psico-filter" onchange="Modules.Psicopedagogia._loadAdmin()">
                        <option value="">Todas as psicopedagogas</option>
                    </select>
                    <select class="input" id="adm-aluno-filter" onchange="Modules.Psicopedagogia._loadAdmin()">
                        <option value="">Todos os alunos</option>
                    </select>
                    <input type="month" class="input" id="adm-mes-filter" onchange="Modules.Psicopedagogia._loadAdmin()" />
                </div>
                <div id="adm-psico-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
                <div id="adm-psico-total" style="padding:10px 20px;font-size:.875rem;color:var(--color-text-3);border-top:1px solid var(--color-border)"></div>
            </div>

            <!-- MODAL: FICHA DA CONSULTA -->
            <div class="modal-overlay" id="modal-ficha-consulta">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Ficha de Consulta</h3>
                        <button class="modal-close" onclick="closeModal('modal-ficha-consulta')">×</button>
                    </div>
                    <div class="modal-body" id="ficha-consulta-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-ficha-consulta')">Fechar</button>
                        <button class="btn btn-secondary" id="btn-pdf-ficha"
                            onclick="Modules.Psicopedagogia._pdfCurrentId && Modules.Psicopedagogia.exportConsultaPDF(Modules.Psicopedagogia._pdfCurrentId)">
                            Exportar PDF
                        </button>
                    </div>
                </div>
            </div>
        `);

        const [{ data: psicos }, { data: alunos }] = await Promise.all([
            supabase.from('usuarios').select('id, nome').eq('role', 'psicopedagoga').eq('ativo', true).order('nome'),
            supabase.from('usuarios').select('id, nome').eq('role', 'aluno').eq('ativo', true).order('nome')
        ]);

        const selPsico = document.getElementById('adm-psico-filter');
        const selAluno = document.getElementById('adm-aluno-filter');
        (psicos || []).forEach(p => { selPsico.innerHTML += `<option value="${p.id}">${escapeHtml(p.nome)}</option>`; });
        (alunos || []).forEach(a => { selAluno.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`; });

        await this._loadAdmin();
    },

    async _loadAdmin() {
        const list  = document.getElementById('adm-psico-list');
        const total = document.getElementById('adm-psico-total');
        if (!list) return;
        list.innerHTML = '<div class="loader-inline"></div>';

        let query = supabase
            .from('consultas_psico')
            .select(`
                id, data, areas_trabalhadas, humor_aluno, engajamento,
                observacoes, estrategias, recomendacoes_familia, encaminhamentos,
                aluno:usuarios!consultas_psico_aluno_id_fkey(nome),
                psico:usuarios!consultas_psico_psico_id_fkey(nome)
            `, { count: 'exact' })
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });

        const psicoVal = document.getElementById('adm-psico-filter')?.value;
        const alunoVal = document.getElementById('adm-aluno-filter')?.value;
        const mesVal   = document.getElementById('adm-mes-filter')?.value;
        if (psicoVal) query = query.eq('psico_id', psicoVal);
        if (alunoVal) query = query.eq('aluno_id', alunoVal);
        if (mesVal) {
            const [y, m] = mesVal.split('-');
            query = query
                .gte('data', `${y}-${m}-01`)
                .lte('data', new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]);
        }

        const { data, error, count } = await query;

        if (error) {
            list.innerHTML = `<p class="text-danger" style="padding:16px">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            list.innerHTML = '<p style="padding:20px;color:var(--color-text-3);text-align:center">Nenhuma consulta encontrada.</p>';
            if (total) total.textContent = 'Total: 0 consultas';
            return;
        }

        const _AREAS = {
            cognitivo:'Cognitivo', emocional:'Emocional', comportamental:'Comportamental',
            social:'Social', aprendizagem:'Aprendizagem', atencao:'Atenção/Foco', linguagem:'Linguagem'
        };

        list.innerHTML = `
            <table class="table">
                <thead><tr>
                    <th>Data</th>
                    <th>Aluno</th>
                    <th>Psicopedagoga</th>
                    <th>Áreas</th>
                    <th>Ações</th>
                </tr></thead>
                <tbody>
                    ${data.map(c => `
                        <tr>
                            <td>${fmt.date(c.data)}</td>
                            <td>${escapeHtml(c.aluno?.nome || '—')}</td>
                            <td>${escapeHtml(c.psico?.nome  || '—')}</td>
                            <td style="max-width:180px">
                                ${(c.areas_trabalhadas || []).map(a =>
                                    `<span class="badge badge-psico-geral" style="font-size:.7rem">${escapeHtml(_AREAS[a]||a)}</span>`
                                ).join(' ')}
                            </td>
                            <td>
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="Modules.Psicopedagogia.verConsulta('${c.id}', true)">Ficha</button>
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="Modules.Psicopedagogia.exportConsultaPDF('${c.id}')">PDF</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        if (total) total.textContent = `Total: ${count || data.length} consulta${(count || data.length) !== 1 ? 's' : ''}`;
    },

    // ── VISÃO PSICOPEDAGOGA ──────────────────────────────────────

    async _renderPsico() {
        const uid = AppState.userProfile.id;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Psicopedagogia</h1>
                <button class="btn btn-primary" onclick="Modules.Psicopedagogia.openConsulta()">Iniciar Consulta</button>
            </div>

            <div id="psico-stats" style="margin-bottom:20px"></div>

            <!-- AGENDA PSICO -->
            <div class="card" style="margin-bottom:20px">
                <div class="card-header">
                    <h3 style="font-size:.9rem">Próximas Consultas Agendadas</h3>
                </div>
                <div id="psico-agenda-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- HISTÓRICO DE CONSULTAS -->
            <div class="card">
                <div class="card-header">
                    <h3 style="font-size:.9rem">Histórico de Consultas</h3>
                </div>
                <div class="card-toolbar">
                    <select class="input" id="filter-psico-aluno" onchange="Modules.Psicopedagogia._loadPsico()">
                        <option value="">Todos os alunos</option>
                    </select>
                    <input type="month" class="input" id="filter-psico-mes" onchange="Modules.Psicopedagogia._loadPsico()" />
                </div>
                <div id="psico-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL: INICIAR CONSULTA -->
            <div class="modal-overlay" id="modal-consulta-psico">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Consulta Psicopedagógica</h3>
                        <button class="modal-close" onclick="closeModal('modal-consulta-psico')">×</button>
                    </div>
                    <div class="modal-body" id="consulta-psico-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-consulta-psico')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-encerrar-consulta"
                            onclick="Modules.Psicopedagogia.encerrarConsulta()">Encerrar Consulta</button>
                    </div>
                </div>
            </div>

            <!-- MODAL: FICHA DA CONSULTA -->
            <div class="modal-overlay" id="modal-ficha-consulta">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Ficha de Consulta</h3>
                        <button class="modal-close" onclick="closeModal('modal-ficha-consulta')">×</button>
                    </div>
                    <div class="modal-body" id="ficha-consulta-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-ficha-consulta')">Fechar</button>
                        <button class="btn btn-secondary" id="btn-pdf-ficha"
                            onclick="Modules.Psicopedagogia._pdfCurrentId && Modules.Psicopedagogia.exportConsultaPDF(Modules.Psicopedagogia._pdfCurrentId)">
                            Exportar PDF
                        </button>
                    </div>
                </div>
            </div>
        `);

        const { data: alunos } = await supabase
            .from('usuarios').select('id, nome').eq('role', 'aluno').eq('ativo', true).order('nome');
        this._alunos = alunos || [];

        const selFilter = document.getElementById('filter-psico-aluno');
        if (selFilter) this._alunos.forEach(a => {
            selFilter.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
        });

        await Promise.all([
            this._renderStats(),
            this._loadAgendaPsico(),
            this._loadPsico()
        ]);
    },

    async _renderStats() {
        const statsEl = document.getElementById('psico-stats');
        if (!statsEl) return;

        const uid = AppState.userProfile.id;
        const now = new Date();
        const ini = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        const fim = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];
        const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const [{ count: cMes }, { count: cTotal }] = await Promise.all([
            supabase.from('consultas_psico').select('id', { count: 'exact', head: true })
                .eq('psico_id', uid).gte('data', ini).lte('data', fim),
            supabase.from('consultas_psico').select('id', { count: 'exact', head: true })
                .eq('psico_id', uid)
        ]);

        statsEl.innerHTML = `
            <div class="stats-grid" style="margin-bottom:0">
                <div class="stat-card stat-purple">
                    <div class="stat-icon">🧠</div>
                    <div>
                        <div class="stat-value">${cMes || 0}</div>
                        <div class="stat-label">Consultas em ${mesLabel}</div>
                    </div>
                </div>
                <div class="stat-card stat-blue">
                    <div class="stat-icon">📋</div>
                    <div>
                        <div class="stat-value">${cTotal || 0}</div>
                        <div class="stat-label">Total de consultas</div>
                    </div>
                </div>
            </div>
        `;
    },

    async _loadAgendaPsico() {
        const container = document.getElementById('psico-agenda-list');
        if (!container) return;

        const uid   = AppState.userProfile.id;
        const today = todayISO();

        const { data, error } = await supabase
            .from('agenda_psico')
            .select(`
                id, data, horario, observacoes, status,
                aluno:usuarios!agenda_psico_aluno_id_fkey(nome)
            `)
            .eq('psico_id', uid)
            .eq('status', 'agendada')
            .gte('data', today)
            .order('data').order('horario')
            .limit(10);

        if (error || !data?.length) {
            container.innerHTML = '<p style="color:var(--color-text-3);font-size:.875rem">Nenhuma consulta agendada.</p>';
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead><tr><th>Data</th><th>Horário</th><th>Aluno</th><th>Observações</th></tr></thead>
                <tbody>
                    ${data.map(a => `
                        <tr>
                            <td>${fmt.date(a.data)}</td>
                            <td>${fmt.time(a.horario)}</td>
                            <td>${escapeHtml(a.aluno?.nome || '—')}</td>
                            <td style="font-size:.825rem;color:var(--color-text-3)">
                                ${a.observacoes ? escapeHtml(a.observacoes) : '—'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async _loadPsico() {
        const container = document.getElementById('psico-list');
        if (!container) return;

        const uid = AppState.userProfile.id;
        let query = supabase
            .from('consultas_psico')
            .select(`
                id, data, areas_trabalhadas, humor_aluno, engajamento, observacoes, created_at,
                aluno:usuarios!consultas_psico_aluno_id_fkey(nome)
            `, { count: 'exact' })
            .eq('psico_id', uid)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });

        const alunoVal = document.getElementById('filter-psico-aluno')?.value;
        const mesVal   = document.getElementById('filter-psico-mes')?.value;
        if (alunoVal) query = query.eq('aluno_id', alunoVal);
        if (mesVal) {
            const [y, m] = mesVal.split('-');
            query = query
                .gte('data', `${y}-${m}-01`)
                .lte('data', new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]);
        }

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhuma consulta encontrada');
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);
        const _AREAS = {
            cognitivo:'Cognitivo', emocional:'Emocional', comportamental:'Comportamental',
            social:'Social', aprendizagem:'Aprendizagem', atencao:'Atenção/Foco', linguagem:'Linguagem'
        };

        container.innerHTML = `
            <div class="observacoes-lista">
                ${data.map(c => `
                    <div class="observacao-card">
                        <div class="observacao-header">
                            <div class="obs-info">
                                <span class="obs-aluno-nome">${escapeHtml(c.aluno?.nome || '—')}</span>
                                <span class="obs-data">${fmt.date(c.data)}</span>
                            </div>
                            <div class="obs-meta">
                                <button class="btn btn-ghost btn-xs"
                                    onclick="Modules.Psicopedagogia.verConsulta('${c.id}')">Ficha</button>
                                <button class="btn btn-ghost btn-xs"
                                    onclick="Modules.Psicopedagogia.exportConsultaPDF('${c.id}')">PDF</button>
                                <button class="btn btn-ghost btn-xs text-danger"
                                    onclick="Modules.Psicopedagogia.deletar('${c.id}')">Excluir</button>
                            </div>
                        </div>
                        ${c.areas_trabalhadas?.length ? `
                            <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px">
                                ${c.areas_trabalhadas.map(a =>
                                    `<span class="badge badge-psico-geral">${escapeHtml(_AREAS[a]||a)}</span>`
                                ).join('')}
                            </div>` : ''}
                        <div class="observacao-conteudo">${escapeHtml(c.observacoes)}</div>
                    </div>
                `).join('')}
            </div>
            ${paginationHtml(this._page, totalPages, 'Modules.Psicopedagogia._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Psicopedagogia._page = p;
        Modules.Psicopedagogia._loadPsico();
    },

    // ── ABRIR CONSULTA ───────────────────────────────────────────

    async openConsulta() {
        openModal('modal-consulta-psico');
        const body = document.getElementById('consulta-psico-body');

        const alunosOpts = this._alunos.map(a =>
            `<option value="${a.id}">${escapeHtml(a.nome)}</option>`
        ).join('');

        body.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Aluno *</label>
                    <select class="input" id="cp-aluno">
                        <option value="">— selecione —</option>
                        ${alunosOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Data da consulta *</label>
                    <input type="date" class="input" id="cp-data" value="${todayISO()}" max="${todayISO()}" />
                </div>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">🧩 Áreas trabalhadas na sessão</div>
                <div class="check-grid">
                    ${[
                        ['cognitivo','Cognitivo'],['emocional','Emocional'],
                        ['comportamental','Comportamental'],['social','Social'],
                        ['aprendizagem','Aprendizagem'],['atencao','Atenção / Foco'],
                        ['linguagem','Linguagem'],
                    ].map(([v,l]) => `
                        <label class="check-item">
                            <input type="checkbox" value="${v}" class="cp-area-check" /> ${l}
                        </label>`).join('')}
                </div>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">😊 Humor / Estado emocional do aluno</div>
                <div class="radio-list" style="flex-direction:row;flex-wrap:wrap;gap:16px">
                    ${[['tranquilo','Tranquilo'],['motivado','Motivado'],['ansioso','Ansioso'],
                       ['agitado','Agitado'],['triste','Triste']].map(([v,l]) => `
                        <label class="radio-item">
                            <input type="radio" name="cp-humor" value="${v}" /> ${l}
                        </label>`).join('')}
                </div>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">⚡ Engajamento na sessão</div>
                <div class="radio-list" style="flex-direction:row;gap:24px">
                    ${[['alto','Alto'],['medio','Médio'],['baixo','Baixo']].map(([v,l]) => `
                        <label class="radio-item">
                            <input type="radio" name="cp-engaj" value="${v}" /> ${l}
                        </label>`).join('')}
                </div>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">📝 Iniciar Consulta — Anotações da sessão *</div>
                <textarea class="input textarea" id="cp-obs" rows="4"
                    placeholder="Descreva o que foi observado durante a consulta..."></textarea>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">🛠️ Estratégias utilizadas</div>
                <textarea class="input textarea" id="cp-estrategias" rows="3"
                    placeholder="Técnicas, jogos, dinâmicas aplicadas na sessão..."></textarea>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">🏠 Recomendações para a família</div>
                <textarea class="input textarea" id="cp-recom" rows="3"
                    placeholder="Orientações e atividades para o ambiente familiar..."></textarea>
            </div>

            <div class="rel-section">
                <div class="rel-section-title">📌 Encaminhamentos</div>
                <textarea class="input textarea" id="cp-encam" rows="2"
                    placeholder="Encaminhamentos para outros especialistas, escola, etc..."></textarea>
            </div>
        `;
    },

    async encerrarConsulta() {
        const alunoId  = (document.getElementById('cp-aluno')?.value  || '').trim();
        const data     = (document.getElementById('cp-data')?.value   || '').trim();
        const obs      = (document.getElementById('cp-obs')?.value    || '').trim();
        const humor    = document.querySelector('input[name="cp-humor"]:checked')?.value  || null;
        const engaj    = document.querySelector('input[name="cp-engaj"]:checked')?.value  || null;
        const estrateg = (document.getElementById('cp-estrategias')?.value || '').trim();
        const recom    = (document.getElementById('cp-recom')?.value   || '').trim();
        const encam    = (document.getElementById('cp-encam')?.value   || '').trim();
        const areas    = Array.from(document.querySelectorAll('.cp-area-check:checked')).map(el => el.value);

        if (!alunoId) return showToast('Selecione o aluno', 'error');
        if (!data)    return showToast('Informe a data da consulta', 'error');
        if (!obs)     return showToast('Preencha as anotações da sessão', 'error');

        const btn = document.getElementById('btn-encerrar-consulta');
        if (btn) btn.disabled = true;
        try {
            const { error } = await supabase.from('consultas_psico').insert({
                psico_id:             AppState.userProfile.id,
                aluno_id:             alunoId,
                data,
                areas_trabalhadas:    areas.length ? areas : null,
                humor_aluno:          humor,
                engajamento:          engaj,
                observacoes:          obs,
                estrategias:          estrateg || null,
                recomendacoes_familia: recom   || null,
                encaminhamentos:      encam    || null
            });
            if (error) throw error;

            await auditLog('CONSULTA_PSICO_ENCERRADA', 'consultas_psico', null, { alunoId });
            showToast('Consulta registrada com sucesso', 'success');
            closeModal('modal-consulta-psico');
            await this._renderStats();
            await this._loadPsico();
        } catch (err) {
            showToast(err.message || 'Erro ao registrar', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    // ── FICHA E PDF ──────────────────────────────────────────────

    _pdfCurrentId: null,

    async verConsulta(id, isAdmin = false) {
        this._pdfCurrentId = id;
        openModal('modal-ficha-consulta');
        const body = document.getElementById('ficha-consulta-body');
        body.innerHTML = '<div class="loader-inline"></div>';

        const { data: c, error } = await supabase
            .from('consultas_psico')
            .select(`*, aluno:usuarios!consultas_psico_aluno_id_fkey(nome),
                        psico:usuarios!consultas_psico_psico_id_fkey(nome)`)
            .eq('id', id).single();

        if (error || !c) {
            body.innerHTML = '<p class="text-danger">Consulta não encontrada.</p>';
            return;
        }

        const _HUMOR = { tranquilo:'Tranquilo', agitado:'Agitado', ansioso:'Ansioso', triste:'Triste', motivado:'Motivado' };
        const _ENGAJ = { alto:'Alto', medio:'Médio', baixo:'Baixo' };
        const _AREAS = {
            cognitivo:'Cognitivo', emocional:'Emocional', comportamental:'Comportamental',
            social:'Social', aprendizagem:'Aprendizagem', atencao:'Atenção/Foco', linguagem:'Linguagem'
        };
        const row = (label, value) => value
            ? `<div class="info-item"><span class="info-label">${label}</span><span>${escapeHtml(value)}</span></div>`
            : '';
        const sec = (title, text) => text
            ? `<div class="rel-section">
                <div class="rel-section-title">${title}</div>
                <p style="white-space:pre-wrap;margin:0;font-size:.9rem">${escapeHtml(text)}</p>
               </div>`
            : '';

        body.innerHTML = `
            <div class="ficha-info-grid" style="margin-bottom:16px">
                ${row('Aluno',        c.aluno?.nome)}
                ${row('Data',         fmt.date(c.data))}
                ${isAdmin ? row('Psicopedagoga', c.psico?.nome) : ''}
                ${row('Humor',        _HUMOR[c.humor_aluno] || c.humor_aluno)}
                ${row('Engajamento',  _ENGAJ[c.engajamento] || c.engajamento)}
            </div>
            ${c.areas_trabalhadas?.length ? `
                <div class="rel-section">
                    <div class="rel-section-title">Áreas trabalhadas</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                        ${c.areas_trabalhadas.map(a =>
                            `<span class="badge badge-psico-geral">${escapeHtml(_AREAS[a]||a)}</span>`
                        ).join('')}
                    </div>
                </div>` : ''}
            ${sec('📝 Anotações da sessão',      c.observacoes)}
            ${sec('🛠️ Estratégias utilizadas',   c.estrategias)}
            ${sec('🏠 Recomendações para família', c.recomendacoes_familia)}
            ${sec('📌 Encaminhamentos',           c.encaminhamentos)}
        `;
    },

    async exportConsultaPDF(id) {
        if (!window.jspdf?.jsPDF) return showToast('Biblioteca PDF não carregada', 'error');
        showToast('Gerando PDF...', 'info', 2000);

        const { data: c, error } = await supabase
            .from('consultas_psico')
            .select(`*, aluno:usuarios!consultas_psico_aluno_id_fkey(nome),
                        psico:usuarios!consultas_psico_psico_id_fkey(nome)`)
            .eq('id', id).single();

        if (error || !c) return showToast('Consulta não encontrada', 'error');

        const nfc = s => s ? String(s).normalize('NFC') : '';
        const _HUMOR = { tranquilo:'Tranquilo', agitado:'Agitado', ansioso:'Ansioso', triste:'Triste', motivado:'Motivado' };
        const _ENGAJ = { alto:'Alto', medio:'Médio', baixo:'Baixo' };
        const _AREAS = {
            cognitivo:'Cognitivo', emocional:'Emocional', comportamental:'Comportamental',
            social:'Social', aprendizagem:'Aprendizagem', atencao:'Atenção/Foco', linguagem:'Linguagem'
        };

        const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Header
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20); doc.setFont('helvetica', 'bold');
        doc.text(nfc('CLICK DO SABER'), 105, 14, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        doc.text(nfc('Ficha de Consulta Psicopedagógica'), 105, 23, { align: 'center' });
        doc.setFontSize(9);
        doc.text(nfc('Gerado em ' + new Date().toLocaleDateString('pt-BR')), 105, 30, { align: 'center' });

        // Card aluno
        doc.setFillColor(245, 245, 245); doc.setDrawColor(220);
        doc.roundedRect(10, 40, 190, 20, 3, 3, 'FD');
        doc.setTextColor(80, 80, 80); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(nfc('Aluno'), 16, 48);
        doc.setTextColor(30, 30, 30); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text(nfc(c.aluno?.nome || '—'), 16, 55);
        doc.setTextColor(80, 80, 80); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(nfc('Psicopedagoga'), 110, 48);
        doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(nfc(c.psico?.nome || '—'), 110, 55);

        const tableBody = [
            { item: nfc('Data'),         detalhe: nfc(c.data ? new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR') : '—') },
            { item: nfc('Humor'),        detalhe: nfc(_HUMOR[c.humor_aluno] || c.humor_aluno || '—') },
            { item: nfc('Engajamento'),  detalhe: nfc(_ENGAJ[c.engajamento] || c.engajamento || '—') },
            { item: nfc('Áreas'),        detalhe: nfc((c.areas_trabalhadas||[]).map(a => _AREAS[a]||a).join(', ') || '—') },
            { item: nfc('Anotações'),    detalhe: nfc(c.observacoes || '—') },
        ];
        if (c.estrategias)          tableBody.push({ item: nfc('Estratégias'),     detalhe: nfc(c.estrategias) });
        if (c.recomendacoes_familia) tableBody.push({ item: nfc('Recomendações'),  detalhe: nfc(c.recomendacoes_familia) });
        if (c.encaminhamentos)      tableBody.push({ item: nfc('Encaminhamentos'), detalhe: nfc(c.encaminhamentos) });

        doc.autoTable({
            startY: 66,
            theme: 'grid',
            headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 4 },
            columns: [
                { header: 'Categoria', dataKey: 'item' },
                { header: 'Conteúdo',  dataKey: 'detalhe' }
            ],
            body: tableBody,
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
        });

        const pageH = doc.internal.pageSize.height;
        doc.setDrawColor(200); doc.line(10, pageH - 20, 200, pageH - 20);
        doc.setFontSize(9); doc.setTextColor(120);
        doc.text(nfc('Click do Saber - Plataforma de Acompanhamento Pedagógico'), 105, pageH - 12, { align: 'center' });

        const nomeArq = (c.aluno?.nome || 'consulta').normalize('NFC')
            .replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
        doc.save(`consulta-psico-${nomeArq}-${c.data || 'data'}.pdf`);
        showToast('PDF exportado', 'success');
    },

    async deletar(id) {
        const confirmed = await confirmAction('Excluir esta consulta?');
        if (!confirmed) return;

        const { error } = await supabase.from('consultas_psico').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Consulta excluída', 'success');
        await this._renderStats();
        await this._loadPsico();
    }
};
