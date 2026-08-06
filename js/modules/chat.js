// ============================================================
// MÓDULO: CHAT DIRETO — mensagens entre professor e aluno
// Interface estilo WhatsApp: lista de contatos + conversa
// ============================================================

Modules.Chat = {
    _uid:            null,
    _role:           null,
    _contacts:       [],
    _activeContact:  null,
    _globalChannel:  null,
    _onPage:         false,

    // ══════════════════════════════════════════════════════════
    // INICIALIZAÇÃO GLOBAL (chamado no initApp, persiste sempre)
    // ══════════════════════════════════════════════════════════
    async initGlobal(uid, role) {
        this._uid  = uid;
        this._role = role;
        if (role !== 'professor' && role !== 'aluno') return;

        // Badge inicial
        await this._refreshBadge();

        // Realtime global: escuta novas mensagens recebidas
        if (this._globalChannel) supabase.removeChannel(this._globalChannel);
        this._globalChannel = supabase
            .channel('chat-global-' + uid)
            .on('postgres_changes', {
                event:  'INSERT',
                schema: 'public',
                table:  'mensagens_diretas',
                filter: `destinatario_id=eq.${uid}`,
            }, (payload) => this._onGlobalMessage(payload.new))
            .subscribe();
    },

    async _refreshBadge() {
        const { count } = await supabase
            .from('mensagens_diretas')
            .select('id', { count: 'exact', head: true })
            .eq('destinatario_id', this._uid)
            .eq('lida', false);

        this._setBadge(count || 0);
    },

    _setBadge(n) {
        const badge = document.getElementById('chat-nav-badge');
        if (!badge) return;
        badge.textContent    = n > 9 ? '9+' : String(n);
        badge.style.display  = n > 0 ? '' : 'none';
    },

    _onGlobalMessage(msg) {
        if (this._onPage) {
            // Atualiza contato na lista se a página de chat estiver aberta
            const c = this._contacts.find(x => x.id === msg.remetente_id);
            if (c) {
                c.lastMsg = msg;
                if (this._activeContact?.id !== msg.remetente_id) {
                    c.unread = (c.unread || 0) + 1;
                } else {
                    // Conversa ativa: appenda a bolha e marca como lida
                    const container = document.getElementById('chat-direct-messages');
                    if (container && !document.querySelector(`[data-chat-id="${msg.id}"]`)) {
                        const msgDate = new Date(msg.created_at).toLocaleDateString('pt-BR');
                        const lastSep = container.querySelector('.chat-date-sep:last-of-type');
                        if (msgDate !== lastSep?.dataset.date) this._appendDateSep(container, msgDate);
                        this._appendBubble(container, msg, true);
                        supabase.from('mensagens_diretas').update({ lida: true }).eq('id', msg.id);
                    }
                }
                this._sortContacts();
                this._renderContactList();
            }
        }
        this._refreshBadge();
    },

    // ══════════════════════════════════════════════════════════
    // ROTA PRINCIPAL — render() chamado pelo Router
    // ══════════════════════════════════════════════════════════
    async render() {
        this._uid    = AppState.userProfile.id;
        this._role   = AppState.role;
        this._onPage = true;
        this._activeContact = null;

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="chat-page">
                <div class="chat-page-sidebar">
                    <div class="chat-page-sidebar-header">
                        <div class="chat-page-title">Mensagens</div>
                        <input class="input chat-search" id="chat-search-input"
                            placeholder="🔍 Buscar contato..."
                            oninput="Modules.Chat._filterContacts(this.value)">
                    </div>
                    <div class="chat-contacts-list" id="chat-contacts-list">
                        <div class="loader-inline" style="padding:24px"></div>
                    </div>
                </div>
                <div class="chat-page-main" id="chat-page-main">
                    <div class="chat-empty-state">
                        <div class="chat-empty-icon">💬</div>
                        <p>Selecione uma conversa para começar</p>
                    </div>
                </div>
            </div>
        `;

        // Zera badge ao entrar na página
        this._setBadge(0);

        await this._loadContacts();

        // Se veio do dashboard com pendência, abre o primeiro contato com unread
        const primeiroUnread = this._contacts.find(c => c.unread > 0);
        if (primeiroUnread) this._openConv(primeiroUnread.id);
    },

    // ══════════════════════════════════════════════════════════
    // CONTATOS
    // ══════════════════════════════════════════════════════════
    async _loadContacts() {
        const uid  = this._uid;
        const role = this._role;

        const listEl = document.getElementById('chat-contacts-list');

        // Carrega contatos pela role oposta
        let users = null;
        let usersErr = null;

        if (role === 'professor') {
            // Professor pode ver alunos direto (RLS permite)
            const res = await supabase
                .from('usuarios')
                .select('id, nome')
                .eq('role', 'aluno')
                .eq('ativo', true)
                .order('nome');
            users    = res.data;
            usersErr = res.error;
        } else {
            // Aluno: tenta RPC (SECURITY DEFINER) primeiro
            const rpc = await supabase.rpc('get_contatos_chat', { p_role: 'aluno' });
            if (!rpc.error) {
                users = rpc.data;
            } else {
                // Fallback: busca via agenda_meet os IDs dos professores desta aluno
                // e lê os seus próprios dados de um a um com .in() — RLS libera
                // por auth.uid(), mas só quando o row.id está na lista autorizada;
                // como isso ainda falha, usamos mensagens_diretas já existentes como pivot.
                // Última opção: usa .or() para pegar role='professor' + id próprio.
                // Supabase aplica RLS *antes* do OR, então qualquer linha de professor
                // com a policy corrigida já aparece; se ainda não rodou o SQL, retorna vazio.
                const res2 = await supabase
                    .from('usuarios')
                    .select('id, nome')
                    .eq('role', 'professor')
                    .eq('ativo', true)
                    .order('nome');
                users    = res2.data;
                usersErr = res2.error;
            }
        }

        if (usersErr) {
            console.error('Erro ao carregar contatos:', usersErr);
            if (listEl) listEl.innerHTML = '<p class="chat-no-contacts">Erro ao carregar contatos.</p>';
            return;
        }

        if (!users || users.length === 0) {
            if (listEl) listEl.innerHTML = '<p class="chat-no-contacts">Nenhum contato encontrado.</p>';
            return;
        }

        const contactIds = users.map(u => u.id);

        // Mensagens envolvendo o usuário atual (para preview + contagem unread)
        const { data: allMsgs } = await supabase
            .from('mensagens_diretas')
            .select('id, remetente_id, destinatario_id, conteudo, created_at, lida, anexo_url, anexo_nome, anexo_tipo')
            .or(`remetente_id.eq.${uid},destinatario_id.eq.${uid}`)
            .order('created_at', { ascending: false });

        const lastMsgByContact = {};
        const unreadByContact  = {};
        (allMsgs || []).forEach(m => {
            const partnerId = m.remetente_id === uid ? m.destinatario_id : m.remetente_id;
            if (!lastMsgByContact[partnerId]) lastMsgByContact[partnerId] = m;
            if (m.destinatario_id === uid && !m.lida) {
                unreadByContact[partnerId] = (unreadByContact[partnerId] || 0) + 1;
            }
        });

        this._contacts = (users || []).map(u => ({
            id:      u.id,
            nome:    u.nome,
            lastMsg: lastMsgByContact[u.id] || null,
            unread:  unreadByContact[u.id]  || 0,
        }));

        this._sortContacts();
        this._renderContactList();
    },

    _sortContacts() {
        this._contacts.sort((a, b) => {
            if (a.unread && !b.unread) return -1;
            if (!a.unread && b.unread) return  1;
            const ta = a.lastMsg?.created_at || '';
            const tb = b.lastMsg?.created_at || '';
            return tb.localeCompare(ta);
        });
    },

    _renderContactList(filter) {
        const listEl = document.getElementById('chat-contacts-list');
        if (!listEl) return;

        const q = (filter !== undefined ? filter : (document.getElementById('chat-search-input')?.value || '')).toLowerCase();
        const filtered = q
            ? this._contacts.filter(c => c.nome.toLowerCase().includes(q))
            : this._contacts;

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="chat-no-contacts">Nenhum contato encontrado.</p>';
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const isActive = this._activeContact?.id === c.id;
            const preview  = this._previewText(c);
            const timeStr  = this._timeStr(c.lastMsg?.created_at);
            const initial  = (c.nome || '?').charAt(0).toUpperCase();
            return `
                <div class="chat-contact-item${isActive ? ' active' : ''}${c.unread ? ' unread' : ''}"
                     data-contact-id="${c.id}"
                     onclick="Modules.Chat._openConv('${c.id}')">
                    <div class="chat-contact-avatar">${initial}</div>
                    <div class="chat-contact-info">
                        <div class="chat-contact-name">${escapeHtml(c.nome)}</div>
                        <div class="chat-contact-preview">${preview}</div>
                    </div>
                    <div class="chat-contact-meta">
                        <span class="chat-contact-time">${timeStr}</span>
                        ${c.unread ? `<span class="chat-contact-badge">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    _previewText(c) {
        if (!c.lastMsg) return '<em class="chat-no-msg">Sem mensagens</em>';
        const prefix = c.lastMsg.remetente_id === this._uid ? 'Você: ' : '';
        if (!c.lastMsg.conteudo && c.lastMsg.anexo_url) {
            const ehImagem = (c.lastMsg.anexo_tipo || '').startsWith('image/');
            const rotulo   = ehImagem ? '📷 Foto' : `📎 ${c.lastMsg.anexo_nome || 'Arquivo'}`;
            return `<span>${escapeHtml(prefix)}${escapeHtml(rotulo)}</span>`;
        }
        const text   = escapeHtml((c.lastMsg.conteudo || '').substring(0, 42));
        const sufx   = (c.lastMsg.conteudo || '').length > 42 ? '…' : '';
        return `<span>${escapeHtml(prefix)}${text}${sufx}</span>`;
    },

    _timeStr(iso) {
        if (!iso) return '';
        const d   = new Date(iso);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    },

    _filterContacts(val) {
        this._renderContactList(val);
    },

    // ══════════════════════════════════════════════════════════
    // CONVERSA
    // ══════════════════════════════════════════════════════════
    async _openConv(contactId) {
        if (!this._onPage) return;

        const contact = this._contacts.find(c => c.id === contactId);
        if (!contact) return;

        this._activeContact = contact;
        this._clearPendingFile();

        // Marca item ativo na lista
        document.querySelectorAll('.chat-contact-item').forEach(el => {
            el.classList.toggle('active', el.dataset.contactId === contactId);
        });

        const mainEl = document.getElementById('chat-page-main');
        if (!mainEl) return;

        const initial = (contact.nome || '?').charAt(0).toUpperCase();
        // Mobile: mostra painel de conversa (desliza para dentro)
        const chatPage = document.querySelector('.chat-page');
        if (chatPage) chatPage.classList.add('chat-conv-open');

        mainEl.innerHTML = `
            <div class="chat-window">
                <div class="chat-window-header">
                    <button class="chat-back-btn" onclick="Modules.Chat._backToContacts()" title="Voltar">&#8592;</button>
                    <div class="chat-contact-avatar">${initial}</div>
                    <div class="chat-window-title">${escapeHtml(contact.nome)}</div>
                </div>
                <div class="chat-window-messages" id="chat-direct-messages">
                    <div class="loader-inline" style="padding:32px"></div>
                </div>
                <div class="chat-file-preview" id="chat-file-preview" style="display:none"></div>
                <div class="chat-window-footer">
                    <input type="file" id="chat-file-input" style="display:none"
                        onchange="Modules.Chat._onFileSelect(event)">
                    <button class="chat-attach-btn" title="Enviar arquivo" onclick="Modules.Chat._abrirSeletorArquivo()">📎</button>
                    <textarea class="chat-input" id="chat-direct-input"
                        placeholder="Digite uma mensagem… (Enter para enviar)"
                        rows="1"
                        onkeydown="Modules.Chat._handleKey(event)"></textarea>
                    <button class="btn btn-primary chat-send-btn" onclick="Modules.Chat.send()">Enviar</button>
                </div>
            </div>
        `;

        await this._loadMessages(contactId);

        // Marca como lido + zera unread do contato
        await this._markRead(contactId);
        contact.unread = 0;
        this._renderContactList();
        this._refreshBadge();

        document.getElementById('chat-direct-input')?.focus();
    },

    async _loadMessages(contactId) {
        const uid       = this._uid;
        const container = document.getElementById('chat-direct-messages');
        if (!container) return;

        const { data: msgs, error } = await supabase
            .from('mensagens_diretas')
            .select('id, remetente_id, destinatario_id, conteudo, created_at, lida, anexo_url, anexo_nome, anexo_tipo')
            .or(`and(remetente_id.eq.${uid},destinatario_id.eq.${contactId}),and(remetente_id.eq.${contactId},destinatario_id.eq.${uid})`)
            .order('created_at', { ascending: true });

        if (error) {
            container.innerHTML = `<p style="color:var(--color-red);padding:24px;text-align:center">Erro ao carregar mensagens</p>`;
            return;
        }

        container.innerHTML = '';

        if (!msgs || msgs.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💬</div>
                    <p>Nenhuma mensagem ainda.</p>
                    <p>Diga olá!</p>
                </div>`;
            return;
        }

        let lastDate = null;
        msgs.forEach(m => {
            const d = new Date(m.created_at).toLocaleDateString('pt-BR');
            if (d !== lastDate) { this._appendDateSep(container, d); lastDate = d; }
            this._appendBubble(container, m, false);
        });

        this._scrollBottom();
    },

    _appendBubble(container, msg, animate) {
        const uid    = this._uid;
        const isMine = msg.remetente_id === uid;
        const hora   = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (document.querySelector(`[data-chat-id="${msg.id}"]`)) return;

        const ehImagem = (msg.anexo_tipo || '').startsWith('image/');
        const anexoHtml = !msg.anexo_url ? '' : ehImagem ? `
            <div class="chat-attachment">
                <img src="${msg.anexo_url}" class="chat-attach-img"
                     alt="${escapeHtml(msg.anexo_nome || 'imagem')}"
                     onclick="window.open('${msg.anexo_url}','_blank')" loading="lazy">
            </div>` : `
            <a href="${msg.anexo_url}" target="_blank" rel="noopener" class="chat-attachment-file" download="${escapeHtml(msg.anexo_nome || '')}">
                <span class="chat-attach-ext">${escapeHtml(this._fileExt(msg.anexo_nome))}</span>
                <span class="chat-attach-fname">${escapeHtml(msg.anexo_nome || 'arquivo')}</span>
                <span class="chat-attach-dl">⬇</span>
            </a>`;

        const div = document.createElement('div');
        div.className      = 'chat-msg ' + (isMine ? 'chat-msg-mine' : 'chat-msg-other') + (animate ? ' chat-msg-new' : '');
        div.dataset.chatId = msg.id;
        div.innerHTML = `
            <div class="chat-bubble${msg.anexo_url && msg.conteudo ? ' chat-bubble-mixed' : ''}">
                ${anexoHtml}
                ${msg.conteudo ? `<div class="chat-bubble-text">${escapeHtml(msg.conteudo)}</div>` : ''}
            </div>
            <div class="chat-msg-time">${hora}</div>
        `;
        container.appendChild(div);
        if (animate) this._scrollBottom();
    },

    _appendDateSep(container, dateStr) {
        const div = document.createElement('div');
        div.className    = 'chat-date-sep';
        div.dataset.date = dateStr;
        div.textContent  = dateStr;
        container.appendChild(div);
    },

    _scrollBottom() {
        const c = document.getElementById('chat-direct-messages');
        if (c) c.scrollTop = c.scrollHeight;
    },

    async _markRead(contactId) {
        await supabase
            .from('mensagens_diretas')
            .update({ lida: true })
            .eq('remetente_id', contactId)
            .eq('destinatario_id', this._uid)
            .eq('lida', false);
    },

    // ══════════════════════════════════════════════════════════
    // ANEXO — envio de foto
    // ══════════════════════════════════════════════════════════
    _abrirSeletorArquivo() {
        document.getElementById('chat-file-input')?.click();
    },

    async _onFileSelect(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo: 10 MB', 'error');
            return;
        }

        this._pendingFileName = file.name;
        this._pendingFileTipo = file.type;
        this._pendingFileUrl  = null;
        this._uploading       = true;
        this._updateSendBtn();
        this._showFilePreview(file);

        const url = await this._uploadFile(file);
        this._uploading = false;

        if (url) {
            this._pendingFileUrl = url;
        } else {
            showToast('Falha ao enviar a imagem. Tente novamente.', 'error');
            this._clearPendingFile();
        }
        this._updateSendBtn();
    },

    async _uploadFile(file) {
        const ext  = file.name.includes('.') ? file.name.split('.').pop() : '';
        const path = `${this._uid}/${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;

        const { error } = await supabase.storage
            .from('chat-anexos')
            .upload(path, file, { contentType: file.type, upsert: false });

        if (error) { console.error('Upload error:', error); return null; }

        const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path);
        return urlData?.publicUrl || null;
    },

    _fileExt(name) {
        return name && name.includes('.') ? name.split('.').pop().toUpperCase().slice(0, 4) : '';
    },

    _showFilePreview(file) {
        const preview = document.getElementById('chat-file-preview');
        if (!preview) return;
        preview.style.display = 'flex';

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => {
                preview.innerHTML = `
                    <div class="chat-preview-item">
                        <img src="${ev.target.result}" class="chat-preview-img" alt="">
                        <span class="chat-preview-name">${escapeHtml(file.name)}</span>
                        <span class="chat-preview-badge">${this._uploading ? 'Enviando…' : 'Pronto'}</span>
                        <button class="chat-preview-remove" onclick="Modules.Chat._clearPendingFile()">×</button>
                    </div>`;
            };
            reader.readAsDataURL(file);
            return;
        }

        preview.innerHTML = `
            <div class="chat-preview-item">
                <span class="chat-preview-ext">${escapeHtml(this._fileExt(file.name))}</span>
                <span class="chat-preview-name">${escapeHtml(file.name)}</span>
                <span class="chat-preview-badge">${this._uploading ? 'Enviando…' : 'Pronto'}</span>
                <button class="chat-preview-remove" onclick="Modules.Chat._clearPendingFile()">×</button>
            </div>`;
    },

    _clearPendingFile() {
        this._pendingFileUrl  = null;
        this._pendingFileName = null;
        this._pendingFileTipo = null;
        this._uploading       = false;
        const preview = document.getElementById('chat-file-preview');
        if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
        this._updateSendBtn();
    },

    _updateSendBtn() {
        const btn = document.querySelector('.chat-send-btn');
        if (btn) {
            btn.disabled    = this._uploading;
            btn.textContent = this._uploading ? 'Enviando…' : 'Enviar';
        }
        const badge = document.querySelector('#chat-file-preview .chat-preview-badge');
        if (badge) badge.textContent = this._uploading ? 'Enviando…' : 'Pronto';
    },

    // ══════════════════════════════════════════════════════════
    // ENVIO
    // ══════════════════════════════════════════════════════════
    async send() {
        const input    = document.getElementById('chat-direct-input');
        const conteudo = input?.value?.trim() || '';
        const temAnexo = !!this._pendingFileUrl;
        if ((!conteudo && !temAnexo) || this._uploading || !this._activeContact) return;

        const sendBtn = document.querySelector('.chat-send-btn');
        if (sendBtn) sendBtn.disabled = true;
        input.value        = '';
        input.style.height = '';

        const payload = {
            remetente_id:    this._uid,
            destinatario_id: this._activeContact.id,
            conteudo:        conteudo || null,
        };
        if (temAnexo) {
            payload.anexo_url  = this._pendingFileUrl;
            payload.anexo_nome = this._pendingFileName;
            payload.anexo_tipo = this._pendingFileTipo;
        }
        this._clearPendingFile();

        const { data: inserted, error } = await supabase
            .from('mensagens_diretas')
            .insert(payload)
            .select('id, remetente_id, destinatario_id, conteudo, created_at, lida, anexo_url, anexo_nome, anexo_tipo')
            .single();

        if (error) {
            showToast('Erro ao enviar mensagem', 'error');
            input.value = conteudo;
        } else {
            const container = document.getElementById('chat-direct-messages');
            if (container) {
                container.querySelector('.chat-empty')?.remove();
                const d = new Date(inserted.created_at).toLocaleDateString('pt-BR');
                const lastSep = container.querySelector('.chat-date-sep:last-of-type');
                if (d !== lastSep?.dataset.date) this._appendDateSep(container, d);
                this._appendBubble(container, inserted, true);
            }
            // Atualiza preview do contato
            const c = this._contacts.find(x => x.id === this._activeContact.id);
            if (c) { c.lastMsg = inserted; this._sortContacts(); this._renderContactList(); }
        }

        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    },

    _handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            Modules.Chat.send();
        }
        const ta = e.target;
        ta.style.height = '';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    },

    // Mobile: volta para lista de contatos
    _backToContacts() {
        const chatPage = document.querySelector('.chat-page');
        if (chatPage) chatPage.classList.remove('chat-conv-open');
        this._activeContact = null;
        this._renderContactList();
    },

    // Chamado pelo Router ao sair da página (não tem hook, mas zeramos o flag)
    _leave() {
        this._onPage        = false;
        this._activeContact = null;
    },
};
