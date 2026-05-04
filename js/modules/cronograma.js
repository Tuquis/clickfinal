// ============================================================
// MÓDULO: CRONOGRAMA
// ============================================================

Modules.Cronograma = {
    _tarefasPorDia: {},   // { 0: [{descricao, informacoes}], ... }
    _currentDia: null,

    _DIAS: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],

    async render() {
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

            <!-- ═══ MODAL CRIAR CRONOGRAMA ═══ -->
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
                                <select class="input" id="cron-aluno" onchange="Modules.Cronograma._onAlunoChange(this)">
                                    <option value="">Selecionar...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Data Final *</label>
                                <input type="date" class="input" id="cron-data-fim" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Título *</label>
                            <input type="text" class="input" id="cron-titulo" placeholder="Ex: Revisão para prova de matemática" />
                        </div>
                        <hr class="divider" />
                        <div class="form-group">
                            <label class="form-label">Modelos rápidos</label>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
                                ${[
                                    ['Semana padrão', { 1:['Leitura e interpretação de texto'], 2:['Exercícios de fixação'], 3:['Revisão do conteúdo'], 5:['Tarefa para casa'] }],
                                    ['Revisão para prova', { 1:['Revisar anotações do caderno'], 2:['Refazer exercícios errados'], 3:['Fazer simulado'], 4:['Tirar dúvidas com o professor'] }],
                                    ['Reforço', { 1:['Reforço — parte 1'], 2:['Reforço — parte 2'], 3:['Correção comentada'], 5:['Resumo do conteúdo'] }],
                                ].map(([label]) => `<button class="btn btn-secondary btn-sm" type="button"
                                    onclick="Modules.Cronograma._aplicarModelo('${label}')">${label}</button>`).join('')}
                            </div>
                            <label class="form-label">Selecione os dias e adicione as tarefas</label>
                            <div class="cron-dias-grid" id="cron-dias-grid">
                                ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((nome, i) => `
                                    <div class="cron-dia-bloco" id="cron-bloco-${i}" onclick="Modules.Cronograma._abrirDia(${i})">
                                        <span class="cron-dia-nome">${nome}</span>
                                        <span class="cron-dia-plus">+</span>
                                        <span class="cron-dia-count" id="cron-count-${i}">0 tarefas</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-cronograma')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-cron" onclick="Modules.Cronograma.save()">Salvar</button>
                    </div>
                </div>
            </div>

            <!-- ═══ SUB-MODAL: TAREFAS DO DIA ═══ -->
            <div class="modal-overlay modal-sub" id="modal-cron-dia">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3 id="modal-dia-title">Tarefas — Dia</h3>
                        <button class="modal-close" onclick="Modules.Cronograma._fecharDia()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Tarefa *</label>
                            <div class="tarefa-input-row">
                                <input type="text" class="input" id="cron-dia-tarefa"
                                    placeholder="Descreva a tarefa e pressione Enter"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();Modules.Cronograma._addTarefaDia();}" />
                                <button class="btn btn-ghost btn-sm" onclick="Modules.Cronograma._addTarefaDia()">+ Add</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Informações adicionais <span style="font-weight:400;color:var(--color-text-3)">(opcional)</span></label>
                            <textarea class="input textarea" id="cron-dia-info" rows="2"
                                placeholder="Orientações, material necessário, dicas..."></textarea>
                        </div>
                        <div id="cron-dia-lista" class="tarefas-preview mt-2"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="Modules.Cronograma._fecharDia()">Concluído</button>
                    </div>
                </div>
            </div>

            <!-- ═══ MODAL EVIDÊNCIA ═══ -->
            <div class="modal-overlay" id="modal-evidencia">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Enviar Evidência</h3>
                        <button class="modal-close" onclick="Modules.Cronograma._cancelarEvidencia()">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="ev-tarefa-id" />
                        <input type="hidden" id="ev-aluno-id" />
                        <p id="ev-tarefa-desc" class="ev-tarefa-desc-box"></p>
                        <div class="form-group">
                            <label class="form-label">📎 Foto ou arquivo da atividade</label>
                            <label class="ev-upload-area" id="ev-upload-label">
                                <input type="file" id="ev-arquivo" accept="image/*,.pdf,.doc,.docx"
                                    onchange="Modules.Cronograma._onFileChange(this)" style="display:none" />
                                <span id="ev-upload-icon">📷</span>
                                <span id="ev-upload-text">Toque para selecionar foto ou arquivo</span>
                            </label>
                            <div id="ev-preview" style="display:none"></div>
                        </div>
                    </div>
                    <div class="modal-footer" style="flex-direction:column;gap:8px">
                        <button class="btn btn-primary" style="width:100%" id="btn-save-ev"
                            onclick="Modules.Cronograma.saveEvidencia()">Enviar Evidência</button>
                        <button class="btn btn-ghost" style="width:100%;font-size:.8rem"
                            onclick="Modules.Cronograma.saveEvidencia(true)">Concluir sem evidência</button>
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

        this._tarefasPorDia = {};
        await this._loadList();
    },

    // ── ABERTURA DO DIA ─────────────────────────────────────────

    _abrirDia(dia) {
        this._currentDia = dia;
        const tarefas = this._tarefasPorDia[dia] || [];

        document.getElementById('modal-dia-title').textContent = 'Tarefas — ' + this._DIAS[dia] + '-feira'.replace('Dom-feira','mingo').replace('Sáb-feira','ábado');
        // Simplified day labels
        const labels = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
        document.getElementById('modal-dia-title').textContent = 'Tarefas — ' + labels[dia];

        document.getElementById('cron-dia-tarefa').value = '';
        document.getElementById('cron-dia-info').value = '';
        this._renderTarefasDia(tarefas);
        document.getElementById('modal-cron-dia').classList.add('modal-open');
        setTimeout(() => document.getElementById('cron-dia-tarefa')?.focus(), 100);
    },

    _fecharDia() {
        // Salva o campo de info atual se houver tarefa digitada
        const tarefaInput = document.getElementById('cron-dia-tarefa');
        if (tarefaInput?.value.trim()) this._addTarefaDia();

        document.getElementById('modal-cron-dia').classList.remove('modal-open');
        this._atualizarBloco(this._currentDia);
        this._currentDia = null;
    },

    _addTarefaDia() {
        const dia = this._currentDia;
        if (dia === null) return;
        const input = document.getElementById('cron-dia-tarefa');
        const info  = document.getElementById('cron-dia-info');
        const val   = input?.value.trim();
        if (!val) return;

        if (!this._tarefasPorDia[dia]) this._tarefasPorDia[dia] = [];
        this._tarefasPorDia[dia].push({ descricao: val, informacoes: info?.value.trim() || '' });

        input.value = '';
        info.value  = '';
        input.focus();
        this._renderTarefasDia(this._tarefasPorDia[dia]);
    },

    _removeTarefaDia(dia, idx) {
        this._tarefasPorDia[dia]?.splice(idx, 1);
        this._renderTarefasDia(this._tarefasPorDia[dia] || []);
    },

    _renderTarefasDia(tarefas) {
        const container = document.getElementById('cron-dia-lista');
        if (!container) return;
        container.innerHTML = tarefas.length
            ? tarefas.map((t, i) => `
                <div class="tarefa-preview-item">
                    <div style="flex:1">
                        <span>${escapeHtml(t.descricao)}</span>
                        ${t.informacoes ? `<div style="font-size:.72rem;color:var(--color-text-3);margin-top:2px">${escapeHtml(t.informacoes)}</div>` : ''}
                    </div>
                    <button class="btn btn-ghost btn-xs text-danger"
                        onclick="Modules.Cronograma._removeTarefaDia(${this._currentDia},${i})">×</button>
                </div>
            `).join('')
            : '<p class="text-muted small">Nenhuma tarefa adicionada</p>';
    },

    _atualizarBloco(dia) {
        const bloco = document.getElementById('cron-bloco-' + dia);
        const count = document.getElementById('cron-count-' + dia);
        if (!count) return;
        const n = (this._tarefasPorDia[dia] || []).length;
        count.textContent = n + (n === 1 ? ' tarefa' : ' tarefas');
        if (bloco) bloco.classList.toggle('cron-dia-ativo', n > 0);
    },

    // ── MODELOS RÁPIDOS ──────────────────────────────────────────

    _modelos: {
        'Semana padrão': {
            1: [{ descricao: 'Leitura e interpretação de texto', informacoes: '' }],
            2: [{ descricao: 'Exercícios de fixação', informacoes: '' }],
            3: [{ descricao: 'Revisão do conteúdo da semana', informacoes: '' }],
            5: [{ descricao: 'Tarefa para casa', informacoes: '' }]
        },
        'Revisão para prova': {
            1: [{ descricao: 'Revisar anotações do caderno', informacoes: '' }],
            2: [{ descricao: 'Refazer exercícios errados', informacoes: '' }],
            3: [{ descricao: 'Fazer simulado', informacoes: '' }],
            4: [{ descricao: 'Tirar dúvidas com o professor', informacoes: '' }]
        },
        'Reforço': {
            1: [{ descricao: 'Exercícios de reforço — parte 1', informacoes: '' }],
            2: [{ descricao: 'Exercícios de reforço — parte 2', informacoes: '' }],
            3: [{ descricao: 'Correção comentada', informacoes: '' }],
            5: [{ descricao: 'Resumo do conteúdo', informacoes: '' }]
        }
    },

    _aplicarModelo(nome) {
        const modelo = this._modelos[nome];
        if (!modelo) return;
        this._tarefasPorDia = {};
        for (const [dia, tasks] of Object.entries(modelo)) {
            this._tarefasPorDia[parseInt(dia)] = tasks.map(t => ({ ...t }));
        }
        [0,1,2,3,4,5,6].forEach(d => this._atualizarBloco(d));
    },

    _onAlunoChange(sel) {
        const nome = sel.options[sel.selectedIndex]?.text || '';
        const titulo = document.getElementById('cron-titulo');
        if (nome && nome !== 'Selecionar...') {
            titulo.value = 'Cronograma semanal — ' + nome;
        }
    },

    openCreate() {
        const today = new Date();
        // Data Final = próxima sexta-feira
        const day  = today.getDay();
        const diff = (5 - day + 7) % 7 || 7;
        const sexta = new Date(today);
        sexta.setDate(today.getDate() + diff);
        document.getElementById('cron-data-fim').value = sexta.toISOString().substring(0, 10);

        document.getElementById('cron-titulo').value = '';
        document.getElementById('cron-aluno').value  = '';
        this._tarefasPorDia = {};
        [0,1,2,3,4,5,6].forEach(d => this._atualizarBloco(d));
        openModal('modal-cronograma');
    },

    async save() {
        const alunoId  = document.getElementById('cron-aluno').value;
        const dataFim  = document.getElementById('cron-data-fim').value;
        const titulo   = document.getElementById('cron-titulo').value.trim();

        const errors = validateForm([
            { value: alunoId, label: 'Aluno',      rules: ['required'] },
            { value: dataFim, label: 'Data Final',  rules: ['required'] },
            { value: titulo,  label: 'Título',      rules: ['required'] }
        ]);

        const totalTarefas = Object.values(this._tarefasPorDia).reduce((s, a) => s + a.length, 0);
        if (totalTarefas === 0) errors.push('Adicione pelo menos uma tarefa em algum dia da semana');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-cron', true);
        try {
            const { data: cron, error: cronError } = await supabase
                .from('cronograma')
                .insert({
                    aluno_id:     alunoId,
                    admin_id:     AppState.userProfile.id,
                    semana_inicio: dataFim,
                    titulo,
                    descricao:    null
                })
                .select()
                .single();

            if (cronError) throw cronError;

            const tarefasPayload = [];
            for (const [dia, tasks] of Object.entries(this._tarefasPorDia)) {
                tasks.forEach(t => {
                    tarefasPayload.push({
                        cronograma_id: cron.id,
                        dia_semana:    parseInt(dia),
                        descricao:     t.descricao,
                        informacoes:   t.informacoes || null,
                        status:        'pendente'
                    });
                });
            }

            const { error: tarefasError } = await supabase
                .from('cronograma_tarefas')
                .insert(tarefasPayload);
            if (tarefasError) throw tarefasError;

            await auditLog('CRONOGRAMA_CRIADO', 'cronograma', cron.id, {
                aluno_id: alunoId, titulo, qtd_tarefas: totalTarefas
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

    // ── LISTA ────────────────────────────────────────────────────

    async _loadList() {
        const container = document.getElementById('cronograma-list');
        if (!container) return;

        const uid  = AppState.userProfile.id;
        const role = AppState.role;

        let query = supabase
            .from('cronograma')
            .select(`*, aluno:usuarios!cronograma_aluno_id_fkey(id,nome), tarefas:cronograma_tarefas(*)`)
            .order('semana_inicio', { ascending: false });

        if (role === 'aluno') query = query.eq('aluno_id', uid);

        const alunoFilter = document.getElementById('filter-cron-aluno')?.value;
        if (alunoFilter) query = query.eq('aluno_id', alunoFilter);

        const { data, error } = await query;
        if (error) { container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`; return; }
        if (!data?.length) { container.innerHTML = emptyState('Nenhum cronograma encontrado'); return; }

        container.innerHTML = data.map(c => {
            const tarefas   = c.tarefas || [];
            const concluidas = tarefas.filter(t => t.status === 'concluida').length;
            const total      = tarefas.length;
            const pct        = total > 0 ? Math.round((concluidas / total) * 100) : 0;
            const isAluno    = role === 'aluno';

            // Agrupar por dia_semana
            const porDia = {};
            const semDia = [];
            tarefas.forEach(t => {
                if (t.dia_semana !== null && t.dia_semana !== undefined) {
                    if (!porDia[t.dia_semana]) porDia[t.dia_semana] = [];
                    porDia[t.dia_semana].push(t);
                } else {
                    semDia.push(t);
                }
            });

            const hasDias  = Object.keys(porDia).length > 0;
            const DIAS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

            const renderTarefa = t => {
                const pendente  = t.status === 'pendente';
                const concluida = t.status === 'concluida';
                const clicavel  = isAluno && pendente;
                const temEv     = !!t.evidencia_url;
                return `
                <div class="tarefa-item ${concluida ? 'tarefa-concluida' : ''} ${clicavel ? 'tarefa-clicavel' : ''}"
                    ${clicavel ? `data-tid="${t.id}" data-aid="${c.aluno_id}" data-desc="${escapeHtml(t.descricao)}" onclick="Modules.Cronograma._openEvFromEl(this)"` : ''}>
                    <div class="tarefa-check">
                        <span class="check-icon ${clicavel ? 'check-cam' : ''}">
                            ${concluida ? '✓' : clicavel ? '📸' : '○'}
                        </span>
                    </div>
                    <div class="tarefa-body">
                        <span class="tarefa-desc">${escapeHtml(t.descricao)}</span>
                        ${t.informacoes ? `<div class="tarefa-info">${escapeHtml(t.informacoes)}</div>` : ''}
                        ${concluida && t.concluida_em
                            ? `<span class="tarefa-concluida-em">Concluída em ${fmt.datetime(t.concluida_em)}</span>`
                            : ''}
                        ${clicavel ? `<span class="tarefa-click-hint">Toque para enviar evidência</span>` : ''}
                    </div>
                    ${temEv
                        ? `<a href="${escapeHtml(t.evidencia_url)}" target="_blank" class="tarefa-ev-btn" onclick="event.stopPropagation()">📎 Evidência</a>`
                        : concluida
                            ? `<span class="tarefa-sem-ev">sem ev.</span>`
                            : ''
                    }
                </div>`;
            };

            const conteudoTarefas = hasDias
                ? Object.entries(porDia)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([dia, ts]) => `
                        <div class="cron-dia-section">
                            <div class="cron-dia-label-list">${DIAS_FULL[parseInt(dia)]}</div>
                            ${ts.map(renderTarefa).join('')}
                        </div>
                    `).join('') + semDia.map(renderTarefa).join('')
                : semDia.map(renderTarefa).join('') || '<p class="text-muted small">Sem tarefas cadastradas</p>';

            return `
                <div class="cronograma-card">
                    <div class="cronograma-header">
                        <div>
                            <h3 class="cronograma-titulo">${escapeHtml(c.titulo)}</h3>
                            ${role !== 'aluno' ? `<p class="cronograma-aluno">${escapeHtml(c.aluno?.nome || '')}</p>` : ''}
                            <p class="cronograma-semana">Data final: ${fmt.date(c.semana_inicio)}</p>
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
                    <div class="tarefas-list">${conteudoTarefas}</div>
                    ${Auth.can('admin') ? `
                    <div class="cronograma-footer">
                        <button class="btn btn-ghost btn-sm text-danger"
                            onclick="Modules.Cronograma.deleteCronograma('${c.id}')">Excluir</button>
                    </div>` : ''}
                </div>`;
        }).join('');
    },

    // ── EVIDÊNCIA ────────────────────────────────────────────────

    _openEvFromEl(el) {
        Modules.Cronograma.openEvidencia(el.dataset.tid, el.dataset.aid, el.dataset.desc);
    },

    _cancelarEvidencia() {
        closeModal('modal-evidencia');
    },

    _onFileChange(input) {
        const file    = input.files[0];
        const icon    = document.getElementById('ev-upload-icon');
        const text    = document.getElementById('ev-upload-text');
        const preview = document.getElementById('ev-preview');
        if (!file) return;

        text.textContent = file.name;
        if (icon) icon.textContent = '✅';

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                preview.style.display = 'block';
                preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:160px;border-radius:8px;margin-top:8px;object-fit:contain">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    },

    openEvidencia(tarefaId, alunoId, desc) {
        document.getElementById('ev-tarefa-id').value = tarefaId;
        document.getElementById('ev-aluno-id').value  = alunoId;
        document.getElementById('ev-arquivo').value   = '';
        const descEl = document.getElementById('ev-tarefa-desc');
        if (descEl) descEl.textContent = desc || '';
        const icon = document.getElementById('ev-upload-icon');
        const text = document.getElementById('ev-upload-text');
        const prev = document.getElementById('ev-preview');
        if (icon) icon.textContent = '📷';
        if (text) text.textContent = 'Toque para selecionar foto ou arquivo';
        if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
        openModal('modal-evidencia');
    },

    async saveEvidencia(semEvidencia) {
        const tarefaId = document.getElementById('ev-tarefa-id').value;
        const alunoId  = document.getElementById('ev-aluno-id').value;
        const file     = document.getElementById('ev-arquivo').files[0];

        if (!semEvidencia && !file) {
            return showToast('Selecione uma foto ou arquivo, ou use "Concluir sem evidência"', 'error');
        }

        setLoading('#btn-save-ev', true);
        try {
            let evidenciaUrl = null;
            if (file) {
                const ext  = file.name.split('.').pop();
                const path = `alunos/${alunoId}/evidencias/${tarefaId}-${Date.now()}.${ext}`;
                evidenciaUrl = await uploadFile('evidencias', path, file);
            }

            const { error } = await supabase
                .from('cronograma_tarefas')
                .update({
                    status:       'concluida',
                    evidencia_url: evidenciaUrl,
                    concluida_em:  new Date().toISOString()
                })
                .eq('id', tarefaId);

            if (error) throw error;

            showToast(evidenciaUrl ? 'Evidência enviada!' : 'Tarefa concluída sem evidência', 'success');
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
