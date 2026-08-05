import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enviarTemplate, enviarDocumentoTemplateBase64 } from '../_shared/meta.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const NUMERO_ADMIN = '5575988411649';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const META_LABELS: Record<string,string> = { sim:'Sim — meta totalmente atingida', parcialmente:'Parcialmente atingida', nao:'Não atingida' };

function lbl(map: Record<string,string>, k: string) { return k ? (map[k] || k) : '—'; }
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

async function sendText(params: string[]) {
  try {
    await enviarTemplate(NUMERO_ADMIN, 'relatorio_pos_aula', params);
    return true;
  } catch (e) {
    console.error('Meta API error (texto):', e);
    return false;
  }
}

async function sendPDF(b64: string, filename: string) {
  try {
    await enviarDocumentoTemplateBase64(NUMERO_ADMIN, 'relatorio_pdf_documento', b64, filename);
    return true;
  } catch (e) {
    console.error('Meta API error (pdf):', e);
    return false;
  }
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

    await sendText([
      fmtDatetime(r.created_at),
      profNome,
      alunoNome,
      lbl(META_LABELS, r.meta_atingida)
    ]);
    return new Response(JSON.stringify({ ok: true, tipo: 'texto', profNome, alunoNome }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch(e) {
    console.error('notify-relatorio:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
