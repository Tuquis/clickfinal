// ============================================================
// SUPABASE EDGE FUNCTION: notificar-aula
// Envia email para o professor quando uma aula é agendada
//
// Serviço de email: Resend (resend.com) — gratuito até 3.000/mês
// Deploy: supabase functions deploy notificar-aula
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL     = Deno.env.get('EMAIL_FROM') || 'noreply@ensinoclick.com.br';
const APP_NAME       = 'Ensinoclick';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dia     = DIAS_SEMANA[d.getDay()];
    const dayNum  = d.getDate().toString().padStart(2, '0');
    const months  = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    return `${dia}, ${dayNum} de ${months[month - 1]} de ${year}`;
}

function formatTime(timeStr: string): string {
    return timeStr ? timeStr.substring(0, 5) : '';
}

function buildEmailHtml(data: {
    professor_nome: string;
    aluno_nome: string;
    data_aula: string;
    horario: string;
    conteudo: string;
    link_meet: string | null;
    disciplina: string | null;
    serie: string | null;
}): string {
    const dataFormatada = formatDate(data.data_aula);
    const horario       = formatTime(data.horario);

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Nova Aula Agendada — ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);border:1px solid #ede9fe;">

    <!-- cabeçalho -->
    <div style="background:#7c3aed;padding:28px 32px;text-align:center;">
      <div style="font-size:28px;margin-bottom:6px;">📅</div>
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-.02em;">Nova Aula Agendada</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">${APP_NAME}</p>
    </div>

    <!-- corpo -->
    <div style="padding:28px 32px;">

      <p style="font-size:15px;color:#1a1a1a;margin:0 0 20px;">
        Olá, <strong>${data.professor_nome}</strong>! Uma nova aula foi agendada para você.
      </p>

      <!-- card de detalhes -->
      <div style="background:#f5f3ff;border-radius:8px;padding:20px 22px;border-left:4px solid #7c3aed;margin-bottom:24px;">

        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <span style="font-size:18px;">👤</span>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8b80a8;">Aluno</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a1a;">${data.aluno_nome}</div>
            ${data.disciplina || data.serie ? `<div style="font-size:12px;color:#8b80a8;">${[data.serie, data.disciplina].filter(Boolean).join(' — ')}</div>` : ''}
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <span style="font-size:18px;">📆</span>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8b80a8;">Data</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a1a;">${dataFormatada}</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <span style="font-size:18px;">🕐</span>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8b80a8;">Horário</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a1a;">${horario}</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:18px;">📝</span>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8b80a8;margin-bottom:4px;">Conteúdo da Aula</div>
            <div style="font-size:14px;color:#3d3750;line-height:1.6;background:#ffffff;border-radius:6px;padding:10px 12px;border:1px solid #ede9fe;">${data.conteudo.replace(/\n/g, '<br/>')}</div>
          </div>
        </div>

      </div>

      <!-- botão Meet -->
      ${data.link_meet ? `
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${data.link_meet}"
           style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:-.01em;">
          📹 Entrar no Google Meet
        </a>
      </div>` : `
      <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#a16207;">
        ⚠ Nenhum link de Meet foi informado ainda. Lembre-se de adicionar o link antes da aula.
      </div>`}

      <p style="font-size:13px;color:#8b80a8;text-align:center;margin:0;">
        Acesse a plataforma para ver mais detalhes ou lançar relatório após a aula.
      </p>
    </div>

    <!-- rodapé -->
    <div style="background:#f5f3ff;padding:16px 32px;text-align:center;border-top:1px solid #ede9fe;">
      <p style="font-size:11px;color:#8b80a8;margin:0;">${APP_NAME} · Este é um email automático, não responda.</p>
    </div>

  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
    // Aceita apenas POST
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // Validação de chave secreta simples (opcional, mas recomendado)
    const authHeader = req.headers.get('x-app-secret');
    const APP_SECRET = Deno.env.get('APP_SECRET');
    if (APP_SECRET && authHeader !== APP_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let body: { agenda_id: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    if (!body.agenda_id) {
        return new Response(JSON.stringify({ error: 'agenda_id obrigatório' }), { status: 400 });
    }

    // Buscar dados da aula com email do professor
    const { data: aula, error: aulaErr } = await supabase
        .from('v_agenda_completa')
        .select('*, professor_id, aluno_id')
        .eq('id', body.agenda_id)
        .single();

    if (aulaErr || !aula) {
        return new Response(JSON.stringify({ error: 'Aula não encontrada' }), { status: 404 });
    }

    // Buscar email do professor
    const { data: prof, error: profErr } = await supabase
        .from('usuarios')
        .select('email, nome')
        .eq('id', aula.professor_id)
        .single();

    if (profErr || !prof?.email) {
        return new Response(JSON.stringify({ error: 'Professor sem email cadastrado' }), { status: 400 });
    }

    // Montar e enviar email via Resend
    const html = buildEmailHtml({
        professor_nome: aula.professor_nome,
        aluno_nome:     aula.aluno_nome,
        data_aula:      aula.data,
        horario:        aula.horario,
        conteudo:       aula.conteudo,
        link_meet:      aula.link_meet || null,
        disciplina:     aula.disciplina || null,
        serie:          aula.serie || null,
    });

    const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({
            from:    `${APP_NAME} <${FROM_EMAIL}>`,
            to:      [prof.email],
            subject: `📅 Nova aula agendada — ${aula.aluno_nome} — ${formatDate(aula.data)}`,
            html,
        }),
    });

    if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('Resend error:', errText);
        return new Response(JSON.stringify({ error: 'Falha ao enviar email', detail: errText }), { status: 500 });
    }

    const emailData = await emailRes.json();
    console.log('Email enviado:', emailData.id);

    return new Response(
        JSON.stringify({ success: true, email_id: emailData.id, to: prof.email }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
});
