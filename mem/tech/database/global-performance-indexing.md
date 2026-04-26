---
name: Global performance indexing (Onda 7)
description: Índices criados em Onda 7 cobrindo FKs sem índice e colunas de filtro frequente em todo o schema (contratos, fiscal, QA, auth, leads)
type: feature
---
A Onda 7 aplicou ~60 índices via migration idempotente (CREATE INDEX IF NOT EXISTS):

- 39 FKs sem índice (client_events, contracts, fiscal_*, lp_*, payments, proposals, qa_*, quotes, revenue_intelligence, service_requests, signature_logs)
- Status/datas operacionais (contracts.status, payments.payment_status, payments.due_date, fiscal_documents.status/asaas_invoice_id, integration_logs.created_at, logs_sistema.created_at)
- Índice parcial fiscal_documents.is_active WHERE is_active=true
- Buscas frequentes: customers(email,user_id), leads(email,created_at), qa_clientes(email,status,user_id)
- Autorização: user_roles(user_id,role), cliente_auth_links(user_id,qa_cliente_id,status)

NOTA: payments usa `payment_status` (não `status`). customers não tem `cpf_cnpj`. blog_posts não existe.

Pendências (Onda 8): Security Definer View, mover pgvector/unaccent para schema dedicado, revisar RLS policies com USING(true) em mutations.
