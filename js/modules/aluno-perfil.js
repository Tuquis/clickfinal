// ============================================================
// MÓDULO: PERFIL UNIFICADO DO ALUNO (protótipo)
// Painel que reúne ficha básica, insights da psicopedagoga, mural
// e status da última aula num só lugar. Acesso: admin, psicopedagoga
// e professor (este último sem ver saldo de aulas/financeiro).
// ============================================================

Modules.AlunoPerfil = {

    // Ciclo de assuntos dividido por unidade — visível pra admin,
    // psicopedagoga e professor (mesma regra de sempre, só que agora
    // em 4 cards em vez de 1).
    _TIPOS_CICLO: [
        { tipo: 'ciclo_assuntos_1', titulo: 'Ciclo de assuntos — 1ª Unidade', vazio: 'Nada postado na 1ª unidade ainda' },
        { tipo: 'ciclo_assuntos_2', titulo: 'Ciclo de assuntos — 2ª Unidade', vazio: 'Nada postado na 2ª unidade ainda' },
        { tipo: 'ciclo_assuntos_3', titulo: 'Ciclo de assuntos — 3ª Unidade', vazio: 'Nada postado na 3ª unidade ainda' },
        { tipo: 'ciclo_assuntos_4', titulo: 'Ciclo de assuntos — 4ª Unidade', vazio: 'Nada postado na 4ª unidade ainda' },
    ],

    // Só visíveis pra admin (mesma regra de RLS do banco) — qualquer
    // tipo de post que não comece com "ciclo_assuntos" cai aqui.
    _TIPOS_RESTRITOS: [
        { tipo: 'calendario_avaliacoes', titulo: 'Calendário de avaliações',    icon: '🗓️', vazio: 'Nenhum calendário de avaliações postado ainda' },
        { tipo: 'calendario_aulas',      titulo: 'Calendário de aulas semanal', icon: '📆', vazio: 'Nenhum calendário de aulas postado ainda' },
        { tipo: 'boletim_1',             titulo: 'Boletim — 1ª Unidade',        icon: '🔒', vazio: 'Boletim da 1ª unidade ainda não postado' },
        { tipo: 'boletim_2',             titulo: 'Boletim — 2ª Unidade',        icon: '🔒', vazio: 'Boletim da 2ª unidade ainda não postado' },
        { tipo: 'boletim_3',             titulo: 'Boletim — 3ª Unidade',        icon: '🔒', vazio: 'Boletim da 3ª unidade ainda não postado' },
        { tipo: 'boletim_4',             titulo: 'Boletim — 4ª Unidade',        icon: '🔒', vazio: 'Boletim da 4ª unidade ainda não postado' },
    ],

    async render(params = {}) {
        if (!Auth.requireRole('admin', 'psicopedagoga', 'professor')) return;

        const alunoId = params.alunoId;
        if (!alunoId) {
            showToast('Aluno não informado', 'error');
            return Router.navigate('alunos');
        }

        renderContent(`
            <div class="page-header">
                <button class="btn btn-ghost btn-sm" onclick="Router.navigate('alunos')">← Voltar</button>
            </div>
            <div id="perfil-aluno-content">
                <div class="loader-inline"></div>
            </div>
        `);

        const podeVerFinanceiro = Auth.can('admin');
        const podeVerRestrito   = Auth.can('admin');

        const [{ data: aluno }, { data: ultimoRelatorio }, { data: ultimaConsulta }, { data: posts }] = await Promise.all([
            supabase.from('v_alunos_completo').select('*').eq('id', alunoId).single(),
            supabase.from('relatorios').select('*').eq('aluno_id', alunoId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('consultas_psico').select('*').eq('aluno_id', alunoId).order('data', { ascending: false }).limit(1).maybeSingle(),
            // RLS já esconde os tipos restritos de quem não é admin — o
            // filtro abaixo é só pra organizar os cards na tela
            supabase.from('mural_aluno').select('*').eq('aluno_id', alunoId).order('created_at', { ascending: false }).limit(60)
        ]);

        const container = document.getElementById('perfil-aluno-content');
        if (!container) return;

        if (!aluno) {
            container.innerHTML = emptyState('Aluno não encontrado');
            return;
        }

        const ciclos = Modules.AlunoPerfil._TIPOS_CICLO.map(def => ({
            ...def,
            posts: (posts || []).filter(p => p.tipo === def.tipo).slice(0, 12)
        }));
        const restritos = podeVerRestrito
            ? Modules.AlunoPerfil._TIPOS_RESTRITOS.map(def => ({
                ...def,
                posts: (posts || []).filter(p => p.tipo === def.tipo).slice(0, 12)
            }))
            : [];

        const urlByPath = await Modules.AlunoPerfil._signedUrls([...ciclos.flatMap(c => c.posts), ...restritos.flatMap(r => r.posts)]);

        container.innerHTML = `
            <div class="perfil-hero">
                <div class="perfil-hero-avatar">${escapeHtml((aluno.nome || '?').charAt(0).toUpperCase())}</div>
                <div class="perfil-hero-info">
                    <div class="perfil-hero-nome">${escapeHtml(aluno.nome || '')}</div>
                    <div class="perfil-hero-meta">
                        ${escapeHtml(aluno.serie || 'Série não informada')}
                        ${aluno.disciplina ? ' · ' + escapeHtml(aluno.disciplina) : ''}
                        ${aluno.ativo ? '' : ' · <span class="perfil-hero-inativo">Inativo</span>'}
                    </div>
                </div>
                <div class="perfil-hero-actions">
                    ${podeVerFinanceiro ? `
                        <div class="perfil-hero-aulas">
                            <div class="perfil-hero-aulas-num">${aluno.aulas_disponiveis || 0}</div>
                            <div class="perfil-hero-aulas-label">aulas disponíveis</div>
                        </div>
                    ` : ''}
                    ${Auth.can('admin') ? `
                        <button class="perfil-hero-insights-btn" onclick="Router.navigate('insights', { alunoId: '${alunoId}' })">
                            📊 Ver Insights
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="perfil-grid">
                ${Modules.AlunoPerfil._cardPsico(ultimaConsulta)}
                ${Modules.AlunoPerfil._cardUltimaAula(ultimoRelatorio)}
            </div>

            <div class="mural-grupo">
                <div class="mural-grupo-header">
                    <h2 class="mural-grupo-titulo">📌 Mural</h2>
                    <p class="mural-grupo-subtitulo">Ciclo de assuntos por unidade — a psicopedagoga e o professor também veem.</p>
                </div>
                <div class="perfil-grid">
                    ${ciclos.map((c, i) => Modules.AlunoPerfil._cardCiclo(c, urlByPath, i)).join('')}
                </div>
            </div>

            ${restritos.length ? `
                <div class="mural-grupo mural-grupo-restrito">
                    <div class="mural-grupo-header">
                        <h2 class="mural-grupo-titulo">🔒 Acesso restrito — só administração</h2>
                        <p class="mural-grupo-subtitulo">Calendários e boletim por unidade.</p>
                    </div>
                    <div class="perfil-grid">
                        ${restritos.map((r, i) => Modules.AlunoPerfil._cardRestrito(r, urlByPath, i)).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        container.querySelectorAll('[data-lightbox-url]').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.dataset.lightboxUrl, img.dataset.lightboxAlt));
        });
    },

    async _signedUrls(posts) {
        const paths = posts.map(p => p.anexo_path).filter(Boolean);
        if (!paths.length) return {};
        const { data } = await supabase.storage.from('mural-aluno').createSignedUrls(paths, 300);
        const map = {};
        (data || []).forEach(s => { if (s.signedUrl) map[s.path] = s.signedUrl; });
        return map;
    },

    _photoGrid(posts, urlByPath, emptyMsg) {
        if (!posts?.length) return emptyState(emptyMsg);
        return `
            <div class="mural-feed mural-feed-compact mural-photo-grid">
                ${posts.map((p, i) => `
                    <div class="mural-photo-card" style="--i:${i}">
                        ${urlByPath[p.anexo_path]
                            ? `<img class="mural-photo-img" src="${escapeHtml(urlByPath[p.anexo_path])}" alt="${escapeHtml(p.anexo_nome || 'foto')}" data-lightbox-url="${escapeHtml(urlByPath[p.anexo_path])}" data-lightbox-alt="${escapeHtml(p.anexo_nome || 'foto')}" />`
                            : `<div class="mural-photo-img mural-photo-erro">Não foi possível carregar</div>`
                        }
                        ${p.texto ? `<div class="mural-photo-legenda">${escapeHtml(p.texto)}</div>` : ''}
                        <div class="mural-photo-footer">
                            <span class="mural-post-date">${fmt.datetime(p.created_at)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    _cardPsico(c) {
        return `
            <div class="perfil-card perfil-card-psico" style="--i:0">
                <div class="perfil-card-header">
                    <span class="perfil-card-icon">🧠</span>
                    <h3>Como esse aluno aprende melhor</h3>
                </div>
                <div class="perfil-card-body">
                    ${c?.como_aprende_melhor
                        ? `<p class="perfil-psico-texto">${escapeHtml(c.como_aprende_melhor)}</p>
                           <div class="perfil-card-footnote">Registrado pela psicopedagoga em ${fmt.date(c.data)}</div>`
                        : emptyState('A psicopedagoga ainda não registrou como esse aluno aprende melhor')
                    }
                </div>
            </div>
        `;
    },

    _cardUltimaAula(r) {
        const metaLabels = { sim: 'Meta totalmente atingida', parcialmente: 'Meta parcialmente atingida', nao: 'Meta não atingida' };
        const metaCls    = { sim: 'badge-success', parcialmente: 'badge-warning', nao: 'badge-danger' };

        return `
            <div class="perfil-card perfil-card-aula" style="--i:1">
                <div class="perfil-card-header">
                    <span class="perfil-card-icon">📄</span>
                    <h3>Última aula</h3>
                </div>
                <div class="perfil-card-body">
                    ${r ? `
                        <div class="perfil-card-footnote" style="margin-bottom:8px;">${fmt.datetime(r.created_at)}</div>
                        ${r.meta_atingida ? badge(metaLabels[r.meta_atingida] || r.meta_atingida, metaCls[r.meta_atingida] || 'badge-secondary') : ''}
                        ${r.motivo_meta_nao_atingida ? `<p class="perfil-aula-detalhe"><strong>Motivo:</strong> ${escapeHtml(r.motivo_meta_nao_atingida)}</p>` : ''}
                        ${r.assunto_pendente ? `<p class="perfil-aula-detalhe"><strong>Assunto pendente:</strong> ${escapeHtml(r.assunto_pendente)}</p>` : ''}
                        ${r.conteudo_ministrado ? `<p class="perfil-aula-detalhe"><strong>Conteúdo:</strong> ${escapeHtml(r.conteudo_ministrado)}</p>` : ''}
                    ` : emptyState('Nenhum relatório de aula ainda')}
                </div>
            </div>
        `;
    },

    _cardCiclo(def, urlByPath, i) {
        return `
            <div class="perfil-card perfil-card-mural" style="--i:${i}">
                <div class="perfil-card-header">
                    <span class="perfil-card-icon">📌</span>
                    <h3>${escapeHtml(def.titulo)}</h3>
                </div>
                <div class="perfil-card-body">
                    ${Modules.AlunoPerfil._photoGrid(def.posts, urlByPath, def.vazio)}
                </div>
            </div>
        `;
    },

    _cardRestrito(def, urlByPath, i) {
        return `
            <div class="perfil-card perfil-card-mural perfil-card-boletim" style="--i:${i}">
                <div class="perfil-card-header">
                    <span class="perfil-card-icon">${def.icon}</span>
                    <h3>${escapeHtml(def.titulo)}</h3>
                </div>
                <div class="perfil-card-body">
                    ${Modules.AlunoPerfil._photoGrid(def.posts, urlByPath, def.vazio)}
                </div>
            </div>
        `;
    }
};
