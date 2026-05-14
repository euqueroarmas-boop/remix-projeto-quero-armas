
# FASE 2C-4 — Contrato pós-pagamento, Arsenal sempre gratuito

## Diagnóstico (auditoria já realizada)

Auditei o estado atual via `psql` e encontrei **dois problemas críticos** antes de tocar em qualquer outra coisa:

### Problema 1 — Trigger não gera contrato

A trigger `qa_vendas_after_pago_generate_contract` **tem o nome certo, mas faz a coisa errada**: chama `qa_arsenal_processar_pagamento_venda(NEW.id)`, que faz upgrade do Arsenal para "premium" — **não** gera contrato. Por isso a venda 999901 está `PAGO` há horas e **não existe nenhum registro em `qa_contracts` / `qa_contract_items` / `qa_contract_events`**.

A edge `qa-generate-contract` existe e está pronta (snapshot dos itens, PDF, SHA-256, status `generated_pending_company_signature`, idempotente por `UNIQUE(venda_id)`), mas **ninguém a chama no fluxo automático**.

### Problema 2 — Arsenal hoje é tratado como premium pago

O schema/triggers atuais assumem o modelo antigo:
- `qa_clientes.arsenal_plano` ('free' / 'premium'), `arsenal_status`
- Trigger `trg_qa_vendas_arsenal_upgrade*` faz `arsenal_plano='premium'` no PAGO
- Notificação "Seu Arsenal Premium foi liberado!"
- `.lovable/plan.md` inteiro descreve `qa_arsenal_access_gate`, `<ArsenalBlockedPanel>`, RLS bloqueando Arsenal

Isso **viola a nova regra**: "Arsenal Inteligente é gratuito e nunca deve ser bloqueado".

A venda 999901 também não tem `qa_itens_venda` (zero linhas), então preciso criar uma segunda venda de teste com itens para validar o snapshot real.

## Escopo

### TAREFA 1 — `.lovable/plan.md`
Reescrever as seções 4, 9, 11 e a Fase 2C-4 do plano. Remover toda menção a `qa_arsenal_access_gate`, `<ArsenalBlockedPanel>`, "Arsenal bloqueado/liberado por contrato". Substituir pela regra: "Arsenal é gratuito e permanece acessível. O contrato assinado libera apenas o serviço contratado, processo, checklist e execução operacional."

### TAREFA 2 — Corrigir trigger pós-pagamento (migration mínima)
Substituir o corpo da função `qa_vendas_after_pago_invoke_contract()` para realmente invocar `qa-generate-contract` via `pg_net.http_post` (mesmo padrão de `qa_vendas_provisionar_portal_on_pago`):
- Dispara só na transição `OLD.status <> 'PAGO' AND NEW.status = 'PAGO'`
- Idempotente (a edge já garante via `UNIQUE(venda_id)`)
- **Não** chama Arsenal, processo, checklist, WMTi

Desativar `trg_qa_vendas_arsenal_upgrade` e `trg_qa_vendas_arsenal_upgrade_insert` (Arsenal é gratuito para todos). **Não** removo as colunas `arsenal_plano`/`arsenal_status` (zero regression).

Webhook `qa-asaas-webhook` continua só mudando `qa_vendas` para PAGO — não chama contrato manualmente.

### TAREFA 3 — Status do contrato
Mantenho o existente: `status='generated_pending_company_signature'` na criação. Schema já cobre `venda_id`, `cliente_id`, `status`, `original_sha256`, `original_pdf_path`, `issued_at`, `created_at`, `updated_at` + tabela de eventos. Nada novo precisa.

### TAREFA 4 — Portal (`QAClientePortalPage.tsx`)
Adicionar **um card "Contratos pós-pagamento"** que lista, por venda PAGA do cliente:
- Número da venda + valor + data
- Status do contrato (gerado / aguardando assinatura)
- Botão "Baixar contrato" (chama `qa-serve-contract-pdf` existente)
- Texto: "Assine digitalmente pelo GOV.BR/ICP-Brasil e envie o PDF assinado."
- Lista de itens contratados, cada um com badge **"Aguardando contrato assinado"**

**Não** adicionar gate, wrapper, ou bloqueio em nada do Arsenal. Cadastro acervo, documentos, alertas, recomendações, contratação continuam livres.

### TAREFA 5 — Serviço aguardando contrato
Apenas representação **visual** no card acima. **Não** crio `qa_solicitacoes_servico` agora (risco de misturar arquitetura, conforme orientação da fase). Os itens vivem em `qa_contract_items` com status derivado do contrato pai.

### TAREFA 6 — Acesso ao portal
A trigger `qa_vendas_provisionar_portal_on_pago` **já existe** e provisiona acesso no PAGO. Não mexo. Documento o fluxo no resumo final.

### TAREFA 7 — Auditoria
Eventos novos em `qa_contract_events`:
- `contrato_gerado_pos_pagamento` (registrado pela edge logo após `generated`)
- `contrato_disponibilizado_portal` (registrado no primeiro fetch do portal)

`servico_aguardando_contrato_assinado` é estado derivado — sem evento próprio. **Nunca** registro "arsenal bloqueado".

### TAREFA 8 — Testes
Novo arquivo `src/lib/quero-armas/__tests__/contratoPosPagamento.test.ts` validando:
1. Snapshot — alteração no catálogo não muda `qa_contract_items`
2. Status PAGO → contrato esperado; outros status → não
3. Webhook não chama `qa-generate-contract` (grep no source da edge)
4. Arsenal não é bloqueado por contrato pendente (UI helper)
5. Sem referências a `payments/contracts/quotes/customers/post-purchase/ensureClientAccess`
6. Trigger não cria processo/checklist

Itens "contrato aparece no portal" e "venda PAGO real gera contrato" são validados manualmente com `psql` + venda de teste 999902 (com itens). Resultado entregue no resumo.

### TAREFA 9 — Limpeza de teste
Marcar 999901 e 999902 com `observacoes_internas='[TESTE 2C-4 SANDBOX]'` para não contaminar painel operacional.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `.lovable/plan.md` | Reescrita das seções de Arsenal |
| `supabase/migrations/<novo>.sql` | `qa_vendas_after_pago_invoke_contract` chama qa-generate-contract via pg_net; desativa triggers de Arsenal upgrade |
| `supabase/functions/qa-generate-contract/index.ts` | Adicionar evento `contrato_gerado_pos_pagamento` |
| `src/pages/quero-armas/QAClientePortalPage.tsx` | Card "Contratos pós-pagamento" + itens aguardando |
| `src/components/quero-armas/portal/ContratosPosPagamentoCard.tsx` | Novo componente (manter portal page legível) |
| `src/lib/quero-armas/__tests__/contratoPosPagamento.test.ts` | Novo arquivo de testes |
| `mem://index.md` | Core: "Arsenal sempre gratuito; contrato libera só o serviço" |

## O que **não** vou fazer
- Não criar processo, checklist, protocolo, `qa_solicitacoes_servico`
- Não validar assinatura digital ainda
- Não chamar `qa-generate-contract` pelo webhook
- Não tocar `asaas-webhook` legado, WMTi, `payments/contracts/quotes/customers`, `post-purchase.ts`, `ensureClientAccess`
- Não bloquear nada do Arsenal
- Não remover colunas `arsenal_plano/arsenal_status` (apenas desativo trigger)

## Validação final
`npm run typecheck` + testes unitários + `npm run build` + curl manual da edge na venda 999902. Resumo nos 10 itens pedidos.

Aprova para eu executar?
