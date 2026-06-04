---
name: doc-approval-flow
description: Fluxo bidirecional admin↔portal de qa_documentos_cliente com status pendente/aprovado/reprovado, Realtime e query keys padronizadas
type: feature
---
**Tabela central:** `qa_documentos_cliente` (somente documentos genéricos: BO, CNH, comprovantes, CR/CRAF/GTE/AC enviados pelo cliente). CR/CRAF/GTE/Exames operacionais continuam em `qa_cadastro_cr`/`qa_crafs`/`qa_gtes`/`qa_exames_cliente` (não migrar — Zero Regression).

**Campos de aprovação:** `status` (pendente_aprovacao|aprovado|reprovado|substituido|excluido), `origem` (admin|cliente|sistema|scanner|importacao), `aprovado_por`, `aprovado_em`, `reprovado_por`, `reprovado_em`, `motivo_reprovacao`.

**RLS:** cliente só insere com status=pendente_aprovacao + origem=cliente; staff (qa_is_active_staff) faz tudo. Trigger `qa_docs_cliente_status_coherence` força coerência (preenche aprovado_por/em automaticamente, limpa campos antagônicos).

**Realtime:** publication ligada (REPLICA IDENTITY FULL). Componentes `ClienteDocsEnviados` (admin) e `QAClientePortalPage` (cliente) assinam canais por `clienteId`/`customerId` e invalidam cache via React Query / setDocsReloadKey.

**Query keys obrigatórias:** `["cliente-documentos", clienteId, customerId]`. Nunca usar keys genéricas. Helpers em `src/components/quero-armas/clientes/docsAprovacao.ts`: `aprovarDocumento`, `reprovarDocumento` (motivo obrigatório, mín 3 chars), `excluirDocumentoLogico` (soft delete, NUNCA físico), `isCurrentUserStaff`, `statusBadge`.

**Soft delete obrigatório:** Admin "remover" = `UPDATE status='excluido'`. Listagens filtram com `.neq("status","excluido")`. Preserva auditoria.
