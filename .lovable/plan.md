## Objetivo

Transformar a home `/area-do-cliente` em uma visão executiva premium e simples, com abas (Resumo, Pendências, Meus processos, Financeiro, Documentos, Contratos), filtro multi-processo, e a aba **Resumo** funcionando como dashboard de 1 olhada — sem destruir nada que já funciona.

## Identidade visual confirmada

Arsenal UI oficial:
- Papel `#f6f5f1`
- Bordô `#7A1F2B` (acento de marca)
- Cards brancos, bordas `#E5EAF2`, raio 8px
- Vermelho/âmbar apenas para alerta crítico
- Tipografia atual, sem fundo preto, sem azul institucional

## Fase 1 — Esqueleto de navegação (sem mexer em conteúdo)

Refatorar **somente** o sistema de abas dentro de `QAClientePortalPage.tsx`:

- Trocar o set atual `"resumo" | "contratacoes" | "documentos" | "arsenal" | "mensagens" | "financeiro" | "configuracoes"` por:
  `"resumo" | "pendencias" | "processos" | "financeiro" | "documentos" | "contratos"`
- Sidebar desktop (já existe) recebe os novos labels/ícones, no estilo Arsenal (preto + bordô ativo).
- Mobile: bottom-nav compacta com 5 itens principais + "mais" para Contratos/Suporte.
- Header mantém: "Área do Cliente" + nome + badge "N processos ativos" + sino + suporte.
- Adicionar **ProcessoFilterContext** (provider local no portal) com state `processoSelecionado: "todos" | <processo_id>` — usado por todas as abas para escopar dados, sem mudar nenhuma query existente ainda. Padrão = "todos".

Critério: abas trocam, nada quebra, conteúdo antigo continua sendo renderizado nas abas equivalentes.

## Fase 2 — Aba Resumo (home nova)

Redesenhar **apenas** o conteúdo renderizado quando `activeSection === "resumo"`. Mantém todos os hooks de carga já existentes (`processoSnap`, `analysis`, `vendas`, `processos`, `processoDocs`).

Layout em 2 colunas no desktop, 1 coluna no mobile, todos cards brancos, raio 8px, borda `#E5EAF2`:

1. **Card "Próxima ação"** (full-width, destaque bordô)
   - Deriva da mesma fila que o `ChecklistGuiado` usa hoje (`contarPendentesClienteGuia` + primeiro item da fila).
   - Mostra: serviço-tag, descrição da ação, prioridade, botão "Resolver agora" → abre `ChecklistGuiadoModal` (reuso direto, sem duplicar lógica).
   - Se não há pendência: card neutro "Tudo em dia".

2. **Grid 4 cards compactos** (Pendências / Financeiro / Documentos / Processos)
   - Cada card: ícone, número grande, label, link "Ver detalhes" que troca a aba ativa.
   - Pendências = `processoSnap.pendentes` total. Financeiro = total em aberto de `vendas`. Documentos = `meusDocs.length` enviados / total esperado. Processos = ativos.

3. **Seção "Processos em andamento"**
   - Lista curta (máx 3, com "Ver todos" → aba Processos).
   - Cada item: nome do serviço, status badge, barra de progresso (já existe em `processoSnap`), próxima ação curta, "Ver detalhes" → seta `processoSelecionado` e troca para aba Processos.

4. **Resumo financeiro compacto**
   - Total contratado, Total pago, Em aberto (destaque vermelho se > 0), CTA "Ver financeiro".

5. **Card Equipe Quero Armas**
   - Texto curto + botão WhatsApp (reuso do que já existe).

Tudo o que estava na home antiga (HistoricoAtualizacoes detalhado, Arsenal completo, etc.) **é movido** para as abas correspondentes — nunca apagado.

## Fase 3 — Abas detalhadas + filtro multi-processo

Para cada aba, encapsular o conteúdo já existente em componentes filhos respeitando `processoSelecionado`:

- **Pendências**: lista completa agrupada por processo (deriva de `processoSnap.processos[].pendencias`). Quando `processoSelecionado !== "todos"`, mostra só aquele.
- **Meus processos**: reusa `ClienteProcessosSection` já existente, com filtro aplicado.
- **Financeiro**: lista vendas/cobranças do cliente, filtrável por processo via `qa_itens_venda.venda_id`.
- **Documentos**: reusa hub de documentos atual, filtrável.
- **Contratos**: reusa `ContratoBlock` + `ContratosPosPagamentoCard`, filtrável.

Filtro renderizado como segmented control no topo de cada aba detalhada: "Todos os processos · <nome processo 1> · <nome processo 2>...". Default "todos".

## Fase 4 — Mobile polish + QA

- Header colapsa, abas viram scroll horizontal sticky.
- Cards empilham, "Próxima ação" sempre primeiro.
- Bottom-nav fixa no mobile.
- Botões mínimo 44px.
- Typecheck: `tsc --noEmit` deve passar.
- Smoke: abrir `/area-do-cliente` como cliente com pendências e validar que o `ChecklistGuiado` ainda explode (regra já aprovada).

## O que NÃO vai mudar

- `ChecklistGuiado`, `ChecklistGuiadoModal`, `ChecklistGuiadoBotao`, `ContratoBlock`, `ContratosPosPagamentoCard`
- Hooks de carga de `qa_clientes`, `qa_vendas`, `qa_itens_venda`, `qa_processos`, `qa_processo_documentos`, `qa_processo_eventos`
- Realtime channels
- Lógica de FK `getClienteFK` / `getVendaFK`
- RLS, Edge Functions, schema
- `ArsenalView`, `ClienteProcessosSection`, `CentralAjudaCliente`, `HistoricoAtualizacoes` (reusados como filhos)

## Detalhes técnicos

- Provider `PortalFilterContext` novo em `src/components/quero-armas/portal/PortalFilterContext.tsx` (aditivo, ninguém depende dele ainda).
- Refator de `QAClientePortalPage.tsx` mantém o mesmo nome/rota; muda a estrutura interna do JSX e quebra o monolito em ~5 componentes filhos (`ResumoTab`, `PendenciasTab`, `ProcessosTab`, `FinanceiroTab`, `DocumentosTab`, `ContratosTab`) em `src/components/quero-armas/portal/tabs/`.
- Próxima ação calculada por util novo `derivarProximaAcao(processos, processoDocs, respostas)` em `src/lib/quero-armas/proximaAcao.ts` — reusa exatamente a mesma fila do `checklistGuiadoEngine` (sem duplicar regra).

## Entrega

Faço uma fase por vez, commitando ao final de cada. Após cada fase, valido visualmente no preview e só sigo para a próxima quando confirmar que nada regrediu.

Posso começar pela Fase 1?
