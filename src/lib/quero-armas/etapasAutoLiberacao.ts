// ============================================================================
// etapasAutoLiberacao
// ----------------------------------------------------------------------------
// Helper canônico que decide se a próxima etapa do checklist do processo pode
// ser liberada automaticamente (sem clique manual da equipe).
//
// Regra: a etapa ATUAL deve estar totalmente cumprida — todos os documentos
// obrigatórios em status cumprido (aprovado/dispensado/etc.), zero pendência
// acionável, zero documento em análise/revisão e todas as perguntas-pivot
// (wizards) respondidas. Esses status são os mesmos definidos em
// `checklistMetrics.ts` — fonte única de verdade.
// ============================================================================

import {
  isChecklistCumprido,
  isChecklistEmAnalise,
  isChecklistPendente,
} from "@/lib/quero-armas/checklistMetrics";

export interface AutoLiberacaoDoc {
  id: string;
  status: string | null;
  obrigatorio?: boolean | null;
  tipo_documento?: string | null;
  etapa?: string | null;
  regra_validacao?: any;
}

export interface AutoLiberacaoInput {
  etapaAtual: number; // 1..5
  docs: AutoLiberacaoDoc[];
  respostasQuestionario?: Record<string, any> | null;
}

export interface AutoLiberacaoResult {
  pode: boolean;
  motivo?: string;
  proximaEtapa?: number;
}

// Mapeamento etapa → número (idêntico ao Drawer/Admin)
export function etapaDoTipoDocumento(tipo: string | null | undefined, etapaRaw?: string | null): number {
  const raw = String(etapaRaw ?? "").trim().toLowerCase();
  if (/^[1-5]$/.test(raw)) return Number(raw);
  if (raw === "endereco" || raw === "endereço" || raw === "comprovacao_endereco") return 1;
  if (raw === "renda" || raw === "condicao_profissional" || raw === "condicao") return 2;
  if (raw === "antecedentes" || raw === "criminal") return 3;
  if (raw === "declaracoes" || raw === "declaracao" || raw === "compromissos") return 4;
  if (raw === "tecnico" || raw === "exames" || raw === "laudo" || raw === "psicologico") return 5;

  const t = String(tipo || "").toLowerCase();
  if (t === "renda_definir_condicao" || t.startsWith("renda_")) return 2;
  if (t.startsWith("certidao") || t.includes("antecedentes")) return 3;
  if (t.includes("laudo") || t.includes("psicologic") || t.includes("capacidade_tecnica") || t.includes("tiro") || t.includes("aptidao")) return 5;
  if (
    t === "pergunta_comprovante_em_nome" ||
    t === "pergunta_ainda_reside_imovel" ||
    t === "pergunta_responde_inquerito_criminal" ||
    t === "declaracao_responsavel_imovel" ||
    t === "declaracao_sem_inquerito_processo_criminal"
  ) return 1;
  if (t.includes("endereco") || t.includes("residenc")) return 1;
  if (t.startsWith("declaracao") || t.startsWith("dsa_") || t.includes("compromisso")) return 4;
  return 1;
}

function isPerguntaPivot(d: AutoLiberacaoDoc): boolean {
  const tipo = (d.regra_validacao as any)?.tipo;
  if (tipo === "pergunta") return true;
  const t = String(d.tipo_documento || "").toLowerCase();
  return t.startsWith("pergunta_");
}

function perguntaRespondida(d: AutoLiberacaoDoc, respostas: Record<string, any>): boolean {
  const chave = (d.regra_validacao as any)?.chave as string | undefined;
  if (!chave) return false;
  const v = respostas[chave];
  return v !== undefined && v !== null && v !== "";
}

export function podeLiberarProximaEtapaAutomaticamente(input: AutoLiberacaoInput): AutoLiberacaoResult {
  const etapaAtual = Math.max(1, Math.min(5, input.etapaAtual || 1));
  if (etapaAtual >= 5) return { pode: false, motivo: "etapa_final" };
  const respostas = input.respostasQuestionario || {};

  const docsEtapa = (input.docs || []).filter(
    (d) => etapaDoTipoDocumento(d.tipo_documento, d.etapa) === etapaAtual && d.obrigatorio !== false,
  );

  // Sem itens obrigatórios na etapa atual → considera cumprida (libera).
  if (docsEtapa.length === 0) {
    return { pode: true, proximaEtapa: etapaAtual + 1 };
  }

  for (const d of docsEtapa) {
    if (isPerguntaPivot(d)) {
      if (!perguntaRespondida(d, respostas)) {
        return { pode: false, motivo: "pergunta_pendente" };
      }
      continue;
    }
    if (isChecklistEmAnalise(d.status)) {
      return { pode: false, motivo: "documento_em_analise" };
    }
    if (isChecklistPendente(d.status)) {
      return { pode: false, motivo: "documento_pendente" };
    }
    if (!isChecklistCumprido(d.status)) {
      return { pode: false, motivo: "documento_nao_cumprido" };
    }
  }

  return { pode: true, proximaEtapa: etapaAtual + 1 };
}