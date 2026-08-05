# Templates do WhatsApp (Meta) — Click do Saber

14 templates ao todo: 13 de texto + 1 de documento (PDF). Todos categoria **Utilitário**, idioma **Português (BR)**.

## Passo a passo para criar cada um (repita para os 14)

1. Acesse **WhatsApp Manager** → **Modelos de Mensagem** → **Criar modelo**.
2. **Categoria**: Utilitário.
3. **Nome**: copie exatamente como está aqui (minúsculo, com underscore) — o código busca o template por esse nome exato.
4. **Idioma**: Português (BR).
5. Em **Corpo**, cole o texto da seção "Corpo" abaixo, mantendo as variáveis `{{1}}`, `{{2}}`... exatamente como estão.
6. A Meta vai pedir um **valor de exemplo** para cada variável antes de permitir enviar — use os exemplos sugeridos em "Exemplos para preencher" de cada template.
7. Só no template 14 (`relatorio_pdf_documento`): antes do corpo, adicione um **Cabeçalho** do tipo **Documento** e envie qualquer PDF de exemplo quando pedido.
8. Clique em **Enviar** para análise. Repita para o próximo.

---

### 1. `aula_agendada_professor`
**Corpo:**
```
📅 Nova aula agendada, {{1}}!

👤 Aluno: {{2}}
📚 Disciplina: {{3}}
🗓 Data: {{4}}
⏰ Horário: {{5}}

🔗 Link da aula: {{6}}

Acesse a plataforma para mais detalhes.
```
**Exemplos para preencher:** {{1}} João, {{2}} Maria Silva, {{3}} Matemática, {{4}} Segunda-feira, 4 de agosto, {{5}} 14:00, {{6}} https://meet.google.com/abc-defg-hij

---

### 2. `consulta_psico_agendada`
**Corpo:**
```
📅 Nova consulta psicopedagógica agendada, {{1}}!

👤 Aluno: {{2}}
🗓 Data: {{3}}
⏰ Horário: {{4}}

🔗 Link da consulta: {{5}}

Acesse a plataforma para mais detalhes.
```
**Exemplos:** {{1}} Ana, {{2}} Pedro Souza, {{3}} Terça-feira, 5 de agosto, {{4}} 15:30, {{5}} https://meet.google.com/abc-defg-hij

---

### 3. `lembrete_aula_25min_aluno`
**Corpo:**
```
Olá, {{1}}! ⏰ Sua aula começa em 25 minutos (às {{2}}).

👨‍🏫 Professor(a): {{3}}

Se prepare! Pegue papel, caneta e o material necessário.

🔗 Link para entrar na aula: {{4}}

_Click do Saber_
```
**Exemplos:** {{1}} Pedro, {{2}} 14:00, {{3}} João Costa, {{4}} https://meet.google.com/abc-defg-hij

---

### 4. `lembrete_aula_10min_aluno`
**Corpo:**
```
⚡ {{1}}, sua aula começa em 10 minutos (às {{2}})!

👨‍🏫 Professor(a): {{3}}

🔗 Entre agora: {{4}}

_Click do Saber_
```
**Exemplos:** {{1}} Pedro, {{2}} 14:00, {{3}} João Costa, {{4}} https://meet.google.com/abc-defg-hij

---

### 5. `lembrete_aula_30min_professor`
**Corpo:**
```
📋 Lembrete de aula em 30 minutos (às {{1}})!

👤 Aluno: {{2}}
📚 Disciplina: {{3}}

🔗 Link da aula: {{4}}

_Click do Saber_
```
**Exemplos:** {{1}} 14:00, {{2}} Pedro Souza, {{3}} Matemática, {{4}} https://meet.google.com/abc-defg-hij

---

### 6. `lembrete_consulta_10min_psico`
**Corpo:**
```
⚡ {{1}}, sua consulta começa em 10 minutos (às {{2}})!

👤 Aluno: {{3}}

🔗 Entre agora: {{4}}

_Click do Saber_
```
**Exemplos:** {{1}} Ana, {{2}} 15:30, {{3}} Pedro Souza, {{4}} https://meet.google.com/abc-defg-hij

---

### 7. `lembrete_consulta_30min_responsavel`
**Corpo:**
```
Olá, {{1}}! 👋

A consulta de {{2}} com a psicopedagoga {{3}} está marcada para daqui a 30 minutos (às {{4}}).

Certifique-se de que {{2}} está disponível e em um ambiente tranquilo.

🔗 Link da sessão: {{5}}

_Click do Saber_
```
**Exemplos:** {{1}} Carla, {{2}} Pedro, {{3}} Ana Lima, {{4}} 15:30, {{5}} https://meet.google.com/abc-defg-hij

---

### 8. `bom_dia_professor`
**Corpo:**
```
Bom dia, professor {{1}}! 🌅

Você tem aula agendada para hoje. Verifique no dashboard os horários para se programar.
```
**Exemplos:** {{1}} João

---

### 9. `bom_dia_psico`
**Corpo:**
```
Bom dia, {{1}}! 🌅

Você tem consulta(s) psicopedagógica(s) agendada(s) para hoje. Verifique no dashboard os horários.
```
**Exemplos:** {{1}} Ana

---

### 10. `nova_mensagem_chat`
**Corpo:**
```
💬 {{1}} te enviou uma mensagem no Click do Saber!

Acesse a plataforma para visualizar e responder.
```
**Exemplos:** {{1}} Pedro Souza

---

### 11. `nova_atividade_aluno`
**Corpo:**
```
📚 Olá, {{1}}! Você tem uma nova atividade no Click do Saber!

📝 {{2}}
📅 Prazo: {{3}}
👨‍🏫 Professor(a): {{4}}

Entre no portal, resolva e envie a foto da resolução!
```
**Exemplos:** {{1}} Pedro, {{2}} Lista de exercícios — frações, {{3}} 10/08/2026, {{4}} João Costa

---

### 12. `resposta_atividade_professor`
**Corpo:**
```
📝 {{1}} enviou uma resposta para a atividade {{2}}!

Acesse o painel para visualizar e corrigir.
```
**Exemplos:** {{1}} Pedro Souza, {{2}} Lista de exercícios — frações

---

### 13. `relatorio_pos_aula`
**Corpo:**
```
📋 Novo Relatório Pós-Aula

🕐 Emitido em: {{1}}
👨‍🏫 Professor(a): {{2}}
👤 Aluno(a): {{3}}
🎯 Meta atingida: {{4}}

_Click do Saber_
```
**Exemplos:** {{1}} 01/08/2026 15:40, {{2}} João Costa, {{3}} Pedro Souza, {{4}} Sim — meta totalmente atingida

---

### 14. `relatorio_pdf_documento`
**Cabeçalho:** Documento (envie um PDF qualquer de exemplo na criação).
**Corpo:**
```
📄 Relatório completo em anexo.
```
Sem variáveis no corpo.

---

## Conferência: o que cada template cobre

| # | Template | Evento / gatilho | Quem recebe | Onde é chamado no código |
|---|----------|-------------------|--------------|---------------------------|
| 1 | `aula_agendada_professor` | Aula agendada pelo admin | Professor | `agenda.js` → `send-agendamento-email` |
| 2 | `consulta_psico_agendada` | Consulta psicopedagógica agendada | Psicopedagoga | `agenda.js` → `send-agendamento-psico` |
| 3 | `lembrete_aula_25min_aluno` | 25 min antes da aula | Aluno | cron → `send-class-reminders` |
| 4 | `lembrete_aula_10min_aluno` | 10 min antes da aula | Aluno | cron → `send-class-reminders` |
| 5 | `lembrete_aula_30min_professor` | 30 min antes da aula | Professor | cron → `send-class-reminders` |
| 6 | `lembrete_consulta_10min_psico` | 10 min antes da consulta | Psicopedagoga | cron → `send-class-reminders` |
| 7 | `lembrete_consulta_30min_responsavel` | 30 min antes da consulta | Responsável do aluno | cron → `send-class-reminders` |
| 8 | `bom_dia_professor` | 08:00, se tem aula hoje | Professor | cron → `send-class-reminders` |
| 9 | `bom_dia_psico` | 08:00, se tem consulta hoje | Psicopedagoga | cron → `send-class-reminders` |
| 10 | `nova_mensagem_chat` | Aluno manda mensagem no chat | Professor | trigger banco → `notify-chat-message` |
| 11 | `nova_atividade_aluno` | Professor posta atividade nova | Aluno | trigger banco → `notify-nova-atividade` |
| 12 | `resposta_atividade_professor` | Aluno responde atividade | Professor | trigger banco → `notify-resposta-atividade` |
| 13 | `relatorio_pos_aula` | Relatório de aula criado (texto) | Admin (número fixo) | trigger banco → `notify-relatorio` |
| 14 | `relatorio_pdf_documento` | Relatório de aula criado (PDF) | Admin (número fixo) | `relatorios.js` → `notify-relatorio` |

**Nota:** existe um 15º evento no inventário original — lembrete de aula 30 min antes **por e-mail** ao professor — que continua funcionando via EmailJS dentro do próprio `send-class-reminders`, sem depender de WhatsApp/template nenhum. Não precisa de template porque não é WhatsApp.

Se algo aqui não bater com o que você lembra do sistema, me avisa que reviso.
