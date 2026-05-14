# FASE 2C-0 REVISADA — Auditoria + redesenho do fluxo e-commerce Quero Armas

> **Sem código nesta fase.** Apenas relatório do estado atual e plano em fases pequenas para o fluxo correto:
> `carrinho → pagamento → contrato → portal liberado / Arsenal bloqueado → contrato assinado e validado → Arsenal liberado`.

---

## 1. O que JÁ existe hoje (carrinho → portal)

### 1.1 Carrinho (frontend)
- `src/shared/cart/CartProvider.tsx` — carrinho client-side, persistido em `localStorage` (`eqa.cart.v1`). **Apenas 1 item por pedido** (`addItem` substitui o conteúdo). Não há tabela `qa_carrinhos` no banco.
- `src/pages/CarrinhoPage.tsx` — UI do carrinho. Botão **Finalizar contratação** redireciona para `/area-do-cliente/contratar/<slug>/identificar` (fluxo público de contratação).

### 1.2 Checkout / criação da venda
- Página `QAContratarPublicoPage.tsx` chama edge `qa-contratar-publico`.
- Edge `qa-contratar-publico` chama RPC `qa_cliente_criar_contratacao_publico`, que cria/encontra o `qa_clientes` (status `cadastro_em_preenchimento`) e insere `qa_vendas` + `qa_itens_venda` + evento.
- **Não cria cobrança Asaas.** A venda nasce pendente; o pagamento depende de a equipe aprovar o valor e clicar em "Gerar cobrança" em `QAVendasPendentesPage` → edge `qa-venda-gerar-cobranca` (FASE 2B-2).

### 1.3 Pagamento
- Edge `qa-venda-gerar-cobranca` cria customer/charge no Asaas e grava `asaas_payment_id`/`cobranca_status='aguardando_pagamento'` em `qa_vendas`.
- Webhook `qa-asaas-webhook` (FASE 2C-1) marca `status='PAGO'` + `cobranca_status='confirmada'` quando recebe `PAYMENT_CONFIRMED/RECEIVED`.
- Trigger `qa_vendas_after_pago_generate_contract` já existe e dispara `qa-generate-contract`.

### 1.4 Contrato
- Tabelas isoladas QA: `qa_contracts`, `qa_contract_items`, `qa_contract_signatures`, `qa_contract_events` (BLOCO 10 já implementado).
- Edges existentes:
  - `qa-generate-contract` — gera PDF, snapshot dos itens, hash SHA-256.
  - `qa-sign-contract-company` — assinatura A1 ICP-Brasil pela contratada (reusa `sign-contract-pdf`).
  - `qa-serve-contract-pdf` — proxy autenticado para download.
  - `qa-upload-signed-contract` — recebe PDF assinado pelo cliente.
  - `qa-validate-customer-signature` + `qa-validate-govbr-signature` — validação criptográfica PAdES/ICP-Brasil/Gov.br (forge, sem OCR).

### 1.5 Portal do cliente
- `QAClientePortalPage.tsx` (1.898 linhas) já existe e renderiza dashboard, processos, documentos, etc. **Sem gate de Arsenal hoje.**
- Acesso ao portal é criado por `qa-cliente-criar-conta-publica` e pelo trigger pós-pagamento.

### 1.6 Legado WMTi (NÃO usar)
- `asaas-webhook` (raiz), `_shared/post-purchase.ts`, `ensureClientAccess`, `customers`, `quotes`, `contracts`, `payments`, `create-asaas-payment`, `create-asaas-subscription`, `generate-paid-contract-pdf`. Tudo permanece intocado.

---

## 2. O que precisa ser DESPRIORIZADO da lógica anterior

| Item | Razão | Ação |
|---|---|---|
| "Equipe aprova valor antes da cobrança" como **caminho principal** | Fluxo correto é e-commerce direto. | Manter código existente, mas mover para **rota de exceção** (venda assistida). Marcar `qa_vendas.cobranca_origem='venda_assistida'` quando vier desse caminho. |
| Botão "Gerar cobrança" como ÚNICO disparador de pagamento | Bloqueia o fluxo do site. | Manter para casos manuais. Adicionar disparador automático no checkout público. |
| `QAContratarPublicoPage` terminar em "venda criada, aguarde a equipe" | Quebra o fluxo de e-commerce. | Após criar venda, redirecionar para link de pagamento Asaas (gerado na hora). |
| `qa-contratar-publico` exigir `valor_informado` do frontend | Risco de adulteração. | Já é confiável no backend (a edge `qa-venda-gerar-cobranca` ignora o valor do front e usa `valor_aprovado` do DB). Reforçar: checkout público deve usar **preço do catálogo** (`qa_servicos_catalogo.preco_base_centavos`) como `valor_aprovado` e `valor_informado`, sem campo editável. |

---

## 3. Arquivos seguindo lógica errada / a ajustar

| Arquivo | Problema | Tratamento esperado (em fases futuras) |
|---|---|---|
| `src/pages/CarrinhoPage.tsx` | Redireciona para fluxo "identificar → aguardar equipe". | Mudar destino para `/checkout/qa/<slug>` (novo) que cria venda + cobrança Asaas direto. |
| `src/pages/quero-armas/QAContratarPublicoPage.tsx` | Mostra "valor informado" e termina em pendência. | Virar fluxo de **identificação leve** (CPF/email/telefone) que conclui criando venda PAGÁVEL imediatamente. |
| `src/pages/quero-armas/QAContratarSucessoPage.tsx` | Estado final é "aguarde equipe". | Mostrar status real (cobrança gerada → link Asaas → pagamento confirmado → contrato disponível). |
| `supabase/functions/qa-contratar-publico/index.ts` | Não dispara cobrança. | Após RPC criar venda, invocar **internamente** `qa-venda-gerar-cobranca` (modo sistema, sem `requireQAStaff`) usando preço de catálogo. Marcar `cobranca_origem='checkout_publico'`. |
| `src/pages/quero-armas/QAClientePortalPage.tsx` | Não tem gate de Arsenal. | Adicionar consulta a `qa_arsenal_access_gate` e wrapper `<ArsenalGate>` em todos os blocos operacionais. |
| `src/pages/quero-armas/QAVendasPendentesPage.tsx` | Posicionado como fluxo principal. | Renomear semanticamente para "Vendas assistidas / exceções". |

---

## 4. Tabelas `qa_*` que são fonte de verdade

| Domínio | Tabela | Papel |
|---|---|---|
| Catálogo | `qa_servicos_catalogo` | Preço, descrição, slug. Lido **apenas no momento do checkout**. |
| Venda | `qa_vendas` | Pedido. Status: `aguardando_pagamento` → `PAGO`. |
| Itens | `qa_itens_venda` | Snapshot de cada serviço comprado (já é snapshot). |
| Cobrança | `qa_vendas.asaas_*` + `qa_pagamento_auditoria` | Vínculo Asaas, idempotência. |
| Webhook | `qa_asaas_webhook_events` | Auditoria/idempotência do webhook QA. |
| Contrato | `qa_contracts` + `qa_contract_items` + `qa_contract_signatures` + `qa_contract_events` | Snapshot imutável + assinaturas + auditoria. |
| Acesso ao portal | `qa_clientes` + `qa_cliente_credenciais` | Conta criada após pagamento confirmado. |
| **Gate Arsenal (NOVO)** | `qa_arsenal_access_gate` | Estado canônico de liberação operacional por cliente. |
| Operação | `qa_solicitacoes_servico`, `qa_processos`, `qa_processo_documentos` | **Só nascem após** `qa_arsenal_access_gate.estado='liberado'`. |

---

## 5. Precisa criar `qa_carrinhos` / `qa_carrinho_itens`?

**Não nesta fase.** Justificativa:

- O carrinho atual é `localStorage` + 1 item por pedido (regra explícita do produto: 1 serviço = 1 venda).
- A "persistência server-side" do carrinho seria custosa e sem ROI imediato.
- A transição "carrinho → venda" pode ser **direta**: ao finalizar, criar `qa_vendas` + `qa_itens_venda` + cobrança Asaas em uma única chamada.
- Caso futuramente o produto suporte multi-serviço/recuperação de carrinho abandonado, criar `qa_carrinhos` aí.

**Decisão:** manter `localStorage` como buffer e usar `qa_vendas`/`qa_itens_venda` como fonte de verdade a partir do checkout.

---

## 6. Como `qa_vendas`/`qa_itens_venda` nascem do carrinho

Fluxo proposto (na FASE 2C-2):

```text
CarrinhoPage (Finalizar)
        │
        ▼
/checkout/qa/<slug>  (página leve: CPF, nome, email, telefone)
        │  POST
        ▼
edge qa-checkout-publico (NOVA, substitui qa-contratar-publico no fluxo principal)
   1. Resolve qa_clientes (CPF) ou cria status='cadastro_em_preenchimento'
   2. Lê qa_servicos_catalogo pelo slug → snapshot de preço
   3. Cria qa_vendas (status='aguardando_pagamento', cobranca_origem='checkout_publico',
      valor_aprovado=preço catálogo, status_validacao_valor='aprovado_automatico')
   4. Cria qa_itens_venda (snapshot)
   5. Invoca qa-venda-gerar-cobranca (modo sistema, billingType=PIX por padrão)
   6. Devolve { venda_id, asaas_invoice_url, asaas_pix_payload }
        │
        ▼
QAContratarSucessoPage exibe link de pagamento Asaas
```

`qa-contratar-publico` antigo permanece como rota de exceção para "venda assistida".

---

## 7. Como o pagamento gera contrato

Já está pronto:
- `qa-asaas-webhook` recebe `PAYMENT_CONFIRMED/RECEIVED` → grava `status='PAGO'`.
- Trigger `qa_vendas_after_pago_generate_contract` invoca `qa-generate-contract` → cria `qa_contracts` + snapshot + PDF original.
- Edge admin `qa-sign-contract-company` assina pela contratada.
- Status final do contrato: `pending_customer_signature`.

Nenhuma mudança necessária aqui.

---

## 8. Como o acesso ao portal é criado

- Hoje: `qa-cliente-criar-conta-publica` cria conta de auth.
- Plano: adicionar passo automático no webhook (já no ramo QA do `qa-asaas-webhook`):
  - Se `qa_clientes.user_id IS NULL` quando `PAGO` → invocar `qa-cliente-criar-conta-publica` e enviar e-mail de boas-vindas com link mágico.
  - Inserir registro em `qa_arsenal_access_gate` com `estado='bloqueado_aguardando_assinatura'`.
- Cliente loga e vê o portal **com Arsenal bloqueado**.

---

## 9. Como o Arsenal fica bloqueado

**Tabela canônica nova `qa_arsenal_access_gate`** (PROPOSTA — não implementar ainda):

| Coluna | Tipo | Descrição |
|---|---|---|
| `cliente_id` | `int` PK | FK `qa_clientes.id` |
| `estado` | `text` CHECK | `bloqueado_pagamento_pendente`, `bloqueado_contrato_nao_gerado`, `bloqueado_aguardando_assinatura`, `bloqueado_assinatura_invalida`, `bloqueado_revisao_manual`, `liberado` |
| `motivo` | `text` | Mensagem amigável para o cliente |
| `contract_id` | `uuid` | FK `qa_contracts.id` que governa o gate atual |
| `liberado_em` | `timestamptz` | Quando entrou em `liberado` |
| `bloqueado_em` | `timestamptz` | Última transição para qualquer estado bloqueado |
| `updated_at` / `created_at` | `timestamptz` | |

RLS: cliente lê o próprio (`qa_current_cliente_id(auth.uid())`); staff lê tudo; service_role escreve.

**Hook UI:** `useArsenalGate(clienteId)` → bloqueia componentes operacionais e mostra `<ArsenalBlockedPanel motivo={...} />` com call-to-action correto (pagar / baixar contrato / enviar assinado / aguardar revisão).

**Componentes afetados** dentro de `QAClientePortalPage`: blocos de Processos, Solicitações, Documentos operacionais, Munições, Armamentos. **Tudo o que NÃO depende de gate (perfil, contrato, suporte, financeiro)** continua acessível.

---

## 10. Como o contrato assinado é validado

Já existe (`qa-validate-customer-signature` + `qa-validate-govbr-signature`):
1. Cliente faz upload via `qa-upload-signed-contract`.
2. Edge calcula SHA-256 e confere com `qa_contracts.company_signed_sha256`/`original_sha256` (integridade do documento base).
3. Extrai PKCS#7 (PAdES) com `node-forge`, valida cadeia ICP-Brasil/Gov.br.
4. Cruza CPF do signatário com `qa_clientes.cpf`.
5. Define `validation_status`:
   - `valid` → libera Arsenal (passo 11).
   - `invalid` → `qa_arsenal_access_gate.estado='bloqueado_assinatura_invalida'` + UI pede reenvio.
   - `indeterminate` → `bloqueado_revisao_manual` + alerta para equipe.

**Não usar OCR como prova.** Já está implementado assim.

Complementar (próxima fase): adicionar link para validador oficial ITI (`https://validar.iti.gov.br/`) no painel do cliente, para auto-conferência.

---

## 11. Como o Arsenal é liberado após validação

Trigger ou patch na edge `qa-validate-customer-signature` (FASE 2C-5):

1. Quando `qa_contracts.validation_status='valid'`:
   - `UPDATE qa_arsenal_access_gate SET estado='liberado', liberado_em=now(), contract_id=...`
   - Inserir `qa_contract_events('released_to_arsenal', ...)`.
2. Para cada `qa_contract_items`:
   - Criar (se não existir) `qa_solicitacoes_servico` + `qa_processos`.
   - Materializar `qa_processo_documentos` conforme `qa_servicos_documentos` (checklist por serviço).
   - Reaproveitar documentos já aprovados do cliente (`qa_documentos_cliente` com `status='aprovado'` e tipo compatível).
3. Notificação push/email "Seu Arsenal está liberado".

**Bloqueio defensivo:** mesmo que algum bug crie `qa_processos` antes, o gate de UI nega acesso, e RLS adicional em `qa_processos` (próxima fase) pode exigir `qa_arsenal_access_gate.estado='liberado'` via função `qa_arsenal_liberado(cliente_id)`.

---

## 12. Plano de implementação em fases pequenas

> Cada fase é independente, com migration mínima, sem mexer em fluxo legado.

### FASE 2C-2 — Checkout público direto (carrinho → cobrança)
- Nova edge `qa-checkout-publico` que combina `qa_cliente_criar_contratacao_publico` + `qa-venda-gerar-cobranca` (modo sistema, billingType=PIX).
- `CarrinhoPage` redireciona para nova rota `/checkout/qa/<slug>`.
- Nova página `QACheckoutPublicoPage` (CPF/email/telefone → "Finalizar e pagar").
- `QAContratarSucessoPage` adapta para mostrar link Asaas/PIX.
- Migration: adicionar `cobranca_origem='checkout_publico'` no enum/CHECK existente; default `status_validacao_valor='aprovado_automatico'` quando origem é checkout público.
- Nada removido. Fluxo "vendas assistidas" continua para exceções.

### FASE 2C-3 — Provisionamento de portal automático no webhook
- Patch `qa-asaas-webhook`: ao confirmar pagamento, se `qa_clientes.user_id IS NULL`, invocar `qa-cliente-criar-conta-publica` e enviar boas-vindas.
- Idempotente, registrar em `qa_pagamento_auditoria`.

### FASE 2C-4 — Tabela `qa_arsenal_access_gate` + bloqueio de UI
- Migration: criar tabela + RLS + função `qa_arsenal_liberado(cliente_id)`.
- Trigger pós-`PAGO`: insere/atualiza gate com `estado='bloqueado_aguardando_assinatura'`.
- Trigger pós-`qa_contracts.validation_status` muda: atualiza gate.
- Hook `useArsenalGate` + componente `<ArsenalBlockedPanel>` em `QAClientePortalPage`.
- Bloqueio em blocos operacionais (Processos, Munições, Armamentos, Solicitações).

### FASE 2C-5 — Liberação operacional pós-assinatura
- Patch `qa-validate-customer-signature`: ao status `valid`, materializar `qa_solicitacoes_servico`/`qa_processos`/`qa_processo_documentos` por item snapshotado.
- Reaproveitamento de documentos aprovados.
- Notificação ao cliente.

### FASE 2C-6 — Endurecimento RLS
- RLS em `qa_processos`/`qa_solicitacoes_servico` exigindo `qa_arsenal_liberado(cliente_id)` para SELECT/UPDATE pelo cliente.
- Mantém staff e service_role sem restrição.

### FASE 2C-7 — Polimento UX
- Link para validador ITI no portal.
- Estados visuais detalhados do gate.
- Telemetria do funil (carrinho → pagamento → contrato → assinatura → liberação).

---

## Garantias preservadas

- ✅ Fluxo WMTi intocado: zero alteração em `payments/contracts/quotes/customers/post-purchase.ts/ensureClientAccess`.
- ✅ Fluxo de "venda assistida" preservado para exceções.
- ✅ Arsenal liberado **somente** com contrato validado criptograficamente.
- ✅ Snapshot imutável em `qa_contract_items` continua sendo a fonte para o operacional.
- ✅ Nenhuma migration destrutiva.

> Aguardando autorização para iniciar pela **FASE 2C-2**.
