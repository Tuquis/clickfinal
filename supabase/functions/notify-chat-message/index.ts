// @ts-nocheck
// ============================================================
// EDGE FUNCTION: notify-chat-message
// Disparada via Database Webhook (INSERT em mensagens_diretas).
// Envia WhatsApp ao professor quando um aluno manda mensagem.
// Só dispara na PRIMEIRA mensagem não lida (evita spam).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarTemplate, normalizarTelefone } from '../_shared/meta.ts'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── Handler principal ─────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // Supabase Database Webhooks enviam { type, table, schema, record, old_record }
    const record = payload?.record
    if (!record) {
      return new Response(JSON.stringify({ skipped: 'sem record' }), { status: 200 })
    }

    const { id: msgId, remetente_id, destinatario_id } = record

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── Busca dados do destinatário ──────────────────────────
    const { data: destinatario } = await db
      .from('usuarios')
      .select('id, nome, role')
      .eq('id', destinatario_id)
      .single()

    // Só notifica se o destinatário for professor
    if (!destinatario || destinatario.role !== 'professor') {
      return new Response(JSON.stringify({ skipped: 'destinatário não é professor' }), { status: 200 })
    }

    // ── Anti-spam: janela de 30 minutos ─────────────────────
    // Não envia se já foi enviada uma notificação nos últimos 30 min
    // (ou seja, se existe outra mensagem não lida recente deste aluno).
    // Isso evita spam mas garante que após 30 min sem leitura o prof
    // recebe novo aviso caso o aluno mande outra mensagem.
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { count: mensagensRecentes } = await db
      .from('mensagens_diretas')
      .select('id', { count: 'exact', head: true })
      .eq('remetente_id',    remetente_id)
      .eq('destinatario_id', destinatario_id)
      .eq('lida',            false)
      .neq('id',             msgId)
      .gte('created_at',     trintaMinAtras)

    if ((mensagensRecentes ?? 0) > 0) {
      return new Response(JSON.stringify({ skipped: 'notificação já enviada nos últimos 30 min' }), { status: 200 })
    }

    // ── Busca telefone do professor ──────────────────────────
    const { data: profInfo } = await db
      .from('professores_info')
      .select('telefone')
      .eq('usuario_id', destinatario_id)
      .single()

    if (!profInfo?.telefone) {
      console.log(`Professor ${destinatario.nome} sem telefone cadastrado — pulando`)
      return new Response(JSON.stringify({ skipped: 'professor sem telefone' }), { status: 200 })
    }

    // ── Busca nome do aluno remetente ────────────────────────
    const { data: remetente } = await db
      .from('usuarios')
      .select('nome')
      .eq('id', remetente_id)
      .single()

    const nomeAluno = remetente?.nome ?? 'Um aluno'

    // ── Envia o template ──────────────────────────────────────
    await enviarTemplate(profInfo.telefone, 'nova_mensagem_chat', [nomeAluno])

    console.log(`Notificação de chat enviada para professor ${destinatario.nome} (${normalizarTelefone(profInfo.telefone)})`)
    return new Response(
      JSON.stringify({ success: true, professor: destinatario.nome }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Erro notify-chat-message:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
