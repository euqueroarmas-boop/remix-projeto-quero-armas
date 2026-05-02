---
name: GOV.BR Signature Validator
description: Hybrid validation of PAdES/ICP-Brasil signatures on uploaded declarations + link to ITI official validator
type: feature
---
# Validador GOV.BR / ICP-Brasil

**Edge Function:** `qa-validate-govbr-signature`
- Recebe `documento_id` (preferido) ou `storage_path`. Bucket: `qa-documentos`.
- Extrai todos os blobs `/Contents <hex>` do PDF (PAdES), parseia PKCS#7 com `node-forge`.
- Retorna: `{ valida, status, signatario, cpf_signatario, data_assinatura, autoridade, motivo_falha?, detalhes }`.
- Status possíveis: `valida | invalida | sem_assinatura | erro`.
- Detecta cadeia ICP-Brasil por fragmentos no CN do issuer (AC SERPRO, AC SERASA, AC SOLUTI, etc.).
- Persiste resultado em `qa_processo_documentos.assinatura_*` quando `documento_id` é passado.

**Quais documentos validar:** marcados via `qa_servicos_documentos.regra_validacao->>'assinatura_requerida' = 'govbr'`.
- Todas as declarações `declaracao_*` e `dsa_*`.
- Inclui `declaracao_compromisso_treino` (Concessão CR id 31) — emitida pelo clube, substitui habitualidade.
- Inclui `declaracao_compromisso_habitualidade` (Renovação CR id 32) — Anexo C, com template pré-preenchido.

**UI:** `ProcessoDetalheDrawer.tsx`
- Botão "VALIDAR ASSINATURA GOV.BR" (indigo) só aparece se `exigeAssinaturaGovBr` (flag DB).
- Botão "VALIDAR NO ITI OFICIAL" abre `https://validar.iti.gov.br/`.
- Badge mostra ✅/❌ com signatário, CPF, data, autoridade. Selo extra "ICP-BRASIL" quando aplicável.

**IMPORTANTE:** Esta validação é estrutural (parse do PKCS#7 e extração de metadados). NÃO faz validação criptográfica completa do hash da árvore PDF nem revogação CRL/OCSP — por isso oferecemos sempre o link para o validador oficial do ITI como complemento.
