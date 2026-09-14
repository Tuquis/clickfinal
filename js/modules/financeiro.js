// ============================================================
// MÓDULO: FINANCEIRO (admin) — catálogo de pacotes (nome + valor),
// controle de pagamento dos alunos (forma + status do mês),
// despesas (fixas/pontuais) e finanças dos professores.
// Pacote/vencimento do aluno são editados no modal de Usuários;
// forma de pagamento e status "pago" são editados aqui mesmo.
// ============================================================

Modules.Financeiro = {
    _CATEGORIAS_DESPESA: {
        aluguel: 'Aluguel', ferramentas: 'Ferramentas/Software', marketing: 'Marketing',
        impostos: 'Impostos', salarios: 'Salários/Freelas', outros: 'Outros'
    },

    async render() {
        if (!Auth.can('admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Financeiro</h1>
                <div id="fin-header-actions"></div>
            </div>

            <div class="tabs-bar">
                <button class="tab-btn active" id="fin-tab-btn-geral"       onclick="Modules.Financeiro._setFinTab('geral')">Visão Geral</button>
                <button class="tab-btn"        id="fin-tab-btn-alunos"      onclick="Modules.Financeiro._setFinTab('alunos')">Alunos</button>
                <button class="tab-btn"        id="fin-tab-btn-despesas"    onclick="Modules.Financeiro._setFinTab('despesas')">Despesas</button>
                <button class="tab-btn"        id="fin-tab-btn-pacotes"     onclick="Modules.Financeiro._setFinTab('pacotes')">Pacotes</button>
                <button class="tab-btn"        id="fin-tab-btn-professores" onclick="Modules.Financeiro._setFinTab('professores')">Professores</button>
            </div>

            <div id="fin-tab-geral" class="fin-tab-content">
                <div class="card mb-3">
                    <div class="card-header">
                        <h3>💳 Saldo em Conta</h3>
                        <div class="action-btns">
                            <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.verHistoricoAjustes()">Histórico de ajustes</button>
                            <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.abrirAjusteSaldo()">Ajustar Saldo</button>
                        </div>
                    </div>
                    <div class="card-body" id="financeiro-saldo-conta-body">
                        <div class="loader-inline"></div>
                    </div>
                </div>

                <div class="stats-grid" id="financeiro-geral-stats" style="margin-bottom:16px;">
                    <div class="loader-inline"></div>
                </div>

                <div class="card mb-3">
                    <div class="card-header"><h3>Pendências</h3></div>
                    <div class="card-body" id="financeiro-geral-pendencias">
                        <div class="loader-inline"></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>Saldo mensal — últimos 6 meses</h3></div>
                    <div class="card-body">
                        <div class="insights-chart-wrap fin-chart-wrap">
                            <canvas id="fin-chart-fluxo"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL AJUSTAR SALDO EM CONTA -->
            <div class="modal-overlay" id="modal-ajuste-saldo">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Ajustar Saldo em Conta</h3>
                        <button class="modal-close" onclick="closeModal('modal-ajuste-saldo')">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small" style="margin-bottom:12px">
                            Use pra corrigir o saldo calculado quando ele não bater com o extrato real do banco
                            (ex: saldo inicial ao migrar pro sistema, dinheiro fora do sistema, taxa não prevista).
                            Fica registrado com motivo e data, sem apagar nada.
                        </p>
                        <div class="form-group">
                            <label class="form-label">Valor do ajuste (R$) *</label>
                            <input type="number" class="input" id="aj-valor" placeholder="Use negativo pra reduzir o saldo" step="0.01" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Motivo *</label>
                            <textarea class="input textarea" id="aj-motivo" rows="2" placeholder="Ex: Saldo inicial ao migrar pro sistema"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-ajuste-saldo')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-salvar-ajuste" onclick="Modules.Financeiro.salvarAjusteSaldo()">Salvar Ajuste</button>
                    </div>
                </div>
            </div>

            <div id="fin-tab-alunos" class="fin-tab-content" style="display:none">
                <div class="card">
                    <div class="card-header"><h3>Alunos — Pacote, Vencimento e Pagamento</h3></div>
                    <div class="card-body">
                        <div class="stats-grid" id="financeiro-alunos-stats" style="margin-bottom:16px;"></div>
                        <div id="financeiro-alunos-list">
                            <div class="loader-inline"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="fin-tab-despesas" class="fin-tab-content" style="display:none">
                <div class="card">
                    <div class="card-header"><h3>Despesas</h3></div>
                    <div class="card-body">
                        <div class="stats-grid" id="financeiro-despesas-stats" style="margin-bottom:16px;"></div>
                        <div id="financeiro-despesas-list">
                            <div class="loader-inline"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="fin-tab-pacotes" class="fin-tab-content" style="display:none">
                <div class="card">
                    <div class="card-header"><h3>Pacotes</h3></div>
                    <div class="card-body" id="financeiro-list">
                        <div class="loader-inline"></div>
                    </div>
                </div>
            </div>

            <div id="fin-tab-professores" class="fin-tab-content" style="display:none">
                <div class="card">
                    <div class="card-header">
                        <h3>Finanças dos Professores</h3>
                        <span id="financeiro-professores-total" style="font-size:.95rem;font-weight:700;color:var(--color-primary)"></span>
                    </div>
                    <div class="card-body" id="financeiro-professores-list">
                        <div class="loader-inline"></div>
                    </div>
                </div>
            </div>

            <!-- MODAL CONFIRMAR PAGAMENTO (aluno) -->
            <div class="modal-overlay" id="modal-marcar-pago">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Confirmar Pagamento</h3>
                        <button class="modal-close" onclick="closeModal('modal-marcar-pago')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="mp-aluno-id" />
                        <input type="hidden" id="mp-forma" />
                        <input type="hidden" id="mp-valor-pacote-num" />
                        <p style="margin-bottom:4px">Aluno: <strong id="mp-aluno-nome"></strong></p>
                        <p style="margin-bottom:16px">
                            Valor do pacote: <strong id="mp-valor-pacote-display"></strong> — <span id="mp-forma-label"></span>
                        </p>

                        <div class="form-group" id="mp-ajuste-group" style="display:none">
                            <label class="radio-item">
                                <input type="checkbox" id="mp-ajustar" onchange="Modules.Financeiro._onAjustarValorChange(this.checked)" />
                                O valor recebido foi diferente? (taxa da maquininha/recebedor de cartão)
                            </label>
                            <input type="number" class="input" id="mp-valor-ajustado" style="margin-top:8px;display:none" min="0" step="0.01" />
                        </div>

                        <div class="form-group" id="mp-repasse-group" style="display:none">
                            <label class="form-label">Data prevista de repasse (opcional)</label>
                            <input type="date" class="input" id="mp-data-repasse" />
                            <p class="text-muted small" style="margin-top:4px">
                                Pagamento no cartão geralmente demora alguns dias pra cair na conta.
                                Até essa data, o valor entra como "a receber" no Saldo em Conta, não como disponível.
                            </p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-marcar-pago')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-confirmar-pago" onclick="Modules.Financeiro.confirmarMarcarPago()">Confirmar Pagamento</button>
                    </div>
                </div>
            </div>

            <!-- MODAL CRIAR/EDITAR DESPESA -->
            <div class="modal-overlay" id="modal-despesa">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3 id="modal-despesa-title">Nova Despesa</h3>
                        <button class="modal-close" onclick="closeModal('modal-despesa')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="desp-id" />
                        <div class="form-group">
                            <label class="form-label">Descrição *</label>
                            <input type="text" class="input" id="desp-descricao" placeholder="Ex: Aluguel da sala" />
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Categoria *</label>
                                <select class="input" id="desp-categoria">
                                    ${Object.entries(this._CATEGORIAS_DESPESA).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Valor (R$) *</label>
                                <input type="number" class="input" id="desp-valor" placeholder="0,00" min="0" step="0.01" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Forma de Pagamento</label>
                            <select class="input" id="desp-forma-pagamento">
                                <option value="pix">💠 Pix</option>
                                <option value="cartao">💳 Cartão</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="radio-item">
                                <input type="checkbox" id="desp-recorrente" onchange="Modules.Financeiro._onRecorrenteChange(this.checked)" />
                                Despesa recorrente (repete todo mês)
                            </label>
                        </div>
                        <div class="form-group" id="desp-dia-vencimento-group">
                            <label class="form-label">Dia do Vencimento (todo mês) *</label>
                            <input type="number" class="input" id="desp-dia-vencimento" placeholder="Ex: 5" min="1" max="31" />
                        </div>
                        <div class="form-group" id="desp-data-vencimento-group" style="display:none">
                            <label class="form-label">Data de Vencimento *</label>
                            <input type="date" class="input" id="desp-data-vencimento" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-despesa')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-despesa" onclick="Modules.Financeiro.saveDespesa()">Salvar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL CRIAR/EDITAR PACOTE -->
            <div class="modal-overlay" id="modal-pacote">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3 id="modal-pacote-title">Novo Pacote</h3>
                        <button class="modal-close" onclick="closeModal('modal-pacote')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="pac-id" />
                        <div class="form-group">
                            <label class="form-label">Nome do Pacote *</label>
                            <input type="text" class="input" id="pac-nome" placeholder="Ex: Pacote Mensal 4 aulas" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Valor (R$) *</label>
                            <input type="number" class="input" id="pac-valor" placeholder="0,00" min="0" step="0.01" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-pacote')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-pacote" onclick="Modules.Financeiro.save()">Salvar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL HISTÓRICO DE PAGAMENTOS -->
            <div class="modal-overlay" id="modal-historico-pagamentos">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3 id="modal-historico-title">Histórico de Pagamentos</h3>
                        <button class="modal-close" onclick="closeModal('modal-historico-pagamentos')">×</button>
                    </div>
                    <div class="modal-body" id="modal-historico-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-historico-pagamentos')">Fechar</button>
                    </div>
                </div>
            </div>
        `);

        this._setFinTab('geral');
        await Promise.all([
            this.loadList(), this.loadAlunosList(), this.loadDespesas(),
            this.loadFinancasProfessores(), this.loadVisaoGeral(), this.loadSaldoConta()
        ]);
    },

    // Todas as seções já são carregadas no render() — trocar de aba só
    // mostra/esconde, sem refazer nenhuma consulta.
    _finTabActions: {
        geral:       '<button class="btn btn-secondary" onclick="Modules.Financeiro.exportarCSV()">📄 Exportar CSV</button>',
        alunos:      '',
        despesas:    '<button class="btn btn-primary" onclick="Modules.Financeiro.openCreateDespesa()">+ Nova Despesa</button>',
        pacotes:     '<button class="btn btn-primary" onclick="Modules.Financeiro.openCreate()">+ Novo Pacote</button>',
        professores: ''
    },

    _setFinTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('fin-tab-btn-' + tab)?.classList.add('active');

        ['geral', 'alunos', 'despesas', 'pacotes', 'professores'].forEach(t => {
            const el = document.getElementById('fin-tab-' + t);
            if (el) el.style.display = t === tab ? 'block' : 'none';
        });

        const actionsEl = document.getElementById('fin-header-actions');
        if (actionsEl) actionsEl.innerHTML = this._finTabActions[tab] || '';
    },

    // Primeiro dia do mês atual em 'YYYY-MM-DD' — é assim que mes_referencia
    // é gravado em pagamentos_alunos (uma linha por aluno por mês, nunca sobrescrita).
    _mesReferenciaAtual() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    },

    // Lista de 'YYYY-MM-01' dos últimos n meses (o atual incluso, por último).
    _ultimosMeses(n) {
        const hoje = new Date();
        const meses = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
        }
        return meses;
    },

    // Conjunto de aluno_id que já têm pagamento registrado no mês atual.
    // Fonte de verdade agora é o ledger pagamentos_alunos, não mais um campo único.
    async _alunosPagosEsteMes() {
        const { data } = await supabase
            .from('pagamentos_alunos')
            .select('aluno_id')
            .eq('mes_referencia', this._mesReferenciaAtual());
        return new Set((data || []).map(p => p.aluno_id));
    },

    // Pix é sempre imediato. Cartão só "cai" na conta na data de repasse —
    // registros antigos sem essa data (de antes dessa feature existir) são
    // tratados como já repassados, pra não sumir dinheiro do saldo à toa.
    _pagamentoJaRepassado(p) {
        if (p.forma_pagamento !== 'cartao') return true;
        if (!p.data_repasse) return true;
        return p.data_repasse <= todayISO();
    },

    // ── Saldo em Conta: quanto realmente tem disponível, considerando que
    // cartão demora a repassar. É entradas já repassadas − despesas −
    // professores + ajustes manuais (pra reconciliar com o banco de verdade).
    async loadSaldoConta() {
        const container = document.getElementById('financeiro-saldo-conta-body');
        if (!container) return;

        const [{ data: pagAlunos }, { data: pagDespesas }, { data: pagProfs }, { data: ajustes }] = await Promise.all([
            supabase.from('pagamentos_alunos').select('valor, forma_pagamento, data_repasse'),
            supabase.from('despesas_pagamentos').select('valor'),
            supabase.from('pagamentos_professores').select('valor'),
            supabase.from('saldo_ajustes').select('valor')
        ]);

        const repassados     = (pagAlunos || []).filter(p => this._pagamentoJaRepassado(p));
        const aindaEmRepasse = (pagAlunos || []).filter(p => !this._pagamentoJaRepassado(p));

        const totalRepassado  = repassados.reduce((s, p) => s + p.valor, 0);
        const totalDespesas   = (pagDespesas || []).reduce((s, p) => s + p.valor, 0);
        const totalProfessores = (pagProfs || []).reduce((s, p) => s + p.valor, 0);
        const totalAjustes    = (ajustes || []).reduce((s, a) => s + a.valor, 0);
        const aReceber        = aindaEmRepasse.reduce((s, p) => s + p.valor, 0);

        const saldoConta = totalRepassado - totalDespesas - totalProfessores + totalAjustes;

        container.innerHTML = `
            <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;">
                <div class="fin-saldo-valor" style="color:${saldoConta >= 0 ? 'var(--color-primary)' : 'var(--color-red)'}">
                    ${fmt.currency(saldoConta)}
                </div>
                ${aReceber > 0 ? badge(`+ ${fmt.currency(aReceber)} em repasse (cartão)`, 'badge-warning') : ''}
            </div>
        `;
    },

    abrirAjusteSaldo() {
        document.getElementById('aj-valor').value = '';
        document.getElementById('aj-motivo').value = '';
        openModal('modal-ajuste-saldo');
    },

    async salvarAjusteSaldo() {
        const valorRaw = document.getElementById('aj-valor').value;
        const valor    = parseFloat(valorRaw);
        const motivo   = document.getElementById('aj-motivo').value.trim();

        const errors = validateForm([
            { value: motivo, label: 'Motivo', rules: ['required'] }
        ]);
        if (valorRaw === '' || isNaN(valor)) errors.push('Informe um valor de ajuste válido');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-salvar-ajuste', true);
        try {
            const { error } = await supabase.from('saldo_ajustes').insert({
                valor, motivo, registrado_por: AppState.userProfile.id
            });
            if (error) throw error;

            await auditLog('SALDO_AJUSTADO', 'saldo_ajustes', null, { valor, motivo });
            showToast('Ajuste registrado', 'success');
            closeModal('modal-ajuste-saldo');
            await this._refreshVisaoGeral();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-salvar-ajuste', false);
        }
    },

    async verHistoricoAjustes() {
        document.getElementById('modal-historico-title').textContent = 'Histórico de Ajustes de Saldo';
        const body = document.getElementById('modal-historico-body');
        body.innerHTML = '<div class="loader-inline"></div>';
        openModal('modal-historico-pagamentos');

        const { data, error } = await supabase
            .from('saldo_ajustes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            body.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            body.innerHTML = emptyState('Nenhum ajuste registrado ainda');
            return;
        }

        body.innerHTML = `
            <table class="table table-cards">
                <thead><tr><th>Data</th><th>Valor</th><th>Motivo</th></tr></thead>
                <tbody>
                    ${data.map(a => `
                        <tr>
                            <td data-label="Data">${fmt.datetime(a.created_at)}</td>
                            <td data-label="Valor" style="color:${a.valor >= 0 ? 'var(--color-green)' : 'var(--color-red)'}">${fmt.currency(a.valor)}</td>
                            <td data-label="Motivo">${escapeHtml(a.motivo)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    // ── Visão Geral: junta os 3 ledgers (aluno, despesa, professor) num
    // painel só — recebido, gasto, pago a professor, saldo, pendências e a
    // evolução dos últimos 6 meses. É a aba que abre primeiro.
    async loadVisaoGeral() {
        const statsEl      = document.getElementById('financeiro-geral-stats');
        const pendenciasEl = document.getElementById('financeiro-geral-pendencias');
        if (!statsEl) return;

        const mesRef = this._mesReferenciaAtual();

        // relatorios só entra aqui pra saber quem deu aula ESTE mês (pendências
        // de pagamento) — filtrar no servidor evita buscar a tabela inteira.
        // Sem esse filtro de data, essa busca esbarra no limite de ~1000 linhas
        // por requisição do Supabase (a plataforma já passou disso em set/2026)
        // e passa a vir incompleta, sem erro nenhum avisando.
        const inicioMesFin = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const [
            { data: pagAlunos }, { data: pagDespesas }, { data: pagProfs },
            { data: alunosInfo }, { data: despesas }, { data: profs }, { data: rels }
        ] = await Promise.all([
            supabase.from('pagamentos_alunos').select('aluno_id, valor, mes_referencia'),
            supabase.from('despesas_pagamentos').select('despesa_id, valor, mes_referencia'),
            supabase.from('pagamentos_professores').select('professor_id, valor, mes_referencia'),
            supabase.from('alunos_info').select('usuario:usuarios!alunos_info_usuario_id_fkey(id, ativo)'),
            supabase.from('despesas').select('id, ativo, recorrente'),
            supabase.from('usuarios').select('id').eq('role', 'professor').eq('ativo', true),
            supabase.from('relatorios').select('professor_id, created_at').gte('created_at', inicioMesFin)
        ]);

        const recebidoMes = (pagAlunos || []).filter(p => p.mes_referencia === mesRef).reduce((s, p) => s + p.valor, 0);
        const despesasMes = (pagDespesas || []).filter(p => p.mes_referencia === mesRef).reduce((s, p) => s + p.valor, 0);
        const professoresMes = (pagProfs || []).filter(p => p.mes_referencia === mesRef).reduce((s, p) => s + p.valor, 0);
        const saldoMes = recebidoMes - despesasMes - professoresMes;

        statsEl.innerHTML = `
            ${this._statCard('Recebido este mês', fmt.currency(recebidoMes), '💰', 'stat-green')}
            ${this._statCard('Despesas pagas', fmt.currency(despesasMes), '💸', 'stat-red')}
            ${this._statCard('Professores pagos', fmt.currency(professoresMes), '👨‍🏫', 'stat-purple')}
            ${this._statCard('Saldo do mês', fmt.currency(saldoMes), saldoMes >= 0 ? '📈' : '📉', saldoMes >= 0 ? 'stat-teal' : 'stat-red')}
        `;

        // Pendências — mesma lógica de "jaPago" usada em cada aba, resumida aqui.
        const alunosPagosSet = new Set((pagAlunos || []).filter(p => p.mes_referencia === mesRef).map(p => p.aluno_id));
        const alunosAtivos = (alunosInfo || []).filter(a => a.usuario?.ativo).length;
        const alunosPendentes = Math.max(0, alunosAtivos - alunosPagosSet.size);

        const despesasPagasEsteMes  = new Set((pagDespesas || []).filter(p => p.mes_referencia === mesRef).map(p => p.despesa_id));
        const despesasPagasAlgumaVez = new Set((pagDespesas || []).map(p => p.despesa_id));
        const despesasAtivas = (despesas || []).filter(d => d.ativo);
        const despesasPendentes = despesasAtivas.filter(d =>
            d.recorrente ? !despesasPagasEsteMes.has(d.id) : !despesasPagasAlgumaVez.has(d.id)
        ).length;

        const profsPagosSet = new Set((pagProfs || []).filter(p => p.mes_referencia === mesRef).map(p => p.professor_id));
        const profsComAula = new Set((rels || []).filter(r => {
            const d = new Date(r.created_at);
            const now = new Date();
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).map(r => r.professor_id));
        const profsAtivosIds = new Set((profs || []).map(p => p.id));
        const professoresPendentes = [...profsComAula].filter(id => profsAtivosIds.has(id) && !profsPagosSet.has(id)).length;

        if (pendenciasEl) {
            pendenciasEl.innerHTML = `
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <span class="stat-chip ${alunosPendentes > 0 ? 'stat-chip-warning' : 'stat-chip-muted'}" style="cursor:pointer" onclick="Modules.Financeiro._setFinTab('alunos')">
                        ${alunosPendentes} aluno${alunosPendentes !== 1 ? 's' : ''} pendente${alunosPendentes !== 1 ? 's' : ''}
                    </span>
                    <span class="stat-chip ${despesasPendentes > 0 ? 'stat-chip-warning' : 'stat-chip-muted'}" style="cursor:pointer" onclick="Modules.Financeiro._setFinTab('despesas')">
                        ${despesasPendentes} despesa${despesasPendentes !== 1 ? 's' : ''} pendente${despesasPendentes !== 1 ? 's' : ''}
                    </span>
                    <span class="stat-chip ${professoresPendentes > 0 ? 'stat-chip-warning' : 'stat-chip-muted'}" style="cursor:pointer" onclick="Modules.Financeiro._setFinTab('professores')">
                        ${professoresPendentes} professor${professoresPendentes !== 1 ? 'es' : ''} pendente${professoresPendentes !== 1 ? 's' : ''}
                    </span>
                </div>
            `;
        }

        this._renderFluxoCaixaChart('fin-chart-fluxo', pagAlunos || [], pagDespesas || [], pagProfs || []);
    },

    // Um bar por mês = saldo líquido (entradas − despesas − professores),
    // verde se sobrou dinheiro, vermelho se faltou — responde de cara a
    // pergunta "esse mês deu lucro ou prejuízo", sem precisar comparar 2 barras.
    _renderFluxoCaixaChart(canvasId, pagAlunos, pagDespesas, pagProfs) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        if (canvas._chartInst) { canvas._chartInst.destroy(); canvas._chartInst = null; }

        const meses = this._ultimosMeses(6);
        const saldos = meses.map(m => {
            const entradas = pagAlunos.filter(p => p.mes_referencia === m).reduce((s, p) => s + p.valor, 0);
            const despesasM = pagDespesas.filter(p => p.mes_referencia === m).reduce((s, p) => s + p.valor, 0);
            const profsM = pagProfs.filter(p => p.mes_referencia === m).reduce((s, p) => s + p.valor, 0);
            return entradas - despesasM - profsM;
        });

        const ctx = canvas.getContext('2d');
        canvas._chartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: meses.map(m => this._formatMes(m)),
                datasets: [{
                    label: 'Saldo do mês',
                    data: saldos,
                    backgroundColor: saldos.map(v => v >= 0 ? '#0d9488' : '#d03b3b'),
                    borderRadius: 6,
                    barThickness: 32
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => fmt.currency(ctx.parsed.y) } }
                },
                scales: {
                    y: { ticks: { callback: v => fmt.currency(v) }, grid: { color: 'rgba(0,0,0,.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    // Extrato geral: junta pagamentos_alunos + despesas_pagamentos + pagamentos_professores
    // num CSV só, ordenado do mais recente pro mais antigo.
    async exportarCSV() {
        const [{ data: pagAlunos }, { data: pagDespesas }, { data: pagProfs }] = await Promise.all([
            supabase.from('pagamentos_alunos').select('*, aluno:usuarios!pagamentos_alunos_aluno_id_fkey(nome)').order('mes_referencia', { ascending: false }),
            supabase.from('despesas_pagamentos').select('*, despesa:despesas(descricao, categoria)').order('mes_referencia', { ascending: false }),
            supabase.from('pagamentos_professores').select('*, professor:usuarios!pagamentos_professores_professor_id_fkey(nome)').order('mes_referencia', { ascending: false })
        ]);

        const linhas = [];
        (pagAlunos || []).forEach(p => linhas.push({
            mes: p.mes_referencia, tipo: 'Entrada', categoria: 'Aluno',
            descricao: p.aluno?.nome || '', forma: p.forma_pagamento, valor: p.valor, registradoEm: p.created_at,
            repasse: p.forma_pagamento === 'cartao'
                ? (this._pagamentoJaRepassado(p) ? 'Já repassado' : `Previsto ${fmt.date(p.data_repasse)}`)
                : '—'
        }));
        (pagDespesas || []).forEach(p => linhas.push({
            mes: p.mes_referencia, tipo: 'Saída',
            categoria: 'Despesa — ' + (this._CATEGORIAS_DESPESA[p.despesa?.categoria] || p.despesa?.categoria || ''),
            descricao: p.despesa?.descricao || '', forma: p.forma_pagamento, valor: p.valor, registradoEm: p.created_at, repasse: '—'
        }));
        (pagProfs || []).forEach(p => linhas.push({
            mes: p.mes_referencia, tipo: 'Saída', categoria: 'Professor',
            descricao: p.professor?.nome || '', forma: '—', valor: p.valor, registradoEm: p.created_at, repasse: '—'
        }));

        if (!linhas.length) return showToast('Nenhum dado para exportar', 'warning');

        linhas.sort((a, b) => b.mes.localeCompare(a.mes) || b.registradoEm.localeCompare(a.registradoEm));

        const rows = [
            ['Mês de Referência', 'Tipo', 'Categoria', 'Descrição', 'Forma de Pagamento', 'Valor', 'Repasse', 'Registrado em'],
            ...linhas.map(l => [
                this._formatMes(l.mes),
                l.tipo,
                l.categoria,
                l.descricao,
                l.forma === 'cartao' ? 'Cartão' : l.forma === 'pix' ? 'Pix' : l.forma,
                l.valor.toFixed(2).replace('.', ','),
                l.repasse,
                fmt.datetime(l.registradoEm)
            ])
        ];

        const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financeiro-${todayISO()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exportado', 'success');
    },

    _payToggleHtml(alunoId, forma) {
        const isCartao = forma === 'cartao';
        return `
            <div class="pay-toggle">
                <span class="pay-toggle-label ${!isCartao ? 'pay-toggle-label-active' : ''}">💠 Pix</span>
                <button class="pay-toggle-switch ${isCartao ? 'is-cartao' : ''}"
                    onclick="Modules.Financeiro.togglePagamento('${alunoId}', '${forma}')"
                    title="Alternar forma de pagamento">
                    <span class="pay-toggle-knob"></span>
                </button>
                <span class="pay-toggle-label ${isCartao ? 'pay-toggle-label-active' : ''}">💳 Cartão</span>
            </div>
        `;
    },

    // ── Alunos: pacote, vencimento, forma de pagamento e status do mês ──
    async loadAlunosList() {
        const container = document.getElementById('financeiro-alunos-list');
        const statsEl    = document.getElementById('financeiro-alunos-stats');
        if (!container) return;

        const [{ data, error }, pagosSet] = await Promise.all([
            supabase
                .from('alunos_info')
                .select('pacote_nome, pacote_valor, dia_vencimento, forma_pagamento, usuario:usuarios!alunos_info_usuario_id_fkey(id, nome, ativo)'),
            this._alunosPagosEsteMes()
        ]);

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const alunos = (data || [])
            .filter(a => a.usuario && a.usuario.ativo)
            .sort((a, b) => a.usuario.nome.localeCompare(b.usuario.nome));

        const pagos = alunos.filter(a => pagosSet.has(a.usuario.id));
        const totalRecebido = pagos.reduce((s, a) => s + (a.pacote_valor || 0), 0);

        if (statsEl) {
            statsEl.innerHTML = `
                ${this._statCard('Recebido este mês', fmt.currency(totalRecebido), '💰', 'stat-green')}
                ${this._statCard('Alunos pagos', pagos.length, '✅', 'stat-teal')}
                ${this._statCard('Alunos pendentes', alunos.length - pagos.length, '⏳', 'stat-gold')}
            `;
        }

        if (!alunos.length) {
            container.innerHTML = emptyState('Nenhum aluno ativo cadastrado');
            return;
        }

        container.innerHTML = `
            <table class="table table-cards">
                <thead>
                    <tr><th>Aluno</th><th>Pacote</th><th>Valor</th><th>Vencimento</th><th>Forma</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                    ${alunos.map(a => {
                        const jaPago = pagosSet.has(a.usuario.id);
                        return `
                        <tr>
                            <td data-label="Aluno"><strong>${escapeHtml(a.usuario.nome)}</strong></td>
                            <td data-label="Pacote">${a.pacote_nome ? escapeHtml(a.pacote_nome) : '<span class="text-muted">Sem pacote</span>'}</td>
                            <td data-label="Valor">${a.pacote_valor != null ? fmt.currency(a.pacote_valor) : '—'}</td>
                            <td data-label="Vencimento">${a.dia_vencimento ? 'Dia ' + a.dia_vencimento : '—'}</td>
                            <td data-label="Forma">${this._payToggleHtml(a.usuario.id, a.forma_pagamento)}</td>
                            <td data-label="Status">${jaPago ? badge('✅ Pago', 'badge-success') : badge('⏳ Pendente', 'badge-warning')}</td>
                            <td data-label="Ações">
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.togglePago('${a.usuario.id}', ${jaPago})">
                                        ${jaPago ? 'Desmarcar' : 'Marcar Pago'}
                                    </button>
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.verHistorico('${a.usuario.id}', '${escapeHtml(a.usuario.nome).replace(/'/g, "\\'")}')">
                                        Histórico
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    // Qualquer ação que grava/apaga num dos 3 ledgers muda o Saldo em Conta e
    // os números da Visão Geral — os elementos existem sempre no DOM (só ficam
    // escondidos por CSS quando a aba não tá ativa), então é seguro recarregar
    // sempre, sem checar qual aba está visível no momento.
    async _refreshVisaoGeral() {
        await Promise.all([this.loadVisaoGeral(), this.loadSaldoConta()]);
    },

    async togglePagamento(alunoId, formaAtual) {
        const nova = formaAtual === 'cartao' ? 'pix' : 'cartao';
        const { error } = await supabase.from('alunos_info').update({ forma_pagamento: nova }).eq('usuario_id', alunoId);
        if (error) return showToast(error.message, 'error');
        await this.loadAlunosList();
    },

    // "Marcar Pago" grava uma linha nova em pagamentos_alunos (ledger).
    // "Desmarcar" remove a linha desse mês — é a forma de corrigir um engano,
    // o histórico de meses anteriores nunca é tocado.
    async togglePago(alunoId, jaPago) {
        const mesRef = this._mesReferenciaAtual();

        if (jaPago) {
            const confirmed = await confirmAction('Desmarcar o pagamento deste aluno? O registro deste mês será removido do histórico.');
            if (!confirmed) return;

            const { error } = await supabase.from('pagamentos_alunos').delete().eq('aluno_id', alunoId).eq('mes_referencia', mesRef);
            if (error) return showToast(error.message, 'error');

            await auditLog('PAGAMENTO_DESMARCADO', 'pagamentos_alunos', alunoId, { mes_referencia: mesRef });
            showToast('Pagamento desmarcado', 'success');
            await Promise.all([this.loadAlunosList(), this._refreshVisaoGeral()]);
            return;
        }

        // Marcar pago abre um modal de confirmação em vez de aplicar direto:
        // no cartão o valor recebido pode vir menor por causa da taxa da
        // maquininha/recebedor, então dá pra ajustar antes de gravar no ledger.
        const { data: ai, error } = await supabase
            .from('alunos_info')
            .select('pacote_valor, forma_pagamento, usuario:usuarios!alunos_info_usuario_id_fkey(nome)')
            .eq('usuario_id', alunoId)
            .single();
        if (error || !ai) return showToast('Não foi possível carregar os dados do aluno', 'error');

        document.getElementById('mp-aluno-id').value          = alunoId;
        document.getElementById('mp-forma').value              = ai.forma_pagamento;
        document.getElementById('mp-valor-pacote-num').value  = ai.pacote_valor || 0;
        document.getElementById('mp-aluno-nome').textContent   = ai.usuario?.nome || '';
        document.getElementById('mp-valor-pacote-display').textContent = fmt.currency(ai.pacote_valor || 0);
        document.getElementById('mp-forma-label').textContent = ai.forma_pagamento === 'cartao' ? '💳 Cartão' : '💠 Pix';

        const isCartao = ai.forma_pagamento === 'cartao';
        document.getElementById('mp-ajuste-group').style.display = isCartao ? 'block' : 'none';
        document.getElementById('mp-ajustar').checked = false;
        document.getElementById('mp-valor-ajustado').style.display = 'none';
        document.getElementById('mp-valor-ajustado').value = ai.pacote_valor || '';

        document.getElementById('mp-repasse-group').style.display = isCartao ? 'block' : 'none';
        document.getElementById('mp-data-repasse').value = '';

        openModal('modal-marcar-pago');
    },

    _onAjustarValorChange(checked) {
        document.getElementById('mp-valor-ajustado').style.display = checked ? 'block' : 'none';
    },

    async confirmarMarcarPago() {
        const alunoId      = document.getElementById('mp-aluno-id').value;
        const forma        = document.getElementById('mp-forma').value;
        const valorPacote  = parseFloat(document.getElementById('mp-valor-pacote-num').value) || 0;
        const ajustar      = forma === 'cartao' && document.getElementById('mp-ajustar').checked;
        const dataRepasse  = forma === 'cartao' ? (document.getElementById('mp-data-repasse').value || null) : null;

        let valorFinal = valorPacote;
        if (ajustar) {
            const valorAjustadoRaw = document.getElementById('mp-valor-ajustado').value;
            const v = parseFloat(valorAjustadoRaw);
            if (valorAjustadoRaw === '' || isNaN(v) || v < 0) return showToast('Informe um valor válido', 'error');
            valorFinal = v;
        }

        const mesRef = this._mesReferenciaAtual();

        setLoading('#btn-confirmar-pago', true);
        try {
            const { error } = await supabase.from('pagamentos_alunos').insert({
                aluno_id:        alunoId,
                valor:           valorFinal,
                forma_pagamento: forma,
                data_repasse:    dataRepasse,
                mes_referencia:  mesRef,
                registrado_por:  AppState.userProfile.id
            });
            if (error) throw error;

            await auditLog('PAGAMENTO_MARCADO', 'pagamentos_alunos', alunoId, { mes_referencia: mesRef, valor: valorFinal, valor_pacote: valorPacote, ajustado: ajustar, data_repasse: dataRepasse });
            showToast('Pagamento marcado como recebido', 'success');
            closeModal('modal-marcar-pago');
            await Promise.all([this.loadAlunosList(), this._refreshVisaoGeral()]);
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-confirmar-pago', false);
        }
    },

    // Extrato completo do aluno — a prova visual de que agora existe histórico de verdade.
    async verHistorico(alunoId, nome) {
        document.getElementById('modal-historico-title').textContent = 'Histórico de Pagamentos — ' + nome;
        const body = document.getElementById('modal-historico-body');
        body.innerHTML = '<div class="loader-inline"></div>';
        openModal('modal-historico-pagamentos');

        const { data, error } = await supabase
            .from('pagamentos_alunos')
            .select('*')
            .eq('aluno_id', alunoId)
            .order('mes_referencia', { ascending: false });

        if (error) {
            body.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            body.innerHTML = emptyState('Nenhum pagamento registrado ainda');
            return;
        }

        body.innerHTML = `
            <table class="table table-cards">
                <thead><tr><th>Mês</th><th>Valor</th><th>Forma</th><th>Registrado em</th></tr></thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td data-label="Mês">${this._formatMes(p.mes_referencia)}</td>
                            <td data-label="Valor">${fmt.currency(p.valor)}</td>
                            <td data-label="Forma">${p.forma_pagamento === 'cartao' ? '💳 Cartão' : '💠 Pix'}</td>
                            <td data-label="Registrado em">${fmt.date(p.created_at.substring(0, 10))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    _formatMes(dataStr) {
        const [ano, mes] = dataStr.split('-');
        const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${nomes[parseInt(mes, 10) - 1]}/${ano}`;
    },

    // ── Despesas: catálogo (fixas/pontuais) + ledger de pagamentos ──
    // Mesmo desenho dos pagamentos de aluno: despesa recorrente é "paga"
    // quando existe uma linha em despesas_pagamentos pro mês atual; despesa
    // pontual é "paga" quando existe qualquer linha (só pode existir uma).
    _onRecorrenteChange(recorrente) {
        document.getElementById('desp-dia-vencimento-group').style.display  = recorrente ? 'block' : 'none';
        document.getElementById('desp-data-vencimento-group').style.display = recorrente ? 'none' : 'block';
    },

    async loadDespesas() {
        const container = document.getElementById('financeiro-despesas-list');
        const statsEl    = document.getElementById('financeiro-despesas-stats');
        if (!container) return;

        const mesRef = this._mesReferenciaAtual();
        const [{ data: despesas, error }, { data: pagamentos }] = await Promise.all([
            supabase.from('despesas').select('*').order('ativo', { ascending: false }).order('descricao'),
            supabase.from('despesas_pagamentos').select('despesa_id, mes_referencia')
        ]);

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const pagasEsteMes   = new Set((pagamentos || []).filter(p => p.mes_referencia === mesRef).map(p => p.despesa_id));
        const pagasAlgumaVez = new Set((pagamentos || []).map(p => p.despesa_id));

        const todas = (despesas || []).map(d => ({
            ...d,
            jaPaga: d.recorrente ? pagasEsteMes.has(d.id) : pagasAlgumaVez.has(d.id)
        }));

        const ativas        = todas.filter(d => d.ativo);
        const totalPago      = ativas.filter(d => d.jaPaga).reduce((s, d) => s + d.valor, 0);
        const totalPendente  = ativas.filter(d => !d.jaPaga).reduce((s, d) => s + d.valor, 0);

        if (statsEl) {
            statsEl.innerHTML = `
                ${this._statCard('Pago este mês', fmt.currency(totalPago), '💸', 'stat-red')}
                ${this._statCard('Pendente este mês', fmt.currency(totalPendente), '⏳', 'stat-gold')}
            `;
        }

        if (!todas.length) {
            container.innerHTML = emptyState('Nenhuma despesa cadastrada ainda');
            return;
        }

        container.innerHTML = `
            <table class="table table-cards">
                <thead>
                    <tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                    ${todas.map(d => `
                        <tr>
                            <td data-label="Descrição"><strong>${escapeHtml(d.descricao)}</strong>${!d.ativo ? ' ' + badge('Inativa', 'badge-secondary') : ''}</td>
                            <td data-label="Categoria">${escapeHtml(this._CATEGORIAS_DESPESA[d.categoria] || d.categoria)}</td>
                            <td data-label="Valor">${fmt.currency(d.valor)}</td>
                            <td data-label="Vencimento">${d.recorrente ? 'Dia ' + d.dia_vencimento + ' (todo mês)' : fmt.date(d.data_vencimento_unica)}</td>
                            <td data-label="Status">${d.jaPaga ? badge('✅ Paga', 'badge-success') : badge('⏳ Pendente', 'badge-warning')}</td>
                            <td data-label="Ações">
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.toggleDespesaPaga('${d.id}', ${d.jaPaga}, ${d.recorrente})">
                                        ${d.jaPaga ? 'Desmarcar' : 'Marcar Paga'}
                                    </button>
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.openEditDespesa('${d.id}')">Editar</button>
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.toggleAtivoDespesa('${d.id}', ${d.ativo})">
                                        ${d.ativo ? 'Desativar' : 'Ativar'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openCreateDespesa() {
        document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
        document.getElementById('desp-id').value               = '';
        document.getElementById('desp-descricao').value        = '';
        document.getElementById('desp-categoria').value        = 'outros';
        document.getElementById('desp-valor').value             = '';
        document.getElementById('desp-forma-pagamento').value  = 'pix';
        document.getElementById('desp-recorrente').checked     = false;
        document.getElementById('desp-dia-vencimento').value   = '';
        document.getElementById('desp-data-vencimento').value  = '';
        this._onRecorrenteChange(false);
        openModal('modal-despesa');
    },

    async openEditDespesa(id) {
        const { data: d, error } = await supabase.from('despesas').select('*').eq('id', id).single();
        if (error || !d) return showToast('Despesa não encontrada', 'error');

        document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
        document.getElementById('desp-id').value               = d.id;
        document.getElementById('desp-descricao').value        = d.descricao;
        document.getElementById('desp-categoria').value        = d.categoria;
        document.getElementById('desp-valor').value             = d.valor;
        document.getElementById('desp-forma-pagamento').value  = d.forma_pagamento;
        document.getElementById('desp-recorrente').checked     = d.recorrente;
        document.getElementById('desp-dia-vencimento').value   = d.dia_vencimento || '';
        document.getElementById('desp-data-vencimento').value  = d.data_vencimento_unica || '';
        this._onRecorrenteChange(d.recorrente);
        openModal('modal-despesa');
    },

    async saveDespesa() {
        const id              = document.getElementById('desp-id').value;
        const descricao       = document.getElementById('desp-descricao').value.trim();
        const categoria       = document.getElementById('desp-categoria').value;
        const valorRaw        = document.getElementById('desp-valor').value;
        const valor           = parseFloat(valorRaw);
        const formaPagamento  = document.getElementById('desp-forma-pagamento').value;
        const recorrente      = document.getElementById('desp-recorrente').checked;
        const diaVencimento   = document.getElementById('desp-dia-vencimento').value;
        const dataVencimento  = document.getElementById('desp-data-vencimento').value;

        const errors = validateForm([
            { value: descricao, label: 'Descrição', rules: ['required'] }
        ]);
        if (valorRaw === '' || isNaN(valor) || valor < 0) errors.push('Informe um valor válido');
        if (recorrente && !diaVencimento) errors.push('Informe o dia do vencimento');
        if (!recorrente && !dataVencimento) errors.push('Informe a data de vencimento');
        if (errors.length) return showToast(errors[0], 'error');

        const payload = {
            descricao, categoria, valor,
            forma_pagamento: formaPagamento,
            recorrente,
            dia_vencimento:        recorrente ? parseInt(diaVencimento, 10) : null,
            data_vencimento_unica: recorrente ? null : dataVencimento
        };

        setLoading('#btn-save-despesa', true);
        try {
            if (id) {
                const { error } = await supabase.from('despesas').update(payload).eq('id', id);
                if (error) throw error;
                await auditLog('DESPESA_ATUALIZADA', 'despesas', id, payload);
                showToast('Despesa atualizada com sucesso', 'success');
            } else {
                const { error } = await supabase.from('despesas').insert(payload);
                if (error) throw error;
                await auditLog('DESPESA_CRIADA', 'despesas', null, payload);
                showToast('Despesa criada com sucesso', 'success');
            }
            closeModal('modal-despesa');
            await this.loadDespesas();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-despesa', false);
        }
    },

    async toggleAtivoDespesa(id, ativoAtual) {
        const novoStatus = !ativoAtual;
        const confirmed = await confirmAction(
            novoStatus
                ? 'Reativar esta despesa?'
                : 'Desativar esta despesa? Ela para de contar nos totais e alertas, mas o histórico de pagamentos é mantido.'
        );
        if (!confirmed) return;

        const { error } = await supabase.from('despesas').update({ ativo: novoStatus }).eq('id', id);
        if (error) return showToast(error.message, 'error');

        await auditLog(novoStatus ? 'DESPESA_ATIVADA' : 'DESPESA_DESATIVADA', 'despesas', id, { ativo: novoStatus });
        showToast(novoStatus ? 'Despesa ativada' : 'Despesa desativada', 'success');
        await this.loadDespesas();
    },

    // Recorrente: marca/desmarca só o mês atual (histórico de meses anteriores
    // preservado). Pontual: só pode existir um pagamento, então não filtra por mês.
    async toggleDespesaPaga(despesaId, jaPaga, recorrente) {
        const mesRef = this._mesReferenciaAtual();

        if (jaPaga) {
            const confirmed = await confirmAction('Desmarcar esta despesa como paga?');
            if (!confirmed) return;

            let query = supabase.from('despesas_pagamentos').delete().eq('despesa_id', despesaId);
            if (recorrente) query = query.eq('mes_referencia', mesRef);
            const { error } = await query;
            if (error) return showToast(error.message, 'error');

            await auditLog('DESPESA_PAGAMENTO_DESMARCADO', 'despesas_pagamentos', despesaId, { mes_referencia: mesRef });
            showToast('Pagamento desmarcado', 'success');
        } else {
            const { data: d } = await supabase.from('despesas').select('valor, forma_pagamento').eq('id', despesaId).single();

            const confirmed = await confirmAction('Confirma que esta despesa foi paga?');
            if (!confirmed) return;

            const { error } = await supabase.from('despesas_pagamentos').insert({
                despesa_id:      despesaId,
                valor:           d?.valor || 0,
                forma_pagamento: d?.forma_pagamento || 'pix',
                mes_referencia:  mesRef,
                registrado_por:  AppState.userProfile.id
            });
            if (error) return showToast(error.message, 'error');

            await auditLog('DESPESA_PAGAMENTO_MARCADO', 'despesas_pagamentos', despesaId, { mes_referencia: mesRef, valor: d?.valor });
            showToast('Despesa marcada como paga', 'success');
        }

        await Promise.all([this.loadDespesas(), this._refreshVisaoGeral()]);
    },

    // Usado pelo Dashboard: despesas ativas vencendo nos próximos 3 dias
    // (ou já vencidas) que ainda não foram pagas.
    async carregarDespesasVencendo() {
        const mesRef = this._mesReferenciaAtual();
        const [{ data: despesas, error }, { data: pagamentos }] = await Promise.all([
            supabase.from('despesas').select('*').eq('ativo', true),
            supabase.from('despesas_pagamentos').select('despesa_id, mes_referencia')
        ]);

        if (error || !despesas?.length) return [];

        const pagasEsteMes   = new Set((pagamentos || []).filter(p => p.mes_referencia === mesRef).map(p => p.despesa_id));
        const pagasAlgumaVez = new Set((pagamentos || []).map(p => p.despesa_id));

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return despesas
            .filter(d => d.recorrente ? !pagasEsteMes.has(d.id) : !pagasAlgumaVez.has(d.id))
            .map(d => {
                let dataAlvo;
                if (d.recorrente) {
                    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                    const diaAlvo = Math.min(d.dia_vencimento, ultimoDiaMes);
                    dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth(), diaAlvo);
                } else {
                    dataAlvo = new Date(d.data_vencimento_unica + 'T00:00:00');
                }
                const diffDias = Math.round((dataAlvo - hoje) / 86400000);
                return { despesaId: d.id, descricao: d.descricao, valor: d.valor, diffDias };
            })
            .filter(d => d.diffDias <= 3)
            .sort((a, b) => a.diffDias - b.diffDias);
    },

    // Usado pelo Dashboard: alunos com dia_vencimento nos próximos 3 dias
    // (ou já vencido) que ainda não pagaram este mês.
    async carregarAlunosVencendo() {
        const [{ data, error }, pagosSet] = await Promise.all([
            supabase
                .from('alunos_info')
                .select('dia_vencimento, pacote_valor, usuario:usuarios!alunos_info_usuario_id_fkey(id, nome, ativo)'),
            this._alunosPagosEsteMes()
        ]);

        if (error || !data?.length) return [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return data
            .filter(a => a.usuario?.ativo && a.dia_vencimento && !pagosSet.has(a.usuario.id))
            .map(a => {
                const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                const diaAlvo   = Math.min(a.dia_vencimento, ultimoDiaMes);
                const dataAlvo  = new Date(hoje.getFullYear(), hoje.getMonth(), diaAlvo);
                const diffDias  = Math.round((dataAlvo - hoje) / 86400000);
                return {
                    alunoId: a.usuario.id, nome: a.usuario.nome,
                    diaVencimento: a.dia_vencimento, diffDias, pacoteValor: a.pacote_valor
                };
            })
            .filter(a => a.diffDias <= 3)
            .sort((a, b) => a.diffDias - b.diffDias);
    },

    // ── Finanças dos professores: quanto pagar este mês ──────────
    // Mesma regra usada em Modules.Professores: aula normal R$20, aula sem aluno R$14
    // (contagem = relatórios lançados no mês corrente).
    async loadFinancasProfessores() {
        const container = document.getElementById('financeiro-professores-list');
        const totalEl    = document.getElementById('financeiro-professores-total');
        if (!container) return;

        const mesRef = this._mesReferenciaAtual();
        const inicioMesProfs = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const [{ data: profs, error }, { data: rels }, { data: pagamentos }] = await Promise.all([
            supabase.from('usuarios').select('id, nome').eq('role', 'professor').eq('ativo', true).order('nome'),
            // Filtrado pro mês atual no servidor — sem isso, essa busca (que
            // calcula quanto pagar cada professor) esbarra no limite de ~1000
            // linhas por requisição do Supabase e pode SUBESTIMAR o valor a
            // pagar sem nenhum erro visível. Achado em set/2026.
            supabase.from('relatorios').select('professor_id, created_at, sem_aluno').gte('created_at', inicioMesProfs),
            supabase.from('pagamentos_professores').select('professor_id, mes_referencia')
        ]);

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const pagosEsteMes = new Set((pagamentos || []).filter(p => p.mes_referencia === mesRef).map(p => p.professor_id));

        const now = new Date();
        const cMes = {};
        const cMesSemAluno = {};
        (rels || []).forEach(r => {
            const d = new Date(r.created_at);
            if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                cMes[r.professor_id] = (cMes[r.professor_id] || 0) + 1;
                if (r.sem_aluno) cMesSemAluno[r.professor_id] = (cMesSemAluno[r.professor_id] || 0) + 1;
            }
        });

        const linhas = (profs || []).map(p => {
            const mes       = cMes[p.id] || 0;
            const semAluno  = cMesSemAluno[p.id] || 0;
            const valor     = (mes - semAluno) * 20 + semAluno * 14;
            return { id: p.id, nome: p.nome, mes, semAluno, valor, jaPago: pagosEsteMes.has(p.id) };
        }).sort((a, b) => b.valor - a.valor);

        const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);
        const totalPago  = linhas.filter(l => l.jaPago).reduce((s, l) => s + l.valor, 0);
        if (totalEl) totalEl.textContent = `Total do mês: ${fmt.currency(totalGeral)} (${fmt.currency(totalPago)} já pago)`;

        if (!linhas.length) {
            container.innerHTML = emptyState('Nenhum professor ativo cadastrado');
            return;
        }

        container.innerHTML = `
            <table class="table table-cards">
                <thead>
                    <tr><th>Professor</th><th>Aulas no mês</th><th>Sem aluno</th><th>Valor a pagar</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                    ${linhas.map(l => `
                        <tr>
                            <td data-label="Professor"><strong>${escapeHtml(l.nome)}</strong></td>
                            <td data-label="Aulas no mês">${l.mes}</td>
                            <td data-label="Sem aluno">${l.semAluno > 0 ? l.semAluno : '—'}</td>
                            <td data-label="Valor a pagar"><strong>${fmt.currency(l.valor)}</strong></td>
                            <td data-label="Status">${l.jaPago ? badge('✅ Pago', 'badge-success') : badge('⏳ Pendente', 'badge-warning')}</td>
                            <td data-label="Ações">
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.togglePagamentoProfessor('${l.id}', ${l.jaPago})">
                                        ${l.jaPago ? 'Desmarcar' : 'Marcar Pago'}
                                    </button>
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.verHistoricoProfessor('${l.id}', '${escapeHtml(l.nome).replace(/'/g, "\\'")}')">
                                        Histórico
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    // Recalcula na hora (não confia em número já renderizado) pra garantir
    // que o valor gravado no ledger bate com os relatórios mais recentes.
    async _calcularGanhoProfessorMes(professorId) {
        const { data: rels } = await supabase
            .from('relatorios')
            .select('created_at, sem_aluno')
            .eq('professor_id', professorId);

        const now = new Date();
        const doMes = (rels || []).filter(r => {
            const d = new Date(r.created_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        const semAluno = doMes.filter(r => r.sem_aluno).length;
        const total = doMes.length;
        const valor = (total - semAluno) * 20 + semAluno * 14;
        return { total, semAluno, valor };
    },

    async togglePagamentoProfessor(professorId, jaPago) {
        const mesRef = this._mesReferenciaAtual();

        if (jaPago) {
            const confirmed = await confirmAction('Desmarcar o pagamento deste professor? O registro deste mês será removido do histórico.');
            if (!confirmed) return;

            const { error } = await supabase.from('pagamentos_professores').delete().eq('professor_id', professorId).eq('mes_referencia', mesRef);
            if (error) return showToast(error.message, 'error');

            await auditLog('PAGAMENTO_PROFESSOR_DESMARCADO', 'pagamentos_professores', professorId, { mes_referencia: mesRef });
            showToast('Pagamento desmarcado', 'success');
        } else {
            const { total, semAluno, valor } = await this._calcularGanhoProfessorMes(professorId);

            const confirmed = await confirmAction(
                `Confirma o pagamento de ${fmt.currency(valor)} para este professor (${total} aula${total !== 1 ? 's' : ''} este mês)?`
            );
            if (!confirmed) return;

            const { error } = await supabase.from('pagamentos_professores').insert({
                professor_id:                    professorId,
                valor,
                aulas_contabilizadas:            total,
                aulas_sem_aluno_contabilizadas:  semAluno,
                mes_referencia:                  mesRef,
                registrado_por:                  AppState.userProfile.id
            });
            if (error) return showToast(error.message, 'error');

            await auditLog('PAGAMENTO_PROFESSOR_MARCADO', 'pagamentos_professores', professorId, { mes_referencia: mesRef, valor });
            showToast('Professor marcado como pago', 'success');
        }

        await Promise.all([this.loadFinancasProfessores(), this._refreshVisaoGeral()]);
    },

    async verHistoricoProfessor(professorId, nome) {
        document.getElementById('modal-historico-title').textContent = 'Histórico de Pagamentos — ' + nome;
        const body = document.getElementById('modal-historico-body');
        body.innerHTML = '<div class="loader-inline"></div>';
        openModal('modal-historico-pagamentos');

        const { data, error } = await supabase
            .from('pagamentos_professores')
            .select('*')
            .eq('professor_id', professorId)
            .order('mes_referencia', { ascending: false });

        if (error) {
            body.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            body.innerHTML = emptyState('Nenhum pagamento registrado ainda');
            return;
        }

        body.innerHTML = `
            <table class="table table-cards">
                <thead><tr><th>Mês</th><th>Aulas</th><th>Sem aluno</th><th>Valor</th><th>Registrado em</th></tr></thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td data-label="Mês">${this._formatMes(p.mes_referencia)}</td>
                            <td data-label="Aulas">${p.aulas_contabilizadas}</td>
                            <td data-label="Sem aluno">${p.aulas_sem_aluno_contabilizadas > 0 ? p.aulas_sem_aluno_contabilizadas : '—'}</td>
                            <td data-label="Valor">${fmt.currency(p.valor)}</td>
                            <td data-label="Registrado em">${fmt.date(p.created_at.substring(0, 10))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async loadList() {
        const container = document.getElementById('financeiro-list');
        if (!container) return;

        const { data, error } = await supabase
            .from('pacotes')
            .select('*')
            .order('ativo', { ascending: false })
            .order('nome', { ascending: true });

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhum pacote cadastrado ainda');
            return;
        }

        container.innerHTML = `
            <table class="table table-cards">
                <thead>
                    <tr><th>Pacote</th><th>Valor</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td data-label="Pacote"><strong>${escapeHtml(p.nome)}</strong></td>
                            <td data-label="Valor">${fmt.currency(p.valor)}</td>
                            <td data-label="Status">${p.ativo ? badge('Ativo', 'badge-success') : badge('Inativo', 'badge-secondary')}</td>
                            <td data-label="Ações">
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.openEdit('${p.id}')">Editar</button>
                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Financeiro.toggleAtivo('${p.id}', ${p.ativo})">
                                        ${p.ativo ? 'Desativar' : 'Ativar'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openCreate() {
        document.getElementById('modal-pacote-title').textContent = 'Novo Pacote';
        document.getElementById('pac-id').value    = '';
        document.getElementById('pac-nome').value  = '';
        document.getElementById('pac-valor').value = '';
        openModal('modal-pacote');
    },

    async openEdit(id) {
        const { data: p, error } = await supabase.from('pacotes').select('*').eq('id', id).single();
        if (error || !p) return showToast('Pacote não encontrado', 'error');

        document.getElementById('modal-pacote-title').textContent = 'Editar Pacote';
        document.getElementById('pac-id').value    = p.id;
        document.getElementById('pac-nome').value  = p.nome;
        document.getElementById('pac-valor').value = p.valor;
        openModal('modal-pacote');
    },

    async save() {
        const id       = document.getElementById('pac-id').value;
        const nome     = document.getElementById('pac-nome').value.trim();
        const valorRaw = document.getElementById('pac-valor').value;
        const valor    = parseFloat(valorRaw);

        const errors = validateForm([
            { value: nome, label: 'Nome do pacote', rules: ['required'] }
        ]);
        if (valorRaw === '' || isNaN(valor) || valor < 0) errors.push('Informe um valor válido');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-pacote', true);
        try {
            if (id) {
                const { error } = await supabase.from('pacotes').update({ nome, valor }).eq('id', id);
                if (error) throw error;
                await auditLog('PACOTE_ATUALIZADO', 'pacotes', id, { nome, valor });
                showToast('Pacote atualizado com sucesso', 'success');
            } else {
                const { error } = await supabase.from('pacotes').insert({ nome, valor });
                if (error) throw error;
                await auditLog('PACOTE_CRIADO', 'pacotes', null, { nome, valor });
                showToast('Pacote criado com sucesso', 'success');
            }
            closeModal('modal-pacote');
            await this.loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-pacote', false);
        }
    },

    async toggleAtivo(id, ativoAtual) {
        const novoStatus = !ativoAtual;
        const confirmed = await confirmAction(
            novoStatus
                ? 'Reativar este pacote? Ele voltará a aparecer para seleção na edição de alunos.'
                : 'Desativar este pacote? Ele deixará de aparecer para seleção em novos alunos (alunos já vinculados não são afetados).'
        );
        if (!confirmed) return;

        const { error } = await supabase.from('pacotes').update({ ativo: novoStatus }).eq('id', id);
        if (error) return showToast(error.message, 'error');

        await auditLog(novoStatus ? 'PACOTE_ATIVADO' : 'PACOTE_DESATIVADO', 'pacotes', id, { ativo: novoStatus });
        showToast(novoStatus ? 'Pacote ativado' : 'Pacote desativado', 'success');
        await this.loadList();
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
    }
};
