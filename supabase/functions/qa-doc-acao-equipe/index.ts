// qa-doc-acao-equipe
// Ações operacionais da Equipe Quero Armas sobre um documento de processo:
//
//   - aprovar               → status=aprovado (decisao_ia preservada)
//   - rejeitar              → status=invalido + motivo obrigatório
//   - solicitar_novo_envio  → status=pendente + motivo + zera arquivo
//   - aprovar_e_modelar     → aprovar + chamar qa-modelo-aprovado-criar
//   - signed_url            → devolve URL temporária do arquivo p/ preview
//
// NUNCA toca em decisao_ia (decisão da IA é histórica). Aprovações manuais
// continuam contando como manual.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const { documento_id, acao, motivo, nome_modelo, observacoes } = body || {};
    if (!documento_id || !acao) return json({ error: "documento_id e acao são obrigatórios" }, 400);

    const supabase = createClient(url, service);

    const { data: doc, error: docErr } = await supabase
      .from("qa_processo_documentos")
      .select("id, processo_id, cliente_id, tipo_documento, nome_documento, status, arquivo_storage_key, usado_como_modelo")
      .eq("id", documento_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Documento não encontrado" }, 404);

    const evento = async (tipo: string, descricao: string, dados: Record<string, unknown> = {}) => {
      await supabase.from("qa_processo_eventos").insert({
        processo_id: doc.processo_id,
        documento_id: doc.id,
        tipo_evento: tipo,
        descricao,
        dados_json: { ...dados, ator_user_id: guard.userId },
        ator: "equipe",
      }).then(() => {}, () => {});
    };

    // Auditoria universal de status (qa_status_eventos). Não bloqueante.
    const auditarStatus = async (statusNovo: string, motivoTxt?: string | null, contexto?: string) => {
      try {
        if (!doc.status || doc.status === statusNovo) return;
        await supabase.from("qa_status_eventos").insert({
          cliente_id: doc.cliente_id ?? null,
          processo_id: doc.processo_id ?? null,
          documento_id: doc.id,
          origem: "equipe",
          entidade: "processo_documento",
          entidade_id: String(doc.id),
          campo_status: "status",
          status_anterior: doc.status,
          status_novo: statusNovo,
          usuario_id: guard.userId ?? null,
          motivo: motivoTxt ?? null,
          detalhes: {
            tipo_documento: doc.tipo_documento,
            nome_documento: doc.nome_documento,
            contexto: contexto ?? "qa-doc-acao-equipe",
          },
        });
      } catch (_e) {
        // best-effort
      }
    };

    switch (acao) {
      case "signed_url": {
        if (!doc.arquivo_storage_key) return json({ error: "Documento sem arquivo." }, 404);
        const { data: signed, error } = await supabase.storage
          .from("qa-processo-docs")
          .createSignedUrl(doc.arquivo_storage_key, 60 * 10);
        if (error || !signed?.signedUrl) return json({ error: error?.message || "Falha ao gerar URL" }, 500);
        return json({ ok: true, url: signed.signedUrl });
      }

      case "aprovar": {
        await supabase.from("qa_processo_documentos").update({
          status: "aprovado",
          motivo_rejeicao: null,
          revisado_por: guard.userId,
          data_validacao: new Date().toISOString(),
        }).eq("id", documento_id);
        await evento("aprovacao_manual", `Equipe aprovou manualmente "${doc.nome_documento}".`);
        await auditarStatus("aprovado", null, "aprovar");
        return json({ ok: true });
      }

      case "rejeitar": {
        const m = (motivo || "").toString().trim();
        if (m.length < 5) return json({ error: "Motivo de rejeição obrigatório (mín. 5 caracteres)." }, 400);
        await supabase.from("qa_processo_documentos").update({
          status: "invalido",
          motivo_rejeicao: m,
          revisado_por: guard.userId,
          data_validacao: new Date().toISOString(),
        }).eq("id", documento_id);
        await evento("rejeicao_manual", `Equipe rejeitou "${doc.nome_documento}".`, { motivo: m });
        await auditarStatus("invalido", m, "rejeitar");
        return json({ ok: true });
      }

      case "solicitar_novo_envio": {
        const m = (motivo || "").toString().trim();
        if (m.length < 5) return json({ error: "Motivo do novo envio obrigatório (mín. 5 caracteres)." }, 400);
        await supabase.from("qa_processo_documentos").update({
          status: "pendente",
          motivo_rejeicao: m,
          // mantém arquivo_storage_key para histórico; o cliente pode reenviar.
          revisado_por: guard.userId,
          data_validacao: null,
          observacoes_cliente: m,
        }).eq("id", documento_id);
        await evento("novo_envio_solicitado", `Equipe solicitou novo envio de "${doc.nome_documento}".`, { motivo: m });
        await auditarStatus("pendente", m, "solicitar_novo_envio");
        return json({ ok: true });
      }

      case "aprovar_e_modelar": {
        if (doc.usado_como_modelo) {
          return json({ error: "Documento já usado como modelo." }, 409);
        }
        // 1) Aprova primeiro (idempotente)
        if (doc.status !== "aprovado") {
          await supabase.from("qa_processo_documentos").update({
            status: "aprovado",
            motivo_rejeicao: null,
            revisado_por: guard.userId,
            data_validacao: new Date().toISOString(),
          }).eq("id", documento_id);
          await evento("aprovacao_manual", `Equipe aprovou "${doc.nome_documento}" (encadeado a modelo).`);
          await auditarStatus("aprovado", observacoes ?? null, "aprovar_e_modelar");
        }
        // 2) Encadeia a função de promoção a modelo (passando o JWT da equipe)
        const auth = req.headers.get("Authorization") || "";
        const r = await fetch(`${url}/functions/v1/qa-modelo-aprovado-criar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ documento_id, nome_modelo, observacoes }),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: out?.error || `Falha ao criar modelo (${r.status})` }, r.status);
        return json({ ok: true, modelo_id: out?.modelo_id });
      }

      default:
        return json({ error: `Ação desconhecida: ${acao}` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});