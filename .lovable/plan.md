# Painel "Progresso dos clientes" — correções e novas colunas

## O que está errado hoje (verificado)

- **Profissões incompletas.** O select lê apenas as 6 *condições de ocupação* (`CONDICOES_CHECKLIST`). No banco existem 39 profissões distintas em `qa_clientes.profissao` (GUARDA CIVIL MUNICIPAL, VIGILANTE, ENGENHEIRO, MEI…) que hoje não aparecem — contraria a regra de catálogo cruzado.
- **Grupo "SAÚDE" ainda existe.** `qa_checklist_grupos` tem o slug `saude` ("Aptidão psicológica e técnica") e 25 linhas de `qa_servicos_documentos` gravam `grupo_checklist = 'saude'`. O front já renomeia para "Laudos", o banco não.
- **Ordem de grupos divergente.** No painel admin (RPC) `antecedentes = 50` e `ocupacao = 60`; na área do cliente é o inverso (`ocupacao 50`, `antecedentes 60`). Por isso o Pedro aparece em "condição profissional / ocupação" enquanto na prática está entregando a 2ª certidão (TJM = idoneidade). A trilha "APOSENTADO" dele está correta (vem de `condicao_profissional = aposentado`), o que está errado é a etapa apontada.
- **"COBRANÇAS"** é o nº de cobranças automáticas por inatividade já disparadas (15 dias + semanal). O rótulo não explica isso e não há tooltip.
- **Colunas cortadas / sem navegação.** "PRÓXIMO PASSO" usa `truncate` e sobrepõe visualmente; depois de COBRANÇAS vem PARADO, que fica fora da área visível sem possibilidade de arrastar.

## O que será feito

### 1. Profissões
Regerar `profissoesCatalogo.ts` cruzando as condições canônicas com todos os valores reais de `qa_clientes.profissao` (normalizados para MAIÚSCULO, preservando variantes semânticas conforme a regra já registrada). Nenhuma profissão nova inventada.

### 2. Grupo Laudos
Migração renomeando o grupo `saude` → `laudos` ("Laudos") em `qa_checklist_grupos` e atualizando as 25 linhas de `qa_servicos_documentos` com `grupo_checklist = 'saude'`. RPC passa a emitir `laudos`.

### 3. Etapa atual coerente com a área do cliente
Alinhar a ordem de grupos da RPC à ordem canônica do cliente (Contratos → Cadastros → Identificação civil → Residencial → Ocupação → Idoneidade → Habitualidade → Arma → Declarações → Efetiva necessidade → Laudos → Requerimento → Fechamento), e usar a mesma tipografia/formato de progresso da área do cliente.

### 4. Tabela navegável e configurável
- Quebra de linha em "PRÓXIMO PASSO" (2 linhas, sem sobreposição, nunca por cima da coluna vizinha).
- Arrastar horizontalmente a tabela e a faixa de trilhas com clique-e-puxar (hook `useDragScroll` já existe no projeto).
- Ordenação maior→menor / menor→maior em todas as colunas (clique alterna, seta indica direção).
- Redimensionar largura de coluna arrastando a borda do cabeçalho; larguras salvas no navegador (localStorage).
- **Engrenagem discreta** ao lado do título "PROGRESSO DOS CLIENTES" para escolher quais colunas aparecem (também persistido).
- Tooltip em COBRANÇAS: "Cobranças automáticas por inatividade já enviadas (1ª aos 15 dias, depois semanal)".

### 5. Cabeçalho
O contador de ativos/filtrados vai para a aresta superior direita, sozinho, sem competir com o título.

### 6. Novas colunas
- **ONLINE** — cliente com acesso registrado hoje/últimos minutos (fonte `qa_cliente_login_eventos`), com trilha/filtro "ONLINE" para ordenar quem está conectado agora.
- **EF. NECESSIDADE** — em âmbar quando há narrativa aguardando revisão da equipe (`qa_efetiva_necessidade.status`).
- **PROTOCOLO** — em verde quando o processo já tem protocolo emitido (`qa_protocolos`), com o número; cinza quando não há.

## Detalhes técnicos

- Frontend: `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx` (colunas, resize, drag, engrenagem, ordenação), `src/hooks/useDragScroll.ts` (reuso), `src/lib/quero-armas/profissoesCatalogo.ts`.
- Banco: migração de renomeação `saude → laudos` e nova versão de `public.qa_painel_progresso_clientes()` devolvendo `online`, `efetiva_status` e `protocolo_numero`, com a ordem de grupos corrigida.
- Cores de status permanecem travadas (verde = ok/protocolado, âmbar = revisão, bordô = crítico).
