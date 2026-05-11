// ============================================================
// MÓDULO: FINANCEIRO
// ============================================================

Modules.Financeiro = {
    _page: 1,
    _filter: '',

    async render() {
        const isAdmin = Auth.can('admin');

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Financeiro</h1>
                ${isAdmin ? `<button class="btn btn-primary" onclick="Modules.Financeiro.openCreate()">+ Nova Cobrança</button>` : ''}
            </div>

            ${isAdmin ? `
            <div class="stats-financeiro" id="stats-fin">
                <div class="loader-inline"></div>
            </div>` : ''}

            <div class="card">
                <div class="card-toolbar">
                    <select class="input" id="filter-fin-status" onchange="Modules.Financeiro._applyFilter()">
                        <option value="">Todos os status</option>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="atrasado">Atrasado</option>
                    </select>
                    ${isAdmin ? `
                    <select class="input" id="filter-fin-aluno" onchange="Modules.Financeiro._applyFilter()">
                        <option value="">Todos os alunos</option>
                    </select>` : ''}
                    <label style="display:flex;align-items:center;gap:6px;font-size:.8125rem;color:var(--color-text-2);cursor:pointer;white-space:nowrap;">
                        <input type="checkbox" id="filter-fin-recorrente" onchange="Modules.Financeiro._applyFilter()" style="accent-color:var(--color-primary);width:14px;height:14px;" />
                        Só recorrentes
                    </label>
                </div>
                <div id="financeiro-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL CRIAR COBRANÇA -->
            <div class="modal-overlay" id="modal-financeiro">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Nova Cobrança</h3>
                        <button class="modal-close" onclick="closeModal('modal-financeiro')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Aluno *</label>
                            <select class="input" id="fin-aluno">
                                <option value="">Selecionar aluno...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descrição *</label>
                            <input type="text" class="input" id="fin-descricao" placeholder="Ex: Mensalidade" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Valor (R$) *</label>
                            <input type="number" class="input" id="fin-valor" step="0.01" min="0.01" placeholder="0,00" />
                        </div>

                        <!-- toggle recorrente / avulso -->
                        <div class="fin-tipo-toggle">
                            <button class="fin-tipo-btn active" id="btn-tipo-avulso"   onclick="Modules.Financeiro._setTipo('avulso')">📋 Avulsa (data única)</button>
                            <button class="fin-tipo-btn"         id="btn-tipo-recorrente" onclick="Modules.Financeiro._setTipo('recorrente')">♻ Recorrente (mensal)</button>
                        </div>

                        <!-- vencimento avulso -->
                        <div class="form-group" id="fin-campo-data">
                            <label class="form-label">Data de Vencimento *</label>
                            <input type="date" class="input" id="fin-vencimento" />
                        </div>

                        <!-- vencimento recorrente -->
                        <div id="fin-campo-dia" style="display:none;">
                            <div class="info-box" style="margin-bottom:10px;">
                                ♻ A cobrança será gerada todo mês neste dia. Ao marcar como pago, o próximo mês é criado automaticamente.
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dia do Vencimento (1–31) *</label>
                                <input type="number" class="input" id="fin-dia" min="1" max="31" placeholder="Ex: 10" style="max-width:140px;" />
                                <span style="font-size:.78rem;color:var(--color-text-3);margin-top:4px;">O vencimento deste mês será calculado automaticamente.</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-financeiro')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-fin" onclick="Modules.Financeiro.save()">Criar Cobrança</button>
                    </div>
                </div>
            </div>
        `);

        if (isAdmin) {
            const { data: alunos } = await supabase
                .from('usuarios').select('id,nome').eq('role','aluno').order('nome');
            const selCreate = document.getElementById('fin-aluno');
            const selFilter = document.getElementById('filter-fin-aluno');
            alunos?.forEach(a => {
                selCreate.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
                selFilter.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
            });
            await this._loadStats();
        }

        await this._loadList();
    },

    // ── tipo de cobrança ──────────────────────────────────────
    _setTipo(tipo) {
        const isRec = tipo === 'recorrente';
        document.getElementById('btn-tipo-avulso')?.classList.toggle('active', !isRec);
        document.getElementById('btn-tipo-recorrente')?.classList.toggle('active', isRec);
        document.getElementById('fin-campo-data').style.display = isRec ? 'none' : '';
        document.getElementById('fin-campo-dia').style.display  = isRec ? '' : 'none';
    },

    // ── stats ─────────────────────────────────────────────────
    async _loadStats() {
        const container = document.getElementById('stats-fin');
        if (!container) return;

        const { data } = await supabase.from('financeiro').select('status,valor');

        const pago     = data?.filter(r => r.status === 'pago').reduce((s,r) => s + parseFloat(r.valor), 0) || 0;
        const pendente = data?.filter(r => r.status === 'pendente').reduce((s,r) => s + parseFloat(r.valor), 0) || 0;
        const atrasado = data?.filter(r => r.status === 'atrasado').reduce((s,r) => s + parseFloat(r.valor), 0) || 0;

        container.innerHTML = `
            <div class="stat-card stat-green">
                <div class="stat-icon">✓</div>
                <div class="stat-body">
                    <div class="stat-value">${fmt.currency(pago)}</div>
                    <div class="stat-label">Total Recebido</div>
                </div>
            </div>
            <div class="stat-card stat-gold">
                <div class="stat-icon">⏳</div>
                <div class="stat-body">
                    <div class="stat-value">${fmt.currency(pendente)}</div>
                    <div class="stat-label">A Receber</div>
                </div>
            </div>
            <div class="stat-card stat-red">
                <div class="stat-icon">⚠</div>
                <div class="stat-body">
                    <div class="stat-value">${fmt.currency(atrasado)}</div>
                    <div class="stat-label">Em Atraso</div>
                </div>
            </div>
        `;
    },

    _applyFilter() {
        this._page = 1;
        this._loadList();
    },

    // ── lista ─────────────────────────────────────────────────
    async _loadList() {
        const container = document.getElementById('financeiro-list');
        if (!container) return;

        const uid     = AppState.userProfile.id;
        const isAdmin = Auth.can('admin');

        let query = supabase
            .from('v_financeiro_completo')
            .select('*', { count: 'exact' })
            .order('vencimento', { ascending: false });

        if (!isAdmin) query = query.eq('aluno_id', uid);

        const statusFilter     = document.getElementById('filter-fin-status')?.value;
        const alunoFilter      = document.getElementById('filter-fin-aluno')?.value;
        const recorrenteFilter = document.getElementById('filter-fin-recorrente')?.checked;

        if (statusFilter)     query = query.eq('status', statusFilter);
        if (alunoFilter)      query = query.eq('aluno_id', alunoFilter);
        if (recorrenteFilter) query = query.eq('recorrente', true);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        ${isAdmin ? '<th>Aluno</th>' : ''}
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Status</th>
                        <th>Pago em</th>
                        ${isAdmin ? '<th>Ações</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${data?.length
                        ? data.map(f => {
                            const s       = fmt.status_fin(f.status);
                            const vencido = f.status === 'atrasado';
                            const isRec   = f.recorrente;
                            return `
                                <tr class="${vencido ? 'row-danger' : ''}">
                                    ${isAdmin ? `<td>${escapeHtml(f.aluno_nome)}</td>` : ''}
                                    <td>
                                        ${escapeHtml(f.descricao)}
                                        ${isRec ? `<span title="Cobrança recorrente mensal" style="margin-left:5px;cursor:default;">♻</span>` : ''}
                                    </td>
                                    <td><strong>${fmt.currency(f.valor)}</strong></td>
                                    <td class="${vencido ? 'text-danger' : ''}">
                                        ${fmt.date(f.vencimento)}
                                        ${isRec && f.dia_vencimento ? `<div style="font-size:.72rem;color:var(--color-text-3);">dia ${f.dia_vencimento} todo mês</div>` : ''}
                                    </td>
                                    <td>${badge(s.label, s.class)}</td>
                                    <td>${f.pago_em ? fmt.date(f.pago_em) : '—'}</td>
                                    ${isAdmin ? `
                                    <td>
                                        <div class="action-btns">
                                            ${f.status !== 'pago'
                                                ? `<button class="btn btn-ghost btn-sm text-success"
                                                    onclick="Modules.Financeiro.marcarPago('${f.id}', ${isRec}, ${f.dia_vencimento || 'null'}, '${escapeHtml(f.aluno_id)}', '${escapeHtml(f.descricao)}', ${f.valor})">Marcar Pago</button>`
                                                : ''
                                            }
                                            <button class="btn btn-ghost btn-sm text-danger"
                                                onclick="Modules.Financeiro.deletar('${f.id}')">Excluir</button>
                                        </div>
                                    </td>` : ''}
                                </tr>
                            `;
                        }).join('')
                        : `<tr><td colspan="${isAdmin ? 7 : 5}">${emptyState('Nenhuma cobrança encontrada')}</td></tr>`
                    }
                </tbody>
            </table>
            ${paginationHtml(this._page, totalPages, 'Modules.Financeiro._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Financeiro._page = p;
        Modules.Financeiro._loadList();
    },

    // ── abrir modal criar ─────────────────────────────────────
    openCreate() {
        document.getElementById('fin-aluno').value      = '';
        document.getElementById('fin-descricao').value  = '';
        document.getElementById('fin-valor').value      = '';
        document.getElementById('fin-vencimento').value = '';
        const diaEl = document.getElementById('fin-dia');
        if (diaEl) diaEl.value = '';
        this._setTipo('avulso');
        openModal('modal-financeiro');
    },

    // ── salvar cobrança ───────────────────────────────────────
    async save() {
        const alunoId  = document.getElementById('fin-aluno').value;
        const descricao = document.getElementById('fin-descricao').value.trim();
        const valor    = parseFloat(document.getElementById('fin-valor').value);
        const isRec    = document.getElementById('btn-tipo-recorrente')?.classList.contains('active');

        const errors = validateForm([
            { value: alunoId,   label: 'Aluno',      rules: ['required'] },
            { value: descricao, label: 'Descrição',   rules: ['required'] }
        ]);
        if (!valor || valor <= 0) errors.push('Valor deve ser maior que zero');

        let vencimento, diaVencimento = null;

        if (isRec) {
            diaVencimento = parseInt(document.getElementById('fin-dia')?.value);
            if (!diaVencimento || diaVencimento < 1 || diaVencimento > 31) {
                errors.push('Informe um dia de vencimento válido (1 a 31)');
            } else {
                vencimento = this._calcVencimento(diaVencimento);
            }
        } else {
            vencimento = document.getElementById('fin-vencimento').value;
            if (!vencimento) errors.push('Data de vencimento é obrigatória');
        }

        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-fin', true);
        try {
            const payload = {
                aluno_id:      alunoId,
                descricao,
                valor,
                vencimento,
                recorrente:    isRec,
                dia_vencimento: isRec ? diaVencimento : null,
                created_by:    AppState.userProfile.id
            };

            const { error } = await supabase.from('financeiro').insert(payload);
            if (error) throw error;

            await auditLog('COBRANCA_CRIADA', 'financeiro', null, { alunoId, valor, vencimento, recorrente: isRec });
            showToast(`Cobrança ${isRec ? 'recorrente ' : ''}criada com sucesso`, 'success');
            closeModal('modal-financeiro');
            await this._loadList();
            await this._loadStats();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-fin', false);
        }
    },

    // Calcula a data de vencimento para o mês atual dado um dia
    _calcVencimento(dia) {
        const hoje  = new Date();
        const ano   = hoje.getFullYear();
        const mes   = hoje.getMonth(); // 0-based
        // Quantos dias tem o mês atual?
        const maxDia = new Date(ano, mes + 1, 0).getDate();
        const diaReal = Math.min(dia, maxDia);
        const d = new Date(ano, mes, diaReal);
        return d.toISOString().split('T')[0];
    },

    // Calcula o vencimento do próximo mês dado um dia
    _calcProximoVencimento(dia) {
        const hoje     = new Date();
        let ano        = hoje.getFullYear();
        let mes        = hoje.getMonth() + 1; // próximo mês (0-based + 1 = mês atual 1-based + 1)
        if (mes > 11) { mes = 0; ano++; }
        const maxDia   = new Date(ano, mes + 1, 0).getDate();
        const diaReal  = Math.min(dia, maxDia);
        const d        = new Date(ano, mes, diaReal);
        return d.toISOString().split('T')[0];
    },

    // ── marcar como pago ─────────────────────────────────────
    async marcarPago(id, isRecorrente, dia, alunoId, descricao, valor) {
        const confirmed = await confirmAction('Confirmar pagamento desta cobrança?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('financeiro')
            .update({ status: 'pago', pago_em: new Date().toISOString().split('T')[0] })
            .eq('id', id);

        if (error) return showToast(error.message, 'error');

        await auditLog('COBRANCA_PAGA', 'financeiro', id, { status: 'pago' });

        // Se for recorrente, cria automaticamente a cobrança do próximo mês
        if (isRecorrente && dia && alunoId) {
            const proximoVenc = this._calcProximoVencimento(dia);
            const { error: errProx } = await supabase.from('financeiro').insert({
                aluno_id:       alunoId,
                descricao:      descricao,
                valor:          valor,
                vencimento:     proximoVenc,
                recorrente:     true,
                dia_vencimento: dia,
                created_by:     AppState.userProfile.id
            });
            if (!errProx) {
                showToast('Pagamento registrado e próximo mês gerado automaticamente ♻', 'success');
            } else {
                showToast('Pagamento registrado (erro ao gerar próximo mês)', 'warning');
            }
        } else {
            showToast('Pagamento registrado', 'success');
        }

        await this._loadList();
        await this._loadStats();
    },

    // ── excluir ───────────────────────────────────────────────
    async deletar(id) {
        const confirmed = await confirmAction('Excluir esta cobrança permanentemente?');
        if (!confirmed) return;

        const { error } = await supabase.from('financeiro').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Cobrança excluída', 'success');
        await this._loadList();
        await this._loadStats();
    }
};
