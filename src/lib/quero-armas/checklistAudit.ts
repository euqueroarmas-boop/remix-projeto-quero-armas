/* =============================================================================
 * Bloco 15 — Auditoria visual de consistência documental.
 *
 * Camada PURAMENTE ADITIVA E READ-ONLY: recebe a lista de documentos do
 * processo (qa_processo_documentos) e devolve uma lista de "issues" para
 * a Equipe Quero Armas inspecionar no drawer do Admin.
 *
 * Não altera dados, não chama Supabase, não muta o checklist. Existe apenas
 * para dar à equipe um painel de coerência: quando o checklist nasce torto
 * (exigência duplicada, status estranho, doc de arma sem `arma_id`, etc.),
 * o problema vira VISÍVEL — em vez de virar suporte depois.
 * ============================================================================= */

import {
  isChecklistCumprido,
  isChecklistEmAnalise,
  isChecklistPendente,
  STATUS_CHECKLIST_CUMPRIDO,
  STATUS_CHECKLIST_EM_ANALISE,
  STATUS_CHECKLIST_PENDENTE,
} from "./checklistMetrics";
import { getDocumentoEscopo } from "./documentoEscopo";
import { isDocDeArma } from "./documentosDeArma";
import { ETAPAS_PERMANENTES } from "./documentosCaixaClassifier";

export type AuditSeverity = "info" | "warning" | "critical";

export interface ChecklistAuditIssue {
  severity: AuditSeverity;
  code: string;
  message: string;
  docIds?: string[];
  actionLabel?: string;
}

export interface AuditableDoc {
  id: string;
  tipo_documento?: string | null;
  nome_documento?: string | null;
  etapa?: string | null;
  ordem?: number | null;
  status?: string | null;
  arma_id?: string | null;
  arquivo_storage_key?: string | null;
  arquivo_url?: string | null;
  dados_extraidos_json?: any;
  divergencias_json?: any;
  created_at?: string | null;
}

const STATUS_CONHECIDOS: ReadonlySet<string> = new Set<string>([
  ...STATUS_CHECKLIST_CUMPRIDO,
  ...STATUS_CHECKLIST_EM_ANALISE,
  ...STATUS_CHECKLIST_PENDENTE,
]);

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function temArquivo(d: AuditableDoc): boolean {
  return !!(
    (d.arquivo_storage_key && String(d.arquivo_storage_key).trim() !== "") ||
    (d.arquivo_url && String(d.arquivo_url).trim() !== "")
  );
}

/**
 * Audita o checklist do processo e retorna a lista de inconsistências
 * encontradas. Lista vazia = checklist consistente.
 */
export function auditarChecklistProcesso(
  docs: AuditableDoc[] | null | undefined,
): ChecklistAuditIssue[] {
  const issues: ChecklistAuditIssue[] = [];
  const lista = Array.isArray(docs) ? docs.filter(Boolean) : [];
  if (lista.length === 0) return issues;

  // ------------------------------------------------------------------
  // 1) Documentos duplicados — mesmo tipo + mesmo escopo + mesma arma.
  // ------------------------------------------------------------------
  const buckets = new Map<string, AuditableDoc[]>();
  for (const d of lista) {
    const tipo = norm(d.tipo_documento);
    if (!tipo) continue;
    const escopo = getDocumentoEscopo(d);
    const arma = norm(d.arma_id);
    const etapa = norm(d.etapa);
    const key = `${tipo}::${escopo}::${etapa}::${arma}`;
    const arr = buckets.get(key) ?? [];
    arr.push(d);
    buckets.set(key, arr);
  }
  for (const [, arr] of buckets) {
    if (arr.length < 2) continue;
    const cumpridos = arr.filter((d) => isChecklistCumprido(d.status));
    const pendentes = arr.filter((d) => isChecklistPendente(d.status));
    const tipo = norm(arr[0].tipo_documento);

    if (cumpridos.length > 0 && pendentes.length > 0) {
      issues.push({
        severity: "critical",
        code: "duplicado",
        message: `EXIGÊNCIA "${tipo.toUpperCase()}" APARECE COMO CUMPRIDA E COMO PENDENTE AO MESMO TEMPO — UNIFIQUE OS REGISTROS.`,
        docIds: arr.map((d) => d.id),
        actionLabel: "Resolver duplicidade",
      });
    } else {
      issues.push({
        severity: "warning",
        code: "duplicado",
        message: `EXIGÊNCIA "${tipo.toUpperCase()}" APARECE ${arr.length} VEZES NO MESMO ESCOPO — VERIFIQUE SE É DUPLICATA.`,
        docIds: arr.map((d) => d.id),
        actionLabel: "Resolver duplicidade",
      });
    }
  }

  // ------------------------------------------------------------------
  // 2..7) Auditorias por documento.
  // ------------------------------------------------------------------
  const semEtapa: string[] = [];
  const semOrdemDinamica: string[] = [];
  const statusEstranho: { id: string; status: string }[] = [];
  const docArmaSemId: string[] = [];
  const armaIdEmTipoNaoArma: string[] = [];
  const processoComoPermanente: string[] = [];
  const tipoErrado: { id: string; detectado: string }[] = [];

  for (const d of lista) {
    const tipo = norm(d.tipo_documento);
    const etapa = norm(d.etapa);
    const status = norm(d.status);
    const escopo = getDocumentoEscopo(d);

    if (!etapa) semEtapa.push(d.id);

    // Exigência dinâmica = não tem `ordem` definida (catálogo dá ordem; itens
    // criados a quente no fluxo do cliente entram sem ordem). Só vira issue
    // se o item ainda está acionável — senão é ruído.
    if (
      (d.ordem == null || Number.isNaN(Number(d.ordem))) &&
      !isChecklistCumprido(d.status)
    ) {
      semOrdemDinamica.push(d.id);
    }

    if (status && !STATUS_CONHECIDOS.has(status)) {
      statusEstranho.push({ id: d.id, status });
    }

    if (isDocDeArma(tipo) && !norm(d.arma_id)) {
      docArmaSemId.push(d.id);
    }
    // Tem arma_id mas o tipo não está catalogado como doc de arma.
    if (!isDocDeArma(tipo) && norm(d.arma_id)) {
      armaIdEmTipoNaoArma.push(d.id);
    }

    if (escopo === "processo" && etapa && ETAPAS_PERMANENTES.has(etapa)) {
      processoComoPermanente.push(d.id);
    }

    // Tipo divergente: a IA detectou outro tipo dentro do arquivo enviado.
    const ext = d.dados_extraidos_json && typeof d.dados_extraidos_json === "object"
      ? (d.dados_extraidos_json as any)
      : null;
    const detectado = norm(ext?.tipo_detectado ?? ext?.tipo_documento_detectado);
    if (temArquivo(d) && detectado && tipo && detectado !== tipo) {
      tipoErrado.push({ id: d.id, detectado });
    }
  }

  if (semEtapa.length > 0) {
    issues.push({
      severity: "warning",
      code: "sem_etapa",
      message: `${semEtapa.length} DOCUMENTO(S) SEM ETAPA DEFINIDA — ORDENAÇÃO PODE FICAR IMPREVISÍVEL.`,
      docIds: semEtapa,
      actionLabel: "Definir etapa",
    });
  }
  if (semOrdemDinamica.length > 0) {
    issues.push({
      severity: "info",
      code: "sem_ordem",
      message: `${semOrdemDinamica.length} EXIGÊNCIA(S) DINÂMICA(S) SEM ORDEM DEFINIDA — APARECEM NO FIM DA ETAPA.`,
      docIds: semOrdemDinamica,
      actionLabel: "Aplicar próxima ordem",
    });
  }
  if (statusEstranho.length > 0) {
    const exemplos = Array.from(new Set(statusEstranho.map((s) => s.status))).slice(0, 3).join(", ").toUpperCase();
    issues.push({
      severity: "warning",
      code: "status_desconhecido",
      message: `${statusEstranho.length} DOCUMENTO(S) COM STATUS FORA DO PADRÃO (${exemplos}) — REVISE A CLASSIFICAÇÃO.`,
      docIds: statusEstranho.map((s) => s.id),
      actionLabel: "Normalizar status",
    });
  }
  if (docArmaSemId.length > 0) {
    const unicos = Array.from(new Set(docArmaSemId));
    issues.push({
      severity: "critical",
      code: "doc_arma_sem_arma_id",
      message: `${unicos.length} DOCUMENTO(S) DE ARMA SEM VÍNCULO COM ARMA ESPECÍFICA (\`arma_id\`) — RISCO DE MISTURAR ACERVO.`,
      docIds: unicos,
      actionLabel: "Vincular arma",
    });
  }
  if (armaIdEmTipoNaoArma.length > 0) {
    issues.push({
      severity: "warning",
      code: "arma_id_em_tipo_nao_arma",
      message: `${armaIdEmTipoNaoArma.length} DOCUMENTO(S) VINCULADO(S) A UMA ARMA, MAS O TIPO NÃO ESTÁ NA LISTA DE DOCS DE ARMA — REVISAR.`,
      docIds: armaIdEmTipoNaoArma,
      actionLabel: "Revisar tipo",
    });
  }
  if (processoComoPermanente.length > 0) {
    issues.push({
      severity: "warning",
      code: "processo_em_etapa_permanente",
      message: `${processoComoPermanente.length} DOCUMENTO(S) DE PROCESSO CLASSIFICADO(S) EM ETAPA PERMANENTE — PODE REAPROVEITAR INDEVIDAMENTE.`,
      docIds: processoComoPermanente,
    });
  }
  if (tipoErrado.length > 0) {
    issues.push({
      severity: "critical",
      code: "arquivo_tipo_errado",
      message: `${tipoErrado.length} ARQUIVO(S) ENVIADO(S) PARECEM SER DE OUTRO TIPO — CONFERIR ANTES DE APROVAR.`,
      docIds: tipoErrado.map((t) => t.id),
    });
  }

  // Ordena por severidade: critical → warning → info.
  const ordemSev: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => ordemSev[a.severity] - ordemSev[b.severity]);

  return issues;
}

// Re-export para conveniência (callers que querem decidir cor/ícone).
export { isChecklistCumprido, isChecklistEmAnalise, isChecklistPendente };
