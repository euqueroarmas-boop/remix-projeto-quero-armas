// ============================================================================
// qa-exigencia-pf-checar — fecha o ciclo da notificação da PF pelo caminho manual
// ----------------------------------------------------------------------------
// `avisarCumprimentoExigenciaPF` já roda quando a IA aprova o documento. Mas há
// um segundo caminho, e ele é o mais comum nas exigências da PF: a IA manda
// para REVISÃO HUMANA e quem aprova é a equipe, direto no painel — sem passar
// por edge function nenhuma.
//
// Sem este endpoint, aprovar manualmente o último item de uma notificação não
// dispara nada: ninguém registra que a delegacia pode ser respondida, e o
// evento `manifestacao_pf_cumprida` nunca entra na linha do tempo do processo.
// Corre prazo de 10 dias e o processo fica parado esperando alguém lembrar.
//
// Idempotente por construção: o helper só age quando NÃO há mais pendência na
// mesma manifestação, e a chave do e-mail é a da manifestação. Chamar duas
// vezes não duplica aviso.
//
// Entrada (POST): { processo_id, documento_id }
// Autorização: staff QA ativo. É ação de equipe — o cliente não aprova nada.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import { avisarCumprimentoExigenciaPF } from "../_shared/notificarExigenciaPF.ts";

const corsHeaders = qaAuthCors;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const processoId = String((body as { processo_id?: string })?.processo_id ?? "").trim();
    const documentoId = String((body as { documento_id?: string })?.documento_id ?? "").trim();
    if (!processoId || !documentoId) {
      return json({ error: "processo_id e documento_id são obrigatórios" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const r = await avisarCumprimentoExigenciaPF({
      admin,
      processoId,
      documentoId,
    });

    return json({ ok: true, ...r });
  } catch (e) {
    console.error("[qa-exigencia-pf-checar]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});
