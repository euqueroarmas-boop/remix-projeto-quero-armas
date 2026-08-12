# Auditoria de Segurança — Somente Diagnóstico

Nenhum arquivo do projeto foi alterado, nenhuma migration criada, nada publicado. Todo SQL abaixo é sugestão escrita, não aplicada.

## Resposta curta

**Não** pelo caminho de banco/storage, **mas sim** por um caminho novo que a auditoria externa não viu: a função `qa_painel_progresso_clientes()` é chamável por `anon` e devolve nome, e-mail, serviço, fase e protocolo de **todos** os clientes. Documento e endereço de guarda continuam protegidos.

---

## CRÍTICO 1 — RPCs `SECURITY DEFINER` chamáveis por `anon` vazam e mutam dados

**Evidência (teste ao vivo com a chave anon, produção):**

```text
POST /rest/v1/rpc/qa_painel_progresso_clientes  -> 200
[{"cliente_id":225,"cliente_nome":"FABIO CORREIA DE MELO",
  "cliente_email":"fabiocorre2023@gmail.com",
  "servico_nome":"AUTORIZACAO DE COMPRA / POSSE DE ARMA DE FOGO",
  "fase":"OCUPACAO LICITA", ...}]
POST /rest/v1/rpc/qa_email_disparos_resumo -> 200 {"total":844,"hoje":147,"falhas":8}
POST /rest/v1/rpc/qa_cliente_dependencias {"p_cliente_id":1} -> 200 (mapa de acervo/documentos)
POST /rest/v1/rpc/_qa_diag_release_token -> 200 {"len":64,"has_token":true}
```

`has_function_privilege('anon', oid, 'EXECUTE')` retorna **89 funções SECURITY DEFINER não-trigger**. Das 18 mais sensíveis que inspecionei no corpo, **8 não têm nenhuma guarda interna** (`auth.uid()`, `qa_is_active_staff`, `service_role`):

| Função | Classe | Risco |
|---|---|---|
| `qa_painel_progresso_clientes()` | lista completa de clientes (nome, e-mail, fase, protocolo) | **CRÍTICO — confirmado ao vivo** |
| `qa_email_painel(...)`, `qa_email_por_cliente(...)` | e-mails e assuntos de todos os clientes | CRÍTICO |
| `qa_confirmar_pagamento_processo(...)` | **muta**: marca processo como pago | CRÍTICO |
| `qa_conceder_arsenal_premium_gratuito(...)` | **muta**: concede plano | ALTO |
| `qa_arma_manual_upsert(...)` | **muta**: grava arma/CRAF em qualquer cliente | ALTO |
| `qa_cliente_notificacoes_ativas(p_cliente_id)` | notificações de qualquer cliente | ALTO |
| `qa_cliente_criar_contratacao_publico(...)` | cria venda (fluxo público legítimo) | revisar |
| `_qa_diag_release_token()` | endpoint de diagnóstico | BAIXO |

Com guarda interna confirmada (**falso positivo, não exploráveis**): `qa_cliente_excluir_total`, `_v2`, `qa_cliente_arquivar`, `qa_cliente_restaurar`, `qa_atualizar_dados_basicos_cliente`, `qa_cadastro_publico_excluir_total`, `qa_venda_excluir_total`, `qa_venda_aprovar_valor`, `qa_processo_trocar_servico`, `qa_vincular_por_cpf`.

**Exploração concreta:** qualquer pessoa com a chave anon (está no HTML) baixa a base completa de clientes com e-mail e estágio do processo — a lista de alvos perfeita — e ainda pode marcar processos como pagos.

**Correção sugerida (não aplicada):**

```sql
revoke execute on function public.qa_painel_progresso_clientes() from public, anon;
grant  execute on function public.qa_painel_progresso_clientes() to authenticated;

revoke execute on function public.qa_email_painel(timestamptz,timestamptz,text,text,text,integer,integer) from public, anon;
revoke execute on function public.qa_email_painel_facetas() from public, anon;
revoke execute on function public.qa_email_por_cliente(timestamptz,timestamptz,integer) from public, anon;
revoke execute on function public.qa_email_por_cliente_detalhe(text,timestamptz,timestamptz,integer) from public, anon;
revoke execute on function public.qa_email_disparos_resumo() from public, anon;
revoke execute on function public.qa_confirmar_pagamento_processo(uuid,text,boolean) from public, anon, authenticated;
revoke execute on function public.qa_conceder_arsenal_premium_gratuito(bigint,integer,text) from public, anon, authenticated;
revoke execute on function public.qa_arma_manual_upsert(integer,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public, anon;
revoke execute on function public.qa_cliente_notificacoes_ativas(integer) from public, anon;
revoke execute on function public.qa_cliente_dependencias(integer) from public, anon;
revoke execute on function public.qa_carimbos_conexao_cliente(integer) from public, anon;
drop function if exists public._qa_diag_release_token();
-- e, dentro das funções de painel, exigir staff:
--   if not public.qa_is_active_staff(auth.uid()) then raise exception 'nao autorizado'; end if;
```

**O que quebra:** nada no site público. Os painéis (`DashboardProgressoClientes`, painel de e-mails) rodam logados, então `authenticated` mantém acesso. Manter `grant execute ... to service_role` nas duas mutantes, que são chamadas por edge functions.

---

## ALTO 2 — `anon` tem GRANT total de tabela em quase todo o schema public

**Evidência:** `aclexplode(relacl)` mostra `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES` para `anon` em ~200 tabelas, incluindo `qa_clientes`, `qa_documentos_cliente`, `qa_crafs`, `qa_cadastro_cr`. Hoje **o RLS segura**: só existem 3 policies com role `anon` em tabelas sensíveis, todas `INSERT` (`contracts`, `customers`, `proposals`).

**Exploração concreta:** hoje nenhuma. É risco de segunda linha — se uma policy permissiva voltar por engano, o GRANT já está aberto.

**Correção sugerida:** `revoke all on all tables in schema public from anon;` seguido de re-grant explícito: `select` em `blog_posts_ai, cms_*, cep_cache, cnpj_cache, contract_templates` e `insert` em `contracts, customers, proposals, budget_leads, client_events, contract_equipment, contract_signatures, fiscal_documents`.
**O que quebra:** checkout e cadastro público, se a lista de re-grant estiver incompleta. Exige teste em staging antes.

---

## ALTO 3 — Divergência migrations x banco (confirmada)

**Evidência:** as 13 policies permissivas testadas (`Anon full access qa_clientes`, `Anon full access qa_crafs`, `anon_full_qa_doc_cliente`, `Anon full access qa_cadastro_cr`, etc.) retornam **zero linhas** em `pg_policies`. Não existem no banco, mas continuam vivas nos arquivos de migration.

Seu diagnóstico está correto: produção travada, repositório não. Restore ou ambiente novo reabre tudo.

**Correção sugerida — esqueleto da migration de congelamento:**

```sql
-- 1) apaga os fantasmas, idempotente
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies
           where schemaname='public' and policyname ilike 'anon%full%'
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- 2) reafirma RLS em todas as tabelas public
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind='r'
  loop execute format('alter table public.%I enable row level security', r.relname); end loop;
end $$;
```

O corpo completo (todas as policies atuais, uma a uma) deve ser gerado por dump de `pg_policies` e commitado como fonte da verdade — recomendo um passo dedicado só para isso.
**O que quebra:** nada, se gerado a partir do estado atual.

---

## MÉDIO 4 — `customer-lookup-email` é código morto

**Evidência:** `src/lib/customerResolver.ts:74` é o único ponto que a chama, e `rg` por `customerResolver` em `src/` e `supabase/` não encontra **nenhum import** — o módulo não é usado por nenhuma tela.
**Correção sugerida:** deletar a edge function e o arquivo. **O que quebra:** nada.

## MÉDIO 5 — `qa-cliente-checar-existente` é usada de verdade

**Evidência:** `src/pages/quero-armas/QACadastroPublicoPage.tsx:345`, `src/pages/quero-armas/cadastro-refinado/steps/Etapa03Revisao.tsx:168` e `:217`.
**Exploração:** oráculo de CPF (confirma quem é cliente). Não dá para fechar sem quebrar o cadastro público.
**Correção sugerida:** manter pública com Turnstile + rate limit por IP (ex.: 10/min) e resposta genérica após o limite.

## MÉDIO 6 — `verify_jwt` não é autenticação

**Evidência:** `supabase/config.toml` declara **34 de 198** funções. A chave anon é um JWT válido publicado no HTML — confirmado por você em `qa-gerar-procuracao`. Cada função não declarada depende exclusivamente da guarda interna.
**Correção sugerida:** declarar todas no `config.toml` e auditar guarda caso a caso. Não há atalho.

## MÉDIO 7 — Signed URL de 30 dias

**Evidência:** `supabase/functions/qa-efetiva-aprovar/index.ts:300` → `createSignedUrl(path, 60*60*24*30)`. É o **único** acima de 1h; todo o resto fica entre 10s e 3600s (`qa-cliente-avatar/index.ts:145` = 3600, `generate-paid-contract-pdf/index.ts:400` = 1h, `qa-serve-contract-pdf` = 600s).
**Correção sugerida:** reduzir para 24h ou servir via edge function autenticada.

## BAIXO 8 — Tabelas com RLS e sem policy (bloqueio total, aparentemente intencional)

`asaas_webhooks`, `qa_asaas_webhook_events`, `qa_cliente_credenciais`, `qa_cliente_credenciais_audit`, `qa_cliente_senha_desafios`, `qa_documento_status_producao`, `qa_documentos_golden`, `qa_protocolos`, `qa_protocolo_sequencias`, `qa_chat_protocolo_seq`, `qa_arsenal_avisos_enviados`. Só service_role acessa — correto para credenciais e webhooks.

## BAIXO 9 — 5 funções SECURITY DEFINER sem `search_path` fixo

Superfície pequena (5, não 239). Correção: `alter function ... set search_path = public`.

---

## Falsos positivos confirmados (com evidência)

- **Policies permissivas antigas ativas** — NÃO existem no banco; `pg_policies` retorna vazio para as 13 testadas.
- **Tabelas sem RLS** — NENHUMA. A query 1.4 retornou zero linhas.
- **Buckets sensíveis públicos** — NÃO. `qa-documentos`, `paid-contracts`, `qa-chat-anexos`, `qa-cadastro-selfies`, `certificates`, `qa-processo-docs`, `qa-geracoes` estão todos `public=false`. Públicos apenas: `blog-images`, `contract-assets`, `qa-armamentos`, `qa-kb-imagens`, `support-tools`, `test-artifacts`.
- **Storage anon** — a única escrita anônima é upload de selfie restrito a `qa-cadastro-selfies/cadastro-publico/*` (INSERT, sem SELECT), do cadastro público. Vale revisar depois se `support-tools` e `test-artifacts` precisam ser públicos.
- **239 SECURITY DEFINER perigosas** — o número relevante é 89 chamáveis por anon, das quais ~8 realmente exploráveis.

---

## Veredito

**Documentos e endereço de guarda: NÃO acessíveis hoje** — RLS e storage estão fechados, verificado no banco real, não por inferência. **Porém** o caminho de reconhecimento está aberto e é pior do que a medição externa: `qa_painel_progresso_clientes()` entrega sem login a base completa de clientes com nome, e-mail e fase do processo, e `qa_confirmar_pagamento_processo` permite mutação anônima. Prioridade 1 é revogar EXECUTE dessas RPCs.