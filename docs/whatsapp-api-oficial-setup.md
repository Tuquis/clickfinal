# Migração para a API Oficial do WhatsApp (Meta Cloud API)

Guia completo, do zero, para sair de serviços não-oficiais (Z-API, CodeChat, W-API) e usar a API oficial da Meta — a mesma que WhatsApp Business usa internamente. Isso elimina o risco de banimento/restrição por "uso de automação", porque é o próprio WhatsApp fornecendo o canal.

## Diferença fundamental antes de começar

Com Z-API/W-API você mandava texto livre a qualquer hora. Com a API oficial:

- **Dentro de 24h desde a última mensagem que o cliente te mandou**: pode mandar texto livre normalmente.
- **Fora dessa janela de 24h** (é o nosso caso principal — avisos de agendamento, lembretes, notificações que a plataforma inicia): só pode mandar **Templates de Mensagem** pré-aprovados pela Meta — texto fixo com variáveis tipo `{{1}}`, `{{2}}`.

Ou seja, todas as nossas 15 mensagens (aula agendada, lembretes, chat, atividades, relatório) precisam virar templates aprovados antes de funcionar em produção. Vou cobrir isso na Parte 5.

---

## Parte 1 — Criar a conta e o App na Meta

1. Acesse [business.facebook.com](https://business.facebook.com) e crie (ou entre) na sua **Meta Business Suite** com uma conta de empresa (pode ser pessoa física no começo, mas para produção real vale verificar como empresa — ver Parte 3).

2. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus Apps** → **Criar App**.
   - Tipo de app: **Empresa** (Business).
   - Nome do app: algo como "Click do Saber".
   - Vincule à sua conta business criada no passo 1.

3. Dentro do app, na lista de produtos, adicione **WhatsApp**.
   - Isso cria automaticamente uma **WABA de teste** (WhatsApp Business Account), um **número de telefone de teste** (só pode mandar pra até 5 números verificados manualmente, útil só para validar o fluxo) e um **token de acesso temporário** (válido por 24h).

4. Na tela do produto WhatsApp → **API Setup**, você vai ver:
   - `Phone number ID` (do número de teste)
   - `WhatsApp Business Account ID`
   - Um token temporário (copie, mas ele expira em 24h — só serve pra teste rápido)

## Parte 2 — Teste rápido com o número de teste (opcional, mas recomendado)

Antes de configurar tudo em produção, valide o fluxo básico:

1. Na mesma tela **API Setup**, adicione seu próprio número na lista de "destinatários de teste" (precisa confirmar com um código recebido no WhatsApp).
2. Rode este curl (substitua `PHONE_NUMBER_ID` e `TEMP_TOKEN`):

```bash
curl -X POST "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer TEMP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5571992520624",
    "type": "text",
    "text": { "body": "Teste API oficial - Click do Saber" }
  }'
```

Isso só funciona porque você acabou de iniciar a conversa mandando uma mensagem de teste pro seu número através do painel (abre a janela de 24h). Em produção, esse tipo de texto livre não vai funcionar pra iniciar conversa — só depois de templates aprovados (Parte 5).

## Parte 3 — Número de telefone de produção

1. No **WhatsApp Manager** (dentro do app, aba "WhatsApp" → "Configuração da API" ou acessando [business.facebook.com/wa/manage](https://business.facebook.com/wa/manage)), clique em **Adicionar número de telefone**.
2. Esse número **não pode estar ativo no WhatsApp normal ou WhatsApp Business App** no momento — se já usa, precisa remover de lá primeiro (ou usar um número novo, dedicado, o que é mais simples e recomendado).
3. Escolha verificação por **SMS** ou **chamada de voz**, informe o código recebido.
4. Configure o **nome de exibição** (Display Name) — esse nome passa por uma revisão da Meta (pode levar de minutos a 1–2 dias). Use o nome real da empresa/marca ("Click do Saber"), nomes genéricos ou promocionais costumam ser rejeitados.

### Verificação de empresa (Business Verification)

Para tirar os limites baixos de mensageria (ver Parte 7) e ter o nome de exibição aprovado com mais confiança, vale completar a verificação de empresa em **Meta Business Suite → Configurações do Negócio → Verificação da Empresa** — pede CNPJ e documentos. Não é estritamente obrigatório pra começar a mandar mensagem, mas recomendado para uso contínuo de produção.

## Parte 4 — Token de acesso permanente (System User)

O token temporário da Parte 1 expira em 24h — inviável pra um sistema automatizado. Para um token que não expira:

1. Em **Meta Business Suite → Configurações do Negócio → Usuários → Usuários do Sistema**, clique em **Adicionar**.
2. Crie um usuário do sistema com papel **Admin**.
3. Em **Adicionar Ativos**, vincule esse usuário do sistema à sua **WABA** (WhatsApp Business Account) e ao **App** criados antes, com permissão total.
4. Gere um novo token para esse usuário do sistema, com as permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Esse token **não expira** (a menos que seja revogado manualmente) — é o que vamos usar nas Edge Functions, guardado como secret (`META_WHATSAPP_TOKEN`).

## Parte 5 — Criar os Templates de Mensagem

No **WhatsApp Manager → Modelos de Mensagem (Message Templates)**, crie um template para cada tipo de notificação. Categoria correta para todas as nossas mensagens: **Utilitário (Utility)** — são notificações transacionais (agendamento, lembrete, atividade), não marketing.

Exemplo de estrutura (o evento "aula agendada ao professor"):

- **Nome do template**: `aula_agendada_professor`
- **Categoria**: Utilitário
- **Idioma**: Português (BR)
- **Corpo**:
  ```
  📅 Nova aula agendada, {{1}}!

  👤 Aluno: {{2}}
  📚 Disciplina: {{3}}
  🗓 Data: {{4}}
  ⏰ Horário: {{5}}
  ```
- Variáveis `{{1}}`…`{{5}}` = primeiro nome do professor, nome do aluno, disciplina, data formatada, horário.

Repita esse processo para os outros 14 tipos de mensagem do nosso inventário (consulta psico agendada, lembretes 30/25/10min, bom-dia, chat, atividade nova, resposta de atividade, relatório). Cada template precisa ser **submetido e aprovado** pela Meta — normalmente rápido (minutos a algumas horas), mas pode demorar até 24h.

**Eu posso escrever o texto de todos os 15 templates pra você só copiar e colar no WhatsApp Manager** — me avisa quando tiver acesso lá que eu preparo isso.

## Parte 6 — Configurar o Webhook (opcional, recomendado)

Serve para receber confirmação de entrega/leitura e mensagens recebidas (equivalente ao que fizemos com o `wapi-webhook-debug`, mas agora oficial).

1. Vamos criar uma Edge Function `meta-webhook` que:
   - Responde ao **handshake de verificação** da Meta: uma requisição `GET` com `hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` — precisa responder com o valor de `hub.challenge` em texto puro, só se o `verify_token` bater com o nosso.
   - Recebe `POST` com os eventos reais (mensagens recebidas, status de entrega).
2. No app da Meta → **WhatsApp → Configuração → Webhooks**, informe:
   - **Callback URL**: `https://kverxbbwvmxcdiqwcijp.supabase.co/functions/v1/meta-webhook`
   - **Verify Token**: um valor que você escolhe (guardamos como secret `META_VERIFY_TOKEN`)
3. Assine o campo **messages**.

## Parte 7 — Limites de mensageria

Contas novas começam no **Tier 1**: até 1.000 clientes únicos por 24h (mais que suficiente pro nosso volume atual). O tier sobe automaticamente com uso e boa qualidade (baixa taxa de bloqueio/denúncia pelos destinatários). Isso não deve ser um problema para o volume do Click do Saber.

## Parte 8 — Credenciais finais que preciso para configurar o código

Depois de completar os passos acima, me passe:

| Secret | Onde encontrar |
| --- | --- |
| `META_WHATSAPP_TOKEN` | Token do usuário do sistema (Parte 4) |
| `META_PHONE_NUMBER_ID` | WhatsApp Manager → API Setup, número de produção |
| `META_WABA_ID` | WhatsApp Business Account ID (mesma tela) |
| `META_VERIFY_TOKEN` | Um valor que você escolhe, pro webhook |

## Anexo — Textos dos 14 templates (copiar e colar no WhatsApp Manager)

Categoria: **Utilitário**. Idioma: **Português (BR)**. Todos usam variáveis `{{1}}`, `{{2}}`... no corpo.

### 1. `aula_agendada_professor`
```
📅 Nova aula agendada, {{1}}!

👤 Aluno: {{2}}
📚 Disciplina: {{3}}
🗓 Data: {{4}}
⏰ Horário: {{5}}

Acesse a plataforma para mais detalhes.
```
Variáveis: 1=primeiro nome do professor, 2=aluno, 3=disciplina, 4=data formatada, 5=horário

### 2. `consulta_psico_agendada`
```
📅 Nova consulta psicopedagógica agendada, {{1}}!

👤 Aluno: {{2}}
🗓 Data: {{3}}
⏰ Horário: {{4}}

Acesse a plataforma para mais detalhes.
```
Variáveis: 1=psicopedagoga, 2=aluno, 3=data, 4=horário

### 3. `lembrete_aula_25min_aluno`
```
Olá, {{1}}! ⏰ Sua aula começa em 25 minutos (às {{2}}).

👨‍🏫 Professor(a): {{3}}

Se prepare! Pegue papel, caneta e o material necessário.
```
Variáveis: 1=aluno, 2=horário, 3=professor

### 4. `lembrete_aula_10min_aluno`
```
⚡ {{1}}, sua aula começa em 10 minutos (às {{2}})!

👨‍🏫 Professor(a): {{3}}
```
Variáveis: 1=aluno, 2=horário, 3=professor

### 5. `lembrete_aula_30min_professor`
```
📋 Lembrete de aula em 30 minutos (às {{1}})!

👤 Aluno: {{2}}
📚 Disciplina: {{3}}
```
Variáveis: 1=horário, 2=aluno, 3=disciplina

### 6. `lembrete_consulta_10min_psico`
```
⚡ {{1}}, sua consulta começa em 10 minutos (às {{2}})!

👤 Aluno: {{3}}
```
Variáveis: 1=psicopedagoga, 2=horário, 3=aluno

### 7. `lembrete_consulta_30min_responsavel`
```
Olá, {{1}}! 👋

A consulta de {{2}} com a psicopedagoga {{3}} está marcada para daqui a 30 minutos (às {{4}}).

Certifique-se de que {{2}} está disponível e em um ambiente tranquilo.
```
Variáveis: 1=responsável, 2=aluno, 3=psicopedagoga, 4=horário

### 8. `bom_dia_professor`
```
Bom dia, professor {{1}}! 🌅

Você tem aula agendada para hoje. Verifique no dashboard os horários para se programar.
```
Variáveis: 1=professor

### 9. `bom_dia_psico`
```
Bom dia, {{1}}! 🌅

Você tem consulta(s) psicopedagógica(s) agendada(s) para hoje. Verifique no dashboard os horários.
```
Variáveis: 1=psicopedagoga

### 10. `nova_mensagem_chat`
```
💬 {{1}} te enviou uma mensagem no Click do Saber!

Acesse a plataforma para visualizar e responder.
```
Variáveis: 1=aluno

### 11. `nova_atividade_aluno`
```
📚 Olá, {{1}}! Você tem uma nova atividade no Click do Saber!

📝 {{2}}
📅 Prazo: {{3}}
👨‍🏫 Professor(a): {{4}}

Entre no portal, resolva e envie a foto da resolução!
```
Variáveis: 1=aluno, 2=título da atividade, 3=prazo, 4=professor

### 12. `resposta_atividade_professor`
```
📝 {{1}} enviou uma resposta para a atividade {{2}}!

Acesse o painel para visualizar e corrigir.
```
Variáveis: 1=aluno, 2=título da atividade

### 13. `relatorio_pos_aula`
```
📋 Novo Relatório Pós-Aula

🕐 Emitido em: {{1}}
👨‍🏫 Professor(a): {{2}}
👤 Aluno(a): {{3}}
🎯 Meta atingida: {{4}}
```
Variáveis: 1=data/hora de emissão, 2=professor, 3=aluno, 4=meta atingida

### 14. `relatorio_pdf_documento`
Template com **cabeçalho do tipo Documento** (não é só corpo de texto) — na criação, escolha "Cabeçalho" = Documento e envie um PDF de exemplo qualquer (pode ser um relatório de teste). Corpo:
```
📄 Relatório completo em anexo.
```
Sem variáveis no corpo — o PDF real é enviado depois via `header.parameters` do template com um link do arquivo.

## Parte 9 — O que eu faço depois

Com essas credenciais, eu:
1. Reescrevo `supabase/functions/_shared/` com um cliente para a Graph API (`enviarTemplate()`, `enviarTexto()` para dentro da janela de 24h).
2. Atualizo as 7 Edge Functions para usar templates em vez de texto livre.
3. Crio a `meta-webhook` para status de entrega.
4. Testamos com moderação (a API oficial não tem o mesmo risco de banimento por rajada, mas ainda vale ir com calma no primeiro teste).
