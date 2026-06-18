// ============================================================
// MÓDULO: DASHBOARD
// ============================================================

Modules.Dashboard = {

    async render() {
        const role = AppState.role;
        switch (role) {
            case 'admin':       return Modules.Dashboard._admin();
            case 'professor':   return Modules.Dashboard._professor();
            case 'aluno':       return Modules.Dashboard._aluno();
            case 'psicopedagoga': return Modules.Dashboard._psico();
        }
    },

    async _admin() {
        const { data: stats } = await supabase
            .from('v_dashboard_stats')
            .select('*')
            .single();

        const { data: proximasAulasRaw } = await supabase
            .from('v_agenda_completa')
            .select('*')
            .gte('data', todayISO())
            .eq('status', 'agendada')
            .order('data', { ascending: true })
            .order('horario', { ascending: true })
            .limit(10);

        const _now = new Date();
        const proximasAulas = (proximasAulasRaw || []).filter(a => {
            if (a.data !== todayISO()) return true;
            const [h, m] = (a.horario || '00:00').split(':').map(Number);
            const expiry = new Date(_now);
            expiry.setHours(h, m + 90, 0, 0);
            return expiry >= _now;
        }).slice(0, 5);

        const { data: cobrancasAtrasadas } = await supabase
            .from('v_financeiro_completo')
            .select('*')
            .eq('status', 'atrasado')
            .limit(5);

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <span class="page-subtitle">${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}</span>
            </div>

            <div class="stats-grid">
                ${Modules.Dashboard._statCard('Alunos Ativos', stats?.total_alunos || 0, '🎓', 'stat-blue')}
                ${Modules.Dashboard._statCard('Professores', stats?.total_professores || 0, '👨‍🏫', 'stat-green')}
                ${Modules.Dashboard._statCard('Aulas Hoje', stats?.aulas_hoje || 0, '📅', 'stat-purple')}
                ${Modules.Dashboard._statCard('Receita do Mês', fmt.currency(stats?.receita_mes || 0), '💰', 'stat-gold')}
                ${Modules.Dashboard._statCard('Tarefas Concluídas', stats?.tarefas_concluidas_semana || 0, '✓', 'stat-teal')}
                ${Modules.Dashboard._statCard('Cobranças Atrasadas', stats?.cobrancas_atrasadas || 0, '⚠', 'stat-red')}
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header">
                        <h3>Próximas Aulas</h3>
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('agenda')">Ver todas</button>
                    </div>
                    <div class="card-body">
                        ${proximasAulas?.length
                            ? `<table class="table">
                                <thead><tr><th>Data</th><th>Horário</th><th>Aluno</th><th>Professor</th></tr></thead>
                                <tbody>
                                    ${proximasAulas.map(a => `
                                        <tr>
                                            <td>${fmt.date(a.data)}</td>
                                            <td>${fmt.time(a.horario)}</td>
                                            <td>${escapeHtml(a.aluno_nome)}</td>
                                            <td>${escapeHtml(a.professor_nome)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>`
                            : emptyState('Nenhuma aula agendada')
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3>Cobranças Atrasadas</h3>
                        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('financeiro')">Ver todas</button>
                    </div>
                    <div class="card-body">
                        ${cobrancasAtrasadas?.length
                            ? `<table class="table">
                                <thead><tr><th>Aluno</th><th>Valor</th><th>Vencimento</th></tr></thead>
                                <tbody>
                                    ${cobrancasAtrasadas.map(c => `
                                        <tr>
                                            <td>${escapeHtml(c.aluno_nome)}</td>
                                            <td>${fmt.currency(c.valor)}</td>
                                            <td class="text-danger">${fmt.date(c.vencimento)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>`
                            : emptyState('Nenhuma cobrança atrasada')
                        }
                    </div>
                </div>
            </div>
        `);
    },

    async _professor() {
        const id = AppState.userProfile.id;

        const [{ data: hoje }, { data: semana }, { data: profInfo }, notificacoes, { data: respostasNovas }] = await Promise.all([
            supabase.from('v_agenda_completa').select('*').eq('professor_id', id).eq('data', todayISO()).eq('status', 'agendada').order('horario'),
            supabase.from('v_agenda_completa').select('*').eq('professor_id', id).gte('data', todayISO()).eq('status', 'agendada').order('data').limit(10),
            supabase.from('professores_info').select('saldo_aulas_dadas').eq('usuario_id', id).single(),
            Modules.Dashboard._fetchMensagensNaoLidas(id),
            supabase.from('respostas_atividades')
                .select(`id, arquivo_url, arquivo_nome, created_at,
                    aluno:usuarios!respostas_atividades_aluno_id_fkey(nome),
                    atividade:atividades!respostas_atividades_atividade_id_fkey(id, titulo)`)
                .eq('visualizado', false)
                .order('created_at', { ascending: false })
                .limit(10)
        ]);

        const now = new Date();

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Bem-vindo, ${escapeHtml(AppState.userProfile.nome.split(' ')[0])}</h1>
                <button class="btn btn-primary" onclick="Modules.Dashboard._lancarAula()">✓ Lançar Aula</button>
            </div>

            ${Modules.Dashboard._notificacoesHtml(notificacoes)}
            ${Modules.Dashboard._respostasHtml(respostasNovas)}

            <div class="stats-grid stats-grid-3">
                ${Modules.Dashboard._statCard('Aulas Hoje', hoje?.length || 0, '📅', 'stat-blue')}
                ${Modules.Dashboard._statCard('Próximas Aulas', semana?.length || 0, '📆', 'stat-purple')}
                ${Modules.Dashboard._statCard('Total Aulas Dadas', profInfo?.saldo_aulas_dadas || 0, '✓', 'stat-green')}
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Aulas de Hoje</h3>
                    <button class="btn btn-ghost btn-sm" onclick="Router.navigate('agenda')">Agenda completa</button>
                </div>
                <div class="card-body">
                    ${hoje?.length
                        ? hoje.map(a => {
                            const [h, m] = (a.horario || '00:00').split(':').map(Number);
                            const expiry = new Date(); expiry.setHours(h, m + 60, 0, 0);
                            const expirada = expiry < now;
                            return `
                            <div class="aula-card ${a.status}${expirada ? ' realizada' : ''}">
                                <div class="aula-time">${fmt.time(a.horario)}</div>
                                <div class="aula-info">
                                    <div class="aula-aluno">${escapeHtml(a.aluno_nome)}</div>
                                    <div class="aula-conteudo">${escapeHtml(a.conteudo)}</div>
                                    <div class="aula-meta">${escapeHtml(a.serie || '')} • ${escapeHtml(a.disciplina || '')}</div>
                                </div>
                                <div class="aula-actions">
                                    ${a.link_meet ? `<a href="${escapeHtml(a.link_meet)}" target="_blank" class="btn btn-sm btn-primary">Entrar no Meet</a>` : ''}
                                    ${!a.relatorio_id
                                        ? `<button class="btn btn-sm btn-secondary" onclick="Modules.Dashboard._lancarAula('${a.aluno_id}')">Lançar Aula</button>`
                                        : `<span class="badge badge-success">Aula lançada</span>`
                                    }
                                </div>
                            </div>
                        `}).join('')
                        : emptyState('Nenhuma aula agendada para hoje')
                    }
                </div>
            </div>
        `);

        // Mostra novidade do chat uma única vez
        Modules.Dashboard._mostrarNovidade('professor');
    },

    async _lancarAula(alunoId) {
        await Router.navigate('relatorios');
        Modules.Relatorios.openValidarAula(alunoId || null);
    },

    async _aluno() {
        const id = AppState.userProfile.id;

        const [{ data: alunoInfo }, { data: proximasAulas }, { data: tarefas }, notificacoes] = await Promise.all([
            supabase.from('alunos_info').select('*').eq('usuario_id', id).single(),
            supabase.from('v_agenda_completa').select('*').eq('aluno_id', id).gte('data', todayISO()).eq('status', 'agendada').order('data').order('horario').limit(5),
            supabase.from('cronograma_tarefas').select('*, cronograma!inner(aluno_id)').eq('cronograma.aluno_id', id).eq('status', 'pendente').limit(5),
            Modules.Dashboard._fetchMensagensNaoLidas(id)
        ]);

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Olá, ${escapeHtml(AppState.userProfile.nome.split(' ')[0])}</h1>
            </div>

            ${Modules.Dashboard._notificacoesHtml(notificacoes)}

            <div class="stats-grid stats-grid-2">
                ${Modules.Dashboard._statCard('Aulas Disponíveis', alunoInfo?.aulas_disponiveis || 0, '🎓', 'stat-blue')}
                ${Modules.Dashboard._statCard('Tarefas Pendentes', tarefas?.length || 0, '📋', 'stat-purple')}
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Próximas Aulas</h3>
                    <button class="btn btn-ghost btn-sm" onclick="Router.navigate('agenda')">Ver todas</button>
                </div>
                <div class="card-body">
                    ${proximasAulas?.length
                        ? proximasAulas.map(a => `
                            <div class="aula-card">
                                <div class="aula-time">${fmt.time(a.horario)}</div>
                                <div class="aula-info">
                                    <div class="aula-aluno">${fmt.date(a.data)}</div>
                                    <div class="aula-conteudo">${escapeHtml(a.conteudo)}</div>
                                    <div class="aula-meta">Prof. ${escapeHtml(a.professor_nome)}</div>
                                </div>
                                <div class="aula-actions">
                                    ${a.link_meet
                                        ? `<a href="${escapeHtml(a.link_meet)}" target="_blank" class="btn btn-sm btn-primary">Entrar na Sala</a>`
                                        : ''}
                                </div>
                            </div>
                        `).join('')
                        : emptyState('Nenhuma aula agendada')
                    }
                </div>
            </div>
        `);

        // Mostra novidade do chat uma única vez
        Modules.Dashboard._mostrarNovidade('aluno');
    },

    async _psico() {
        const { data: totalAlunos } = await supabase
            .from('usuarios')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'aluno');

        const { data: obsRecentes } = await supabase
            .from('observacoes_psico')
            .select('*, usuarios!observacoes_psico_aluno_id_fkey(nome)')
            .eq('psico_id', AppState.userProfile.id)
            .order('created_at', { ascending: false })
            .limit(5);

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Painel Psicopedagógico</h1>
            </div>
            <div class="stats-grid stats-grid-2">
                ${Modules.Dashboard._statCard('Total de Alunos', totalAlunos?.length || 0, '🎓', 'stat-blue')}
                ${Modules.Dashboard._statCard('Suas Observações', obsRecentes?.length || 0, '🧠', 'stat-purple')}
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Observações Recentes</h3>
                    <button class="btn btn-ghost btn-sm" onclick="Router.navigate('psicopedagogia')">Ver todas</button>
                </div>
                <div class="card-body">
                    ${obsRecentes?.length
                        ? obsRecentes.map(o => `
                            <div class="obs-item">
                                <div class="obs-header">
                                    <span class="obs-aluno">${escapeHtml(o.usuarios?.nome || '')}</span>
                                    <span class="obs-date">${fmt.date(o.data)}</span>
                                    ${badge(CATEGORIAS_PSICO[o.categoria] || o.categoria, 'badge-secondary')}
                                </div>
                                <div class="obs-conteudo">${escapeHtml(o.conteudo.substring(0, 120))}${o.conteudo.length > 120 ? '...' : ''}</div>
                            </div>
                        `).join('')
                        : emptyState('Nenhuma observação registrada')
                    }
                </div>
            </div>
        `);
    },

    _statCard(label, value, icon, cls = '') {
        return `
            <div class="stat-card ${cls}">
                <div class="stat-icon">${icon}</div>
                <div class="stat-body">
                    <div class="stat-value">${escapeHtml(String(value))}</div>
                    <div class="stat-label">${escapeHtml(label)}</div>
                </div>
            </div>
        `;
    },

    // ── Novidade: chat (aparece uma vez por usuário) ───────────
    _mostrarNovidade(role) {
        const CHAVE = 'chat_novidade_v1';
        if (localStorage.getItem(CHAVE)) return;

        const isProf   = role === 'professor';
        const outro    = isProf ? 'seu aluno' : 'seu professor';
        const titulo   = isProf
            ? 'Agora você pode conversar com seu aluno pelo Chat Click!'
            : 'Agora você pode conversar com seu professor pelo Chat Click!';
        const rodape   = isProf
            ? 'Qualquer detalhe sobre a aula pode ser combinado por lá!'
            : 'Tire dúvidas e combine detalhes da aula direto com seu professor!';

        // Injeta o modal se ainda não existe no DOM
        if (!document.getElementById('modal-novidade-chat')) {
            const el = document.createElement('div');
            el.innerHTML = `
                <div class="modal-overlay modal-novidade-overlay" id="modal-novidade-chat">
                    <div class="novidade-box">
                        <button class="novidade-close" onclick="Modules.Dashboard._fecharNovidade()" aria-label="Fechar">×</button>

                        <div class="novidade-icone">💬</div>

                        <div class="novidade-badge">Novidade</div>

                        <h2 class="novidade-titulo">${titulo}</h2>

                        <p class="novidade-desc">
                            Tire dúvidas, combine detalhes da aula e envie arquivos
                            diretamente pela plataforma — sem precisar sair daqui.
                        </p>

                        <ol class="novidade-steps">
                            <li>Vá em <strong>Minhas Aulas</strong> na agenda</li>
                            <li>Clique em uma aula agendada</li>
                            <li>Toque no botão <strong>💬</strong> e pronto!</li>
                        </ol>

                        <p class="novidade-rodape">${rodape}</p>

                        <button class="btn btn-primary novidade-btn-ok"
                            onclick="Modules.Dashboard._fecharNovidade()">
                            Entendido, vamos lá!
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(el.firstElementChild);
        }

        // Pequeno delay para garantir que o renderContent terminou
        setTimeout(() => {
            const modal = document.getElementById('modal-novidade-chat');
            if (modal) modal.classList.add('modal-open');
            document.body.style.overflow = 'hidden';
        }, 300);
    },

    _fecharNovidade() {
        localStorage.setItem('chat_novidade_v1', '1');
        const modal = document.getElementById('modal-novidade-chat');
        if (modal) {
            modal.classList.remove('modal-open');
            document.body.style.overflow = '';
        }
    },

    // ── Mensagens não lidas ────────────────────────────────────
    async _fetchMensagensNaoLidas(uid) {
        const { data: msgs, error } = await supabase
            .from('mensagens_diretas')
            .select('id, remetente_id, conteudo, created_at')
            .eq('destinatario_id', uid)
            .eq('lida', false)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error || !msgs || msgs.length === 0) return [];

        // Agrupa por remetente
        const grupos = {};
        msgs.forEach(m => {
            if (!grupos[m.remetente_id]) grupos[m.remetente_id] = [];
            grupos[m.remetente_id].push(m);
        });

        const remetenteIds = Object.keys(grupos);

        const { data: remetentes } = await supabase
            .from('usuarios')
            .select('id, nome')
            .in('id', remetenteIds);

        return remetenteIds.map(rid => {
            const remetente = (remetentes || []).find(u => u.id === rid);
            const grupo     = grupos[rid];
            return {
                remetenteId:   rid,
                remetenteNome: remetente?.nome || '—',
                count:         grupo.length,
                ultimaMsg:     grupo[0],
            };
        });
    },

    _notificacoesHtml(notificacoes) {
        if (!notificacoes || notificacoes.length === 0) return '';

        const itens = notificacoes.map(n => {
            const trecho = escapeHtml((n.ultimaMsg.conteudo || '').substring(0, 80)) +
                ((n.ultimaMsg.conteudo || '').length > 80 ? '…' : '');

            return `
                <div class="notif-msg-item">
                    <div class="notif-msg-avatar">💬</div>
                    <div class="notif-msg-body">
                        <div class="notif-msg-de">
                            <strong>${escapeHtml(n.remetenteNome)}</strong>
                            ${n.count > 1 ? `<span class="notif-msg-count">${n.count} novas mensagens</span>` : '<span class="notif-msg-count">1 nova mensagem</span>'}
                        </div>
                        <div class="notif-msg-trecho">"${trecho}"</div>
                    </div>
                    <button class="btn btn-primary btn-sm notif-msg-btn"
                        onclick="Router.navigate('chat')">
                        Ver conversa
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="card notif-msg-card">
                <div class="card-header notif-msg-header">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="notif-msg-dot"></span>
                        <h3>Novas mensagens para você</h3>
                    </div>
                </div>
                <div class="notif-msg-list">
                    ${itens}
                </div>
            </div>
        `;
    },

    _respostasHtml(respostas) {
        if (!respostas || respostas.length === 0) return '';

        const itens = respostas.map(r => `
            <div class="notif-msg-item">
                <div class="notif-msg-avatar">📝</div>
                <div class="notif-msg-body">
                    <div class="notif-msg-de">
                        <strong>${escapeHtml(r.aluno?.nome || '—')}</strong>
                        <span class="notif-msg-count">enviou uma resposta</span>
                    </div>
                    <div class="notif-msg-trecho">
                        Atividade: <em>${escapeHtml(r.atividade?.titulo || '—')}</em>
                    </div>
                    <div class="notif-msg-aula">${fmt.date(r.created_at)}</div>
                </div>
                <button class="btn btn-primary btn-sm notif-msg-btn"
                    onclick="Router.navigate('atividades')">
                    Clique para ver
                </button>
            </div>
        `).join('');

        return `
            <div class="card notif-msg-card" style="border-left:3px solid #f59e0b;">
                <div class="card-header notif-msg-header">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="notif-msg-dot" style="background:#f59e0b"></span>
                        <h3>Respostas de atividades não lidas</h3>
                    </div>
                </div>
                <div class="notif-msg-list">
                    ${itens}
                </div>
            </div>
        `;
    }
};
