// ============================================================
// MÓDULO: CRONOGRAMA
// ============================================================

Modules.Cronograma = {

    async render() {
        const role = AppState.role;
        const isAdmin = Auth.can('admin');
        const isAluno = Auth.can('aluno');

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Cronograma</h1>
                ${isAdmin ? `<button class="btn btn-primary" onclick="Modules.Cronograma.openCreate()">+ Novo Cronograma</button>` : ''}
            </div>

            ${isAdmin ? `
            <div class="card mb-3">
                <div class="card-toolbar">
                    <select class="input" id="filter-cron-aluno" onchange="Modules.Cronograma._loadList()">
                        <option value="">Todos os alunos</option>
                    </select>
                </div>
            </div>` : ''}

            <div id="cronograma-list" class="cronograma-container">
                <div class="loader-inline"></div>
            </div>

            <!-- MODAL CRIAR CRONOGRAMA -->
            <div class="modal-overlay" id="modal-cronograma">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Novo Cronograma Semanal</h3>
                        <button class="modal-close" onclick="closeModal('modal-cronograma')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Aluno *</label>
                                <select class="input" id="cron-aluno">
                                    <option value="">Selecionar...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Semana início *</label>
                                <input type="date" class="input" id="cron-semana" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Título *</label>
                            <input type="text" class="input" id="cron-titulo" placeholder="Ex: Revisão para prova de matemática" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descrição</label>
                            <textarea class="input textarea" id="cron-descricao" rows="2" placeholder="Observações gerais do cronograma"></textarea>
                        </div>
                        <hr class="divider" />
                        <div class="form-group">
                            <label class="form-label">Tarefas</label>
                            <div class="tarefa-input-row">
                                <input type="text" class="input" id="tarefa-nova" placeholder="Descreva a tarefa e pressione Enter"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();Modules.Cronograma._addTarefa();}" />
                                <button class="btn btn-ghost btn-sm" onclick="Modules.Cronograma._addTarefa()">Adicionar</button>
                            </div>
                            <div id="tarefas-lista" class="tarefas-preview mt-2"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-cronograma')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-cron" onclick="Modules.Cronograma.save()">Salvar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL EVIDÊNCIA -->
            <div class="modal-overlay" id="modal-evidencia">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Enviar Evidência</h3>
                        <button class="modal-close" onclick="closeModal('modal-evidencia')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="ev-tarefa-id" />
                        <input type="hidden" id="ev-aluno-id" />
                        <div class="form-group">
                            <label class="form-label">Arquivo (opcional)</label>
                            <input type="file" class="input" id="ev-arquivo" accept="image/*,.pdf,.doc,.docx" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-evidencia')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-ev" onclick="Modules.Cronograma.saveEvidencia()">Concluir Tarefa</button>
                    </div>
                </div>
            </div>
        `);

        if (isAdmin) {
            const { data: alunos } = await supabase
                .from('usuarios').select('id,nome').eq('role','aluno').order('nome');
            const selFilter = document.getElementById('filter-cron-aluno');
            const selCreate = document.getElementById('cron-aluno');
            alunos?.forEach(a => {
                selFilter.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
                selCreate.innerHTML += `<option value="${a.id}">${escapeHtml(a.nome)}</option>`;
            });
        }

        this._tarefas = [];
        await this._loadList();
    },

    _tarefas: [],

    _addTarefa() {
        const input = document.getElementById('tarefa-nova');
        const val = input.value.trim();
        if (!val) return;
        this._tarefas.push(val);
        this._renderTarefasPreview();
        input.value = '';
        input.focus();
    },

    _removeTarefa(idx) {
        Modules.Cronograma._tarefas.splice(idx, 1);
        Modules.Cronograma._renderTarefasPreview();
    },

    _renderTarefasPreview() {
        const container = document.getElementById('tarefas-lista');
        if (!container) return;
        container.innerHTML = this._tarefas.length
            ? this._tarefas.map((t, i) => `
                <div class="tarefa-preview-item">
                    <span>${escapeHtml(t)}</span>
                    <button class="btn btn-ghost btn-xs text-danger" onclick="Modules.Cronograma._removeTarefa(${i})">×</button>
                </div>
            `).join('')
            : '<p class="text-muted small">Nenhuma tarefa adicionada</p>';
    },

    async _loadList() {
        const container = document.getElementById('cronograma-list');
        if (!container) return;

        const uid = AppState.userProfile.id;
        const role = AppState.role;

        let query = supabase
            .from('cronograma')
            .select(`
                *,
                aluno:usuarios!cronograma_aluno_id_fkey(id,nome),
                tarefas:cronograma_tarefas(*)
            `)
            .order('semana_inicio', { ascending: false });

        if (role === 'aluno') query = query.eq('aluno_id', uid);

        const alunoFilter = document.getElementById('filter-cron-aluno')?.value;
        if (alunoFilter) query = query.eq('aluno_id', alunoFilter);

        const { data, error } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhum cronograma encontrado');
            return;
        }

        container.innerHTML = data.map(c => {
            const tarefas = c.tarefas || [];
            const concluidas = tarefas.filter(t => t.status === 'concluida').length;
            const total = tarefas.length;
            const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
            const isAluno = role === 'aluno';

            return `
                <div class="cronograma-card">
                    <div class="cronograma-header">
                        <div>
                            <h3 class="cronograma-titulo">${escapeHtml(c.titulo)}</h3>
                            ${role !== 'aluno' ? `<p class="cronograma-aluno">${escapeHtml(c.aluno?.nome || '')}</p>` : ''}
                            <p class="cronograma-semana">Semana de ${fmt.date(c.semana_inicio)}</p>
                        </div>
                        <div class="cronograma-progress">
                            <div class="progress-ring" title="${pct}% concluído">
                                <svg viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" stroke-width="3"/>
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="#6366f1" stroke-width="3"
                                        stroke-dasharray="${pct * 0.942} 100" stroke-linecap="round"
                                        transform="rotate(-90 18 18)"/>
                                    <text x="18" y="22" text-anchor="middle" font-size="8" fill="#374151">${pct}%</text>
                                </svg>
                            </div>
                            <span class="progress-label">${concluidas}/${total} tarefas</span>
                        </div>
                    </div>
                    ${c.descricao ? `<p class="cronograma-desc">${escapeHtml(c.descricao)}</p>` : ''}
                    <div class="tarefas-list">
                        ${tarefas.length
                            ? tarefas.map(t => `
                                <div class="tarefa-item ${t.status === 'concluida' ? 'tarefa-concluida' : ''}">
                                    <div class="tarefa-check">
                                        ${isAluno && t.status === 'pendente'
                                            ? `<input type="checkbox" class="checkbox"
                                                onchange="Modules.Cronograma.toggleTarefa('${t.id}', '${c.aluno_id}', this.checked)">`
                                            : `<span class="check-icon">${t.status === 'concluida' ? '✓' : '○'}</span>`
                                        }
                                    </div>
                                    <div class="tarefa-body">
                                        <span class="tarefa-desc">${escapeHtml(t.descricao)}</span>
                                        ${t.status === 'concluida' && t.concluida_em
                                            ? `<span class="tarefa-concluida-em">Concluída em ${fmt.datetime(t.concluida_em)}</span>`
                                            : ''}
                                        ${t.evidencia_url
                                            ? `<a href="${escapeHtml(t.evidencia_url)}" target="_blank" class="tarefa-evidencia-link">Ver evidência</a>`
                                            : ''
                                        }
                                    </div>
                                    ${isAluno && t.status === 'pendente'
                                        ? `<button class="btn btn-ghost btn-xs" onclick="Modules.Cronograma.openEvidencia('${t.id}','${c.aluno_id}')">+ Evidência</button>`
                                        : ''
                                    }
                                </div>
                            `).join('')
                            : '<p class="text-muted small">Sem tarefas cadastradas</p>'
                        }
                    </div>
                    ${Auth.can('admin') ? `
                    <div class="cronograma-footer">
                        <button class="btn btn-ghost btn-sm text-danger"
                            onclick="Modules.Cronograma.deleteCronograma('${c.id}')">Excluir</button>
                    </div>` : ''}
                </div>
            `;
        }).join('');
    },

    openCreate() {
        document.getElementById('cron-semana').value = '';
        document.getElementById('cron-titulo').value = '';
        document.getElementById('cron-descricao').value = '';
        document.getElementById('cron-aluno').value = '';
        this._tarefas = [];
        this._renderTarefasPreview();
        openModal('modal-cronograma');
    },

    async save() {
        const alunoId = document.getElementById('cron-aluno').value;
        const semana = document.getElementById('cron-semana').value;
        const titulo = document.getElementById('cron-titulo').value.trim();
        const descricao = document.getElementById('cron-descricao').value.trim();

        const errors = validateForm([
            { value: alunoId, label: 'Aluno', rules: ['required'] },
            { value: semana, label: 'Semana início', rules: ['required'] },
            { value: titulo, label: 'Título', rules: ['required'] }
        ]);

        if (this._tarefas.length === 0) errors.push('Adicione pelo menos uma tarefa');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-cron', true);
        try {
            const { data: cron, error: cronError } = await supabase
                .from('cronograma')
                .insert({
                    aluno_id: alunoId,
                    admin_id: AppState.userProfile.id,
                    semana_inicio: semana,
                    titulo,
                    descricao: descricao || null
                })
                .select()
                .single();

            if (cronError) throw cronError;

            const tarefasPayload = this._tarefas.map(desc => ({
                cronograma_id: cron.id,
                descricao: desc,
                status: 'pendente'
            }));

            const { error: tarefasError } = await supabase
                .from('cronograma_tarefas')
                .insert(tarefasPayload);

            if (tarefasError) throw tarefasError;

            await auditLog('CRONOGRAMA_CRIADO', 'cronograma', cron.id, {
                aluno_id: alunoId, titulo, qtd_tarefas: this._tarefas.length
            });

            showToast('Cronograma criado com sucesso', 'success');
            closeModal('modal-cronograma');
            await this._loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-cron', false);
        }
    },

    async toggleTarefa(tarefaId, alunoId, checked) {
        const { error } = await supabase
            .from('cronograma_tarefas')
            .update({ status: checked ? 'concluida' : 'pendente' })
            .eq('id', tarefaId);

        if (error) {
            showToast(error.message, 'error');
            return;
        }
        if (checked) showToast('Tarefa marcada como concluída!', 'success');
        await this._loadList();
    },

    openEvidencia(tarefaId, alunoId) {
        document.getElementById('ev-tarefa-id').value = tarefaId;
        document.getElementById('ev-aluno-id').value = alunoId;
        document.getElementById('ev-arquivo').value = '';
        openModal('modal-evidencia');
    },

    async saveEvidencia() {
        const tarefaId = document.getElementById('ev-tarefa-id').value;
        const alunoId = document.getElementById('ev-aluno-id').value;
        const file = document.getElementById('ev-arquivo').files[0];

        setLoading('#btn-save-ev', true);
        try {
            let evidenciaUrl = null;
            if (file) {
                const path = `alunos/${alunoId}/evidencias/${tarefaId}-${Date.now()}-${file.name}`;
                evidenciaUrl = await uploadFile('evidencias', path, file);
            }

            const { error } = await supabase
                .from('cronograma_tarefas')
                .update({ status: 'concluida', evidencia_url: evidenciaUrl })
                .eq('id', tarefaId);

            if (error) throw error;

            showToast('Tarefa concluída' + (evidenciaUrl ? ' com evidência' : ''), 'success');
            closeModal('modal-evidencia');
            await this._loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-ev', false);
        }
    },

    async deleteCronograma(id) {
        const confirmed = await confirmAction('Excluir este cronograma e todas as tarefas?');
        if (!confirmed) return;

        const { error } = await supabase.from('cronograma').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        showToast('Cronograma excluído', 'success');
        await this._loadList();
    }
};
