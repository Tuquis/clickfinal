import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ZAPI_INSTANCE_ID  = Deno.env.get('ZAPI_INSTANCE_ID')!;
const ZAPI_TOKEN        = Deno.env.get('ZAPI_TOKEN')!;
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendZap(phone: string, message: string) {
    const num = phone.replace(/\D/g, '');
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: num, message }),
    });
    return res.ok;
}

serve(async (req) => {
    try {
        const { atividadeId } = await req.json();
        if (!atividadeId) return new Response(JSON.stringify({ error: 'atividadeId obrigatório' }), { status: 400 });

        // Busca atividade com nome do aluno e do professor
        const { data: atividade, error: aErr } = await supabase
            .from('atividades')
            .select(`
                id, titulo, prazo, aluno_id,
                aluno:usuarios!atividades_aluno_id_fkey(nome),
                professor:usuarios!atividades_professor_id_fkey(nome)
            `)
            .eq('id', atividadeId)
            .single();

        if (aErr || !atividade) {
            return new Response(JSON.stringify({ error: 'Atividade não encontrada', detail: aErr }), { status: 404 });
        }

        const alunoId    = atividade.aluno_id;
        const alunoNome  = atividade.aluno?.nome || 'Aluno';
        const profNome   = atividade.professor?.nome || 'Professor';
        const titulo     = atividade.titulo || 'Nova atividade';
        const prazo      = atividade.prazo
            ? new Date(atividade.prazo + 'T12:00:00').toLocaleDateString('pt-BR')
            : null;

        // Busca telefone do aluno — usa telefone_aluno, fallback para telefone (responsável)
        const { data: alunoInfo } = await supabase
            .from('alunos_info')
            .select('telefone_aluno, telefone')
            .eq('usuario_id', alunoId)
            .single();

        const telefone = alunoInfo?.telefone_aluno || alunoInfo?.telefone;
        if (!telefone) {
            return new Response(JSON.stringify({ ok: false, motivo: 'aluno sem telefone cadastrado', alunoId }), { status: 200 });
        }

        const primeiroNome = alunoNome.split(' ')[0];
        const prazoLinha   = prazo ? `\n📅 Prazo: *${prazo}*` : '';

        const msg =
            `📚 Olá, *${primeiroNome}*! Você tem uma nova atividade no Click do Saber!\n\n` +
            `📝 *${titulo}*${prazoLinha}\n` +
            `👨‍🏫 Professor(a): ${profNome}\n\n` +
            `Entre no portal, resolva e envie a foto da resolução!\n` +
            `🔗 https://dashboardclick.vercel.app`;

        const enviado = await sendZap(telefone, msg);

        return new Response(JSON.stringify({ ok: enviado, alunoId, telefone }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
