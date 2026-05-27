// @ts-nocheck
// ============================================================
// EDGE FUNCTION: send-class-reminders
// Disparada a cada minuto pelo pg_cron.
// - Email ao professor: ~30 min antes
// - WhatsApp ao aluno:  ~25 min antes (via Z-API)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Variáveis de ambiente ────────────────────────────────────
const EMAILJS_SERVICE_ID   = Deno.env.get('EMAILJS_SERVICE_ID')!
const EMAILJS_TEMPLATE_ID  = Deno.env.get('EMAILJS_REMINDER_TEMPLATE_ID')!
const EMAILJS_PUBLIC_KEY   = Deno.env.get('EMAILJS_PUBLIC_KEY')!
const EMAILJS_PRIVATE_KEY  = Deno.env.get('EMAILJS_PRIVATE_KEY')!
const CRON_SECRET          = Deno.env.get('CRON_SECRET')!

const ZAPI_INSTANCE_ID     = Deno.env.get('ZAPI_INSTANCE_ID')!
const ZAPI_TOKEN           = Deno.env.get('ZAPI_TOKEN')!
const ZAPI_CLIENT_TOKEN    = Deno.env.get('ZAPI_CLIENT_TOKEN')!

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

// ── Helpers ───────────────────────────────────────────────────

function toSaoPaulo(d: Date): { date: string; time: string } {
  const str = d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [date, timeStr] = str.split(' ')
  return { date, time: timeStr.substring(0, 5) }
}

// Normaliza telefone para formato Z-API: 5511999999999
function normalizarTelefone(tel: string): string | null {
  if (!tel) return null
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 0) return null

  // Já tem código do país
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  // Tem DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits
  }
  return null
}

// Envia mensagem de texto via Z-API
async function enviarWhatsApp(telefone: string, mensagem: string): Promise<void> {
  const numero = normalizarTelefone(telefone)
  if (!numero) throw new Error(`Telefone inválido: ${telefone}`)

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    throw new Error('Credenciais Z-API não configuradas (ZAPI_INSTANCE_ID / ZAPI_TOKEN)')
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token':  ZAPI_CLIENT_TOKEN || ''
    },
    body: JSON.stringify({ phone: numero, message: mensagem })
  })

  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(`Z-API ${resp.status}: ${json.error || JSON.stringify(json)}`)
  }
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (secret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()
  const { date: today } = toSaoPaulo(now)

  // Janela email professor: 28–32 min
  const { time: h28 } = toSaoPaulo(new Date(now.getTime() + 28 * 60_000))
  const { time: h32 } = toSaoPaulo(new Date(now.getTime() + 32 * 60_000))

  // Janela WhatsApp aluno 25 min: 23–27 min
  const { time: h23 } = toSaoPaulo(new Date(now.getTime() + 23 * 60_000))
  const { time: h27 } = toSaoPaulo(new Date(now.getTime() + 27 * 60_000))

  // Janela WhatsApp aluno 10 min: 8–12 min
  const { time: h8  } = toSaoPaulo(new Date(now.getTime() +  8 * 60_000))
  const { time: h12 } = toSaoPaulo(new Date(now.getTime() + 12 * 60_000))

  console.log(`Rodando — hoje: ${today} | email: ${h28}–${h32} | zap25: ${h23}–${h27} | zap10: ${h8}–${h12}`)

  // ── Busca aulas para EMAIL (professor) ────────────────────────
  const { data: aulasEmail } = await db
    .from('agenda_meet')
    .select('id, data, horario, conteudo, link_meet, professor_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_enviado', false)
    .gte('horario', h28)
    .lte('horario', h32)

  // ── Busca aulas para WHATSAPP 25 min (aluno) ─────────────────
  const { data: aulasZap } = await db
    .from('agenda_meet')
    .select('id, data, horario, link_meet, professor_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_whatsapp_enviado', false)
    .gte('horario', h23)
    .lte('horario', h27)

  // ── Busca aulas para WHATSAPP 10 min (aluno) ─────────────────
  const { data: aulasZap10 } = await db
    .from('agenda_meet')
    .select('id, data, horario, link_meet, professor_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_whatsapp_10min_enviado', false)
    .gte('horario', h8)
    .lte('horario', h12)

  const results: any[] = []

  // ── Envia EMAILS (professor) ──────────────────────────────────
  for (const aula of (aulasEmail || [])) {
    try {
      const [{ data: prof }, { data: aluno }, { data: alunoInfo }] = await Promise.all([
        db.from('usuarios').select('email, nome').eq('id', aula.professor_id).single(),
        db.from('usuarios').select('nome').eq('id', aula.aluno_id).single(),
        db.from('alunos_info').select('serie, disciplina').eq('usuario_id', aula.aluno_id).single()
      ])

      if (!prof?.email) {
        results.push({ id: aula.id, tipo: 'email', status: 'sem_email' })
        continue
      }

      const dataObj       = new Date(aula.data + 'T00:00:00')
      const dataFormatada = `${DIAS[dataObj.getDay()]}, ${dataObj.getDate()} de ${MESES[dataObj.getMonth()]} de ${dataObj.getFullYear()}`

      const emailResp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id:      EMAILJS_SERVICE_ID,
          template_id:     EMAILJS_TEMPLATE_ID,
          user_id:         EMAILJS_PUBLIC_KEY,
          accessToken:     EMAILJS_PRIVATE_KEY,
          template_params: {
            to_email:       prof.email,
            to_name:        prof.nome,
            professor_nome: prof.nome,
            aluno_nome:     aluno?.nome             ?? '',
            disciplina:     alunoInfo?.disciplina   ?? '',
            serie:          alunoInfo?.serie        ?? '',
            data_aula:      dataFormatada,
            horario:        (aula.horario ?? '').substring(0, 5),
            conteudo:       aula.conteudo ?? '',
            link_meet:      aula.link_meet ?? 'Não informado ainda',
          }
        })
      })

      if (!emailResp.ok) throw new Error(`EmailJS ${emailResp.status}`)

      await db.from('agenda_meet').update({ lembrete_enviado: true }).eq('id', aula.id)
      console.log(`Email enviado — ${prof.email}`)
      results.push({ id: aula.id, tipo: 'email', status: 'enviado', para: prof.email })

    } catch (e) {
      console.error(`Erro email aula ${aula.id}:`, e)
      results.push({ id: aula.id, tipo: 'email', status: 'erro' })
    }
  }

  // ── Envia WHATSAPP (aluno) ────────────────────────────────────
  for (const aula of (aulasZap || [])) {
    try {
      const [{ data: aluno }, { data: alunoInfo }, { data: prof }] = await Promise.all([
        db.from('usuarios').select('nome').eq('id', aula.aluno_id).single(),
        db.from('alunos_info').select('telefone_aluno').eq('usuario_id', aula.aluno_id).single(),
        db.from('usuarios').select('nome').eq('id', aula.professor_id).single()
      ])

      const telefone = alunoInfo?.telefone_aluno
      if (!telefone) {
        console.log(`Aluno sem telefone_aluno — aula ${aula.id}`)
        // Marca como enviado para não tentar novamente todo minuto
        await db.from('agenda_meet').update({ lembrete_whatsapp_enviado: true }).eq('id', aula.id)
        results.push({ id: aula.id, tipo: 'whatsapp', status: 'sem_telefone' })
        continue
      }

      const horarioFmt = (aula.horario ?? '').substring(0, 5)
      const nomeAluno  = aluno?.nome ?? 'aluno'
      const nomeProf   = prof?.nome  ?? 'seu professor'

      let mensagem =
        `Olá, ${nomeAluno}! 👋\n\n` +
        `⏰ Sua aula começa em *25 minutos* (às ${horarioFmt}).\n\n` +
        `📚 Se prepare! Pegue papel, caneta e o material necessário.\n\n` +
        `👨‍🏫 Professor(a): *${nomeProf}*`

      if (aula.link_meet) {
        mensagem += `\n\n🔗 Link para entrar na aula:\n${aula.link_meet}`
      }

      mensagem += `\n\n_Click do Saber_`

      await enviarWhatsApp(telefone, mensagem)

      await db.from('agenda_meet').update({ lembrete_whatsapp_enviado: true }).eq('id', aula.id)
      console.log(`WhatsApp enviado — ${normalizarTelefone(telefone)} — aula ${aula.id}`)
      results.push({ id: aula.id, tipo: 'whatsapp', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp aula ${aula.id}:`, msg)
      results.push({ id: aula.id, tipo: 'whatsapp', status: 'erro', erro: msg })
    }
  }

  // ── Envia WHATSAPP 10 min (aluno) ────────────────────────────
  for (const aula of (aulasZap10 || [])) {
    try {
      const [{ data: aluno }, { data: alunoInfo }, { data: prof }] = await Promise.all([
        db.from('usuarios').select('nome').eq('id', aula.aluno_id).single(),
        db.from('alunos_info').select('telefone_aluno').eq('usuario_id', aula.aluno_id).single(),
        db.from('usuarios').select('nome').eq('id', aula.professor_id).single()
      ])

      const telefone = alunoInfo?.telefone_aluno
      if (!telefone) {
        await db.from('agenda_meet').update({ lembrete_whatsapp_10min_enviado: true }).eq('id', aula.id)
        results.push({ id: aula.id, tipo: 'whatsapp10', status: 'sem_telefone' })
        continue
      }

      const horarioFmt = (aula.horario ?? '').substring(0, 5)
      const nomeAluno  = aluno?.nome ?? 'aluno'
      const nomeProf   = prof?.nome  ?? 'seu professor'

      let mensagem =
        `⚡ ${nomeAluno}, sua aula começa em *10 minutos* (às ${horarioFmt})!\n\n` +
        `👨‍🏫 Professor(a): *${nomeProf}*`

      if (aula.link_meet) {
        mensagem += `\n\n🔗 Entre agora:\n${aula.link_meet}`
      }

      mensagem += `\n\n_Click do Saber_`

      await enviarWhatsApp(telefone, mensagem)

      await db.from('agenda_meet').update({ lembrete_whatsapp_10min_enviado: true }).eq('id', aula.id)
      console.log(`WhatsApp 10min enviado — ${normalizarTelefone(telefone)} — aula ${aula.id}`)
      results.push({ id: aula.id, tipo: 'whatsapp10', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp 10min aula ${aula.id}:`, msg)
      results.push({ id: aula.id, tipo: 'whatsapp10', status: 'erro', erro: msg })
    }
  }

  const emailEnviados  = results.filter(r => r.tipo === 'email'      && r.status === 'enviado').length
  const zapEnviados    = results.filter(r => r.tipo === 'whatsapp'   && r.status === 'enviado').length
  const zap10Enviados  = results.filter(r => r.tipo === 'whatsapp10' && r.status === 'enviado').length
  console.log(`Concluído — emails: ${emailEnviados}, whatsapp25: ${zapEnviados}, whatsapp10: ${zap10Enviados}`)

  return new Response(
    JSON.stringify({ emailEnviados, zapEnviados, zap10Enviados, total: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
