---
name: Procuração reaproveitável entre processos
description: Contrato fica na aba Processos; Procuração vive no Hub Documental (Jurídico) com validade de 12 meses e é reaproveitada em novos processos enquanto vigente.
type: feature
---

Contrato assinado -> aba Processos (documento da transação, não reaproveita).
Procuração assinada -> Hub Documental / Jurídico (documento do cliente, reaproveitável).

Validade: 12 meses a partir de data_emissao (isProcuracao em src/lib/quero-armas/validadeDocumento.ts).

Reaproveitamento em QAClientePortalPage.tsx (procFulfilled): se existe uma procuracao_assinada com status=aprovado e vigente no Hub, novas exigencias de procuracao de qualquer processo do cliente sao consideradas cumpridas automaticamente.

Fallbacks preservados: match por procuracao_id no metadado, match por venda_id, e o fallback historico "1 pendente + 1 no Hub". Se vencida, o motor de pendencias volta a exigir procuracao pelo fluxo normal (qa-gerar-procuracao).