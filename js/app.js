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

    if (role === 'aluno') renderAlunoTabbar(items);

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isAluno = role === 'aluno';

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <img src="img/isotipo.png" alt="Click do Saber" class="logo-img" />
            <span class="logo-text">Click do Saber</span>
        </div>
        <nav class="sidebar-nav${isAluno ? ' sidebar-nav--aluno' : ''}">
            ${isAluno ? '<div class="sidebar-nav-indicator" id="sidebar-nav-indicator"></div>' : ''}
            ${items.map((item, i) => `
                <button class="nav-item" id="nav-${item.id}" style="--i:${i}" onclick="Router.navigate('${item.id}')">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                    ${item.badge ? '<span class="nav-badge chat-nav-badge" style="display:none">0</span>' : ''}
                </button>
            `).join('')}
        </nav>
        <div class="sidebar-footer${isAluno ? ' sidebar-footer--aluno' : ''}">
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
