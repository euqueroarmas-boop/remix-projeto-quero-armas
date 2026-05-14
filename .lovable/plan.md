## FASE 2C-5 — Acesso gratuito pós-pagamento (QA puro)

### Auditoria — estado atual

**O que já funciona (não tocar):**
- `qa_vendas` → status `PAGO` dispara duas triggers:
  1. `qa_vendas_after_pago_invoke_contract` → `qa-generate-contract` (gera contrato). OK.
  2. `qa_vendas_after_pago_provisionar_portal` → `create-client-user` (provisiona acesso).
- Login do cliente: `QAClienteLoginPage` + `cliente-portal-request-otp` / `cliente-portal-verify-otp` (OTP, sem senha em texto puro). OK, é fluxo QA puro.
- Ativação manual: `QAAtivarAcessoPage` usa o mesmo OTP. OK.
- Reenvio boas-vindas: `qa-cliente-reenviar-boas-vindas` usa só `qa_clientes` + `send-smtp-email`. OK.
- Portal: `QAClientePortalPage` já renderiza `ContratosPosPagamentoCard` com badge "AGUARDANDO CONTRATO ASSINADO" e botão de download. OK.
- Arsenal: rota livre, sem `ArsenalGate` / `ArsenalBlockedPanel` / `qa_arsenal_access_gate` em uso (verificado por grep). OK.

**Gap único encontrado:**
- `create-client-user` lê e escreve em `public.customers` (tabela WMTi) — viola a regra "não usar customers". É chamado pela trigger `qa_vendas_provisionar_portal_on_pago` toda vez que uma venda QA vira `PAGO`.

### Decisão

Criar **uma** Edge Function QA-pura mínima e redirecionar a trigger. Sem arquitetura paralela: reaproveita `auth.admin`, `qa_clientes`, `send-smtp-email`, e os mesmos templates `qaArsenalWelcomeHtml/Text`. Sem novas tabelas, sem `cliente_auth_links`, sem alterar UI do portal/Arsenal.

### Implementação

**1) Nova Edge Function `qa-provisionar-acesso-portal`** (`supabase/functions/qa-provisionar-acesso-portal/index.ts`):
- Auth: aceita `x-trigger-source: qa_vendas_pago` (anon key) **ou** `x-internal-token`.
- Input: `{ qa_client_id, venda_id, origem_trigger }`.
- Lógica idempotente:
  1. `SELECT qa_clientes WHERE id = qa_client_id` (single source of truth).
  2. Se `status = 'excluido_lgpd'` → `{ ok: true, skipped: 'lgpd' }`.
  3. Se `email` vazio → registra `falha_envio_email` em `qa_processo_eventos`, retorna `{ ok: false, reason: 'no_email' }`.
  4. `auth.admin.listUsers` por email; se existe → reusa (`existing_user`), atualiza `qa_clientes.user_id` se faltar, registra `acesso_portal_reutilizado`, **não envia novo convite** (a menos que `portal_provisionado_em` ainda esteja NULL — neste caso envia o e-mail informativo "seu serviço foi pago, contrato gerado, acesse o portal"). 
  5. Se não existe → `auth.admin.createUser({ email, email_confirm: true, password: random32 })`, vincula em `qa_clientes` (set `user_id`, `portal_provisionado_em = now()`), envia e-mail QA com **link de ativação** (rota existente `/area-do-cliente/ativar` → fluxo OTP). Sem senha em texto puro.
  6. Registra eventos: `acesso_portal_preparado_pos_pagamento`, `convite_acesso_enviado` ou `convite_acesso_reutilizado`.
- **Não toca**: `customers`, `payments`, `contracts`, `quotes`, `post-purchase.ts`, `ensureClientAccess`.

**2) Migração SQL** (`supabase/migrations/<timestamp>_qa_provisionar_acesso_portal.sql`):
- Substitui o corpo de `qa_vendas_provisionar_portal_on_pago()` para invocar `qa-provisionar-acesso-portal` (mesmo padrão `pg_net.http_post` já usado).
- Mantém todas as guardas: `OLD.status = 'PAGO'` early return, `excluido_lgpd` early return, `portal_provisionado_em IS NOT NULL` early return.
- Mantém trigger `AFTER INSERT OR UPDATE OF status` — não alterar atributos da trigger.

**3) Não alterar:**
- `create-client-user` permanece para uso WMTi legado (não removido).
- `ensure-client-access` permanece para uso WMTi legado.
- UI do portal, Arsenal, login, ativação, redefinir-senha.
- Webhook Asaas.
- `qa-generate-contract`.

**4) Testes** (`src/lib/quero-armas/__tests__/acessoPortalPosPagamento.test.ts`):
1. Função `qa-provisionar-acesso-portal` source NÃO contém: `from("customers")`, `payments`, `quotes`, `post-purchase`, `ensureClientAccess`.
2. Trigger SQL na nova migração chama `qa-provisionar-acesso-portal`, não `create-client-user`.
3. `QAClientePortalPage` importa `ContratosPosPagamentoCard` e não importa `ArsenalGate/ArsenalBlockedPanel`.
4. `QAArsenalDigitalGratuitoPage` não tem gate (`ArsenalGate|ArsenalBlockedPanel|qa_arsenal_access_gate`).
5. `ContratosPosPagamentoCard` exibe badge "AGUARDANDO CONTRATO ASSINADO" + botão download (já existe — manter regressão).
6. `qa-cliente-reenviar-boas-vindas` continua usando `qa_clientes` + `send-smtp-email`.

**5) Validação:**
- `npm run typecheck`, `npm run test`, `npm run build`.
- Deploy `qa-provisionar-acesso-portal`.

### Fora do escopo (FASE 2C-6)
- Upload do contrato assinado.
- Validação ICP-Brasil/GOV.BR do PDF assinado.
- Liberação de processo/checklist/execução operacional.
- Bloqueio "tentativa_acesso_servico_bloqueado_por_contrato_pendente" (depende do gate operacional, que ainda não existe).

### Resumo das proibições respeitadas
- Sem WMTi (`customers/payments/contracts/quotes`).
- Sem `post-purchase.ts`, sem `ensureClientAccess`.
- Sem `ArsenalGate`, sem `ArsenalBlockedPanel`, sem `qa_arsenal_access_gate`.
- Sem criação de processo/checklist.
- Sem senha em texto puro no e-mail (link de ativação OTP).
- Sem duplicação de cliente/usuário (idempotente por `email` + `portal_provisionado_em`).
- Sem alteração do webhook ou do contrato.

## Regra canônica Arsenal

**Arsenal Inteligente é gratuito** e permanece acessível para todo cliente. Contrato assinado libera apenas execução do serviço contratado.
