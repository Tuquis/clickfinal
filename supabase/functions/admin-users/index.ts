// @ts-nocheck
// ============================================================
// EDGE FUNCTION: admin-users
// Proxy seguro para operações de Admin Auth (criar, atualizar
// senha, deletar). A service role key nunca sai do servidor.
//
// Autenticação: o frontend envia o JWT do usuário logado.
// A função verifica que ele é admin antes de executar.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Verifica se o token pertence a um admin ───────────────────
async function getAdminUser(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null

  const { data: perfil } = await db
    .from('usuarios')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  return perfil?.role === 'admin' ? user : null
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' }

  // Apenas POST aceito (action vem no body)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  // Valida admin
  const admin = await getAdminUser(req.headers.get('Authorization'))
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers })
  }

  const body = await req.json()
  const { action } = body

  // ── Criar usuário ───────────────────────────────────────────
  if (action === 'create') {
    const { email, password, nome, role } = body

    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, role }
      })
    })

    const json = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: json.msg || json.message || 'Erro ao criar usuário' }), { status: 400, headers })
    }
    return new Response(JSON.stringify(json), { status: 200, headers })
  }

  // ── Atualizar senha ─────────────────────────────────────────
  if (action === 'update_password') {
    const { authId, password } = body

    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ password })
    })

    const json = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: json.msg || json.message || 'Erro ao atualizar senha' }), { status: 400, headers })
    }
    return new Response(JSON.stringify(json), { status: 200, headers })
  }

  // ── Deletar usuário ─────────────────────────────────────────
  if (action === 'delete') {
    const { authId } = body

    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  }

  return new Response(JSON.stringify({ error: 'Action inválida' }), { status: 400, headers })
})
