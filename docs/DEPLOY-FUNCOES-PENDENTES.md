# Deploy — auditoria do fluxo de posse/autorização

**Fechado em 18/08/2026, 11:22 BRT.** Cobre os commits `d55dd5d` → `61b6f4f` na
`main` (escopo de ataque F1–F11 + reauditoria).

## 🟠 PENDENTE — Leva 10 · Concessão de CR (serviço 44)

Aberta em 19/08/2026.

**Migrations — aplicar nesta ordem:**

| Arquivo | O que faz | Estado |
|---|---|---|
| `20260819030000_concessao_cr_checklist_in311` | Monta o checklist do CR pela IN 311/2025 | ✅ aplicada — 47 exigências ativas, nenhuma sem grupo |
| `20260819040000_modalidade_cac_vem_da_compra` | Modalidade CAC passa a vir do item comprado; a pergunta ao cliente sai do checklist | ✅ aplicada — 46 exigências ativas |
| `20260819050000_concessao_cr_e_atirador_esportivo` | Marca `concessao-cr` como atirador desportivo | ✅ aplicada — `modalidade_cac = atirador` |
| `20260819060000_cr_nome_explicito_e_backfill_modalidade` | Nome explícito na vitrine + modalidade nos processos de CR abertos | ✅ aplicada |
| `20260819070000_cr_completa_checklist_dos_processos_abertos` | Completa o checklist dos 2 processos de CR abertos que nasceram com a versão antiga | ✅ aplicada — 35 e 39 exigências |
| `20260819080000_cr_dega_sempre_e_segundo_endereco_declarado` | DEGA sempre obrigatória + declaração positiva/negativa do 2º endereço (achado dos 4 dossiês deferidos) | ✅ aplicada — trio conferido |
| `20260819090000_biblioteca_decore` | Registra o DECORE na Biblioteca (sem virar exigência); o treino do parser é o upload do PDF pela tela | ✅ aplicada — modelo treinado (det+ia) |
| `20260819100000_cr_protocolo_pela_equipe` | Senha GOV abre o grupo Requerimento; juntada sai do CR; declarações exigem assinatura gov.br; requerimento e boleto viram marcos da equipe | ⬜ **a aplicar** |

**Edge functions:**

| Função | Estado |
|---|---|
| `qa-processo-responder-pergunta` | **ALTERADA e depois revertida** — voltou ao conteúdo publicado. Nada a fazer. |

Não há função nova para publicar nesta leva. A `qa-processo-set-modalidade`
chegou a ser escrita e foi removida antes de qualquer deploy: a modalidade não
é escolha do cliente, é carimbo do gatilho de banco.

**Conferência depois das migrations:** criar um processo de CR e verificar que
`qa_processos.modalidade` nasce como `atirador`, sem ninguém escolher nada.

---

## ✅ Leva 11 · Central de Adesão — atualizar o cadastro existente

Publicada em **19/08/2026, 12:40 BRT**.

| Função | Estado | O que quebra sem ela |
|---|---|---|
| `qa-central-adesao-salvar-cliente` | ✅ publicada (primeiro deploy) | A Etapa 4 grava o cadastro existente pelo caminho alternativo (UPDATE direto do front, sem a validação de service role) |

Migrations: nenhuma nesta leva.

**Conferência:** rodar a Etapa 4 com um CPF já cadastrado, clicar em
*Atualizar cadastro existente* e conferir que `qa_clientes.updated_at` mudou e
que o endereço lido no documento entrou no registro antigo, sem criar um
segundo cliente com o mesmo CPF.

---

> **NÃO HÁ NADA PENDENTE.** As 9 levas estão publicadas e as 9 migrations
> aplicadas e conferidas. Este documento vira registro histórico: use-o como
> modelo quando houver uma leva nova.
>
> **Horário:** todos os registros abaixo estão em BRT (São Paulo), convenção
> firmada pelo titular em 18/08/2026.

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
| **Leva 4** | 3 funções (petição vira arquivo) · publicada em **18/08 às 12:19 BRT** |
| **Leva 5** | 5 funções (resposta à notificação) · publicada em **18/08 às 12:54 BRT** |
| **Leva 6** | 1 função (`qa-processo-prazo-alertas`) · publicada em **18/08 às 13:07 BRT** |
| **Leva 7** | 2 funções (fila de conferência + fim do serviço) · publicada em **18/08 às 18:44 BRT** |
| **Leva 8** | 3 funções (classificação do requerimento) · publicada em **18/08 às 18:48 BRT** |
| **Leva 9** | 1 função (`qa-vencimentos-alertas`) · publicada em **18/08 às 20:36 BRT** |

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
| `20260818170000` | Petição aprovada vira arquivo (3 colunas) | ✅ tipos regerados pelo Lovable |
| `20260818180000` | Resposta à notificação fecha o prazo (4 colunas) | ✅ consulta de alarme falso rodou |

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

---

## Leva 8 — classificação do requerimento · 18/08, 18:48 BRT

Trabalho feito em **outra sessão** (commits `4624a10` às 19:02 UTC e `6872970`
às 19:24 UTC de 18/08). Ficou de fora de todas as levas desta auditoria porque
os comandos de deploy foram montados a partir do que ESTA sessão alterou.

| Função | O que mudou |
|---|---|
| `qa-classificar-documento-arma` | tipo novo no enum e no prompt; regra determinística com precedência |
| `qa-extract-documents` | parser do requerimento roda antes da IA; conferência campo a campo contra o cadastro |
| `qa-processo-doc-validar-ia` | acompanha a reclassificação |

**Por que importava:** o formulário que abre o processo de posse traz um número
de 18 dígitos e nenhum classificador tinha esse tipo na lista. A IA devolvia
"PROTOCOLO DO PROCESSO" com 98% de confiança, o slot pedia o requerimento, e o
Hub carimbava REPROVADO em cima do documento certo. O cliente reenviava e dava o
mesmo erro, sem fim.

**Lição do processo, não do código:** estas três escaparam de sete levas porque
os comandos de deploy foram montados a partir do que UMA sessão alterou, e não
do que a `main` acumulou. O jeito certo de fechar uma leva é comparar o
repositório com a última publicação — `git diff --name-only <ref>..HEAD --
supabase/functions/` — e não a memória de quem escreveu.

Nenhum arquivo de `_shared/` foi tocado nesses dois commits — não há efeito
cascata sobre outras funções.


---

## Leva 9 — aviso de vencimento do dossiê · 18/08, 20:36 BRT

`qa-vencimentos-alertas` passou a vigiar também `qa_processo_documentos` (o
checklist do processo), sob a fonte `DOSSIE`. Antes ela só olhava o Hub, e os
dois pontos que enxergam validade no processo são reativos — disparam no clique
de montar a juntada, quando o processo já deveria estar indo para a delegacia.

## Como fechar uma leva sem esquecer nada

O erro que produziu a leva 8 foi montar o comando pelo que UMA sessão alterou.
O jeito certo é perguntar ao repositório:

```
git diff --name-only <commit-da-ultima-leva>..HEAD -- supabase/functions/ \
  | sed 's|supabase/functions/||' | cut -d/ -f1 | sort -u
```

Marcos de referência: leva 7 = `36119e9`, leva 8 = `6872970`, leva 9 = `d7babbf`.
Se a lista voltar vazia, não há deploy pendente.

## Leva 10 — regra "vencido não vira cobrança imediata" (19/08/2026)

Motivo: `supabase/functions/_shared/reemissaoVencido.ts` (novo) e
`_shared/checklistVisibility.ts` (alterado) mudam o que conta como pendência.
Sem o redeploy, o banco marca a exigência como `expirado` e as funções antigas
continuam contando isso como pendência — o processo nunca chega a
`pronto_para_protocolar` e a reemissão nunca é pedida.

ALTERADAS (redeploy obrigatório):
- supabase/functions/qa-processo-checar-conclusao-checklist/index.ts
- supabase/functions/qa-processo-etapa-auto-liberar/index.ts

## Leva 12 — aviso de recusa volta a chegar ao portal do cliente (19/08/2026)

Motivo: as duas funções gravavam em `qa_notificacoes_cliente` um valor de
`urgencia` que a tabela não aceita (`alta` e `atencao`, contra o CHECK que só
admite `urgente`/`normal`). O banco recusava a linha, o try/catch engolia o
erro e o cliente nunca via o aviso — enquanto a equipe recebia o espelho na
Central de Notificação normalmente. Sem o redeploy, o front publicado continua
conversando com as funções velhas e o aviso segue sumindo.

ALTERADAS (redeploy obrigatório):
- supabase/functions/qa-notify-event/index.ts — sem ela, certidão recusada e
  documento recusado continuam sem avisar o cliente no portal.
- supabase/functions/qa-inatividade-cobranca/index.ts — sem ela, o lembrete de
  processo parado continua sem aparecer no portal.

## Leva 13 — proteção contra compra repetida por engano (19/08/2026)

Motivo: auditoria do cliente 236 (RICARDO ADRIANO MIRANDA) mostrou o mesmo
carrinho fechado duas vezes com quatro minutos de diferença — duas vendas, dois
contratos assinados e seis processos no lugar de três. Todas as travas de
idempotência são por VENDA, então nenhuma delas enxerga a segunda compra.

A função passa a recusar UM caso só: o mesmo serviço comprado nos últimos 30
minutos. Não é limite de quantidade — quantas armas o cliente pode ter é
assunto do órgão, não do checkout. E não vira pedido de autorização: quem está
comprando confirma na própria tela (`recompra_confirmada`) e a venda sai.

ALTERADAS (redeploy obrigatório):
- supabase/functions/qa-checkout-criar-venda/index.ts — sem ela, o clique
  repetido de quem não viu a confirmação do pagamento continua virando uma
  segunda venda com processos duplicados.
