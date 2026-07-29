// Notifica o cliente quando um documento do Hub Documental é aprovado ou reprovado pela equipe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireQAStaff } from "../_shared/qaAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nomeDocumento(doc: Record<string, unknown>) {
  const nome = String(doc.nome_documento || doc.arquivo_nome || doc.tipo_documento || "Documento").trim();
  return nome || "Documento";
}

function motivoPadrao(status: string) {
  return status === "aprovado"
    ? "Documento conferido pela equipe e aprovado para uso no cadastro, acervo ou processo aplicável."
    : "Documento conferido pela equipe e recusado. Verifique o motivo e envie uma nova versão pelo portal.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  const traceId = `qa-hub-doc-status-${crypto.randomUUID()}`;

  try {
    const body = await req.json().catch(() => ({}));
    const documentoId = String(body?.documento_id || "").trim();
    const statusInformado = String(body?.status || "").trim().toLowerCase();
    const motivoInformado = String(body?.motivo || "").trim();

    if (!documentoId) return json({ error: "documento_id é obrigatório", traceId }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: docErr } = await supabase
      .from("qa_documentos_cliente")
      .select("id, qa_cliente_id, customer_id, tipo_documento, nome_documento, arquivo_nome, status, motivo_reprovacao")
      .eq("id", documentoId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: "Documento não encontrado", traceId }, 404);

    const status = statusInformado || String(doc.status || "").toLowerCase();
    if (status !== "aprovado" && status !== "reprovado") {
      return json({ skipped: true, reason: "status_sem_notificacao", status, traceId });
    }

    let cliente: { nome_completo: string | null; email: string | null } | null = null;
    if (doc.qa_cliente_id) {
      const { data } = await supabase
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", doc.qa_cliente_id)
        .maybeSingle();
      cliente = data;
    }
    if (!cliente?.email && doc.customer_id) {
      const { data } = await supabase
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("customer_id", doc.customer_id)
        .maybeSingle();
      cliente = data;
    }

    if (!cliente?.email) {
      await logSistemaBackend({
        tipo: "email",
        status: "warning",
        mensagem: "Documento aprovado/reprovado sem e-mail de cliente",
        payload: { trace_id: traceId, documento_id: documentoId, status },
      });
      return json({ skipped: true, reason: "cliente_sem_email", traceId });
    }

    const motivo = motivoInformado || String(doc.motivo_reprovacao || "").trim() || motivoPadrao(status);
    const portalUrl = "https://euqueroarmas.com.br/area-do-cliente?tab=documentos";

    const result = await sendTransactional({
      templateName: "documento-status-cliente",
      recipientEmail: cliente.email,
      idempotencyKey: `${traceId}-${documentoId}-${status}`,
      templateData: {
        nome: cliente.nome_completo || "cliente",
        documento: nomeDocumento(doc),
        status,
        motivo,
        portalUrl,
      },
    });

    await logSistemaBackend({
      tipo: "email",
      status: result.ok ? "success" : "error",
      mensagem: `Aviso de documento ${status}: ${cliente.email}`,
      payload: { trace_id: traceId, documento_id: documentoId, status, queued: result.queued, error: result.error },
    });

    await supabase.from("qa_documentos_cliente_eventos").insert({
      documento_id: documentoId,
      customer_id: doc.customer_id ?? null,
      qa_cliente_id: doc.qa_cliente_id ?? null,
      acao: `email_documento_${status}`,
      ator_tipo: "equipe",
      ator_user_id: guard.userId,
      detalhes: { trace_id: traceId, email: cliente.email, status, motivo, ok: result.ok, queued: result.queued, error: result.error },
    }).then(() => {}, () => {});

    return json({ success: result.ok, queued: result.queued, traceId }, result.ok ? 200 : 500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[qa-documento-cliente-notificar]", traceId, msg);
    return json({ error: msg, traceId }, 500);
  }
});
