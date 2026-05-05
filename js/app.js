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
        { id: 'auditoria',       icon: '🔍', label: 'Auditoria' },
    ],
    professor: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'agenda',         icon: '📅', label: 'Minha Agenda' },
        { id: 'professores',    icon: '🏫', label: 'Total de Aulas' },
        { id: 'relatorios',     icon: '📄', label: 'Lançar Aula' },
        { id: 'atividades',     icon: '📝', label: 'Enviar Atividade' },
        { id: 'disponibilidade',icon: '🕐', label: 'Minha Disponibilidade' },
    ],
    aluno: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'agenda',         icon: '📅', label: 'Minhas Aulas' },
        { id: 'cronograma',     icon: '📋', label: 'Cronograma' },
        { id: 'atividades',     icon: '📝', label: 'Atividades' },
    ],
    psicopedagoga: [
        { id: 'dashboard',      icon: '⊞', label: 'Dashboard' },
        { id: 'alunos',         icon: '🎓', label: 'Alunos' },
        { id: 'agenda',         icon: '📅', label: 'Agenda' },
        { id: 'relatorios',     icon: '📄', label: 'Relatórios' },
        { id: 'psicopedagogia', icon: '🧠', label: 'Observações' },
    ]
};

// ============================================================
// RENDERIZAR SIDEBAR
// ============================================================
function renderSidebar() {
    const role = AppState.role;
    const items = SIDEBAR_ITEMS[role] || [];
    const profile = AppState.userProfile;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <img src="img/isotipo.png" alt="Click do Saber" class="logo-img" />
            <span class="logo-text">Click do Saber</span>
        </div>
        <nav class="sidebar-nav">
            ${items.map(item => `
                <button class="nav-item" id="nav-${item.id}" onclick="Router.navigate('${item.id}')">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                </button>
            `).join('')}
        </nav>
        <div class="sidebar-footer">
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
    reg('cronograma',      Modules.Cronograma);
    reg('atividades',      Modules.Atividades);
    reg('financeiro',      Modules.Financeiro);
    reg('disponibilidade', Modules.Disponibilidade);
    reg('professores',     Modules.Professores);
    reg('auditoria',       Modules.Auditoria);
    reg('psicopedagogia',  Modules.Psicopedagogia);

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
