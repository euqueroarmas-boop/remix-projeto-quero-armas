# Deploy — auditoria do fluxo de posse/autorização

**Fechado em 18/08/2026, 11:22 BRT.** Cobre os commits `d55dd5d` → `61b6f4f` na
`main` (escopo de ataque F1–F11 + reauditoria).

> **NÃO HÁ NADA PENDENTE.** Todas as edge functions da auditoria estão
> publicadas e todas as migrations estão aplicadas e conferidas. Este documento
> vira registro histórico: use-o como modelo quando houver uma leva nova.

O push para a `main` publica o front. **Edge function não sai junto** — precisa
de Publish no Lovable (ou `supabase functions deploy` pelo CLI).

---

## Estado final

| | |
|---|---|
| **Migrations** | 7 criadas · **7 aplicadas** · todas conferidas |
| **Leva 1** | 13 funções · publicada em **18/08 às 00:08 BRT** |
| **Leva 2** | 9 funções · publicada em **18/08 às 01:20 BRT** |
| **Leva 3** | 1 função (`qa-export-docx`) · publicada em **18/08 às 11:22 BRT** |

### Migrations — todas aplicadas e conferidas

| Arquivo | O que faz | Conferido |
|---|---|---|
| `20260818100000` | Fecha o acesso anônimo a `qa_geracoes_pecas` | ✅ 4 policies, zero `anon` |
| `20260818110000` | Colunas `protocolo_*` em `qa_processos` | ✅ 6 colunas |
| `20260818120000` | Tabela `qa_processo_juntadas` | ✅ 2 policies |
| `20260818130000` | Ciclo de aprovação da peça | ✅ 2 peças, ambas `nao_enviada` |
| `20260818140000` | Colunas de deferimento em `qa_processos` | ✅ 3 deferidos, 0 não confirmados |
| `20260818150000` | Gatilho que espelha o status do processo na solicitação | ✅ conferência voltou **zero linhas** |
| `20260818160000` | `qa_geracoes_own` deixa de ser `FOR ALL` | ✅ 5 policies, sem INSERT/DELETE para `authenticated` |

---

## Histórico das levas

### Leva 1 — 13 funções · 18/08, 00:08 BRT

F1–F7: prazos processuais, grupos de checklist, escopo da efetiva necessidade,
juntada versionada, exigências da PF, gate de conclusão do checklist.

### Leva 2 — 9 funções · 18/08, 01:20 BRT

**Novas (4)** — primeiro deploy:

| Função | Chamada por | Ator |
|---|---|---|
| `qa-peca-enviar-cliente` | painel da equipe | equipe |
| `qa-peca-aprovar-cliente` | portal do cliente | cliente |
| `qa-recurso-protocolar` | painel da equipe | equipe |
| `qa-processo-deferir` | painel + portal | equipe e cliente |

**Alterada (1):** `qa-processo-checar-conclusao-checklist` — gate que impede o
processo de virar `pronto_para_protocolar` com petição aguardando ou devolvida.

**Arrastadas pelo registry (4)** — quatro templates novos
(`peca-pronta-aprovacao`, `peca-decidida-equipe`, `recurso-protocolado`,
`processo-deferido`), embutidos no bundle de cada uma:
`send-transactional-email`, `preview-transactional-email`,
`qa-enviar-email-template`, `qa-send-all-templates-preview`.

### Leva 3 — 1 função · 18/08, 11:22 BRT

`qa-export-docx` — passou a exportar o texto que o cliente aprovou
(`texto_final`) em vez da minuta original (`minuta_gerada`). Sem isso, a correção
feita pelo cliente na petição não chegava ao documento protocolado: pior do que
não ter ciclo de aprovação, porque criava a falsa garantia de que chegava.

---

## Conferência depois do deploy

### 1. Os cinco templates novos estão no ar — **ainda em aberto**

Abra o preview de e-mails e confirme que aparecem:

- **Exigência da PF respondida (equipe)**
- **Petição pronta para aprovação (cliente)**
- **Petição decidida pelo cliente (equipe)**
- **Recurso protocolado (cliente)**
- **Processo deferido — documento entregue (cliente)**

É o item que quebra em silêncio: se o registry não pegou, os envios falham em
runtime por template inexistente, e só se descobre na hora do disparo real.

**Se algum não estiver lá:** republicar `send-transactional-email`,
`preview-transactional-email`, `qa-enviar-email-template` e
`qa-send-all-templates-preview`.

### 2. As pontas do fluxo, com um caso real

Não há como conferir por SQL antes de alguém usar. Quando usar, esta consulta
mostra se cada ponta gravou — seção vazia significa "ainda não usado", com linha
significa "funcionando":

```sql
SELECT 'A PECA'::text AS secao, id::text AS item,
       status_cliente AS detalhe,
       COALESCE(aprovada_cliente_em::text, enviada_cliente_em::text, '—') AS valor
  FROM public.qa_geracoes_pecas WHERE status_cliente <> 'nao_enviada'
UNION ALL
SELECT 'B RECURSO', id::text, status,
       COALESCE(numero_protocolo, '—')
  FROM public.qa_processo_recursos WHERE status = 'protocolado'
UNION ALL
SELECT 'C DEFERIMENTO', p.id::text, COALESCE(p.deferimento_numero, '—'),
       COALESCE(p.deferimento_data::text, '—')
  FROM public.qa_processos p WHERE p.deferimento_documento_id IS NOT NULL
UNION ALL
SELECT 'D JUNTADA', j.processo_id::text, 'v' || j.versao || ' · ' || j.paginas || ' pág',
       to_char(j.montada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
  FROM public.qa_processo_juntadas j
ORDER BY 1, 2;
```

### 3. Ainda pendente — prazo do recurso

Prova definitiva de que o prazo do recurso parou de alarmar: painel de prazos no
dashboard, ou `qa-processo-prazo-alertas` com `{"dry_run": true}`. Ver
`docs/PENDENCIAS-ABERTAS.md`.

---

## Regra permanente

Mudança em `supabase/functions/_shared/` obriga a republicar **todas** as
funções que importam o arquivo — o módulo é embutido no bundle de cada uma, não
compartilhado em runtime. O caso mais comum é o registry de templates de e-mail.
