---
name: Etapas de Liberação e Engine de Prazos
description: Sistema de 4 etapas progressivas (endereço→antecedentes→declarações→exames) com auto-cálculo de prazos via IA e trigger SQL
type: feature
---

**Liberação progressiva (qa_processos.etapa_liberada_ate, 1..4):**
- 1=COMPROVAÇÃO DE ENDEREÇO (sempre liberada e categoria padrão "outros")
- 2=ANTECEDENTES CRIMINAIS
- 3=DECLARAÇÕES E COMPROMISSOS
- 4=EXAMES TÉCNICOS

Mapeamento por `tipo_documento` via SQL `qa_etapa_documento(text)` e mirror no front (`etapaDoTipo` no ProcessoDetalheDrawer). Tanto cliente quanto Equipe veem no checklist principal APENAS a etapa atual (`etapa_liberada_ate`). Etapas anteriores concluídas vão para a seção colapsável "ETAPAS CONCLUÍDAS · CONSULTA". Etapas futuras ficam ocultas. A aba EQUIPE pode manter visão técnica completa.

**Auto-liberação:** trigger `qa_proc_docs_recalc_prazos` chama `qa_recalcular_prazos_processo(uuid)` que sobe `etapa_liberada_ate` quando 100% dos obrigatórios da etapa atual estão `aprovado`/`dispensado_grupo`.

**Override manual:** botão admin "LIBERAR ETAPA N" no header do drawer, registra evento `etapa_liberada_manualmente`.

**Prazos (qa_processo_documentos):**
- `data_emissao`, `proxima_leitura` extraídos pela edge `qa-extract-doc-dates` (Gemini Flash via Lovable AI Gateway, disparada em background no upload do cliente)
- `data_validade_efetiva = min(data_emissao + validade_dias, proxima_leitura)`
- `extracao_ia_status`: pendente|extraido|confirmado|erro

**Tabela central:** `qa_validade_documentos` (override por doc continua via `qa_processo_documentos.validade_dias`). Sementes: certidões federais 90d (Lei 7.115/83), estaduais 30d, comprovante endereço 90d, laudos 365d (Decreto 9.847/19), declarações sem prazo.

**Processo (qa_processos):**
- `prazo_critico_data` / `prazo_critico_doc_id`: menor `data_validade_efetiva` entre docs vivos (status enviado/em_analise/aprovado/divergente/revisao_humana)
- `primeiro_doc_aprovado_em`: timestamp do 1º comprovante de endereço aprovado (relógio do processo começa aqui)

**Bug fix download modelo:** edge function `qa-fill-template-cliente` valida ownership via `qa_clientes.user_id == auth.uid()`. Drawer faz fallback automático staff→cliente em 401/403.
