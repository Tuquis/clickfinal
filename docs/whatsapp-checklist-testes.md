# Checklist de testes — WhatsApp (API oficial Meta)

Organizado por facilidade. Use um professor/aluno/psicopedagoga de teste com telefone cadastrado corretamente (com DDD, com o 9º dígito).

## Grupo A — Testar agora, ação imediata no app (sem esperar nada)

- [ ] **1. Chat → professor**: logado como aluno, mande uma mensagem para um professor no chat. Confirma se chega WhatsApp pro professor (`nova_mensagem_chat`). Obs: só dispara na primeira mensagem não lida a cada 30 min — se testar duas vezes seguidas rápido, a segunda não vai gerar aviso (é o anti-spam funcionando, não bug).
- [ ] **2. Atividade nova → aluno**: logado como professor, poste uma atividade nova pra um aluno. Confirma se chega WhatsApp pro aluno (`nova_atividade_aluno`).
- [ ] **3. Resposta de atividade → professor**: logado como aluno, responda a atividade do passo 2. Confirma se chega WhatsApp pro professor (`resposta_atividade_professor`).
- [ ] **4. Relatório de aula (texto) → admin**: logado como professor, lance um relatório de uma aula já realizada. Confirma se chega o **texto** no WhatsApp do número admin (`relatorio_pos_aula`). ⚠️ O **PDF em anexo não vai chegar ainda** — o template `relatorio_pdf_documento` está pendente de aprovação, isso é esperado, não é bug.

## Grupo B — Precisa agendar um horário próximo (dispara sozinho via cron, a cada minuto)

- [ ] **5. Lembretes de aula (25min aluno / 10min aluno / 30min professor)**: agende uma aula de teste para **~32 minutos a partir de agora**, com um Google Meet/link preenchido. Espere e confira 3 mensagens aparecendo nos horários certos:
  - Aos 25 min antes: aluno recebe `lembrete_aula_25min_aluno`
  - Aos 10 min antes: aluno recebe `lembrete_aula_10min_aluno`
  - Aos 30 min antes: professor recebe `lembrete_aula_30min_professor`
  - Confirme se o **link do Meet aparece certinho** nas 3 mensagens.
- [ ] **6. Lembrete de consulta psico (10min)**: agende uma consulta de teste para **~12 minutos a partir de agora**, com link. Confirme se a psicopedagoga recebe `lembrete_consulta_10min_psico` com o link.
- [ ] **7. "Bom dia" (professor / psico)**: só dispara às 08:00 da manhã, e só se a pessoa tiver aula/consulta agendada para aquele dia. Mais difícil de testar sob demanda — ou espera o próximo dia com aula agendada de manhã, ou me avisa que eu simulo com uma chamada direta pra você ver o texto sem precisar esperar até amanhã.

## Grupo C — Ainda NÃO vai funcionar (aguardando aprovação da Meta)

- [ ] **8. Agendar aula → professor**: vai falhar até `aula_agendada_professor` ser aprovado (está "Pendente").
- [ ] **9. Agendar consulta psico → psicopedagoga**: vai falhar até `consulta_psico_agendada` ser aprovado (está "Pendente").
- [ ] **10. Relatório em PDF (anexo)**: vai falhar até `relatorio_pdf_documento` ser aprovado (está "Pendente", categoria/idioma ainda incorretos).

## Grupo D — Bloqueado, não dá pra testar ainda

- [ ] **11. Lembrete de consulta 30min → responsável do aluno**: template `lembrete_consulta_30min_responsavel` não existe (Meta não deixou nem submeter) — precisa resolver isso primeiro.

---

**Dica geral**: depois de cada teste, se a mensagem não chegar, me avise o número/horário do teste que eu confiro os logs da Edge Function e da Meta pra ver se foi erro de template, telefone ou outra coisa — não precisa ficar tentando adivinhar sozinho.
