// @ts-nocheck
// ============================================================
// EDGE FUNCTION: send-agendamento-email
// Notifica o professor via WhatsApp (Z-API) quando uma aula
// é agendada. Chamada pelo frontend após inserir em agenda_meet.
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

  // Verifica JWT do usuário logado
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

  const { agendaId } = await req.json()
  if (!agendaId) {
    return new Response(JSON.stringify({ error: 'agendaId obrigatório' }), { status: 400, headers })
  }

  // Busca dados da aula
  const { data: aula, error: aulaErr } = await db
    .from('v_agenda_completa')
    .select('*')
    .eq('id', agendaId)
    .single()

  if (aulaErr || !aula) {
    console.error('Aula não encontrada:', agendaId, aulaErr)
    return new Response(JSON.stringify({ error: 'Aula não encontrada' }), { status: 404, headers })
  }

  // Busca telefone do professor em professores_info
  const { data: profInfo } = await db
    .from('professores_info')
    .select('telefone')
    .eq('usuario_id', aula.professor_id)
    .single()

  const telefone = normalizarTelefone(profInfo?.telefone || '')
  if (!telefone) {
    console.log('Professor sem telefone cadastrado — agendaId:', agendaId)
    return new Response(JSON.stringify({ ok: true, skipped: 'sem_telefone' }), { status: 200, headers })
  }

  // Monta mensagem
  const dataObj       = new Date(aula.data + 'T00:00:00')
  const dataFormatada = `${DIAS[dataObj.getDay()]}, ${dataObj.getDate()} de ${MESES[dataObj.getMonth()]}`
  const horario       = (aula.horario || '').substring(0, 5)
  const nomeProf      = aula.professor_nome || 'Professor'
  const primeiroNome  = nomeProf.split(' ')[0]

  let mensagem =
    `📅 Nova aula agendada, ${primeiroNome}!\n\n` +
    `👤 Aluno: *${aula.aluno_nome || '—'}*\n` +
    `📚 Disciplina: ${aula.disciplina || '—'}\n` +
    `🗓 Data: ${dataFormatada}\n` +
    `⏰ Horário: *${horario}*`

  if (aula.conteudo) {
    mensagem += `\n📝 Conteúdo: ${aula.conteudo}`
  }

  if (aula.link_meet) {
    mensagem += `\n\n🔗 Link da aula:\n${aula.link_meet}`
  }

  mensagem += `\n\n_Click do Saber_`

  // Envia via Z-API
  const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`

  const resp = await fetch(zapiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token':  ZAPI_CLIENT_TOKEN || ''
    },
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

  console.log(`WhatsApp de agendamento enviado para professor — ${telefone}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})
