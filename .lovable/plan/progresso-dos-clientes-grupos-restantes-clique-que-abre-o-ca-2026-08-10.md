# Progresso dos clientes: grupos restantes + clique que abre o cadastro

## 1) Link do nome do cliente está quebrado (confirmado)

O painel aponta para `/quero-armas/clientes/<id>`, mas essa rota **não existe**: em `QARoutes.tsx` as rotas são de raiz (`clientes`, `clientes-lista`), sem prefixo `/quero-armas` e sem `:id`. Por isso o clique cai no fallback e volta para a home pública.

A rota certa é `/clientes` (aba Clientes), que já sabe abrir um cliente direto pela query `?cliente=<id>` — `QAClientesPage` lê esse parâmetro e abre a ficha, exatamente a tela do print 2.

Correção: o nome do cliente passa a linkar para `/clientes?cliente=<cliente_id>&tab=dados`, tanto na lista mobile quanto na tabela desktop.

## 2) O que a mudança de progresso acrescenta ao que já existe

Hoje a linha já mostra: etapa atual (ex.: IDONEIDADE), "0 de 5 nesta etapa", X/Y geral, %, pendentes, disp./reap. O que **não** existe é a leitura por grupos — quantos grupos o processo tem e em qual deles o cliente está. Ficaria assim:

```text
IDONEIDADE                    GRUPO 5 DE 8 · FALTAM 4
PASSO 0 DE 5 NESTA ETAPA      ███████░░░  13/19 (68%)
```

Incrementos concretos sobre o atual:

- **Grupo X de Y** e **faltam N grupos** — hoje inexistente; é a resposta direta de "quanto falta pra terminar".
- **"0 de 5 nesta etapa" ganha contexto**: passa a ser lido junto do número do grupo, não solto.
- **Correção do 0% falso**: no processo do Pedro os 7 documentos entregues estão como `dispensado_por_reaproveitamento` e a função os remove do numerador **e** do denominador — resultado 0/19 e 0%, como se ele não tivesse começado. Reaproveitados passam a contar como cumpridos. O mesmo afeta Fabio e João Luiz (0/25 com 7 disp./reap. cada).

Se você quiser só o item de grupos sem mexer no cálculo, dá pra separar — mas o 0% falso é o que mais engana a leitura hoje.

## Detalhes técnicos

Migração em `qa_painel_progresso_clientes`:

- Novo CTE `grupos_processo`: agrupa `docs_enriquecidos` por `grupo_id` (só grupos com item aplicável), ordena por `grupo_ordem`, calcula `itens_total`, `itens_cumpridos`, `tem_pendencia`.
- Novas colunas: `grupos_total`, `grupo_indice`, `grupos_concluidos`, `grupos_restantes`.
- `doc_totais` e `grupo_totais`: `dispensado_por_reaproveitamento` e `reaproveitado` voltam a contar como cumpridos e entram no denominador. `dispensado_grupo` e `nao_aplicavel` seguem fora (exigência deixou de existir).

`src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`:

- Interface `Row` recebe os quatro campos novos.
- Coluna ETAPA ATUAL passa a exibir "GRUPO X DE Y · FALTAM N" abaixo do nome do grupo; mobile idem, no chip existente.
- Ambos os `<Link>` do nome do cliente passam a `/clientes?cliente=${r.cliente_id}&tab=dados`.
