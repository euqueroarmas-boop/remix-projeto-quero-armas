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
- **Validade:** **emissão + 30 dias** apenas para **Cartão CNPJ e QSA**. **Sem prazo:** nota fiscal, **CCMEI, contrato social e requerimento de empresário** (documentos constitutivos — a atualidade da ocupação é conferida pela emissão do Cartão CNPJ/QSA).
- **Duplicidade:** documento do mesmo tipo já enviado (aprovado ou em análise) **bloqueia o envio**. O cliente é avisado para excluir o anterior e enviar o correto — nunca salvar duas vezes.
- Fonte única das regras: `isDocumentoEmpresa30Dias` / `isNotaFiscalSemVencimento` em `src/lib/quero-armas/validadeDocumento.ts`. O Hub (`calcularValidadeHubPorTipo`) e `numeroDocumentoRenda` delegam para elas — nunca duplicar a regra.

## Golden Record — QSA
- O **QSA (Quadro de Sócios e Administradores)** não imprime data de emissão. A emissão do QSA é **sempre a mesma do Cartão CNPJ** aprovado no Hub (mesma consulta da Receita Federal).
- O Hub preenche automaticamente: emissão = emissão do Cartão CNPJ aprovado, validade = emissão + 30 dias, órgão emissor = Receita Federal do Brasil.

## Golden Record — Nota Fiscal (tabela dedicada)
- Toda NFS-e do grupo de ocupação lícita é gravada em `public.qa_nf_golden_records` (chave natural: `chave_acesso`, upsert — reenvio nunca duplica).
- Guarda o **cabeçalho** (número/competência/emissão da NFS-e, número e série da DPS, município emissor), o **prestador** (CNPJ, nome empresarial, IM, telefone, e-mail, endereço, município, CEP, Simples/MEI), o **tomador** (documento, nome, endereço, município, CEP) e o **serviço prestado** (código de tributação nacional/municipal, local, descrição integral + `itens_servico` JSONB com descrição/quantidade/preço/total), além de valores e ISSQN.
- Fonte: `parseNotaFiscal` em `src/lib/quero-armas/parsersCertidoes.ts` (seções recortadas para não confundir prestador com tomador) + `salvarNotaFiscalGoldenRecord` em `src/lib/quero-armas/notaFiscalGoldenRecord.ts`.
- Conformidade continua conferindo **apenas o prestador** (CNPJ + razão social). Tomador é dado do cliente do MEI — nunca comparado com o cadastro.
