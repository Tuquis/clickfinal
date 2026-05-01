// ============================================================
// MÓDULO: ALUNOS
// ============================================================

Modules.Alunos = {
    _page: 1,
    _filter: '',

    async render() {
        if (!Auth.requireRole('admin', 'psicopedagoga')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Alunos</h1>
                ${Auth.can('admin') ? `<button class="btn btn-primary" onclick="Router.navigate('usuarios')">+ Novo Aluno</button>` : ''}
            </div>
            <div class="card">
                <div class="card-toolbar">
                    <input type="text" class="input input-search" placeholder="Buscar aluno..."
                        oninput="Modules.Alunos._onSearch(this.value)" />
                </div>
                <div id="alunos-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL DETALHES ALUNO -->
            <div class="modal-overlay" id="modal-aluno-detalhe">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Ficha do Aluno</h3>
                        <button class="modal-close" onclick="closeModal('modal-aluno-detalhe')">×</button>
                    </div>
                    <div class="modal-body" id="modal-aluno-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-aluno-detalhe')">Fechar</button>
                        <button class="btn btn-secondary" id="btn-export-aluno" onclick="Modules.Alunos.exportPDF()">Exportar PDF</button>
                    </div>
                </div>
            </div>

            <!-- MODAL ADICIONAR AULAS -->
            <div class="modal-overlay" id="modal-aulas">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Adicionar Aulas</h3>
                        <button class="modal-close" onclick="closeModal('modal-aulas')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="aulas-aluno-id" />
                        <div class="form-group">
                            <label class="form-label">Quantidade de aulas a adicionar</label>
                            <input type="number" class="input" id="aulas-qtd" min="1" value="4" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-aulas')">Cancelar</button>
                        <button class="btn btn-primary" onclick="Modules.Alunos.saveAulas()">Adicionar</button>
                    </div>
                </div>
            </div>
        `);

        await this.loadList();
    },

    _onSearch: debounce(async function(v) {
        Modules.Alunos._filter = v;
        Modules.Alunos._page = 1;
        await Modules.Alunos.loadList();
    }, 400),

    async loadList() {
        const container = document.getElementById('alunos-list');
        if (!container) return;

        let query = supabase
            .from('v_alunos_completo')
            .select('*', { count: 'exact' })
            .order('nome');

        if (this._filter) {
            query = query.or(`nome.ilike.%${this._filter}%,email.ilike.%${this._filter}%,responsavel.ilike.%${this._filter}%`);
        }

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
                        <th>Nome</th>
                        <th>Série</th>
                        <th>Disciplina</th>
                        <th>Responsável</th>
                        <th>Telefone</th>
                        <th>Aulas</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data?.length
                        ? data.map(a => `
                            <tr>
                                <td>
                                    <div class="user-cell">
                                        <div class="avatar-sm">${a.nome.charAt(0).toUpperCase()}</div>
                                        <span>${escapeHtml(a.nome)}</span>
                                    </div>
                                </td>
                                <td>${escapeHtml(a.serie || '—')}</td>
                                <td>${escapeHtml(a.disciplina || '—')}</td>
                                <td>${escapeHtml(a.responsavel || '—')}</td>
                                <td>${escapeHtml(a.telefone || '—')}</td>
                                <td>
                                    <span class="aulas-badge ${(a.aulas_disponiveis || 0) === 0 ? 'aulas-zero' : ''}">
                                        ${a.aulas_disponiveis || 0}
                                    </span>
                                </td>
                                <td>${a.ativo ? badge('Ativo','badge-success') : badge('Inativo','badge-secondary')}</td>
                                <td>
                                    <div class="action-btns">
                                        <button class="btn btn-ghost btn-sm" onclick="Modules.Alunos.openDetalhe('${a.id}')">Ficha</button>
                                        ${Auth.can('admin') ? `
                                            <button class="btn btn-ghost btn-sm" onclick="Modules.Alunos.openAddAulas('${a.id}')">+ Aulas</button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')
                        : `<tr><td colspan="8">${emptyState('Nenhum aluno encontrado')}</td></tr>`
                    }
                </tbody>
            </table>
            ${paginationHtml(this._page, totalPages, 'Modules.Alunos._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Alunos._page = p;
        Modules.Alunos.loadList();
    },

    async openDetalhe(id) {
        openModal('modal-aluno-detalhe');
        this._currentAlunoId = id;
        const body = document.getElementById('modal-aluno-body');
        body.innerHTML = '<div class="loader-inline"></div>';

        const [{ data: aluno }, { data: agenda }, { data: relatorios }] = await Promise.all([
            supabase.from('v_alunos_completo').select('*').eq('id', id).single(),
            supabase.from('v_agenda_completa').select('*').eq('aluno_id', id).order('data', { ascending: false }).limit(10),
            supabase.from('relatorios').select('*').eq('aluno_id', id).order('created_at', { ascending: false }).limit(5)
        ]);

        body.innerHTML = `
            <div class="ficha-aluno" id="ficha-pdf-${id}">
                <div class="ficha-header">
                    <div class="ficha-avatar">${aluno?.nome?.charAt(0).toUpperCase()}</div>
                    <div>
                        <h2>${escapeHtml(aluno?.nome || '')}</h2>
                        <p>${escapeHtml(aluno?.email || '')}</p>
                    </div>
                </div>

                <div class="ficha-info-grid">
                    <div class="info-item"><span class="info-label">Série</span><span>${escapeHtml(aluno?.serie || '—')}</span></div>
                    <div class="info-item"><span class="info-label">Disciplina</span><span>${escapeHtml(aluno?.disciplina || '—')}</span></div>
                    <div class="info-item"><span class="info-label">Responsável</span><span>${escapeHtml(aluno?.responsavel || '—')}</span></div>
                    <div class="info-item"><span class="info-label">Telefone</span><span>${escapeHtml(aluno?.telefone || '—')}</span></div>
                    <div class="info-item"><span class="info-label">Aulas Disponíveis</span>
                        <span class="aulas-badge ${aluno?.aulas_disponiveis === 0 ? 'aulas-zero' : ''}">${aluno?.aulas_disponiveis || 0}</span>
                    </div>
                    <div class="info-item"><span class="info-label">Cadastrado em</span><span>${fmt.date(aluno?.created_at)}</span></div>
                </div>

                <h4 class="section-title">Histórico de Aulas (últimas 10)</h4>
                ${agenda?.length
                    ? `<table class="table table-sm">
                        <thead><tr><th>Data</th><th>Horário</th><th>Professor</th><th>Status</th></tr></thead>
                        <tbody>
                            ${agenda.map(a => `
                                <tr>
                                    <td>${fmt.date(a.data)}</td>
                                    <td>${fmt.time(a.horario)}</td>
                                    <td>${escapeHtml(a.professor_nome)}</td>
                                    <td>${badge(fmt.status_aula(a.status).label, fmt.status_aula(a.status).class)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`
                    : emptyState('Nenhuma aula registrada')
                }

                <h4 class="section-title">Últimos Relatórios</h4>
                ${relatorios?.length
                    ? relatorios.map(r => `
                        <div class="relatorio-mini">
                            <div class="relatorio-mini-header">
                                <span>${fmt.date(r.created_at)}</span>
                                ${badge(r.comportamento, 'badge-secondary')}
                                ${badge(r.compreensao, 'badge-secondary')}
                            </div>
                            <p class="relatorio-mini-conteudo">${escapeHtml(r.conteudo_ministrado)}</p>
                            ${r.recomendacoes ? `<p class="relatorio-mini-rec"><strong>Recomendações:</strong> ${escapeHtml(r.recomendacoes)}</p>` : ''}
                        </div>
                    `).join('')
                    : emptyState('Nenhum relatório')
                }
            </div>
        `;
    },

    openAddAulas(alunoId) {
        document.getElementById('aulas-aluno-id').value = alunoId;
        document.getElementById('aulas-qtd').value = '4';
        openModal('modal-aulas');
    },

    async saveAulas() {
        const alunoId = document.getElementById('aulas-aluno-id').value;
        const qtd = parseInt(document.getElementById('aulas-qtd').value);

        if (!qtd || qtd < 1) {
            showToast('Quantidade inválida', 'error');
            return;
        }

        const { data: current } = await supabase
            .from('alunos_info')
            .select('aulas_disponiveis')
            .eq('usuario_id', alunoId)
            .single();

        const { error } = await supabase
            .from('alunos_info')
            .update({ aulas_disponiveis: (current?.aulas_disponiveis || 0) + qtd })
            .eq('usuario_id', alunoId);

        if (error) return showToast(error.message, 'error');

        await auditLog('AULAS_ADICIONADAS', 'alunos_info', alunoId, { quantidade: qtd });
        showToast(`${qtd} aulas adicionadas com sucesso`, 'success');
        closeModal('modal-aulas');
        await this.loadList();
    },

    async exportPDF() {
        const id = this._currentAlunoId;
        if (!id) return;

        const element = document.getElementById(`ficha-pdf-${id}`);
        if (!element) return;

        try {
            showToast('Gerando PDF...', 'info', 2000);
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            let yPos = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();
            while (yPos < pdfHeight) {
                if (yPos > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -yPos, pdfWidth, pdfHeight);
                yPos += pageHeight;
            }

            pdf.save(`ficha-aluno-${Date.now()}.pdf`);
            showToast('PDF exportado com sucesso', 'success');
        } catch (err) {
            showToast('Erro ao gerar PDF: ' + err.message, 'error');
        }
    }
};
