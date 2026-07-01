import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ZAPI_INSTANCE_ID   = Deno.env.get('ZAPI_INSTANCE_ID')!;
const ZAPI_TOKEN         = Deno.env.get('ZAPI_TOKEN')!;
const ZAPI_CLIENT_TOKEN  = Deno.env.get('ZAPI_CLIENT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendZap(phone: string, message: string) {
    const num = phone.replace(/\D/g, '');
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const res = await fetch(url, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Client-Token':  ZAPI_CLIENT_TOKEN,
        },
        body: JSON.stringify({ phone: num, message }),
    });
    return res.ok;
}

serve(async (req) => {
    try {
        const { respostaId } = await req.json();
        if (!respostaId) return new Response(JSON.stringify({ error: 'respostaId obrigatório' }), { status: 400 });

        // Busca a resposta com dados do aluno e da atividade (que traz o professor)
        const { data: resposta, error: rErr } = await supabase
            .from('respostas_atividades')
            .select(`
                id,
                aluno:usuarios!respostas_atividades_aluno_id_fkey(nome),
                atividade:atividades!respostas_atividades_atividade_id_fkey(id, titulo, professor_id)
            `)
            .eq('id', respostaId)
            .single();

        if (rErr || !resposta) {
            return new Response(JSON.stringify({ error: 'Resposta não encontrada', detail: rErr }), { status: 404 });
        }

        const professorId = resposta.atividade?.professor_id;
        const alunoNome   = resposta.aluno?.nome || 'Aluno';
        const atTitulo    = resposta.atividade?.titulo || 'atividade';

        if (!professorId) {
            return new Response(JSON.stringify({ ok: false, motivo: 'atividade sem professor_id' }), { status: 200 });
        }

        // Busca telefone e nome do professor (coluna é usuario_id, não professor_id)
        const [profInfoRes, profUserRes] = await Promise.all([
            supabase.from('professores_info').select('telefone').eq('usuario_id', professorId).single(),
            supabase.from('usuarios').select('nome').eq('id', professorId).single(),
        ]);

        const telefone = profInfoRes.data?.telefone;
        if (!telefone) {
            return new Response(JSON.stringify({ ok: false, motivo: 'professor sem telefone cadastrado', professorId }), { status: 200 });
        }

        const primeiroNome = profUserRes.data?.nome?.split(' ')[0] || 'Professor';

        const msg =
            `📝 *${alunoNome}* enviou uma resposta para a atividade *${atTitulo}*!\n\n` +
            `Acesse o painel para visualizar e corrigir:\nhttps://dashboardclick.vercel.app`;

        const enviado = await sendZap(telefone, msg);

        return new Response(JSON.stringify({ ok: enviado, professorId, telefone }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
