import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ZAPI_INSTANCE_ID  = Deno.env.get('ZAPI_INSTANCE_ID')!;
const ZAPI_TOKEN        = Deno.env.get('ZAPI_TOKEN')!;
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')!;

const NUMERO_ADMIN = '5575988411649';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const META_LABELS: Record<string,string> = { sim:'Sim — meta totalmente atingida', parcialmente:'Parcialmente atingida', nao:'Não atingida' };
const COMP_LABELS: Record<string,string> = { excelente:'Participou ativamente e demonstrou interesse', bom:'Participou com engajamento moderado', regular:'Precisou de estímulo para se concentrar', ruim:'Mostrou desânimo ou distração' };
const COMPR_LABELS: Record<string,string> = { excelente:'Compreendeu e aplicou com autonomia', boa:'Compreendeu com apoio, com pequenas dúvidas', regular:'Compreendeu parcialmente, precisa de reforço', baixa:'Baixa compreensão' };

function lbl(map: Record<string,string>, k: string) { return k ? (map[k] || k) : '—'; }
function norm(tel: string) {
  const d = tel.replace(/\D/g,'');
  if (d.startsWith('55') && (d.length===12||d.length===13)) return d;
  if (d.length===10||d.length===11) return '55'+d;
  return d;
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

async function sendText(msg: string) {
  const res = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Client-Token':ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone: norm(NUMERO_ADMIN), message: msg }),
  });
  return res.ok;
}

async function sendPDF(b64: string, filename: string) {
  const res = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-document/pdf`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Client-Token':ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({
      phone:    norm(NUMERO_ADMIN),
      document: `data:application/pdf;base64,${b64}`,
      fileName: filename,
      filename: filename,
      caption:  filename.replace('.pdf',''),
    }),
  });
  return res.ok;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const body = await req.json();

    // ── Modo PDF: enviado pelo cliente com o PDF já gerado ────────
    if (body.pdfBase64 && body.filename) {
      const ok = await sendPDF(body.pdfBase64, body.filename);
      return new Response(JSON.stringify({ ok, tipo: 'pdf' }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Modo texto: chamado pelo trigger do banco ─────────────────
    if (!body.relatorioId) {
      return new Response(JSON.stringify({ error: 'relatorioId ou pdfBase64 obrigatório' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { data: r, error } = await supabase
      .from('relatorios')
      .select(`*, aluno:usuarios!relatorios_aluno_id_fkey(nome), professor:usuarios!relatorios_professor_id_fkey(nome)`)
      .eq('id', body.relatorioId)
      .single();

    if (error || !r) return new Response(JSON.stringify({ error: 'Relatório não encontrado' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const profNome  = r.professor?.nome || 'Professor';
    const alunoNome = r.aluno?.nome     || 'Aluno';

    const msg =
      `📋 *Novo Relatório Pós Aula*\n\n` +
      `🕐 Emitido em: *${fmtDatetime(r.created_at)}*\n` +
      `👨‍🏫 Professor(a): *${profNome}*\n` +
      `👤 Aluno(a): *${alunoNome}*\n` +
      (r.disciplina_ministrada ? `📖 Disciplina: *${r.disciplina_ministrada}*\n` : '') +
      `🎯 Meta atingida: ${lbl(META_LABELS, r.meta_atingida)}\n` +
      `🧠 Compreensão: ${lbl(COMPR_LABELS, r.compreensao)}\n` +
      `🎓 Comportamento: ${lbl(COMP_LABELS, r.comportamento)}\n\n` +
      `📄 O relatório completo em PDF será enviado em seguida.`;

    await sendText(msg);
    return new Response(JSON.stringify({ ok: true, tipo: 'texto', profNome, alunoNome }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch(e) {
    console.error('notify-relatorio:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
