# Rejeição de documentos: travar, mostrar histórico e excluir do ZIP

## O que está errado hoje
Na linha do tempo de entrega (`ClienteDocsEnviados.tsx`), o botão REJEITAR é sempre exibido igual, mesmo em documento já reprovado — dá para rejeitar de novo. O motivo já é gravado no banco (`motivo_reprovacao` + `reprovado_em`), mas não aparece nessa lista. E o "Baixar tudo (ZIP)" inclui todos os documentos com arquivo, inclusive os reprovados.

## O que muda

### 1. Botão de rejeição travado
- Documento com status `reprovado`: botão vira "REJEITADO", esmaecido e desabilitado (sem clique, sem hover), com título explicando que já foi rejeitado.
- O restante das ações (VISUALIZAR, BAIXAR, EXCLUIR) continua funcionando normalmente.
- O card do documento rejeitado ganha destaque bordô discreto, para diferenciar visualmente de "atenção".

### 2. Histórico da rejeição na tela
- Abaixo das ações, no documento reprovado, aparece uma faixa bordô: MOTIVO DA REJEIÇÃO — texto informado, com data/hora da rejeição.
- Se houver mais de um evento de rejeição registrado na auditoria de status do documento, listar em ordem cronológica (data · motivo), para servir de histórico e não só do último motivo.

### 3. Rejeitados fora do dossiê
- "Baixar tudo (ZIP)" passa a ignorar documentos com status `reprovado` (e os já `excluido`, como hoje).
- O contador do toast e a numeração do protocolo passam a refletir só os documentos válidos, sem lacunas.
- Se todos estiverem rejeitados, mensagem clara: nenhum documento válido para o dossiê.
- O download individual do rejeitado continua permitido (auditoria interna).

## Detalhes técnicos
- Arquivo principal: `src/components/quero-armas/clientes/ClienteDocsEnviados.tsx` (componentes `LinhaEntrega` e `handleBaixarTudo`).
- Histórico: leitura de `qa_documento_status_producao` / auditoria de status já gravada por `auditarStatusDoc` em `docsAprovacao.ts`, filtrando eventos com `novo = reprovado`.
- Sem mudança de schema; nenhuma alteração no fluxo do cliente.
