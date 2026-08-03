---
name: Klal — exibição de fontes
description: Quando o Klal pode mostrar legislação/base de conhecimento na resposta ao cliente e quais fontes exibir
type: feature
---
Regra de exibição de fontes no chat do Klal (área do cliente):

1. Perguntas sobre o processo do cliente (andamento, status, protocolo, pendências, documentos, pagamento, prazos, o que ele já contratou) → **NÃO exibir legislação nem fontes**. É atendimento, não consulta jurídica.
2. Só exibir base de conhecimento quando for **recomendação de serviço** ou **dúvida técnica/jurídica** em que o cliente possa desconfiar da informação.
3. Nesses casos, mostrar **apenas as fontes efetivamente usadas naquela resposta específica** — nunca a lista completa de fontes recuperadas pela busca. Máximo de 4.

Implementação: `supabase/functions/qa-kb-search-cliente/index.ts` — detecta pergunta de processo por regex (`PROCESSO_RE`), envia `meta` com `fontes: []` no início e um segundo `meta` ao final com as fontes cujo número de norma aparece no texto da resposta. As fontes persistidas em `qa_chat_mensagens.fontes` são as filtradas.