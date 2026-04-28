---
name: P0 Senha GOV Cross-Tenant Postmortem
description: Postmortem and permanent guardrails for the 26/04 incident where qa_cadastro_cr.cliente_id was crossed
type: feature
---
**Incidente (26/04/2026):** 80 de 89 CRs em qa_cadastro_cr tiveram cliente_id reescrito errado, expondo Senha GOV de um cliente para outro.

**Mitigação aplicada:**
- Reconciliação por log `acao=migrate` (fonte da verdade).
- Edge Function `qa-senha-gov`: exige `cliente_id` em get/set; mismatch → 409 + log `denied_mismatch`.
- 9 CRs duplicados órfãos marcados `consolidado_em` (preservados, mas inativos).
- Índices únicos: `uq_qa_cadastro_cr_cliente_ativo` (1 CR ativo por cliente) e `uq_qa_cadastro_cr_cliente_numero`.
- Trigger `trg_qa_cadastro_cr_audit_cliente` registra qualquer mudança futura de cliente_id.
- Snapshots: `qa_cadastro_cr_backup_p0`, `qa_incident_reconciliation_snapshot`, `qa_cadastro_cr_consolidacao_snapshot` (RLS staff-only).

**Regras permanentes:**
- `SenhaGovField` NUNCA carrega senha automaticamente (revelação manual + `clienteId` obrigatório).
- Toda consulta a `qa_cadastro_cr` por cliente deve filtrar `consolidado_em IS NULL`.
- `getSenhaGov`/`setSenhaGov` são proibidos sem `clienteId`.
- Trocar de cliente/CR em qualquer componente DEVE limpar estado local de senha.
- Teste anti-regressão: `src/components/quero-armas/clientes/__tests__/senhaGov.regression.test.tsx`.
