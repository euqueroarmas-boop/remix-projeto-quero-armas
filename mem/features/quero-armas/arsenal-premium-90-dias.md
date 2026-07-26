---
name: Arsenal Premium 90 dias grátis
description: Ao assinar o contrato de serviço (qa_contracts.status='validated'), o cliente ganha 90 dias grátis do Arsenal Inteligente Premium; substitui a regra antiga "Arsenal nunca bloqueado".
type: feature
---

**Gatilho:** `qa_contracts.status` muda para `'validated'` (contrato assinado pelo cliente e validado).

**Ação automática (idempotente):**
- Insere linha em `qa_arsenal_assinaturas` com `status='gratuidade'`, `origem_gratuidade='servico_contratado'`, `periodo_inicio=hoje (BRT)`, `periodo_fim=hoje+90 dias`.
- Atualiza `qa_clientes.arsenal_plano='premium'`, `arsenal_status='ativo'`, `arsenal_upgrade_em=now()`.
- Se já existe gratuidade/ativa vigente, não duplica.

**Implementação:**
- Função: `public.qa_conceder_arsenal_premium_gratuito(cliente_id bigint, dias int default 90, origem text default 'servico_contratado')` (SECURITY DEFINER).
- Trigger: `trg_qa_contracts_conceder_arsenal_premium` AFTER UPDATE OF status ON `qa_contracts`.
- Front consome via `useArsenalPremium` (já lê `qa_arsenal_assinaturas`).

**Substitui:** a regra antiga "Arsenal Inteligente é gratuito e NUNCA bloqueado / sem `arsenal_plano='premium'` automático". Agora o Arsenal tem Free vs Premium, e a assinatura do contrato concede Premium por 90 dias automaticamente (após esse período, cai para Free e o cliente é convidado a assinar a anuidade).

**Não muda:** liberação de execução de serviço continua condicionada a contrato validado + criação de `qa_processos` via `qa-liberar-servicos-contrato`. O Premium grátis é adicional, não substitui esse fluxo.