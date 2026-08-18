# PENDÊNCIA — excluir os serviços de dois clientes legados

**Status:** aguardando decisão do usuário sobre três blocos-limite.
**Aberta em:** 18/08/2026, durante a auditoria de ponta a ponta do fluxo de posse/autorização.
**SQL de apoio:** `supabase/_diagnostico_inventario_exclusao_servicos.sql` (somente leitura).

---

## Por que existe

Dois clientes têm deferimentos **reais, mas anteriores à automação**. Eles foram
marcados como protocolados/deferidos pelo seletor livre de status — caminho fechado
na Fase 2. Consequência: nenhum tem número de protocolo, data, órgão, evento
`processo_protocolado` no histórico, nem recebeu o e-mail de protocolo. Hoje contam
como **3 deferidos** nos KPIs, sem lastro nenhum.

Decisão do usuário (17/08/2026): **excluir todos os serviços dos dois, deixando só o
cadastro.** Quando voltarem como clientes do Arsenal Inteligente, enviam apenas os
documentos das armas.

## Quem são

| Cliente | id | CPF |
|---|---|---|
| Eduardo Rizek Elias | 183 | 301.647.088-80 |
| Wilker Soares Fonseca | 164 | 016.180.651-14 |

## Inventário levantado (18/08/2026)

Varredura do catálogo do banco por `cliente_id` / `qa_cliente_id`:

| Tabela | Linhas | Destino |
|---|---|---|
| `qa_processo_documentos` | 39 | SAI (cascata do processo) |
| `qa_admin_notificacoes` | 27 | SAI |
| `qa_status_eventos` | 8 | **em aberto** (auditoria) |
| `qa_contracts` | 5 | SAI |
| `qa_processos` | 5 | SAI |
| `qa_protocolos` | 5 | SAI |
| `qa_venda_eventos` | 5 | SAI |
| `qa_vendas` | 5 | SAI |
| `qa_exames_cliente` | 4 | **em aberto** |
| `qa_senha_gov_acessos` | 3 | **em aberto** (auditoria) |
| `cliente_auth_links` | 2 | FICA |
| `qa_arsenal_assinaturas` | 2 | **em aberto** (Arsenal) |
| `qa_cliente_credenciais` | 2 | FICA |
| `qa_cliente_credenciais_audit` | 2 | FICA |
| `qa_cadastro_cr` | 1 | **em aberto** (Arsenal) |
| `qa_documentos_golden` | 1 | **em aberto** (treino da IA) |
| `qa_procuracoes` | 1 | **em aberto** |

Zerados (não precisam de tratamento): `qa_documentos_cliente` (Hub),
`qa_cliente_armas`, `qa_crafs`, `qa_gtes`, `qa_solicitacoes_servico`,
`qa_efetiva_necessidade`.

`qa_itens_venda` **não** aparece na varredura porque não tem coluna de cliente —
liga-se por `venda_id`. Precisa de tratamento explícito.

## Decisões pendentes

1. **Exames (4)** — laudo psicológico e de capacidade técnica. Comprados dentro do
   serviço, mas valem ~1 ano no mundo real e seriam reaproveitáveis numa contratação
   futura. Apagar junto?
2. **Procuração (1)** — peça jurídica assinada. Sem serviço ativo perde a função.
   Apagar junto?
3. **CR (1) + assinaturas do Arsenal (2)** — inclinação é MANTER, já que voltam como
   clientes do Arsenal.
4. **Auditoria** — 8 eventos de status, 3 acessos à senha GOV, 1 documento-modelo da
   IA. Recomendação: manter tudo. Os acessos à senha GOV têm histórico de incidente
   (ver `mem://tech/security/p0-incident-postmortem`).

## Mapa de chaves estrangeiras (lido de `pg_constraint`, 18/08/2026)

Filhas de `qa_processos` — todas **CASCADE**, exceto uma:
`qa_efetiva_necessidade`, `qa_processo_documentos`, `qa_processo_eventos`,
`qa_processo_manifestacoes_pf`, `qa_processo_recursos`,
`qa_processos_alertas_enviados`.
**`qa_solicitacoes_servico` é SET NULL** — fica órfã, precisa de DELETE explícito.

Filhas de `qa_vendas`:
`qa_venda_eventos` CASCADE · **`qa_contracts` RESTRICT** · **`qa_itens_venda` RESTRICT**
(há duas constraints na mesma coluna, uma SET NULL e uma RESTRICT — vence a RESTRICT).
Ou seja: **contratos e itens têm de morrer ANTES da venda.**

Filhas de `qa_contracts` — todas CASCADE: `qa_contract_aceites_log`,
`qa_contract_events`, `qa_contract_items`, `qa_contract_signatures`.

Filhas de `qa_efetiva_necessidade` — todas CASCADE: `_acrescimos`, `_auditoria`,
`_provas`, `qa_efetiva_teses`.

`qa_protocolos` tem `venda_id` mas **sem** FK — vira órfã, precisa de DELETE explícito.

## Gatilhos que interferem no DELETE

- **`qa_venda_eventos_imutavel`** — barra o DELETE com exceção. Passa se o papel for
  `service_role`, **ou** se `app.allow_venda_evento_delete = 'on'` na sessão, **ou**
  se o usuário for `eu@queroarmas.com.br`. No SQL Editor não há JWT: **é obrigatório
  ligar o interruptor de sessão.**
- **`qa_vendas_after_delete_cleanup_processos`** — ao apagar a venda, ela mesma apaga
  `qa_processos WHERE venda_id = OLD.id`, ligando `qa.allow_processo_cascade_delete`.
- **`qa_itens_venda_after_delete_cleanup_processos`** — idem, por item, casando
  `venda_id` (aceitando `id_legado`) e `servico_id`.
- **`qa_emu_bloqueia_compra`** (em `qa_vendas` e `qa_itens_venda`) — retorna cedo
  quando `auth.uid() IS NULL`. **Não atrapalha no SQL Editor.**
- `qa_emu_rastro` e `qa_proc_docs_recalc_prazos_del` — apenas registram/recalculam,
  não barram.

## Por que não usar a função que já existe

`qa_venda_excluir_total(venda_id)` faz exatamente este trabalho, mas começa com
`IF auth.uid() IS NULL OR NOT qa_is_active_staff(auth.uid()) THEN RAISE`. No SQL
Editor não há sessão autenticada, então ela **sempre recusa**. O script terá de
replicar a lógica dela em DELETEs diretos.

## Ordem correta do DELETE (quando for escrito)

```
BEGIN;
SET LOCAL app.allow_venda_evento_delete   = 'on';
SET LOCAL qa.allow_processo_cascade_delete = 'on';
SET LOCAL qa.allow_total_client_delete     = '1';

1. qa_contracts            (cliente_id)   -- libera o RESTRICT da venda
2. qa_solicitacoes_servico (cliente_id)   -- senão fica órfã por SET NULL
3. qa_processos            (cliente_id)   -- cascata leva os 39 documentos
4. qa_itens_venda          (venda_id)     -- libera o outro RESTRICT
5. qa_venda_eventos        (cliente_id)
6. qa_vendas               (cliente_id)
7. qa_protocolos           (qa_cliente_id)
8. qa_admin_notificacoes   (cliente_id)
   + os blocos em aberto, conforme a decisão
COMMIT;
```

Fechar com um SELECT de conferência — é o único resultado que o editor do Lovable
mostra num lote.
