// ============================================================
// MÓDULO: RELATÓRIOS — relatório por aluno (sem vínculo obrigatório com aula)
// ============================================================

Modules.Relatorios = {
    _page: 1,
    _viewingId: null,

    async render() {
        if (Auth.can('aluno')) {
            renderContent(`<div class="empty-state"><div class="empty-icon">🔒</div><p>Esta área é restrita.</p></div>`);
            return;
        }
        var isProf  = Auth.can('professor');
        var isAdmin = Auth.can('admin');
        var isPsico = Auth.can('psicopedagoga');

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Relatórios de Aulas</h1>
                ${isProf ? `<button class="btn btn-primary" onclick="Modules.Relatorios.openValidarAula()">✓ Validar Aula</button>` : ''}
            </div>

            <div class="card">
                <div class="card-toolbar">
                    ${(isAdmin || isPsico) ? `
                    <select class="input" id="filter-rel-aluno" onchange="Modules.Relatorios._loadList()">
                        <option value="">Todos os alunos</option>
                    </select>` : ''}
                    <input type="month" class="input" id="filter-rel-mes"
                        onchange="Modules.Relatorios._loadList()" />
                </div>
                <div id="relatorios-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL: VALIDAR AULA -->
            <div class="modal-overlay" id="modal-validar-aula">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Validar Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-validar-aula')">×</button>
                    </div>
                    <div class="modal-body" id="validar-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-validar-aula')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-salvar-relatorio"
                            onclick="Modules.Relatorios.salvar()">Salvar Relatório</button>
                    </div>
                </div>
            </div>

            <!-- MODAL: VER RELATÓRIO -->
            <div class="modal-overlay" id="modal-ver-relatorio">
                <div class="modal-box modal-lg">
                    <div class="modal-header">
                        <h3>Relatório de Aula</h3>
                        <button class="modal-close" onclick="closeModal('modal-ver-relatorio')">×</button>
                    </div>
                    <div class="modal-body" id="ver-relatorio-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-ver-relatorio')">Fechar</button>
                        <button class="btn btn-secondary"
                            onclick="Modules.Relatorios.exportPDF()">Exportar PDF</button>
                    </div>
                </div>
            </div>
        `);

        if (Auth.can('admin', 'psicopedagoga')) {
            var res = await supabase.from('usuarios').select('id,nome').eq('role','aluno').order('nome');
            var sel = document.getElementById('filter-rel-aluno');
            if (sel && res.data) {
                res.data.forEach(function(a) {
                    sel.innerHTML += '<option value="' + a.id + '">' + escapeHtml(a.nome) + '</option>';
                });
            }
        }

        await this._loadList();
    },

    async _loadList() {
        var container = document.getElementById('relatorios-list');
        if (!container) return;

        var uid = AppState.userProfile.id;

        var query = supabase
            .from('relatorios')
            .select(`
                id, conteudo_ministrado, comportamento, compreensao,
                recomendacoes, habilidades, created_at,
                aluno:usuarios!relatorios_aluno_id_fkey(nome),
                professor:usuarios!relatorios_professor_id_fkey(nome)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (Auth.can('professor')) query = query.eq('professor_id', uid);
        if (Auth.can('aluno'))     query = query.eq('aluno_id', uid);

        var alunoEl = document.getElementById('filter-rel-aluno');
        var mesEl   = document.getElementById('filter-rel-mes');
        if (alunoEl && alunoEl.value) query = query.eq('aluno_id', alunoEl.value);
        if (mesEl && mesEl.value) {
            var p = mesEl.value.split('-');
            var ini = p[0] + '-' + p[1] + '-01';
            var fim = new Date(parseInt(p[0]), parseInt(p[1]), 0).toISOString().split('T')[0];
            query = query.gte('created_at', ini).lte('created_at', fim + 'T23:59:59');
        }

        var from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        var result = await query;
        if (result.error) {
            container.innerHTML = '<p class="text-danger">Erro: ' + escapeHtml(result.error.message) + '</p>';
            return;
        }

        var data = result.data || [];
        var totalPages = Math.ceil((result.count || 0) / APP_CONFIG.paginationSize);

        container.innerHTML = data.length ? `
            <table class="table">
                <thead><tr>
                    <th>Data</th>
                    <th>Aluno</th>
                    ${!Auth.can('aluno') ? '<th>Professor</th>' : ''}
                    <th>Comportamento</th>
                    <th>Compreensão</th>
                    <th>Ações</th>
                </tr></thead>
                <tbody>
                    ${data.map(function(r) { return `
                        <tr>
                            <td>${fmt.date(r.created_at.substring(0, 10))}</td>
                            <td>${escapeHtml((r.aluno && r.aluno.nome) || '—')}</td>
                            ${!Auth.can('aluno') ? '<td>' + escapeHtml((r.professor && r.professor.nome) || '—') + '</td>' : ''}
                            <td>${badge(r.comportamento, Modules.Relatorios._badgeComp(r.comportamento))}</td>
                            <td>${badge(r.compreensao,   Modules.Relatorios._badgeComp(r.compreensao))}</td>
                            <td>
                                <div class="action-btns">
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="Modules.Relatorios.openView('${r.id}')">Ver</button>
                                    <button class="btn btn-ghost btn-sm"
                                        onclick="Modules.Relatorios._exportById('${r.id}')">PDF</button>
                                </div>
                            </td>
                        </tr>
                    `; }).join('')}
                </tbody>
            </table>
            ${paginationHtml(Modules.Relatorios._page, totalPages, 'Modules.Relatorios._goPage')}
        ` : emptyState('Nenhum relatório encontrado');
    },

    _goPage: function(p) {
        Modules.Relatorios._page = p;
        Modules.Relatorios._loadList();
    },

    _badgeComp: function(v) {
        var m = { excelente:'badge-success', bom:'badge-info', boa:'badge-info',
                  regular:'badge-warning',   ruim:'badge-danger', baixa:'badge-danger' };
        return m[v] || 'badge-secondary';
    },

    // ── ABRIR MODAL VALIDAR AULA ──────────────────────────────────
    async openValidarAula(prefillAlunoId) {
        openModal('modal-validar-aula');
        var body = document.getElementById('validar-body');
        body.innerHTML = '<div class="loader-inline"></div>';

        // Todos os alunos ativos
        var res = await supabase
            .from('v_alunos_completo')
            .select('id, nome, serie, disciplina, aulas_disponiveis')
            .eq('ativo', true)
            .order('nome');

        var alunos = res.data || [];

        var _prefillAluno = prefillAlunoId || null;

        body.innerHTML = `
            <input type="hidden" id="rel-aluno-id" />

            <!-- SELEÇÃO DE ALUNO -->
            <div class="form-group">
                <label class="form-label">Aluno *</label>
                <select class="input" id="rel-aluno-select"
                    onchange="Modules.Relatorios._onAlunoSelect(this.value)">
                    <option value="">— selecione o aluno —</option>
                    ${alunos.map(function(a) {
                        return '<option value="' + a.id + '"' +
                            (a.aulas_disponiveis <= 0 ? ' style="color:#dc2626"' : '') + '>' +
                            escapeHtml(a.nome) +
                            (a.serie ? ' · ' + escapeHtml(a.serie) : '') +
                            (a.disciplina ? ' · ' + escapeHtml(a.disciplina) : '') +
                            ' (saldo: ' + (a.aulas_disponiveis || 0) + ')' +
                        '</option>';
                    }).join('')}
                </select>
            </div>
            <div id="rel-saldo-alerta" style="display:none"
                class="info-box" style="background:var(--color-red-bg);border-color:#fecaca;color:var(--color-red)">
            </div>

            <div id="rel-form-fields" style="display:none">
                <hr class="divider" />

                <!-- 1. CONTEÚDO -->
                <div class="rel-section">
                    <div class="rel-section-title">📚 Conteúdo ministrado</div>
                    <textarea class="input textarea" id="rel-conteudo" rows="3"
                        placeholder="Descreva o conteúdo trabalhado na aula..."></textarea>
                </div>

                <!-- 2. COMPORTAMENTO -->
                <div class="rel-section">
                    <div class="rel-section-title">🎓 Comportamento do aluno</div>
                    <div class="check-grid">
                        <label class="check-item">
                            <input type="checkbox" value="participou" class="comp-check" />
                            Participou ativamente das atividades
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="interesse" class="comp-check" />
                            Demonstrou interesse e curiosidade
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="estimulo" class="comp-check" />
                            Precisou de estímulo para se concentrar
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="desanimo" class="comp-check" />
                            Mostrou desânimo ou distração
                        </label>
                    </div>
                </div>

                <!-- 3. COMPREENSÃO -->
                <div class="rel-section">
                    <div class="rel-section-title">🧠 Nível de compreensão</div>
                    <div class="radio-list">
                        <label class="radio-item">
                            <input type="radio" name="rel-compreensao" value="excelente" />
                            Compreendeu o conteúdo e aplicou com autonomia
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-compreensao" value="boa" />
                            Compreendeu com apoio, ainda com pequenas dúvidas
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-compreensao" value="regular" />
                            Compreendeu parcialmente, precisa de reforço
                        </label>
                    </div>
                </div>

                <!-- 4. HABILIDADES -->
                <div class="rel-section">
                    <div class="rel-section-title">⭐ Habilidades observadas</div>
                    <p class="rel-sub-title">Acadêmicas</p>
                    <div class="check-grid">
                        <label class="check-item">
                            <input type="checkbox" value="escrita" class="hab-check" />
                            Escrita e ortografia
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="leitura" class="hab-check" />
                            Leitura e interpretação de texto
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="raciocinio" class="hab-check" />
                            Raciocínio lógico / cálculo
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="organizacao" class="hab-check" />
                            Organização e método de estudo
                        </label>
                    </div>
                    <p class="rel-sub-title" style="margin-top:10px">Socioemocionais</p>
                    <div class="check-grid">
                        <label class="check-item">
                            <input type="checkbox" value="atencao" class="socio-check" />
                            Atenção e foco
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="autoconfianca" class="socio-check" />
                            Autoconfiança
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="comunicacao" class="socio-check" />
                            Comunicação e expressão
                        </label>
                    </div>
                </div>

                <!-- 5. RECOMENDAÇÕES -->
                <div class="rel-section">
                    <div class="rel-section-title">🏠 Recomendações para casa</div>
                    <textarea class="input textarea" id="rel-recomendacoes" rows="3"
                        placeholder="Sugestões de estudo, exercícios, pontos de atenção..."></textarea>
                </div>
            </div>
        `;

        if (_prefillAluno) {
            var sel = document.getElementById('rel-aluno-select');
            if (sel) {
                sel.value = _prefillAluno;
                Modules.Relatorios._onAlunoSelect(_prefillAluno);
            }
        }
    },

    _onAlunoSelect: function(alunoId) {
        var form   = document.getElementById('rel-form-fields');
        var alerta = document.getElementById('rel-saldo-alerta');

        if (!alunoId) {
            form.style.display   = 'none';
            alerta.style.display = 'none';
            return;
        }

        document.getElementById('rel-aluno-id').value = alunoId;

        // Verificar saldo pelo option selecionado
        var sel = document.getElementById('rel-aluno-select');
        var opt = sel.options[sel.selectedIndex];
        var txt = opt.textContent;
        var match = txt.match(/saldo: (\d+)/);
        var saldo = match ? parseInt(match[1]) : 1;

        if (saldo <= 0) {
            alerta.textContent   = '⚠ Este aluno não tem saldo de aulas disponíveis.';
            alerta.style.display = 'block';
            alerta.style.cssText = 'display:block;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:6px;padding:10px 14px;font-size:.875rem;margin-top:8px';
            form.style.display   = 'none';
        } else {
            alerta.style.display = 'none';
            form.style.display   = 'block';
        }
    },

    _getChecked: function(cls) {
        return Array.from(document.querySelectorAll('.' + cls + ':checked')).map(function(el) {
            return el.value;
        });
    },

    _deriveComportamento: function(comp) {
        if (comp.includes('desanimo'))   return 'ruim';
        if (comp.includes('estimulo'))   return 'regular';
        if (comp.includes('participou') && comp.includes('interesse')) return 'excelente';
        if (comp.includes('participou') || comp.includes('interesse')) return 'bom';
        return 'regular';
    },

    async salvar() {
        var alunoId     = document.getElementById('rel-aluno-id').value;
        var conteudo    = document.getElementById('rel-conteudo')
                            ? document.getElementById('rel-conteudo').value.trim() : '';
        var comprEl     = document.querySelector('input[name="rel-compreensao"]:checked');
        var compreensao = comprEl ? comprEl.value : null;
        var recomEl     = document.getElementById('rel-recomendacoes');
        var recomendacoes = recomEl ? recomEl.value.trim() : '';

        if (!alunoId)     return showToast('Selecione o aluno', 'error');
        if (!conteudo)    return showToast('Informe o conteúdo ministrado', 'error');
        if (!compreensao) return showToast('Selecione o nível de compreensão', 'error');

        var comportamentos  = this._getChecked('comp-check');
        var academicas      = this._getChecked('hab-check');
        var socioemocionais = this._getChecked('socio-check');
        var comportamento   = this._deriveComportamento(comportamentos);

        setLoading('#btn-salvar-relatorio', true);
        try {
            var ins = await supabase.from('relatorios').insert({
                professor_id:        AppState.userProfile.id,
                aluno_id:            alunoId,
                conteudo_ministrado: conteudo,
                comportamento:       comportamento,
                compreensao:         compreensao,
                recomendacoes:       recomendacoes || null,
                habilidades: {
                    comportamentos:  comportamentos,
                    academicas:      academicas,
                    socioemocionais: socioemocionais
                }
            });

            if (ins.error) throw ins.error;

            // Incrementar saldo_aulas_dadas do professor em professores_info
            const piRes = await supabase.from('professores_info').select('saldo_aulas_dadas').eq('usuario_id', AppState.userProfile.id).single();
            await supabase.from('professores_info').update({ saldo_aulas_dadas: (piRes.data?.saldo_aulas_dadas || 0) + 1 }).eq('usuario_id', AppState.userProfile.id);

            // Decrementar aulas disponíveis do aluno
            const aiRes = await supabase.from('alunos_info').select('aulas_disponiveis').eq('usuario_id', alunoId).single();
            if ((aiRes.data?.aulas_disponiveis || 0) > 0) {
                await supabase.from('alunos_info').update({ aulas_disponiveis: aiRes.data.aulas_disponiveis - 1 }).eq('usuario_id', alunoId);
            }

            showToast('Relatório salvo! Saldo do aluno decrementado.', 'success', 4000);
            closeModal('modal-validar-aula');
            await this._loadList();
        } catch(err) {
            showToast(err.message || 'Erro ao salvar', 'error');
        } finally {
            setLoading('#btn-salvar-relatorio', false);
        }
    },

    // ── VER RELATÓRIO ─────────────────────────────────────────────
    async openView(id) {
        this._viewingId = id;
        openModal('modal-ver-relatorio');
        var body = document.getElementById('ver-relatorio-body');
        body.innerHTML = '<div class="loader-inline"></div>';

        var res = await supabase
            .from('relatorios')
            .select(`
                *,
                aluno:usuarios!relatorios_aluno_id_fkey(nome),
                professor:usuarios!relatorios_professor_id_fkey(nome)
            `)
            .eq('id', id)
            .single();

        var r = res.data;
        if (!r) { body.innerHTML = emptyState('Relatório não encontrado'); return; }

        var hab   = r.habilidades || {};
        var comps = hab.comportamentos  || [];
        var acad  = hab.academicas      || [];
        var socio = hab.socioemocionais || [];

        var COMP_LABELS = {
            participou:  'Participou ativamente das atividades',
            interesse:   'Demonstrou interesse e curiosidade',
            estimulo:    'Precisou de estímulo para se concentrar',
            desanimo:    'Mostrou desânimo ou distração'
        };
        var HAB_LABELS = {
            escrita:     'Escrita e ortografia',
            leitura:     'Leitura e interpretação de texto',
            raciocinio:  'Raciocínio lógico / cálculo',
            organizacao: 'Organização e método de estudo'
        };
        var SOCIO_LABELS = {
            atencao:      'Atenção e foco',
            autoconfianca:'Autoconfiança',
            comunicacao:  'Comunicação e expressão'
        };
        var COMP_MAP = {
            excelente: 'Compreendeu e aplicou com autonomia',
            boa:       'Compreendeu com apoio, com pequenas dúvidas',
            regular:   'Compreendeu parcialmente, precisa de reforço',
            baixa:     'Baixa compreensão'
        };

        body.innerHTML = `
            <div id="rel-pdf-${id}" class="rel-view">
                <div class="rel-view-topo">
                    <div>
                        <h2 style="margin:0;font-size:1.1rem">Relatório de Aula</h2>
                        <p class="text-muted" style="font-size:.8rem;margin-top:2px">
                            Emitido em ${fmt.datetime(r.created_at)}
                        </p>
                    </div>
                    <div class="rel-view-meta-box">
                        <div>
                            <span class="meta-label">Aluno&nbsp;</span>
                            <strong>${escapeHtml((r.aluno && r.aluno.nome) || '—')}</strong>
                        </div>
                        <div>
                            <span class="meta-label">Professor&nbsp;</span>
                            ${escapeHtml((r.professor && r.professor.nome) || '—')}
                        </div>
                    </div>
                </div>

                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">📚 Conteúdo ministrado</div>
                    <p>${escapeHtml(r.conteudo_ministrado)}</p>
                </div>

                ${comps.length ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🎓 Comportamento</div>
                    <ul class="rel-list">
                        ${comps.map(function(c) {
                            return '<li>' + escapeHtml(COMP_LABELS[c] || c) + '</li>';
                        }).join('')}
                    </ul>
                </div>` : ''}

                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🧠 Nível de compreensão</div>
                    <p>
                        ${badge(r.compreensao, Modules.Relatorios._badgeComp(r.compreensao))}
                        &nbsp;${escapeHtml(COMP_MAP[r.compreensao] || r.compreensao)}
                    </p>
                </div>

                ${(acad.length || socio.length) ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">⭐ Habilidades observadas</div>
                    ${acad.length ? `
                        <p class="rel-sub-title">Acadêmicas</p>
                        <ul class="rel-list">
                            ${acad.map(function(h) {
                                return '<li>' + escapeHtml(HAB_LABELS[h] || h) + '</li>';
                            }).join('')}
                        </ul>` : ''}
                    ${socio.length ? `
                        <p class="rel-sub-title" style="margin-top:8px">Socioemocionais</p>
                        <ul class="rel-list">
                            ${socio.map(function(h) {
                                return '<li>' + escapeHtml(SOCIO_LABELS[h] || h) + '</li>';
                            }).join('')}
                        </ul>` : ''}
                </div>` : ''}

                ${r.recomendacoes ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🏠 Recomendações para casa</div>
                    <p>${escapeHtml(r.recomendacoes)}</p>
                </div>` : ''}
            </div>
        `;
    },

    async _exportById(id) {
        await this.openView(id);
        setTimeout(function() { Modules.Relatorios.exportPDF(); }, 600);
    },

    async exportPDF() {
        var id = this._viewingId;
        if (!id) return showToast('Abra o relatório primeiro', 'error');

        try {
            showToast('Gerando PDF...', 'info', 2000);

            var res = await supabase
                .from('relatorios')
                .select(`*, aluno:usuarios!relatorios_aluno_id_fkey(nome), professor:usuarios!relatorios_professor_id_fkey(nome)`)
                .eq('id', id)
                .single();

            var r = res.data;
            if (!r) return showToast('Relatório não encontrado', 'error');

            var alunoNome    = (r.aluno && r.aluno.nome) || '—';
            var profNome     = (r.professor && r.professor.nome) || '—';
            var habAcad      = r.habilidades?.academicas?.join(', ')      || 'Nenhuma';
            var habSocio     = r.habilidades?.socioemocionais?.join(', ') || 'Nenhuma';

            var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            // ── LOGO ─────────────────────────────────────────────────
            // Coloque o arquivo da logo em: /home/arthur/Documentos/clickfinal/img/logo-click.png
            // Para exibir, descomente as linhas abaixo e ajuste largura/altura (ex: 30x12 mm):
            // var logoBase64 = /* importe via fetch ou embed em base64 */;
            // doc.addImage(logoBase64, 'PNG', 10, 8, 30, 12);

            // ── HEADER ────────────────────────────────────────────────
            doc.setFillColor(111, 79, 227);
            doc.rect(0, 0, 210, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CLICK DO SABER', 105, 15, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('Relatório Pedagógico Individual', 105, 23, { align: 'center' });

            doc.setFontSize(9);
            doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), 105, 30, { align: 'center' });

            // ── CARD DO ALUNO ─────────────────────────────────────────
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(10, 40, 190, 20, 3, 3, 'F');

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);

            doc.setFont('helvetica', 'bold');
            doc.text('Aluno:', 15, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(alunoNome, 35, 50);

            doc.setFont('helvetica', 'bold');
            doc.text('Professor:', 120, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(profNome, 145, 50);

            // ── TABELA ────────────────────────────────────────────────
            doc.autoTable({
                startY: 70,
                theme: 'grid',
                headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 10, cellPadding: 4 },
                columns: [
                    { header: 'Categoria', dataKey: 'item' },
                    { header: 'Descrição',  dataKey: 'detalhe' }
                ],
                body: [
                    { item: 'Data',                      detalhe: new Date(r.created_at).toLocaleDateString('pt-BR') },
                    { item: 'Conteúdo Trabalhado',        detalhe: r.conteudo_ministrado || '—' },
                    { item: 'Comportamento',              detalhe: r.comportamento       || '—' },
                    { item: 'Compreensão',                detalhe: r.compreensao         || '—' },
                    { item: 'Habilidades Acadêmicas',     detalhe: habAcad },
                    { item: 'Habilidades Socioemocionais',detalhe: habSocio },
                    { item: 'Recomendações',              detalhe: r.recomendacoes       || 'Nenhuma' }
                ],
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
            });

            // ── RODAPÉ ────────────────────────────────────────────────
            var pageHeight = doc.internal.pageSize.height;
            doc.setDrawColor(200);
            doc.line(10, pageHeight - 20, 200, pageHeight - 20);
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.text('Click do Saber - Plataforma de Acompanhamento Pedagógico', 105, pageHeight - 12, { align: 'center' });

            doc.save('relatorio-' + id.substring(0, 8) + '.pdf');
            showToast('PDF exportado', 'success');
        } catch(err) {
            showToast('Erro: ' + err.message, 'error');
        }
    }
};
