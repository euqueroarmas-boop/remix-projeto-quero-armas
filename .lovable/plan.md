## FASE 2C-9 — Homologação real em sandbox

### Premissa importante (ler antes de aprovar)

Você pediu **Asaas sandbox real + webhook real**. Há uma limitação de ambiente que precisa ficar explícita:

- A **cobrança no Asaas sandbox** sim, é possível: `qa-checkout-iniciar-pagamento` chama o Asaas com `ASAAS_API_KEY` e `ASAAS_BASE_URL` já configurados.
- Já o **webhook de retorno** do Asaas é entregue **de forma assíncrona** (Asaas decide quando), e em sandbox **só dispara `PAYMENT_CONFIRMED` quando alguém marca o pagamento como recebido manualmente** no painel sandbox do Asaas. Não dá para esperar isso de forma determinística dentro desta sessão.
- Para manter "real ponta a ponta", o que farei é: **criar a cobrança real no Asaas sandbox** (charge_id real) e depois **chamar a edge `qa-asaas-webhook`** enviando um payload `PAYMENT_CONFIRMED` apontando para esse `payment_id` real, com o header `asaas-access-token` válido (`QA_ASAAS_WEBHOOK_TOKEN`). Isso exercita o mesmo caminho de código que a entrega real do Asaas exercitaria — só estou "antecipando" o webhook.
- Se você quiser **esperar o Asaas mandar de verdade**, precisa marcar o pagamento como recebido no painel sandbox e me avisar; aí eu só verifico o efeito no banco.

Confirme se posso proceder antecipando o webhook (recomendo) ou se quer pausar entre os passos para marcar manualmente no Asaas.

### Marker e isolamento

Todos os registros criados levam:
- `HOMOLOG_2C9_` no nome / e-mail / `motivo_correcao` / metadados;
- e-mail `homolog_2c9_<timestamp>@example.com` (não real);
- CPF fictício válido por dígito verificador (gerado, não real);
- nada toca WMTi (`customers`, `payments`, `contracts`, `quotes`), `post-purchase.ts` ou `ensureClientAccess`.

### Execução proposta (sequencial)

1. **Discovery** — ler schema das tabelas envolvidas e escolher 1 serviço de catálogo com `gera_processo=true` para acionar o caminho de processo+checklist.
2. **Cliente HOMOLOG_2C9** — `INSERT` em `qa_clientes` via tool de migration (estrutura) ou insert (dados); marcado com `nome_completo='HOMOLOG_2C9 CLIENTE TESTE'`, `observacao='[HOMOLOG_2C9]'`.
3. **Venda + itens** — chamar **`qa-checkout-criar-venda`** real (edge), passando o cliente HOMOLOG_2C9 e 1 item do catálogo escolhido. Marcar `motivo_correcao='[HOMOLOG_2C9]'` se a edge aceitar.
4. **Pagamento sandbox** — chamar **`qa-checkout-iniciar-pagamento`** real → cobrança real no Asaas sandbox; capturar `asaas_payment_id`.
5. **Webhook** — chamar **`qa-asaas-webhook`** com `PAYMENT_CONFIRMED` apontando para o `asaas_payment_id` real (header `asaas-access-token=QA_ASAAS_WEBHOOK_TOKEN`).
6. **Verificação financeira** — `SELECT` confirmando `qa_vendas.status='PAGO'` e `cobranca_status='confirmada'`, e `qa_asaas_webhook_events` com success.
7. **Trigger pós-PAGO** — verificar `qa_contracts`, `qa_contract_items`, `qa_contract_events` (`generated`, `contrato_gerado_pos_pagamento`) e provisão do portal (`qa_clientes.portal_provisionado_em`, `user_id` linkado, sem WMTi).
8. **Upload do contrato assinado (placeholder)** — chamar `qa-upload-signed-contract` com PDF placeholder marcado `HOMOLOG_2C9_signed.pdf`. Esperado: `qa-validate-customer-signature` rejeita ou marca `pending_manual_review` (não libera serviço). Confirmar via `SELECT` que `qa_solicitacoes_servico` ainda **não existe**.
9. **Validação controlada** — `UPDATE qa_contracts SET status='validated', validation_status='valid', validation_details = jsonb_set(... ,'{homolog_2c9}','true')` (marca explícita de teste). Isso dispara o trigger `qa_contracts_after_validated_release` que chama `qa-liberar-servicos-contrato` com `x-internal-token` do Vault.
10. **Verificação operacional** — `SELECT` confirmando `qa_solicitacoes_servico` (por `item_venda_id`, com `origem='contrato_validado'`), `qa_processos` (se `gera_processo=true`), checklist criado pela RPC canônica, e eventos `contrato_validado_liberacao_concluida`.
11. **Replay/idempotência** — `UPDATE` redundante reaplicando o mesmo `validated`/disparando a edge novamente; confirmar zero duplicação (mesmos IDs).
12. **Arsenal e WMTi** — verificar:
    - `qa_clientes.arsenal_plano` permanece `gratuito`;
    - sem evento `arsenal_bloqueado`;
    - `SELECT count(*) FROM customers/payments/contracts/quotes WHERE ... HOMOLOG_2C9` = 0.
13. **Validações locais** — `npm run typecheck`, `npm run test`, `npm run build`.
14. **Entrega** — relatório com IDs criados, prints SQL, confirmações exigidas e **SQL de cleanup sugerido** (não executado).

### Cleanup (entregue, não executado)

```sql
-- Conferir antes de rodar:
SELECT id FROM qa_clientes WHERE nome_completo LIKE 'HOMOLOG_2C9%';

-- Deleção em cascata em ordem segura (a executar apenas com autorização):
DELETE FROM qa_solicitacoes_servico WHERE venda_id IN (SELECT id FROM qa_vendas WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_processos WHERE venda_id IN (SELECT id FROM qa_vendas WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_contract_events WHERE contract_id IN (SELECT id FROM qa_contracts WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_contract_items   WHERE contract_id IN (SELECT id FROM qa_contracts WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_contract_signatures WHERE contract_id IN (SELECT id FROM qa_contracts WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_contracts WHERE motivo_correcao LIKE '%HOMOLOG_2C9%';
DELETE FROM qa_asaas_webhook_events WHERE payment_id IN (SELECT asaas_payment_id FROM qa_vendas WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_itens_venda WHERE venda_id IN (SELECT id FROM qa_vendas WHERE motivo_correcao LIKE '%HOMOLOG_2C9%');
DELETE FROM qa_vendas WHERE motivo_correcao LIKE '%HOMOLOG_2C9%';
DELETE FROM qa_clientes WHERE nome_completo LIKE 'HOMOLOG_2C9%';
```

### O que NÃO farei

- Não tocarei WMTi (`customers/payments/contracts/quotes`).
- Não importarei `post-purchase.ts` nem chamarei `ensureClientAccess`.
- Não bloquearei o Arsenal nem mudarei `arsenal_plano` para `premium`.
- Não chamarei `qa-generate-contract` manualmente (só via trigger pós-PAGO).
- Não executarei o SQL de cleanup.
- Não usarei nenhum cliente, venda, CPF, e-mail ou telefone real.

### Ponto que precisa do seu OK antes de eu rodar

1. Aprovar antecipar o webhook chamando `qa-asaas-webhook` direto com o `payment_id` real do Asaas sandbox (em vez de esperar Asaas entregar de verdade).
2. Aprovar criar uma cobrança real no Asaas sandbox em nome do cliente HOMOLOG_2C9 (gera registro permanente no painel sandbox do Asaas, mas sem custo financeiro).

Confirme com "ok pode rodar" e sigo a execução de A a Z em uma única passada.