# Ensinoclick — SaaS Educacional

## Configuração em 5 passos

### 1. Criar projeto no Supabase
1. Acesse https://supabase.com e crie um novo projeto
2. Anote a **Project URL** e a **anon key** (Settings → API)

### 2. Configurar credenciais
Edite `js/config.js`:
```js
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';
```

### 3. Executar SQL no Supabase
No SQL Editor do Supabase, execute os arquivos **nesta ordem**:
1. `sql/schema.sql`
2. `sql/triggers.sql`
3. `sql/rls.sql`
4. `sql/views.sql`

### 4. Criar Storage Buckets
Em **Storage** → **New Bucket**, crie:
- `atividades` (privado)
- `evidencias` (privado)
- `materiais` (privado)

### 5. Criar o primeiro usuário admin
No Supabase:
1. **Authentication → Users → Invite user** — informe o email do admin
2. **SQL Editor** — execute:
```sql
INSERT INTO public.usuarios (auth_id, nome, email, role)
VALUES (
    '<UUID do auth user criado acima>',
    'Nome do Admin',
    'admin@suaescola.com',
    'admin'
);
```

### Rodar localmente
Basta abrir `index.html` em qualquer servidor HTTP. Exemplos:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# VS Code: instalar extensão "Live Server" e clicar em "Go Live"
```

Acesse: http://localhost:8080

---

## Fluxo resumido
1. Admin cria usuários → alunos recebem dados de acesso
2. Professor define disponibilidade (visual)
3. Admin agenda aulas
4. Professor acessa agenda, entra no Meet, preenche relatório
5. Ao salvar relatório: aula → "realizada", saldo aluno decrementado, saldo professor incrementado
6. Admin acompanha financeiro, auditoria e dashboard
7. Psicopedagoga registra observações (aluno não vê)

## Estrutura de pastas
```
clickfinal/
├── index.html          Login
├── app.html            SPA principal
├── css/
│   └── main.css        Estilos globais (Quiet Luxury)
├── js/
│   ├── config.js       Credenciais Supabase + constantes
│   ├── utils.js        Helpers, toast, modais, upload
│   ├── auth.js         Autenticação e guards
│   ├── app.js          Roteador + sidebar + inicialização
│   └── modules/
│       ├── dashboard.js
│       ├── usuarios.js
│       ├── alunos.js
│       ├── agenda.js
│       ├── relatorios.js
│       ├── cronograma.js
│       ├── atividades.js
│       ├── financeiro.js
│       ├── disponibilidade.js
│       ├── auditoria.js
│       └── psicopedagogia.js
└── sql/
    ├── schema.sql      Tabelas + índices
    ├── triggers.sql    Automações (relatório, financeiro, audit)
    ├── rls.sql         Row Level Security por role
    └── views.sql       Views de consulta + storage info
```
