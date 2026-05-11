// ============================================================
// MÓDULO: AGENDA
// ============================================================

Modules.Agenda = {
    _page: 1,
    _tab: 'agenda',
    _view: 'calendar', // 'calendar' | 'list'
    _filters: { status: '', data: '' },
    _weekStart: null,
    _calData: [],

    // ── helpers de semana ──────────────────────────────────────
    _getWeekStart(d) {
        const date = d ? new Date(d) : new Date();
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    },

    _getWeekDates() {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(this._weekStart);
            d.setDate(this._weekStart.getDate() + i);
            week.push(d);
        }
        return week;
    },

    _isoDate(d) {
        return d.toISOString().split('T')[0];
    },

    _profColor(profId) {
        if (!profId) return 0;
        let hash = 0;
        for (let i = 0; i < profId.length; i++) hash = profId.charCodeAt(i) + ((hash << 5) - hash);
        return Math.abs(hash) % 8;
    },

    _weekLabel() {
        const dates = this._getWeekDates();
        const start = dates[0];
        const end = dates[6];
        const opts = { day: 'numeric', month: 'long' };
        if (start.getMonth() === end.getMonth()) {
            return `${start.getDate()} – ${end.toLocaleDateString('pt-BR', opts)} de ${start.getFullYear()}`;
        }
        return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', opts)} ${end.getFullYear()}`;
    },

    // ── render principal ───────────────────────────────────────
    async render() {
        this._tab = 'agenda';
        this._page = 1;
        this._filters = { status: '', data: '' };
        this._weekStart = this._getWeekStart();

        const isAdmin = Auth.can('admin');
        const isProf  = Auth.can('professor');
        const isAluno = Auth.can('aluno');

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Agenda${isProf ? ' — Minhas Aulas' : isAluno ? ' — Minhas Aulas' : ''}</h1>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    ${isAdmin ? `<button class="btn btn-primary" onclick="Modules.Agenda.openCreate()">+ Agendar Aula</button>` : ''}
                </div>
            </div>

            <div class="tabs-bar">
                <button class="tab-btn active" id="tab-btn-agenda"    onclick="Modules.Agenda._setTab('agenda')">Agenda</button>
                <button class="tab-btn"        id="tab-btn-historico" onclick="Modules.Agenda._setTab('historico')">Histórico</button>
            </div>

            <!-- barra de controles -->
            <div class="card" style="margin-bottom:16px;">
                <div class="card-toolbar" id="agenda-toolbar" style="justify-content:space-between;">
                    <!-- filtros (mostrados em lista / histórico) -->
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;" id="agenda-filters">
                        <select class="input" id="filter-status-agenda" onchange="Modules.Agenda._applyFilter()" style="display:none;max-width:180px;">
                            <option value="">Todos os status</option>
                            <option value="agendada">Agendada</option>
                            <option value="realizada">Realizada</option>
                            <option value="cancelada">Cancelada</option>
                        </select>
                        <input type="date" class="input" id="filter-data-agenda" onchange="Modules.Agenda._applyFilter()" style="max-width:160px;" />
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._clearFilters()">Limpar</button>
                    </div>
                    <!-- navegação calendário -->
                    <div id="cal-nav-controls" style="display:flex;gap:8px;align-items:center;">
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._prevWeek()">&#8592;</button>
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._today()">Hoje</button>
                        <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._nextWeek()">&#8594;</button>
                        <span class="cal-period" id="cal-period-label"></span>
                    </div>
                    <!-- toggle de visualização -->
                    <div class="view-toggle" id="view-toggle-btns">
                        <button class="view-toggle-btn active" id="vt-calendar" onclick="Modules.Agenda._setView('calendar')">📅 Calendário</button>
                        <button class="view-toggle-btn"         id="vt-list"     onclick="Modules.Agenda._setView('list')">☰ Lista</button>
                    </div>
                </div>
            </div>

            <!-- conteúdo principal -->
            <div id="agenda-main">
                <div class="loader-inline"></div>
            </div>

            <!-- MODAL DETALHES DA AULA -->
            <div class="modal-overlay" id="modal-aula-detalhes">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Detalhes da Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-aula-detalhes')">×</button>
                    </div>
                    <div class="modal-body" id="modal-detalhes-body" style="gap:12px;">
                    </div>
                    <div class="modal-footer" id="modal-detalhes-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-aula-detalhes')">Fechar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL CONTEÚDO COMPLETO -->
            <div class="modal-overlay" id="modal-conteudo-aula">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Conteúdo da Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-conteudo-aula')">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="conteudo-aula-text" style="font-size:.9375rem;line-height:1.7;white-space:pre-wrap;"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-conteudo-aula')">Fechar</button>
                    </div>
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
                                <select class="input" id="ag-aluno"><option value="">Carregando...</option></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Professor *</label>
                                <select class="input" id="ag-professor"><option value="">Carregando...</option></select>
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
                            <label class="form-label">Link Google Meet <span style="font-size:.75rem;color:var(--color-text-3)">(preenchido automaticamente pelo professor)</span></label>
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

        document.getElementById('ag-professor')?.addEventListener('change', async (e) => {
            const profId = e.target.value;
            if (!profId) { document.getElementById('ag-disponibilidade-info').style.display = 'none'; return; }
            Modules.Agenda._showDisponibilidade(profId);
            const { data: pi } = await supabase.from('professores_info').select('link_meet').eq('usuario_id', profId).single();
            const meetInput = document.getElementById('ag-meet');
            if (meetInput && pi?.link_meet) meetInput.value = pi.link_meet;
        });

        this._updateUI();
        await this.loadList();
    },

    // ── tabs ───────────────────────────────────────────────────
    _setTab(tab) {
        this._tab = tab;
        this._page = 1;
        this._filters = { status: '', data: '' };

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-btn-' + tab)?.classList.add('active');

        if (document.getElementById('filter-data-agenda'))
            document.getElementById('filter-data-agenda').value = '';

        this._updateUI();
        this.loadList();
    },

    _setView(view) {
        this._view = view;
        this._page = 1;
        this._updateUI();
        this.loadList();
    },

    _updateUI() {
        const isHistorico   = this._tab === 'historico';
        const isCalendar    = this._view === 'calendar' && !isHistorico;

        // toggle view buttons
        document.getElementById('vt-calendar')?.classList.toggle('active', !isHistorico && this._view === 'calendar');
        document.getElementById('vt-list')?.classList.toggle('active',     isHistorico || this._view === 'list');

        // mostrar/esconder navegação de semana
        const calNav = document.getElementById('cal-nav-controls');
        if (calNav) calNav.style.display = isCalendar ? 'flex' : 'none';

        // mostrar/esconder filtros
        const statusSel = document.getElementById('filter-status-agenda');
        if (statusSel) statusSel.style.display = isHistorico ? '' : 'none';

        // atualizar label semana
        if (isCalendar) {
            const lbl = document.getElementById('cal-period-label');
            if (lbl) lbl.textContent = this._weekLabel();
        }
    },

    // ── filtros (lista / histórico) ────────────────────────────
    _applyFilter() {
        this._filters.status = document.getElementById('filter-status-agenda')?.value || '';
        this._filters.data   = document.getElementById('filter-data-agenda')?.value || '';
        this._page = 1;
        this.loadList();
    },

    _clearFilters() {
        const statusEl = document.getElementById('filter-status-agenda');
        const dataEl   = document.getElementById('filter-data-agenda');
        if (statusEl) statusEl.value = '';
        if (dataEl)   dataEl.value   = '';
        this._filters = { status: '', data: '' };
        this._page = 1;
        this.loadList();
    },

    // ── navegação de semana ────────────────────────────────────
    _prevWeek() {
        this._weekStart = new Date(this._weekStart);
        this._weekStart.setDate(this._weekStart.getDate() - 7);
        const lbl = document.getElementById('cal-period-label');
        if (lbl) lbl.textContent = this._weekLabel();
        this.loadList();
    },

    _nextWeek() {
        this._weekStart = new Date(this._weekStart);
        this._weekStart.setDate(this._weekStart.getDate() + 7);
        const lbl = document.getElementById('cal-period-label');
        if (lbl) lbl.textContent = this._weekLabel();
        this.loadList();
    },

    _today() {
        this._weekStart = this._getWeekStart();
        const lbl = document.getElementById('cal-period-label');
        if (lbl) lbl.textContent = this._weekLabel();
        this.loadList();
    },

    // ── carregamento de dados ──────────────────────────────────
    async loadList() {
        const container = document.getElementById('agenda-main');
        if (!container) return;
        container.innerHTML = '<div class="loader-inline"></div>';

        const uid         = AppState.userProfile.id;
        const role        = AppState.role;
        const isHistorico = this._tab === 'historico';
        const isCalendar  = this._view === 'calendar' && !isHistorico;

        if (isCalendar) {
            await this._loadCalendar(container, uid, role);
        } else {
            await this._loadListView(container, uid, role, isHistorico);
        }
    },

    // ── VISUALIZAÇÃO CALENDÁRIO ────────────────────────────────
    async _loadCalendar(container, uid, role) {
        const weekDates = this._getWeekDates();
        const startISO  = this._isoDate(weekDates[0]);
        const endISO    = this._isoDate(weekDates[6]);

        let query = supabase
            .from('v_agenda_completa')
            .select('*')
            .gte('data', startISO)
            .lte('data', endISO)
            .eq('status', 'agendada')
            .order('horario', { ascending: true });

        if (role === 'professor') query = query.eq('professor_id', uid);
        if (role === 'aluno')     query = query.eq('aluno_id', uid);

        const { data, error } = await query;
        if (error) { container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`; return; }

        // agrupa por data
        const byDate = {};
        weekDates.forEach(d => { byDate[this._isoDate(d)] = []; });
        (data || []).forEach(a => { if (byDate[a.data]) byDate[a.data].push(a); });

        const today     = todayISO();
        const isAdmin   = Auth.can('admin');
        const dayNames  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

        const totalAulas = (data || []).length;

        container.innerHTML = `
            <div class="cal-summary">
                ${totalAulas === 0
                    ? `<span class="cal-summary-empty">Nenhuma aula agendada nesta semana</span>`
                    : `<span class="cal-summary-count">${totalAulas} aula${totalAulas !== 1 ? 's' : ''} nesta semana</span>`
                }
            </div>
            <div class="cal-scroll-wrapper">
            <div class="cal-week-grid">
                ${weekDates.map((d, i) => {
                    const iso        = this._isoDate(d);
                    const isToday    = iso === today;
                    const dayNum     = d.getDate();
                    const dayName    = dayNames[i];
                    const lessons    = byDate[iso] || [];
                    const hasLessons = lessons.length > 0;

                    return `
                        <div class="cal-day-col ${isToday ? 'cal-today' : ''} ${hasLessons ? 'cal-has-events' : ''}">
                            <div class="cal-day-header">
                                <div class="cal-day-name">${dayName}</div>
                                <div class="cal-day-num">${dayNum}</div>
                                ${hasLessons ? `<div class="cal-day-count">${lessons.length}</div>` : ''}
                            </div>
                            <div class="cal-day-body">
                                ${lessons.length === 0
                                    ? `<div class="cal-empty-day">—</div>`
                                    : lessons.map(a => {
                                        const colorIdx = this._profColor(a.professor_id);
                                        return `
                                            <div class="cal-event cal-color-${colorIdx}">
                                                <div onclick="Modules.Agenda.viewDetails('${a.id}')">
                                                    <div class="cal-event-time">🕐 ${fmt.time(a.horario)}</div>
                                                    <div class="cal-event-aluno">${escapeHtml(a.aluno_nome)}</div>
                                                    <div class="cal-event-prof">👤 ${escapeHtml(a.professor_nome)}</div>
                                                    <div class="cal-event-subject">${escapeHtml(a.disciplina || '')}${a.disciplina && a.conteudo ? ' · ' : ''}${escapeHtml((a.conteudo||'').substring(0,40))}${(a.conteudo||'').length > 40 ? '…' : ''}</div>
                                                    ${a.link_meet ? `<div class="cal-event-meet">📹 Meet</div>` : ''}
                                                </div>
                                                <div class="cal-event-actions">
                                                    <button class="cal-event-chat-btn" onclick="event.stopPropagation();Modules.Chat.open('${a.id}')" title="Chat com aluno/professor">💬</button>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')
                                }
                                ${isAdmin && iso >= today ? `
                                    <button class="cal-add-btn" onclick="Modules.Agenda.openCreateOnDate('${iso}')">+ Aula</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            </div><!-- fim cal-scroll-wrapper -->
        `;
    },

    // ── VISUALIZAÇÃO LISTA ─────────────────────────────────────
    async _loadListView(container, uid, role, isHistorico) {
        let query = supabase
            .from('v_agenda_completa')
            .select('*', { count: 'exact' });

        if (role === 'professor') query = query.eq('professor_id', uid);
        if (role === 'aluno')     query = query.eq('aluno_id', uid);

        if (isHistorico) {
            query = query
                .or(`data.lt.${todayISO()},status.in.(realizada,cancelada)`)
                .order('data', { ascending: false })
                .order('horario', { ascending: false });
            if (this._filters.status) query = query.eq('status', this._filters.status);
        } else {
            query = query
                .eq('status', 'agendada')
                .gte('data', todayISO())
                .order('data', { ascending: true })
                .order('horario', { ascending: true });
        }

        if (this._filters.data) query = query.eq('data', this._filters.data);

        const from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        const { data, error, count } = await query;
        if (error) { container.innerHTML = `<p class="text-danger">Erro: ${escapeHtml(error.message)}</p>`; return; }

        let displayData = data || [];
        if (!isHistorico) {
            const now = new Date();
            displayData = displayData.filter(a => {
                if (a.data !== todayISO()) return true;
                const [h, m] = (a.horario || '00:00').split(':').map(Number);
                const expiry = new Date(); expiry.setHours(h, m + 60, 0, 0);
                return expiry > now;
            });
        }

        const totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);
        const isAdmin    = Auth.can('admin');

        // Agrupa por data para visual de lista estilo "agenda"
        const groups = {};
        displayData.forEach(a => {
            if (!groups[a.data]) groups[a.data] = [];
            groups[a.data].push(a);
        });

        const datesOrdered = Object.keys(groups).sort();

        container.innerHTML = `
            <div class="agenda-list-view">
                ${datesOrdered.length === 0
                    ? `<div class="empty-state"><div class="empty-icon">📅</div><p>${isHistorico ? 'Nenhum histórico encontrado' : 'Nenhuma aula agendada'}</p></div>`
                    : datesOrdered.map(dateStr => {
                        const aulas   = groups[dateStr];
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                        const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                        const isToday = dateStr === todayISO();

                        return `
                            <div class="agenda-date-group">
                                <div class="agenda-date-label ${isToday ? 'agenda-date-today' : ''}">
                                    <span class="agenda-date-dia">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</span>
                                    <span class="agenda-date-full">${dateFormatted}</span>
                                    ${isToday ? '<span class="badge badge-info" style="font-size:.65rem;">Hoje</span>' : ''}
                                </div>
                                <div class="agenda-date-aulas">
                                    ${aulas.map(a => {
                                        const s          = fmt.status_aula(a.status);
                                        const colorIdx   = this._profColor(a.professor_id);
                                        return `
                                            <div class="agenda-aula-card agenda-color-${colorIdx}">
                                                <div class="agenda-aula-time">${fmt.time(a.horario)}</div>
                                                <div class="agenda-aula-info">
                                                    <div class="agenda-aula-top">
                                                        <span class="agenda-aula-aluno">${escapeHtml(a.aluno_nome)}</span>
                                                        <span class="agenda-aula-prof">com ${escapeHtml(a.professor_nome)}</span>
                                                        ${badge(s.label, s.class)}
                                                    </div>
                                                    ${a.disciplina ? `<div class="agenda-aula-disc">${escapeHtml(a.disciplina)}</div>` : ''}
                                                    <div class="agenda-aula-conteudo" onclick="Modules.Agenda.openConteudo('${a.id}')" title="Ver conteúdo completo">
                                                        📝 ${escapeHtml((a.conteudo||'').substring(0,80))}${(a.conteudo||'').length > 80 ? '…' : ''}
                                                        <span class="conteudo-hint">ver mais</span>
                                                    </div>
                                                </div>
                                                <div class="agenda-aula-actions">
                                                    ${a.link_meet ? `<a href="${escapeHtml(a.link_meet)}" target="_blank" class="btn btn-ghost btn-sm">📹 Meet</a>` : ''}
                                                    <button class="btn btn-ghost btn-sm" onclick="Modules.Agenda.viewDetails('${a.id}')">Detalhes</button>
                                                    <button class="btn btn-ghost btn-sm btn-chat" onclick="Modules.Chat.open('${a.id}')">💬 Chat</button>
                                                    ${a.status === 'agendada' && Auth.can('professor') && a.professor_id === uid && !a.relatorio_id
                                                        ? `<button class="btn btn-sm btn-primary" onclick="Modules.Agenda._abrirRelatorio('${a.aluno_id}')">Relatório</button>`
                                                        : ''}
                                                    ${a.relatorio_id
                                                        ? `<button class="btn btn-ghost btn-sm" onclick="Modules.Agenda._verRelatorio('${a.relatorio_id}')">Ver Rel.</button>`
                                                        : ''}
                                                    ${isAdmin && a.status === 'agendada'
                                                        ? `<button class="btn btn-ghost btn-sm text-danger" onclick="Modules.Agenda.openCancelar('${a.id}')">Cancelar</button>`
                                                        : ''}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
            ${paginationHtml(this._page, totalPages, 'Modules.Agenda._goPage')}
        `;
    },

    _goPage(p) {
        Modules.Agenda._page = p;
        Modules.Agenda.loadList();
    },

    // ── MODAL DETALHES (clique no evento do calendário) ────────
    async viewDetails(id) {
        const { data: a, error } = await supabase
            .from('v_agenda_completa')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !a) return showToast('Erro ao carregar detalhes', 'error');

        const s       = fmt.status_aula(a.status);
        const isAdmin = Auth.can('admin');
        const uid     = AppState.userProfile.id;

        document.getElementById('modal-detalhes-body').innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>
                    <div class="form-label" style="margin-bottom:4px;">Aluno</div>
                    <div style="font-weight:600;font-size:1rem;">${escapeHtml(a.aluno_nome)}</div>
                    ${a.serie ? `<div style="font-size:.8125rem;color:var(--color-text-3);">${escapeHtml(a.serie)} — ${escapeHtml(a.disciplina||'')}</div>` : ''}
                </div>
                <div>
                    <div class="form-label" style="margin-bottom:4px;">Professor</div>
                    <div style="font-weight:600;font-size:1rem;">${escapeHtml(a.professor_nome)}</div>
                </div>
                <div>
                    <div class="form-label" style="margin-bottom:4px;">Data</div>
                    <div style="font-weight:600;">${fmt.date(a.data)}</div>
                </div>
                <div>
                    <div class="form-label" style="margin-bottom:4px;">Horário</div>
                    <div style="font-weight:600;">${fmt.time(a.horario)}</div>
                </div>
            </div>
            <div>
                <div class="form-label" style="margin-bottom:6px;">Status</div>
                ${badge(s.label, s.class)}
            </div>
            <div>
                <div class="form-label" style="margin-bottom:6px;">Conteúdo da Aula</div>
                <div style="background:var(--color-surface-2);border-radius:var(--radius-sm);padding:14px 16px;font-size:.9375rem;line-height:1.7;white-space:pre-wrap;border-left:3px solid var(--color-primary);">${escapeHtml(a.conteudo || '—')}</div>
            </div>
            ${a.link_meet ? `
            <div>
                <div class="form-label" style="margin-bottom:6px;">Link Google Meet</div>
                <a href="${escapeHtml(a.link_meet)}" target="_blank" class="btn btn-primary btn-sm">📹 Entrar na reunião</a>
            </div>` : ''}
        `;

        const footer = document.getElementById('modal-detalhes-footer');
        footer.innerHTML = `<button class="btn btn-ghost" onclick="closeModal('modal-aula-detalhes')">Fechar</button>`;

        // Botão de chat: visível para professor, aluno e admin quando a aula é agendada
        const podeChat = a.professor_id === uid || a.aluno_id === uid || isAdmin;
        if (podeChat) {
            footer.innerHTML += `<button class="btn btn-ghost btn-chat" onclick="closeModal('modal-aula-detalhes');Modules.Chat.open('${a.id}')">💬 Chat</button>`;
        }

        if (a.status === 'agendada' && Auth.can('professor') && a.professor_id === uid && !a.relatorio_id) {
            footer.innerHTML += `<button class="btn btn-primary" onclick="Modules.Agenda._abrirRelatorio('${a.aluno_id}')">Lançar Relatório</button>`;
        }
        if (a.relatorio_id) {
            footer.innerHTML += `<button class="btn btn-ghost" onclick="Modules.Agenda._verRelatorio('${a.relatorio_id}')">Ver Relatório</button>`;
        }
        if (isAdmin && a.status === 'agendada') {
            footer.innerHTML += `<button class="btn btn-danger btn-sm" onclick="closeModal('modal-aula-detalhes');Modules.Agenda.openCancelar('${a.id}')">Cancelar Aula</button>`;
        }

        openModal('modal-aula-detalhes');
    },

    // ── MODAL CONTEÚDO COMPLETO ────────────────────────────────
    async openConteudo(id) {
        const { data: a } = await supabase
            .from('v_agenda_completa')
            .select('conteudo,aluno_nome,professor_nome,data,horario')
            .eq('id', id)
            .single();

        if (!a) return showToast('Erro ao carregar conteúdo', 'error');

        const el = document.getElementById('conteudo-aula-text');
        if (el) el.textContent = a.conteudo || '—';

        // atualiza título do modal com contexto
        const header = document.querySelector('#modal-conteudo-aula .modal-header h3');
        if (header) header.textContent = `Conteúdo — ${a.aluno_nome} (${fmt.date(a.data)} ${fmt.time(a.horario)})`;

        openModal('modal-conteudo-aula');
    },

    // ── CRIAR AULA ─────────────────────────────────────────────
    async openCreate() {
        document.getElementById('modal-agenda-title').textContent = 'Agendar Aula';
        document.getElementById('ag-id').value = '';
        document.getElementById('ag-data').value = '';
        document.getElementById('ag-data').min = todayISO();
        document.getElementById('ag-horario').value = '';
        document.getElementById('ag-conteudo').value = '';
        document.getElementById('ag-meet').value = '';
        document.getElementById('ag-disponibilidade-info').style.display = 'none';

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

    // Atalho: criar aula em data específica (clique no "+" do calendário)
    async openCreateOnDate(dateISO) {
        await this.openCreate();
        const dataInput = document.getElementById('ag-data');
        if (dataInput) dataInput.value = dateISO;
    },

    async _showDisponibilidade(professorId) {
        const { data: disp } = await supabase
            .from('disponibilidade')
            .select('*')
            .eq('professor_id', professorId)
            .order('dia_semana');

        const info    = document.getElementById('ag-disponibilidade-info');
        const content = document.getElementById('ag-disp-content');

        if (!disp?.length) { info.style.display = 'none'; return; }

        content.innerHTML = disp.map(d =>
            `<span class="disp-slot">${DIAS_SEMANA[d.dia_semana]}: ${fmt.time(d.horario_inicio)} — ${fmt.time(d.horario_fim)}</span>`
        ).join('');
        info.style.display = 'block';
    },

    async save() {
        const id          = document.getElementById('ag-id').value;
        const alunoId     = document.getElementById('ag-aluno').value;
        const professorId = document.getElementById('ag-professor').value;
        const data        = document.getElementById('ag-data').value;
        const horario     = document.getElementById('ag-horario').value;
        const conteudo    = document.getElementById('ag-conteudo').value.trim();
        const meet        = document.getElementById('ag-meet').value.trim();

        const errors = validateForm([
            { value: alunoId,     label: 'Aluno',     rules: ['required'] },
            { value: professorId, label: 'Professor',  rules: ['required'] },
            { value: data,        label: 'Data',       rules: ['required'] },
            { value: horario,     label: 'Horário',    rules: ['required'] },
            { value: conteudo,    label: 'Conteúdo',   rules: ['required'] }
        ]);

        if (data && data < todayISO()) errors.push('A data não pode ser no passado');
        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-agenda', true);
        try {
            const payload = {
                aluno_id:     alunoId,
                professor_id: professorId,
                data,
                horario,
                conteudo,
                link_meet:    meet || null,
                created_by:   AppState.userProfile.id
            };

            if (id) {
                const { error } = await supabase.from('agenda_meet').update(payload).eq('id', id);
                if (error) throw error;
                showToast('Aula atualizada com sucesso', 'success');
            } else {
                const { data: inserted, error } = await supabase
                    .from('agenda_meet').insert(payload).select('id').single();
                if (error) throw error;
                showToast('Aula agendada com sucesso', 'success');
                // Dispara email para o professor em background (não bloqueia o fluxo)
                Modules.Agenda._notificarProfessor(inserted?.id).catch(console.warn);
            }

            closeModal('modal-agenda');
            await this.loadList();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-save-agenda', false);
        }
    },

    // ── navegação para relatório ───────────────────────────────
    async _abrirRelatorio(alunoId) {
        closeModal('modal-aula-detalhes');
        // Navega para o módulo de Relatórios (carrega o DOM com os modais)
        await Router.navigate('relatorios');
        // Agora o modal-validar-aula existe no DOM — abre com o aluno pré-selecionado
        await Modules.Relatorios.openValidarAula(alunoId);
    },

    async _verRelatorio(relatorioId) {
        closeModal('modal-aula-detalhes');
        await Router.navigate('relatorios');
        await Modules.Relatorios.openView(relatorioId);
    },

    // ── notificação de email via EmailJS ──────────────────────
    async _notificarProfessor(agendaId) {
        if (!agendaId) return;
        if (!window.EMAILJS_CONFIG?.publicKey || window.EMAILJS_CONFIG.publicKey.startsWith('COLE_')) return;

        try {
            // Busca dados da aula (view já traz professor_id)
            const { data: aula, error: aulaErr } = await supabase
                .from('v_agenda_completa')
                .select('*')
                .eq('id', agendaId)
                .single();

            if (aulaErr || !aula) { console.warn('Aula não encontrada para notificação'); return; }

            // Busca email do professor
            const { data: prof, error: profErr } = await supabase
                .from('usuarios')
                .select('email, nome')
                .eq('id', aula.professor_id)
                .single();

            if (profErr || !prof?.email) { console.warn('Professor sem email'); return; }

            // Formata data em pt-BR
            const dataObj      = new Date(aula.data + 'T00:00:00');
            const dias         = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
            const meses        = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
            const dataFormatada = `${dias[dataObj.getDay()]}, ${dataObj.getDate()} de ${meses[dataObj.getMonth()]} de ${dataObj.getFullYear()}`;

            const params = {
                to_email:       prof.email,
                to_name:        prof.nome,
                professor_nome: aula.professor_nome  || '',
                aluno_nome:     aula.aluno_nome      || '',
                disciplina:     aula.disciplina      || '',
                serie:          aula.serie           || '',
                data_aula:      dataFormatada,
                horario:        (aula.horario || '').substring(0, 5),
                conteudo:       aula.conteudo        || '',
                link_meet:      aula.link_meet       || 'Não informado ainda'
            };

            console.log('Enviando email para:', prof.email, params);

            const resp = await emailjs.send(
                window.EMAILJS_CONFIG.serviceId,
                window.EMAILJS_CONFIG.templateId,
                params
            );

            console.log('Email enviado com sucesso:', resp.status, resp.text);
        } catch (e) {
            console.warn('Notificação de email falhou:', e?.text || e?.message || e);
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
