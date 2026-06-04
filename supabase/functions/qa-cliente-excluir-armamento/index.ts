import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * Permite ao cliente logado excluir uma arma do seu arsenal.
 * Valida posse (cliente_auth_links) e remove em cascata:
 *  - qa_crafs com mesma série/sigma
 *  - qa_gtes  com mesma série/sigma
 *  - qa_documentos_cliente vinculados (mesma série, ou doc-id explícito)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    // Cliente "user" só para validar JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Sessão inválida" }, 401);
    }
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { cliente_id, source, ref_id, numero_arma, numero_sigma } = body || {};
    if (!cliente_id || !source || !ref_id) {
      return json({ error: "Parâmetros obrigatórios: cliente_id, source, ref_id" }, 400);
    }

    // Service role para validação cruzada e exclusão
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica posse: o cliente_id pertence ao user logado?
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", uid)
      .eq("qa_cliente_id", cliente_id)
      .maybeSingle();

    // Permite também se for staff/admin
    const { data: perfil } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", uid)
      .eq("ativo", true)
      .maybeSingle();

    if (!link && !perfil) {
      return json({ error: "Sem permissão para excluir armamento deste cliente" }, 403);
    }

    const norm = (s: any) =>
      String(s || "").replace(/\s+/g, "").toUpperCase().trim();
    const serial = norm(numero_arma);
    const sigma = norm(numero_sigma);

    const removed: Record<string, number> = { crafs: 0, gtes: 0, docs: 0 };

    // 1) Remove o registro de origem (CRAF, GTE ou DOC explícito)
    if (source === "CRAF") {
      const { error, count } = await admin
        .from("qa_crafs")
        .delete({ count: "exact" })
        .eq("id", ref_id)
        .eq("cliente_id", cliente_id);
      if (error) throw error;
      removed.crafs += count || 0;
    } else if (source === "GTE") {
      const { error, count } = await admin
        .from("qa_gtes")
        .delete({ count: "exact" })
        .eq("id", ref_id)
        .eq("cliente_id", cliente_id);
      if (error) throw error;
      removed.gtes += count || 0;
    } else if (source === "DOC") {
      const docId = String(ref_id).replace(/^doc-/, "");
      const { error, count } = await admin
        .from("qa_documentos_cliente")
        .delete({ count: "exact" })
        .eq("id", docId)
        .eq("qa_cliente_id", cliente_id);
      if (error) throw error;
      removed.docs += count || 0;
    } else {
      return json({ error: "source inválido (CRAF|GTE|DOC)" }, 400);
    }

    // 2) Limpeza por série/sigma — remove duplicatas espelhadas em outras tabelas
    if (serial || sigma) {
      const matchKeys = [serial, sigma].filter(Boolean);

      // qa_documentos_cliente vinculados pela mesma arma (somente do mesmo cliente)
      const { data: docs } = await admin
        .from("qa_documentos_cliente")
        .select("id, arma_numero_serie, numero_documento")
        .eq("qa_cliente_id", cliente_id);
      const docIdsToDel = (docs || [])
        .filter((d: any) => {
          const a = norm(d.arma_numero_serie);
          const b = norm(d.numero_documento);
          return matchKeys.includes(a) || matchKeys.includes(b);
        })
        .map((d: any) => d.id);
      if (docIdsToDel.length) {
        const { error, count } = await admin
          .from("qa_documentos_cliente")
          .delete({ count: "exact" })
          .in("id", docIdsToDel);
        if (!error) removed.docs += count || 0;
      }

      // qa_gtes espelhados (caso a origem tenha sido CRAF)
      if (source !== "GTE") {
        const { data: gtes } = await admin
          .from("qa_gtes")
          .select("id, numero_arma, numero_sigma")
          .eq("cliente_id", cliente_id);
        const gteIds = (gtes || [])
          .filter((g: any) => matchKeys.includes(norm(g.numero_arma)) || matchKeys.includes(norm(g.numero_sigma)))
          .map((g: any) => g.id);
        if (gteIds.length) {
          const { error, count } = await admin
            .from("qa_gtes")
            .delete({ count: "exact" })
            .in("id", gteIds);
          if (!error) removed.gtes += count || 0;
        }
      }
    }

    return json({ ok: true, removed });
  } catch (e: any) {
    console.error("[qa-cliente-excluir-armamento] erro:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}