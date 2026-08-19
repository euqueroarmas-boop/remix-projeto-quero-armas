---
name: PENDÊNCIA — checklist do CRAF/GT ainda não existe
description: O serviço de CRAF + Guia de Trânsito não tem nenhum documento no catálogo; por decisão do usuário, será montado quando houver a primeira autorização de compra deferida
type: feature
---

## O que está pendente

O serviço **CRAF + Guia de Trânsito (posse)** — slug
`certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma`
— **não tem nenhuma linha em `qa_servicos_documentos`**. Catálogo vazio.

Consequência prática: quando a trava de pré-requisito soltar (ver abaixo), o
processo abre e não há exigência nenhuma para pedir ao cliente.

Achado em 19/08/2026, na auditoria do processo do Gilson (cliente 214), que
tem os dois serviços contratados.

## A decisão

**Decisão do usuário (20/08/2026): montar o checklist quando tivermos a
primeira autorização de compra DEFERIDA.**

O motivo é bom: as exigências do CRAF dependem da arma efetivamente adquirida
(espécie, marca, modelo, calibre, número de série, nota fiscal da compra).
Montar a lista antes de existir uma autorização deferida seria adivinhar.

Enquanto isso, nada quebra: a trava de pré-requisito segura o serviço.

## Por que o catálogo vazio NÃO é um problema hoje

`qa_servicos_prerequisitos` (semeado em 24/07) liga o par:

- CRAF/GT **depende de** Autorização de Compra (`tipo = 'preferencial'`)
- `pacote_slug = 'posse-arma-de-fogo'`, ordem 10 (Autorização) e 20 (CRAF/GT)

Enquanto a Autorização não está concluída, o portal calcula
`_bloqueadoPrerequisito = true` (em `QAClientePortalPage`) e o card do cliente
aparece como **"Aguardando etapa anterior"** — sem botão de ação e fora da
contagem de tarefas abertas (`ClienteResumoKanban`). O cliente não é cobrado
por nada e não vê lista vazia sem explicação.

Exceção já prevista no código: quem chega com autorização emitida por outro
despachante não tem processo de autorização no sistema, então o CRAF entra
como standalone e **não** é bloqueado.

## Ponto a resolver junto, quando for montar

A coluna `tipo` de `qa_servicos_prerequisitos` distingue `obrigatorio` de
`preferencial`, mas **o código nunca lê essa coluna**: hoje `preferencial`
bloqueia igual a `obrigatorio`. Como o par CRAF→Autorização está gravado como
`preferencial` justamente para permitir o caso do despachante externo, a
distinção existe no banco e está inerte na aplicação.

## Como conferir o estado

```sql
-- Catálogo do CRAF/GT: hoje volta vazio.
select sd.*
  from qa_servicos_documentos sd
  join qa_servicos_catalogo c on c.servico_id = sd.servico_id
 where c.slug = 'certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma';

-- Quem já tem CRAF/GT contratado e em que pé está a autorização dele.
select c.nome_completo, craf.status as status_craf, aut.status as status_autorizacao
  from qa_processos craf
  join qa_clientes c on c.id = craf.cliente_id
  join qa_servicos_catalogo cat on cat.servico_id = craf.servico_id
  left join qa_processos aut on aut.cliente_id = craf.cliente_id
       and aut.servico_id in (select servico_id from qa_servicos_catalogo
                               where slug = 'autorizacao-de-compra-posse-de-arma-de-fogo')
 where cat.slug = 'certificado-de-registro-de-arma-de-fogo-craf-e-guia-de-transito-gt-posse-de-arma';
```
