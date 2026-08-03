---
name: Pergunta híbrida (responde + anexa)
description: regra_validacao.exige_documento_quando transforma uma pergunta do checklist em pergunta + upload na mesma linha (ex.: laudo psicológico)
type: feature
---
`qa_servicos_documentos` / `qa_processo_documentos` deduplicam por `tipo_documento` (SQL `qa_explodir_checklist_processo` e `dedupPorTipo`), então NÃO é possível ter uma linha "pergunta" e outra "documento" com o mesmo código.

Solução canônica: **pergunta híbrida**. Em `regra_validacao` da linha tipo `pergunta`, adicionar:
`"exige_documento_quando": "sim"` (aceita string, lista ou `"*"`).

Comportamento:
- `qa-processo-responder-pergunta` mantém status `pendente` (em vez de `dispensado_grupo`) quando o gatilho casa.
- `checklistGuiadoEngine.perguntaExigeDocumento` / `tipoItemGuiaComRespostas` fazem o item virar upload após a resposta; só fica cumprido com o arquivo aprovado.
- Simulador (`simuladorChecklist.ts`) mostra "RESPONDIDO: X — FALTA ANEXAR O DOCUMENTO".

Aplicado a `laudo_psicologico`.
