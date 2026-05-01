// ============================================================
// MÓDULO: DISPONIBILIDADE — Visão Geral Admin e Professor
// ============================================================

Modules.Disponibilidade = {
    _selected: {},   // Uso do professor: { "1-07:00": true, ... }
    _allData: [],    // Cache de dados para filtros do Admin
    _diasCurtos: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],

    // Horários disponíveis: 06:00 até 22:00, de hora em hora
    _slots: (function() {
        var s = [];
        for (var h = 6; h <= 22; h++) {
            s.push((h < 10 ? '0' : '') + h + ':00');
        }
        return s;
    }()),

    async render() {
        if (!Auth.can('professor', 'admin')) return;

        const isAdmin = Auth.can('admin');

        if (isAdmin) {
            // --- LAYOUT ADMIN: Visão Geral com Filtros ---
            renderContent(`
                <div class="page-header">
                    <h1 class="page-title">Disponibilidade Geral</h1>
                </div>

                <div class="card mb-3">
                    <div class="card-toolbar" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                        <input type="text" class="input" id="filter-nome" placeholder="🔍 Filtrar por nome..." oninput="Modules.Disponibilidade.filtrar()">
                        <select class="input" id="filter-materia" onchange="Modules.Disponibilidade.filtrar()">
                            <option value="">📚 Todas as matérias</option>
                        </select>
                        <select class="input" id="filter-dia" onchange="Modules.Disponibilidade.filtrar()">
                            <option value="">📅 Todos os dias</option>
                            ${this._diasCurtos.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="calendly-wrap" style="min-height: 200px;">
                    <div class="loader-inline"></div>
                </div>
            `);
            await this._loadAdminGeneral();

        } else {
            // --- LAYOUT PROFESSOR: Grade Individual ---
            renderContent(`
                <div class="page-header">
                    <h1 class="page-title">Minha Disponibilidade</h1>
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-ghost" onclick="Modules.Disponibilidade._limpar()">Limpar tudo</button>
                        <button class="btn btn-primary" id="btn-salvar-disp" onclick="Modules.Disponibilidade.salvar()">
                            Salvar disponibilidade
                        </button>
                    </div>
                </div>
                
                <div class="info-box mb-3">
                    <strong>ℹ</strong> Marque os horários em que você está disponível para dar aulas.
                </div>

                <div class="card">
                    <div id="calendly-wrap" style="overflow-x:auto;padding:16px">
                        <div class="loader-inline"></div>
                    </div>
                </div>
            `);
            await this._loadProf();
        }
    },

    // ── LÓGICA ADMIN ──────────────────────────────────────────

    async _loadAdminGeneral() {
        try {
            const [dispRes, profRes] = await Promise.all([
                supabase.from('disponibilidade').select(`
                    dia_semana, horario_inicio, professor_id,
                    usuarios!inner(nome)
                `),
                supabase.from('professores_info').select('materia').not('materia', 'is', null)
            ]);

            if (dispRes.error) throw dispRes.error;

            this._allData = dispRes.data || [];

            // Preenche o select de matérias com valores únicos do banco
            const sel = document.getElementById('filter-materia');
            if (sel && profRes.data) {
                const unicas = [...new Set(profRes.data.map(p => p.materia).filter(Boolean))].sort();
                unicas.forEach(m => {
                    sel.innerHTML += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
                });
            }

            this.filtrar(); // Renderiza a lista inicial
        } catch (err) {
            console.error(err);
            document.getElementById('calendly-wrap').innerHTML = `<p class="text-danger">Erro ao carregar dados.</p>`;
        }
    },

    filtrar() {
        const nomeQuery = document.getElementById('filter-nome').value.toLowerCase();
        const materiaQuery = document.getElementById('filter-materia').value.toLowerCase();
        const diaQuery = document.getElementById('filter-dia').value;

        const filtrados = this._allData.filter(item => {
            const materiaProf = (item.usuarios?.professores_info?.[0]?.materia || '').toLowerCase();
            const matchesNome = item.usuarios.nome.toLowerCase().includes(nomeQuery);
            const matchesMateria = materiaQuery === '' || materiaProf === materiaQuery;
            const matchesDia = diaQuery === "" || item.dia_semana == diaQuery;
            return matchesNome && matchesMateria && matchesDia;
        });

        this._renderAdminList(filtrados);
    },

    _renderAdminList(dados) {
        const wrap = document.getElementById('calendly-wrap');
        if (dados.length === 0) {
            wrap.innerHTML = `<div class="p-4 text-muted text-center">Nenhuma disponibilidade encontrada.</div>`;
            return;
        }

        // Agrupar por professor
        const porProf = {};
        dados.forEach(item => {
            const pid = item.professor_id;
            if (!porProf[pid]) {
                porProf[pid] = {
                    nome: item.usuarios.nome,
                    materia: item.usuarios?.professores_info?.[0]?.materia || '—',
                    dias: {}
                };
            }
            const d = item.dia_semana;
            if (!porProf[pid].dias[d]) porProf[pid].dias[d] = [];
            porProf[pid].dias[d].push(item.horario_inicio.substring(0, 5));
        });

        const diasLabel = this._diasCurtos;
        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:10px 0;">';

        Object.values(porProf)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .forEach(prof => {
                let diasHtml = '';
                for (let d = 0; d < 7; d++) {
                    const horarios = prof.dias[d];
                    if (!horarios || horarios.length === 0) continue;
                    horarios.sort();
                    diasHtml += `
                        <div style="margin-bottom:6px;">
                            <span style="font-weight:600;color:var(--color-text-2);min-width:32px;display:inline-block">${diasLabel[d]}</span>
                            <span style="font-size:.82rem;color:var(--color-text-3);">${horarios.map(h => h + 'h').join(' · ')}</span>
                        </div>`;
                }

                html += `
                    <div class="card p-3" style="border-top:3px solid var(--color-primary);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                            <div style="font-weight:700;color:var(--color-text-1);font-size:.95rem;">${escapeHtml(prof.nome)}</div>
                            <span class="badge badge-info" style="font-size:.75rem;">${escapeHtml(prof.materia)}</span>
                        </div>
                        <div style="font-size:.85rem;">${diasHtml || '<span class="text-muted">Sem horários</span>'}</div>
                    </div>`;
            });

        html += '</div>';
        wrap.innerHTML = html;
    },

    // ── LÓGICA PROFESSOR (ORIGINAL) ───────────────────────────

    async _loadProf() {
        var uid = AppState.userProfile.id;
        var res = await supabase
            .from('disponibilidade')
            .select('dia_semana, horario_inicio')
            .eq('professor_id', uid);

        this._selected = {};
        if (res.data) {
            res.data.forEach(function(d) {
                Modules.Disponibilidade._selected[d.dia_semana + '-' + d.horario_inicio.substring(0,5)] = true;
            });
        }
        this._renderGrid(true);
    },

    _renderGrid: function(editavel) {
        var wrap = document.getElementById('calendly-wrap');
        if (!wrap) return;

        var self = this;
        var dias = this._diasCurtos;
        var slots = this._slots;

        var html = '<div class="cal-grid">';
        html += '<div class="cal-cell cal-header-time"></div>';
        dias.forEach(d => html += `<div class="cal-cell cal-header-day">${d}</div>`);

        slots.forEach(slot => {
            html += `<div class="cal-cell cal-time-label">${slot}</div>`;
            for (var dia = 0; dia < 7; dia++) {
                var key = dia + '-' + slot;
                var sel = !!self._selected[key];
                var cls = 'cal-cell cal-slot' + (sel ? ' cal-slot-on' : '') + (editavel ? ' cal-slot-edit' : '');
                var onclick = editavel ? `onclick="Modules.Disponibilidade.toggle('${key}', this)"` : '';
                html += `<div class="${cls}" data-key="${key}" ${onclick}></div>`;
            }
        });
        html += '</div>';
        wrap.innerHTML = html;
    },

    toggle: function(key, el) {
        if (this._selected[key]) {
            delete this._selected[key];
            el.classList.remove('cal-slot-on');
        } else {
            this._selected[key] = true;
            el.classList.add('cal-slot-on');
        }
    },

    _limpar: function() {
        this._selected = {};
        document.querySelectorAll('.cal-slot-on').forEach(el => el.classList.remove('cal-slot-on'));
    },

    async salvar() {
        var uid = AppState.userProfile.id;
        setLoading('#btn-salvar-disp', true);
        try {
            await supabase.from('disponibilidade').delete().eq('professor_id', uid);
            var keys = Object.keys(this._selected);
            if (keys.length > 0) {
                var rows = keys.map(k => {
                    var parts = k.split('-');
                    var dia = parseInt(parts[0]);
                    var inicio = parts[1];
                    var hh = parseInt(inicio.split(':')[0]) + 1;
                    var fim = (hh < 10 ? '0' : '') + hh + ':00';
                    return { professor_id: uid, dia_semana: dia, horario_inicio: inicio, horario_fim: fim };
                });
                await supabase.from('disponibilidade').insert(rows);
            }
            showToast('Disponibilidade salva com sucesso!', 'success');
        } catch(err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-salvar-disp', false);
        }
    }
};