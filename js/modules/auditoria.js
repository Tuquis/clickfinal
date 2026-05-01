// ============================================================
// MÓDULO: AUDITORIA (apenas admin)
// ============================================================

Modules.Auditoria = {
    _page: 1,

    async render() {
        if (!Auth.requireRole('admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Auditoria</h1>
                <button class="btn btn-secondary" onclick="Modules.Auditoria.exportCSV()">Exportar CSV</button>
            </div>
            <div class="card">
                <div class="card-toolbar">
                    <input type="text" class="input input-search" id="filter-audit-acao"
                        placeholder="Filtrar por ação..." oninput="Modules.Auditoria._filter(this.value)" />
                    <select class="input" id="filter-audit-tabela" onchange="Modules.Auditoria._load()">
                        <option value="">Todas as tabelas</option>
                        <option value="usuarios">usuarios</option>
                        <option value="agenda_meet">agenda_meet</option>
                        <option value="relatorios">relatorios</option>
                        <option value="financeiro">financeiro</option>
                        <option value="cronograma">cronograma</option>
                        <option value="alunos_info">alunos_info</option>
                    </select>
                    <input type="date" class="input" id="filter-audit-data" onchange="Modules.Auditoria._load()" />
                </div>
                <div id="auditoria-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>
        `);

        await this._load();
    },

    _filter: debounce(async function(v) {
        Modules.Auditoria._acaoFilter = v;
        Modules.Auditoria._page = 1;
        await Modules.Auditoria._load();
    }, 400),

    _acaoFilter: '',

    async _load() {
        const container = document.getElementById('auditoria-list');
        if (!container) return;

        let query = supabase
            .from('audit_log')
            .select(`
                *,
                usuario:usuarios!audit_log_usuario_id_fkey(nome,email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        const tabela = document.getElementById('filter-audit-tabela')?.value;
        const data = document.getElementById('filter-audit-data')?.value;
        if (tabela) query = query.eq('tabela', tabela);
        if (this._acaoFilter) query = query.ilike('acao', `%${this._acaoFilter}%`);
        if (data) {
            query = query.gte('created_at', data + 'T00:00:00')
                         .lte('created_at', data + 'T23:59:59');
        }

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data: logs, error, count } = await query;

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Ação</th>
                        <th>Usuário</th>
                        <th>Tabela</th>
                        <th>Dados</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs?.length
                        ? logs.map(l => `
                            <tr>
                                <td class="td-nowrap">${fmt.datetime(l.created_at)}</td>
                                <td>${badge(escapeHtml(l.acao), Modules.Auditoria._badgeAcao(l.acao))}</td>
                                <td>${l.usuario ? escapeHtml(l.usuario.nome) : '—'}</td>
                                <td><code>${escapeHtml(l.tabela)}</code></td>
                                <td>
                                    ${l.dados_novos
                                        ? `<button class="btn btn-ghost btn-xs" onclick="Modules.Auditoria.verDados(this)"
                                            data-json='${escapeHtml(JSON.stringify(l.dados_novos))}'>Ver dados</button>`
                                        : '—'
                                    }
                                </td>
                            </tr>
                        `).join('')
                        : `<tr><td colspan="5">${emptyState('Nenhum log encontrado')}</td></tr>`
                    }
                </tbody>
            </table>
            ${paginationHtml(this._page, totalPages, 'Modules.Auditoria._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Auditoria._page = p;
        Modules.Auditoria._load();
    },

    _badgeAcao(acao) {
        if (acao.includes('CRIADO') || acao.includes('ADICIONADO')) return 'badge-success';
        if (acao.includes('EXCLUÍDO') || acao.includes('CANCELADO') || acao.includes('DESATIVADO')) return 'badge-danger';
        if (acao.includes('ATUALIZADO') || acao.includes('ALTERADO') || acao.includes('PAGO')) return 'badge-info';
        return 'badge-secondary';
    },

    verDados(btn) {
        try {
            const json = JSON.parse(btn.getAttribute('data-json'));
            const formatted = JSON.stringify(json, null, 2);
            // Mostrar em um toast especial ou mini-modal
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay modal-open';
            overlay.innerHTML = `
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Dados do Log</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">×</button>
                    </div>
                    <div class="modal-body">
                        <pre class="code-block">${escapeHtml(formatted)}</pre>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
        } catch (_) {
            showToast('Erro ao ler dados', 'error');
        }
    },

    async exportCSV() {
        const { data: logs } = await supabase
            .from('audit_log')
            .select('*, usuario:usuarios!audit_log_usuario_id_fkey(nome,email)')
            .order('created_at', { ascending: false })
            .limit(5000);

        if (!logs?.length) return showToast('Nenhum dado para exportar', 'warning');

        const rows = [
            ['Data/Hora', 'Ação', 'Usuário', 'Email', 'Tabela', 'Registro ID'],
            ...logs.map(l => [
                fmt.datetime(l.created_at),
                l.acao,
                l.usuario?.nome || '',
                l.usuario?.email || '',
                l.tabela,
                l.registro_id || ''
            ])
        ];

        const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria-${todayISO()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exportado', 'success');
    }
};
