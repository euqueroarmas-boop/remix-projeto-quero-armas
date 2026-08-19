---
name: PENDÊNCIA — o mapa de etapas existe em duas cópias (TypeScript e SQL)
description: qa_categoria_documento (banco) e etapaDoTipo (ProcessoDetalheDrawer) classificam o documento nas 5 etapas por conta própria; hoje concordam, mas a ordem das regras difere e não há teste guardando
type: feature
---

## O que está pendente

A regra "este documento é de qual das 5 etapas?" está escrita **duas vezes**:

| Onde | Quem usa | Para quê |
|---|---|---|
| `public.qa_categoria_documento` → `public.qa_etapa_documento` (banco) | `qa_realinhar_etapa_liberada`, `qa_recalcular_prazos_processo` | decidir **até onde liberar** o processo |
| `etapaDoTipo`, dentro de `ProcessoDetalheDrawer.tsx` | `docVisivelPorEtapa` / `docDeEtapaAnteriorConcluida` | decidir **o que aparece na tela** da equipe |

As duas precisam concordar. Uma libera, a outra mostra: se discordarem sobre
um tipo de documento, ele pode ficar liberado e invisível — ou visível numa
etapa que não é a dele.

Registrado em 20/08/2026, a pedido do usuário, ao automatizar a liberação de
etapa (`20260819050000_etapa_liberada_segue_entregas.sql`).

## Estado real hoje: concordam, mas por sorte

Conferi tipo a tipo contra o catálogo em uso. Para **todos** os tipos que
existem hoje, as duas cópias dão a mesma etapa.

O que preocupa não é o resultado, é a **ordem das regras**, que é diferente:

- **TypeScript** testa exames (`laudo`, `tiro`, `aptidao`, `psicologic`,
  `capacidade_tecnica`) **antes** de `declaracao*`.
- **SQL** testa `declaracao*` **antes** de exames.

Consequência: um tipo futuro que caia nos dois padrões — algo como
`declaracao_aptidao_tiro` — vira **etapa 5 no TypeScript** e **etapa 4 no
SQL**. Ninguém percebe até um documento sumir da tela de alguém.

Divergência assim já era possível antes da automação, com a liberação manual.
A automação não piorou — só tornou a discordância mais cara, porque agora as
duas pontas se movem sozinhas.

## O que fazer quando for mexer

1. Eleger o **banco** como fonte única (`qa_etapa_documento` já é usada por
   mais de um lugar e é `IMMUTABLE`).
2. Extrair o `etapaDoTipo` do componente para um módulo próprio em
   `src/lib/quero-armas/`, com teste de tabela cobrindo todo `tipo_documento`
   do catálogo.
3. Fazer o teste comparar as duas cópias regra a regra — no espírito do
   `code128.test.ts`, que confere a tabela própria contra o encoder de
   referência. Enquanto houver duas cópias, é o teste que segura.
4. Alinhar a ORDEM das regras nas duas, não só o resultado.

## Como conferir se ainda concordam

```sql
-- Etapa que o BANCO dá para cada tipo do catálogo em uso.
-- Comparar com o que `etapaDoTipo` devolveria para os mesmos tipos.
select distinct sd.tipo_documento,
       qa_categoria_documento(sd.tipo_documento) as categoria,
       qa_etapa_documento(sd.tipo_documento)     as etapa_no_banco
  from qa_servicos_documentos sd
 where sd.ativo = true
 order by etapa_no_banco, sd.tipo_documento;
```
