// ============================================================
// MÓDULO: INSIGHTS (admin) — painel de análise por aluno
// Protótipo: visão do aluno a partir do histórico de relatórios.
// ============================================================

Modules.Insights = {
    _alunoId: null,
    _allAlunos: [],

    // Mapas de escala ordinal → número (pro eixo Y dos gráficos de linha)
    _COMPORTAMENTO_SCALE: { ruim: 1, regular: 2, bom: 3, excelente: 4 },
    _COMPREENSAO_SCALE:   { baixa: 1, regular: 2, boa: 3, excelente: 4 },
    _COMPORTAMENTO_TICKS: { 1: 'Ruim', 2: 'Regular', 3: 'Bom', 4: 'Excelente' },
    _COMPREENSAO_TICKS:   { 1: 'Baixa', 2: 'Regular', 3: 'Boa', 4: 'Excelente' },

    // Rótulos de comportamento (mesmos textos e valores usados no módulo Relatórios,
    // ver js/modules/relatorios.js _COMP_LABELS — mantidos em sincronia manualmente)
    _COMP_LABELS: {
        excelente: 'Participou ativamente e demonstrou interesse',
        bom:       'Participou com engajamento moderado',
        regular:   'Precisou de estímulo para se concentrar',
        ruim:      'Mostrou desânimo ou distração'
    },

    // Tags de habilidades (mesma origem de dados do módulo Relatórios)
    _TAG_LABELS: {
        // comportamentos (legado, campo habilidades.comportamentos)
        participou:    'Participou ativamente',
        interesse:     'Interesse e curiosidade',
        estimulo:      'Precisou de estímulo',
        desanimo:      'Desânimo/distração',
        // acadêmicas
        escrita:       'Escrita e ortografia',
        leitura:       'Leitura e interpretação',
        raciocinio:    'Raciocínio lógico/cálculo',
        organizacao:   'Organização e método',
        // socioemocionais
        atencao:       'Atenção e foco',
        autoconfianca: 'Autoconfiança',
        comunicacao:   'Comunicação e expressão'
    },

    async render() {
        if (!Auth.can('admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Insights</h1>
                <span class="page-subtitle">Painel de análise por aluno — baseado no histórico de relatórios</span>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-body" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                    <label class="form-label" for="insights-aluno-select" style="margin:0;">Aluno</label>
                    <select class="input" id="insights-aluno-select" style="max-width:320px;" onchange="Modules.Insights._onAlunoChange(this.value)">
                        <option value="">Selecione um aluno...</option>
                    </select>

                    <span style="width:1px;height:24px;background:var(--color-border);"></span>

                    <label class="form-label" style="margin:0;">Período</label>
                    <input type="date" class="input" id="insights-periodo-inicio" style="max-width:150px;"
                        onchange="Modules.Insights._onPeriodoChange()" />
                    <span class="text-muted small">até</span>
                    <input type="date" class="input" id="insights-periodo-fim" style="max-width:150px;"
                        onchange="Modules.Insights._onPeriodoChange()" />

                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Insights._setPeriodoPreset(30)">30 dias</button>
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Insights._setPeriodoPreset(90)">90 dias</button>
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Insights._setPeriodoPreset(0)">Tudo</button>
                    </div>
                </div>
            </div>

            <div id="insights-body">
                ${emptyState('Selecione um aluno para gerar o painel')}
            </div>
        `);

        const { data: alunos } = await supabase
            .from('usuarios').select('id,nome').eq('role', 'aluno').eq('ativo', true).order('nome');
        this._allAlunos = alunos || [];

        const sel = document.getElementById('insights-aluno-select');
        if (sel) {
            sel.innerHTML = `<option value="">Selecione um aluno...</option>` +
                this._allAlunos.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join('');
        }
    },

    async _onAlunoChange(alunoId) {
        this._alunoId = alunoId || null;
        const body = document.getElementById('insights-body');
        if (!body) return;

        if (!this._alunoId) {
            body.innerHTML = emptyState('Selecione um aluno para gerar o painel');
            return;
        }

        body.innerHTML = '<div class="loader-inline"></div>';

        const [
            { data: relatorios, error },
            { data: atividades, error: atError },
            { data: respostas, error: respError }
        ] = await Promise.all([
            supabase.from('relatorios')
                .select(`id, created_at, comportamento, compreensao, meta_atingida, retomar_conteudo,
                    habilidades, sem_aluno, disciplina_ministrada,
                    motivo_meta_nao_atingida, assunto_pendente, assunto_pendente_resolvido,
                    professor:usuarios!relatorios_professor_id_fkey(nome)`)
                .eq('aluno_id', this._alunoId)
                .order('created_at', { ascending: true }),
            // Só "lista de exercícios" conta como atividade de casa — slides são material
            // de fixação e não pedem resposta do aluno (ver Modules.Atividades).
            supabase.from('atividades')
                .select('id, created_at')
                .eq('aluno_id', this._alunoId)
                .eq('tipo_material', 'lista_exercicios')
                .order('created_at', { ascending: true }),
            supabase.from('respostas_atividades')
                .select('atividade_id')
                .eq('aluno_id', this._alunoId)
        ]);

        const erro = error || atError || respError;
        if (erro) { body.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(erro.message)}</p>`; return; }

        if (!relatorios?.length) {
            body.innerHTML = emptyState('Esse aluno ainda não tem nenhum relatório registrado');
            return;
        }

        this._relatoriosRaw  = relatorios;
        this._atividadesRaw  = atividades || [];
        this._respondidasSet = new Set((respostas || []).map(r => r.atividade_id));

        const iniEl = document.getElementById('insights-periodo-inicio');
        const fimEl = document.getElementById('insights-periodo-fim');
        if (iniEl) iniEl.value = '';
        if (fimEl) fimEl.value = '';
        this._periodoInicio = '';
        this._periodoFim    = '';

        this._aplicarFiltros();
    },

    // ── Filtro de período (aplicado a todas as métricas, exceto a lista
    // de "assuntos pendentes", que sempre mostra tudo que ainda está em aberto) ──
    _dentroPeriodo(dataStr) {
        if (!dataStr) return false;
        const d = dataStr.substring(0, 10);
        if (this._periodoInicio && d < this._periodoInicio) return false;
        if (this._periodoFim && d > this._periodoFim) return false;
        return true;
    },

    _onPeriodoChange() {
        this._periodoInicio = document.getElementById('insights-periodo-inicio')?.value || '';
        this._periodoFim    = document.getElementById('insights-periodo-fim')?.value || '';
        this._aplicarFiltros();
    },

    _setPeriodoPreset(dias) {
        const iniEl = document.getElementById('insights-periodo-inicio');
        const fimEl = document.getElementById('insights-periodo-fim');
        if (dias === 0) {
            if (iniEl) iniEl.value = '';
            if (fimEl) fimEl.value = '';
        } else {
            const fim = new Date();
            const ini = new Date();
            ini.setDate(ini.getDate() - dias);
            if (iniEl) iniEl.value = ini.toISOString().substring(0, 10);
            if (fimEl) fimEl.value = fim.toISOString().substring(0, 10);
        }
        this._onPeriodoChange();
    },

    _aplicarFiltros() {
        const body = document.getElementById('insights-body');
        if (!body || !this._alunoId) return;

        const relatorios = (this._relatoriosRaw || []).filter(r => this._dentroPeriodo(r.created_at));
        const atividades = (this._atividadesRaw || []).filter(a => this._dentroPeriodo(a.created_at));

        if (!relatorios.length && !atividades.length) {
            body.innerHTML = emptyState('Nenhum dado registrado nesse período');
            return;
        }

        this._relatorios = relatorios;
        this._renderPainel(body, relatorios, atividades);
    },

    // ── Monta o painel completo ─────────────────────────────────
    _renderPainel(body, relatorios, atividades) {
        atividades = atividades || [];

        const avaliados   = relatorios.filter(r => !r.sem_aluno);
        const totalAulas  = relatorios.length;
        const totalFaltas = relatorios.filter(r => r.sem_aluno).length;
        const compareceu  = totalAulas - totalFaltas;
        const taxaComparecimento = totalAulas ? Math.round((compareceu / totalAulas) * 100) : 0;

        const metaSim = avaliados.filter(r => r.meta_atingida === 'sim').length;
        const metaParcial = avaliados.filter(r => r.meta_atingida === 'parcialmente').length;
        const metaNao = avaliados.filter(r => r.meta_atingida === 'nao').length;
        const totalMeta = metaSim + metaParcial + metaNao;
        const taxaMetaSim = totalMeta ? Math.round((metaSim / totalMeta) * 100) : 0;

        const totalRetomar = avaliados.filter(r => r.retomar_conteudo === true).length;
        const baseRetomar  = avaliados.filter(r => r.retomar_conteudo !== null && r.retomar_conteudo !== undefined).length;
        const taxaRetomar  = baseRetomar ? Math.round((totalRetomar / baseRetomar) * 100) : 0;

        // Comportamento em aulas — aulas "sem aluno" gravam comportamento fixo
        // ('regular') como valor de preenchimento obrigatório e não refletem
        // comportamento real, por isso usamos só `avaliados` (sem_aluno=false) aqui.
        const compExcelente = avaliados.filter(r => r.comportamento === 'excelente').length;
        const compBom       = avaliados.filter(r => r.comportamento === 'bom').length;
        const compRegular   = avaliados.filter(r => r.comportamento === 'regular').length;
        const compRuim      = avaliados.filter(r => r.comportamento === 'ruim').length;
        const totalComportamento = compExcelente + compBom + compRegular + compRuim;

        const totalAtividades = atividades.length;
        const respondidas     = atividades.filter(a => this._respondidasSet?.has(a.id)).length;
        const pendentesAtiv   = totalAtividades - respondidas;

        const primeiraData = relatorios[0]?.created_at;
        const ultimaData   = relatorios[relatorios.length - 1]?.created_at;

        body.innerHTML = `
            <p class="text-muted small" style="margin-bottom:16px;">
                ${totalAulas
                    ? `${totalAulas} aula${totalAulas !== 1 ? 's' : ''} registrada${totalAulas !== 1 ? 's' : ''}
                       — de ${fmt.date(primeiraData.substring(0,10))} a ${fmt.date(ultimaData.substring(0,10))}`
                    : 'Nenhuma aula registrada nesse período'}
            </p>

            <div class="stats-grid" style="margin-bottom:20px;">
                ${this._statCard('Total de Aulas', totalAulas, '📅', 'stat-purple')}
                ${this._statCard('Comparecimento', taxaComparecimento + '%', '✅', 'stat-teal')}
                ${this._statCard('Meta Atingida (sim)', taxaMetaSim + '%', '🎯', 'stat-green')}
                ${this._statCard('Precisou Retomar', taxaRetomar + '%', '🔁', 'stat-gold')}
            </div>

            <div class="insights-chart-grid">
                <div class="card">
                    <div class="card-header"><h3>Evolução da Compreensão</h3></div>
                    <div class="card-body"><div class="insights-chart-wrap"><canvas id="insights-chart-compreensao"></canvas></div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Evolução do Comportamento</h3></div>
                    <div class="card-body"><div class="insights-chart-wrap"><canvas id="insights-chart-comportamento"></canvas></div></div>
                </div>
            </div>

            <div class="insights-chart-grid" style="margin-top:16px;">
                <div class="card">
                    <div class="card-header"><h3>Meta da Aula Atingida</h3></div>
                    <div class="card-body">
                        ${totalMeta
                            ? `<div class="insights-chart-wrap"><canvas id="insights-chart-meta"></canvas></div>`
                            : emptyState('Sem dados de meta registrados')}
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Habilidades Mais Observadas</h3></div>
                    <div class="card-body">
                        <div class="insights-chart-wrap"><canvas id="insights-chart-habilidades"></canvas></div>
                    </div>
                </div>
            </div>

            <div class="insights-chart-grid" style="margin-top:16px;">
                <div class="card">
                    <div class="card-header"><h3>Comparecimento</h3></div>
                    <div class="card-body">
                        ${totalAulas
                            ? `<div class="insights-chart-wrap"><canvas id="insights-chart-comparecimento"></canvas></div>`
                            : emptyState('Sem aulas no período')}
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Resolução de Atividades de Casa</h3></div>
                    <div class="card-body">
                        ${totalAtividades
                            ? `<div class="insights-chart-wrap"><canvas id="insights-chart-atividades"></canvas></div>`
                            : emptyState('Nenhuma lista de exercícios enviada no período')}
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-header"><h3>Comportamento em Aulas</h3></div>
                <div class="card-body">
                    ${totalComportamento
                        ? `<div class="insights-chart-wrap insights-chart-wrap-tall"><canvas id="insights-chart-comportamento-dist"></canvas></div>
                           <div id="insights-comportamento-detalhe" class="insights-detalhe-lista"></div>`
                        : emptyState('Sem aulas avaliadas no período')}
                </div>
            </div>

            <div class="card" id="insights-assuntos-card" style="margin-top:16px;border-left:3px solid var(--color-yellow, #ca8a04);">
                <div class="card-header"><h3>📌 Assuntos que o Aluno Precisa Retomar</h3></div>
                <div class="card-body" id="insights-assuntos-body"></div>
            </div>
        `;

        this._renderLineChart('insights-chart-compreensao', avaliados, 'compreensao', this._COMPREENSAO_SCALE, this._COMPREENSAO_TICKS, '#7c3aed');
        this._renderLineChart('insights-chart-comportamento', avaliados, 'comportamento', this._COMPORTAMENTO_SCALE, this._COMPORTAMENTO_TICKS, '#0d9488');
        if (totalMeta) this._renderMetaChart('insights-chart-meta', metaSim, metaParcial, metaNao);
        this._renderHabilidadesChart('insights-chart-habilidades', avaliados);
        if (totalAulas) this._renderComparecimentoChart('insights-chart-comparecimento', compareceu, totalFaltas);
        if (totalAtividades) this._renderAtividadesChart('insights-chart-atividades', respondidas, pendentesAtiv);
        if (totalComportamento) {
            this._renderComportamentoDistChart('insights-chart-comportamento-dist', compExcelente, compBom, compRegular, compRuim);
            this._renderComportamentoDetalhe(avaliados);
        }
        this._renderAssuntosPendentes();
    },

    // ── Assuntos pendentes de retomada ──────────────────────────
    // Sempre usa o histórico completo (this._relatoriosRaw), ignorando o filtro
    // de período: um assunto pendente de meses atrás continua pendente hoje.
    _renderAssuntosPendentes() {
        const container = document.getElementById('insights-assuntos-body');
        if (!container) return;

        const pendentes = (this._relatoriosRaw || [])
            .filter(r => r.assunto_pendente && !r.assunto_pendente_resolvido)
            .sort((a, b) => a.created_at.localeCompare(b.created_at));

        if (!pendentes.length) {
            container.innerHTML = emptyState('Nenhum assunto pendente — tudo em dia!');
            return;
        }

        container.innerHTML = pendentes.map(r => `
            <div class="insights-assunto-item">
                <div class="insights-assunto-info">
                    <div class="insights-assunto-titulo">${escapeHtml(r.assunto_pendente)}</div>
                    <div class="insights-assunto-meta">
                        Aula de ${fmt.date(r.created_at.substring(0,10))} com ${escapeHtml((r.professor && r.professor.nome) || '—')}
                        ${r.disciplina_ministrada ? ' · ' + escapeHtml(r.disciplina_ministrada) : ''}
                    </div>
                    ${r.motivo_meta_nao_atingida ? `<div class="insights-assunto-motivo">"${escapeHtml(r.motivo_meta_nao_atingida)}"</div>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="Modules.Insights.marcarAssuntoRetomado('${r.id}')">✅ Assunto Retomado</button>
            </div>
        `).join('');
    },

    async marcarAssuntoRetomado(relatorioId) {
        const confirmed = await confirmAction('Confirma que esse assunto já foi retomado com o aluno em uma aula posterior?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('relatorios')
            .update({ assunto_pendente_resolvido: true, assunto_pendente_resolvido_em: new Date().toISOString() })
            .eq('id', relatorioId);

        if (error) return showToast(error.message, 'error');

        const r = (this._relatoriosRaw || []).find(r => r.id === relatorioId);
        if (r) r.assunto_pendente_resolvido = true;

        showToast('Assunto marcado como retomado', 'success');
        this._renderAssuntosPendentes();
    },

    _statCard(label, value, icon, cls) {
        return `
            <div class="stat-card ${cls}">
                <div class="stat-icon">${icon}</div>
                <div class="stat-body">
                    <div class="stat-value">${escapeHtml(String(value))}</div>
                    <div class="stat-label">${escapeHtml(label)}</div>
                </div>
            </div>
        `;
    },

    // ── Gráfico de linha (compreensão / comportamento ao longo do tempo) ──
    _renderLineChart(canvasId, rows, field, scale, ticks, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;

        const pontos = rows
            .filter(r => r[field] && scale[r[field]] !== undefined)
            .map(r => ({
                x: fmt.date(r.created_at.substring(0, 10)),
                y: scale[r[field]]
            }));

        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }
        if (!pontos.length) return;

        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 200);
        grad.addColorStop(0, color + '3d');
        grad.addColorStop(1, color + '00');

        canvas._chartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels: pontos.map(p => p.x),
                datasets: [{
                    data: pontos.map(p => p.y),
                    borderColor: color,
                    backgroundColor: grad,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: color,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ticks[ctx.parsed.y] || ctx.parsed.y
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0.5, max: 4.5,
                        ticks: {
                            stepSize: 1,
                            callback: (v) => ticks[v] || ''
                        },
                        grid: { color: 'rgba(0,0,0,.05)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                    }
                }
            }
        });
    },

    // ── Donut: meta atingida (paleta de status, sempre com legenda/label) ──
    _renderMetaChart(canvasId, sim, parcial, nao) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [`✅ Sim (${sim})`, `⚠️ Parcialmente (${parcial})`, `❌ Não (${nao})`],
                datasets: [{
                    data: [sim, parcial, nao],
                    backgroundColor: ['#0ca30c', '#fab219', '#d03b3b'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } }
                }
            }
        });
    },

    // ── Barra horizontal: frequência de tags de habilidades ──
    _renderHabilidadesChart(canvasId, rows) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const freq = {};
        rows.forEach(r => {
            const h = r.habilidades || {};
            const tags = [...(h.comportamentos || []), ...(h.academicas || []), ...(h.socioemocionais || [])];
            tags.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
        });

        const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);

        if (!entries.length) {
            canvas.parentElement.innerHTML = emptyState('Nenhuma tag de habilidade registrada ainda');
            return;
        }

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: entries.map(([k]) => this._TAG_LABELS[k] || k),
                datasets: [{
                    data: entries.map(([, v]) => v),
                    backgroundColor: '#7c3aed',
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { stepSize: 1, precision: 0 }, grid: { color: 'rgba(0,0,0,.05)' } },
                    y: { grid: { display: false } }
                }
            }
        });
    },

    // ── Donut: comparecimento (compareceu vs faltou) ──
    _renderComparecimentoChart(canvasId, compareceu, faltou) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [`✅ Compareceu (${compareceu})`, `❌ Faltou (${faltou})`],
                datasets: [{
                    data: [compareceu, faltou],
                    backgroundColor: ['#0d9488', '#d03b3b'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } }
            }
        });
    },

    // ── Donut: atividades de casa (lista de exercícios) respondidas vs pendentes ──
    _renderAtividadesChart(canvasId, respondidas, pendentes) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [`✅ Respondidas (${respondidas})`, `❌ Pendentes (${pendentes})`],
                datasets: [{
                    data: [respondidas, pendentes],
                    backgroundColor: ['#0d9488', '#d03b3b'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } }
            }
        });
    },

    // ── Barra horizontal: distribuição de comportamento em aulas ──
    _renderComportamentoDistChart(canvasId, excelente, bom, regular, ruim) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [
                    `✅ ${this._COMP_LABELS.excelente} (${excelente})`,
                    `🙂 ${this._COMP_LABELS.bom} (${bom})`,
                    `😐 ${this._COMP_LABELS.regular} (${regular})`,
                    `😞 ${this._COMP_LABELS.ruim} (${ruim})`
                ],
                datasets: [{
                    data: [excelente, bom, regular, ruim],
                    backgroundColor: ['#0d9488', '#2563eb', '#f59e0b', '#d03b3b'],
                    borderRadius: 4,
                    barThickness: 20
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { stepSize: 1, precision: 0 }, grid: { color: 'rgba(0,0,0,.05)' } },
                    y: { grid: { display: false } }
                }
            }
        });
    },

    // ── Lista: detalhamento de comportamento por aula (dia, professor, disciplina) ──
    // Atende ao pedido de "sinalizar o dia em que essa métrica foi gerada, a aula e o professor".
    _renderComportamentoDetalhe(avaliados) {
        const container = document.getElementById('insights-comportamento-detalhe');
        if (!container) return;

        const ICONS = { excelente: '✅', bom: '🙂', regular: '😐', ruim: '😞' };

        const lista = avaliados
            .filter(r => this._COMP_LABELS[r.comportamento])
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at));

        if (!lista.length) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="insights-detalhe-titulo">Detalhamento por aula</div>
            ${lista.map(r => `
                <div class="insights-detalhe-item">
                    <span class="insights-detalhe-icone">${ICONS[r.comportamento] || ''}</span>
                    <div class="insights-detalhe-info">
                        <div class="insights-detalhe-cat">${escapeHtml(this._COMP_LABELS[r.comportamento])}</div>
                        <div class="insights-detalhe-meta">
                            ${fmt.date(r.created_at.substring(0, 10))} · Prof. ${escapeHtml((r.professor && r.professor.nome) || '—')}
                            ${r.disciplina_ministrada ? ' · ' + escapeHtml(r.disciplina_ministrada) : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    }
};
