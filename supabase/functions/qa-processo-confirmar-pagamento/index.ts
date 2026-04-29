// qa-processo-confirmar-pagamento
// Fase 10.1: Confirmação manual de pagamento pela Equipe Operacional do Painel Operacional Quero Armas.
// - Valida JWT + perfil ativo via requireQAStaff (reutiliza qa_usuarios_perfis / qa_is_active_staff lógica).
// - Chama RPC central qa_confirmar_pagamento_processo(p_processo_id, 'manual_admin').
// - Dispara notificação equivalente ao webhook (qa-processo-notificar evento=pagamento_confirmado).
// - Não expõe service_role ao cliente; service_role é usado apenas dentro da função.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff } from "../_shared/qaAuth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const processo_id = body?.processo_id;
    if (!processo_id || typeof processo_id !== "string") {
      return json({ error: "processo_id é obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rpcRes, error: rpcErr } = await supabase.rpc(
      "qa_confirmar_pagamento_processo",
      { p_processo_id: processo_id, p_origem: "manual_admin" },
    );
    if (rpcErr) {
      console.error("[confirmar-pagamento] RPC erro:", rpcErr.message);
      return json({ error: rpcErr.message }, 400);
    }

    // Notifica cliente (mesmo evento do webhook). Não bloqueia retorno.
    if (!rpcRes?.ja_estava_confirmado) {
      supabase.functions
        .invoke("qa-processo-notificar", {
          body: { processo_id, evento: "pagamento_confirmado" },
        })
        .catch((e) => console.warn("[confirmar-pagamento] notificar falhou:", e));
    }

    return json({ success: true, ...rpcRes });
  } catch (err: any) {
    console.error("qa-processo-confirmar-pagamento:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
