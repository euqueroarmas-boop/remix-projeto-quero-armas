import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { buildUserInviteHtml, buildUserInviteText } from "../_shared/emailTemplates.ts";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Envia credenciais de acesso ao portal para um novo usuário.
 * Disparado por create-client-user após criação bem-sucedida.
 * Envia via send-smtp-email (gateway central).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 Onda 6: only admin users or internal callers may dispatch invite emails
  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const {
      customer_email,
      customer_name,
      temp_password,
      portal_url,
      trace_id,
      qa_client_id,
      solicitacao_id,
      evento_label,
      evento_descricao,
      ator,
    } = body;
    const traceId = trace_id || `user-invite-${crypto.randomUUID()}`;

    if (!customer_email || !customer_name || !temp_password) {
      return new Response(JSON.stringify({ error: "Missing required fields", traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalPortalUrl = portal_url || "https://wmti.com.br/area-do-cliente";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Quando há qa_client_id, é fluxo Quero Armas: usa marca/portal próprios
    const isQA = !!qa_client_id;
    const subject = isQA
      ? `🔑 Seu acesso ao Portal Quero Armas foi criado`
      : `🔑 Seu acesso ao Portal WMTi foi criado`;

    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: customer_email,
        subject,
        html: buildUserInviteHtml({ customerName: customer_name, email: customer_email, tempPassword: temp_password, portalUrl: finalPortalUrl }),
        text: buildUserInviteText({ customerName: customer_name, email: customer_email, tempPassword: temp_password, portalUrl: finalPortalUrl }),
        trace_id: traceId,
      },
    });

    const ok = !smtpRes.error && smtpRes.data?.success;
    console.info(`[notify-user-invite][${traceId}]`, ok ? "sent" : "failed");

    if (!ok) {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha envio convite usuário: ${customer_email}`, payload: { trace_id: traceId } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Convite de acesso enviado: ${customer_email}`, payload: { trace_id: traceId, subject } });
    }

    // Marca em qa_clientes e registra evento na timeline da solicitação (se aplicável)
    if (qa_client_id) {
      try {
        const updates: Record<string, unknown> = {
          portal_credenciais_enviadas_em: new Date().toISOString(),
          portal_ultimo_envio_status: ok ? "success" : "failed",
          portal_ultimo_envio_erro: ok ? null : (smtpRes.error?.message || "Falha desconhecida"),
        };
        await supabase.from("qa_clientes").update(updates).eq("id", qa_client_id);
      } catch (markErr) {
        console.error("[notify-user-invite] erro ao marcar qa_clientes:", markErr);
      }

      if (solicitacao_id) {
        try {
          await supabase.from("qa_solicitacao_eventos").insert({
            solicitacao_id,
            cliente_id: qa_client_id,
            evento: ok ? (evento_label || "credenciais_enviadas") : "falha_envio_email",
            descricao: evento_descricao
              || (ok ? `Credenciais enviadas para ${customer_email}` : `Falha ao enviar credenciais para ${customer_email}`),
            ator: ator || "sistema",
            metadata: {
              email: customer_email,
              trace_id: traceId,
              error: ok ? null : (smtpRes.error?.message || "Falha desconhecida"),
            },
            email_enviado_em: ok ? new Date().toISOString() : null,
          });
        } catch (evErr) {
          console.error("[notify-user-invite] erro ao gravar evento timeline:", evErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[notify-user-invite] error", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
