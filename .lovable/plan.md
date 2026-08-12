# Chips do painel: contorno visível e texto que nunca sobrepõe

## O problema
Os chips coloridos (EM REVISÃO, COLETANDO, PENDENTE(S), ONLINE/OFFLINE, PRONTO, PROTOCOLO, etc.) usam fundos quase brancos (`#F1FAF4`, `#FDFAF1`, `#FDF4F5`) e nenhuma borda. Em telas com brilho ou perfil de cor diferentes esses fundos somem, e o chip só "aparece" quando o texto é selecionado. Além disso, várias células usam `truncate` e o chip tem altura de linha fixa de 22px, o que em telas estreitas corta ou encavala o conteúdo.

## O que muda

### 1. Chip nítido (contorno + fundo mais forte)
- Cada estado passa a ter três valores: tinta (texto), fundo e borda.
  - Verde: texto `#0F7A45`, fundo `#E4F4EA`, borda `#9FCFB4`
  - Âmbar: texto `#8A6A17`, fundo `#FAF0D8`, borda `#D9BE79`
  - Bordô: texto `#7A1F2B`, fundo `#F7E4E7`, borda `#D2A2AA`
  - Neutro: texto `#3A3A3A`, fundo `#F0EFEC`, borda `#CFCCC5`
- O componente `Chip` ganha borda de 1px sempre visível, mantendo formato pill e tipografia atual (uppercase, 10.5px).
- Mesmo tratamento nos KPIs do topo e nos botões de filtro de trilha: o selecionado ganha borda bordô sólida em vez de apenas fundo claro.

### 2. Texto sempre quebra, nunca sobrepõe
- Remover `truncate` das células que hoje cortam (nome do cliente, próximo passo, rótulo de etapa) e usar quebra real com `[overflow-wrap:anywhere]` + `break-words`.
- Chip: trocar `leading-[22px]` fixo por padding vertical + `leading-snug`, para crescer em várias linhas sem cortar.
- Linhas da tabela alinham no topo (`align-top`) e as células ganham `min-w-0`, evitando que uma coluna empurre a outra.
- `LinhaTopo` passa a usar altura mínima em vez de altura fixa, acomodando texto quebrado.
- Mesma regra aplicada ao bloco de cards no mobile.

## Detalhes técnicos
Arquivo único: `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx` — constantes de cor, componente `Chip`, `LinhaTopo` e classes de célula da tabela e dos cards. Sem mudança de dados, consultas ou regras de negócio.