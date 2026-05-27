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

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

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
  const headers = { 'Content-Type': 'application/json', ...CORS }

  // Responde ao preflight CORS que o browser envia antes do POST
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

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
      const msg = json.error || json.msg || json.message || json.error_description || 'Erro ao criar usuário'
      console.error('create error:', JSON.stringify(json))
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers })
    }
    return new Response(JSON.stringify(json), { status: 200, headers })
  }

  // ── Atualizar senha ─────────────────────────────────────────
  if (action === 'update_password') {
    const { authId, password } = body

    if (!authId) {
      return new Response(JSON.stringify({ error: 'authId não informado' }), { status: 400, headers })
    }
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }), { status: 400, headers })
    }

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

    // Usuário não existe no Auth — tenta corrigir o vínculo e redefinir senha
    const notFound = !resp.ok && (
      resp.status === 404 ||
      resp.status === 422 ||
      (json.error || json.msg || json.message || '').toLowerCase().includes('not found')
    )

    if (notFound) {
      // 1. Busca o email do usuário na tabela usuarios
      const { data: perfil } = await db
        .from('usuarios')
        .select('id, email, nome, role')
        .eq('auth_id', authId)
        .single()

      if (!perfil) {
        return new Response(JSON.stringify({ error: 'Usuário não encontrado na plataforma' }), { status: 404, headers })
      }

      // 2. Verifica se já existe um usuário no Auth com esse email
      const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
      const existente = (authUsers?.users || []).find((u: any) => u.email === perfil.email)

      if (existente) {
        // Email já existe no Auth com outro UUID — atualiza senha e corrige auth_id
        const fixResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existente.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ password })
        })
        const fixJson = await fixResp.json()
        if (!fixResp.ok) {
          return new Response(JSON.stringify({ error: fixJson.error || fixJson.msg || 'Erro ao atualizar senha' }), { status: 400, headers })
        }
        // Atualiza o auth_id com o UUID correto
        await db.from('usuarios').update({ auth_id: existente.id }).eq('id', perfil.id)
        return new Response(JSON.stringify({ ok: true, fixed: true }), { status: 200, headers })
      }

      // 3. Não existe no Auth — cria novo
      const criarResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          email: perfil.email,
          password,
          email_confirm: true,
          user_metadata: { nome: perfil.nome, role: perfil.role }
        })
      })

      const criarJson = await criarResp.json()
      if (!criarResp.ok) {
        const msg = criarJson.error || criarJson.msg || criarJson.message || 'Erro ao recriar usuário'
        console.error('recreate error:', JSON.stringify(criarJson))
        return new Response(JSON.stringify({ error: msg }), { status: 400, headers })
      }

      // Atualiza o auth_id com o novo UUID
      await db.from('usuarios').update({ auth_id: criarJson.id }).eq('id', perfil.id)
      return new Response(JSON.stringify({ ok: true, recreated: true }), { status: 200, headers })
    }

    if (!resp.ok) {
      const msg = json.error || json.msg || json.message || json.error_description || 'Erro ao atualizar senha'
      console.error('update_password error:', JSON.stringify(json))
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers })
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
