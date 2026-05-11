// ============================================================
// MÓDULO: CHAT — mensagens em tempo real por aula
// ============================================================

Modules.Chat = {
    _channel:   null,
    _agendaId:  null,
    _outroNome: null,
    _outroId:   null,
    _injected:  false,

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

        const uid   = AppState.userProfile.id;
        const isMe  = aula.professor_id === uid;
        this._outroNome = isMe ? aula.aluno_nome    : aula.professor_nome;
        this._outroId   = isMe ? aula.aluno_id      : aula.professor_id;

        // Cabeçalho do modal
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
            .select('id, remetente_id, conteudo, created_at, lida')
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
                // Evita duplicata da mensagem enviada pelo próprio usuário
                if (document.querySelector('[data-chat-id="' + payload.new.id + '"]')) return;

                // Separador de data se necessário
                const container  = document.getElementById('chat-messages');
                const msgDate    = new Date(payload.new.created_at).toLocaleDateString('pt-BR');
                const lastSep    = container.querySelector('.chat-date-sep:last-of-type');
                const lastSepTxt = lastSep?.dataset.date;
                if (msgDate !== lastSepTxt) this._appendDateSeparator(msgDate);

                this._appendBubble(payload.new, true);

                const uid = AppState.userProfile.id;
                if (payload.new.remetente_id !== uid) {
                    supabase.from('mensagens').update({ lida: true }).eq('id', payload.new.id);
                }
            })
            .subscribe();
    },

    // ── Renderiza bolha de mensagem ───────────────────────────
    _appendBubble(msg, animate) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const empty = container.querySelector('.chat-empty');
        if (empty) empty.remove();

        const uid    = AppState.userProfile.id;
        const isMine = msg.remetente_id === uid;
        const hora   = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className  = 'chat-msg ' + (isMine ? 'chat-msg-mine' : 'chat-msg-other') + (animate ? ' chat-msg-new' : '');
        div.dataset.chatId = msg.id;
        div.innerHTML  = `
            ${!isMine ? `<div class="chat-msg-name">${escapeHtml(this._outroNome || '')}</div>` : ''}
            <div class="chat-bubble">${escapeHtml(msg.conteudo)}</div>
            <div class="chat-msg-time">${hora}</div>
        `;

        container.appendChild(div);
        if (animate) this._scrollBottom();
    },

    _appendDateSeparator(dateStr) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className     = 'chat-date-sep';
        div.dataset.date  = dateStr;
        div.textContent   = dateStr;
        container.appendChild(div);
    },

    _scrollBottom() {
        const c = document.getElementById('chat-messages');
        if (c) c.scrollTop = c.scrollHeight;
    },

    async _marcarLidas(msgs) {
        const uid     = AppState.userProfile.id;
        const ids     = (msgs || []).filter(m => m.remetente_id !== uid && !m.lida).map(m => m.id);
        if (ids.length > 0) {
            await supabase.from('mensagens').update({ lida: true }).in('id', ids);
        }
    },

    // ── Envio de mensagem ─────────────────────────────────────
    async send() {
        const input   = document.getElementById('chat-input');
        const conteudo = input?.value?.trim();
        if (!conteudo || !this._agendaId) return;

        const btn = document.getElementById('btn-chat-send');
        if (btn) btn.disabled = true;
        input.value = '';
        input.style.height = '';

        const uid = AppState.userProfile.id;

        const { data: inserted, error } = await supabase
            .from('mensagens')
            .insert({ agenda_id: this._agendaId, remetente_id: uid, conteudo })
            .select('id, remetente_id, conteudo, created_at, lida')
            .single();

        if (error) {
            showToast('Erro ao enviar mensagem', 'error');
            input.value = conteudo;
        } else {
            // Append imediato (otimista) sem esperar o realtime
            this._appendBubble(inserted, true);
        }

        if (btn) btn.disabled = false;
        input.focus();
    },

    handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            Modules.Chat.send();
        }
        // Auto-resize textarea
        const ta = e.target;
        ta.style.height = '';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    },

    close() {
        if (this._channel) {
            supabase.removeChannel(this._channel);
            this._channel  = null;
        }
        this._agendaId  = null;
        this._outroNome = null;
        this._outroId   = null;
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
                        <textarea
                            id="chat-input"
                            class="chat-input"
                            placeholder="Digite uma mensagem… (Enter para enviar)"
                            rows="1"
                            onkeydown="Modules.Chat.handleKey(event)"
                        ></textarea>
                        <button class="btn btn-primary chat-send-btn" id="btn-chat-send" onclick="Modules.Chat.send()">
                            Enviar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(div.firstElementChild);
    }
};
