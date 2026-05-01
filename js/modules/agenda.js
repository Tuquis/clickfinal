// ============================================================
// MÓDULO: AGENDA
// ============================================================

Modules.Agenda = {
    _page: 1,
    _filters: { status: '', data: '' },

    async render() {
        const isAdmin = Auth.can('admin');
        const isProf = Auth.can('professor');
        const isAluno = Auth.can('aluno');
        const isPsico = Auth.can('psicopedagoga');

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Agenda${isProf ? ' — Minhas Aulas' : isAluno ? ' — Minhas Aulas' : ''}</h1>
                ${isAdmin ? `<button class="btn btn-primary" onclick="Modules.Agenda.openCreate()">+ Agendar Aula</button>` : ''}
            </div>
            <div class="card">
                <div class="card-toolbar">
                    <select class="input" id="filter-status-agenda" onchange="Modules.Agenda._applyFilter()">
                        <option value="">Todos os status</option>
                        <option value="agendada">Agendada</option>
                        <option value="realizada">Realizada</option>
                        <option value="cancelada">Cancelada</option>
                    </select>
                    <input type="date" class="input" id="filter-data-agenda" onchange="Modules.Agenda._applyFilter()" />
                    <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._clearFilters()">Limpar filtros</button>
                </div>
                <div id="agenda-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL AGENDAR AULA (admin) -->
            <div class="modal-overlay" id="modal-agenda">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3 id="modal-agenda-title">Agendar Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-agenda')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="ag-id" />
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Aluno *</label>
                                <select class="input" id="ag-aluno">
                                    <option value="">Carregando...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Professor *</label>
                                <select class="input" id="ag-professor">
                                    <option value="">Carregando...</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Data *</label>
                                <input type="date" class="input" id="ag-data" min="${todayISO()}" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Horário *</label>
                                <input type="time" class="input" id="ag-horario" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Conteúdo da Aula *</label>
                            <textarea class="input textarea" id="ag-conteudo" rows="3" placeholder="Descreva o conteúdo que será abordado"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Link Google Meet</label>
                            <input type="url" class="input" id="ag-meet" placeholder="https://meet.google.com/..." />
                        </div>
                        <div id="ag-disponibilidade-info" class="info-box" style="display:none">
                            <strong>Disponibilidade do professor:</strong>
                            <div id="ag-disp-content"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-agenda')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-agenda" onclick="Modules.Agenda.save()">Agendar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL CANCELAR (admin) -->
            <div class="modal-overlay" id="modal-cancelar">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Cancelar Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-cancelar')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="cancel-id" />
                        <p>Confirma o cancelamento desta aula?</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-cancelar')">Não</button>
                        <button class="btn btn-danger" onclick="Modules.Agenda.cancelarAula()">Cancelar Aula</button>
                    </div>
                </div>
            </div>
        `);

        // Observar seleção de professor para mostrar disponibilidade
        document.getElementById('ag-professor')?.addEventListener('change', (e) => {
            if (e.target.value) Modules.Agenda._showDisponibilidade(e.target.value);
            else document.getElementById('ag-disponibilidade-info').style.display = 'none';
        });

        await this.loadList();
    },

    _applyFilter() {
        this._filters.status = document.getElementById('filter-status-agenda')?.value || '';
        this._filters.data = document.getElementById('filter-data-agenda')?.value || '';
        this._page = 1;
        this.loadList();
    },

    _clearFilters() {
        document.getElementById('filter-status-agenda').value = '';
        document.getElementById('filter-data-agenda').value = '';
        this._filters = { status: '', data: '' };
        this._page = 1;
        this.loadList();
    },

    async loadList() {
        const container = document.getElementById('agenda-list');
        if (!container) return;

        const uid = AppState.userProfile.id;
        const role = AppState.role;

        let query = supabase
            .from('v_agenda_completa')
            .select('*', { count: 'exact' })
            .order('data', { ascending: false })
            .order('horario', { ascending: false });

        if (role === 'professor') query = query.eq('professor_id', uid);
        if (role === 'aluno') query = query.eq('aluno_id', uid);

        if (this._filters.status) query = query.eq('status', this._filters.status);
        if (this._filters.data) query = query.eq('data', this._filters.data);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;
        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);
        const isAdmin = Auth.can('admin');

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Horário</th>
                        <th>Aluno</th>
                        <th>Professor</th>
                        <th>Conteúdo</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data?.length
                        ? data.map(a => {
                            const s = fmt.status_aula(a.status);
                            return `
                                <tr>
                                    <td>${fmt.date(a.data)}</td>
                                    <td>${fmt.time(a.horario)}</td>
                                    <td>${escapeHtml(a.aluno_nome)}</td>
                                    <td>${escapeHtml(a.professor_nome)}</td>
                                    <td class="td-truncate">${escapeHtml(a.conteudo)}</td>
                                    <td>${badge(s.label, s.class)}</td>
                                    <td>
                                        <div class="action-btns">
                                            ${a.link_meet ? `<a href="${escapeHtml(a.link_meet)}" target="_blank" class="btn btn-ghost btn-sm">Meet</a>` : ''}
                                            ${a.status === 'agendada' && Auth.can('professor') && a.professor_id === uid && !a.relatorio_id
                                                ? `<button class="btn btn-sm btn-primary" onclick="Modules.Relatorios.openForm('${a.id}','${a.aluno_id}')">Relatório</button>`
                                                : ''
                                            }
                                            ${a.relatorio_id
                                                ? `<button class="btn btn-ghost btn-sm" onclick="Modules.Relatorios.openView('${a.relatorio_id}')">Ver Rel.</button>`
                                                : ''
                                            }
                                            ${isAdmin && a.status === 'agendada'
                                                ? `<button class="btn btn-ghost btn-sm text-danger" onclick="Modules.Agenda.openCancelar('${a.id}')">Cancelar</button>`
                                                : ''
                                            }
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')
                        : `<tr><td colspan="7">${emptyState('Nenhuma aula encontrada')}</td></tr>`
                    }
                </tbody>
            </table>
            ${paginationHtml(this._page, totalPages, 'Modules.Agenda._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Agenda._page = p;
        Modules.Agenda.loadList();
    },

    async openCreate() {
        document.getElementById('modal-agenda-title').textContent = 'Agendar Aula';
        document.getElementById('ag-id').value = '';
        document.getElementById('ag-data').value = '';
        document.getElementById('ag-data').min = todayISO();
        document.getElementById('ag-horario').value = '';
        document.getElementById('ag-conteudo').value = '';
        document.getElementById('ag-meet').value = '';
        document.getElementById('ag-disponibilidade-info').style.display = 'none';

        // Carregar alunos e professores
        const [{ data: alunos }, { data: profs }] = await Promise.all([
            supabase.from('usuarios').select('id,nome').eq('role','aluno').eq('ativo',true).order('nome'),
            supabase.from('usuarios').select('id,nome').eq('role','professor').eq('ativo',true).order('nome')
        ]);

        document.getElementById('ag-aluno').innerHTML =
            `<option value="">Selecionar aluno...</option>` +
            (alunos?.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join('') || '');

        document.getElementById('ag-professor').innerHTML =
            `<option value="">Selecionar professor...</option>` +
            (profs?.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('') || '');

        openModal('modal-agenda');
    },

    async _showDisponibilidade(professorId) {
        const { data: disp } = await supabase
            .from('disponibilidade')
            .select('*')
            .eq('professor_id', professorId)
            .order('dia_semana');

        const info = document.getElementById('ag-disponibilidade-info');
        const content = document.getElementById('ag-disp-content');

        if (!disp?.length) {
            info.style.display = 'none';
            return;
        }

        content.innerHTML = disp.map(d =>
            `<span class="disp-slot">${DIAS_SEMANA[d.dia_semana]}: ${fmt.time(d.horario_inicio)} — ${fmt.time(d.horario_fim)}</span>`
        ).join('');
        info.style.display = 'block';
    },

    async save() {
        const id = document.getElementById('ag-id').value;
        const alunoId = document.getElementById('ag-aluno').value;
        const professorId = document.getElementById('ag-professor').value;
        const data = document.getElementById('ag-data').value;
        const horario = document.getElementById('ag-horario').value;
        const conteudo = document.getElementById('ag-conteudo').value.trim();
        const meet = document.getElementById('ag-meet').value.trim();

        const errors = validateForm([
            { value: alunoId, label: 'Aluno', rules: ['required'] },
            { value: professorId, label: 'Professor', rules: ['required'] },
            { value: data, label: 'Data', rules: ['required'] },
            { value: horario, label: 'Horário', rules: ['required'] },
            { value: conteudo, label: 'Conteúdo', rules: ['required'] }
        ]);

        if (data && data < todayISO()) errors.push('A data não pode ser no passado');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-agenda', true);
        try {
            const payload = {
                aluno_id: alunoId,
                professor_id: professorId,
                data,
                horario,
                conteudo,
                link_meet: meet || null,
                created_by: AppState.userProfile.id
            };

            if (id) {
                const { error } = await supabase.from('agenda_meet').update(payload).eq('id', id);
                if (error) throw error;
                showToast('Aula atualizada com sucesso', 'success');
            } else {
                const { error } = await supabase.from('agenda_meet').insert(payload);
                if (error) throw error;
                showToast('Aula agendada com sucesso', 'success');
            }

            closeModal('modal-agenda');
            await this.loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-agenda', false);
        }
    },

    openCancelar(id) {
        document.getElementById('cancel-id').value = id;
        openModal('modal-cancelar');
    },

    async cancelarAula() {
        const id = document.getElementById('cancel-id').value;
        const { error } = await supabase
            .from('agenda_meet')
            .update({ status: 'cancelada' })
            .eq('id', id);

        if (error) return showToast(error.message, 'error');

        await auditLog('AULA_CANCELADA', 'agenda_meet', id, { status: 'cancelada' });
        showToast('Aula cancelada', 'success');
        closeModal('modal-cancelar');
        await this.loadList();
    }
};
