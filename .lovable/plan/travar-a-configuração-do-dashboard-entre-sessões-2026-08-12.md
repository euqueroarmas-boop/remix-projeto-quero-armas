# Travar a configuração do dashboard entre sessões

Hoje o dashboard já lembra a largura e a visibilidade das colunas, mas esquece o resto ao recarregar: a trilha selecionada (ex.: DEFESA PESSOAL), o card/contador ativo (ex.: ATIVOS) e a ordenação da tabela. A ideia é que, ao voltar, a tela apareça exatamente como você deixou.

## O que passa a ser lembrado
- Trilha filtrada (chip selecionado na barra TRILHA)
- Card/contador ativo (ATIVOS, ONLINE AGORA, COM PENDÊNCIA etc.)
- Coluna de ordenação e sentido (crescente/decrescente)
- Largura e visibilidade das colunas (já funciona hoje, mantido)
- Modo noturno (já funciona hoje, mantido)

Também fica um botão discreto "restaurar padrão" dentro do painel de configuração de colunas, para limpar tudo se você quiser voltar ao estado original.

## Detalhes técnicos
- Em `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`, aplicar o mesmo padrão já usado em `LS_LARGURAS`/`LS_VISIVEIS`: novas chaves `qa_dash_trilha`, `qa_dash_contador`, `qa_dash_ordem` com inicialização lazy no `useState` e `useEffect` de gravação.
- Leitura defensiva com try/catch e validação do valor lido contra as chaves válidas (`SortKey`, `ContadorKey`, trilhas existentes) — se a trilha salva não existir mais nos dados, cai para "nenhum filtro" em vez de mostrar lista vazia.
- Sem mudança de backend, dados ou lógica de negócio; apenas estado de UI no navegador.
