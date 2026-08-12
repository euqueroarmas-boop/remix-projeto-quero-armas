# Corrigir os avisos falsos da linha do tempo de entrega (Hub do Cliente)

## O que está acontecendo

Os carimbos amarelos ("ENTREGUE FORA DA ORDEM" e "SEM EXIGÊNCIA CORRESPONDENTE") são gerados pela auditoria do Hub comparando cada entrega com a coluna `ordem` do checklist do processo. Só que essa coluna **não é a ordem que o cliente vê**: o assistente guiado do portal monta a fila por grupos (contrato, foto, identificação, residência, ocupação, idoneidade, laudos), com regra própria. Resultado: o cliente segue a fila certa e o admin acusa "fora da ordem".

Auditei o cadastro do Fábio e encontrei três furos concretos:

1. **Exigência criada depois da entrega.** O CCMEI (ordem 160) foi criado em 11/08 às 18:02. As certidões foram entregues às 14:05, 14:13 e 16:30 — horas antes de o CCMEI existir. Mesmo assim ele aparece como "o checklist previa antes". A auditoria não considera quando a exigência nasceu.

2. **Itens que o cliente não pode antecipar entram na conta.** O Laudo Psicológico (ordem 290) depende de agendamento com credenciado; ele nunca vai ser entregue antes das certidões. Ainda assim é cobrado como pré-requisito atropelado.

3. **CNH marcada como "sem exigência".** O slot do checklist é `cin`, e o cliente mandou `cnh`. Já existe a regra de equivalência de identidade (CIN/CNH/RG são a mesma exigência) usada no Hub, mas a linha do tempo não a aplica ao casar documento com exigência.

## O que será feito

Tudo dentro da auditoria do Hub (visão do admin). Nada muda no fluxo do cliente.

**Casar identidade por equivalência** — ao procurar a exigência de um documento entregue, se for documento de identidade civil, aceitar qualquer slot de identidade (CIN/CNH/RG). A CNH do Fábio passa a apontar para o slot CIN e o aviso amarelo some.

**Só acusar atropelo do que era exigível na hora da entrega** — uma exigência anterior só conta como "pulada" se: (a) já existia quando o documento foi entregue (`created_at` da exigência anterior ao envio), (b) não é item de agendamento externo (laudo psicológico, laudo de capacidade técnica) nem item que depende de etapa anterior, e (c) não é pergunta nem item dispensado (regra que já existe).

**Alinhar o texto com a realidade** — quando sobrar algo legítimo, o aviso passa a ser informativo e explicativo: "ENTREGUE ANTES DE ITENS AINDA ABERTOS — o cliente adiantou esta entrega; seguem em aberto: X · Y", em vez de "fora da ordem", que sugere erro do cliente.

**Reduzir "SEM EXIGÊNCIA CORRESPONDENTE" a caso real** — se o documento entregue tem equivalente no catálogo (alias de tipo) ou é identidade, ele deixa de cair nesse aviso. O aviso fica reservado para documento realmente estranho ao checklist.

## Detalhes técnicos

- `src/lib/quero-armas/hubEntregaAuditoria.ts`: usar `mesmaExigenciaIdentidade` na resolução de `exigenciasPorTipo`; adicionar `created_at` a `ExigenciaLike` e filtrar `anteriores` por data; excluir tipos de agendamento externo do cálculo de atropelo; renomear o código/título do aviso e ajustar severidade para `info`.
- Verificar os pontos que montam `ExigenciaLike` (aba Hub Cliente em `QAClientesPage` e componentes filhos) para incluir `created_at` na consulta de `qa_processo_documentos`.
- Testes de regressão em `src/lib/quero-armas/__tests__/` cobrindo: CNH contra slot CIN, exigência criada após a entrega e laudo pendente não gerando atropelo.