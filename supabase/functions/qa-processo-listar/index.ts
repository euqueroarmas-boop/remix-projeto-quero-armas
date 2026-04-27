// qa-processo-listar
// Lista processos com filtros (cliente, status, servico) e contadores agregados.
// Acesso: staff QA OU cliente autenticado (vê apenas seus processos).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;
    const supabase = createClient(url, service);

    // É staff?
    const { data: staffRow } = await supabase
      .from("qa_usuarios_perfis")
      .select("perfil, ativo")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();
    const isStaff = !!staffRow;

    const params = new URL(req.url).searchParams;
    const filtroCliente = params.get("cliente_id");
    const filtroStatus = params.get("status");
    const filtroServico = params.get("servico_id");
    const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200);

    let query = supabase
      .from("qa_processos")
      .select(`
        id, cliente_id, servico_id, servico_nome, status,
        pagamento_status, observacoes_admin, created_at, updated_at, venda_id
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isStaff) {
      // Cliente: apenas seus processos
      const { data: link } = await supabase
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", userId)
        .not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (!link?.qa_cliente_id) return json({ processos: [], total: 0 });
      query = query.eq("cliente_id", link.qa_cliente_id);
    } else {
      if (filtroCliente) query = query.eq("cliente_id", parseInt(filtroCliente, 10));
    }

    if (filtroStatus) query = query.eq("status", filtroStatus);
    if (filtroServico) query = query.eq("servico_id", parseInt(filtroServico, 10));

    const { data: processos, error } = await query;
    if (error) return json({ error: error.message }, 400);

    if (!processos || processos.length === 0) {
      return json({ processos: [], total: 0 });
    }

    // Agrega contadores de documentos
    const ids = processos.map((p) => p.id);
    const { data: docs } = await supabase
      .from("qa_processo_documentos")
      .select("processo_id, status")
      .in("processo_id", ids);

    const counters: Record<string, { total: number; aprovados: number; pendentes: number; invalidos: number; divergentes: number; revisao: number }> = {};
    for (const id of ids) counters[id] = { total: 0, aprovados: 0, pendentes: 0, invalidos: 0, divergentes: 0, revisao: 0 };
    for (const d of docs || []) {
      const c = counters[d.processo_id];
      if (!c) continue;
      c.total += 1;
      if (d.status === "aprovado") c.aprovados += 1;
      else if (d.status === "invalido") c.invalidos += 1;
      else if (d.status === "divergente") c.divergentes += 1;
      else if (d.status === "revisao_humana") c.revisao += 1;
      else c.pendentes += 1;
    }

    const enriched = processos.map((p) => ({
      ...p,
      documentos_resumo: counters[p.id],
    }));

    return json({ processos: enriched, total: enriched.length });
  } catch (err: any) {
    console.error("qa-processo-listar:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});