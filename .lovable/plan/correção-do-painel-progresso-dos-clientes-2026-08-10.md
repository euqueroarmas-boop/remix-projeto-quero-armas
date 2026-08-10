# Correção do painel PROGRESSO DOS CLIENTES

## O que está errado (verificado)

- **"PARADO" mostra 0d para quase todos.** Na consulta do painel, 12 processos têm exatamente a mesma "última atividade": `10/08/2026 20:23:33`. É um carimbo de atualização em lote do sistema (alteração de documentos feita pela plataforma), não movimento do cliente. Como a conta é `hoje - última atividade`, todo mundo zera. João (último acesso 05/08) e Fábio (09/08) aparecem como 0d por causa disso.
- **"BLOQUEADOS" não lista ninguém.** Existem 6 linhas bloqueadas (Anthony, Fábio, Gilson, João, Mizael, Pedro), mas essas linhas não têm documentos e portanto não recebem nenhuma etiqueta de trilha. Com um filtro de trilha ativo (ex.: DEFESA PESSOAL, como no print), elas são descartadas e a lista fica vazia.
- **Layout:** larguras fixas somadas maiores que a tela + colunas com conteúdo sem quebra fazem PROGRESSO invadir ETAPA ATUAL; cabeçalho e célula não compartilham o mesmo alinhamento à esquerda; CLIENTE, EF. NECESSIDADE e PROTOCOLO usam `truncate`/`whitespace-nowrap`, então não quebram linha.
- **OFFLINE em cinza:** hoje ONLINE é verde e OFFLINE usa cinza neutro.

## Área do cliente
Nenhuma mudança. Este painel é exclusivo do admin.

## Correções no admin

### 1. Dias parados reais
- Passar a medir o tempo parado por **movimento do cliente**, não por atualização do sistema: usar o mais recente entre envio de documento feito pelo cliente, resposta de questionário, última ciência e último acesso ao portal — ignorando mudanças de status geradas pela plataforma em lote.
- Fallback: se não houver nenhum sinal do cliente, contar desde a abertura do processo.
- Resultado esperado: João ≈ 5 dias, Fábio ≈ 1 dia, Gilson ≈ 12 dias.

### 2. Filtro BLOQUEADOS
- Ao clicar em um contador (PRONTOS, EM ANÁLISE, PARADOS, BLOQUEADOS), limpar o filtro de trilha ativo.
- Linhas bloqueadas passam a receber a trilha do cliente (herdada dos outros processos dele) para não sumirem em filtros.

### 3. Formatação da tabela
- Cabeçalho e célula com o mesmo espaçamento horizontal e alinhamento à esquerda em todas as colunas (hoje o botão de ordenação desloca o texto).
- Larguras revisadas: CLIENTE 240, ONLINE 108, ETAPA ATUAL 190, PROGRESSO 230, PRÓXIMO PASSO 210, EF. NECESSIDADE 140, PROTOCOLO 140, ABERTO EM 100, COBRANÇAS 100, PARADO 88 — com divisória sutil entre colunas para impedir a sensação de invasão.
- Barra de progresso e percentual com largura própria dentro da célula, sem estourar para a coluna vizinha.

### 4. Quebra de linha
- CLIENTE: nome e serviço contratado passam a quebrar em duas linhas, sem corte.
- EF. NECESSIDADE e PROTOCOLO: etiquetas em modo multilinha, mantendo cor e caixa alta.

### 5. Semáforo do ONLINE
- ONLINE: verde (#0F7A45 sobre #F1FAF4).
- OFFLINE: bordô (#7A1F2B sobre #FDF4F5).
- Linha do último acesso segue em cinza abaixo da etiqueta.

## Detalhes técnicos
- `public.qa_painel_progresso_clientes()`: nova regra de `ultima_atividade`/`dias_parado` (movimento do cliente) e trilha herdada por cliente para processos bloqueados.
- `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`: larguras, alinhamento, quebras, cores do ONLINE/OFFLINE e reset do filtro de trilha ao usar contadores.