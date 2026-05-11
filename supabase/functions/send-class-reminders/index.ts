// @ts-nocheck
// ============================================================
// EDGE FUNCTION: send-class-reminders
// Disparada a cada minuto pelo pg_cron.
// Busca aulas que começam em ~30 minutos e envia email ao professor.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Variáveis de ambiente (configuradas no painel do Supabase)
const EMAILJS_SERVICE_ID   = Deno.env.get('EMAILJS_SERVICE_ID')!
const EMAILJS_TEMPLATE_ID  = Deno.env.get('EMAILJS_REMINDER_TEMPLATE_ID')!
const EMAILJS_PUBLIC_KEY   = Deno.env.get('EMAILJS_PUBLIC_KEY')!
const EMAILJS_PRIVATE_KEY  = Deno.env.get('EMAILJS_PRIVATE_KEY')!
const CRON_SECRET          = Deno.env.get('CRON_SECRET')!

// Injetadas automaticamente pelo Supabase
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

// Retorna data e hora no fuso America/Sao_Paulo (UTC-3, sem DST desde 2019)
function toSaoPaulo(d: Date): { date: string; time: string } {
  const str = d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  // sv-SE produz "YYYY-MM-DD HH:MM:SS"
  const [date, timeStr] = str.split(' ')
  return { date, time: timeStr.substring(0, 5) }
}

Deno.serve(async (req) => {
  // Autenticação: apenas o pg_cron (com o segredo) pode chamar esta função
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (secret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Janela de tempo: aulas que começam entre now+28min e now+32min (hora local BRT)
  const now = new Date()
  const { date: today } = toSaoPaulo(now)
  const { time: h28 }   = toSaoPaulo(new Date(now.getTime() + 28 * 60_000))
  const { time: h32 }   = toSaoPaulo(new Date(now.getTime() + 32 * 60_000))

  console.log(`Verificando lembretes — hoje: ${today}, janela: ${h28}–${h32}`)

  // Busca aulas agendadas na janela que ainda não receberam lembrete
  const { data: aulas, error: dbErr } = await db
    .from('agenda_meet')
    .select(`
      id,
      data,
      horario,
      conteudo,
      link_meet,
      professor_id,
      aluno_id
    `)
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_enviado', false)
    .gte('horario', h28)
    .lte('horario', h32)

  if (dbErr) {
    console.error('Erro ao buscar aulas:', dbErr)
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 })
  }

  if (!aulas || aulas.length === 0) {
    console.log('Nenhuma aula para lembrar agora.')
    return new Response(JSON.stringify({ enviados: 0 }), { status: 200 })
  }

  console.log(`${aulas.length} aula(s) encontrada(s) para lembrete.`)

  const results: Array<{ id: string; status: string; para?: string }> = []

  for (const aula of aulas) {
    try {
      // Busca dados do professor
      const { data: prof, error: profErr } = await db
        .from('usuarios')
        .select('email, nome')
        .eq('id', aula.professor_id)
        .single()

      if (profErr || !prof?.email) {
        console.warn(`Professor sem email — aula ${aula.id}`)
        results.push({ id: aula.id, status: 'sem_email' })
        continue
      }

      // Busca nome do aluno
      const { data: aluno } = await db
        .from('usuarios')
        .select('nome')
        .eq('id', aula.aluno_id)
        .single()

      // Busca disciplina/série do aluno
      const { data: alunoInfo } = await db
        .from('alunos_info')
        .select('serie, disciplina')
        .eq('usuario_id', aula.aluno_id)
        .single()

      // Formata data em pt-BR
      const dataObj      = new Date(aula.data + 'T00:00:00')
      const dataFormatada = `${DIAS[dataObj.getDay()]}, ${dataObj.getDate()} de ${MESES[dataObj.getMonth()]} de ${dataObj.getFullYear()}`

      // Envia email via EmailJS REST API
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
            aluno_nome:     aluno?.nome     ?? '',
            disciplina:     alunoInfo?.disciplina ?? '',
            serie:          alunoInfo?.serie      ?? '',
            data_aula:      dataFormatada,
            horario:        (aula.horario ?? '').substring(0, 5),
            conteudo:       aula.conteudo  ?? '',
            link_meet:      aula.link_meet ?? 'Não informado ainda',
          }
        })
      })

      if (!emailResp.ok) {
        const body = await emailResp.text()
        throw new Error(`EmailJS ${emailResp.status}: ${body}`)
      }

      // Marca lembrete como enviado para não reenviar
      await db
        .from('agenda_meet')
        .update({ lembrete_enviado: true })
        .eq('id', aula.id)

      console.log(`Lembrete enviado — ${prof.email} — aula ${aula.id}`)
      results.push({ id: aula.id, status: 'enviado', para: prof.email })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Falha no lembrete da aula ${aula.id}:`, msg)
      results.push({ id: aula.id, status: 'erro' })
    }
  }

  const enviados = results.filter(r => r.status === 'enviado').length
  return new Response(
    JSON.stringify({ enviados, total: aulas.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
