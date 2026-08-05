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
                ${isAdmin ? `<button class="btn btn-primary" onclick="Modules.Financeiro.openCreate()">+ Nova Mensalidade</button>` : ''}
            </div>

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
                </div>
                <div id="financeiro-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL CRIAR MENSALIDADE -->
            <div class="modal-overlay" id="modal-financeiro">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Nova Mensalidade</h3>
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
                            <label class="form-label">Valor (R$) *</label>
                            <input type="number" class="input" id="fin-valor" step="0.01" min="0.01" placeholder="0,00" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dia do Vencimento (1–31) *</label>
                            <input type="number" class="input" id="fin-dia" min="1" max="31" placeholder="Ex: 10" style="max-width:140px;" />
                            <span style="font-size:.78rem;color:var(--color-text-3);margin-top:4px;">A mensalidade se repete todo mês nesse dia, a partir do próximo mês.</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-financeiro')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-fin" onclick="Modules.Financeiro.save()">Criar Mensalidade</button>
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
        }

        await this._loadList();
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

        const statusFilter = document.getElementById('filter-fin-status')?.value;
        const alunoFilter   = document.getElementById('filter-fin-aluno')?.value;

        if (statusFilter) query = query.eq('status', statusFilter);
        if (alunoFilter)  query = query.eq('aluno_id', alunoFilter);

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
                        <th>Valor</th>
                        <th>Dia</th>
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
                            return `
                                <tr class="${vencido ? 'row-danger' : ''}">
                                    ${isAdmin ? `<td>${escapeHtml(f.aluno_nome)}</td>` : ''}
                                    <td><strong>${fmt.currency(f.valor)}</strong></td>
                                    <td class="${vencido ? 'text-danger' : ''}">dia ${f.dia_vencimento || '—'}</td>
                                    <td>${badge(s.label, s.class)}</td>
                                    <td>${f.pago_em ? fmt.date(f.pago_em) : '—'}</td>
                                    ${isAdmin ? `
                                    <td>
                                        <div class="action-btns">
                                            ${f.status !== 'pago'
                                                ? `<button class="btn btn-ghost btn-sm text-success"
                                                    onclick="Modules.Financeiro.marcarPago('${f.id}', ${f.dia_vencimento || 'null'}, '${escapeHtml(f.aluno_id)}', ${f.valor})">Marcar Pago</button>`
                                                : ''
                                            }
                                            <button class="btn btn-ghost btn-sm text-danger"
                                                onclick="Modules.Financeiro.deletar('${f.id}')">Excluir</button>
                                        </div>
                                    </td>` : ''}
                                </tr>
                            `;
                        }).join('')
                        : `<tr><td colspan="${isAdmin ? 6 : 4}">${emptyState('Nenhuma mensalidade encontrada')}</td></tr>`
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
        document.getElementById('fin-aluno').value = '';
        document.getElementById('fin-valor').value = '';
        document.getElementById('fin-dia').value   = '';
        openModal('modal-financeiro');
    },

    // ── salvar mensalidade ────────────────────────────────────
    async save() {
        const alunoId = document.getElementById('fin-aluno').value;
        const valor   = parseFloat(document.getElementById('fin-valor').value);
        const dia     = parseInt(document.getElementById('fin-dia').value);

        const errors = validateForm([
            { value: alunoId, label: 'Aluno', rules: ['required'] }
        ]);
        if (!valor || valor <= 0) errors.push('Valor deve ser maior que zero');
        if (!dia || dia < 1 || dia > 31) errors.push('Informe um dia de vencimento válido (1 a 31)');

        if (errors.length) return showToast(errors[0], 'error');

        const vencimento = this._calcProximoVencimento(dia);

        setLoading('#btn-save-fin', true);
        try {
            const payload = {
                aluno_id:       alunoId,
                descricao:      'Mensalidade',
                valor,
                vencimento,
                recorrente:     true,
                dia_vencimento: dia,
                created_by:     AppState.userProfile.id
            };

            const { error } = await supabase.from('financeiro').insert(payload);
            if (error) throw error;

            await auditLog('COBRANCA_CRIADA', 'financeiro', null, { alunoId, valor, vencimento });
            showToast('Mensalidade criada com sucesso', 'success');
            closeModal('modal-financeiro');
            await this._loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-fin', false);
        }
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
    async marcarPago(id, dia, alunoId, valor) {
        const confirmed = await confirmAction('Confirmar pagamento desta mensalidade?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('financeiro')
            .update({ status: 'pago', pago_em: new Date().toISOString().split('T')[0] })
            .eq('id', id);

        if (error) return showToast(error.message, 'error');

        await auditLog('COBRANCA_PAGA', 'financeiro', id, { status: 'pago' });

        // Gera automaticamente a mensalidade do próximo mês
        if (dia && alunoId) {
            const proximoVenc = this._calcProximoVencimento(dia);
            const { error: errProx } = await supabase.from('financeiro').insert({
                aluno_id:       alunoId,
                descricao:      'Mensalidade',
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
    },

    // ── excluir ───────────────────────────────────────────────
    async deletar(id) {
        const confirmed = await confirmAction('Excluir esta mensalidade permanentemente?');
        if (!confirmed) return;

        const { error } = await supabase.from('financeiro').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Mensalidade excluída', 'success');
        await this._loadList();
    }
};
