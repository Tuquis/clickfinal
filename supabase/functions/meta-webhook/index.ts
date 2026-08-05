// ============================================================
// EDGE FUNCTION: meta-webhook
// Webhook oficial da Meta (WhatsApp Cloud API).
// GET  -> handshake de verificação (hub.challenge)
// POST -> eventos reais (status de entrega, mensagens recebidas)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_VERIFY_TOKEN    = Deno.env.get('META_VERIFY_TOKEN')!

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    let payload: unknown = null
    try {
      payload = await req.json()
    } catch {
      payload = { raw: await req.text().catch(() => null) }
    }

    await db.from('meta_webhook_events').insert({ payload })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response('Method not allowed', { status: 405 })
})
