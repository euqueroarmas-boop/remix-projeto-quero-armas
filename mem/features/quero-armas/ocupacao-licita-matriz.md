---
name: Ocupação lícita — matriz por condição profissional
description: Documentos exigidos por condição profissional (autônomo/MEI, empresário) e obrigatoriedade de rotear a resposta por qa-processo-set-condicao
type: feature
---
# Ocupação lícita

## Matriz
- **Autônomo / MEI:** CCMEI (`renda_ccmei`), Cartão CNPJ (`renda_cartao_cnpj`), QSA (`renda_qsa`), Nota fiscal emitida a um cliente (`renda_nf_recente`).
- **Empresário / sócio:** Contrato Social **ou** Requerimento de Empresário **ou** Ficha Cadastral da Junta (`renda_contrato_social`), Cartão CNPJ, QSA, Nota fiscal da empresa (`renda_nf_empresa`).
- Tipos superados: `renda_cnpj_autonomo`, `renda_ficha_cadastral_jucesp` (desativados no catálogo).

## Regra crítica de roteamento
A pergunta `condicao_profissional` (`renda_definir_condicao`) **NUNCA** pode ser gravada por `qa-processo-responder-pergunta` — essa função só marca `dispensado_grupo` e fecha a ocupação lícita vazia (furo que indefere na PF).
Sempre rotear para **`qa-processo-set-condicao`**, que remove o placeholder e injeta as exigências da condição escolhida.
Travas ativas: guard no front (`checklistGuiadoEngine.responderPerguntaGuia` + portal) e HTTP 409 `use_set_condicao` no backend.

## Golden Record — preenchimento automático (Hub Documental)
- **Nº do documento:** para todo o grupo renda/ocupação o identificador é o **CNPJ formatado** (cartão CNPJ, CCMEI, QSA). Para nota fiscal é o **número da NF**.
- **Validade:** **emissão + 30 dias** para todo o grupo; **nota fiscal é perpétua** (sem vencimento).
- Fonte única das regras: `isDocumentoEmpresa30Dias` / `isNotaFiscalSemVencimento` em `src/lib/quero-armas/validadeDocumento.ts`. O Hub (`calcularValidadeHubPorTipo`) e `numeroDocumentoRenda` delegam para elas — nunca duplicar a regra.
