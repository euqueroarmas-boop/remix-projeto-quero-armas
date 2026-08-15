---
name: pendencias-treinamento-ia
description: Fila de trabalho do treinamento da IA — promoção automática ao deferir processo e refazer os vetores lixo de qa_kb_artigos
type: tech
---
Duas pendências abertas em 15/08/2026, depois de ligar o embedding local
(ver mem://tech/quero-armas/embedding-local-gte-small).

---

## 1. Processo deferido alimenta o treinamento sozinho

**Pedido do usuário (15/08/2026):** documento de processo DEFERIDO é a melhor
referência que existe — foi aceito pelo órgão. Em vez de promover um a um,
deferiu → os documentos daquele processo viram modelo aprovado automaticamente.

**Metade já existe.** `QAFilaRevisaoHumana.tsx` (~linha 627) já faz a promoção
em lote de um processo deferido: filtra `!d.usado_como_modelo` e chama
`qa-modelo-aprovado-criar` para cada um, com observação
"Promovido em lote a partir do processo deferido". Falta só o gatilho — hoje
depende de alguém abrir a tela e clicar.

**O que decidir antes de implementar:**
- Onde disparar: trigger no banco ao `qa_processos.status → deferido`, ou na
  edge function que registra o deferimento. Trigger não consegue chamar edge
  function direto — precisaria de fila ou `pg_net`.
- Promover TODO documento aprovado do processo, ou só os tipos que têm valor
  como modelo? Documento muito variável (declaração livre, BO) pode sujar a
  referência em vez de ajudar.
- Teto por tipo: 20 modelos do mesmo tipo não ajudam mais que 5, e cada um
  custa uma inferência. Definir limite e critério de descarte.
- Reaproveitar o caminho existente (`qa-modelo-aprovado-criar` por documento) e
  respeitar o lote pequeno: o modelo estoura `WORKER_RESOURCE_LIMIT` acima de
  ~3 por invocação. Processo com muitos documentos precisa ser enfileirado, não
  processado de uma vez.
- Guardas que já existem e devem continuar valendo: 409 quando o documento já
  virou modelo, e `usado_como_modelo` marcado na origem.

---

## 2. `qa_kb_artigos` — os vetores são lixo

21 artigos, 15 com "embedding" gerado pelo improviso de `qa-kb-embed`: pedir a
um modelo de CHAT um array de 1536 floats, aceitando 100 números e completando
o resto com ZEROS. Não é embedding, é número inventado que passa na validação
de formato.

**Trabalho:** migrar para `_shared/embedding.ts` (384 dim). Envolve três peças
acopladas — a coluna `qa_kb_artigos.embedding`, a RPC de busca e
`qa_kb_search_hybrid` — e depois refazer os 15 vetores. Maior que o da
biblioteca de modelos, que era coluna + uma RPC.

Sem urgência: a busca híbrida ainda funciona pela parte textual; o que está
desligado é a metade semântica.
