// ============================================================
// MÓDULO: PROFESSORES — Métricas + Calendário de aulas
// ============================================================

// Retorna o ajuste mensal se ajuste_mes_ref bater com o mês/ano informado
function _ajusteMes(pi, date) {
    if (!pi?.ajuste_aulas_mes || !pi?.ajuste_mes_ref) return 0;
    const ref = new Date(pi.ajuste_mes_ref);
    if (ref.getUTCFullYear() === date.getFullYear() && ref.getUTCMonth() === date.getMonth()) {
        return pi.ajuste_aulas_mes;
    }
    return 0;
}

Modules.Professores = {
    _profId:     null,
    _profNome:   '',
    _mesAtual:   null,   // { year: Number, month: Number }  (month 0-indexed)
    _relatorios: [],     // { created_at } do professor selecionado / logado
    _todosProfs: [],
    _profInfo:   null,   // professores_info do professor atual (para ajuste mensal)

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
        const [{ data: rels }, { data: profInfo }] = await Promise.all([
            supabase.from('relatorios').select('created_at').eq('professor_id', uid).order('created_at', { ascending: false }),
            supabase.from('professores_info').select('saldo_aulas_dadas, ajuste_aulas_mes, ajuste_mes_ref').eq('usuario_id', uid).single()
        ]);

        this._relatorios = rels || [];
        this._profId     = uid;
        this._profNome   = AppState.userProfile.nome;

        const now = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };
        this._profInfo  = profInfo;

        const total    = profInfo?.saldo_aulas_dadas || 0;
        const ajusteMes = _ajusteMes(profInfo, now);
        const mesCount = this._contagemMes(now.getFullYear(), now.getMonth()) + ajusteMes;
        const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const totalGanho = total * 20;

        document.getElementById('prof-wrap').innerHTML = `
            <div class="stats-grid stats-grid-2" style="margin-bottom:20px">
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

            <div class="card" style="margin-bottom:16px">
                <div class="card-header" style="padding:10px 16px">
                    <h3 style="font-size:.85rem">Ganhos ${now.getFullYear()}</h3>
                    <span class="prof-ganho-badge prof-ganho-total"><strong>${fmt.currency(totalGanho)}</strong></span>
                </div>
                <div class="card-body" style="padding:6px 12px;height:130px">
                    <canvas id="prof-ganhos-chart" height="110"></canvas>
                </div>
            </div>

            <div class="card prof-cal-card">
                <div class="card-body" id="prof-cal-wrap"></div>
            </div>
        `;

        this._renderCalendario('prof-cal-wrap');
        this._renderChart('prof-ganhos-chart', now.getFullYear());
    },

    // ── VISÃO ADMIN ──────────────────────────────────────────────

    async _renderAdmin() {
        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Professores</h1>
                <button class="btn btn-primary" onclick="Modules.Professores._addProf()">+ Adicionar Professor</button>
            </div>
            <div class="prof-admin-grid" id="prof-admin-grid">
                <div class="prof-admin-lista">
                    <div class="card">
                        <div class="card-toolbar">
                            <input type="text" class="input input-search" id="prof-search"
                                placeholder="Buscar por nome ou matéria..."
                                oninput="Modules.Professores._filtrar(this.value)" />
                        </div>
                        <div id="prof-list-wrap">
                            <div class="loader-inline"></div>
                        </div>
                    </div>
                </div>
                <div class="prof-admin-cal" id="prof-cal-panel" style="display:none">
                    <div class="card" style="margin-bottom:12px">
                        <div class="card-header">
                            <div>
                                <h3 id="prof-cal-nome" style="font-size:.9rem;margin:0"></h3>
                                <div id="prof-cal-stats" style="font-size:.75rem;color:var(--color-text-3);margin-top:3px"></div>
                            </div>
                            <div id="prof-admin-ganho" style="display:none;font-size:.8rem;font-weight:600;color:var(--color-primary)"></div>
                        </div>
                        <div class="card-body" id="prof-cal-wrap"></div>
                    </div>
                    <div class="card" id="prof-chart-card" style="display:none">
                        <div class="card-header" style="padding:10px 16px">
                            <h3 style="font-size:.85rem">Ganhos mensais</h3>
                            <span id="prof-chart-total" style="font-size:.78rem;font-weight:600;color:var(--color-primary)"></span>
                        </div>
                        <div class="card-body" style="padding:10px 16px;height:130px">
                            <canvas id="prof-ganhos-chart-admin" height="110"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `);

        await this._loadAdmin();
    },

    _addProf() {
        window._prefillRole = 'professor';
        Router.navigate('usuarios');
    },

    async _loadAdmin() {
        const [
            { data: profs, error },
            { data: profInfos },
            { data: rels }
        ] = await Promise.all([
            supabase.from('usuarios').select('id, nome, email, ativo').eq('role', 'professor').order('nome'),
            supabase.from('professores_info').select('usuario_id, materia, chave_pix, saldo_aulas_dadas, ajuste_aulas_mes, ajuste_mes_ref'),
            supabase.from('relatorios').select('professor_id, created_at')
        ]);

        if (error) {
            document.getElementById('prof-list-wrap').innerHTML =
                `<p class="text-danger" style="padding:16px">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!profs || profs.length === 0) {
            document.getElementById('prof-list-wrap').innerHTML = emptyState('Nenhum professor cadastrado');
            return;
        }

        // Indexar professores_info por usuario_id para lookup O(1)
        const piMap = {};
        (profInfos || []).forEach(pi => { piMap[pi.usuario_id] = pi; });

        const now = new Date();
        const cMes = {};
        (rels || []).forEach(r => {
            const pid = r.professor_id;
            const d = new Date(r.created_at);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                cMes[pid] = (cMes[pid] || 0) + 1;
            }
        });

        this._todosProfs = profs.map(p => ({
            ...p,
            total:     piMap[p.id]?.saldo_aulas_dadas || 0,
            mes:       (cMes[p.id] || 0) + _ajusteMes(piMap[p.id], now),
            materia:   piMap[p.id]?.materia   || '—',
            chave_pix: piMap[p.id]?.chave_pix || '—'
        }));

        this._renderTabela(this._todosProfs, now);
    },

    _filtrar(query) {
        const q = query.toLowerCase();
        const filtrados = this._todosProfs.filter(p =>
            p.nome.toLowerCase().includes(q) || p.materia.toLowerCase().includes(q)
        );
        this._renderTabela(filtrados, new Date());
    },

    _renderTabela(profs, now) {
        const wrap = document.getElementById('prof-list-wrap');
        if (!wrap) return;

        if (!profs.length) {
            wrap.innerHTML = emptyState('Nenhum professor encontrado');
            return;
        }

        const mesLabel = now.toLocaleDateString('pt-BR', { month: 'short' });

        wrap.innerHTML = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Professor</th>
                            <th>Matéria</th>
                            <th>Chave PIX</th>
                            <th>${mesLabel}</th>
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
                                            <div style="font-weight:500">${escapeHtml(p.nome)}</div>
                                            <div class="td-email">${escapeHtml(p.email)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>${escapeHtml(p.materia)}</td>
                                <td>
                                    ${p.chave_pix !== '—'
                                        ? `<span class="pix-key">${escapeHtml(p.chave_pix)}</span>`
                                        : `<span style="color:var(--color-text-3)">—</span>`
                                    }
                                </td>
                                <td><span class="metric-mes">${p.mes}</span></td>
                                <td><span class="metric-total">${p.total}</span></td>
                                <td>
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="Modules.Professores._abrirCalendario('${p.id}', ${JSON.stringify(escapeHtml(p.nome))})">
                                        📅
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async _abrirCalendario(profId, profNome) {
        const panel   = document.getElementById('prof-cal-panel');
        const nomeEl  = document.getElementById('prof-cal-nome');
        const statsEl = document.getElementById('prof-cal-stats');
        const calWrap = document.getElementById('prof-cal-wrap');
        if (!panel || !nomeEl || !calWrap) return;

        nomeEl.textContent = profNome;
        if (statsEl) statsEl.textContent = '';
        panel.style.display = 'block';
        calWrap.innerHTML = '<div class="loader-inline"></div>';

        document.querySelectorAll('[id^="prof-row-"]').forEach(r => r.classList.remove('prof-row-sel'));
        const row = document.getElementById('prof-row-' + profId);
        if (row) row.classList.add('prof-row-sel');

        // Em mobile, faz scroll até o calendário
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const [{ data }, { data: pi }] = await Promise.all([
            supabase.from('relatorios').select('created_at').eq('professor_id', profId).order('created_at', { ascending: false }),
            supabase.from('professores_info').select('saldo_aulas_dadas, ajuste_aulas_mes, ajuste_mes_ref').eq('usuario_id', profId).single()
        ]);

        this._profId     = profId;
        this._profNome   = profNome;
        this._relatorios = data || [];

        const now = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };
        this._profInfo  = pi;

        const totalReal = pi?.saldo_aulas_dadas || 0;

        if (statsEl) {
            const mesCount = this._contagemMes(now.getFullYear(), now.getMonth()) + _ajusteMes(pi, now);
            const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' });
            statsEl.textContent = `${mesCount} aulas em ${mesLabel}  ·  ${totalReal} no total`;
        }

        const totalGanho = totalReal * 20;
        const ganhoEl = document.getElementById('prof-admin-ganho');
        if (ganhoEl) {
            ganhoEl.textContent = fmt.currency(totalGanho) + ' total';
            ganhoEl.style.display = 'block';
        }

        this._renderCalendario('prof-cal-wrap');

        // Gráfico de ganhos
        const chartCard = document.getElementById('prof-chart-card');
        const chartTotal = document.getElementById('prof-chart-total');
        if (chartCard) {
            chartCard.style.display = 'block';
            if (chartTotal) chartTotal.textContent = fmt.currency(totalReal * 20) + ' total';
            this._renderChart('prof-ganhos-chart-admin', now.getFullYear());
        }
    },

    // ── NAVEGAÇÃO ────────────────────────────────────────────────

    _navMes(delta) {
        let { year, month } = this._mesAtual;
        month += delta;
        if (month < 0)  { month = 11; year -= 1; }
        if (month > 11) { month = 0;  year += 1; }
        this._mesAtual = { year, month };

        const statsEl = document.getElementById('prof-cal-stats');
        if (statsEl) {
            const navDate  = new Date(year, month, 1);
            const mesCount = this._contagemMes(year, month) + _ajusteMes(this._profInfo, navDate);
            const mesLabel = navDate.toLocaleDateString('pt-BR', { month: 'long' });
            statsEl.textContent = `${mesCount} aulas em ${mesLabel}  ·  ${this._profInfo?.saldo_aulas_dadas || this._relatorios.length} no total`;
        }

        this._renderCalendario('prof-cal-wrap');
    },

    // ── CONTADORES ───────────────────────────────────────────────

    _contagemMes(year, month) {
        return this._relatorios.filter(r => {
            const d = new Date(r.created_at);
            return d.getFullYear() === year && d.getMonth() === month;
        }).length;
    },

    _contagemAno(year) {
        return this._relatorios.filter(r => {
            return new Date(r.created_at).getFullYear() === year;
        }).length;
    },

    // ── CALENDÁRIO ───────────────────────────────────────────────

    _renderCalendario(wrapId) {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;

        const { year, month } = this._mesAtual;

        const MESES = [
            'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
        ];
        const SEMANA = ['D','S','T','Q','Q','S','S'];

        const aulasPerDay = {};
        this._relatorios.forEach(r => {
            const d = new Date(r.created_at);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const dia = d.getDate();
                aulasPerDay[dia] = (aulasPerDay[dia] || 0) + 1;
            }
        });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow    = new Date(year, month, 1).getDay(); // 0 = Dom

        const today = new Date();
        const isHoje = d =>
            today.getFullYear() === year &&
            today.getMonth()    === month &&
            today.getDate()     === d;

        let cells = '';
        for (let i = 0; i < firstDow; i++) {
            cells += '<div class="pcal-cell pcal-empty"></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const count   = aulasPerDay[d] || 0;
            const classes = ['pcal-cell'];
            if (isHoje(d))  classes.push('pcal-hoje');
            if (count > 0)  classes.push('pcal-tem-aula');
            cells += `<div class="${classes.join(' ')}">
                <span class="pcal-num">${d}</span>
                ${count > 0 ? `<span class="pcal-badge">${count}</span>` : ''}
            </div>`;
        }

        const mesCount = this._contagemMes(year, month);

        wrap.innerHTML = `
            <div class="pcal">
                <div class="pcal-nav">
                    <button class="pcal-nav-btn" onclick="Modules.Professores._navMes(-1)">&#8249;</button>
                    <div class="pcal-nav-center">
                        <span class="pcal-titulo">${MESES[month]} ${year}</span>
                        <span class="pcal-subtotais">${mesCount} aulas</span>
                    </div>
                    <button class="pcal-nav-btn" onclick="Modules.Professores._navMes(1)">&#8250;</button>
                </div>
                <div class="pcal-grid">
                    ${SEMANA.map(s => `<div class="pcal-dow">${s}</div>`).join('')}
                    ${cells}
                </div>
                <div class="pcal-legenda">
                    <span class="pcal-leg-aula"></span> dia com aula
                </div>
            </div>
        `;
    },

    // ── GRÁFICO DE GANHOS ────────────────────────────────────────

    _renderChart(canvasId, year) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;

        const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const now = new Date();
        const mesAtual = year === now.getFullYear() ? now.getMonth() : 11;

        // Conta aulas por mês só até o mês atual do ano
        const contagemMes = Array(12).fill(0);
        this._relatorios.forEach(r => {
            const d = new Date(r.created_at);
            if (d.getFullYear() === year) contagemMes[d.getMonth()]++;
        });

        // Acumula ganhos mês a mês (linha sobe continuamente)
        const labels = MESES_SHORT.slice(0, mesAtual + 1);
        let acc = 0;
        const cumulativo = contagemMes.slice(0, mesAtual + 1).map(c => {
            acc += c * 20;
            return acc;
        });

        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 110);
        grad.addColorStop(0, 'rgba(124,58,237,0.35)');
        grad.addColorStop(1, 'rgba(124,58,237,0)');

        canvas._chartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: cumulativo,
                    borderColor: 'rgba(124,58,237,1)',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: true,
                    backgroundColor: grad,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    y: { display: false },
                    x: { display: false }
                }
            }
        });

        return acc;
    }
};
