// @ts-nocheck
// ============================================================
// EDGE FUNCTION: notify-chat-message
// Disparada via Database Webhook (INSERT em mensagens_diretas).
// Envia WhatsApp pro destinatário de qualquer mensagem de chat — aluno,
// professor ou psicopedagoga — sempre que o telefone certo estiver
// cadastrado. Só dispara na PRIMEIRA mensagem não lida (evita spam).
// ============================================================

// Cada role tem sua tabela de info e sua coluna de telefone própria.
// Pro aluno é importante usar telefone_aluno (o WhatsApp dele mesmo),
// não `telefone` — essa é a do responsável, usada só pro relatório.
const TELEFONE_POR_ROLE: Record<string, { tabela: string; coluna: string }> = {
  professor:     { tabela: 'professores_info', coluna: 'telefone' },
  psicopedagoga: { tabela: 'psico_info',       coluna: 'telefone' },
  aluno:         { tabela: 'alunos_info',      coluna: 'telefone_aluno' },
}

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

    const config = destinatario && TELEFONE_POR_ROLE[destinatario.role]
    if (!config) {
      return new Response(JSON.stringify({ skipped: 'destinatário sem papel notificável' }), { status: 200 })
    }

    // ── Anti-spam: janela de 30 minutos ─────────────────────
    // Não envia se já existe outra mensagem não lida recente desse mesmo
    // remetente pra esse mesmo destinatário. Isso evita spam mas garante
    // que após 30 min sem leitura um novo aviso é disparado.
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

    // ── Busca telefone do destinatário (tabela/coluna dependem do papel) ──
    const { data: destInfo } = await db
      .from(config.tabela)
      .select(config.coluna)
      .eq('usuario_id', destinatario_id)
      .single()

    const telefone = destInfo?.[config.coluna]
    if (!telefone) {
      console.log(`${destinatario.nome} (${destinatario.role}) sem telefone cadastrado — pulando`)
      return new Response(JSON.stringify({ skipped: 'destinatário sem telefone' }), { status: 200 })
    }

    // ── Busca nome de quem mandou a mensagem ─────────────────
    const { data: remetente } = await db
      .from('usuarios')
      .select('nome')
      .eq('id', remetente_id)
      .single()

    const nomeRemetente = remetente?.nome ?? 'Alguém'

    // ── Envia o template ──────────────────────────────────────
    await enviarTemplate(telefone, 'nova_mensagem_chat', [nomeRemetente])

    console.log(`Notificação de chat enviada para ${destinatario.role} ${destinatario.nome} (${normalizarTelefone(telefone)})`)
    return new Response(
      JSON.stringify({ success: true, destinatario: destinatario.nome, role: destinatario.role }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Erro notify-chat-message:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
