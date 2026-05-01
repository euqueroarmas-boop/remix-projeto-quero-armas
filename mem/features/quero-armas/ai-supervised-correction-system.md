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
- Fase 2 (pendente): modal "Marcar trecho como erro" no DraftingView (seleção de texto + botão flutuante + botão fixo "Nova correção")
- Fase 3 (pendente): injeção das correções ativas no prompt do qa-gerar-peca + checagem pós-geração (textual normalizado primeiro, embeddings se nada bater) + auto-incremento de usado_vezes/ultima_utilizacao

**Constraints**: trecho_errado e trecho_correto >= 5 chars. Não substituir templates fixos. Não inventar jurisprudência. Correções inativas nunca são enviadas para IA.
