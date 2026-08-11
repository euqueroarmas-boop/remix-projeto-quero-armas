# Alinhar a primeira linha de todas as colunas (nome, OFFLINE, IDENTIFICAÇÃO CIVIL…)

## Por que os pedidos anteriores não resolveram

Cada coluna monta a própria caixa, do seu jeito:

- **CLIENTE**: nome dentro de `flex min-h-[22px] items-center`, com 12,5px, e ainda um ponto de sinalização com deslocamento manual `mt-[7px]`.
- **ONLINE**: chip dentro de um `space-y-1`, sem caixa de topo.
- **ETAPA ATUAL**: chip dentro de outro `space-y-1`.
- **PROGRESSO / PRÓXIMO PASSO / PROTOCOLO / ABERTO EM / PARADO**: cada um repete `min-h-[22px]` ou nada.

Além disso o chip usa `min-h-[22px]` (altura mínima, não fixa) e centraliza o texto verticalmente. Como o nome tem 12,5px e o chip 10,5px, centralizar os dois em caixas de altura diferente faz as **linhas de base** caírem em alturas distintas — é exatamente o desencontro visível entre GILSON DO NASCIMENTO, OFFLINE e IDENTIFICAÇÃO CIVIL.

Ou seja: não havia um padrão único; cada ajuste corrigia uma coluna e as outras continuavam com a régua antiga.

## O que será feito

Criar **uma única régua de topo** usada obrigatoriamente pelo primeiro elemento de toda coluna:

- Caixa fixa de 22px de altura com `line-height: 22px` (não mínima), sem centralização por flex — o texto passa a assentar na mesma linha de base em todas as colunas.
- O `Chip` vira pílula de altura fixa 22px, `line-height: 22px`, padding só horizontal, e ícone alinhado ao texto. Chips que quebram em duas linhas passam a usar múltiplos de 22px, mantendo a primeira linha na régua.
- O ponto colorido do cliente deixa de usar `mt-[7px]` e passa a ser centralizado dentro da própria régua de 22px.
- Remoção dos `space-y-1` que empurravam o primeiro elemento em ONLINE e ETAPA ATUAL; o espaçamento vertical passa a vir depois da régua.
- Segunda linha de cada coluna (serviço, último acesso, "PASSO X DE Y") continua 10,5px medium, com o mesmo respiro de 4px em todas as colunas.
- Tamanhos permanecem: nome 12,5px bold; todo o resto 10,5px (bold só nos chips principais).

Resultado: nome, OFFLINE, IDENTIFICAÇÃO CIVIL, progresso, protocolo, data e "0d" começam exatamente na mesma linha em qualquer linha da tabela.

## Como pedir isso no futuro

"Todos os elementos da primeira linha devem usar a régua de 22px" — a partir desta correção existe um único componente de régua, então o ajuste passa a valer para colunas novas automaticamente.

## Detalhes técnicos

- `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`: novo helper `LinhaTopo` (`h-[22px] leading-[22px]`), refatoração do `Chip` para altura fixa, aplicação em todas as células de `celulas[...]` e remoção dos offsets manuais. Nenhuma mudança de dados, RPC ou lógica.
