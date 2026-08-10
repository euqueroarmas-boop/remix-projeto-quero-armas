# Corrigir o falso "ENTREGUE FORA DA ORDEM" na linha do tempo do Hub

## O que está acontecendo

O aviso não reflete a realidade: o cliente entregou na ordem, mas a auditoria compara a entrega com o **estado de hoje** do checklist, e ainda trata **perguntas** como se fossem documentos que faltaram.

No caso do Pedro há duas causas somadas:

1. **Comparação com o presente, não com o momento da entrega.** Cada documento é confrontado com os itens de ordem anterior que estão pendentes **agora**. Como as certidões (ordens 330–400) seguem pendentes hoje, tudo que veio depois delas aparece como "fora da ordem", mesmo tendo sido entregue na sequência certa.
2. **Uma pergunta órfã travada em "pendente".** O item de ordem 70 — "QUAL A PROFISSÃO DO TITULAR DO COMPROVANTE?" — pertence ao grupo de imóvel de terceiro. Os vizinhos do mesmo grupo (ordens 60, 80 e 90) foram dispensados quando ficou definido que o comprovante é do próprio cliente, mas essa linha ficou pendente. Por isso ela é citada em todas as anotações do print.

Também confirmado: "PROCURAÇÃO ASSINADA" aparece como "SEM EXIGÊNCIA CORRESPONDENTE" porque de fato não existe linha de exigência para procuração no checklist do processo — caso à parte, tratado abaixo.

## Correção proposta

### 1. Auditar contra o momento da entrega
A anotação passa a considerar apenas exigências anteriores que **ainda não tinham sido entregues quando aquele documento chegou** — usando a data de entrega dos documentos do acervo, e não o status atual. Se o item anterior já havia sido entregue (ou dispensado), deixa de ser atropelo.

### 2. Perguntas nunca contam como atropelo
Itens do tipo `pergunta_*` deixam de entrar na lista de "o checklist previa antes". Pergunta não é documento; é respondida no fluxo guiado e não pode acusar o cliente de pular etapa.

### 3. Fechar a pergunta órfã e evitar recorrência
- Dispensar a linha de ordem 70 do Pedro, alinhando-a ao grupo já dispensado (mesma regra do 60/80/90).
- Rodar a mesma varredura para todos os clientes: qualquer `pergunta_titular_*` pendente cujo grupo de imóvel de terceiro já esteja dispensado passa a `dispensado_grupo`.

### 4. Suavizar "SEM EXIGÊNCIA CORRESPONDENTE" para documentos contratuais
Procuração assinada, contrato e comprovante de pagamento pertencem ao contrato, não ao checklist do processo. Passam a ser informativos ("documento contratual — fora do checklist do processo") em vez de alerta amarelo.

## Detalhes técnicos

- `src/lib/quero-armas/hubEntregaAuditoria.ts`
  - `montarLinhaEntrega` deriva um mapa `tipo -> data da primeira entrega` a partir do próprio array de documentos e usa o `quando` do item corrente como corte temporal.
  - Filtro adicional em `comOrdem`: exclui `tipo_documento` iniciado por `pergunta_` (reaproveitando o helper já existente em `etapasAutoLiberacao.ts`).
  - Lista `DOCS_CONTRATUAIS` (`procuracao_assinada`, `contrato_assinado`, `comprovante_pagamento`) com severidade `info` no ramo `sem_exigencia`.
  - Testes de regressão com o cenário real do Pedro.
- Migração de dados: `UPDATE qa_processo_documentos SET status='dispensado_grupo'` para `pergunta_titular_%` pendentes cujo `pergunta_comprovante_em_nome` do mesmo processo já esteja dispensado.