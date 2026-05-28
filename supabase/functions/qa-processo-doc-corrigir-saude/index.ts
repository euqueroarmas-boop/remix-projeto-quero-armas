// ============================================================================
// qa-processo-doc-corrigir-saude  (Bloco 16)
// ----------------------------------------------------------------------------
// Correção assistida da "Saúde do checklist" para a Equipe Quero Armas.
// Só aceita ações seguras e registra evento em qa_processo_eventos.
//
// Body:
//   {
//     processo_id: string,
//     documento_id: string,
//     acao: "definir_etapa" | "aplicar_ordem" | "vincular_arma" |
//           "remover_arma" | "arquivar_duplicado" | "normalizar_status",
//     payload?: Record<string, unknown>
//   }
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { requireQAStaff } from "../_shared/qaAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ETAPAS_VALIDAS = new Set([
  "identificacao",
  "endereco",
  "antecedentes",
  "declaracoes_gerais",
  "final",
  "1",
  "2",
  "3",
  "4",
  "5",
]);

const STATUS_NORMALIZAVEIS = new Set([
  "pendente",
  "em_analise",
  "aprovado",
  "rejeitado",
  "reprovado",
  "divergente",
  "dispensado",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  try {
    const body = await req.json().catch(() => ({} as any));
    const processoId = String(body?.processo_id ?? "").trim();
    const documentoId = String(body?.documento_id ?? "").trim();
    const acao = String(body?.acao ?? "").trim();
    const payload = (body?.payload && typeof body.payload === "object")
      ? body.payload as Record<string, unknown>
      : {};

    if (!processoId || !documentoId || !acao) {
      return json({ error: "processo_id, documento_id e acao são obrigatórios" }, 400);
    }

    const { data: doc, error: docErr } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, cliente_id, tipo_documento, nome_documento, etapa, ordem, status, arma_id, arquivo_storage_key, metadados_documento_json")
      .eq("id", documentoId)
      .maybeSingle();
    if (docErr) return json({ error: docErr.message }, 500);
    if (!doc) return json({ error: "documento_nao_encontrado" }, 404);
    if (doc.processo_id !== processoId) {
      return json({ error: "documento_nao_pertence_ao_processo" }, 409);
    }

    const registrarEvento = async (
      tipo: string,
      descricao: string,
      dados: Record<string, unknown> = {},
    ) => {
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        documento_id: documentoId,
        tipo_evento: tipo,
        descricao,
        ator: "equipe",
        dados_json: { ...dados, ator_user_id: guard.userId },
      } as any).then(() => {}, () => {});
    };

    // ------------------------------------------------------------------
    if (acao === "definir_etapa") {
      const etapa = String(payload?.etapa ?? "").trim().toLowerCase();
      if (!etapa || !ETAPAS_VALIDAS.has(etapa)) {
        return json({ error: "etapa_invalida" }, 400);
      }
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({ etapa })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_etapa_corrigida",
        `Etapa do documento "${doc.nome_documento ?? doc.tipo_documento}" definida como "${etapa}" pela Equipe.`,
        { etapa_anterior: doc.etapa ?? null, etapa_nova: etapa },
      );
      return json({ success: true, etapa });
    }

    // ------------------------------------------------------------------
    if (acao === "aplicar_ordem") {
      const etapa = doc.etapa ?? "";
      const { data: irmaos, error: errI } = await admin
        .from("qa_processo_documentos")
        .select("id, ordem")
        .eq("processo_id", processoId)
        .eq("etapa", etapa);
      if (errI) return json({ error: errI.message }, 500);
      const maior = (irmaos ?? [])
        .map((d: any) => (typeof d.ordem === "number" ? d.ordem : 0))
        .reduce((a: number, b: number) => Math.max(a, b), 0);
      const novaOrdem = maior + 1;
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({ ordem: novaOrdem })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_ordem_corrigida",
        `Ordem aplicada (${novaOrdem}) ao documento "${doc.nome_documento ?? doc.tipo_documento}".`,
        { ordem_anterior: doc.ordem ?? null, ordem_nova: novaOrdem, etapa },
      );
      return json({ success: true, ordem: novaOrdem });
    }

    // ------------------------------------------------------------------
    if (acao === "vincular_arma") {
      const armaId = String(payload?.arma_id ?? "").trim();
      if (!armaId) return json({ error: "arma_id_obrigatorio" }, 400);
      // Confirma que a arma pertence ao mesmo cliente.
      const { data: arma, error: errA } = await admin
        .from("qa_cliente_armas")
        .select("arma_uid, qa_cliente_id")
        .eq("arma_uid", armaId)
        .maybeSingle();
      if (errA) return json({ error: errA.message }, 500);
      if (!arma || Number(arma.qa_cliente_id) !== Number(doc.cliente_id)) {
        return json({ error: "arma_nao_pertence_ao_cliente" }, 409);
      }
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({ arma_id: armaId })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_arma_vinculada",
        `Documento "${doc.nome_documento ?? doc.tipo_documento}" vinculado à arma ${armaId}.`,
        { arma_id_anterior: doc.arma_id ?? null, arma_id_nova: armaId },
      );
      return json({ success: true, arma_id: armaId });
    }

    // ------------------------------------------------------------------
    if (acao === "remover_arma") {
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({ arma_id: null })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_arma_desvinculada",
        `Vínculo com arma removido do documento "${doc.nome_documento ?? doc.tipo_documento}".`,
        { arma_id_anterior: doc.arma_id ?? null },
      );
      return json({ success: true });
    }

    // ------------------------------------------------------------------
    if (acao === "arquivar_duplicado") {
      const confirmado = payload?.confirmado === true;
      if (!confirmado) {
        return json({ error: "confirmacao_obrigatoria" }, 400);
      }
      const meta = (doc.metadados_documento_json && typeof doc.metadados_documento_json === "object")
        ? { ...(doc.metadados_documento_json as Record<string, any>) }
        : {};
      meta.arquivado_duplicado = {
        em: new Date().toISOString(),
        por_user_id: guard.userId,
        motivo: String(payload?.motivo ?? "duplicidade resolvida pela equipe"),
      };
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({
          status: "arquivado_duplicado",
          metadados_documento_json: meta,
        })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_duplicidade_resolvida",
        `Documento "${doc.nome_documento ?? doc.tipo_documento}" arquivado como duplicado.`,
        { status_anterior: doc.status ?? null },
      );
      return json({ success: true, status: "arquivado_duplicado" });
    }

    // ------------------------------------------------------------------
    if (acao === "normalizar_status") {
      const novoStatus = String(payload?.status ?? "").trim().toLowerCase();
      if (!novoStatus || !STATUS_NORMALIZAVEIS.has(novoStatus)) {
        return json({ error: "status_invalido" }, 400);
      }
      const { error } = await admin
        .from("qa_processo_documentos")
        .update({ status: novoStatus })
        .eq("id", documentoId);
      if (error) return json({ error: error.message }, 500);
      await registrarEvento(
        "checklist_doc_status_normalizado",
        `Status do documento "${doc.nome_documento ?? doc.tipo_documento}" normalizado para "${novoStatus}".`,
        { status_anterior: doc.status ?? null, status_novo: novoStatus },
      );
      return json({ success: true, status: novoStatus });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e: any) {
    console.error("[qa-processo-doc-corrigir-saude]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
