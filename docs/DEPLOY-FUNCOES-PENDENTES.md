# Deploy — auditoria do fluxo de posse/autorização

## ✅ Leva 17 · Sobras da leva 16 — FECHADA em 21/08/2026, 18:36 BRT

Fechamento das sobras que a revisão apontou e o titular mandou corrigir em
21/08. O problema comum: a leva 16 fez o checklist chamar a certidão pelo
tribunal do estado do cliente, mas OUTROS textos continuaram dizendo São Paulo.
O cliente do Paraná lia "TJPR" no item e "emita no portal do TJSP" no aviso de
vencimento — duas instruções para o mesmo papel.

**Regra adotada:** o texto base fica NEUTRO ("portal do Tribunal de Justiça do
seu estado", "TRF da sua região"), porque é certo em qualquer estado e funciona
nos caminhos que não sabem a UF — principalmente o e-mail. Onde a UF é
conhecida, `aplicarUfEmTexto` especializa para o tribunal com nome e sobrenome.

| Migration | O que faz | Estado |
|---|---|---|
| `20260821060000_tjm_nasce_com_marcacao_de_estado` | Gatilho: linha nova de `antecedentes_militar_estadual` nasce com `condicao_uf = {SP,MG,RS}`. Sem ele, um serviço criado amanhã voltaria a exigir o TJM de todo mundo | ✅ **aplicada 21/08 18:33** — conferência devolveu 0 linhas de TJM sem marcação |

**Edge functions — todas ALTERADAS, publicadas em 21/08 18:36 BRT:**

| Função | O que muda | O que quebra sem ela |
|---|---|---|
| `qa-vencimentos-alertas` ✅ 18:36 | Usa `_shared/nomeDocumento.ts`, cujo texto de "onde emitir" saiu de "TJSP"/"TRF3" para forma neutra | O e-mail de vencimento continua mandando o cliente de fora de SP ao tribunal errado |
| `qa-documento-cliente-notificar` ✅ 18:36 | Mesmo `_shared/nomeDocumento.ts` | Idem, na notificação de documento |
| `qa-montar-juntada` ✅ 18:36 | Usa `_shared/ordemProtocolo.ts`, cujo rótulo de arquivo saiu de "Certidao Justica Federal TRF3/SJSP" para forma neutra | O ZIP entregue continua nomeando o arquivo do cliente do Paraná como "TRF3" |

**Front (vai com o push da `main`):** aviso de vencimento neutro, rótulos do
cofre sem "TJSP", apelido legado do TJM devolvendo o link do tribunal militar
(antes caía no Tribunal de Justiça comum), e `aplicarUfEmTexto` entendendo as
formas neutras.

**Conferido:** gatilho testado em PostgreSQL 16 — TJM de serviço novo nasce
marcado, outros tipos não são tocados, e marcação explícita diferente (`{SP}`)
é respeitada. 1515 testes passando, incluindo 5 novos que travam o texto neutro
e o nome do arquivo do dossiê.

**O que ficou de fora, e por quê:** os documentos já guardados no cofre do
cliente NÃO são renomeados por estado. O cofre guarda certidão de residência
anterior — renomear pelo estado atual marcaria como "TJPR" uma certidão que é
de Minas. O rótulo do TIPO ficou neutro, que resolve a incoerência sem mentir
sobre o papel.

---

## ✅ Leva 16 · Certidão segue o estado do cliente — APLICADA em 21/08/2026, 12:36 BRT

Decisão do titular (21/08): *"o cliente deve receber os links das certidões do
seu estado apenas e os da União. As certidões devem ser disponibilizadas para o
que é possível baixar e quem tem coerência. Não é possível um cliente do Paraná
baixar uma certidão do TJM."*

Antes disso, todo cliente recebia a lista com nome e link de São Paulo, e nos
serviços 44/50/60 recebia a certidão do Tribunal de Justiça Militar como
obrigatória — tribunal que só existe em SP, MG e RS. O cliente do Paraná ficava
com item obrigatório sem onde emitir, e o checklist dele nunca fechava.

| Migration | O que faz | Estado |
|---|---|---|
| `20260821040000_certidoes_por_uf_do_cliente` | Mapa das 27 UFs (`qa_uf_certidao`), normalizador de UF, correção de nome/órgão/link por substituição, coluna `condicao_uf`, montador de checklist com filtro territorial, backfill dos processos em montagem | ✅ **aplicada 21/08 12:36** |
| `20260821050000_sincronizar_checklist_respeita_condicoes` | `qa_catalogo_do_processo` (regra única), botão "sincronizar" e painel de divergência passam a respeitar condição com vírgula, modalidade e UF | ✅ **aplicada 21/08 12:36** |

**Nenhuma edge function foi tocada** — nada a publicar no Lovable nesta leva.

⚠️ **O front ainda NÃO está publicado.** As correções em
`src/lib/quero-armas/linksAntecedentesPorUf.ts` (resolução de link por
igualdade em vez de prefixo, normalização da UF por extenso, TJDFT, e parar de
inventar "TJ Militar/PR") estão na branch `claude/servicos-autorizacao-armas-xbxd09`,
não na `main`. Nada quebra sem elas — o link vem do banco, que já está certo —
mas o popup guiado só melhora depois do merge.

**Conferido em produção em 21/08, 12:37 BRT:**

- mapa: 27 UFs, 3 com TJM, Distrito Federal como `TJDFT`;
- `condicao_uf = {SP,MG,RS}` nas três linhas de `antecedentes_militar_estadual`
  (serviços 44, 50 e 60), todas ativas;
- painel de divergência do serviço 50: 1 processo ativo, 0 divergentes,
  0 faltando, 0 removidas. (Passou a contar 1 e não 2 porque o processo do
  Rivelino está `deferido` — dossiê encerrado saiu do alcance de propósito.)

Antes de subir, a leva passou por revisão adversarial em quatro frentes, que
achou 14 defeitos na primeira versão — entre eles: renomear em massa também as
linhas do cliente de São Paulo, alcançar dossiê já protocolado/deferido,
detectar "documento entregue" por só um dos dois campos de arquivo, e disparar
um aviso falso no sino do Admin por cliente dispensado. Todos corrigidos e
provados em PostgreSQL 16 local com as migrations reais.

---

## ✅ Leva 11 · A GRU só abre depois da defesa aprovada — JÁ APLICADA

**Correção de registro (21/08/2026):** este quadro ficou meses marcado como
🔴 PENDENTE, mas as duas peças JÁ ESTÃO no banco. Conferido em 21/08:
`qa_servicos_catalogo.exige_peca_defesa` existe (SINARM `true`, SIGMA `false`) e
o gatilho `qa_trg_trava_protocolo_sem_defesa` existe. O quadro abaixo fica como
histórico do que a leva continha.

Aberta em 20/08/2026, a partir do processo real do Anthony: documentação
inteira entregue, boleto da GRU aberto no checklist do cliente, e nenhuma peça
gerada na base. A promoção automática a `pronto_para_protocolar` é o que abre a
etapa final (GRU, gov.br, juntada) — e ela não checava se a defesa existia.

**Migration — aplicar antes do deploy da função:**

| Arquivo | O que faz | Estado |
|---|---|---|
| `20260820120000_gru_espera_peca_aprovada` | `qa_servicos_catalogo.exige_peca_defesa` + marcação fail-safe de todo serviço que gera processo | ✅ **aplicada** (coluna conferida em 21/08) |

**Edge function:**

| Arquivo | O que muda | Estado |
|---|---|---|
| `qa-processo-checar-conclusao-checklist` | Gate da defesa: recusa promover enquanto não houver peça `aprovada` nos serviços marcados; procura a peça também pelo cliente (a minuta nasce sem `processo_id`) | ✅ **publicada** (o gatilho de banco que depende da coluna existe) |

Se a função subir sem a migration, `exige_peca_defesa` não existe e a leitura do
catálogo volta vazia — o gate não morde e o furo continua aberto. Se a migration
subir sem a função, nada muda: a coluna fica lá, sem leitor.


**Fechado em 18/08/2026, 11:22 BRT.** Cobre os commits `d55dd5d` → `61b6f4f` na
`main` (escopo de ataque F1–F11 + reauditoria).

## ✅ Leva 10 · Concessão de CR (serviço 44) — FECHADA em 20/08/2026, 12:47 BRT

Todas as migrations aplicadas e conferidas, todos os 8 modelos de declaração no
Storage (sem cabeçalho), link da filiação LNTD no ar, nenhuma edge function
pendente. Fluxo canônico: `mem://features/quero-armas/concessao-cr-fluxo`.
Sobras sem urgência: arquivos de maio no bucket viraram órfãos (podem ser
apagados); modelos-exemplo da Biblioteca (parser) a subir pela tela quando a
equipe quiser — material está nos zips dos dossiês.

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
| `20260819100000_cr_protocolo_pela_equipe` | Senha GOV abre o grupo Requerimento; juntada sai do CR; declarações exigem assinatura gov.br; requerimento e boleto viram marcos da equipe | ✅ aplicada |
| `20260819110000_cr_filiacao_lntd_e_modelos` | Filiação LNTD em 2 passos (boleto pago pela equipe + declaração do clube assinada), grupo depois dos exames, template_key nas 4 declarações sem botão | ✅ aplicada — sequência 440→502 conferida |
| `20260820120000_cr_templates_v2_e_link_lntd` | Aponta os 5 modelos que colidiam no Storage para nomes `_v2` + link da filiação LNTD nos 2 passos | ✅ aplicada — 5 `_v2` no bucket em 20/08 12:47, todas as 8 chaves com arquivo |

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

## Leva 14 — cartão CNPJ/QSA reprovado como "vencido em 2008" (20/08/2026)

Motivo: a IA de leitura devolvia a DATA DE ABERTURA da empresa como data de
emissão do cartão CNPJ (ex.: 07/02/2008). Com "validade = emissão + 30 dias",
o cartão nascia vencido em 08/03/2008, era gravado assim no Hub e o QSA — que
herda a emissão do cartão aprovado — passava a ser recusado no envio
("DOCUMENTO VENCIDO — SERÁ REJEITADO"). Foi o que travou o QSA do Marcio e o
de todo cliente novo com empresa antiga. O schema da função agora diz à IA que
a emissão é a do rodapé "Emitido no dia" e ganhou o campo próprio
`data_abertura`; o front (guarda determinística) e a migration de backfill
saem no push normal.

ALTERADAS (redeploy obrigatório):
- supabase/functions/qa-extract-documents/index.ts — sem ela, todo cartão
  CNPJ/QSA lido pela IA (sem parser local) continua nascendo vencido no ano
  de abertura da empresa e travando o envio do QSA.

## Leva 15 — certidão reprovada por geografia que não é do cliente (20/08/2026)

Motivo: o validador automático comparava TODO campo da certidão com o cadastro,
inclusive endereço/cidade/UF. Certidão eleitoral imprime o DOMICÍLIO ELEITORAL
(onde a pessoa vota), e as judiciais imprimem comarca/foro/seção judiciária —
nada disso é endereço nem naturalidade do cliente, e a divergência reprovava
certidão correta. Agora o prompt proíbe a comparação geográfica em certidões de
antecedentes (eleitoral, criminal estadual/federal, cível federal, militar) e um
filtro determinístico descarta essas divergências mesmo se a IA as gerar.
Conferência de certidão ficou: nome + CPF/RG + nascimento + resultado.

ALTERADAS (redeploy obrigatório):
- supabase/functions/qa-processo-doc-validar-ia/index.ts — sem ela, certidões
  corretas continuam sendo travadas como "divergentes" por município de votação
  ou comarca diferente da cidade onde o cliente mora.

## 2026-08-20 — 2º endereço (CR e Autorização de Compra CAC)

**ALTERADA (redeploy obrigatório):**
- `supabase/functions/qa-cliente-atualizar-cadastro/index.ts` — passa a aceitar
  os campos do 2º endereço, mas só depois de consultar
  `qa_cliente_admite_segundo_endereco`. Sem o redeploy, o portal continua
  recusando o 2º endereço mesmo para quem tem CR, e a coluna nova fica órfã.

Migrations que precisam ir ANTES do deploy:
- `20260820200000_segundo_endereco_cr_e_autorizacao_cac.sql`
- `20260820210000_resposta_2o_endereco_volta_para_o_cadastro.sql`

## 2026-08-20 — Autorização de compra: adquirente, fornecedor e conferência

**ALTERADA (redeploy obrigatório):**
- `supabase/functions/qa-autorizacao-extrair/index.ts` — o extrator passa a ler
  também o ADQUIRENTE (nome, CPF, CR, endereço), o acervo e o FORNECEDOR
  (razão social + CNPJ na PF / registro SIGMA no Exército), e confere CPF,
  nome e CR contra o cadastro: divergência acende `revisao_necessaria`, que o
  Arsenal já exibe. Sem o redeploy, a autorização continua sendo lida sem
  dono — uma autorização anexada na pasta do cliente errado passa sem alerta.

Nenhuma migration necessária para esta leva (tudo vai no JSONB que já existe).

## 2026-08-21 — Lei 9.784/99: avisos param no protocolo

**ALTERADA (redeploy obrigatório):**
- `supabase/functions/qa-vencimentos-alertas/index.ts` — o ramo do dossiê
  passa a decidir pelo espelho `instrucaoAindaExigida` (junto com o arquivo
  compartilhado `_shared/faixaAlertaDocumento.ts`, que agora religa o relógio
  também em recurso administrativo). Sem o redeploy, cliente NOTIFICADO pela
  delegacia continua sem aviso do documento que ela está cobrando.

Migrations que precisam ir ANTES do deploy:
- `20260821010000_certidao_nao_vence_apos_protocolo.sql`
- `20260821020000_pergunta_loja_arma_autorizacao_compra.sql` (independente,
  pode ir junto)

## 2026-08-21 — Profissão do titular é a do TERCEIRO

**ALTERADAS (redeploy obrigatório):**
- `supabase/functions/qa-processo-etapa-auto-liberar/index.ts`
- `supabase/functions/qa-processo-checar-conclusao-checklist/index.ts`

As duas usam o espelho `_shared/respostasCadastro.ts`, corrigido: a resposta
automática de `titular_profissao` passa a vir do bloco do RESPONSÁVEL pelo
imóvel (`responsavel_endereco_profissao`), nunca mais da profissão do próprio
cliente. Sem o redeploy, o backend continua fechando a pergunta com a
profissão da pessoa errada — e a declaração do responsável sai com o dado do
requerente.

Nenhuma migration nesta leva.

## 21/08/2026, 18:36 BRT — Deploy realizado

ALTERADAS (redeploy):
- qa-vencimentos-alertas
- qa-documento-cliente-notificar
- qa-montar-juntada

Status: publicadas com sucesso. Nenhum código-fonte alterado.
