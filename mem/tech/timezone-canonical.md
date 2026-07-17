---
name: Fuso Canônico Brasília
description: Todo horário exibido, logado ou auditado na plataforma deve ser America/Sao_Paulo (−03). Nunca exibir UTC ao usuário.
type: preference
---
Regra fixa: fuso oficial da plataforma é **America/Sao_Paulo (BRT, UTC−03)**.

**How to apply:**
- Toda auditoria, timeline, log apresentado ao usuário ou exportação deve converter `timestamptz` para `America/Sao_Paulo` antes de exibir.
- Em SQL: `... AT TIME ZONE 'America/Sao_Paulo'` ou `SET TIME ZONE 'America/Sao_Paulo'` no início da sessão.
- Nunca reportar horários em UTC ao Willian / equipe operacional — sempre BRT com sufixo explícito quando houver ambiguidade.
- Vale para dashboards, e-mails transacionais, PDFs, WhatsApp e respostas do agente em chat.

**Why:** Willian corrigiu o agente após auditoria mostrar “23:29” (UTC) em vez de “20:29” (BRT), causando confusão sobre quando eventos ocorreram.