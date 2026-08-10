---
name: Comprovante de pagamento pertence ao contrato
description: Regra global — comprovante de pagamento é documento do CONTRATO (categoria jurídico); o único comprovante de pagamento do PROCESSO é a GRU.
type: feature
---

Regra global (todos os clientes):

- `comprovante_pagamento` → categoria `juridico`, exibido junto do contrato assinado. Não é documento do processo administrativo.
- `comprovante_pagamento` NÃO tem prazo de validade (perpétuo) e NÃO aparece no resumo/Hub monitorável — igual ao `contrato_assinado`.
- `gru` (GRU — Guia de Recolhimento da União, taxa do processo) → categoria `documentos_processo`. É o ÚNICO comprovante de pagamento que pertence ao processo.

Onde está aplicado:
- `src/lib/quero-armas/documentosHubCatalogo.ts` (catálogo canônico dos tipos)
- `src/lib/quero-armas/hubTipoMap.ts` (tipo `gru` válido no Hub)
- `src/components/quero-armas/pre-piloto/Etapa1Documentos.tsx` (grupo "Contrato" x grupo "Processo")
- `src/lib/quero-armas/validadeDocumento.ts` (`isComprovantePagamentoContrato` → sem vencimento)
- Banco: `qa_tipos_documento_catalogo` (categoria_hub) e CHECK `qa_doc_cliente_tipo_check` aceitando `gru`.
