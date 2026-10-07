// ============================================================
// MÓDULO: MURAL DO ALUNO (protótipo)
// O próprio aluno anexa fotos, divididas em dois grupos bem
// separados na tela — pra não misturar o que é acompanhado pelo
// professor/psicopedagoga com o que é só da administração:
//   - Mural:   ciclo de assuntos (1ª a 4ª unidade) + calendários.
//              Visível pra psicopedagoga/professor também.
//   - Boletim: 1ª a 4ª unidade. Só admin + o próprio aluno (a
//              política de RLS no banco é quem garante isso de verdade).
// Os arquivos ficam num bucket privado — sempre acessados por signed
// URL, nunca link público.
// ============================================================

const MURAL_BUCKET = 'mural-aluno';
const MURAL_SIGNED_URL_TTL = 300; // segundos

Modules.Mural = {

    _grupos: [
        {
            id: 'mural',
            titulo: '📌 Mural',
            subtitulo: 'Ciclo de assuntos e calendários — seus professores e a psicopedagoga acompanham o ciclo de assuntos por aqui.',
            tipos: [
                { tipo: 'ciclo_assuntos_1',      titulo: 'Ciclo de assuntos — 1ª Unidade' },
                { tipo: 'ciclo_assuntos_2',      titulo: 'Ciclo de assuntos — 2ª Unidade' },
                { tipo: 'ciclo_assuntos_3',      titulo: 'Ciclo de assuntos — 3ª Unidade' },
                { tipo: 'ciclo_assuntos_4',      titulo: 'Ciclo de assuntos — 4ª Unidade' },
                { tipo: 'calendario_avaliacoes', titulo: 'Calendário de avaliações' },
                { tipo: 'calendario_aulas',      titulo: 'Calendário de aulas semanal' },
            ],
        },
        {
            id: 'boletim',
            titulo: '🔒 Boletim',
            subtitulo: 'Só a administração tem acesso a essa parte.',
            restrito: true,
            tipos: [
                { tipo: 'boletim_1', titulo: '1ª Unidade' },
                { tipo: 'boletim_2', titulo: '2ª Unidade' },
                { tipo: 'boletim_3', titulo: '3ª Unidade' },
                { tipo: 'boletim_4', titulo: '4ª Unidade' },
            ],
        },
    ],

    // Lista achatada de todos os tipos — usada só pra carregar os feeds
    get _tipos() {
        return this._grupos.flatMap(g => g.tipos);
    },

    async render() {
        if (!Auth.requireRole('aluno')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Mural</h1>
            </div>
            ${this._grupos.map(g => `
                <div class="mural-grupo ${g.restrito ? 'mural-grupo-restrito' : ''}">
                    <div class="mural-grupo-header">
                        <h2 class="mural-grupo-titulo">${g.titulo}</h2>
                        <p class="mural-grupo-subtitulo">${g.subtitulo}</p>
                    </div>
                    ${g.tipos.map(t => `
                        <div class="card mural-section-card">
                            <div class="card-header">
                                <h3>${t.titulo}</h3>
                            </div>
                            <div class="card-body">
                                <div class="mural-form">
                                    <input type="file" accept="image/*" class="input" id="mural-file-${t.tipo}" />
                                    <input type="text" class="input" id="mural-legenda-${t.tipo}" maxlength="500" placeholder="Legenda (opcional)" />
                                    <button class="btn btn-primary" id="btn-mural-postar-${t.tipo}" onclick="Modules.Mural.postar('${t.tipo}')">Postar foto</button>
                                </div>
                                <div id="mural-feed-${t.tipo}" class="mural-feed">
                                    <div class="loader-inline"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `);

        await Promise.all(this._tipos.map(t => this.loadFeed(t.tipo)));
    },

    async postar(tipo) {
        const fileEl = document.getElementById(`mural-file-${tipo}`);
        const legendaEl = document.getElementById(`mural-legenda-${tipo}`);
        const file = fileEl?.files[0];

        if (!file) return showToast('Escolha uma foto antes de postar', 'error');

        setLoading(`#btn-mural-postar-${tipo}`, true);
        try {
            const safeName = sanitizeStorageName(file.name);
            const path = `${AppState.userProfile.id}/${tipo}/${Date.now()}-${safeName}`;

            const { error: upErr } = await supabase.storage.from(MURAL_BUCKET).upload(path, file, { upsert: false });
            if (upErr) throw upErr;

            const { data: inserido, error } = await supabase.from('mural_aluno').insert({
                aluno_id:   AppState.userProfile.id,
                tipo,
                texto:      legendaEl?.value.trim() || null,
                anexo_path: path,
                anexo_nome: file.name
            }).select('id').single();
            if (error) throw error;

            await auditLog('MURAL_POSTADO', 'mural_aluno', inserido?.id, { tipo });

            fileEl.value = '';
            legendaEl.value = '';
            showToast('Foto postada no mural', 'success');
            await this.loadFeed(tipo);
        } catch (err) {
            showToast(err.message || 'Erro ao postar', 'error');
        } finally {
            setLoading(`#btn-mural-postar-${tipo}`, false);
        }
    },

    async loadFeed(tipo) {
        const container = document.getElementById(`mural-feed-${tipo}`);
        if (!container) return;

        const { data, error } = await supabase
            .from('mural_aluno')
            .select('*')
            .eq('aluno_id', AppState.userProfile.id)
            .eq('tipo', tipo)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            container.innerHTML = `<p class="text-danger">Erro ao carregar: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            container.innerHTML = emptyState('Nenhuma foto postada ainda');
            return;
        }

        const paths = data.map(p => p.anexo_path);
        const { data: signed } = await supabase.storage.from(MURAL_BUCKET).createSignedUrls(paths, MURAL_SIGNED_URL_TTL);
        const urlByPath = {};
        (signed || []).forEach(s => { if (s.signedUrl) urlByPath[s.path] = s.signedUrl; });

        container.innerHTML = `
            <div class="mural-photo-grid">
                ${data.map((p, i) => `
                    <div class="mural-photo-card" style="--i:${i}">
                        ${urlByPath[p.anexo_path]
                            ? `<img class="mural-photo-img" src="${escapeHtml(urlByPath[p.anexo_path])}" alt="${escapeHtml(p.anexo_nome || 'foto')}" data-lightbox-url="${escapeHtml(urlByPath[p.anexo_path])}" data-lightbox-alt="${escapeHtml(p.anexo_nome || 'foto')}" />`
                            : `<div class="mural-photo-img mural-photo-erro">Não foi possível carregar</div>`
                        }
                        ${p.texto ? `<div class="mural-photo-legenda">${escapeHtml(p.texto)}</div>` : ''}
                        <div class="mural-photo-footer">
                            <span class="mural-post-date">${fmt.datetime(p.created_at)}</span>
                            <button class="btn btn-ghost btn-sm" onclick="Modules.Mural.excluir('${p.id}', '${tipo}', '${escapeHtml(p.anexo_path)}')">Excluir</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        Modules.Mural._wireLightbox(container);
    },

    _wireLightbox(container) {
        container.querySelectorAll('[data-lightbox-url]').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.dataset.lightboxUrl, img.dataset.lightboxAlt));
        });
    },

    async excluir(id, tipo, path) {
        const confirmed = await confirmAction('Excluir essa foto do mural?');
        if (!confirmed) return;

        const { error } = await supabase.from('mural_aluno').delete().eq('id', id);
        if (error) return showToast(error.message, 'error');

        if (path) await supabase.storage.from(MURAL_BUCKET).remove([path]);

        await auditLog('MURAL_EXCLUIDO', 'mural_aluno', id, { tipo });
        showToast('Foto excluída', 'success');
        await this.loadFeed(tipo);
    }
};
