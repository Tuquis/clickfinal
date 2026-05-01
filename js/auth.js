// ============================================================
// ENSINOCLICK — AUTENTICAÇÃO
// ============================================================

const Auth = {

    // Inicializar sessão ao carregar a página
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await Auth.loadProfile(session.user);
            return true;
        }
        return false;
    },

    // Login com email e senha
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await Auth.loadProfile(data.user);
        return data;
    },

    // Logout
    async logout() {
        await supabase.auth.signOut();
        AppState.user = null;
        AppState.userProfile = null;
        AppState.role = null;
        window.location.href = 'index.html';
    },

    // Carregar perfil do usuário da tabela usuarios
    async loadProfile(authUser) {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('auth_id', authUser.id)
            .single();

        if (error || !data) {
            await supabase.auth.signOut();
            throw new Error('Perfil não encontrado. Contate o administrador.');
        }

        AppState.user = authUser;
        AppState.userProfile = data;
        AppState.role = data.role;
    },

    // Criar usuário via Admin API (usando service_role no backend)
    // No frontend usamos uma Edge Function ou direct insert
    async createUser(nome, email, role) {
        // 1. Criar auth user via Supabase Admin
        const tempPassword = Auth._generatePassword();

        // Usar signUp com auto-confirm desabilitado
        const { data: authData, error: authError } = await supabase.auth.admin
            ? await supabase.auth.admin.createUser({
                email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: { nome, role }
              })
            : { data: null, error: new Error('Admin API não disponível no cliente') };

        if (authError) throw authError;

        // 2. Criar na tabela usuarios
        const { data: userRecord, error: dbError } = await supabase
            .from('usuarios')
            .insert({ nome, email, role, auth_id: authData.user.id })
            .select()
            .single();

        if (dbError) throw dbError;

        // 3. Criar info específica por role
        if (role === 'professor') {
            await supabase.from('professores_info').insert({
                usuario_id: userRecord.id,
                saldo_aulas_dadas: 0
            });
        }

        await auditLog('USUARIO_CRIADO', 'usuarios', userRecord.id, { nome, email, role });

        return { user: userRecord, tempPassword };
    },

    _generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#';
        return Array.from({ length: 12 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
    },

    // Verificar se usuário tem permissão
    can(roles) {
        if (!Array.isArray(roles)) roles = [roles];
        return roles.includes(AppState.role);
    },

    // Guard — redireciona se não autenticado
    requireAuth() {
        if (!AppState.userProfile) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    // Guard — redireciona se não tem role
    requireRole(...roles) {
        if (!Auth.can(roles)) {
            showToast('Acesso não autorizado', 'error');
            Router.navigate('dashboard');
            return false;
        }
        return true;
    }
};

// Listener de mudança de sessão
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        AppState.user = null;
        AppState.userProfile = null;
        AppState.role = null;
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
});
