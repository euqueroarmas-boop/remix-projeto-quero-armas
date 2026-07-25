---
name: Location-Aware Engine (Antecedentes + Exames)
description: Portal troca links/textos de antecedentes pela UF do cliente e recomenda credenciados no raio de 25 km
type: feature
---

Cérebro resolve UF via `qa_clientes.estado` (fallback comprovante/CEP) e:

1. `src/lib/quero-armas/linksAntecedentesPorUf.ts` — catálogo por UF (TJ, PC, TJM, TRF regional TRF1..TRF6). `resolveLinkAntecedentePorUf(rawTipo, uf)` e `aplicarUfEmTexto` reescrevem hardcodes de SP (TJSP → TJ<UF>, Polícia Civil/SP → Polícia Civil/<UF>, e-SAJ → portal do TJ<UF>).
2. `PendenciasGuiadasPopup` recebe prop `ufCliente` e sobrescreve `linkEmissao` + `explic.{titulo,passos,observacao}`. QAClientePortalPage passa `cliente?.estado`.
3. `QAClienteAgendarExamePage` — raio default 25 km. Banner de RECOMENDAÇÃO deixa explícito: cliente pode escolher qualquer credenciado PF de qualquer UF.
4. Fallback: se UF não mapeada ou = SP, mantém link/texto estático. Nunca quebra fluxo.
