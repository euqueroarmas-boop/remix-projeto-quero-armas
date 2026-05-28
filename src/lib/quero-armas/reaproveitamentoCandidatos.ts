/* =============================================================================
 * Bloco 12 — Busca de candidatos a reaproveitamento (camada canônica)
 *
 * Camada PURAMENTE ADITIVA. Lê `qa_processo_documentos` do cliente atual
 * (RLS já garante isolamento por cliente_id via qa_processo_doc_cliente_select)
 * e retorna, para um documento de destino, a lista de documentos de origem
 * compatíveis segundo as regras canônicas de `documentoEscopo.ts`.
 *
 * A camada NÃO muta dados. Aplicar o reaproveitamento (marcar o destino
 * como `dispensado_por_reaproveitamento`) é responsabilidade da edge
 * function `qa-processo-doc-reaproveitar`.
 * ============================================================================= */

import { supabase } from "@/integrations/supabase/client";
import {
  podeReaproveitarDocumento,
  motivoReaproveitamentoBloqueado,
  getDocumentoEscopo,
  type EscopoDocumento,
  type DocEscopavel,
} from "./documentoEscopo";

export interface DestinoReaproveitavel extends DocEscopavel {
  id: string;
  processo_id?: string | null;
}

export interface CandidatoReaproveitamento {
  id: string;
  tipo_documento: string;
  nome_documento: string | null;
  processo_id: string;
  processo_servico_nome?: string | null;
  status: string;
  data_envio: string | null;
  data_validade: string | null;
  data_validade_efetiva: string | null;
  arma_id: string | null;
  etapa: string | null;
  arquivo_storage_key: string | null;
  escopo: EscopoDocumento;
}

const STATUS_REAPROVEITAVEIS = new Set([
  "aprovado",
  "validado",
  "dispensado_por_reaproveitamento",
]);

function vencido(dataValidade?: string | null): boolean {
  if (!dataValidade) return false;
  const t = new Date(dataValidade).getTime();
  return !isNaN(t) && t < Date.now();
}

export interface BuscarCandidatosOpts {
  /** cliente dono dos documentos (RLS já filtra, mas validamos no client) */
  clienteId: number;
  /** evita propor o próprio doc como candidato a si mesmo */
  excluirIds?: string[];
}

/**
 * Lista candidatos a reaproveitar uma exigência. Aplica:
 *   - mesmo `tipo_documento` (case-insensitive)
 *   - status em `STATUS_REAPROVEITAVEIS`
 *   - não vencido (`data_validade_efetiva` ou `data_validade`)
 *   - `podeReaproveitarDocumento(origem, destino)` retorna true
 *
 * Resultado ordenado por: (1) escopo "cliente" antes de "arma",
 * (2) mais recente primeiro, (3) com `arquivo_storage_key` antes de sem.
 */
export async function buscarCandidatosReaproveitamento(
  destino: DestinoReaproveitavel,
  opts: BuscarCandidatosOpts,
): Promise<CandidatoReaproveitamento[]> {
  const tipo = String(destino?.tipo_documento ?? "").trim().toLowerCase();
  if (!tipo) return [];
  const escopoDestino = getDocumentoEscopo(destino);
  // "processo" nunca reaproveita automaticamente (regra canônica).
  if (escopoDestino === "processo") return [];

  const excluir = new Set<string>([destino.id, ...(opts.excluirIds ?? [])]);

  // tipo_documento normalizado pode vir em maiúsculas no banco — busca case-insensitive.
  const { data, error } = await supabase
    .from("qa_processo_documentos")
    .select(
      "id, processo_id, cliente_id, tipo_documento, nome_documento, etapa, status, arma_id, arquivo_storage_key, data_envio, data_validade, data_validade_efetiva",
    )
    .eq("cliente_id", opts.clienteId)
    .ilike("tipo_documento", tipo)
    .in("status", Array.from(STATUS_REAPROVEITAVEIS));
  if (error) {
    console.warn("[reaproveitamento] busca falhou (silencioso)", error);
    return [];
  }

  const out: CandidatoReaproveitamento[] = [];
  for (const row of (data ?? []) as any[]) {
    if (excluir.has(row.id)) continue;
    const venc = row.data_validade_efetiva ?? row.data_validade ?? null;
    if (vencido(venc)) continue;
    const origem: DocEscopavel = {
      tipo_documento: row.tipo_documento,
      etapa: row.etapa,
      arma_id: row.arma_id,
    };
    if (!podeReaproveitarDocumento(origem, destino)) {
      // log interno — não mostrar ao cliente
      const motivo = motivoReaproveitamentoBloqueado(origem, destino);
      if (motivo) console.debug("[reaproveitamento] bloqueado:", row.id, motivo);
      continue;
    }
    out.push({
      id: row.id,
      tipo_documento: row.tipo_documento,
      nome_documento: row.nome_documento ?? null,
      processo_id: row.processo_id,
      status: row.status,
      data_envio: row.data_envio ?? null,
      data_validade: row.data_validade ?? null,
      data_validade_efetiva: row.data_validade_efetiva ?? null,
      arma_id: row.arma_id ?? null,
      etapa: row.etapa ?? null,
      arquivo_storage_key: row.arquivo_storage_key ?? null,
      escopo: getDocumentoEscopo(origem),
    });
  }

  out.sort((a, b) => {
    if (a.escopo !== b.escopo) return a.escopo === "cliente" ? -1 : 1;
    const ka = a.arquivo_storage_key ? 0 : 1;
    const kb = b.arquivo_storage_key ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const da = a.data_envio ? new Date(a.data_envio).getTime() : 0;
    const db = b.data_envio ? new Date(b.data_envio).getTime() : 0;
    return db - da;
  });

  return out;
}

/** Chama a edge function para marcar o destino como reaproveitado. */
export async function aplicarReaproveitamento(params: {
  destinoDocumentoId: string;
  origemDocumentoId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-doc-reaproveitar`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({
        destino_documento_id: params.destinoDocumentoId,
        origem_documento_id: params.origemDocumentoId,
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: (out as any)?.error ?? "Falha ao reaproveitar." };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro de rede." };
  }
}