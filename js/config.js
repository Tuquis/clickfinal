// ============================================================
// ENSINOCLICK — CONFIGURAÇÃO SUPABASE
// ============================================================

// IIFE isola a criação do client para não conflitar com
// o `var supabase` declarado pelo bundle UMD no escopo global
;(function () {
    var url = 'https://kverxbbwvmxcdiqwcijp.supabase.co';
    var key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZXJ4YmJ3dm14Y2RpcXdjaWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzYxMzUsImV4cCI6MjA5MzIxMjEzNX0.yZW-29JAIuJvZgsDO6gy8gmGswz4NgDTW1M0izGxZAI';

    // SERVICE ROLE KEY — usada apenas para criar usuários no Auth Admin
    // Supabase Dashboard → Settings → API → service_role
    window.SUPABASE_URL         = url;
    window.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZXJ4YmJ3dm14Y2RpcXdjaWpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzYzNjEzNSwiZXhwIjoyMDkzMjEyMTM1fQ.8oqv5SwRA7aQspqRT0xK5KsRYwVcj1jJPbX_WD6GoPA';

    var lib = window.supabase; // referência à lib antes de sobrescrever
    window.supabase = lib.createClient(url, key, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: { eventsPerSecond: 10 }
        }
    });
}());

// Configurações globais da aplicação
var APP_CONFIG = {
    name: 'Ensinoclick',
    version: '1.0.0',
    paginationSize: 20,
    toastDuration: 3500,
    dateLocale: 'pt-BR',
    currency: 'BRL'
};

// Labels de roles para exibição
var ROLE_LABELS = {
    admin: 'Administrador',
    professor: 'Professor',
    aluno: 'Aluno',
    psicopedagoga: 'Psicopedagoga'
};

// Dias da semana
var DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

// Status de aula
var STATUS_AULA = {
    agendada: { label: 'Agendada', class: 'badge-info' },
    realizada: { label: 'Realizada', class: 'badge-success' },
    cancelada: { label: 'Cancelada', class: 'badge-danger' }
};

// Status financeiro
var STATUS_FINANCEIRO = {
    pendente: { label: 'Pendente', class: 'badge-warning' },
    pago: { label: 'Pago', class: 'badge-success' },
    atrasado: { label: 'Atrasado', class: 'badge-danger' }
};

// Categorias psicopedagógicas
var CATEGORIAS_PSICO = {
    geral: 'Geral',
    comportamental: 'Comportamental',
    cognitivo: 'Cognitivo',
    emocional: 'Emocional',
    social: 'Social'
};

// Namespace de módulos — deve existir antes dos arquivos de módulo carregarem
window.Modules = {};
