// ============================================================
// ENSINOCLICK — UTILITÁRIOS GLOBAIS
// ============================================================

// Estado global da sessão
window.AppState = {
    user: null,
    userProfile: null,
    role: null,
    currentModule: null
};

// ============================================================
// FORMATADORES
// ============================================================
const fmt = {
    date: (d) => {
        if (!d) return '—';
        return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
    },
    datetime: (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleString('pt-BR');
    },
    currency: (v) => {
        if (v == null) return '—';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    },
    time: (t) => {
        if (!t) return '—';
        return t.substring(0, 5);
    },
    role: (r) => ROLE_LABELS[r] || r,
    status_aula: (s) => STATUS_AULA[s] || { label: s, class: 'badge-secondary' },
    status_fin: (s) => STATUS_FINANCEIRO[s] || { label: s, class: 'badge-secondary' }
};

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = APP_CONFIG.toastDuration) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ============================================================
// MODAL GENÉRICO
// ============================================================
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.remove('modal-open');
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-open').forEach(m => {
        m.classList.remove('modal-open');
    });
    document.body.style.overflow = '';
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeAllModals();
    }
});

// ============================================================
// CONFIRMAÇÃO
// ============================================================
function confirmAction(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay modal-open';
        overlay.innerHTML = `
            <div class="modal-box modal-sm">
                <div class="modal-header">
                    <h3>Confirmar Ação</h3>
                </div>
                <div class="modal-body">
                    <p>${escapeHtml(message)}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" id="conf-cancel">Cancelar</button>
                    <button class="btn btn-danger" id="conf-ok">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        overlay.querySelector('#conf-cancel').onclick = () => {
            overlay.remove();
            document.body.style.overflow = '';
            resolve(false);
        };
        overlay.querySelector('#conf-ok').onclick = () => {
            overlay.remove();
            document.body.style.overflow = '';
            resolve(true);
        };
    });
}

// ============================================================
// SEGURANÇA
// ============================================================
function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// LOADING SPINNER
// ============================================================
function setLoading(selector, state) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    if (state) {
        el.setAttribute('data-loading', 'true');
        el.disabled = true;
    } else {
        el.removeAttribute('data-loading');
        el.disabled = false;
    }
}

function showPageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.style.display = 'flex';
}

function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.style.display = 'none';
}

// ============================================================
// RENDERIZAR CONTEÚDO PRINCIPAL
// ============================================================
function renderContent(html) {
    const main = document.getElementById('main-content');
    if (main) main.innerHTML = html;
}

// ============================================================
// AUDIT LOG MANUAL (JS → Supabase direto)
// ============================================================
async function auditLog(acao, tabela, registroId, dadosNovos = null) {
    try {
        await supabase.from('audit_log').insert({
            acao,
            usuario_id: AppState.userProfile?.id,
            tabela,
            registro_id: registroId,
            dados_novos: dadosNovos
        });
    } catch (_) {
        // audit não deve quebrar o fluxo principal
    }
}

// ============================================================
// DEBOUNCE
// ============================================================
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ============================================================
// BADGE HTML
// ============================================================
function badge(text, cls) {
    return `<span class="badge ${escapeHtml(cls)}">${escapeHtml(text)}</span>`;
}

// ============================================================
// EMPTY STATE
// ============================================================
function emptyState(message = 'Nenhum registro encontrado') {
    return `
        <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// ============================================================
// PAGINAÇÃO
// ============================================================
function paginationHtml(page, totalPages, onChangeFn) {
    if (totalPages <= 1) return '';
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        pages.push(`<button class="page-btn ${i === page ? 'active' : ''}" onclick="${onChangeFn}(${i})">${i}</button>`);
    }
    return `<div class="pagination">${pages.join('')}</div>`;
}

// ============================================================
// DATA ATUAL (ISO)
// ============================================================
function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// VALIDAÇÕES
// ============================================================
const validate = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    required: (v) => v != null && String(v).trim() !== '',
    minLen: (v, n) => String(v).length >= n,
    phone: (v) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v)
};

function validateForm(fields) {
    const errors = [];
    fields.forEach(({ value, label, rules }) => {
        rules.forEach(rule => {
            if (rule === 'required' && !validate.required(value)) {
                errors.push(`${label} é obrigatório`);
            }
            if (rule === 'email' && value && !validate.email(value)) {
                errors.push(`${label} deve ser um email válido`);
            }
        });
    });
    return errors;
}

// ============================================================
// UPLOAD SUPABASE STORAGE
// ============================================================
async function uploadFile(bucket, path, file) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
}
