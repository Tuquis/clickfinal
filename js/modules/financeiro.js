// ============================================================
// MÓDULO: FINANCEIRO (admin) — catálogo de pacotes (nome + valor)
// e visão geral de alunos com pacote + dia de vencimento.
// Pacote e vencimento do aluno são editados no modal de Usuários;
// aqui é só o cadastro dos pacotes e a listagem de conferência.
// ============================================================

Modules.Financeiro = {
    async render() {
        if (!Auth.can('admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Financeiro</h1>
                <button class="btn btn-primary" onclick="Modules.Financeiro.openCreate()">+ Novo Pacote</button>
            </div>

            <div class="card mb-3">
                <div class="card-header"><h3>Pacotes</h3></div>
                <div class="card-body" id="financeiro-list">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Alunos — Pacote e Vencimento</h3></div>
                <div class="card-body" id="financeiro-alunos-list">
                    <div class="loader-inline"></div>
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
        `);

        await Promise.all([this.loadList(), this.loadAlunosList()]);
    },

    // ── Alunos com pacote/vencimento (somente leitura — edição fica em Usuários) ──
    async loadAlunosList() {
        const container = document.getElementById('financeiro-alunos-list');
        if (!container) return;

        const { data, error } = await supabase
            .from('alunos_info')
            .select('pacote_nome, pacote_valor, dia_vencimento, usuario:usuarios!alunos_info_usuario_id_fkey(id, nome, ativo)');

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const alunos = (data || [])
            .filter(a => a.usuario && a.usuario.ativo)
            .sort((a, b) => a.usuario.nome.localeCompare(b.usuario.nome));

        if (!alunos.length) {
            container.innerHTML = emptyState('Nenhum aluno ativo cadastrado');
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr><th>Aluno</th><th>Pacote</th><th>Valor</th><th>Vencimento</th></tr>
                </thead>
                <tbody>
                    ${alunos.map(a => `
                        <tr>
                            <td>${escapeHtml(a.usuario.nome)}</td>
                            <td>${a.pacote_nome ? escapeHtml(a.pacote_nome) : '<span class="text-muted">Sem pacote</span>'}</td>
                            <td>${a.pacote_valor != null ? fmt.currency(a.pacote_valor) : '—'}</td>
                            <td>${a.dia_vencimento ? 'Dia ' + a.dia_vencimento : '—'}</td>
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
            <table class="table">
                <thead>
                    <tr><th>Pacote</th><th>Valor</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td>${escapeHtml(p.nome)}</td>
                            <td>${fmt.currency(p.valor)}</td>
                            <td>${p.ativo ? badge('Ativo', 'badge-success') : badge('Inativo', 'badge-secondary')}</td>
                            <td>
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
    }
};
