# Progresso por grupos: quantos faltam e em que passo está

## O que está errado hoje

A coluna PROGRESSO mostra só um total bruto de documentos (ex.: PEDRO LOBATO 0/19) e não diz nada sobre grupos. Duas falhas confirmadas no banco:

1. **Não existe contagem de grupos.** A função `qa_painel_progresso_clientes` devolve apenas `grupo_atual`, `grupo_total` e `grupo_concluidos` — e esses dois últimos são itens *dentro* do grupo, não grupos. Não há "grupo 6 de 8" nem "faltam 3 grupos". No desktop nem o grupo aparece; só no mobile, num chip.
2. **O que o cliente já entregou some da conta.** No processo do Pedro (serviço 60, 22 exigências), 7 documentos entregues estão como `dispensado_por_reaproveitamento` (CIN, foto 3x4, comprovante de residência, TJM, eleitoral, benefício, extrato INSS) e 6 como `dispensado_grupo`. A função exclui esses status do numerador **e** do denominador, então o esforço já feito vira zero: 0/19. Por isso o painel dá a impressão de que ele não começou.

## O que passa a aparecer

Para cada cliente, na coluna PROGRESSO:

```text
GRUPO 5 DE 8 · IDONEIDADE          faltam 3 grupos
PASSO 2 DE 4 NO GRUPO        ███████░░░░░  13/19 (68%)
```

- **Grupo X de Y** — posição do grupo atual na sequência canônica do serviço (Contratos, Cadastro, Identificação civil, Identificação residencial, Ocupação lícita, Idoneidade, Efetiva necessidade, Laudos, Requerimento — só os grupos aplicáveis ao processo).
- **Faltam N grupos** — grupos com pendência ainda aberta, incluindo o atual.
- **Passo A de B no grupo** — itens cumpridos / itens aplicáveis do grupo atual (na Efetiva Necessidade continua usando os 11 passos do fluxo guiado).
- **Barra geral** — passa a contar reaproveitados e dispensados como cumpridos, então o Pedro sai de 0/19 e mostra o que ele já entregou.
- Chip de grupos concluídos no mobile no mesmo formato, sem inventar layout novo.

## Detalhes técnicos

Migração em `qa_painel_progresso_clientes` (mesma assinatura, colunas novas):

- Novo CTE `grupos_processo`: agrupa `docs_enriquecidos` por `grupo_id`, mantém só grupos com pelo menos um item aplicável, ordena por `grupo_ordem` e calcula por grupo `itens_total`, `itens_cumpridos` e `tem_pendencia`.
- Novas colunas de retorno: `grupos_total`, `grupo_indice` (posição do grupo atual), `grupos_concluidos`, `grupos_restantes`.
- `doc_totais`: reaproveitados e dispensados voltam a contar como cumpridos **e** entram no denominador (hoje são removidos dos dois lados), corrigindo o 0/19. `dispensado_grupo` e `nao_aplicavel` seguem fora, por serem exigências que deixaram de existir.
- `grupo_totais`: mesmo ajuste, para o "passo A de B" refletir o que já foi reaproveitado.

Frontend `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`:

- Ampliar a interface `Row` com os quatro campos novos.
- Coluna PROGRESSO (desktop) e bloco mobile passam a renderizar as duas linhas acima; chave de ordenação `progresso` continua pelo percentual geral.
- Novo contador clicável "GRUPO FINAL" (processos com `grupos_restantes <= 1`) junto aos contadores existentes.
