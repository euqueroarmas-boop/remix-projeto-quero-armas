---
name: Central de Documentos — Empilhamento por Família
description: Empilhamento visual, escolha de principal e reaproveitamento consolidado por família documental
type: feature
---
# Central de Documentos — Empilhamento por Família

Regras aplicadas em `src/lib/quero-armas/documentosAgrupamento.ts` e integradas em `ClienteDocsEnviados.tsx` + `ClienteResumoKanban.tsx`.

## UI
- **Uma linha/card por família documental** (ex.: `comprovante_residencia` colapsa 2022/2023/2024/2025/2026).
- Documento **principal** aparece no topo (prioridade: aprovado+vigente → vigente → vence_em_breve → vencido recente → histórico).
- Versões antigas ficam recolhidas como "+ N versão(ões) anterior(es)" — expansível, nunca escondidas.
- Chip "alerta suprimido" quando principal vigente silencia versões vencidas.
- Certidões TJSP Distribuição vs Execuções, TRF3 Regional vs Nacional NÃO se agrupam (subtipos preservados).
- CRAFs/GTEs qualificados por número de série para não misturar armas distintas.

## Reaproveitamento (DB — `qa_reaproveitar_documentos_hub_processo`)
Já respeita o "principal" por família via `DISTINCT ON (pd.id) ORDER BY cv.data_validade DESC NULLS LAST, cv.created_at DESC` sobre `qa_documentos_cliente` filtrada por `(validado_admin OR status='aprovado') AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)`. Documentos vencidos antigos nunca são candidatos. Se não houver principal válido, exigência permanece pendente. TJM-SP vs STM checados por texto do arquivo/IA.

## Auditoria
Registrada em `logs_sistema` (tipo=`admin`, status=`info`) via `auditarGrupoSeUtil` em `ClienteDocsEnviados.tsx`:
- `documento_principal_definido`, `alerta_suprimido_por_documento_valido`, `documento_empilhado_historico`.
- Dedupe **24h por (cliente, família)** via localStorage — só loga quando há empilhamento ou supressão real (não polui).
- Payload inclui `cliente_id`, `familia_documento`, `documento_principal_id`, `documentos_historicos_ids`, `motivo`, `timestamp`.

## Proibições
- Não esconder documentos antigos.
- Não colapsar subtipos legalmente distintos.
- Não afrouxar a regra de checklist: pendência só é satisfeita por principal vigente/aprovado.