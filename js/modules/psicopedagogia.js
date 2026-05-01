// ============================================================
// MÓDULO: PSICOPEDAGOGIA
// ============================================================

Modules.Psicopedagogia = {
    _page: 1,

    async render() {
        if (!Auth.requireRole('psicopedagoga', 'admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Observações Psicopedagógicas</h1>
                ${Auth.can('psicopedagoga') ? `<button class="btn btn-primary" onclick="Modules.Psicopedagogia.openCreate()">+ Nova Observação</button>` : ''}
            </div>
            <div class="card">
                <div class="card-toolbar">
                    <select class="input" id="filter-psico-aluno" onchange="Modules.Psicopedagogia._load()">
                        <option value="">Todos os alunos</option>
                    </select>
                    <select class="input" id="filter-psico-cat" onchange="Modules.Psicopedagogia._load()">
                        <option value="">Todas as categorias</option>
                        ${Object.entries(CATEGORIAS_PSICO).map(([k,v]) =>
                            `<option value="${k}">${v}</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="psico-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL CRIAR OBSERVAÇÃO -->
            <div class="modal-overlay" id="modal-psico">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3 id="modal-psico-title">Nova Observação</h3>
                        <button class="modal-close" onclick="closeModal('modal-psico')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="psico-id" />
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Aluno *</label>
                                <select class="input" id="psico-aluno">
                                    <option value="">Selecionar...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Categoria *</label>
                                <select class="input" id="psico-cat">
                                    ${Object.entries(CATEGORIAS_PSICO).map(([k,v]) =>
                                        `<option value="${k}">${v}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data da Observação *</label>
                            <input type="date" class="input" id="psico-data" value="${todayISO()}" max="${todayISO()}" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Observação *</label>
                            <textarea class="input textarea" id="psico-conteudo" rows="6"
                                placeholder="Descreva as observações psicopedagógicas do aluno..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-psico')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-psico" onclick="Modules.Psicopedagogia.save()">Salvar</button>
                    </div>
                </div>
            </div>
        `);

        const { data: alunos } = await supabase
            .from('usuarios').select('id,nome').eq('role','aluno').order('nome');

        const selFilter = document.getElementById('filter-psico-aluno');
        const selCreate = document.getElementById('psico-aluno');
        alunos?.forEach(a => {
            selFilter.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
            selCreate.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
        });

        await this._load();
    },

    async _load() {
        const container = document.getElementById('psico-list');
        if (!container) return;

        let query = supabase
            .from('observacoes_psico')
            .select(`
                *,
                aluno:usuarios!observacoes_psico_aluno_id_fkey(nome),
                psico:usuarios!observacoes_psico_psico_id_fkey(nome)
            `, { count: 'exact' })
            .order('data', { ascending: false })
            .order('created_at', { ascending: false });

        if (Auth.can('psicopedagoga')) {
            query = query.eq('psico_id', AppState.userProfile.id);
        }

        const alunoFilter = document.getElementById('filter-psico-aluno')?.value;
        const catFilter = document.getElementById('filter-psico-cat')?.value;
        if (alunoFilter) query = query.eq('aluno_id', alunoFilter);
        if (catFilter) query = query.eq('categoria', catFilter);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhuma observação encontrada');
            return;
        }

        container.innerHTML = `
            <div class="observacoes-lista">
                ${data.map(o => `
                    <div class="observacao-card">
                        <div class="observacao-header">
                            <div class="obs-info">
                                <span class="obs-aluno-nome">${escapeHtml(o.aluno?.nome || '—')}</span>
                                <span class="obs-data">${fmt.date(o.data)}</span>
                            </div>
                            <div class="obs-meta">
                                ${badge(CATEGORIAS_PSICO[o.categoria] || o.categoria, 'badge-psico-' + o.categoria)}
                                ${Auth.can('psicopedagoga') && o.psico_id === AppState.userProfile.id
                                    ? `<button class="btn btn-ghost btn-xs" onclick="Modules.Psicopedagogia.openEdit('${o.id}')">Editar</button>
                                       <button class="btn btn-ghost btn-xs text-danger" onclick="Modules.Psicopedagogia.deletar('${o.id}')">Excluir</button>`
                                    : `<span class="obs-psico-nome">${escapeHtml(o.psico?.nome || '')}</span>`
                                }
                            </div>
                        </div>
                        <div class="observacao-conteudo">${escapeHtml(o.conteudo)}</div>
                    </div>
                `).join('')}
            </div>
            ${paginationHtml(this._page, totalPages, 'Modules.Psicopedagogia._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Psicopedagogia._page = p;
        Modules.Psicopedagogia._load();
    },

    openCreate() {
        document.getElementById('modal-psico-title').textContent = 'Nova Observação';
        document.getElementById('psico-id').value = '';
        document.getElementById('psico-aluno').value = '';
        document.getElementById('psico-cat').value = 'geral';
        document.getElementById('psico-data').value = todayISO();
        document.getElementById('psico-conteudo').value = '';
        openModal('modal-psico');
    },

    async openEdit(id) {
        const { data: o } = await supabase
            .from('observacoes_psico').select('*').eq('id', id).single();
        if (!o) return showToast('Observação não encontrada', 'error');

        document.getElementById('modal-psico-title').textContent = 'Editar Observação';
        document.getElementById('psico-id').value = o.id;
        document.getElementById('psico-aluno').value = o.aluno_id;
        document.getElementById('psico-aluno').disabled = true;
        document.getElementById('psico-cat').value = o.categoria;
        document.getElementById('psico-data').value = o.data;
        document.getElementById('psico-conteudo').value = o.conteudo;
        openModal('modal-psico');
    },

    async save() {
        const id = document.getElementById('psico-id').value;
        const alunoId = document.getElementById('psico-aluno').value;
        const categoria = document.getElementById('psico-cat').value;
        const data = document.getElementById('psico-data').value;
        const conteudo = document.getElementById('psico-conteudo').value.trim();

        const errors = validateForm([
            { value: alunoId, label: 'Aluno', rules: ['required'] },
            { value: data, label: 'Data', rules: ['required'] },
            { value: conteudo, label: 'Observação', rules: ['required'] }
        ]);
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-psico', true);
        try {
            if (id) {
                const { error } = await supabase
                    .from('observacoes_psico')
                    .update({ categoria, data, conteudo })
                    .eq('id', id);
                if (error) throw error;
                showToast('Observação atualizada', 'success');
            } else {
                const { error } = await supabase
                    .from('observacoes_psico')
                    .insert({
                        psico_id: AppState.userProfile.id,
                        aluno_id: alunoId,
                        categoria,
                        data,
                        conteudo
                    });
                if (error) throw error;
                await auditLog('OBSERVACAO_CRIADA', 'observacoes_psico', null, { alunoId, categoria });
                showToast('Observação registrada', 'success');
            }

            closeModal('modal-psico');
            document.getElementById('psico-aluno').disabled = false;
            await this._load();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-psico', false);
        }
    },

    async deletar(id) {
        const confirmed = await confirmAction('Excluir esta observação?');
        if (!confirmed) return;

        const { error } = await supabase.from('observacoes_psico').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Observação excluída', 'success');
        await this._load();
    }
};
