// ============================================================
// MÓDULO: CHAT — mensagens em tempo real por aula (com anexos)
// ============================================================

Modules.Chat = {
    _channel:         null,
    _agendaId:        null,
    _outroNome:       null,
    _outroId:         null,
    _injected:        false,
    _pendingFileUrl:  null,
    _pendingFileName: null,
    _pendingFileTipo: null,
    _uploading:       false,

    // ── Ponto de entrada ──────────────────────────────────────
    async open(agendaId) {
        this._injectModal();

        const { data: aula, error } = await supabase
            .from('v_agenda_completa')
            .select('*')
            .eq('id', agendaId)
            .single();

        if (error || !aula) return showToast('Erro ao carregar aula para o chat', 'error');

        this._agendaId = agendaId;
        this._clearPendingFile();

        const uid  = AppState.userProfile.id;
        const isMe = aula.professor_id === uid;
        this._outroNome = isMe ? aula.aluno_nome    : aula.professor_nome;
        this._outroId   = isMe ? aula.aluno_id      : aula.professor_id;

        document.getElementById('chat-modal-title').textContent =
            'Chat com ' + (this._outroNome || '—');

        const dataFmt = new Date(aula.data + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
        document.getElementById('chat-modal-subtitle').textContent =
            (aula.disciplina || 'Aula') + ' · ' + dataFmt + ' às ' + fmt.time(aula.horario);

        document.getElementById('chat-messages').innerHTML =
            '<div class="chat-loading"><div class="chat-loading-dots"><span></span><span></span><span></span></div></div>';
        document.getElementById('chat-input').value = '';

        openModal('modal-chat');

        await this._loadMensagens();
        this._subscribeRealtime();
        document.getElementById('chat-input').focus();
    },

    // ── Carrega histórico ─────────────────────────────────────
    async _loadMensagens() {
        const container = document.getElementById('chat-messages');

        const { data: msgs, error } = await supabase
            .from('mensagens')
            .select('id, remetente_id, conteudo, created_at, lida, anexo_url, anexo_nome, anexo_tipo')
            .eq('agenda_id', this._agendaId)
            .order('created_at', { ascending: true });

        if (error) {
            container.innerHTML = `<p style="color:var(--color-red);padding:20px;text-align:center;">Erro: ${escapeHtml(error.message)}</p>`;
            return;
        }

        container.innerHTML = '';

        if (!msgs || msgs.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💬</div>
                    <p>Nenhuma mensagem ainda.</p>
                    <p>Inicie a conversa!</p>
                </div>`;
            return;
        }

        let lastDate = null;
        msgs.forEach(m => {
            const msgDate = new Date(m.created_at).toLocaleDateString('pt-BR');
            if (msgDate !== lastDate) {
                this._appendDateSeparator(msgDate);
                lastDate = msgDate;
            }
            this._appendBubble(m, false);
        });

        this._scrollBottom();
        this._marcarLidas(msgs);
    },

    // ── Realtime subscription ─────────────────────────────────
    _subscribeRealtime() {
        if (this._channel) supabase.removeChannel(this._channel);

        this._channel = supabase
            .channel('chat-' + this._agendaId)
            .on('postgres_changes', {
                event:  'INSERT',
                schema: 'public',
                table:  'mensagens',
                filter: 'agenda_id=eq.' + this._agendaId
            }, (payload) => {
                if (document.querySelector('[data-chat-id="' + payload.new.id + '"]')) return;

                const container  = document.getElementById('chat-messages');
                const msgDate    = new Date(payload.new.created_at).toLocaleDateString('pt-BR');
                const lastSep    = container.querySelector('.chat-date-sep:last-of-type');
                if (msgDate !== lastSep?.dataset.date) this._appendDateSeparator(msgDate);

                this._appendBubble(payload.new, true);

                const uid = AppState.userProfile.id;
                if (payload.new.remetente_id !== uid) {
                    supabase.from('mensagens').update({ lida: true }).eq('id', payload.new.id);
                }
            })
            .subscribe();
    },

    // ── Renderiza bolha ───────────────────────────────────────
    _appendBubble(msg, animate) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        container.querySelector('.chat-empty')?.remove();

        const uid    = AppState.userProfile.id;
        const isMine = msg.remetente_id === uid;
        const hora   = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const isImg  = msg.anexo_tipo?.startsWith('image/');

        let anexoHtml = '';
        if (msg.anexo_url) {
            if (isImg) {
                anexoHtml = `
                    <div class="chat-attachment">
                        <img src="${msg.anexo_url}"
                             class="chat-attach-img"
                             alt="${escapeHtml(msg.anexo_nome || 'imagem')}"
                             onclick="window.open('${msg.anexo_url}','_blank')"
                             loading="lazy">
                    </div>`;
            } else {
                const ext = (msg.anexo_nome || '').split('.').pop().toUpperCase() || 'ARQUIVO';
                anexoHtml = `
                    <a href="${msg.anexo_url}" target="_blank" download="${escapeHtml(msg.anexo_nome || 'arquivo')}"
                       class="chat-attachment chat-attachment-file">
                        <span class="chat-attach-ext">${escapeHtml(ext)}</span>
                        <span class="chat-attach-fname">${escapeHtml(msg.anexo_nome || 'arquivo')}</span>
                        <span class="chat-attach-dl">⬇</span>
                    </a>`;
            }
        }

        // Mostra texto somente se houver e não for idêntico ao nome do arquivo (fallback)
        const textoVisivel = msg.conteudo && msg.conteudo !== msg.anexo_nome;

        const div = document.createElement('div');
        div.className    = 'chat-msg ' + (isMine ? 'chat-msg-mine' : 'chat-msg-other') + (animate ? ' chat-msg-new' : '');
        div.dataset.chatId = msg.id;
        div.innerHTML = `
            ${!isMine ? `<div class="chat-msg-name">${escapeHtml(this._outroNome || '')}</div>` : ''}
            <div class="chat-bubble ${!msg.conteudo || !msg.anexo_url ? '' : 'chat-bubble-mixed'}">
                ${anexoHtml}
                ${textoVisivel ? `<div class="chat-bubble-text">${escapeHtml(msg.conteudo)}</div>` : ''}
            </div>
            <div class="chat-msg-time">${hora}</div>
        `;

        container.appendChild(div);
        if (animate) this._scrollBottom();
    },

    _appendDateSeparator(dateStr) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className    = 'chat-date-sep';
        div.dataset.date = dateStr;
        div.textContent  = dateStr;
        container.appendChild(div);
    },

    _scrollBottom() {
        const c = document.getElementById('chat-messages');
        if (c) c.scrollTop = c.scrollHeight;
    },

    async _marcarLidas(msgs) {
        const uid = AppState.userProfile.id;
        const ids = (msgs || []).filter(m => m.remetente_id !== uid && !m.lida).map(m => m.id);
        if (ids.length > 0) {
            await supabase.from('mensagens').update({ lida: true }).in('id', ids);
        }
    },

    // ── Anexo: selecionar arquivo ─────────────────────────────
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
            showToast('Falha ao enviar o arquivo. Tente novamente.', 'error');
            this._clearPendingFile();
        }
        this._updateSendBtn();
    },

    async _uploadFile(file) {
        const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
        const path = `${this._agendaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error } = await supabase.storage
            .from('chat-anexos')
            .upload(path, file, { contentType: file.type, upsert: false });

        if (error) { console.error('Upload error:', error); return null; }

        const { data: urlData } = supabase.storage
            .from('chat-anexos')
            .getPublicUrl(path);

        return urlData?.publicUrl || null;
    },

    _showFilePreview(file) {
        const preview = document.getElementById('chat-file-preview');
        if (!preview) return;

        const isImg = file.type.startsWith('image/');
        preview.style.display = 'flex';

        if (isImg) {
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
        } else {
            const ext = file.name.split('.').pop().toUpperCase() || 'ARQ';
            preview.innerHTML = `
                <div class="chat-preview-item">
                    <span class="chat-preview-ext">${escapeHtml(ext)}</span>
                    <span class="chat-preview-name">${escapeHtml(file.name)}</span>
                    <span class="chat-preview-badge">${this._uploading ? 'Enviando…' : 'Pronto'}</span>
                    <button class="chat-preview-remove" onclick="Modules.Chat._clearPendingFile()">×</button>
                </div>`;
        }
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
        const btn = document.getElementById('btn-chat-send');
        if (!btn) return;
        btn.disabled    = this._uploading;
        btn.textContent = this._uploading ? 'Enviando…' : 'Enviar';
    },

    // ── Envio ─────────────────────────────────────────────────
    async send() {
        const input    = document.getElementById('chat-input');
        const conteudo = input?.value?.trim() || '';
        const temAnexo = !!this._pendingFileUrl;

        if ((!conteudo && !temAnexo) || this._uploading || !this._agendaId) return;

        const btn = document.getElementById('btn-chat-send');
        if (btn) btn.disabled = true;
        input.value = '';
        input.style.height = '';

        const uid     = AppState.userProfile.id;
        const payload = {
            agenda_id:    this._agendaId,
            remetente_id: uid,
            conteudo:     conteudo || this._pendingFileName || 'arquivo',
        };

        if (temAnexo) {
            payload.anexo_url  = this._pendingFileUrl;
            payload.anexo_nome = this._pendingFileName;
            payload.anexo_tipo = this._pendingFileTipo;
        }

        this._clearPendingFile();

        const { data: inserted, error } = await supabase
            .from('mensagens')
            .insert(payload)
            .select('id, remetente_id, conteudo, created_at, lida, anexo_url, anexo_nome, anexo_tipo')
            .single();

        if (error) {
            showToast('Erro ao enviar mensagem', 'error');
            input.value = conteudo;
        } else {
            this._appendBubble(inserted, true);
        }

        if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
        input.focus();
    },

    handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            Modules.Chat.send();
        }
        const ta = e.target;
        ta.style.height = '';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    },

    close() {
        if (this._channel) {
            supabase.removeChannel(this._channel);
            this._channel = null;
        }
        this._agendaId  = null;
        this._outroNome = null;
        this._outroId   = null;
        this._clearPendingFile();
        closeModal('modal-chat');
    },

    // ── Injeta HTML do modal uma única vez no body ────────────
    _injectModal() {
        if (this._injected) return;
        this._injected = true;

        const div = document.createElement('div');
        div.innerHTML = `
            <div class="modal-overlay" id="modal-chat">
                <div class="modal-box modal-chat-box">
                    <div class="chat-header">
                        <div class="chat-header-info">
                            <div class="chat-avatar">💬</div>
                            <div>
                                <div class="chat-header-title" id="chat-modal-title">Chat</div>
                                <div class="chat-header-sub"   id="chat-modal-subtitle"></div>
                            </div>
                        </div>
                        <button class="modal-close" onclick="Modules.Chat.close()">×</button>
                    </div>

                    <div class="chat-messages" id="chat-messages"></div>

                    <div class="chat-footer">
                        <input type="file" id="chat-file-input" style="display:none"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                            onchange="Modules.Chat._onFileSelect(event)">

                        <div class="chat-file-preview" id="chat-file-preview" style="display:none"></div>

                        <div class="chat-input-row">
                            <button class="chat-attach-btn" title="Anexar arquivo"
                                onclick="Modules.Chat._abrirSeletorArquivo()">📎</button>
                            <textarea
                                id="chat-input"
                                class="chat-input"
                                placeholder="Digite uma mensagem… (Enter para enviar)"
                                rows="1"
                                onkeydown="Modules.Chat.handleKey(event)"
                            ></textarea>
                            <button class="btn btn-primary chat-send-btn" id="btn-chat-send"
                                onclick="Modules.Chat.send()">Enviar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(div.firstElementChild);
    }
};
