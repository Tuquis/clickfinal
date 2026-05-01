// ============================================================
// MÓDULO: ATIVIDADES
// ============================================================

Modules.Atividades = {
    _page: 1,

    async render() {
        const isProf = Auth.can('professor');
        const isAluno = Auth.can('aluno');
        const uid = AppState.userProfile.id;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Atividades</h1>
                ${isProf ? `<button class="btn btn-primary" onclick="Modules.Atividades.openCreate()">+ Nova Atividade</button>` : ''}
            </div>
            <div class="card">
                <div id="atividades-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL CRIAR ATIVIDADE (professor) -->
            <div class="modal-overlay" id="modal-atividade">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Nova Atividade</h3>
                        <button class="modal-close" onclick="closeModal('modal-atividade')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Aluno *</label>
                            <select class="input" id="atv-aluno">
                                <option value="">Selecionar aluno...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Título *</label>
                            <input type="text" class="input" id="atv-titulo" placeholder="Título da atividade" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descrição</label>
                            <textarea class="input textarea" id="atv-descricao" rows="4"
                                placeholder="Instruções detalhadas para o aluno"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Prazo de entrega</label>
                            <input type="date" class="input" id="atv-prazo" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Arquivo (opcional)</label>
                            <input type="file" class="input" id="atv-arquivo"
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-atividade')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-atv" onclick="Modules.Atividades.save()">Enviar Atividade</button>
                    </div>
                </div>
            </div>
        `);

        if (isProf) {
            // Carregar alunos para o professor (alunos que têm aulas com ele)
            const { data: alunos } = await supabase
                .from('usuarios')
                .select('id,nome')
                .eq('role','aluno')
                .eq('ativo',true)
                .order('nome');

            const sel = document.getElementById('atv-aluno');
            alunos?.forEach(a => {
                sel.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
            });
        }

        await this._loadList();
    },

    async _loadList() {
        const container = document.getElementById('atividades-list');
        if (!container) return;

        const uid = AppState.userProfile.id;
        const isProf = Auth.can('professor');
        const isAdmin = Auth.can('admin');

        let query = supabase
            .from('atividades')
            .select(`
                *,
                aluno:usuarios!atividades_aluno_id_fkey(nome),
                professor:usuarios!atividades_professor_id_fkey(nome)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (Auth.can('professor')) query = query.eq('professor_id', uid);
        if (Auth.can('aluno')) query = query.eq('aluno_id', uid);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhuma atividade encontrada');
            return;
        }

        container.innerHTML = `
            <div class="atividades-grid">
                ${data.map(a => `
                    <div class="atividade-card">
                        <div class="atividade-header">
                            <h3 class="atividade-titulo">${escapeHtml(a.titulo)}</h3>
                            ${a.prazo ? `<span class="atividade-prazo ${new Date(a.prazo) < new Date() ? 'prazo-vencido' : ''}">
                                Prazo: ${fmt.date(a.prazo)}
                            </span>` : ''}
                        </div>
                        <div class="atividade-meta">
                            ${Auth.can('admin','professor')
                                ? `<span>Aluno: <strong>${escapeHtml(a.aluno?.nome || '—')}</strong></span>`
                                : ''
                            }
                            <span>Professor: <strong>${escapeHtml(a.professor?.nome || '—')}</strong></span>
                            <span>${fmt.date(a.created_at)}</span>
                        </div>
                        ${a.descricao ? `<p class="atividade-desc">${escapeHtml(a.descricao)}</p>` : ''}
                        <div class="atividade-footer">
                            ${a.arquivo_url
                                ? `<a href="${escapeHtml(a.arquivo_url)}" target="_blank" class="btn btn-ghost btn-sm">
                                    📎 Baixar arquivo
                                </a>`
                                : ''
                            }
                            ${Auth.can('professor') && a.professor_id === AppState.userProfile.id
                                ? `<button class="btn btn-ghost btn-sm text-danger"
                                    onclick="Modules.Atividades.deletar('${a.id}')">Excluir</button>`
                                : ''
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
            ${paginationHtml(this._page, totalPages, 'Modules.Atividades._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Atividades._page = p;
        Modules.Atividades._loadList();
    },

    openCreate() {
        document.getElementById('atv-aluno').value = '';
        document.getElementById('atv-titulo').value = '';
        document.getElementById('atv-descricao').value = '';
        document.getElementById('atv-prazo').value = '';
        document.getElementById('atv-arquivo').value = '';
        openModal('modal-atividade');
    },

    async save() {
        const alunoId = document.getElementById('atv-aluno').value;
        const titulo = document.getElementById('atv-titulo').value.trim();
        const descricao = document.getElementById('atv-descricao').value.trim();
        const prazo = document.getElementById('atv-prazo').value;
        const file = document.getElementById('atv-arquivo').files[0];

        const errors = validateForm([
            { value: alunoId, label: 'Aluno', rules: ['required'] },
            { value: titulo, label: 'Título', rules: ['required'] }
        ]);
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-atv', true);
        try {
            let arquivoUrl = null;
            if (file) {
                const path = `professores/${AppState.userProfile.id}/materiais/${Date.now()}-${file.name}`;
                arquivoUrl = await uploadFile('materiais', path, file);
            }

            const { error } = await supabase.from('atividades').insert({
                professor_id: AppState.userProfile.id,
                aluno_id: alunoId,
                titulo,
                descricao: descricao || null,
                prazo: prazo || null,
                arquivo_url: arquivoUrl
            });

            if (error) throw error;

            await auditLog('ATIVIDADE_CRIADA', 'atividades', null, { alunoId, titulo });
            showToast('Atividade enviada com sucesso', 'success');
            closeModal('modal-atividade');
            await this._loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-atv', false);
        }
    },

    async deletar(id) {
        const confirmed = await confirmAction('Excluir esta atividade?');
        if (!confirmed) return;

        const { error } = await supabase.from('atividades').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Atividade excluída', 'success');
        await this._loadList();
    }
};
