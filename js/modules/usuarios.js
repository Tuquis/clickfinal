// ============================================================
// MÓDULO: USUÁRIOS (apenas admin)
// ============================================================

Modules.Usuarios = {
    _page: 1,
    _filter: '',
    _roleFilter: '',

    async render() {
        if (!Auth.requireRole('admin')) return;

        renderContent(`
            <div class="page-header">
                <h1 class="page-title">Usuários</h1>
                <button class="btn btn-primary" onclick="Modules.Usuarios.openCreate()">+ Novo Usuário</button>
            </div>
            <div class="card">
                <div class="card-toolbar">
                    <input type="text" class="input input-search" placeholder="Buscar por nome ou email..."
                        oninput="Modules.Usuarios._onSearch(this.value)" />
                    <select class="input" id="filter-role" onchange="Modules.Usuarios._onRoleFilter(this.value)">
                        <option value="">Todos os roles</option>
                        <option value="admin">Administrador</option>
                        <option value="professor">Professor</option>
                        <option value="aluno">Aluno</option>
                        <option value="psicopedagoga">Psicopedagoga</option>
                    </select>
                </div>
                <div id="usuarios-list" class="card-body">
                    <div class="loader-inline"></div>
                </div>
            </div>

            <!-- MODAL CRIAR/EDITAR -->
            <div class="modal-overlay" id="modal-usuario">
                <div class="modal-box">
                    <div class="modal-header">
                        <h3 id="modal-usuario-title">Novo Usuário</h3>
                        <button class="modal-close" onclick="closeModal('modal-usuario')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="u-id" />
                        <div class="form-group">
                            <label class="form-label">Nome completo *</label>
                            <input type="text" class="input" id="u-nome" placeholder="Nome completo" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" class="input" id="u-email" placeholder="email@exemplo.com" />
                        </div>
                        <div class="form-group" id="u-senha-group">
                            <label class="form-label">Senha *</label>
                            <div style="position:relative">
                                <input type="password" class="input" id="u-senha"
                                    placeholder="Mínimo 6 caracteres"
                                    style="padding-right:40px" />
                                <button type="button"
                                    style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--color-text-3)"
                                    onclick="Modules.Usuarios._toggleSenha()">👁</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Role *</label>
                            <select class="input" id="u-role" onchange="Modules.Usuarios._onRoleChange(this.value)">
                                <option value="">Selecionar...</option>
                                <option value="admin">Administrador</option>
                                <option value="professor">Professor</option>
                                <option value="aluno">Aluno</option>
                                <option value="psicopedagoga">Psicopedagoga</option>
                            </select>
                        </div>

                        <!-- Campos extras para ALUNO -->
                        <div id="u-aluno-fields" style="display:none">
                            <hr class="divider" />
                            <p class="form-section-title">Informações do Aluno</p>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Série *</label>
                                    <input type="text" class="input" id="u-serie" placeholder="Ex: 3º Ano" />
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Disciplina *</label>
                                    <input type="text" class="input" id="u-disciplina" placeholder="Ex: Matemática" />
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Responsável *</label>
                                    <input type="text" class="input" id="u-responsavel" placeholder="Nome do responsável" />
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Telefone *</label>
                                    <input type="tel" class="input" id="u-telefone" placeholder="(11) 99999-9999" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Aulas Disponíveis</label>
                                <input type="number" class="input" id="u-aulas" value="0" min="0" />
                            </div>
                        </div>

                        <!-- Campos extras para PROFESSOR -->
                        <div id="u-professor-fields" style="display:none">
                            <hr class="divider" />
                            <p class="form-section-title">Informações do Professor</p>
                            <div class="form-group">
                                <label class="form-label">Matéria / Especialidade *</label>
                                <input type="text" class="input" id="u-materia"
                                    placeholder="Ex: Matemática, Português, Física..." />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Chave PIX</label>
                                <input type="text" class="input" id="u-pix"
                                    placeholder="CPF, email, telefone ou chave aleatória" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Link Google Meet (permanente)</label>
                                <input type="url" class="input" id="u-link-meet"
                                    placeholder="https://meet.google.com/..." />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-usuario')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-usuario" onclick="Modules.Usuarios.save()">
                            Salvar
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL TROCAR SENHA -->
            <div class="modal-overlay" id="modal-senha">
                <div class="modal-box modal-sm">
                    <div class="modal-header">
                        <h3>Trocar Senha</h3>
                        <button class="modal-close" onclick="closeModal('modal-senha')">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="senha-auth-id" />
                        <div class="form-group">
                            <label class="form-label">Nova senha *</label>
                            <input type="password" class="input" id="nova-senha" placeholder="Mínimo 6 caracteres" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="closeModal('modal-senha')">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-senha" onclick="Modules.Usuarios.salvarSenha()">
                            Salvar Senha
                        </button>
                    </div>
                </div>
            </div>
        `);

        await this.loadList();

        if (window._prefillRole) {
            var role = window._prefillRole;
            delete window._prefillRole;
            this.openCreate();
            var roleEl = document.getElementById('u-role');
            if (roleEl) { roleEl.value = role; this._onRoleChange(role); }
        }
    },

    _onSearch: debounce(async function(v) {
        Modules.Usuarios._filter = v;
        Modules.Usuarios._page = 1;
        await Modules.Usuarios.loadList();
    }, 400),

    async _onRoleFilter(v) {
        this._roleFilter = v;
        this._page = 1;
        await this.loadList();
    },

    _onRoleChange(v) {
        document.getElementById('u-aluno-fields').style.display     = v === 'aluno'     ? 'block' : 'none';
        document.getElementById('u-professor-fields').style.display = v === 'professor' ? 'block' : 'none';
    },

    _toggleSenha() {
        var inp = document.getElementById('u-senha');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    },

    async loadList() {
        var container = document.getElementById('usuarios-list');
        if (!container) return;

        var query = supabase
            .from('usuarios')
            .select('*', { count: 'exact' })
            .order('nome');

        if (this._filter) {
            query = query.or('nome.ilike.%' + this._filter + '%,email.ilike.%' + this._filter + '%');
        }
        if (this._roleFilter) {
            query = query.eq('role', this._roleFilter);
        }

        var from = (this._page - 1) * APP_CONFIG.paginationSize;
        query = query.range(from, from + APP_CONFIG.paginationSize - 1);

        var result = await query;
        var data = result.data;
        var error = result.error;
        var count = result.count;

        if (error) {
            container.innerHTML = '<p class="text-danger">Erro ao carregar: ' + escapeHtml(error.message) + '</p>';
            return;
        }

        var totalPages = Math.ceil((count || 0) / APP_CONFIG.paginationSize);

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Criado em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${data && data.length
                        ? data.map(function(u) { return `
                            <tr>
                                <td>
                                    <div class="user-cell">
                                        <div class="avatar-sm">${u.nome.charAt(0).toUpperCase()}</div>
                                        <span>${escapeHtml(u.nome)}</span>
                                    </div>
                                </td>
                                <td>${escapeHtml(u.email)}</td>
                                <td>${badge(fmt.role(u.role), 'badge-role-' + u.role)}</td>
                                <td>${u.ativo ? badge('Ativo','badge-success') : badge('Inativo','badge-secondary')}</td>
                                <td>${fmt.date(u.created_at)}</td>
                                <td>
                                    <div class="action-btns">
                                        <button class="btn btn-ghost btn-sm" onclick="Modules.Usuarios.openEdit('${u.id}')">Editar</button>
                                        ${u.auth_id
                                            ? `<button class="btn btn-ghost btn-sm" onclick="Modules.Usuarios.openTrocarSenha('${u.auth_id}')">Senha</button>`
                                            : ''
                                        }
                                        <button class="btn btn-ghost btn-sm text-danger" onclick="Modules.Usuarios.toggleAtivo('${u.id}', ${u.ativo})">
                                            ${u.ativo ? 'Desativar' : 'Ativar'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `; }).join('')
                        : '<tr><td colspan="6">' + emptyState('Nenhum usuário encontrado') + '</td></tr>'
                    }
                </tbody>
            </table>
            ${paginationHtml(this._page, totalPages, 'Modules.Usuarios._goPage')}
        `;
    },

    _goPage: function(p) {
        Modules.Usuarios._page = p;
        Modules.Usuarios.loadList();
    },

    openCreate: function() {
        document.getElementById('modal-usuario-title').textContent = 'Novo Usuário';
        document.getElementById('u-id').value = '';
        document.getElementById('u-nome').value = '';
        document.getElementById('u-email').value = '';
        document.getElementById('u-email').disabled = false;
        document.getElementById('u-senha').value = '';
        document.getElementById('u-senha-group').style.display = 'block';
        document.getElementById('u-role').value = '';
        document.getElementById('u-role').disabled = false;
        document.getElementById('u-aluno-fields').style.display = 'none';
        document.getElementById('u-professor-fields').style.display = 'none';
        ['u-serie','u-disciplina','u-responsavel','u-telefone'].forEach(function(id) {
            document.getElementById(id).value = '';
        });
        document.getElementById('u-aulas').value = '0';
        document.getElementById('u-materia').value = '';
        document.getElementById('u-pix').value = '';
        document.getElementById('u-link-meet').value = '';
        openModal('modal-usuario');
    },

    async openEdit(id) {
        var res = await supabase.from('usuarios').select('*').eq('id', id).single();
        var u = res.data;
        if (!u) return showToast('Usuário não encontrado', 'error');

        document.getElementById('modal-usuario-title').textContent = 'Editar Usuário';
        document.getElementById('u-id').value = u.id;
        document.getElementById('u-nome').value = u.nome;
        document.getElementById('u-email').value = u.email;
        document.getElementById('u-email').disabled = true;
        document.getElementById('u-senha').value = '';
        document.getElementById('u-senha-group').style.display = 'none'; // usa botão Senha separado
        document.getElementById('u-role').value = u.role;
        document.getElementById('u-role').disabled = true;

        document.getElementById('u-aluno-fields').style.display     = 'none';
        document.getElementById('u-professor-fields').style.display = 'none';

        if (u.role === 'aluno') {
            document.getElementById('u-aluno-fields').style.display = 'block';
            var aiRes = await supabase.from('alunos_info').select('*').eq('usuario_id', id).single();
            var ai = aiRes.data;
            if (ai) {
                document.getElementById('u-serie').value        = ai.serie;
                document.getElementById('u-disciplina').value   = ai.disciplina;
                document.getElementById('u-responsavel').value  = ai.responsavel;
                document.getElementById('u-telefone').value     = ai.telefone;
                document.getElementById('u-aulas').value        = ai.aulas_disponiveis;
            }
        } else if (u.role === 'professor') {
            document.getElementById('u-professor-fields').style.display = 'block';
            var piRes = await supabase.from('professores_info').select('*').eq('usuario_id', id).single();
            var pi = piRes.data;
            if (pi) {
                document.getElementById('u-materia').value    = pi.materia   || '';
                document.getElementById('u-pix').value        = pi.chave_pix || '';
                document.getElementById('u-link-meet').value  = pi.link_meet || '';
            }
        }
        openModal('modal-usuario');
    },

    // Cria usuário no Supabase Auth usando a Admin API (service role key)
    async _criarAuthUser(email, senha, nome, role) {
        if (!window.SUPABASE_SERVICE_KEY || window.SUPABASE_SERVICE_KEY === 'COLE_SUA_SERVICE_ROLE_KEY_AQUI') {
            throw new Error('Configure SUPABASE_SERVICE_KEY no arquivo js/config.js');
        }

        var resp = await fetch(window.SUPABASE_URL + '/auth/v1/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': window.SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + window.SUPABASE_SERVICE_KEY
            },
            body: JSON.stringify({
                email: email,
                password: senha,
                email_confirm: true,
                user_metadata: { nome: nome, role: role }
            })
        });

        var json = await resp.json();
        if (!resp.ok) {
            throw new Error(json.msg || json.message || 'Erro ao criar usuário no Auth');
        }
        return json; // contém json.id = auth_id
    },

    // Atualiza senha via Admin API
    async _atualizarSenhaAuth(authId, novaSenha) {
        if (!window.SUPABASE_SERVICE_KEY || window.SUPABASE_SERVICE_KEY === 'COLE_SUA_SERVICE_ROLE_KEY_AQUI') {
            throw new Error('Configure SUPABASE_SERVICE_KEY no arquivo js/config.js');
        }

        var resp = await fetch(window.SUPABASE_URL + '/auth/v1/admin/users/' + authId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'apikey': window.SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + window.SUPABASE_SERVICE_KEY
            },
            body: JSON.stringify({ password: novaSenha })
        });

        var json = await resp.json();
        if (!resp.ok) {
            throw new Error(json.msg || json.message || 'Erro ao atualizar senha');
        }
        return json;
    },

    async save() {
        var id      = document.getElementById('u-id').value;
        var nome    = document.getElementById('u-nome').value.trim();
        var email   = document.getElementById('u-email').value.trim();
        var senha   = document.getElementById('u-senha').value;
        var role    = document.getElementById('u-role').value;

        var errors = validateForm([
            { value: nome,  label: 'Nome',  rules: ['required'] },
            { value: email, label: 'Email', rules: ['required', 'email'] },
            { value: role,  label: 'Role',  rules: ['required'] }
        ]);

        if (!id) {
            // Novo usuário: senha obrigatória
            if (!senha || senha.length < 6) errors.push('Senha deve ter pelo menos 6 caracteres');
        }

        var alunoData = null;
        var profData  = null;

        if (role === 'aluno') {
            var serie      = document.getElementById('u-serie').value.trim();
            var disciplina = document.getElementById('u-disciplina').value.trim();
            var responsavel= document.getElementById('u-responsavel').value.trim();
            var telefone   = document.getElementById('u-telefone').value.trim();
            if (!serie)       errors.push('Série é obrigatória');
            if (!disciplina)  errors.push('Disciplina é obrigatória');
            if (!responsavel) errors.push('Responsável é obrigatório');
            if (!telefone)    errors.push('Telefone é obrigatório');
            alunoData = {
                serie, disciplina, responsavel, telefone,
                aulas_disponiveis: parseInt(document.getElementById('u-aulas').value) || 0
            };
        }

        if (role === 'professor') {
            var materia   = document.getElementById('u-materia').value.trim();
            var chavePix  = document.getElementById('u-pix').value.trim();
            var linkMeet  = document.getElementById('u-link-meet').value.trim();
            if (!materia) errors.push('Matéria é obrigatória');
            profData = { materia, chave_pix: chavePix || null, link_meet: linkMeet || null };
        }

        if (errors.length) return showToast(errors[0], 'error');

        setLoading('#btn-save-usuario', true);

        try {
            if (id) {
                // ── EDITAR USUÁRIO EXISTENTE ──────────────────────────────
                var upd = await supabase.from('usuarios').update({ nome }).eq('id', id);
                if (upd.error) throw upd.error;

                if (role === 'aluno' && alunoData) {
                    var updAi = await supabase.from('alunos_info').update(alunoData).eq('usuario_id', id);
                    if (updAi.error) throw updAi.error;
                }
                if (role === 'professor' && profData) {
                    var updPi = await supabase.from('professores_info').update(profData).eq('usuario_id', id);
                    if (updPi.error) throw updPi.error;
                }

                await auditLog('USUARIO_ATUALIZADO', 'usuarios', id, { nome });
                showToast('Usuário atualizado com sucesso', 'success');

            } else {
                // ── CRIAR NOVO USUÁRIO ────────────────────────────────────
                // 1. Verificar se email já existe
                var check = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
                if (check.data) throw new Error('Este email já está cadastrado');

                // 2. Criar no Supabase Auth (retorna o auth_id)
                var authUser = await this._criarAuthUser(email, senha, nome, role);
                var authId = authUser.id;

                // 3. Inserir na tabela usuarios
                var ins = await supabase
                    .from('usuarios')
                    .insert({ auth_id: authId, nome, email, role })
                    .select()
                    .single();
                if (ins.error) throw ins.error;
                var newUser = ins.data;

                // 4. Inserir info específica por role
                if (role === 'aluno' && alunoData) {
                    var insAi = await supabase.from('alunos_info')
                        .insert(Object.assign({ usuario_id: newUser.id }, alunoData));
                    if (insAi.error) throw insAi.error;
                } else if (role === 'professor') {
                    await supabase.from('professores_info').insert({
                        usuario_id:        newUser.id,
                        saldo_aulas_dadas: 0,
                        materia:           profData ? profData.materia    : null,
                        chave_pix:         profData ? profData.chave_pix  : null,
                        link_meet:         profData ? profData.link_meet  : null
                    });
                }

                await auditLog('USUARIO_CRIADO', 'usuarios', newUser.id, { nome, email, role });
                showToast('Usuário criado! Login: ' + email + ' | Senha definida com sucesso.', 'success', 6000);
            }

            closeModal('modal-usuario');
            await this.loadList();

        } catch (err) {
            showToast(err.message || 'Erro ao salvar usuário', 'error');
        } finally {
            setLoading('#btn-save-usuario', false);
        }
    },

    openTrocarSenha: function(authId) {
        document.getElementById('senha-auth-id').value = authId;
        document.getElementById('nova-senha').value = '';
        openModal('modal-senha');
    },

    async salvarSenha() {
        var authId = document.getElementById('senha-auth-id').value;
        var novaSenha = document.getElementById('nova-senha').value;

        if (!novaSenha || novaSenha.length < 6) {
            return showToast('Senha deve ter pelo menos 6 caracteres', 'error');
        }

        setLoading('#btn-save-senha', true);
        try {
            await this._atualizarSenhaAuth(authId, novaSenha);
            showToast('Senha atualizada com sucesso', 'success');
            closeModal('modal-senha');
        } catch (err) {
            showToast(err.message || 'Erro ao atualizar senha', 'error');
        } finally {
            setLoading('#btn-save-senha', false);
        }
    },

    async toggleAtivo(id, ativo) {
        var confirmed = await confirmAction('Deseja ' + (ativo ? 'desativar' : 'ativar') + ' este usuário?');
        if (!confirmed) return;

        var upd = await supabase.from('usuarios').update({ ativo: !ativo }).eq('id', id);
        if (upd.error) return showToast(upd.error.message, 'error');

        await auditLog('USUARIO_' + (ativo ? 'DESATIVADO' : 'ATIVADO'), 'usuarios', id, { ativo: !ativo });
        showToast('Usuário ' + (ativo ? 'desativado' : 'ativado'), 'success');
        await this.loadList();
    }
};
