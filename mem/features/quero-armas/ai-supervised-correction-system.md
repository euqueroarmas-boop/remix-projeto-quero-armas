---
name: AI Supervised Correction System
description: Sistema de aprendizado supervisionado da IA jurídica QA — tabela qa_ia_correcoes_juridicas, página /correcoes-ia, fases de captura+injeção
type: feature
---
**Tabela**: `qa_ia_correcoes_juridicas` — armazena trecho_errado/trecho_correto por tipo_peca + categoria_erro (enum `qa_categoria_erro_ia`, 15 valores). Escopo: aplicar_globalmente OU restrito a cliente_id/caso_id/peca_id (CHECK de coerência). Tracking: usado_vezes, ultima_utilizacao.

**RLS**: somente equipe interna via `qa_is_active_staff(auth.uid())` (qa_usuarios_perfis ativo). Clientes finais NÃO acessam.

**Página**: `/correcoes-ia` (QACorrecoesIAPage) — Arsenal UI Premium Light, âmbar #F59E0B. CRUD + filtros (tipo, categoria, status, escopo) + KPIs (total, ativas, globais, usos). Dialog de criar/editar com Switch para escopo/ativo.

**Sidebar**: grupo "Jurídico & IA", icone GraduationCap. Bloqueado para perfil `leitura_auditoria`.

**Fases**:
- Fase 1 ✅: tabela + RLS + página admin CRUD
- Fase 2 ✅: captura via DraftingView (PecaCorrectionTools + MarcarErroIAModal), seleção flutuante + botão fixo, escopo coerente (cliente_id integer, caso_id/peca_id uuid).
- Fase 3 ✅: edge function `qa-gerar-peca` injeta no máx. 20 correções ativas (prioridade peca>caso>cliente>global, foco e categorias críticas elevam score) sob bloco "CORREÇÕES JURÍDICAS SUPERVISIONADAS — OBRIGATÓRIAS"; pós-geração faz checagem textual literal + normalizada (sem acentos/pontuação) e devolve `correcoes_ia_alertas` no SSE `done`. `usado_vezes` e `ultima_utilizacao` são incrementados após sucesso. `qa_geracoes_pecas` ganhou `correcoes_ia_usadas_json` e `correcoes_ia_alertas_json`. UI: `CorrecoesAlertaPanel` (Arsenal âmbar) com "Aplicar correção" (substitui `trecho_suspeito`/`trecho_errado` por `trecho_correto` no streamedText e resultado.minuta_gerada) e "Ignorar alerta" (apenas fecha, não desativa).

**Constraints**: trecho_errado e trecho_correto >= 5 chars. Não substituir templates fixos. Não inventar jurisprudência. Correções inativas nunca são enviadas para IA.
