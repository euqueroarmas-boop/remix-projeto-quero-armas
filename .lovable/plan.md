# Correção dos mismatches semânticos — Área do Cliente

Plano de execução em 5 blocos, do mais crítico ao cosmético. Cada bloco é independente e pode ser aprovado isoladamente. Nenhum bloco refatora fluxo estável sem necessidade.

## Bloco 1 — Chave de ligação processo ↔ solicitação (crítico)

Hoje `qa_solicitacoes_servico.processo_id` é `integer` enquanto `qa_processos.id` é `uuid`. Por isso as 18 linhas existentes estão nulas: o valor nunca coube na coluna.

Passos:
1. Migração: renomear a coluna morta para `processo_id_legacy_int` (preserva histórico, não apaga nada).
2. Migração: criar `processo_id uuid REFERENCES qa_processos(id) ON DELETE SET NULL` + índice.
3. Backfill por par (cliente, serviço, data) — via ferramenta de dados, não migração.
4. Trigger `trg_qa_solicitacao_vincula_processo`: ao criar processo, grava o vínculo na solicitação.
5. Frontend passa a ler o processo pela FK em vez de reconstruir por cliente+serviço.

Arquivos alterados (sem renomear):
- `src/pages/quero-armas/QAClientePortalPage.tsx`
- `src/components/quero-armas/clientes/ClienteResumoKanban.tsx`
- `src/pages/quero-armas/QAProcessosPage.tsx`

## Bloco 2 — Vocabulário de status (um dicionário só)

Três listas de status convivem: as do banco, as de `statusServico.ts` e as inline em componentes.

Passos:
1. Promover `src/lib/quero-armas/statusServico.ts` a dicionário único, exportando também os status de documento hoje espalhados.
2. Substituir comparações inline (`status === 'aprovado'` etc.) pelos helpers de `checklistMetrics.ts`.
3. Migração: `CHECK` em `qa_processo_documentos.status` espelhando exatamente o conjunto do dicionário.

Renomeações propostas (clareza de escopo — o nome atual não diz de qual status se trata):
- `src/lib/quero-armas/statusServico.ts` → `src/lib/quero-armas/status/statusServico.ts`
- `src/lib/quero-armas/statusUnificado.ts` → `src/lib/quero-armas/status/statusLeituraUnificada.ts`
- `src/lib/quero-armas/statusColors.ts` → `src/lib/quero-armas/status/statusCores.ts`
- `src/lib/quero-armas/checklistMetrics.ts` → `src/lib/quero-armas/status/statusDocumento.ts`
- novo: `src/lib/quero-armas/status/index.ts` (reexporta tudo; os imports antigos passam a apontar para cá)

## Bloco 3 — Tipos de documento órfãos (quebra envio de exame institucional)

Existem `tipo_documento` no checklist que o Hub não conhece, e a gravação cai em `outro`.

Passos:
1. Query de diferença entre `qa_processo_documentos.tipo_documento`, `qa_documentos_biblioteca.tipo` e `HUB_TIPOS_VALIDOS`.
2. Para cada órfão: ou apelido em `qa_tipo_documento_aliases`, ou entrada no vocabulário do Hub.
3. Trocar a lista hardcoded `HUB_TIPOS_VALIDOS` por leitura do catálogo, com a lista atual só como fallback.

Renomeação proposta (o arquivo deixa de ser "mapa" e passa a ser o vocabulário):
- `src/lib/quero-armas/hubTipoMap.ts` → `src/lib/quero-armas/documentos/vocabularioTipos.ts`

## Bloco 4 — Validade em fonte única

Regra de validade hoje vive em `validadeDocumento.ts` (código) e em `qa_documentos_biblioteca.validade_dias` (banco), e as duas divergem.

Passos:
1. Banco vira a fonte; o código mantém apenas o fallback e as regras especiais (indeterminada, nota fiscal perpétua).
2. Ajustar as linhas divergentes de `validade_dias` via ferramenta de dados.
3. Exibir no Hub a origem da validade (catálogo x regra especial) para auditoria.

Renomeação proposta:
- `src/lib/quero-armas/validadeDocumento.ts` → `src/lib/quero-armas/documentos/validade.ts`

## Bloco 5 — Etapas mortas (risco zero)

`normalizeChecklistStage` aceita rótulos (`antecedentes`, `declaracoes`, `renda`) que nenhum catálogo produz mais.

Passos: remover os ramos mortos e alinhar com a numeração 1..5 já usada em `etapaNumeroChecklist`. Sem renomeação.

## Detalhes técnicos

- Toda renomeação é feita com `mv` + atualização dos imports no mesmo commit; nenhum arquivo fica com re-export vazio permanente, exceto o `status/index.ts` que é intencional.
- Blocos 1, 2 e 3 exigem migração aprovada; blocos 4 e 5 são só código.
- Ordem recomendada de execução: 1 → 3 → 2 → 4 → 5.
