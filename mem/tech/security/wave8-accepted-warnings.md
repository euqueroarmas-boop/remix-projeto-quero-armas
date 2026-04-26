---
name: Onda 8 — decisões conscientes de hardening
description: Decisões aceitas após Onda 8 sobre extensões em public, policies INSERT(true) do funil público e itens RLS pendentes
type: constraint
---
Hardening da plataforma após Onda 8 (Apr/2026):

**RESOLVIDO:**
- View `qa_exames_cliente_status` recriada com `security_invoker=true` — respeita RLS do consultante.

**ACEITO CONSCIENTEMENTE (não mexer):**
- `pgvector` permanece em schema `public`. Mover quebra colunas `vector` em `qa_embeddings` e funções RAG (`qa_busca_similar`, `qa_busca_auxiliar_caso`). Risco de regressão > benefício do warning.
- `unaccent` permanece em `public`. Funções `qa_resolver_circunscricao_pf` e `qa_listar_municipios_por_uf` chamam explicitamente `public.unaccent`. Mover exigiria refactor coordenado.
- Policies `INSERT WITH CHECK (true)` em `customers`, `contracts`, `contract_equipment`, `contract_signatures`, `fiscal_documents`, `client_events`, `budget_leads`, `cep_cache`, `cnpj_cache`: **necessárias** para o funil público de checkout anônimo (lead → quote → contract → customer sem login). Restringir requer mover todo o funil para edge functions com service-role — refator grande, fora de escopo.

**RLS Enabled No Policy (INFO):** tabelas com RLS sem policies bloqueiam tudo (comportamento esperado para tabelas operadas só por edge functions com service-role). Não exige ação.

**Próxima evolução possível:** se for buscar SOC 2 / ISO, refatorar funil de checkout para edge functions assinadas removeria as policies INSERT(true).
