# Por que o "próximo passo" do Fábio sai diferente dos outros

O motor é o mesmo para todos (a função `qa_painel_progresso_clientes`, que pega a primeira pendência acionável do checklist, na ordem de grupo e de item). O que está errado no Fábio não é o motor: é **o rótulo** e **a contagem do passo**.

## O que a consulta mostrou

Linha do Fábio hoje:

```text
grupo atual .......... OCUPAÇÃO LÍCITA (grupo 3 de 7)
próximo passo ........ "CCMEI — Certificado da Condição de Microempreendedor Individual — SALGADEIRO"
grupo_total .......... 1
grupo_concluidos ..... 0   → a tela escreve "PASSO 0 DE 1 NESTA ETAPA"
```

Dois problemas:

1. **Nome do documento longo demais.** A exigência do CCMEI foi criada em 11/08 com o nome já concatenado com a profissão (`— SALGADEIRO`). A coluna PRÓXIMO PASSO tem 210px; nos outros clientes o nome é curto ("Foto 3x4 do requerente"), no dele quebra em quatro linhas e estoura a altura da linha. Parece "errado", mas é o texto cru vindo do banco.
2. **"PASSO 0 DE 1" está semanticamente errado.** A tela imprime `grupo_concluidos / grupo_total`, ou seja, quantos itens do grupo já foram concluídos — não em que passo o cliente está. Como o grupo Ocupação tem 1 item e nenhum concluído, sai "PASSO 0 DE 1". No Anthony sai "PASSO 1 DE 2" por coincidência (1 concluído de 2) e o leitor entende como "passo atual". A leitura fica inconsistente entre clientes.

Ou seja: o próximo passo do Fábio está **correto no conteúdo** (o CCMEI é mesmo a próxima pendência), mas é exibido de forma que destoa dos demais.

## Correções propostas (só apresentação)

1. **Rótulo curto e estável na coluna PRÓXIMO PASSO**
   - Cortar sufixos descritivos após o segundo travessão (o "— SALGADEIRO"), mantendo "CCMEI — Certificado da Condição de Microempreendedor Individual".
   - Limitar a duas linhas com reticências e mostrar o nome completo em tooltip.
   - Mesma regra na lista desktop e no card mobile, para não haver duas verdades.

2. **Contagem do passo coerente**
   - Trocar o texto para `PASSO {grupo_concluidos + 1} DE {grupo_total}` enquanto houver pendência no grupo, e `{grupo_total} DE {grupo_total}` quando o grupo estiver concluído — nunca "PASSO 0".
   - Manter o chip `GRUPO x/y` como está (ali a leitura de "concluídos" é a correta).

## Detalhes técnicos

- Arquivo único: `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`
  - Novo helper `rotuloProximoPasso(nome)` (corta sufixo após o 2º travessão, colapsa espaços).
  - Linha 878 (lista) e 1078 (card): usar o helper + `line-clamp-2` + `title` com o nome completo.
  - Linha 1039: `PASSO {min(grupo_concluidos + 1, grupo_total)} DE {grupo_total}`.
- Sem mudança de banco, de view ou do motor de pendências — a ordem de itens continua exatamente a mesma para todos os clientes.