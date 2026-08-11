# Documentos: remover o "Foco do dia" duplicado e KPIs em linha única no mobile

## Resposta curta
Não estraga nada. A faixa "FOCO DO DIA · AÇÃO BLOQUEANTE" da aba **Documentos** e a da aba **Resumo** são dois componentes separados e independentes (`DocumentosCategoriaZ6V3Panel` e `CockpitZ6MeusProcessos`). Remover a de Documentos não altera em nada a de Resumo — nem dados, nem layout, nem o botão "Atualizar agora".

## O que muda

### 1. Aba Documentos — sai o bloco "Foco do dia"
- Remover o bloco `.focus` (kicker vermelho, título serifado e botão ATUALIZAR AGORA) da aba Documentos.
- O documento crítico continua visível na lista por categoria com o contador de vencimento e a ação de renovação já existentes na linha, então nenhuma ação fica inacessível.
- A lógica de renovação (`handleRenovar`) permanece, usada pelos botões da lista.

### 2. KPIs em uma única linha no mobile
- Hoje, no mobile, os cards quebram em grade de 3 colunas (2 linhas quando há 4 ou mais cards).
- Passar a exibir os KPIs em uma faixa horizontal única com arrasto lateral, preservando ordem e cores atuais.
- Cada card ganha largura mínima fixa para caber cerca de 2,5 cards na tela, sinalizando que há mais ao lado.
- Mantém o filtro por clique no card e a regra atual de esconder no mobile os cards com valor 0.
- Desktop segue igual (grade de 6 colunas).

## Detalhes técnicos
Arquivo único: `src/components/quero-armas/portal/DocumentosCategoriaZ6V3Panel.tsx`
- Remover o IIFE do bloco `{focoDoc && ...}` e as regras CSS `.focus*` que ficarem órfãs.
- No bloco `@media (max-width:900px)`, trocar `.kpis` de `grid` para `display:flex; overflow-x:auto; scroll-snap-type:x mandatory`, com `.kpi{flex:0 0 42%; scroll-snap-align:start}` e barra de rolagem oculta.
- Nenhuma alteração em `CockpitZ6MeusProcessos.tsx` (aba Resumo) nem em dados/back-end.