/**
 * qa-efetiva-revisar — revisão HUMANA da efetiva necessidade.
 *
 * Separa o "aceite do cliente" (que apenas move o registro para EM REVISÃO)
 * da "aprovação pela equipe". Toda ação grava log de auditoria com autor,
 * data/hora, observação e carimbo de conexão.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "missing_token" }, 401);

  let autorId = "";
  let autorEmail: string | null = null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!resp.ok) return json({ error: "unauthenticated" }, 401);
    const u = await resp.json();
    autorId = u?.id || "";
    autorEmail = u?.email ?? null;
  } catch (e) {
    return json({ error: "unauthenticated", message: (e as Error).message }, 401);
  }
  if (!autorId) return json({ error: "unauthenticated" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const registroId = String(body?.registro_id ?? "").trim();
  const acao = String(body?.acao ?? "").trim(); // "aprovar" | "devolver"
  const observacao = String(body?.observacao ?? "").trim().slice(0, 1000);

  if (!registroId) return json({ error: "registro_id obrigatório" }, 400);
  if (acao !== "aprovar" && acao !== "devolver") {
    return json({ error: "acao deve ser 'aprovar' ou 'devolver'" }, 400);
  }
  if (acao === "devolver" && observacao.length < 5) {
    return json({ error: "informe o motivo da devolução" }, 400);
  }

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: reg } = await sb
    .from("qa_efetiva_necessidade")
    .select("id, cliente_id, status")
    .eq("id", registroId)
    .maybeSingle();
  if (!reg) return json({ error: "Registro não encontrado" }, 404);

  const agora = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ?? null;
  const ua = req.headers.get("user-agent");

  const statusNovo = acao === "aprovar" ? "aprovado" : "devolvido";

  const patch: Record<string, unknown> = {
    status: statusNovo,
    updated_at: agora,
  };
  if (acao === "aprovar") {
    patch.aprovado_por = autorId;
    patch.aprovado_por_nome = autorEmail;
    patch.aprovado_em = agora;
    patch.devolucao_motivo = null;
  } else {
    patch.aprovado_por = null;
    patch.aprovado_por_nome = null;
    patch.aprovado_em = null;
    patch.devolucao_motivo = observacao;
  }

  const { error: upErr } = await sb
    .from("qa_efetiva_necessidade")
    .update(patch)
    .eq("id", registroId);
  if (upErr) return json({ error: "Falha ao gravar", details: upErr.message }, 500);

  await sb.from("qa_efetiva_necessidade_auditoria").insert({
    efetiva_id: registroId,
    cliente_id: reg.cliente_id,
    acao: acao === "aprovar" ? "aprovado_equipe" : "devolvido_equipe",
    status_anterior: reg.status ?? null,
    status_novo: statusNovo,
    autor_tipo: "equipe",
    autor_id: autorId,
    autor_nome: autorEmail,
    observacao: observacao || null,
    ip,
    user_agent: ua,
  });

  return json({ ok: true, status: statusNovo, aprovado_em: acao === "aprovar" ? agora : null });
});
