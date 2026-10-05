// ============================================================
// MÓDULO: MENTORIA SEMANAL (mentor + admin) — protótipo
// Controle semanal: vê os alunos ativos em quadrados e marca "Foi
// mentorado" conforme vai atendendo. Reaproveita a tabela
// agenda_mentoria (status 'realizada') — sem precisar de
// agendamento prévio, o clique já registra a sessão na hora.
// Mentor só mexe na própria semana; admin escolhe o mentor num
// seletor e pode marcar/desfazer em nome dele (supervisão).
// ============================================================

Modules.MentoriaSemana = {
    _weekOffset: 0, // 0 = semana atual, -1 = anterior, +1 = seguinte
    _isAdmin: false,
    _mentorId: null,

    async render() {
        if (!Auth.requireRole('admin', 'mentor')) return;
        this._weekOffset = 0;
        this._isAdmin = Auth.can('admin');
        this._mentorId = this._isAdmin ? null : AppState.userProfile.id;

        renderContent(`
            <div class="page-header">
                <div>
                    <h1 class="page-title">${this._isAdmin ? 'Mentoria Semanal' : 'Minha Semana'}</h1>
                    <span class="page-subtitle" id="msem-periodo"></span>
                </div>
                <div class="msem-nav">
                    <button class="btn btn-ghost btn-sm" onclick="Modules.MentoriaSemana._mudarSemana(-1)">‹ Anterior</button>
                    <button class="btn btn-ghost btn-sm" id="btn-msem-hoje" onclick="Modules.MentoriaSemana._irParaAtual()">Semana atual</button>
                    <button class="btn btn-ghost btn-sm" onclick="Modules.MentoriaSemana._mudarSemana(1)">Seguinte ›</button>
                </div>
            </div>

            ${this._isAdmin ? `
                <div class="card msem-mentor-select-card">
                    <div class="card-body msem-mentor-select-body">
                        <label class="form-label" for="msem-mentor-select">Mentor</label>
                        <select class="input" id="msem-mentor-select" onchange="Modules.MentoriaSemana._onMentorChange(this.value)">
                            <option value="">Selecione um mentor...</option>
                        </select>
                    </div>
                </div>
            ` : ''}

            <div class="card msem-progress-card">
                <div class="card-body" id="msem-progress"></div>
            </div>

            <div id="msem-grid" class="msem-grid"></div>
        `);

        if (this._isAdmin) {
            const { data: mentores } = await supabase
                .from('usuarios').select('id, nome').eq('role', 'mentor').eq('ativo', true).order('nome');
            this._mentores = mentores || [];

            const sel = document.getElementById('msem-mentor-select');
            if (sel) {
                sel.innerHTML = `<option value="">Selecione um mentor...</option>` +
                    this._mentores.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
            }
            document.getElementById('msem-progress').innerHTML = emptyState('Selecione um mentor para ver o controle semanal');
        } else {
            await this.load();
        }
    },

    async _onMentorChange(mentorId) {
        this._mentorId = mentorId || null;
        this._weekOffset = 0;

        if (!this._mentorId) {
            document.getElementById('msem-progress').innerHTML = emptyState('Selecione um mentor para ver o controle semanal');
            document.getElementById('msem-grid').innerHTML = '';
            const periodoEl = document.getElementById('msem-periodo');
            if (periodoEl) periodoEl.textContent = '';
            return;
        }

        await this.load();
    },

    _weekBounds(offset) {
        const now = new Date();
        const day = now.getDay(); // 0 = domingo
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() + diffToMonday + offset * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { inicio: iso(monday), fim: iso(sunday), mondayDate: monday, sundayDate: sunday };
    },

    async _mudarSemana(delta) {
        if (!this._mentorId) return;
        this._weekOffset += delta;
        await this.load();
    },

    async _irParaAtual() {
        if (!this._mentorId) return;
        this._weekOffset = 0;
        await this.load();
    },

    async load() {
        if (!this._mentorId) return;
        const { inicio, fim, mondayDate, sundayDate } = this._weekBounds(this._weekOffset);

        const periodoEl = document.getElementById('msem-periodo');
        if (periodoEl) {
            const curta = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            periodoEl.textContent = `Semana de ${curta(mondayDate)} a ${curta(sundayDate)}` + (this._weekOffset === 0 ? ' · atual' : '');
        }
        const btnHoje = document.getElementById('btn-msem-hoje');
        if (btnHoje) btnHoje.classList.toggle('btn-primary', this._weekOffset !== 0);

        const [{ data: alunos, error: errAlunos }, { data: feitos, error: errFeitos }] = await Promise.all([
            supabase.from('usuarios').select('id, nome').eq('role', 'aluno').eq('ativo', true).order('nome'),
            supabase.from('agenda_mentoria')
                .select('id, aluno_id, data, horario')
                .eq('mentor_id', this._mentorId)
                .eq('status', 'realizada')
                .gte('data', inicio)
                .lte('data', fim)
        ]);

        const grid = document.getElementById('msem-grid');
        const erro = errAlunos || errFeitos;
        if (erro) {
            if (grid) grid.innerHTML = `<p class="text-danger">Erro ao carregar: ${escapeHtml(erro.message)}</p>`;
            return;
        }

        const feitosByAluno = {};
        (feitos || []).forEach(f => {
            // se por acaso tiver mais de um registro no mesmo aluno/semana, guarda o mais recente
            const atual = feitosByAluno[f.aluno_id];
            if (!atual || f.data > atual.data || (f.data === atual.data && f.horario > atual.horario)) {
                feitosByAluno[f.aluno_id] = f;
            }
        });

        this._alunos = alunos || [];
        this._feitosByAluno = feitosByAluno;
        this._podeMarcar = this._weekOffset === 0; // semana passada é só consulta, não dá pra editar

        this._renderProgress();
        this._renderGrid();
    },

    _renderProgress() {
        const el = document.getElementById('msem-progress');
        if (!el) return;

        const total = this._alunos.length;
        const feitos = Object.keys(this._feitosByAluno).length;
        const pct = total ? Math.round((feitos / total) * 100) : 0;

        el.innerHTML = `
            <div class="msem-progress-row">
                <div class="msem-progress-text"><strong>${feitos}</strong> de <strong>${total}</strong> alunos mentorados essa semana</div>
                <div class="msem-progress-pct">${pct}%</div>
            </div>
            <div class="msem-progress-bar"><div class="msem-progress-fill" style="width:${pct}%"></div></div>
        `;
    },

    _renderGrid() {
        const grid = document.getElementById('msem-grid');
        if (!grid) return;

        if (!this._alunos.length) {
            grid.innerHTML = emptyState('Nenhum aluno ativo encontrado');
            return;
        }

        grid.innerHTML = this._alunos.map((a, i) => {
            const feito = this._feitosByAluno[a.id];
            return `
                <div class="msem-card ${feito ? 'msem-card-done' : ''}" style="--i:${i}">
                    <div class="msem-card-avatar">${escapeHtml(a.nome.charAt(0).toUpperCase())}</div>
                    <div class="msem-card-nome">${escapeHtml(a.nome)}</div>
                    ${feito
                        ? `<div class="msem-card-status">
                            <span class="msem-check">✓ Mentorado</span>
                            <span class="msem-card-data">${fmt.time(feito.horario)} · ${fmt.date(feito.data)}</span>
                            ${this._podeMarcar ? `<button class="btn btn-ghost btn-sm msem-btn-desfazer" onclick="Modules.MentoriaSemana.desfazer('${feito.id}')">Desfazer</button>` : ''}
                           </div>`
                        : this._podeMarcar
                            ? `<button class="btn btn-primary btn-sm msem-btn-marcar" onclick="Modules.MentoriaSemana.marcar('${a.id}')">Foi mentorado</button>`
                            : `<span class="msem-pendente">Não mentorado</span>`
                    }
                </div>
            `;
        }).join('');
    },

    async marcar(alunoId) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const horario = `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

        const { data: inserido, error } = await supabase.from('agenda_mentoria').insert({
            aluno_id:   alunoId,
            mentor_id:  this._mentorId,
            data:       todayISO(),
            horario,
            status:     'realizada',
            created_by: AppState.userProfile.id
        }).select('id').single();
        if (error) return showToast(error.message, 'error');

        await auditLog('MENTORIA_MARCADA', 'agenda_mentoria', inserido?.id, { alunoId, mentorId: this._mentorId });
        showToast('Aluno marcado como mentorado', 'success');
        await this.load();
    },

    async desfazer(id) {
        const confirmed = await confirmAction('Desfazer essa marcação de mentoria?');
        if (!confirmed) return;

        const { error } = await supabase.from('agenda_mentoria').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        await auditLog('MENTORIA_DESFEITA', 'agenda_mentoria', id, { mentorId: this._mentorId });
        showToast('Marcação desfeita', 'success');
        await this.load();
    }
};
