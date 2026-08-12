# Segurança — pendências abertas

Auditoria de 2026-08-11. Verificações feitas de fora, contra produção, com a chave
`anon` pública — não por leitura de código.

**Regra de leitura:** o repositório **não** é fonte da verdade deste projeto. Policies,
GRANTs e corpos de função foram alterados por SQL colado no editor do Supabase. Confirme
sempre no banco (`pg_policies`, `pg_proc`, `has_function_privilege`) antes de agir.

---

## ✅ Corrigido em 2026-08-11

**Vazamento da base de clientes sem autenticação.**
`qa_painel_progresso_clientes()` devolvia, sem login, nome, e-mail, serviço, fase e
protocolo de todos os clientes (confirmado: HTTP 200, 22 clientes). O mesmo valia para
`qa_email_disparos_resumo`, `qa_email_painel_facetas`, `qa_email_painel`,
`qa_email_por_cliente`, `qa_email_por_cliente_detalhe` e `qa_cliente_dependencias`.

Causa raiz: **faltava `REVOKE EXECUTE ... FROM PUBLIC`.** Os GRANTs sempre estiveram
certos (`authenticated` + `service_role`); no Postgres, toda função nasce com `EXECUTE`
para `PUBLIC` e `anon` herda isso — `GRANT TO authenticated` adiciona, não remove.

Corrigido com REVOKE nas 7 funções. Verificado: as 7 retornam `42501 permission denied`
para a chave anon. Sem regressão (leituras públicas e cadastro intactos).

**Guard de staff em `qa_painel_progresso_clientes()`.**
O REVOKE fecha `anon`, mas `authenticated` inclui quem se cadastra sozinho
(`qa-cliente-criar-conta-publica` é público) — bastava criar conta para voltar a ler a
base. Aplicado guard no corpo:

```sql
WHERE (b.total_docs>0 OR b.bloqueado)
  AND (public.qa_is_active_staff(auth.uid())
       OR coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role');
```

A condição `service_role` é obrigatória: a edge function `qa-inatividade-cobranca` chama
esta RPC com `SUPABASE_SERVICE_ROLE_KEY`, e nessas chamadas `auth.uid()` é `NULL`. Sem o
`OR`, o motor de cobrança receberia zero linhas **em silêncio**, sem erro.

Aplicado com o padrão ler → `replace` → `EXECUTE` sobre `pg_get_functiondef()`, nunca a
partir de arquivo (ver "Armadilhas").

---

## 🔴 Pendente — CRÍTICO

### 1. Guard de staff nas demais RPCs de painel
Falta o mesmo tratamento em `qa_email_disparos_resumo`, `qa_email_painel_facetas`,
`qa_email_painel`, `qa_email_por_cliente`, `qa_email_por_cliente_detalhe` e
`qa_cliente_dependencias`. Hoje só têm o REVOKE de `anon` — cliente comum logado ainda
alcança.

**Antes de aplicar em cada uma: mapear quem a consome no backend.** Foi esse mapeamento
que evitou quebrar o motor de cobrança em `qa_painel_progresso_clientes`. Buscar em
`supabase/functions/*/index.ts` por chamadas com service role.

### 2. 71 funções `SECURITY DEFINER` nunca auditadas
São 89 chamáveis por `anon`; apenas 18 foram inspecionadas, e ~8 dessas eram
exploráveis. As outras 71 não têm veredito.

Query de levantamento:
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as retorno,
       (p.provolatile = 'v') as e_mutante
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prosecdef
  and pg_get_function_result(p.oid) <> 'trigger'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by e_mutante desc, p.proname;
```

### 3. 17 funções sem argumento, várias mutantes — não testadas
Perigosas porque não exigem adivinhar ID. **Não foram testadas de propósito**: testar
significaria executá-las em produção.

```
_qa_purge_legacy_fase2                    qa_gov_reconcile_realign_atomic
qa_sweep_indeferimento_por_prazo          qa_sync_fila_enfileirar_abertos
qa_gen_temp_password                      qa_exigencias_retroativas
qa_reabrir_exigencias_documento_invalido  qa_test_fase42_run
qa_gov_reconcile_build_plan               qa_gov_reconcile_build_plan_safe
qa_gerar_protocolo_chat
```
Confirmadas **abertas** a anon: `qa_remove_bg_usage_mes`, `qa_suporte_sessao_ativa`.
Confirmada protegida: `qa_gov_recon_cpf_summary`.

---

## 🟠 Pendente — ALTO

### 4. Divergência migrations × banco
21 policies permissivas continuam vivas nos arquivos e **não** existem no banco
(`Anon full access qa_clientes`, `Anon full access qa_crafs`, `anon_full_qa_doc_cliente`,
`Anon full access qa_cadastro_cr`, …).

Produção está segura por um estado que só existe no banco. **Restore, staging ou ambiente
novo reabre acesso anônimo a clientes, CRAFs e documentos.** Congelar o estado real numa
migration gerada a partir de `pg_policies`.

### 5. `anon` tem GRANT de tabela em ~200 tabelas
Hoje o RLS segura, mas é rede de segunda linha: se uma policy permissiva voltar por
engano, o GRANT já está aberto.

Risco de corrigir é **menor do que parece**: o site público não grava direto em tabela
nenhuma — tudo passa por edge function com service role (`qa-cadastro-publico`,
`qa-cadastro-refinado-persistir-docs`, `qa-checkout-status`, `qa-contract-aceite-registrar`,
`qa-contratar-publico`). As 14 escritas diretas do browser são de telas logadas
(`authenticated`, não `anon`). Ainda assim: validar em staging com cadastro ponta a ponta.

### 6. `verify_jwt = true` não é autenticação
A chave `anon` é um JWT válido assinado pelo projeto e está no HTML. Confirmado:
`qa-gerar-procuracao` executa só com ela. **163 das 197 functions não estão declaradas no
`config.toml`** e dependem exclusivamente da guarda interna. Auditar caso a caso.

---

## 🟡 Pendente — MÉDIO

### 7. `customer-lookup-email` — código morto, mas deployado
Recebe CPF/CNPJ e devolve o e-mail do cliente. Sem auth, sem rate limit, CORS `*`, service
role. Nenhuma tela usa (`src/lib/customerResolver.ts` não é importado), mas **responde
HTTP 200** — atacante chama o endpoint direto. Deletar a function, o `customerResolver.ts`
e a entrada no `config.toml`. Exige Publish.

### 8. `qa-cliente-checar-existente` — oráculo de CPF
Devolve `{"cpf_existe":bool}` sem auth e sem rate limit (12 chamadas seguidas → 12× 200).
Confirma quem é cliente, ou seja, quem tem/está adquirindo arma.

**Não dá para fechar** — é usada de verdade em `QACadastroPublicoPage.tsx:345` e
`cadastro-refinado/steps/Etapa03Revisao.tsx:168` e `:217`. Mitigar com Turnstile + rate
limit por IP e resposta genérica após o limite. Definir o número antes de implementar.

### 9. Signed URL de 30 dias
`supabase/functions/qa-efetiva-aprovar/index.ts:300` →
`createSignedUrl(path, 60*60*24*30)`. É o único acima de 1h; o resto fica entre 10s e
3600s. Reduzir para 24h ou servir via edge function autenticada.

---

## 🟢 Pendente — BAIXO

### 10. `_qa_diag_release_token()`
Responde a anônimos com `{"len":64,"has_token":true}`. Endpoint de diagnóstico. Remover
se não for mais usado.

### 11. 5 funções `SECURITY DEFINER` sem `search_path` fixo
Escalada de privilégio clássica. `alter function ... set search_path = public`.

### 12. Links públicos de contrato/procuração não expiram
`qa-contrato-view-public`, `qa-procuracao-view-public`, `qa-serve-procuracao-pdf` usam
"UUID = segredo". O UUID não é adivinhável, mas o link vale para sempre. Avaliar expiração.

### 13. Buckets públicos a revisar
`support-tools` e `test-artifacts` estão `public = true`. Confirmar se precisam ser.
(Os buckets com documento de cliente — `qa-documentos`, `paid-contracts`,
`qa-chat-anexos`, `qa-cadastro-selfies`, `certificates` — estão corretamente privados.)

---

## Armadilhas conhecidas

**Nunca faça `CREATE OR REPLACE` de função a partir de arquivo de migration.**
Algumas funções foram alteradas em produção por migrations que leem o corpo vivo com
`pg_get_functiondef()`, fazem `replace()` e reexecutam — exemplo:
`supabase/migrations/20260810205032_*.sql`, que corrige `ultima_atividade` dentro de
`qa_painel_progresso_clientes()`. O corpo real **não existe em arquivo nenhum**. Recriar a
partir do repo reverte esses patches em silêncio.

Para alterar uma função: ou use o padrão ler → `replace` → `EXECUTE` (que falha com
exceção se a expressão não bater), ou renomeie a original e crie um wrapper — nunca
reescreva o corpo às cegas.

**`PGRST202` não prova bloqueio.** Significa assinatura errada. Só `42501
permission denied` prova que a permissão foi removida.

**`qa_cliente_notificacoes_ativas` não é função de painel.** É do portal do CLIENTE
(`src/components/quero-armas/portal/NotificacaoEngineOverlay.tsx:88`). Pôr
`qa_is_active_staff()` nela quebra o portal de todos os clientes. Precisa de escopo
"só as minhas", não de staff.
