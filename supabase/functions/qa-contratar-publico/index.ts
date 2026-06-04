// qa-contratar-publico (Fase 16-E)
// Cria uma venda/contratação pendente a partir do fluxo público (visitante).
// - Identifica/cria qa_clientes pelo CPF (status cadastro_em_preenchimento).
// - Cria venda + item + evento via RPC qa_cliente_criar_contratacao_publico.
// - Notifica admin (não bloqueia o retorno em caso de falha).
// - NÃO cria processo, NÃO confirma pagamento, NÃO explode checklist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const Schema = z.object({
  catalogo_slug: z.string().min(1).max(120),
  nome_completo: z.string().min(3).max(200),
  cpf: z.string().min(11).max(20),
  email: z.string().email().max(255),
  telefone: z.string().min(8).max(20),
  valor_informado: z.number().positive(),
  observacoes: z.string().max(2000).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = `qa-contratar-pub-${crypto.randomUUID()}`;

  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
        traceId,
      }, 400);
    }
    const data = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rpcRes, error: rpcErr } = await supabase.rpc(
      "qa_cliente_criar_contratacao_publico" as any,
      {
        p_cpf: data.cpf,
        p_nome: data.nome_completo,
        p_email: data.email,
        p_telefone: data.telefone,
        p_catalogo_slug: data.catalogo_slug,
        p_valor_informado: data.valor_informado,
        p_observacoes: data.observacoes ?? null,
      } as any,
    );

    if (rpcErr) {
      console.error(`[qa-contratar-publico][${traceId}]`, rpcErr);
      return json({ error: rpcErr.message || "Erro ao criar contratação", traceId }, 400);
    }

    const result = rpcRes as Record<string, unknown> | null;

    // Cliente existente já vinculado a auth → instruir login
    if (result?.precisa_login) {
      return json({
        ok: false,
        precisa_login: true,
        mensagem: result.mensagem,
        traceId,
      }, 200);
    }

    if (result?.needs_manual_review) {
      return json({
        ok: false,
        needs_manual_review: true,
        reason: result.reason,
        traceId,
      }, 200);
    }

    // Notifica admin (não bloqueia)
    const vendaId = result?.venda_id as number | undefined;
    if (vendaId) {
      supabase.functions
        .invoke("qa-notificar-admin-contratacao", { body: { venda_id: vendaId } })
        .catch((e) => console.warn(`[qa-contratar-publico][${traceId}] notif admin falhou`, e));
    }

    return json({ ok: true, ...result, traceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[qa-contratar-publico][${traceId}]`, msg);
    return json({ error: msg, traceId }, 500);
  }
});