// ============================================================
// MÓDULO: ATIVIDADES
// ============================================================

Modules.Atividades = {
    _page: 1,

    async render() {
        const isProf  = Auth.can('professor');
        const isAluno = Auth.can('aluno');

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

            <!-- MODAL RESPONDER ATIVIDADE (aluno) -->
            <div class="modal-overlay" id="modal-resposta-atividade">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Responder Atividade</h3>
                        <button class="modal-close" onclick="closeModal('modal-resposta-atividade')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="resp-atividade-id" />
                        <p id="resp-atividade-titulo" style="font-weight:600;margin-bottom:16px;color:var(--color-text-1)"></p>
                        <div style="display:flex;gap:12px;margin-bottom:16px;">
                            <button type="button" class="btn btn-secondary" style="flex:1"
                                onclick="document.getElementById('resp-arquivo-foto').click()">
                                📸 Tirar Foto
                            </button>
                            <button type="button" class="btn btn-ghost" style="flex:1"
                                onclick="document.getElementById('resp-arquivo-doc').click()">
                                📁 Selecionar Arquivo
                            </button>
                        </div>
                        <!-- input câmera -->
                        <input type="file" id="resp-arquivo-foto" accept="image/*" capture="environment"
                            style="display:none" onchange="Modules.Atividades._onArquivoSelecionado(this)" />
                        <!-- input arquivo geral -->
                        <input type="file" id="resp-arquivo-doc"
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                            style="display:none" onchange="Modules.Atividades._onArquivoSelecionado(this)" />

                        <div id="resp-arquivo-preview" style="display:none;padding:12px 14px;background:var(--color-surface-2);border-radius:var(--radius-sm);border:1px solid var(--color-border);">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span id="resp-arquivo-icone" style="font-size:1.5rem">📄</span>
                                <div>
                                    <div id="resp-arquivo-nome" style="font-weight:600;font-size:.9rem"></div>
                                    <div id="resp-arquivo-tamanho" style="font-size:.8rem;color:var(--color-text-3)"></div>
                                </div>
                                <button type="button" onclick="Modules.Atividades._limparArquivo()"
                                    style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--color-text-3);font-size:1.2rem">×</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-resposta-atividade')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-enviar-resposta"
                            onclick="Modules.Atividades.enviarResposta()" disabled>Enviar Resposta</button>
                    </div>
                </div>
            </div>

            <!-- MODAL VER RESPOSTAS (professor) -->
            <div class="modal-overlay" id="modal-respostas-prof">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3 id="modal-respostas-titulo">Respostas</h3>
                        <button class="modal-close" onclick="closeModal('modal-respostas-prof')">×</button>
                    </div>
                    <div class="modal-body" id="modal-respostas-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-respostas-prof')">Fechar</button>
                    </div>
                </div>
            </div>
        `);

        if (isProf) {
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

        const uid     = AppState.userProfile.id;
        const isProf  = Auth.can('professor');
        const isAluno = Auth.can('aluno');

        let query = supabase
            .from('atividades')
            .select(`
                *,
                aluno:usuarios!atividades_aluno_id_fkey(nome),
                professor:usuarios!atividades_professor_id_fkey(nome)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (isProf)  query = query.eq('professor_id', uid);
        if (isAluno) query = query.eq('aluno_id', uid);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        // Carregar respostas em paralelo
        let respostasPromise = Promise.resolve({ data: [] });
        if (isAluno) {
            respostasPromise = supabase
                .from('respostas_atividades')
                .select('atividade_id')
                .eq('aluno_id', uid);
        } else if (isProf) {
            respostasPromise = supabase
                .from('respostas_atividades')
                .select(`atividade_id, id, arquivo_url, arquivo_nome, visualizado, created_at,
                    aluno:usuarios!respostas_atividades_aluno_id_fkey(nome)`);
        }

        const [{ data, error, count }, { data: respostasData }] = await Promise.all([query, respostasPromise]);

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        // Montar índices de respostas
        const respostasAluno = new Set((respostasData || []).map(r => r.atividade_id)); // aluno: set de atividades já respondidas
        const respostasProf  = {};  // professor: { atividade_id: [respostas] }
        if (isProf) {
            (respostasData || []).forEach(r => {
                if (!respostasProf[r.atividade_id]) respostasProf[r.atividade_id] = [];
                respostasProf[r.atividade_id].push(r);
            });
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhuma atividade encontrada');
            return;
        }

        container.innerHTML = `
            <div class="atividades-grid">
                ${data.map(a => {
                    const jaRespondeu  = isAluno && respostasAluno.has(a.id);
                    const respostas    = isProf ? (respostasProf[a.id] || []) : [];
                    const naoLidas     = respostas.filter(r => !r.visualizado).length;

                    return `
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
                            ${isAluno
                                ? jaRespondeu
                                    ? `<span class="badge badge-success" style="padding:6px 12px">✓ Respondida</span>`
                                    : `<button class="btn btn-primary btn-sm"
                                        onclick="Modules.Atividades.openResponder('${a.id}','${escapeHtml(a.titulo).replace(/'/g,"\\'")}')">
                                        📝 Responder Atividade
                                    </button>`
                                : ''
                            }
                            ${isProf
                                ? `<button class="btn btn-ghost btn-sm" style="position:relative"
                                    onclick="Modules.Atividades.verRespostas('${a.id}','${escapeHtml(a.titulo).replace(/'/g,"\\'")}')">
                                    📋 Respostas${respostas.length > 0 ? ` (${respostas.length})` : ''}
                                    ${naoLidas > 0 ? `<span class="notif-badge">${naoLidas}</span>` : ''}
                                  </button>`
                                : ''
                            }
                            ${Auth.can('professor') && a.professor_id === uid
                                ? `<button class="btn btn-ghost btn-sm text-danger"
                                    onclick="Modules.Atividades.deletar('${a.id}')">Excluir</button>`
                                : ''
                            }
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            ${paginationHtml(this._page, totalPages, 'Modules.Atividades._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Atividades._page = p;
        Modules.Atividades._loadList();
    },

    openCreate() {
        document.getElementById('atv-aluno').value    = '';
        document.getElementById('atv-titulo').value   = '';
        document.getElementById('atv-descricao').value = '';
        document.getElementById('atv-prazo').value    = '';
        document.getElementById('atv-arquivo').value  = '';
        openModal('modal-atividade');
    },

    async save() {
        const alunoId  = document.getElementById('atv-aluno').value;
        const titulo   = document.getElementById('atv-titulo').value.trim();
        const descricao = document.getElementById('atv-descricao').value.trim();
        const prazo    = document.getElementById('atv-prazo').value;
        const file     = document.getElementById('atv-arquivo').files[0];

        const errors = validateForm([
            { value: alunoId, label: 'Aluno',  rules: ['required'] },
            { value: titulo,  label: 'Título', rules: ['required'] }
        ]);
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-atv', true);
        try {
            let arquivoUrl = null;
            if (file) {
                const safeName = sanitizeStorageName(file.name);
                const path = `professores/${AppState.userProfile.id}/materiais/${Date.now()}-${safeName}`;
                arquivoUrl = await uploadFile('materiais', path, file);
            }

            const { error } = await supabase.from('atividades').insert({
                professor_id: AppState.userProfile.id,
                aluno_id:     alunoId,
                titulo,
                descricao:    descricao || null,
                prazo:        prazo || null,
                arquivo_url:  arquivoUrl
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

    // ── RESPONDER ATIVIDADE (aluno) ───────────────────────────
    openResponder(atividadeId, titulo) {
        document.getElementById('resp-atividade-id').value    = atividadeId;
        document.getElementById('resp-atividade-titulo').textContent = titulo;
        document.getElementById('resp-arquivo-foto').value    = '';
        document.getElementById('resp-arquivo-doc').value     = '';
        document.getElementById('resp-arquivo-preview').style.display = 'none';
        document.getElementById('btn-enviar-resposta').disabled = true;
        this._arquivoSelecionado = null;
        openModal('modal-resposta-atividade');
    },

    _onArquivoSelecionado(input) {
        const file = input.files[0];
        if (!file) return;
        this._arquivoSelecionado = file;

        const isImagem = file.type.startsWith('image/');
        document.getElementById('resp-arquivo-icone').textContent = isImagem ? '🖼️' : '📄';
        document.getElementById('resp-arquivo-nome').textContent  = file.name;
        document.getElementById('resp-arquivo-tamanho').textContent =
            file.size > 1024 * 1024
                ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                : Math.round(file.size / 1024) + ' KB';

        document.getElementById('resp-arquivo-preview').style.display = 'block';
        document.getElementById('btn-enviar-resposta').disabled = false;
    },

    _limparArquivo() {
        document.getElementById('resp-arquivo-foto').value = '';
        document.getElementById('resp-arquivo-doc').value  = '';
        document.getElementById('resp-arquivo-preview').style.display = 'none';
        document.getElementById('btn-enviar-resposta').disabled = true;
        this._arquivoSelecionado = null;
    },

    async enviarResposta() {
        const file       = this._arquivoSelecionado;
        const atividadeId = document.getElementById('resp-atividade-id').value;
        if (!file || !atividadeId) return showToast('Selecione um arquivo', 'error');

        setLoading('#btn-enviar-resposta', true);
        try {
            const safeName = sanitizeStorageName(file.name);
            const path     = `respostas/${atividadeId}/${AppState.userProfile.id}-${Date.now()}-${safeName}`;
            const url      = await uploadFile('materiais', path, file);

            const { error } = await supabase.from('respostas_atividades').insert({
                atividade_id: atividadeId,
                aluno_id:     AppState.userProfile.id,
                arquivo_url:  url,
                arquivo_nome: file.name
            });
            if (error) throw error;

            showToast('Resposta enviada com sucesso!', 'success');
            closeModal('modal-resposta-atividade');
            await this._loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao enviar resposta', 'error');
        } finally {
            setLoading('#btn-enviar-resposta', false);
        }
    },

    // ── VER RESPOSTAS (professor) ─────────────────────────────
    async verRespostas(atividadeId, titulo) {
        document.getElementById('modal-respostas-titulo').textContent = `Respostas — ${titulo}`;
        document.getElementById('modal-respostas-body').innerHTML = '<div class="loader-inline"></div>';
        openModal('modal-respostas-prof');

        const { data: respostas, error } = await supabase
            .from('respostas_atividades')
            .select(`id, arquivo_url, arquivo_nome, visualizado, created_at,
                aluno:usuarios!respostas_atividades_aluno_id_fkey(nome)`)
            .eq('atividade_id', atividadeId)
            .order('created_at', { ascending: false });

        if (error) {
            document.getElementById('modal-respostas-body').innerHTML =
                `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!respostas?.length) {
            document.getElementById('modal-respostas-body').innerHTML =
                emptyState('Nenhum aluno respondeu ainda');
            return;
        }

        document.getElementById('modal-respostas-body').innerHTML = `
            <table class="table">
                <thead><tr>
                    <th>Aluno</th><th>Enviado em</th><th>Arquivo</th><th>Status</th>
                </tr></thead>
                <tbody>
                    ${respostas.map(r => `
                        <tr>
                            <td><strong>${escapeHtml(r.aluno?.nome || '—')}</strong></td>
                            <td>${fmt.date(r.created_at)}</td>
                            <td>
                                <a href="${escapeHtml(r.arquivo_url)}" target="_blank"
                                    class="btn btn-ghost btn-sm">
                                    📎 ${escapeHtml(r.arquivo_nome || 'Ver arquivo')}
                                </a>
                            </td>
                            <td>${r.visualizado
                                ? badge('Visto', 'badge-secondary')
                                : badge('Novo', 'badge-info')
                            }</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Marcar todas as respostas não lidas desta atividade como visualizadas
        const naoLidas = respostas.filter(r => !r.visualizado).map(r => r.id);
        if (naoLidas.length) {
            await supabase
                .from('respostas_atividades')
                .update({ visualizado: true })
                .in('id', naoLidas);
            // Atualizar badges na lista sem recarregar tudo
            await this._loadList();
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
