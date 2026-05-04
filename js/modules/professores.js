// ============================================================
// MÓDULO: PROFESSORES — Métricas + Calendário de aulas
// ============================================================

Modules.Professores = {
    _profId:     null,
    _profNome:   '',
    _mesAtual:   null,   // { year: Number, month: Number }  (month 0-indexed)
    _relatorios: [],     // { created_at } do professor selecionado / logado
    _todosProfs: [],

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

        const now = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };

        const total    = this._relatorios.length;
        const mesCount = this._contagemMes(now.getFullYear(), now.getMonth());
        const anoCount = this._contagemAno(now.getFullYear());
        const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const totalGanho = total * 20;
        const anoGanho   = anoCount * 20;

        document.getElementById('prof-wrap').innerHTML = `
            <div class="stats-grid stats-grid-3" style="margin-bottom:20px">
                <div class="stat-card stat-purple">
                    <div class="stat-icon">📅</div>
                    <div>
                        <div class="stat-value">${mesCount}</div>
                        <div class="stat-label">Aulas em ${mesLabel}</div>
                    </div>
                </div>
                <div class="stat-card stat-teal">
                    <div class="stat-icon">📆</div>
                    <div>
                        <div class="stat-value">${anoCount}</div>
                        <div class="stat-label">Aulas em ${now.getFullYear()}</div>
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
                    <h3 style="font-size:.85rem">Ganhos — ${now.getFullYear()}</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <span class="prof-ganho-badge">Ano: <strong>${fmt.currency(anoGanho)}</strong></span>
                        <span class="prof-ganho-badge prof-ganho-total">Total: <strong>${fmt.currency(totalGanho)}</strong></span>
                    </div>
                </div>
                <div class="card-body" style="padding:10px 16px;height:130px">
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
        const { data: profs, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, ativo, professores_info(materia, chave_pix)')
            .eq('role', 'professor')
            .order('nome');

        if (error) {
            document.getElementById('prof-list-wrap').innerHTML =
                `<p class="text-danger" style="padding:16px">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!profs || profs.length === 0) {
            document.getElementById('prof-list-wrap').innerHTML = emptyState('Nenhum professor cadastrado');
            return;
        }

        const now = new Date();
        const { data: rels } = await supabase
            .from('relatorios')
            .select('professor_id, created_at');

        const cTotal = {};
        const cMes   = {};
        const cAno   = {};
        (rels || []).forEach(r => {
            const pid = r.professor_id;
            const d = new Date(r.created_at);
            cTotal[pid] = (cTotal[pid] || 0) + 1;
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                cMes[pid] = (cMes[pid] || 0) + 1;
            }
            if (d.getFullYear() === now.getFullYear()) {
                cAno[pid] = (cAno[pid] || 0) + 1;
            }
        });

        this._todosProfs = profs.map(p => ({
            ...p,
            total:     cTotal[p.id] || 0,
            mes:       cMes[p.id]   || 0,
            ano:       cAno[p.id]   || 0,
            materia:   p.professores_info?.[0]?.materia   || '—',
            chave_pix: p.professores_info?.[0]?.chave_pix || '—'
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
        const anoLabel = String(now.getFullYear());

        wrap.innerHTML = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Professor</th>
                            <th>Matéria</th>
                            <th>Chave PIX</th>
                            <th>${mesLabel}</th>
                            <th>${anoLabel}</th>
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
                                <td><span class="metric-ano">${p.ano}</span></td>
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

        const { data } = await supabase
            .from('relatorios')
            .select('created_at')
            .eq('professor_id', profId)
            .order('created_at', { ascending: false });

        this._profId     = profId;
        this._profNome   = profNome;
        this._relatorios = data || [];

        const now = new Date();
        this._mesAtual = { year: now.getFullYear(), month: now.getMonth() };

        if (statsEl) {
            const anoCount = this._contagemAno(now.getFullYear());
            const mesCount = this._contagemMes(now.getFullYear(), now.getMonth());
            const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' });
            statsEl.textContent = `${mesCount} aulas em ${mesLabel}  ·  ${anoCount} em ${now.getFullYear()}  ·  ${this._relatorios.length} no total`;
        }

        const totalGanho = this._relatorios.length * 20;
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
            const anoCount = this._contagemAno(now.getFullYear());
            if (chartTotal) chartTotal.textContent = 'Total ' + now.getFullYear() + ': ' + fmt.currency(anoCount * 20);
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
            const mesCount = this._contagemMes(year, month);
            const anoCount = this._contagemAno(year);
            const mesLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long' });
            statsEl.textContent = `${mesCount} aulas em ${mesLabel}  ·  ${anoCount} em ${year}  ·  ${this._relatorios.length} no total`;
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
        const anoCount = this._contagemAno(year);

        wrap.innerHTML = `
            <div class="pcal">
                <div class="pcal-nav">
                    <button class="pcal-nav-btn" onclick="Modules.Professores._navMes(-1)">&#8249;</button>
                    <div class="pcal-nav-center">
                        <span class="pcal-titulo">${MESES[month]} ${year}</span>
                        <span class="pcal-subtotais">${mesCount} aulas · ${anoCount} no ano</span>
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

        const contagemMes = Array(12).fill(0);
        this._relatorios.forEach(r => {
            const d = new Date(r.created_at);
            if (d.getFullYear() === year) {
                contagemMes[d.getMonth()]++;
            }
        });

        const valores = contagemMes.map(c => c * 20);
        const totalAno = valores.reduce((a, b) => a + b, 0);

        // Destrói instância anterior se existir
        if (canvas._chartInst) {
            canvas._chartInst.destroy();
            canvas._chartInst = null;
        }

        canvas._chartInst = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: MESES_SHORT,
                datasets: [{
                    label: 'Ganhos (R$)',
                    data: valores,
                    backgroundColor: contagemMes.map((_, i) => {
                        const now = new Date();
                        return i === now.getMonth() && year === now.getFullYear()
                            ? 'rgba(124,58,237,1)'
                            : 'rgba(124,58,237,0.55)';
                    }),
                    borderColor: 'rgba(124,58,237,0.8)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const aulas = contagemMes[ctx.dataIndex];
                                return `${aulas} aula${aulas !== 1 ? 's' : ''} · R$ ${ctx.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 10 },
                            callback: v => 'R$' + v.toFixed(0)
                        },
                        grid: { color: 'rgba(0,0,0,.05)' }
                    },
                    x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });

        return totalAno;
    }
};
