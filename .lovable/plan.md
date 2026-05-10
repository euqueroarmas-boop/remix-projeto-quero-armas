# BLOCO 10 — Contrato pós-pagamento Quero Armas

## FASE 10.1 — AUDITORIA (resultado)

### Já existe no projeto
- **Edge functions**:
  - `asaas-webhook` — recebe confirmação de pagamento (já roda para o lado WMTi).
  - `generate-paid-contract-pdf` — gera PDF de contrato pós-pagamento usando `pdf-lib` + `_shared/post-purchase.ts` (hoje opera sobre `customers` / `quotes` / `contracts` do **WMTi**, não sobre `qa_vendas`).
  - `sign-contract-pdf` — assina PDF com A1 ICP-Brasil (PAdES, `_shared/pdfSign.ts`, AES-256-GCM).
  - `serve-contract-pdf` — proxy seguro de download (bucket `paid-contracts`).
  - `qa-validate-govbr-signature` — **valida criptograficamente** PAdES/ICP-Brasil/Gov.br (forge, sem OCR). **Reutilizável diretamente.**
- **Storage**: bucket `paid-contracts` ativo + bucket `certificates` (A1 cifrado).
- **Vendas/itens**: `qa_vendas` (status check inclui `PAGO`) + `qa_itens_venda` (snapshot já parcialmente possível: `valor`, `servico_id`, `tipo_venda`).
- **Catálogo**: `qa_servicos_catalogo` (origem dos serviços).
- **Webhook Asaas** já dispara `ensureClientAccess`.

### O que NÃO existe (gap)
- Nenhuma tabela `qa_contracts*`. As tabelas `contracts/contract_signatures/...` são **WMTi only** (FK para `customers`/`quotes`) — **não dá para reaproveitar sem regressão**.
- Nenhum gatilho de geração de contrato a partir de `qa_vendas` no webhook Asaas.
- Nenhum bloco "Contrato" no portal Quero Armas.
- Nenhum snapshot imutável (nome/descrição/preço) congelado no momento da venda.
- Nenhum fluxo de upload/validação de PDF assinado pelo cliente para vendas QA.
- Nenhuma liberação de processo/checklist condicionada à assinatura válida.

### Decisão arquitetural
Criar família **`qa_contracts*`** isolada (sem tocar em `contracts` WMTi). Reutilizar 100% as edge functions existentes de **assinatura da contratada** (`sign-contract-pdf`) e **validação cliente** (`qa-validate-govbr-signature`), criando apenas wrappers QA-específicos que operam sobre `qa_vendas`.

---

## FASE 10.2 — MIGRATION (mínima, RLS-safe)

Tabelas novas, todas com RLS:

- `qa_contracts` — 1:1 com `qa_vendas` (`venda_id` UNIQUE), número de contrato, status, paths de PDF (original/assinado pela empresa/assinado pelo cliente), SHA-256 de cada versão, timestamps, `validation_status`, `validation_details jsonb`.
- `qa_contract_items` — snapshot **imutável** dos itens (`service_slug_snapshot`, `service_name_snapshot`, `service_description_snapshot`, `unit_price_cents`, `quantity`, `metadata`). FK opcional para `qa_itens_venda.id`.
- `qa_contract_signatures` — uma linha por assinatura (`signer_role`: `company`/`customer`, `signature_type`: `representative_govbr`/`representative_icp`/`company_icp`, `validation_status`, `validation_details`, `signed_pdf_path`, `signed_pdf_sha256`).
- `qa_contract_events` — auditoria (`generated`, `company_signed`, `customer_uploaded`, `validation_started`, `validation_passed`, `validation_failed`, `validation_indeterminate`, `manual_review_required`, `released_to_checklist`).

**RLS** (alinhada com padrão `qa_*` já presente):
- Staff (`qa_is_active_staff`) → SELECT/INSERT/UPDATE em tudo.
- Cliente (`qa_current_cliente_id(auth.uid())`) → SELECT apenas em contratos da própria `cliente_id` (via JOIN com `qa_vendas`); INSERT em `qa_contract_signatures` apenas no próprio contrato e apenas com `signer_role='customer'`.
- Service role → bypass total (edge functions).

**Bucket de storage**: reutilizar `paid-contracts` com prefixo `qa/<venda_id>/...` (já tem RLS service-role-only — acesso ao cliente vai ser via novo proxy `qa-serve-contract-pdf`).

---

## FASE 10.3 — Geração pós-pagamento (`qa-generate-contract`)

Nova edge function `qa-generate-contract`:
- **Trigger**: chamada por `asaas-webhook` quando `qa_vendas.status` transiciona para `PAGO`.
- **Idempotente** (UNIQUE em `qa_contracts.venda_id`).
- Lê `qa_vendas` + `qa_itens_venda` + `qa_servicos_catalogo` (apenas para snapshot inicial).
- **Congela snapshot** em `qa_contract_items` — depois disso o catálogo nunca mais é consultado.
- Renderiza PDF com `pdf-lib` (cabeçalho Quero Armas, dados do cliente, lista de serviços contratados com nome/descrição/qtd/valor unitário/total).
- Calcula SHA-256, faz upload para `paid-contracts/qa/<venda_id>/original.pdf`.
- Insere `qa_contract_events('generated', ...)`.
- `status = 'generated_pending_company_signature'`. **Não libera nada.**

Patch em `asaas-webhook`: ao confirmar pagamento, se a venda existe em `qa_vendas`, invocar `qa-generate-contract` (best-effort, log em `qa_pagamento_auditoria`).

---

## FASE 10.4 — Assinatura da contratada

- Reutilizar `sign-contract-pdf` (PAdES + A1 ICP-Brasil já funcional).
- Modos suportados (campo `signature_mode_company`):
  - `representative_govbr` (representante legal via Gov.br)
  - `representative_icp` (representante com A1 próprio)
  - `company_icp` (PJ — preparado, mas não obriga uso agora)
- Endpoint admin novo `qa-sign-contract-company` que recebe `contract_id`, baixa `original.pdf`, chama `sign-contract-pdf`, salva resultado em `paid-contracts/qa/<venda_id>/company-signed.pdf`, atualiza `qa_contracts.company_signed_pdf_path/sha256/at`, insere `qa_contract_signatures(signer_role='company', ...)`, status → `pending_customer_signature`.

---

## FASE 10.5 — Bloco no portal do cliente

Componente `<ContratoBlock />` em `QAClientePortalPage`:
- Lê `qa_contracts` da venda mais recente paga.
- Estados visuais (mapeados de `status` + `validation_status`):
  - Em preparação · Aguardando assinatura da Quero Armas · Disponível para assinatura · Aguardando envio do PDF assinado · Assinatura em validação · Contrato validado · Contrato rejeitado / reenviar · Em revisão manual.
- Ações:
  - **Baixar contrato** → novo proxy `qa-serve-contract-pdf` (autenticado, valida `cliente_id`).
  - **Enviar contrato assinado** → upload direto para `paid-contracts/qa/<venda_id>/customer-uploaded.pdf` via edge function `qa-upload-signed-contract` que dispara validação.
  - **Ver status da validação** → mostra `validation_details`.
- Mobile-first, padrão Arsenal UI claro.

---

## FASE 10.6 — Validação criptográfica

Nova edge function `qa-validate-customer-signature`:
- Roda automaticamente após upload (`qa-upload-signed-contract` invoca).
- Calcula SHA-256 do PDF enviado.
- **Confere integridade do documento base**: extrai os bytes assinados e verifica que correspondem ao `original_sha256` (ou `company_signed_sha256` se já assinado pela contratada).
- Chama `qa-validate-govbr-signature` (já existente, sem OCR) → retorna `valida/invalida/sem_assinatura/erro`, signatário, CPF, autoridade.
- **Cruza CPF** do signatário com `qa_clientes.cpf` quando disponível.
- Mapeia para `validation_status`:
  - `valid` → válido + integridade OK + (CPF bate ou cliente sem CPF cadastrado).
  - `invalid` → assinatura criptográfica inválida ou hash do documento divergente.
  - `indeterminate` → válido mas CPF diverge / autoridade não-ICP-Brasil reconhecida → `pending_manual_review`.
- Persiste em `qa_contracts.validation_status/validation_details`, `qa_contract_signatures(signer_role='customer', ...)`, `qa_contract_events`.

---

## FASE 10.7 — Liberação do processo/checklist

- Trigger SQL ou patch na edge: ao `validation_status='valid'` em `qa_contracts`, criar (se não existir) `qa_solicitacoes_servico` + `qa_processos` por **item snapshotado** em `qa_contract_items`, gerando estrutura operacional **por item** (nunca genérica).
- Bloqueio explícito: se contrato não estiver `valid`, qualquer tentativa de abrir checklist via UI é negada (guard no `QAClientePortalPage` + RLS check em `qa_processos` futura, mas mínimo agora é gating na UI + flag em `qa_solicitacoes_servico`).

---

## Validação final
1. Forçar `qa_vendas.status='PAGO'` em ambiente de teste.
2. Confirmar `qa_contracts` criado, snapshot íntegro, PDF original gerado.
3. Assinar pela contratada (admin) → arquivo `company-signed.pdf` aparece, status muda.
4. Logar como cliente, baixar, fazer upload de PDF assinado.
5. Validação corre, `valid` libera processo; `invalid` bloqueia; `indeterminate` vai para revisão.
6. `npm run typecheck` + `npm run build`.

---

## Observações importantes

- **Zero regressão**: nada nas tabelas `contracts/contract_*` (WMTi) ou nos fluxos existentes é alterado. Tudo novo vive em `qa_contracts*` + edge functions com prefixo `qa-`.
- **Sem OCR**: validação 100% criptográfica via `node-forge` (já no projeto).
- **Snapshot imutável**: nenhuma leitura de `qa_servicos_catalogo` após `generated`.
- **Reuso máximo**: `sign-contract-pdf` + `qa-validate-govbr-signature` + bucket `paid-contracts` reaproveitados sem fork.

---

## Escopo desta primeira PR (proposto)

Por ser um bloco **muito grande** (4 tabelas + ~5 edge functions + UI portal + integração webhook + RLS + storage), recomendo entregar em **dois passes**:

- **Pass A (esta entrega)**: FASES 10.2 + 10.3 + 10.4 + hook em `asaas-webhook` + endpoint admin de assinatura + skeleton do bloco do portal mostrando status (sem upload ainda).
- **Pass B (próxima)**: FASES 10.5 (upload) + 10.6 (validação) + 10.7 (liberação do checklist).

Confirma que posso seguir com **Pass A** agora?
