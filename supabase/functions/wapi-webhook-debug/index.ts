// ============================================================
// EDGE FUNCTION: wapi-webhook-debug
// Recebe QUALQUER webhook do W-API (conectado, desconectado, status,
// entrega, mensagem recebida) e grava em public.wapi_debug_events
// para diagnóstico manual. Uso temporário, remover depois do teste.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  let payload: unknown = null
  try {
    payload = await req.json()
  } catch {
    payload = { raw: await req.text().catch(() => null) }
  }

  const eventType = (payload as any)?.event ?? 'unknown'

  await db.from('wapi_debug_events').insert({ event_type: eventType, payload })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
})
