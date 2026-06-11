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
                ${isProf ? `
                <button class="btn btn-primary" onclick="Modules.Relatorios.openValidarAula()">✓ Validar Aula</button>
                <button class="btn btn-danger"  onclick="Modules.Relatorios.openSemAluno()" style="background:#dc2626;border-color:#dc2626;color:#fff">⚠ Lançar Aula sem Aluno</button>
                ` : ''}
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

            <!-- MODAL: AULA SEM ALUNO -->
            <div class="modal-overlay" id="modal-sem-aluno">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3 style="color:#dc2626">⚠ Lançar Aula sem Aluno</h3>
                        <button class="modal-close" onclick="closeModal('modal-sem-aluno')">×</button>
                    </div>
                    <div class="modal-body" id="sem-aluno-body">
                        <div class="loader-inline"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-sem-aluno')">Cancelar</button>
                        <button class="btn" id="btn-confirmar-sem-aluno"
                            style="background:#dc2626;border-color:#dc2626;color:#fff"
                            onclick="Modules.Relatorios.salvarSemAluno()">Confirmar Lançamento</button>
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
                            <td>${badge(Modules.Relatorios._COMP_SHORT[r.comportamento]  || r.comportamento, Modules.Relatorios._badgeComp(r.comportamento))}</td>
                            <td>${badge(Modules.Relatorios._COMPR_SHORT[r.compreensao]   || r.compreensao,  Modules.Relatorios._badgeComp(r.compreensao))}</td>
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

    // ── Labels ───────────────────────────────────────────────────
    _COMP_LABELS: {
        excelente: 'Participou ativamente e demonstrou interesse',
        bom:       'Participou com engajamento moderado',
        regular:   'Precisou de estímulo para se concentrar',
        ruim:      'Mostrou desânimo ou distração'
    },
    _COMPR_LABELS: {
        excelente: 'Compreendeu e aplicou com autonomia',
        boa:       'Compreendeu com apoio, com pequenas dúvidas',
        regular:   'Compreendeu parcialmente, precisa de reforço',
        baixa:     'Baixa compreensão'
    },
    _COMP_SHORT: {
        excelente: 'Ativo e interessado',
        bom:       'Engajamento moderado',
        regular:   'Precisou de estímulo',
        ruim:      'Desânimo/distração'
    },
    _COMPR_SHORT: {
        excelente: 'Autônomo',
        boa:       'Com apoio',
        regular:   'Com reforço',
        baixa:     'Com reforço'
    },
    _HAB_LABELS: {
        escrita:     'Escrita e ortografia',
        leitura:     'Leitura e interpretação de texto',
        raciocinio:  'Raciocínio lógico / cálculo',
        organizacao: 'Organização e método de estudo'
    },
    _SOCIO_LABELS: {
        atencao:       'Atenção e foco',
        autoconfianca: 'Autoconfiança',
        comunicacao:   'Comunicação e expressão'
    },
    _META_LABELS: {
        sim:          'Sim — meta totalmente atingida',
        parcialmente: 'Parcialmente atingida',
        nao:          'Não atingida'
    },
    _INTERATIV_LABELS: {
        perguntas:  'Fez muitas perguntas',
        passivo:    'Foi passivo',
        solicitado: 'Apenas respondeu quando solicitado'
    },
    _FERR_LABELS: {
        material_proprio:  'Material Didático Próprio',
        exercicios_extras: 'Exercícios Extras',
        recursos_digitais: 'Recursos Digitais / Vídeos',
        jogos_pedagogicos: 'Jogos Pedagógicos'
    },

    _badgeComp: function(v) {
        if (v === 'excelente') return 'badge-success';
        if (v === 'bom' || v === 'boa') return 'badge-info';
        return 'badge-secondary';
    },

    // ── Handlers para campos condicionais ────────────────────────
    _onMetaChange: function(v) {
        var box = document.getElementById('rel-retomar-box');
        if (box) box.style.display = (v === 'parcialmente' || v === 'nao') ? 'block' : 'none';
    },
    _onCameraChange: function(v) {
        var box = document.getElementById('rel-camera-detalhe-box');
        if (box) box.style.display = v === 'sim' ? 'block' : 'none';
    },

    // ── ABRIR MODAL VALIDAR AULA ──────────────────────────────────
    async openValidarAula(prefillAlunoId) {
        openModal('modal-validar-aula');
        var body = document.getElementById('validar-body');
        body.innerHTML = '<div class="loader-inline"></div>';

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
                        var semSaldo = (a.aulas_disponiveis || 0) <= 0;
                        return '<option value="' + a.id + '"' +
                            (semSaldo ? ' disabled style="color:#bbb"' : '') + '>' +
                            escapeHtml(a.nome) +
                            (a.serie ? ' · ' + escapeHtml(a.serie) : '') +
                            (a.disciplina ? ' · ' + escapeHtml(a.disciplina) : '') +
                        '</option>';
                    }).join('')}
                </select>
            </div>
            <div id="rel-saldo-alerta" style="display:none"></div>

            <div id="rel-form-fields" style="display:none">
                <hr class="divider" />

                <!-- 0. DISCIPLINA MINISTRADA -->
                <div class="rel-section">
                    <div class="rel-section-title">📖 Disciplina ministrada *</div>
                    <select class="input" id="rel-disciplina" required>
                        <option value="">— selecione a disciplina —</option>
                        <option value="Matemática">Matemática</option>
                        <option value="Física">Física</option>
                        <option value="Química">Química</option>
                        <option value="História">História</option>
                        <option value="Geografia">Geografia</option>
                        <option value="Ciências">Ciências</option>
                        <option value="Biologia">Biologia</option>
                        <option value="Inglês">Inglês</option>
                        <option value="Português">Português</option>
                        <option value="Redação">Redação</option>
                        <option value="Espanhol">Espanhol</option>
                    </select>
                </div>

                <!-- 1. CONTEÚDO -->
                <div class="rel-section">
                    <div class="rel-section-title">📚 Conteúdo ministrado</div>
                    <textarea class="input textarea" id="rel-conteudo" rows="3"
                        placeholder="Descreva o conteúdo trabalhado na aula..."></textarea>
                </div>

                <!-- 2. META DA AULA -->
                <div class="rel-section">
                    <div class="rel-section-title">🎯 Meta da aula atingida?</div>
                    <div class="radio-list">
                        <label class="radio-item">
                            <input type="radio" name="rel-meta" value="sim"
                                onchange="Modules.Relatorios._onMetaChange(this.value)" />
                            Sim
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-meta" value="parcialmente"
                                onchange="Modules.Relatorios._onMetaChange(this.value)" />
                            Parcialmente
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-meta" value="nao"
                                onchange="Modules.Relatorios._onMetaChange(this.value)" />
                            Não
                        </label>
                    </div>
                    <div id="rel-retomar-box" style="display:none;margin-top:10px;padding:12px 14px;background:var(--color-surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--color-warning, #f59e0b)">
                        <div style="font-weight:600;font-size:.875rem;margin-bottom:8px">Necessidade de retomar o conteúdo?</div>
                        <div class="radio-list" style="flex-direction:row;gap:20px">
                            <label class="radio-item"><input type="radio" name="rel-retomar" value="sim" /> Sim</label>
                            <label class="radio-item"><input type="radio" name="rel-retomar" value="nao" /> Não</label>
                        </div>
                    </div>
                </div>

                <!-- 3. COMPORTAMENTO -->
                <div class="rel-section">
                    <div class="rel-section-title">🎓 Comportamento do aluno</div>
                    <div class="radio-list">
                        <label class="radio-item">
                            <input type="radio" name="rel-comportamento" value="excelente" />
                            Participou ativamente e demonstrou interesse
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-comportamento" value="bom" />
                            Participou com engajamento moderado
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-comportamento" value="regular" />
                            Precisou de estímulo para se concentrar
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-comportamento" value="ruim" />
                            Mostrou desânimo ou distração
                        </label>
                    </div>
                </div>

                <!-- 4. NÍVEL DE INTERATIVIDADE -->
                <div class="rel-section">
                    <div class="rel-section-title">💬 Nível de interatividade</div>
                    <div class="radio-list">
                        <label class="radio-item">
                            <input type="radio" name="rel-interatividade" value="perguntas" />
                            Fez muitas perguntas
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-interatividade" value="passivo" />
                            Foi passivo
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-interatividade" value="solicitado" />
                            Apenas respondeu quando solicitado
                        </label>
                    </div>
                </div>

                <!-- 5. COMPREENSÃO -->
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

                <!-- 6. HABILIDADES -->
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

                <!-- 7. FERRAMENTAS UTILIZADAS -->
                <div class="rel-section">
                    <div class="rel-section-title">🛠️ Ferramentas utilizadas</div>
                    <div class="check-grid">
                        <label class="check-item">
                            <input type="checkbox" value="material_proprio" class="ferr-check" />
                            Material Didático Próprio
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="exercicios_extras" class="ferr-check" />
                            Exercícios Extras
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="recursos_digitais" class="ferr-check" />
                            Recursos Digitais / Vídeos
                        </label>
                        <label class="check-item">
                            <input type="checkbox" value="jogos_pedagogicos" class="ferr-check" />
                            Jogos Pedagógicos
                        </label>
                    </div>
                </div>

                <!-- 8. CÂMERA -->
                <div class="rel-section">
                    <div class="rel-section-title">📷 Aluno teve objeção em ficar com a câmera ligada?</div>
                    <div class="radio-list" style="flex-direction:row;gap:20px">
                        <label class="radio-item">
                            <input type="radio" name="rel-camera" value="nao"
                                onchange="Modules.Relatorios._onCameraChange(this.value)" />
                            Não
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="rel-camera" value="sim"
                                onchange="Modules.Relatorios._onCameraChange(this.value)" />
                            Sim
                        </label>
                    </div>
                    <div id="rel-camera-detalhe-box" style="display:none;margin-top:10px">
                        <textarea class="input textarea" id="rel-camera-detalhe" rows="2"
                            placeholder="Explique o ocorrido..."></textarea>
                    </div>
                </div>

                <!-- 9. OBSERVAÇÕES -->
                <div class="rel-section">
                    <div class="rel-section-title">📝 Observações</div>
                    <textarea class="input textarea" id="rel-observacoes" rows="3"
                        placeholder="Observações gerais sobre a aula..."></textarea>
                </div>

                <!-- 10. RECOMENDAÇÕES -->
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

    async salvar() {
        var alunoId              = document.getElementById('rel-aluno-id').value;
        var disciplinaMinistrada = document.getElementById('rel-disciplina')?.value || '';
        var conteudo             = (document.getElementById('rel-conteudo')?.value || '').trim();
        var comportEl            = document.querySelector('input[name="rel-comportamento"]:checked');
        var comportamento = comportEl ? comportEl.value : null;
        var comprEl       = document.querySelector('input[name="rel-compreensao"]:checked');
        var compreensao   = comprEl ? comprEl.value : null;
        var recomEl       = document.getElementById('rel-recomendacoes');
        var recomendacoes = recomEl ? recomEl.value.trim() : '';

        // Novos campos
        var metaEl       = document.querySelector('input[name="rel-meta"]:checked');
        var meta_atingida = metaEl ? metaEl.value : null;

        var retomarEl      = document.querySelector('input[name="rel-retomar"]:checked');
        var retomar_conteudo = (meta_atingida === 'parcialmente' || meta_atingida === 'nao')
            ? (retomarEl ? retomarEl.value === 'sim' : null)
            : null;

        var interativEl   = document.querySelector('input[name="rel-interatividade"]:checked');
        var interatividade = interativEl ? interativEl.value : null;

        var ferramentas   = this._getChecked('ferr-check');

        var obsEl         = document.getElementById('rel-observacoes');
        var observacoes   = obsEl ? obsEl.value.trim() : '';

        var cameraEl      = document.querySelector('input[name="rel-camera"]:checked');
        var camera_objecao = cameraEl ? cameraEl.value === 'sim' : null;

        var camDetEl      = document.getElementById('rel-camera-detalhe');
        var camera_objecao_detalhe = (camera_objecao && camDetEl)
            ? camDetEl.value.trim() : null;

        if (!alunoId)              return showToast('Selecione o aluno', 'error');
        if (!disciplinaMinistrada) return showToast('Selecione a disciplina ministrada', 'error');
        if (!conteudo)             return showToast('Informe o conteúdo ministrado', 'error');
        if (!meta_atingida)return showToast('Informe se a meta da aula foi atingida', 'error');
        if (!comportamento)return showToast('Selecione o comportamento do aluno', 'error');
        if (!interatividade)return showToast('Selecione o nível de interatividade', 'error');
        if (!compreensao)  return showToast('Selecione o nível de compreensão', 'error');
        if (camera_objecao === null) return showToast('Informe sobre a câmera do aluno', 'error');

        var academicas      = this._getChecked('hab-check');
        var socioemocionais = this._getChecked('socio-check');

        setLoading('#btn-salvar-relatorio', true);
        try {
            var ins = await supabase.from('relatorios').insert({
                professor_id:          AppState.userProfile.id,
                aluno_id:              alunoId,
                disciplina_ministrada: disciplinaMinistrada || null,
                conteudo_ministrado:   conteudo,
                comportamento:         comportamento,
                compreensao:           compreensao,
                recomendacoes:         recomendacoes || null,
                habilidades: {
                    academicas:        academicas,
                    socioemocionais:   socioemocionais
                },
                // novos campos
                meta_atingida:              meta_atingida,
                retomar_conteudo:           retomar_conteudo,
                interatividade:             interatividade,
                ferramentas:                ferramentas.length ? ferramentas : null,
                observacoes:                observacoes || null,
                camera_objecao:             camera_objecao,
                camera_objecao_detalhe:     camera_objecao_detalhe || null
            });

            if (ins.error) throw ins.error;

            // Incrementar saldo_aulas_dadas do professor
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
        var ferr  = r.ferramentas || [];

        var metaBadge = r.meta_atingida === 'sim'
            ? 'badge-success'
            : r.meta_atingida === 'parcialmente' ? 'badge-warning' : 'badge-danger';

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
                        ${r.disciplina_ministrada ? `<div>
                            <span class="meta-label">Disciplina&nbsp;</span>
                            <strong>${escapeHtml(r.disciplina_ministrada)}</strong>
                        </div>` : ''}
                    </div>
                </div>

                ${r.disciplina_ministrada ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">📖 Disciplina ministrada</div>
                    <p>${escapeHtml(r.disciplina_ministrada)}</p>
                </div>` : ''}

                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">📚 Conteúdo ministrado</div>
                    <p>${escapeHtml(r.conteudo_ministrado)}</p>
                </div>

                ${r.meta_atingida ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🎯 Meta da aula atingida</div>
                    <p>
                        ${badge(Modules.Relatorios._META_LABELS[r.meta_atingida] || r.meta_atingida, metaBadge)}
                    </p>
                    ${r.retomar_conteudo !== null && r.retomar_conteudo !== undefined ? `
                        <p style="margin-top:6px;font-size:.875rem;color:var(--color-text-muted)">
                            Necessidade de retomar: <strong>${r.retomar_conteudo ? 'Sim' : 'Não'}</strong>
                        </p>` : ''}
                </div>` : ''}

                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🎓 Comportamento</div>
                    ${comps.length
                        ? `<ul class="rel-list">${comps.map(function(c) {
                              var legado = {participou:'Participou ativamente das atividades',interesse:'Demonstrou interesse e curiosidade',estimulo:'Precisou de estímulo para se concentrar',desanimo:'Mostrou desânimo ou distração'};
                              return '<li>' + escapeHtml(legado[c] || c) + '</li>';
                          }).join('')}</ul>`
                        : `<p>${escapeHtml(Modules.Relatorios._COMP_LABELS[r.comportamento] || r.comportamento || '—')}</p>`
                    }
                </div>

                ${r.interatividade ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">💬 Nível de interatividade</div>
                    <p>${escapeHtml(Modules.Relatorios._INTERATIV_LABELS[r.interatividade] || r.interatividade)}</p>
                </div>` : ''}

                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🧠 Nível de compreensão</div>
                    <p>
                        ${badge(Modules.Relatorios._COMPR_SHORT[r.compreensao] || r.compreensao, Modules.Relatorios._badgeComp(r.compreensao))}
                        &nbsp;${escapeHtml(Modules.Relatorios._COMPR_LABELS[r.compreensao] || r.compreensao || '—')}
                    </p>
                </div>

                ${(acad.length || socio.length) ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">⭐ Habilidades observadas</div>
                    ${acad.length ? `
                        <p class="rel-sub-title">Acadêmicas</p>
                        <ul class="rel-list">
                            ${acad.map(function(h) {
                                return '<li>' + escapeHtml(Modules.Relatorios._HAB_LABELS[h] || h) + '</li>';
                            }).join('')}
                        </ul>` : ''}
                    ${socio.length ? `
                        <p class="rel-sub-title" style="margin-top:8px">Socioemocionais</p>
                        <ul class="rel-list">
                            ${socio.map(function(h) {
                                return '<li>' + escapeHtml(Modules.Relatorios._SOCIO_LABELS[h] || h) + '</li>';
                            }).join('')}
                        </ul>` : ''}
                </div>` : ''}

                ${ferr.length ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">🛠️ Ferramentas utilizadas</div>
                    <ul class="rel-list">
                        ${ferr.map(function(f) {
                            return '<li>' + escapeHtml(Modules.Relatorios._FERR_LABELS[f] || f) + '</li>';
                        }).join('')}
                    </ul>
                </div>` : ''}

                ${(r.camera_objecao !== null && r.camera_objecao !== undefined) ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">📷 Câmera do aluno</div>
                    <p>Objeção em ficar com câmera ligada: <strong>${r.camera_objecao ? 'Sim' : 'Não'}</strong></p>
                    ${r.camera_objecao && r.camera_objecao_detalhe ? `
                        <p style="margin-top:6px;padding:10px 12px;background:var(--color-surface-2);border-radius:var(--radius-sm);font-size:.875rem">
                            ${escapeHtml(r.camera_objecao_detalhe)}
                        </p>` : ''}
                </div>` : ''}

                ${r.observacoes ? `
                <div class="rel-bloco">
                    <div class="rel-bloco-titulo">📝 Observações</div>
                    <p>${escapeHtml(r.observacoes)}</p>
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

            var alunoNome = (r.aluno && r.aluno.nome) || '—';
            var profNome  = (r.professor && r.professor.nome) || '—';

            var habAcad  = (r.habilidades?.academicas || [])
                .map(function(k) { return Modules.Relatorios._HAB_LABELS[k] || k; }).join('\n') || 'Nenhuma';
            var habSocio = (r.habilidades?.socioemocionais || [])
                .map(function(k) { return Modules.Relatorios._SOCIO_LABELS[k] || k; }).join('\n') || 'Nenhuma';
            var ferrStr  = (r.ferramentas || [])
                .map(function(k) { return Modules.Relatorios._FERR_LABELS[k] || k; }).join('\n') || 'Nenhuma';

            var nfc = function(s) { return s ? String(s).normalize('NFC') : ''; };

            var C_PURPLE      = [111, 79, 227];
            var C_PURPLE_DARK = [79, 48, 173];
            var C_PURPLE_LITE = [237, 233, 254];
            var C_PURPLE_SEC  = [167, 139, 250];
            var C_ROW_ODD     = [249, 248, 255];
            var C_LABEL       = [17, 24, 39];
            var C_BLACK       = [17, 24, 39];
            var C_WHITE       = [255, 255, 255];

            var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            var pageW = 210;
            var pageH = doc.internal.pageSize.height;
            var margin = 10;
            var colW = pageW - margin * 2;

            // ── Rodapé em todas as páginas ────────────────────────────
            var drawFooter = function() {
                var pages = doc.internal.getNumberOfPages();
                for (var p = 1; p <= pages; p++) {
                    doc.setPage(p);
                    doc.setFillColor(...C_PURPLE);
                    doc.rect(0, pageH - 12, pageW, 12, 'F');
                    doc.setTextColor(...C_WHITE);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(nfc('Click do Saber  |  Plataforma de Acompanhamento Pedagogico  |  Pagina ' + p + ' de ' + pages), pageW / 2, pageH - 5, { align: 'center' });
                }
            };

            // ── Cabeçalho de seção ────────────────────────────────────
            var drawSection = function(y, title, color) {
                doc.setFillColor(...color);
                doc.roundedRect(margin, y, colW, 8, 1, 1, 'F');
                doc.setTextColor(...C_WHITE);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.text(nfc(title.toUpperCase()), margin + 4, y + 5.5);
                return y + 8;
            };

            // ── Tabela de seção ───────────────────────────────────────
            var drawTable = function(startY, rows) {
                doc.autoTable({
                    startY: startY,
                    body: rows,
                    theme: 'plain',
                    styles: {
                        fontSize: 9,
                        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                        textColor: C_BLACK,
                        lineColor: [220, 215, 240],
                        lineWidth: 0.2
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: 58, fillColor: C_ROW_ODD, textColor: C_LABEL }
                    },
                    alternateRowStyles: { fillColor: [255, 255, 255] },
                    margin: { left: margin, right: margin },
                    tableWidth: colW,
                    didDrawPage: function() {}
                });
                return doc.lastAutoTable.finalY + 4;
            };

            // ════════════════════════════════════════════════════════
            // HEADER
            // ════════════════════════════════════════════════════════
            doc.setFillColor(...C_PURPLE);
            doc.rect(0, 0, pageW, 38, 'F');

            // Faixa diagonal decorativa
            doc.setFillColor(...C_PURPLE_DARK);
            doc.triangle(160, 0, 210, 0, 210, 38, 'F');

            doc.setTextColor(...C_WHITE);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(nfc('Click do Saber'), pageW / 2, 16, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(nfc('Relatorio Pedagogico Individual'), pageW / 2, 24, { align: 'center' });

            doc.setFontSize(8);
            var dataEmissao = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            doc.text(nfc('Emitido em ' + dataEmissao), pageW / 2, 31, { align: 'center' });

            // ════════════════════════════════════════════════════════
            // CARD DE IDENTIFICAÇÃO
            // ════════════════════════════════════════════════════════
            doc.setFillColor(...C_PURPLE_LITE);
            doc.roundedRect(margin, 42, colW, 24, 2, 2, 'F');
            doc.setDrawColor(...C_PURPLE);
            doc.setLineWidth(0.4);
            doc.roundedRect(margin, 42, colW, 24, 2, 2, 'S');

            // Linha divisória vertical
            doc.setDrawColor(...C_PURPLE);
            doc.setLineWidth(0.3);
            doc.line(margin + 63, 44, margin + 63, 64);
            doc.line(margin + 126, 44, margin + 126, 64);

            var cols = [margin + 4, margin + 67, margin + 130];
            var labels = ['ALUNO', 'PROFESSOR', 'DISCIPLINA'];
            var values = [alunoNome, profNome, r.disciplina_ministrada || '—'];

            for (var i = 0; i < 3; i++) {
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...C_PURPLE);
                doc.text(nfc(labels[i]), cols[i], 50);

                doc.setFontSize(9.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...C_BLACK);
                var val = nfc(values[i]);
                var lines = doc.splitTextToSize(val, 57);
                doc.text(lines, cols[i], 57);
            }

            var y = 72;

            // ════════════════════════════════════════════════════════
            // SEÇÃO 1 — SOBRE A AULA
            // ════════════════════════════════════════════════════════
            y = drawSection(y, 'Sobre a Aula', C_PURPLE);

            var sec1 = [
                [nfc('Conteudo Ministrado'), nfc(r.conteudo_ministrado || '—')]
            ];
            if (r.meta_atingida) {
                sec1.push([nfc('Meta da Aula'), nfc(Modules.Relatorios._META_LABELS[r.meta_atingida] || r.meta_atingida)]);
                if (r.retomar_conteudo !== null && r.retomar_conteudo !== undefined) {
                    sec1.push([nfc('Retomar Conteudo'), nfc(r.retomar_conteudo ? 'Sim' : 'Nao')]);
                }
            }
            y = drawTable(y, sec1);

            // ════════════════════════════════════════════════════════
            // SEÇÃO 2 — AVALIAÇÃO DO ALUNO
            // ════════════════════════════════════════════════════════
            y = drawSection(y, 'Avaliacao do Aluno', C_PURPLE);

            var sec2 = [
                [nfc('Comportamento'), nfc(Modules.Relatorios._COMP_LABELS[r.comportamento] || r.comportamento || '—')]
            ];
            if (r.interatividade) {
                sec2.push([nfc('Interatividade'), nfc(Modules.Relatorios._INTERATIV_LABELS[r.interatividade] || r.interatividade)]);
            }
            sec2.push([nfc('Compreensao'), nfc(Modules.Relatorios._COMPR_LABELS[r.compreensao] || r.compreensao || '—')]);
            if (r.camera_objecao !== null && r.camera_objecao !== undefined) {
                sec2.push([nfc('Objecao a Camera'), nfc(r.camera_objecao ? 'Sim' : 'Nao')]);
                if (r.camera_objecao && r.camera_objecao_detalhe) {
                    sec2.push([nfc('Detalhe Camera'), nfc(r.camera_objecao_detalhe)]);
                }
            }
            y = drawTable(y, sec2);

            // ════════════════════════════════════════════════════════
            // SEÇÃO 3 — HABILIDADES & FERRAMENTAS
            // ════════════════════════════════════════════════════════
            y = drawSection(y, 'Habilidades e Ferramentas', C_PURPLE);

            var sec3 = [
                [nfc('Habilidades Academicas'),      nfc(habAcad)],
                [nfc('Habilidades Socioemocionais'), nfc(habSocio)],
                [nfc('Ferramentas Utilizadas'),      nfc(ferrStr)]
            ];
            y = drawTable(y, sec3);

            // ════════════════════════════════════════════════════════
            // SEÇÃO 4 — OBSERVAÇÕES & RECOMENDAÇÕES
            // ════════════════════════════════════════════════════════
            if (r.observacoes || r.recomendacoes) {
                y = drawSection(y, 'Observacoes e Recomendacoes', C_PURPLE);
                var sec4 = [];
                if (r.observacoes)    sec4.push([nfc('Observacoes'),   nfc(r.observacoes)]);
                if (r.recomendacoes)  sec4.push([nfc('Recomendacoes'), nfc(r.recomendacoes)]);
                y = drawTable(y, sec4);
            }

            drawFooter();

            var nomeArquivo = alunoNome.normalize('NFC').replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
            doc.save('relatorio-' + (nomeArquivo || id.substring(0, 8)) + '.pdf');
            showToast('PDF exportado', 'success');
        } catch(err) {
            showToast('Erro: ' + err.message, 'error');
        }
    },

    // ── AULA SEM ALUNO ────────────────────────────────────────────

    async openSemAluno() {
        openModal('modal-sem-aluno');
        var body = document.getElementById('sem-aluno-body');
        body.innerHTML = '<div class="loader-inline"></div>';

        var res = await supabase
            .from('v_alunos_completo')
            .select('id, nome, serie, disciplina, aulas_disponiveis')
            .eq('ativo', true)
            .order('nome');

        var alunos = res.data || [];

        body.innerHTML = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 14px;margin-bottom:16px;font-size:.875rem;color:#dc2626">
                Esta ação registra que o aluno <strong>não compareceu</strong> à aula.
                A aula será <strong>debitada do saldo do aluno</strong> e
                <strong>R$&nbsp;14,00 serão contabilizados</strong> no seu pagamento.
            </div>
            <div class="form-group">
                <label class="form-label">Aluno que faltou *</label>
                <select class="input" id="sem-aluno-select">
                    <option value="">— selecione o aluno —</option>
                    ${alunos.map(function(a) {
                        var semSaldo = (a.aulas_disponiveis || 0) <= 0;
                        return '<option value="' + a.id + '"' +
                            (semSaldo ? ' disabled style="color:#bbb"' : '') + '>' +
                            escapeHtml(a.nome) +
                            (a.serie       ? ' · ' + escapeHtml(a.serie)      : '') +
                            (a.disciplina  ? ' · ' + escapeHtml(a.disciplina) : '') +
                        '</option>';
                    }).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Observação (opcional)</label>
                <textarea class="input textarea" id="sem-aluno-obs" rows="2"
                    placeholder="Ex: Aluno avisou por mensagem, motivo de saúde..."></textarea>
            </div>
        `;
    },

    async salvarSemAluno() {
        var alunoId = (document.getElementById('sem-aluno-select')?.value || '').trim();
        if (!alunoId) return showToast('Selecione o aluno', 'error');

        var obs = (document.getElementById('sem-aluno-obs')?.value || '').trim();
        var profId = AppState.userProfile.id;

        var btn = document.getElementById('btn-confirmar-sem-aluno');
        if (btn) btn.disabled = true;
        try {
            // 1. Registrar na tabela relatorios como aula sem aluno
            var ins = await supabase.from('relatorios').insert({
                professor_id:        profId,
                aluno_id:            alunoId,
                conteudo_ministrado: 'Aula registrada — aluno não compareceu',
                comportamento:       'regular',
                compreensao:         'regular',
                observacoes:         obs || null,
                sem_aluno:           true
            });
            if (ins.error) throw ins.error;

            // 2. Incrementar saldo_aulas_dadas e saldo_aulas_sem_aluno do professor
            var piRes = await supabase
                .from('professores_info')
                .select('saldo_aulas_dadas, saldo_aulas_sem_aluno')
                .eq('usuario_id', profId)
                .single();
            await supabase.from('professores_info').update({
                saldo_aulas_dadas:      (piRes.data?.saldo_aulas_dadas      || 0) + 1,
                saldo_aulas_sem_aluno:  (piRes.data?.saldo_aulas_sem_aluno  || 0) + 1
            }).eq('usuario_id', profId);

            // 3. Debitar saldo do aluno (igual a uma aula normal)
            var aiRes = await supabase
                .from('alunos_info')
                .select('aulas_disponiveis')
                .eq('usuario_id', alunoId)
                .single();
            if ((aiRes.data?.aulas_disponiveis || 0) > 0) {
                await supabase.from('alunos_info').update({
                    aulas_disponiveis: aiRes.data.aulas_disponiveis - 1
                }).eq('usuario_id', alunoId);
            }

            await auditLog('AULA_SEM_ALUNO', 'relatorios', null, { alunoId });
            showToast('Aula sem aluno registrada. Saldo do aluno decrementado.', 'success', 4000);
            closeModal('modal-sem-aluno');
            await this._loadList();
        } catch(err) {
            showToast(err.message || 'Erro ao registrar', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }
};
