---
name: Carimbo de sessão PDF do contrato (canônico)
description: Layout canônico do carimbo lateral de auditoria de sessão no PDF público de contrato (qa-contrato-view-public). Zero regressão sem confirmação.
type: constraint
---

O carimbo lateral de auditoria de sessão embutido no PDF gerado por `supabase/functions/qa-contrato-view-public/index.ts` (`buildSessionStampedPdf`) é **CANÔNICO e IMUTÁVEL**.

Especificação atual (estado aprovado):
- Margem esquerda 104pt, respiro (`textGutter`) 16pt até o texto do contrato.
- Linha vertical delimitadora em `stampRuleX = 24`.
- Título rotacionado 90°: "REGISTRO DE SESSÃO — DOWNLOAD DO INSTRUMENTO · MP 2.200-2/2001".
- Campos concatenados em UMA linha separada por vírgulas (CONTRATO, DATA/HORA BRT, IP, SO, NAVEGADOR, PAÍS, IDIOMA, REFERER, USER-AGENT, AÇÃO), quebrando automaticamente em colunas verticais adicionais (`columnGap = 9`) quando não couber.
- Paginação discreta "PÁG. x/y" no topo da lateral.
- Aparece em TODAS as páginas do PDF, gerado server-side (jsPDF na edge function).
- Sem tabela final de sessão no corpo (substituída pelo carimbo lateral).
- Evento `contrato_baixado_cliente` sempre registrado em `qa_contract_events` com IP, UA, país, referer, client hints, BRT.

**Regra:** qualquer alteração (margens, fonte, ordem/nomes dos campos, remoção do carimbo, mudança de layout, troca do gerador PDF, mover para client-side, remover registro de evento, etc.) EXIGE confirmação explícita do usuário ANTES de editar. Não refatorar "por limpeza". Não mover para outra função.
