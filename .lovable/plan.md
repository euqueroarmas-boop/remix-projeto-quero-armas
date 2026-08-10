# Espelhar o painel do admin com a área do cliente

## O que a auditoria encontrou (verificado no banco e no código)

### 1. As fases são diferentes porque são calculadas por dois motores distintos
- **Admin**: `DashboardProgressoClientes.tsx` consome a função `qa_painel_progresso_clientes`. A "fase" é derivada do *grupo do próximo documento pendente* (`efetiva_necessidade`, `ocupacao`, `antecedentes`, `laudos`, `requerimento`, `perguntas`, senão "DOCUMENTOS").
- **Cliente**: o resumo do cliente agrupa por *família de documento* do Hub (`agruparDocumentosPorFamilia`), com rótulos e consolidação próprios (vigente / histórico / principal).
- Resultado: dois vocabulários para o mesmo estado. Em teoria dos conjuntos, os recortes não são a mesma partição do conjunto de documentos — o admin projeta tudo em um único elemento (o próximo pendente), o cliente projeta em N famílias. Nenhuma tela está "errada"; elas simplesmente não são espelho.

### 2. Todos aparecem em "IMÓVEL DE TERCEIRO" (e "MILITAR")
`trilhaChecklist.ts` deduz as trilhas **apenas pela existência da linha** em `qa_processo_documentos`, ignorando `status` e aplicabilidade.
Consulta confirmando: quase todos os processos possuem `declaracao_responsavel_imovel` / `documento_identificacao_terceiro` materializados, e na maioria com status `dispensado*` (Pedro 2/2 dispensados, Anthony 2/2, João Luiz 2/2, Fabio 2/2). O mesmo vale para `antecedentes_militar_estadual`, materializado em quase todos os processos.
O checklist materializa o documento condicional para depois dispensá-lo, e a trilha lê presença como pertinência. Erro de conjunto: "existe linha" não é "pertence à trilha".

### 3. A profissão aparece errada
Existem **três fontes concorrentes**:
- `qa_clientes.profissao` — texto livre legado ("Salgadeiro", "APOSENTAD0", "Perito Judicial TI");
- `qa_processos.condicao_profissional` — o valor canônico do catálogo (`CONDICOES_CHECKLIST`), **nulo na maioria dos processos**;
- os documentos `renda_*` materializados, de onde a trilha infere ASSALARIADO / EMPRESÁRIO.
Vários processos têm apenas `renda_definir_condicao` (condição ainda não definida) e mesmo assim recebem rótulo de ocupação. É mismatch semântico: o painel mostra uma inferência de documento como se fosse a escolha do cliente.

## O que será feito

### A. Fonte única de verdade (sem mexer no motor do cliente)
1. Estender `qa_painel_progresso_clientes` para devolver também: `condicao_profissional` efetiva, `profissao_exibicao` e as trilhas já filtradas por aplicabilidade (excluindo `dispensado*`, `nao_aplicavel`, `reaproveitado`, `substituido`, `excluido`).
2. `trilhaChecklist.ts` passa a receber `{ tipo, status, aplicavel }` e só marca a trilha quando existe pelo menos uma linha **viva**. `renda_definir_condicao` nunca gera rótulo de ocupação.
3. Ocupação passa a vir de `condicao_profissional` (canônico); só cai para inferência por documento quando o campo estiver vazio, e nesse caso o rótulo aparece marcado como *inferido*.

### B. Espelho da área do cliente
O painel passa a exibir, por processo, exatamente o que o cliente vê:
- **Etapa atual** com o mesmo rótulo do cliente e `x de y` do grupo — a função já devolve `grupo_atual`, `grupo_total`, `grupo_concluidos`, hoje descartados pela tela.
- **Próximo documento**, **pendências**, **em análise**, **perguntas de cadastro pendentes**, **dispensados / reaproveitados** — todos já retornados e hoje não exibidos.
- **Bloqueio por etapa anterior** sinalizado explicitamente (REGRA-MÃE).
- Linha expansível com o checklist do processo na ordem do cliente (grupo → item) e status por item.

### C. UI premium do admin (Premium Light)
- Tipografia legível: contraste real (`#0A0A0A` títulos, `#3A3A3A` conteúdo), fim dos cinzas 300/400 em texto, corpo maior nas células.
- Sinalizadores semânticos com as cores já definidas: verde (em dia / entregue), amarelo (atenção 7–14 dias), vermelho (parado 15+ / bloqueado), preservando a imutabilidade das cores de status.
- Contadores visuais no topo: processos ativos, prontos, em análise, com pendência, parados 15+, bloqueados — clicáveis como filtro.
- Barra de progresso com faixa colorida por saúde, número `x/y` e percentual, mais chip da etapa atual e do próximo documento.
- Hierarquia clara nas linhas (nome forte, serviço secundário, trilhas como chips discretos), zebra sutil e cabeçalho fixo.

## Detalhes técnicos
- Migração: `CREATE OR REPLACE FUNCTION public.qa_painel_progresso_clientes()` acrescentando colunas (compatível — a tela só ganha campos).
- Frontend: `DashboardProgressoClientes.tsx` reescrito (tabela desktop + lista mobile), `trilhaChecklist.ts` com assinatura nova e testes, novo componente de contadores.
- Sem alteração no motor de checklist do cliente, no Hub Documental ou em RLS.