// ============================================================
// MÓDULO: DISPONIBILIDADE — Visão Geral Admin e Professor
// ============================================================

Modules.Disponibilidade = {
    _selected: {},   // Uso do professor: { "1-07:00": true, ... }
    _allData: [],    // Cache de dados para filtros do Admin
    _diasCurtos: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],

    // Horários disponíveis: 06:00 até 22:00, de 30 em 30 min
    _slots: (function() {
        var s = [];
        for (var h = 6; h < 22; h++) {
            s.push((h < 10 ? '0' : '') + h + ':00');
            s.push((h < 10 ? '0' : '') + h + ':30');
        }
        return s;
    }()),

    async render() {
        if (!Auth.can('professor', 'admin')) return;

        const isProf  = Auth.can('professor');
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
                        <input type="text" class="input" id="filter-materia" placeholder="📚 Filtrar por matéria..." oninput="Modules.Disponibilidade.filtrar()">
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
            // Busca disponibilidades cruzando com a tabela de usuários (nome) e alunos_info (disciplina/matéria)
            const { data, error } = await supabase
                .from('disponibilidade')
                .select(`
                    dia_semana, 
                    horario_inicio, 
                    professor_id,
                    usuarios!inner(nome),
                    alunos_info:professor_id(disciplina)
                `);

            if (error) throw error;
            
            this._allData = data || [];
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
            const matchesNome = item.usuarios.nome.toLowerCase().includes(nomeQuery);
            const matchesMateria = (item.alunos_info?.disciplina || '').toLowerCase().includes(materiaQuery);
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

        // Estilo de lista de cards para o Admin
        let html = '<div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 0;">';
        
        // Ordenar por dia da semana e depois horário para ficar organizado
        dados.sort((a, b) => a.dia_semana - b.dia_semana || a.horario_inicio.localeCompare(b.horario_inicio));

        dados.forEach(item => {
            html += `
                <div class="card p-3" style="border-left: 4px solid var(--color-primary); display: flex; justify-content: space-between; align-items: center; flex-direction: row;">
                    <div>
                        <div style="font-weight: 600; color: var(--color-text-1);">${escapeHtml(item.usuarios.nome)}</div>
                        <div style="font-size: 0.85rem; color: var(--color-text-3);">
                            ${this._diasCurtos[item.dia_semana]} às ${item.horario_inicio.substring(0,5)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge badge-info">${escapeHtml(item.alunos_info?.disciplina || '—')}</span>
                    </div>
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
                    var [hh, mm] = inicio.split(':').map(Number);
                    mm += 30; if (mm >= 60) { hh++; mm = 0; }
                    var fim = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
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