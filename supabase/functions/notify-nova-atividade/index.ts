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

        const primeiroNome = alunoNome.split(' ')[0];
        const params = [primeiroNome, titulo, prazo || '—', profNome];

        // Cópia para o mentor/suporte — independe do telefone do aluno
        const mentorEnviado = await sendTemplate(NUMERO_MENTOR, 'nova_atividade_aluno', params);

        // Busca telefone do aluno — usa telefone_aluno, fallback para telefone (responsável)
        const { data: alunoInfo } = await supabase
            .from('alunos_info')
            .select('telefone_aluno, telefone')
            .eq('usuario_id', alunoId)
            .single();

        const telefone = alunoInfo?.telefone_aluno || alunoInfo?.telefone;
        if (!telefone) {
            return new Response(JSON.stringify({ ok: false, motivo: 'aluno sem telefone cadastrado', alunoId, mentorEnviado }), { status: 200 });
        }

        const enviado = await sendTemplate(telefone, 'nova_atividade_aluno', params);

        return new Response(JSON.stringify({ ok: enviado, alunoId, telefone, mentorEnviado }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
