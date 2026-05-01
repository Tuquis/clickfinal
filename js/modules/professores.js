// ============================================================
// MÓDULO: PROFESSORES — Métricas + Calendário de aulas
// ============================================================

Modules.Professores = {
    _profId:    null,
    _profNome:  '',
    _mesAtual:  null,   // { year: Number, month: Number }  (month 0-indexed)
    _relatorios:[],     // { created_at } do professor selecionado
    _todosProfs:[],

    async render() {
        if (!Auth.can('admin', 'professor')) return;
        if (Auth.can('professor')) {
            await this._renderProf();
        } else {
            await this._renderAdmin();
        }
    },

    // ── VISÃO PROFESSOR ──────────────────────────────────────────

    async _renderProf() {
        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Minhas Aulas</h1>
            </div>
            <div id="prof-wrap"><div class="loader-inline"></div></div>
        `);

        const uid = AppState.userProfile.id;
        const { data: rels } = await supabase
            .from('relatorios')
            .select('created_at')
            .eq('professor_id', uid)
            .order('created_at', { ascending: false });

        this._relatorios = rels || [];
        this._profId     = uid;
        this._profNome   = AppState.userProfile.nome;

        const now    = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };

        const total     = this._relatorios.length;
        const mesCount  = this._contagemMes(now.getFullYear(), now.getMonth());
        const mesLabel  = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        document.getElementById('prof-wrap').innerHTML = `
            <div class="stats-grid stats-grid-2" style="max-width:480px;margin-bottom:20px">
                <div class="stat-card stat-purple">
                    <div class="stat-icon">📅</div>
                    <div>
                        <div class="stat-value">${mesCount}</div>
                        <div class="stat-label">Aulas em ${mesLabel}</div>
                    </div>
                </div>
                <div class="stat-card stat-blue">
                    <div class="stat-icon">🏫</div>
                    <div>
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">Total na plataforma</div>
                    </div>
                </div>
            </div>
            <div class="card" style="max-width:380px">
                <div class="card-body" id="prof-cal-wrap"></div>
            </div>
        `;

        this._renderCalendario('prof-cal-wrap');
    },

    // ── VISÃO ADMIN ──────────────────────────────────────────────

    async _renderAdmin() {
        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Professores</h1>
            </div>
            <div style="display:grid;grid-template-columns:1fr 380px;gap:20px;align-items:start" id="prof-admin-grid">
                <div>
                    <div class="card">
                        <div class="card-toolbar">
                            <input type="text" class="input input-search" id="prof-search"
                                placeholder="Buscar por nome ou matéria..."
                                oninput="Modules.Professores._filtrar(this.value)" />
                        </div>
                        <div id="prof-list-wrap" class="card-body">
                            <div class="loader-inline"></div>
                        </div>
                    </div>
                </div>
                <div id="prof-cal-panel" style="display:none">
                    <div class="card">
                        <div class="card-header">
                            <h3 id="prof-cal-nome" style="font-size:.9rem"></h3>
                        </div>
                        <div class="card-body" id="prof-cal-wrap"></div>
                    </div>
                </div>
            </div>
        `);

        await this._loadAdmin();
    },

    async _loadAdmin() {
        const { data: profs, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, ativo, professores_info(materia)')
            .eq('role', 'professor')
            .order('nome');

        if (error) {
            document.getElementById('prof-list-wrap').innerHTML =
                `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!profs || profs.length === 0) {
            document.getElementById('prof-list-wrap').innerHTML = emptyState('Nenhum professor cadastrado');
            return;
        }

        // Conta total e mês para todos os professores de uma vez
        const now = new Date();
        const { data: rels } = await supabase
            .from('relatorios')
            .select('professor_id, created_at');

        const cTotal = {};
        const cMes   = {};
        (rels || []).forEach(r => {
            const pid = r.professor_id;
            cTotal[pid] = (cTotal[pid] || 0) + 1;
            const d = new Date(r.created_at);
            if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                cMes[pid] = (cMes[pid] || 0) + 1;
            }
        });

        this._todosProfs = profs.map(p => ({
            ...p,
            total:   cTotal[p.id] || 0,
            mes:     cMes[p.id]   || 0,
            materia: p.professores_info?.[0]?.materia || '—'
        }));

        const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        this._renderTabela(this._todosProfs, mesLabel);
    },

    _filtrar(query) {
        const q = query.toLowerCase();
        const filtrados = this._todosProfs.filter(p =>
            p.nome.toLowerCase().includes(q) || p.materia.toLowerCase().includes(q)
        );
        const mesLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        this._renderTabela(filtrados, mesLabel);
    },

    _renderTabela(profs, mesLabel) {
        const wrap = document.getElementById('prof-list-wrap');
        if (!wrap) return;

        if (!profs.length) {
            wrap.innerHTML = emptyState('Nenhum professor encontrado');
            return;
        }

        wrap.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Professor</th>
                        <th>Matéria</th>
                        <th>Aulas — ${escapeHtml(mesLabel)}</th>
                        <th>Total</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${profs.map(p => `
                        <tr id="prof-row-${p.id}">
                            <td>
                                <div class="user-cell">
                                    <div class="avatar-sm">${escapeHtml(p.nome.charAt(0).toUpperCase())}</div>
                                    <div>
                                        <div>${escapeHtml(p.nome)}</div>
                                        <div style="font-size:.75rem;color:var(--color-text-3)">${escapeHtml(p.email)}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${escapeHtml(p.materia)}</td>
                            <td>
                                <span style="font-weight:700;font-size:1.1rem;color:var(--color-primary)">${p.mes}</span>
                                <span style="font-size:.75rem;color:var(--color-text-3)"> aulas</span>
                            </td>
                            <td>
                                <span style="font-weight:700">${p.total}</span>
                                <span style="font-size:.75rem;color:var(--color-text-3)"> aulas</span>
                            </td>
                            <td>
                                <button class="btn btn-ghost btn-sm"
                                    onclick="Modules.Professores._abrirCalendario('${p.id}', ${JSON.stringify(escapeHtml(p.nome))})">
                                    📅 Ver
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async _abrirCalendario(profId, profNome) {
        const panel  = document.getElementById('prof-cal-panel');
        const nomeEl = document.getElementById('prof-cal-nome');
        const calWrap= document.getElementById('prof-cal-wrap');
        if (!panel || !nomeEl || !calWrap) return;

        nomeEl.textContent = profNome;
        panel.style.display = 'block';
        calWrap.innerHTML = '<div class="loader-inline"></div>';

        // Destaca a linha selecionada
        document.querySelectorAll('[id^="prof-row-"]').forEach(r => r.style.background = '');
        const row = document.getElementById('prof-row-' + profId);
        if (row) row.style.background = 'var(--color-surface-2)';

        const { data } = await supabase
            .from('relatorios')
            .select('created_at')
            .eq('professor_id', profId)
            .order('created_at', { ascending: false });

        this._profId    = profId;
        this._profNome  = profNome;
        this._relatorios = data || [];

        const now = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };
        this._renderCalendario('prof-cal-wrap');
    },

    // ── NAVEGAÇÃO DE MÊS ─────────────────────────────────────────

    _navMes(delta) {
        let { year, month } = this._mesAtual;
        month += delta;
        if (month < 0)  { month = 11; year -= 1; }
        if (month > 11) { month = 0;  year += 1; }
        this._mesAtual = { year, month };
        this._renderCalendario('prof-cal-wrap');
    },

    // ── CALENDÁRIO ───────────────────────────────────────────────

    _contagemMes(year, month) {
        return this._relatorios.filter(r => {
            const d = new Date(r.created_at);
            return d.getFullYear() === year && d.getMonth() === month;
        }).length;
    },

    _renderCalendario(wrapId) {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;

        const { year, month } = this._mesAtual;

        const MESES = [
            'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
        ];
        const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

        // Conta aulas por dia do mês exibido
        const aulasPerDay = {};
        this._relatorios.forEach(r => {
            const d = new Date(r.created_at);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dia = d.getDate();
                aulasPerDay[dia] = (aulasPerDay[dia] || 0) + 1;
            }
        });

        const daysInMonth  = new Date(year, month + 1, 0).getDate();
        const firstDow     = new Date(year, month, 1).getDay(); // 0 = Dom

        const today = new Date();
        const isHoje = (d) =>
            today.getFullYear() === year &&
            today.getMonth()    === month &&
            today.getDate()     === d;

        // Células vazias + dias
        let cells = '';
        for (let i = 0; i < firstDow; i++) {
            cells += '<div class="pcal-cell pcal-empty"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const count   = aulasPerDay[d] || 0;
            const classes = ['pcal-cell'];
            if (isHoje(d))  classes.push('pcal-hoje');
            if (count > 0)  classes.push('pcal-tem-aula');
            cells += `
                <div class="${classes.join(' ')}">
                    <span class="pcal-num">${d}</span>
                    ${count > 0 ? `<span class="pcal-badge">${count}</span>` : ''}
                </div>`;
        }

        wrap.innerHTML = `
            <div class="pcal">
                <div class="pcal-nav">
                    <button class="btn btn-ghost btn-sm pcal-nav-btn"
                        onclick="Modules.Professores._navMes(-1)">&#8249;</button>
                    <span class="pcal-titulo">${MESES[month]} ${year}</span>
                    <button class="btn btn-ghost btn-sm pcal-nav-btn"
                        onclick="Modules.Professores._navMes(1)">&#8250;</button>
                </div>
                <div class="pcal-grid">
                    ${SEMANA.map(s => `<div class="pcal-dow">${s}</div>`).join('')}
                    ${cells}
                </div>
                <div class="pcal-legenda">
                    <span class="pcal-leg-aula"></span> Aula realizada
                </div>
            </div>
        `;
    }
};
