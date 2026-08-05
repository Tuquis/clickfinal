// @ts-nocheck
// ============================================================
// EDGE FUNCTION: send-class-reminders
// Disparada a cada minuto pelo pg_cron.
// - Email ao professor: ~30 min antes
// - WhatsApp: templates via API oficial da Meta
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enviarTemplate, normalizarTelefone } from '../_shared/meta.ts'

// ── Variáveis de ambiente ────────────────────────────────────
const EMAILJS_SERVICE_ID   = Deno.env.get('EMAILJS_SERVICE_ID')!
const EMAILJS_TEMPLATE_ID  = Deno.env.get('EMAILJS_REMINDER_TEMPLATE_ID')!
const EMAILJS_PUBLIC_KEY   = Deno.env.get('EMAILJS_PUBLIC_KEY')!
const EMAILJS_PRIVATE_KEY  = Deno.env.get('EMAILJS_PRIVATE_KEY')!
const CRON_SECRET          = Deno.env.get('CRON_SECRET')!

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


// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (secret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()
  const { date: today, time: nowTimeSP } = toSaoPaulo(now)

  // Janela email + WhatsApp professor: 28–32 min (alvo 30 min)
  const { time: h28 } = toSaoPaulo(new Date(now.getTime() + 28 * 60_000))
  const { time: h32 } = toSaoPaulo(new Date(now.getTime() + 32 * 60_000))

  // Janela WhatsApp aluno 25 min: 23–27 min
  const { time: h23 } = toSaoPaulo(new Date(now.getTime() + 23 * 60_000))
  const { time: h27 } = toSaoPaulo(new Date(now.getTime() + 27 * 60_000))

  // Janela WhatsApp aluno 10 min: 8–12 min
  const { time: h8  } = toSaoPaulo(new Date(now.getTime() +  8 * 60_000))
  const { time: h12 } = toSaoPaulo(new Date(now.getTime() + 12 * 60_000))

  // Janela bom dia: 07:58–08:02
  const isMorningWindow = nowTimeSP >= '07:58' && nowTimeSP <= '08:02'

  console.log(`Rodando — hoje: ${today} | agora: ${nowTimeSP} | email+zapProf: ${h28}–${h32} | zap25: ${h23}–${h27} | zap10: ${h8}–${h12} | manhã: ${isMorningWindow}`)

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

  // ── Busca aulas para WHATSAPP professor (30 min) ──────────────
  const { data: aulasZapProf } = await db
    .from('agenda_meet')
    .select('id, data, horario, link_meet, professor_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_whatsapp_prof_enviado', false)
    .gte('horario', h28)
    .lte('horario', h32)

  // ── Busca consultas psico para WHATSAPP 10 min (psicopedagoga) ─
  const { data: consultasZap10 } = await db
    .from('agenda_psico')
    .select('id, data, horario, link_meet, psico_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_whatsapp_10min_enviado', false)
    .gte('horario', h8)
    .lte('horario', h12)

  // ── Busca consultas psico para WHATSAPP 30 min (responsável do aluno) ─
  const { data: consultasZap30Resp } = await db
    .from('agenda_psico')
    .select('id, data, horario, link_meet, psico_id, aluno_id')
    .eq('data', today)
    .eq('status', 'agendada')
    .eq('lembrete_whatsapp_30min_responsavel_enviado', false)
    .gte('horario', h28)
    .lte('horario', h32)

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

      // Template aprovado no idioma "en" por engano — corrigir aqui até resubmeter no painel
      await enviarTemplate(telefone, 'lembrete_aula_25min_aluno', [nomeAluno, horarioFmt, nomeProf, aula.link_meet || 'Ainda não informado'], 'en')

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

      await enviarTemplate(telefone, 'lembrete_aula_10min_aluno', [nomeAluno, horarioFmt, nomeProf, aula.link_meet || 'Ainda não informado'])

      await db.from('agenda_meet').update({ lembrete_whatsapp_10min_enviado: true }).eq('id', aula.id)
      console.log(`WhatsApp 10min enviado — ${normalizarTelefone(telefone)} — aula ${aula.id}`)
      results.push({ id: aula.id, tipo: 'whatsapp10', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp 10min aula ${aula.id}:`, msg)
      results.push({ id: aula.id, tipo: 'whatsapp10', status: 'erro', erro: msg })
    }
  }

  // ── Envia WHATSAPP professor (30 min) ────────────────────────
  for (const aula of (aulasZapProf || [])) {
    try {
      const [{ data: prof }, { data: profInfo }, { data: aluno }, { data: alunoInfo }] = await Promise.all([
        db.from('usuarios').select('nome').eq('id', aula.professor_id).single(),
        db.from('professores_info').select('telefone').eq('usuario_id', aula.professor_id).single(),
        db.from('usuarios').select('nome').eq('id', aula.aluno_id).single(),
        db.from('alunos_info').select('serie, disciplina').eq('usuario_id', aula.aluno_id).single()
      ])

      const telefone = profInfo?.telefone
      if (!telefone) {
        await db.from('agenda_meet').update({ lembrete_whatsapp_prof_enviado: true }).eq('id', aula.id)
        results.push({ id: aula.id, tipo: 'whatsappProf', status: 'sem_telefone' })
        continue
      }

      const horarioFmt = (aula.horario ?? '').substring(0, 5)
      const nomeAluno  = aluno?.nome         ?? 'aluno'
      const disciplina = alunoInfo?.disciplina ?? '—'

      await enviarTemplate(telefone, 'lembrete_aula_30min_professor', [horarioFmt, nomeAluno, disciplina, aula.link_meet || 'Ainda não informado'])

      await db.from('agenda_meet').update({ lembrete_whatsapp_prof_enviado: true }).eq('id', aula.id)
      console.log(`WhatsApp professor enviado — ${normalizarTelefone(telefone)} — aula ${aula.id}`)
      results.push({ id: aula.id, tipo: 'whatsappProf', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp professor aula ${aula.id}:`, msg)
      results.push({ id: aula.id, tipo: 'whatsappProf', status: 'erro', erro: msg })
    }
  }

  // ── Envia WHATSAPP 10 min (psicopedagoga) ────────────────────
  for (const consulta of (consultasZap10 || [])) {
    try {
      const [{ data: psico }, { data: psicoInfo }, { data: aluno }] = await Promise.all([
        db.from('usuarios').select('nome').eq('id', consulta.psico_id).single(),
        db.from('psico_info').select('telefone').eq('usuario_id', consulta.psico_id).single(),
        db.from('usuarios').select('nome').eq('id', consulta.aluno_id).single()
      ])

      const telefone = psicoInfo?.telefone
      if (!telefone) {
        await db.from('agenda_psico').update({ lembrete_whatsapp_10min_enviado: true }).eq('id', consulta.id)
        results.push({ id: consulta.id, tipo: 'zapPsico10', status: 'sem_telefone' })
        continue
      }

      const horarioFmt  = (consulta.horario ?? '').substring(0, 5)
      const nomePsico   = psico?.nome  ?? 'Psicopedagoga'
      const primeiroNome = nomePsico.split(' ')[0]
      const nomeAluno   = aluno?.nome  ?? 'aluno'

      // Template aprovado no idioma "pt_PT" (não pt_BR) — corrigir aqui até resubmeter no painel
      await enviarTemplate(telefone, 'lembrete_consulta_10min_psico', [primeiroNome, horarioFmt, nomeAluno, consulta.link_meet || 'Ainda não informado'], 'pt_PT')
      await db.from('agenda_psico').update({ lembrete_whatsapp_10min_enviado: true }).eq('id', consulta.id)
      console.log(`WhatsApp psico 10min enviado — ${normalizarTelefone(telefone)} — consulta ${consulta.id}`)
      results.push({ id: consulta.id, tipo: 'zapPsico10', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp psico 10min ${consulta.id}:`, msg)
      results.push({ id: consulta.id, tipo: 'zapPsico10', status: 'erro', erro: msg })
    }
  }

  // ── Envia WHATSAPP 30 min (responsável do aluno — consulta psico) ──
  for (const consulta of (consultasZap30Resp || [])) {
    try {
      const [{ data: aluno }, { data: alunoInfo }, { data: psico }] = await Promise.all([
        db.from('usuarios').select('nome').eq('id', consulta.aluno_id).single(),
        db.from('alunos_info').select('responsavel, telefone').eq('usuario_id', consulta.aluno_id).single(),
        db.from('usuarios').select('nome').eq('id', consulta.psico_id).single()
      ])

      const telefone         = alunoInfo?.telefone
      const nomeResponsavel  = alunoInfo?.responsavel || 'Responsável'
      const primeiroNome     = nomeResponsavel.split(' ')[0]
      const nomeAluno        = aluno?.nome ?? 'aluno'
      const nomePsico        = psico?.nome ?? 'psicopedagoga'
      const horarioFmt       = (consulta.horario ?? '').substring(0, 5)

      if (!telefone) {
        await db.from('agenda_psico').update({ lembrete_whatsapp_30min_responsavel_enviado: true }).eq('id', consulta.id)
        results.push({ id: consulta.id, tipo: 'zapPsico30Resp', status: 'sem_telefone' })
        continue
      }

      await enviarTemplate(telefone, 'lembrete_consulta_30min_responsavel', [primeiroNome, nomeAluno, nomePsico, horarioFmt, consulta.link_meet || 'Ainda não informado'])
      await db.from('agenda_psico').update({ lembrete_whatsapp_30min_responsavel_enviado: true }).eq('id', consulta.id)
      console.log(`WhatsApp 30min responsável enviado — ${normalizarTelefone(telefone)} — consulta ${consulta.id}`)
      results.push({ id: consulta.id, tipo: 'zapPsico30Resp', status: 'enviado', para: normalizarTelefone(telefone) })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Erro WhatsApp 30min responsável ${consulta.id}:`, msg)
      results.push({ id: consulta.id, tipo: 'zapPsico30Resp', status: 'erro', erro: msg })
    }
  }

  // ── Bom dia para professores com aula hoje (08:00) ───────────
  if (isMorningWindow) {
    // Busca todos os professor_id distintos com aula agendada hoje
    const { data: aulasHoje } = await db
      .from('agenda_meet')
      .select('professor_id')
      .eq('data', today)
      .eq('status', 'agendada')

    const profIds = [...new Set((aulasHoje || []).map((a: any) => a.professor_id).filter(Boolean))]

    for (const profId of profIds) {
      try {
        const [{ data: prof }, { data: profInfo }] = await Promise.all([
          db.from('usuarios').select('nome').eq('id', profId).single(),
          db.from('professores_info').select('telefone, lembrete_manha_data').eq('usuario_id', profId).single()
        ])

        if (!profInfo?.telefone) continue
        // Já enviou hoje — pula
        if (profInfo.lembrete_manha_data === today) continue

        const nomeProf = prof?.nome ?? 'Professor'
        const primeiroNome = nomeProf.split(' ')[0]

        await enviarTemplate(profInfo.telefone, 'bom_dia_professor', [primeiroNome])
        await db.from('professores_info').update({ lembrete_manha_data: today }).eq('usuario_id', profId)

        console.log(`Bom dia enviado — professor ${nomeProf}`)
        results.push({ tipo: 'bomDia', status: 'enviado', professor: nomeProf })

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Erro bom dia professor ${profId}:`, msg)
        results.push({ tipo: 'bomDia', status: 'erro', erro: msg })
      }
    }

    // ── Bom dia para psicopedagogas com consulta hoje ──────────
    const { data: consultasHoje } = await db
      .from('agenda_psico')
      .select('psico_id')
      .eq('data', today)
      .eq('status', 'agendada')

    const psicoIds = [...new Set((consultasHoje || []).map((c: any) => c.psico_id).filter(Boolean))]

    for (const psicoId of psicoIds) {
      try {
        const [{ data: psico }, { data: psicoInfo }] = await Promise.all([
          db.from('usuarios').select('nome').eq('id', psicoId).single(),
          db.from('psico_info').select('telefone, lembrete_manha_data').eq('usuario_id', psicoId).single()
        ])

        if (!psicoInfo?.telefone) continue
        if (psicoInfo.lembrete_manha_data === today) continue

        const nomePsico    = psico?.nome ?? 'Psicopedagoga'
        const primeiroNome = nomePsico.split(' ')[0]

        await enviarTemplate(psicoInfo.telefone, 'bom_dia_psico', [primeiroNome])
        await db.from('psico_info').update({ lembrete_manha_data: today }).eq('usuario_id', psicoId)

        console.log(`Bom dia psico enviado — ${nomePsico}`)
        results.push({ tipo: 'bomDiaPsico', status: 'enviado', psico: nomePsico })

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Erro bom dia psico ${psicoId}:`, msg)
        results.push({ tipo: 'bomDiaPsico', status: 'erro', erro: msg })
      }
    }
  }

  const emailEnviados        = results.filter(r => r.tipo === 'email'           && r.status === 'enviado').length
  const zapEnviados          = results.filter(r => r.tipo === 'whatsapp'        && r.status === 'enviado').length
  const zap10Enviados        = results.filter(r => r.tipo === 'whatsapp10'      && r.status === 'enviado').length
  const zapProfEnviados      = results.filter(r => r.tipo === 'whatsappProf'    && r.status === 'enviado').length
  const bomDiaEnviados       = results.filter(r => r.tipo === 'bomDia'          && r.status === 'enviado').length
  const zapPsico10Enviados   = results.filter(r => r.tipo === 'zapPsico10'      && r.status === 'enviado').length
  const bomDiaPsicoEnv       = results.filter(r => r.tipo === 'bomDiaPsico'     && r.status === 'enviado').length
  const zapPsico30RespEnv    = results.filter(r => r.tipo === 'zapPsico30Resp'  && r.status === 'enviado').length
  console.log(`Concluído — emails: ${emailEnviados}, zap25: ${zapEnviados}, zap10: ${zap10Enviados}, zapProf: ${zapProfEnviados}, bomDia: ${bomDiaEnviados}, psico10: ${zapPsico10Enviados}, bomDiaPsico: ${bomDiaPsicoEnv}, psico30Resp: ${zapPsico30RespEnv}`)

  return new Response(
    JSON.stringify({ emailEnviados, zapEnviados, zap10Enviados, zapProfEnviados, bomDiaEnviados, zapPsico10Enviados, bomDiaPsicoEnv, zapPsico30RespEnv, total: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
