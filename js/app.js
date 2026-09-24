// ============================================================
// ENSINOCLICK — ROTEADOR E INICIALIZAÇÃO PRINCIPAL
// ============================================================

const Router = {
    routes: {},
    currentRoute: null,

    register(name, fn) {
        Router.routes[name] = fn;
    },

    async navigate(name, params = {}) {
        if (!Router.routes[name]) {
            console.error('Rota não encontrada:', name);
            return;
        }
        showPageLoader();
        try {
            Router.currentRoute = name;
            setActiveSidebarItem(name);
            await Router.routes[name](params);
        } catch (err) {
            console.error('Erro na rota:', err);
            showToast('Erro ao carregar módulo: ' + err.message, 'error');
        } finally {
            hidePageLoader();
        }
    }
};

// ============================================================
// SIDEBAR — ITENS POR ROLE
// ============================================================
const SIDEBAR_ITEMS = {
    admin: [
        { id: 'dashboard',       icon: '⊞', label: 'Dashboard' },
        { id: 'usuarios',        icon: '👤', label: 'Usuários' },
        { id: 'alunos',          icon: '🎓', label: 'Alunos' },
        { id: 'professores',     icon: '🏫', label: 'Professores' },
        { id: 'agenda',          icon: '📅', label: 'Agenda' },
        { id: 'cronograma',      icon: '📋', label: 'Cronograma' },
        { id: 'disponibilidade', icon: '🕐', label: 'Disponibilidade' },
        { id: 'financeiro',      icon: '💰', label: 'Financeiro' },
        { id: 'relatorios',      icon: '📄', label: 'Relatórios' },
        { id: 'insights',        icon: '📊', label: 'Insights' },
        { id: 'psicopedagogia',  icon: '🧠', label: 'Psicopedagogia' },
        { id: 'auditoria',       icon: '🔍', label: 'Auditoria' },
    ],
    professor: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'agenda',         icon: '📅', label: 'Minha Agenda' },
        { id: 'professores',    icon: '🏫', label: 'Total de Aulas' },
        { id: 'relatorios',     icon: '📄', label: 'Lançar Aula' },
        { id: 'atividades',     icon: '📝', label: 'Enviar Atividade' },
        { id: 'disponibilidade',icon: '🕐', label: 'Minha Disponibilidade' },
        { id: 'chat',           icon: '💬', label: 'Chat', badge: true },
    ],
    aluno: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'agenda',         icon: '📅', label: 'Minhas Aulas' },
        { id: 'cronograma',     icon: '📋', label: 'Cronograma' },
        { id: 'atividades',     icon: '📝', label: 'Atividades' },
        { id: 'chat',           icon: '💬', label: 'Chat', badge: true },
    ],
    psicopedagoga: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'alunos',         icon: '🎓', label: 'Alunos' },
        { id: 'agenda',         icon: '📅', label: 'Agenda' },
        { id: 'relatorios',     icon: '📄', label: 'Relatórios' },
        { id: 'psicopedagogia', icon: '🧠', label: 'Iniciar Consulta' },
    ],
    mentor: [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
        { id: 'agenda',    icon: '📅', label: 'Agenda' },
    ]
};

// ============================================================
// RENDERIZAR SIDEBAR
// ============================================================
function renderSidebar() {
    const role = AppState.role;
    const items = SIDEBAR_ITEMS[role] || [];
    const profile = AppState.userProfile;

    // Classe no <body> pra escopar CSS por perfil (ex: barra flutuante e
    // topo simplificado só aparecem pro aluno, via `body.role-aluno`).
    document.body.classList.add('role-' + role);

    const avatarBtn = document.getElementById('topbar-avatar-btn');
    const avatarLetter = document.getElementById('topbar-avatar-letter');
    if (avatarLetter) avatarLetter.textContent = profile?.nome?.charAt(0).toUpperCase() || 'U';
    if (avatarBtn) avatarBtn.title = profile?.nome || '';

    if (role === 'aluno')     renderAlunoTabbar(items);
    if (role === 'professor') renderProfTabbar(items);

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Aluno: menu com entrada animada e hover "vivo". Professor: só o
    // indicador deslizante (ajuda a se orientar), sem animação de entrada
    // nem efeito de mola — quem abre o sistema várias vezes por dia não
    // precisa ver o menu "se montar" a cada carregamento.
    const isAluno = role === 'aluno';
    const isProf  = role === 'professor';
    const navMod    = isAluno ? ' sidebar-nav--aluno'    : isProf ? ' sidebar-nav--prof'    : '';
    const footerMod = isAluno ? ' sidebar-footer--aluno' : isProf ? ' sidebar-footer--prof' : '';

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <img src="img/isotipo.png" alt="Click do Saber" class="logo-img" />
            <span class="logo-text">Click do Saber</span>
        </div>
        <nav class="sidebar-nav${navMod}">
            ${(isAluno || isProf) ? '<div class="sidebar-nav-indicator" id="sidebar-nav-indicator"></div>' : ''}
            ${items.map((item, i) => `
                <button class="nav-item" id="nav-${item.id}" style="--i:${i}" onclick="Router.navigate('${item.id}')">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                    ${item.badge ? '<span class="nav-badge chat-nav-badge" style="display:none">0</span>' : ''}
                </button>
            `).join('')}
        </nav>
        <div class="sidebar-footer${footerMod}">
            <div class="user-avatar">${profile?.nome?.charAt(0).toUpperCase() || 'U'}</div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(profile?.nome || '')}</div>
                <div class="user-role">${fmt.role(role)}</div>
            </div>
            <button class="btn-logout" onclick="Auth.logout()" title="Sair">⏻</button>
        </div>
    `;
}

function setActiveSidebarItem(id) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const active = document.getElementById('nav-' + id);
    if (active) active.classList.add('active');

    // Indicador deslizante (só existe na sidebar do aluno) — em vez de só
    // trocar a cor do item ativo, uma "pílula" roxa desliza até ele.
    const indicator = document.getElementById('sidebar-nav-indicator');
    if (indicator && active) {
        indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
        indicator.style.width  = active.offsetWidth  + 'px';
        indicator.style.height = active.offsetHeight + 'px';
        indicator.classList.add('visible');
    }

    document.querySelectorAll('.aluno-tabbar-item').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + id);
    if (activeTab) activeTab.classList.add('active');

    syncProfTabbar(id);
}

// ============================================================
// BARRA FLUTUANTE (ALUNO, MOBILE) — reaproveita SIDEBAR_ITEMS.aluno,
// então nunca sai de sincronia com o menu (mesmos itens, mesma ordem).
// ============================================================
function renderAlunoTabbar(items) {
    const tabbar = document.getElementById('aluno-tabbar');
    if (!tabbar) return;

    tabbar.innerHTML = items.map(item => `
        <button class="aluno-tabbar-item" id="tab-${item.id}" onclick="Router.navigate('${item.id}')">
            <span class="aluno-tabbar-icon">${item.icon}</span>
            <span class="aluno-tabbar-label">${item.label.split(' ')[0]}</span>
            ${item.badge ? '<span class="aluno-tabbar-badge chat-nav-badge" style="display:none">0</span>' : ''}
        </button>
    `).join('');
}

async function handleTopbarAvatarClick() {
    // No mobile do aluno é o único jeito de sair (a sidebar tradicional,
    // que tem o botão de logout, fica escondida nessa faixa de tela).
    const confirmed = await confirmAction('Sair da plataforma?');
    if (confirmed) Auth.logout();
}

// ============================================================
// BARRA DE NAVEGAÇÃO DO PROFESSOR (MOBILE)
// Diferente da do aluno de propósito: rótulos SEMPRE visíveis (ícone sem
// texto obriga a adivinhar), alvos de toque maiores, e a ação mais
// frequente do professor — lançar aula — como botão central em destaque.
// O professor tem 7 itens de menu, não cabem numa barra: 4 fixos + "Mais".
// ============================================================
const PROF_TAB_ROTAS_FIXAS = ['dashboard', 'agenda', 'relatorios', 'chat'];

function renderProfTabbar(items) {
    const tabbar = document.getElementById('prof-tabbar');
    if (!tabbar) return;

    const tab = (id, icon, label, extra = '') => `
        <button class="prof-tab" id="ptab-${id}" onclick="Router.navigate('${id}')">
            <span class="prof-tab-icon">${icon}</span>
            <span class="prof-tab-label">${label}</span>
            ${extra}
        </button>`;

    tabbar.innerHTML = `
        ${tab('dashboard', '⊞', 'Início')}
        ${tab('agenda', '📅', 'Agenda')}
        <button class="prof-tab prof-tab-cta" id="ptab-cta" onclick="Modules.Dashboard._lancarAula()">
            <span class="prof-tab-cta-icon">✓</span>
            <span class="prof-tab-label">Lançar aula</span>
        </button>
        ${tab('chat', '💬', 'Chat', '<span class="prof-tab-badge chat-nav-badge" style="display:none">0</span>')}
        <button class="prof-tab" id="ptab-more" onclick="openProfMoreSheet()" aria-haspopup="dialog">
            <span class="prof-tab-icon">⋯</span>
            <span class="prof-tab-label">Mais</span>
        </button>
    `;

    // Gaveta "Mais": o que não coube na barra + identificação + Sair
    const sheet = document.getElementById('prof-sheet');
    if (!sheet) return;
    const extras = items.filter(i => !PROF_TAB_ROTAS_FIXAS.includes(i.id));
    const profile = AppState.userProfile;
    sheet.innerHTML = `
        <div class="prof-sheet-handle" aria-hidden="true"></div>
        <div class="prof-sheet-user">
            <div class="user-avatar">${profile?.nome?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
                <div class="user-name">${escapeHtml(profile?.nome || '')}</div>
                <div class="user-role">${fmt.role(AppState.role)}</div>
            </div>
        </div>
        <div class="prof-sheet-list">
            ${extras.map(item => `
                <button class="prof-sheet-item" data-route="${item.id}" onclick="closeProfMoreSheet(); Router.navigate('${item.id}')">
                    <span class="prof-sheet-item-icon">${item.icon}</span>
                    <span class="prof-sheet-item-label">${item.label}</span>
                    <span class="prof-sheet-item-chevron" aria-hidden="true">›</span>
                </button>
            `).join('')}
        </div>
        <button class="prof-sheet-logout" onclick="closeProfMoreSheet(); handleTopbarAvatarClick()">Sair da plataforma</button>
    `;
}

function syncProfTabbar(routeId) {
    document.querySelectorAll('.prof-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.prof-sheet-item').forEach(b => b.classList.remove('active'));

    let alvo = null;
    if (routeId === 'relatorios')                    alvo = document.getElementById('ptab-cta');
    else if (PROF_TAB_ROTAS_FIXAS.includes(routeId)) alvo = document.getElementById('ptab-' + routeId);
    else {
        // rota que mora dentro da gaveta: acende "Mais" e o item dentro dela
        alvo = document.getElementById('ptab-more');
        document.querySelector(`.prof-sheet-item[data-route="${routeId}"]`)?.classList.add('active');
    }
    alvo?.classList.add('active');
}

function openProfMoreSheet() {
    document.getElementById('prof-sheet-backdrop')?.classList.add('open');
    const sheet = document.getElementById('prof-sheet');
    sheet?.classList.add('open');
    sheet?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('prof-sheet-open');
}

function closeProfMoreSheet() {
    document.getElementById('prof-sheet-backdrop')?.classList.remove('open');
    const sheet = document.getElementById('prof-sheet');
    sheet?.classList.remove('open');
    sheet?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('prof-sheet-open');
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfMoreSheet(); });

// ============================================================
// REGISTRAR ROTAS
// ============================================================
function registerRoutes() {
    const missing = [];
    const reg = (route, mod) => {
        if (!mod) { missing.push(route); return; }
        Router.register(route, mod.render.bind(mod));
    };

    reg('dashboard',       Modules.Dashboard);
    reg('usuarios',        Modules.Usuarios);
    reg('alunos',          Modules.Alunos);
    reg('agenda',          Modules.Agenda);
    reg('relatorios',      Modules.Relatorios);
    reg('insights',        Modules.Insights);
    reg('cronograma',      Modules.Cronograma);
    reg('atividades',      Modules.Atividades);
    reg('financeiro',      Modules.Financeiro);
    reg('disponibilidade', Modules.Disponibilidade);
    reg('professores',     Modules.Professores);
    reg('auditoria',       Modules.Auditoria);
    reg('psicopedagogia',  Modules.Psicopedagogia);
    reg('chat',            Modules.Chat);

    if (missing.length) {
        console.warn('Módulos não carregados:', missing.join(', '), '— recarregue a página.');
        showToast('Erro ao carregar módulos. Recarregue a página (F5).', 'error', 8000);
    }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function initApp() {
    showPageLoader();
    try {
        const loggedIn = await Auth.init();
        if (!loggedIn) {
            window.location.href = 'index.html';
            return;
        }

        renderSidebar();
        registerRoutes();
        await Router.navigate('dashboard');

        // Inicia badge de mensagens não lidas (persiste em todas as páginas)
        const uid  = AppState.userProfile?.id;
        const role = AppState.role;
        if (uid && (role === 'professor' || role === 'aluno')) {
            Modules.Chat.initGlobal(uid, role);
        }

        // Toggle sidebar mobile
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('sidebar-open');
        });

        // Fechar sidebar mobile ao navegar
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth < 768) {
                    document.getElementById('sidebar').classList.remove('sidebar-open');
                }
            });
        });

    } catch (err) {
        console.error('Erro ao inicializar:', err);
        showToast('Erro ao carregar aplicação', 'error');
    } finally {
        hidePageLoader();
    }
}

// Iniciar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', initApp);
