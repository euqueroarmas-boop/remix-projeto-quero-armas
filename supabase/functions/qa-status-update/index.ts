import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Atualização auditável de status_servico de uma solicitação.
 * - Se sem_checklist_configurado=true e status_tentado != 'aguardando_documentacao':
 *   registra evento 'tentativa_status_bloqueada' e retorna 409.
 * - Caso contrário, executa o UPDATE; eventuais bloqueios do trigger
 *   (transição inválida, etc.) também são auditados.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      solicitacao_id,
      status_servico,
      status_financeiro,
      status_processo,
      observacoes,
    } = body || {};

    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: "solicitacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve ator a partir do JWT
    let ator = "operador";
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      try {
        const payload = JSON.parse(atob(auth.slice(7).split(".")[1]));
        ator = payload?.email || payload?.sub || ator;
      } catch { /* ignore */ }
    }

    // Estado atual
    const { data: atual, error: atualErr } = await supa
      .from("qa_solicitacoes_servico")
      .select("id, cliente_id, status_servico, sem_checklist_configurado")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (atualErr || !atual) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tentaStatus =
      typeof status_servico === "string" && status_servico !== atual.status_servico;

    // Bloqueio explícito: sem checklist
    if (
      tentaStatus &&
      atual.sem_checklist_configurado === true &&
      status_servico !== "aguardando_documentacao" &&
      status_servico !== "finalizado"
    ) {
      await supa.from("qa_solicitacao_eventos").insert({
        solicitacao_id,
        cliente_id: atual.cliente_id,
        evento: "tentativa_status_bloqueada",
        status_anterior: atual.status_servico,
        descricao: "Tentativa de alterar status sem checklist configurado",
        ator,
        metadata: {
          status_tentado: status_servico,
          motivo: "sem_checklist_configurado",
        },
      });
      return new Response(
        JSON.stringify({
          error: "Status bloqueado: configure o checklist antes de avançar.",
          motivo: "sem_checklist_configurado",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Monta payload (omite status_servico se sem_checklist)
    const payload: Record<string, any> = {};
    if (typeof status_servico === "string" && !atual.sem_checklist_configurado) {
      payload.status_servico = status_servico;
    }
    if (typeof status_financeiro === "string") payload.status_financeiro = status_financeiro;
    if (typeof status_processo === "string") payload.status_processo = status_processo;
    if (typeof observacoes !== "undefined") payload.observacoes = observacoes || null;

    if (Object.keys(payload).length === 0) {
      return new Response(JSON.stringify({ ok: true, noop: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supa
      .from("qa_solicitacoes_servico")
      .update(payload)
      .eq("id", solicitacao_id);

    if (updErr) {
      // Trigger barrou (transição inválida etc.) — audita também
      await supa.from("qa_solicitacao_eventos").insert({
        solicitacao_id,
        cliente_id: atual.cliente_id,
        evento: "tentativa_status_bloqueada",
        status_anterior: atual.status_servico,
        descricao: updErr.message,
        ator,
        metadata: {
          status_tentado: status_servico ?? null,
          motivo: "trigger_validacao",
        },
      });
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});