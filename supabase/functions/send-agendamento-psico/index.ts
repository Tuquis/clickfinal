// @ts-nocheck
// ============================================================
// EDGE FUNCTION: send-agendamento-psico
// Notifica a psicopedagoga via WhatsApp (Z-API) quando uma
// consulta psicopedagógica é agendada.
// Chamada pelo frontend após inserir em agenda_psico.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ZAPI_INSTANCE_ID     = Deno.env.get('ZAPI_INSTANCE_ID')!
const ZAPI_TOKEN           = Deno.env.get('ZAPI_TOKEN')!
const ZAPI_CLIENT_TOKEN    = Deno.env.get('ZAPI_CLIENT_TOKEN')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function normalizarTelefone(tel: string): string | null {
  if (!tel) return null
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 0) return null
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  return null
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', ...CORS }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST')    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  const { agendaPsicoId } = await req.json()
  if (!agendaPsicoId) {
    return new Response(JSON.stringify({ error: 'agendaPsicoId obrigatório' }), { status: 400, headers })
  }

  // Busca dados da consulta
  const { data: consulta, error: consultaErr } = await db
    .from('agenda_psico')
    .select(`
      id, data, horario, link_meet,
      aluno:usuarios!agenda_psico_aluno_id_fkey(nome),
      psico:usuarios!agenda_psico_psico_id_fkey(id, nome)
    `)
    .eq('id', agendaPsicoId)
    .single()

  if (consultaErr || !consulta) {
    console.error('Consulta não encontrada:', agendaPsicoId, consultaErr)
    return new Response(JSON.stringify({ error: 'Consulta não encontrada' }), { status: 404, headers })
  }

  // Busca telefone da psicopedagoga
  const { data: psicoInfo } = await db
    .from('psico_info')
    .select('telefone')
    .eq('usuario_id', consulta.psico.id)
    .single()

  const telefone = normalizarTelefone(psicoInfo?.telefone || '')
  if (!telefone) {
    console.log('Psicopedagoga sem telefone — agendaPsicoId:', agendaPsicoId)
    return new Response(JSON.stringify({ ok: true, skipped: 'sem_telefone' }), { status: 200, headers })
  }

  const dataObj       = new Date(consulta.data + 'T00:00:00')
  const dataFormatada = `${DIAS[dataObj.getDay()]}, ${dataObj.getDate()} de ${MESES[dataObj.getMonth()]}`
  const horario       = (consulta.horario || '').substring(0, 5)
  const nomePsico     = consulta.psico?.nome || 'Psicopedagoga'
  const primeiroNome  = nomePsico.split(' ')[0]
  const nomeAluno     = consulta.aluno?.nome || '—'

  let mensagem =
    `📅 Nova consulta psicopedagógica agendada, ${primeiroNome}!\n\n` +
    `👤 Aluno: *${nomeAluno}*\n` +
    `🗓 Data: ${dataFormatada}\n` +
    `⏰ Horário: *${horario}*`

  if (consulta.link_meet) {
    mensagem += `\n\n🔗 Link da consulta:\n${consulta.link_meet}`
  }

  mensagem += `\n\n_Click do Saber_`

  const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
  const resp = await fetch(zapiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
    body: JSON.stringify({ phone: telefone, message: mensagem })
  })

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    console.error('Z-API error:', resp.status, JSON.stringify(json))
    return new Response(
      JSON.stringify({ error: `Z-API ${resp.status}: ${json.error || JSON.stringify(json)}` }),
      { status: 500, headers }
    )
  }

  console.log(`WhatsApp de agendamento psico enviado — ${telefone}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})
