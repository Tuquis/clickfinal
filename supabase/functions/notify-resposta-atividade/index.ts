import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enviarTemplate } from '../_shared/meta.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mesmo número que já recebe os relatórios pós-aula (notify-relatorio)
const NUMERO_MENTOR = '5575988411649';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendTemplate(phone: string, templateName: string, params: string[]) {
    try {
        await enviarTemplate(phone, templateName, params);
        return true;
    } catch (e) {
        console.error('Meta API error:', e);
        return false;
    }
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
        const params      = [alunoNome, atTitulo];

        // Cópia para o mentor/suporte — independe do telefone do professor
        const mentorEnviado = await sendTemplate(NUMERO_MENTOR, 'resposta_atividade_professor', params);

        if (!professorId) {
            return new Response(JSON.stringify({ ok: false, motivo: 'atividade sem professor_id', mentorEnviado }), { status: 200 });
        }

        // Busca telefone do professor (coluna é usuario_id, não professor_id)
        const { data: profInfo } = await supabase
            .from('professores_info').select('telefone').eq('usuario_id', professorId).single();

        const telefone = profInfo?.telefone;
        if (!telefone) {
            return new Response(JSON.stringify({ ok: false, motivo: 'professor sem telefone cadastrado', professorId, mentorEnviado }), { status: 200 });
        }

        const enviado = await sendTemplate(telefone, 'resposta_atividade_professor', params);

        return new Response(JSON.stringify({ ok: enviado, professorId, telefone, mentorEnviado }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
