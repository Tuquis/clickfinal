// @ts-nocheck
// ============================================================
// EDGE FUNCTION: notify-aula-cancelada
// Notifica o professor via WhatsApp (API oficial Meta) quando
// uma aula é cancelada. Chamada pelo frontend após atualizar
// o status da aula para 'cancelada' em agenda_meet.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarTemplate, normalizarTelefone } from '../_shared/meta.ts'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

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

  // Busca dados da aula (já cancelada nesse ponto — a view não filtra por status)
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

  // Monta parâmetros do template aula_cancelada_professor
  const dataObj       = new Date(aula.data + 'T00:00:00')
  const dataFormatada = `${DIAS[dataObj.getDay()]}, ${dataObj.getDate()} de ${MESES[dataObj.getMonth()]}`
  const horario       = (aula.horario || '').substring(0, 5)
  const nomeProf      = aula.professor_nome || 'Professor'
  const primeiroNome  = nomeProf.split(' ')[0]

  // Envia via API oficial (Meta)
  try {
    await enviarTemplate(telefone, 'aula_cancelada_professor', [
      primeiroNome,
      aula.aluno_nome || '—',
      dataFormatada,
      horario
    ])
  } catch (e) {
    console.error('Meta API error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers }
    )
  }

  console.log(`WhatsApp de cancelamento enviado para professor — ${telefone}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})
