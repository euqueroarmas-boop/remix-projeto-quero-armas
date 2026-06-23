import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("[qa-cliente-avatar] getClaims falhou", claimsErr);
      return json({ error: "Sessão inválida" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const clienteId = Number(body?.cliente_id);
    if (!Number.isFinite(clienteId)) return json({ error: "cliente_id obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const uid = claimsData.claims.sub as string;

    const [{ data: link }, { data: perfil }] = await Promise.all([
      admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", uid)
        .eq("qa_cliente_id", clienteId)
        .eq("status", "active")
        .maybeSingle(),
      admin
        .from("qa_usuarios_perfis")
        .select("perfil")
        .eq("user_id", uid)
        .eq("ativo", true)
        .maybeSingle(),
    ]);

    if (!link && !perfil) return json({ error: "Sem permissão para ver esta foto" }, 403);

    const { data: cliente, error: cliErr } = await admin
      .from("qa_clientes")
      .select("id, nome_completo, imagem, avatar_tatico_path, cadastro_publico_id, cpf")
      .eq("id", clienteId)
      .eq("excluido", false)
      .maybeSingle();
    if (cliErr) throw cliErr;
    if (!cliente) return json({ error: "Cliente não encontrado" }, 404);

    let selfiePath: string | null = null;
    if (cliente.cadastro_publico_id) {
      const { data: cadById } = await admin
        .from("qa_cadastro_publico")
        .select("selfie_path")
        .eq("id", cliente.cadastro_publico_id)
        .maybeSingle();
      selfiePath = cadById?.selfie_path || null;
    }
    if (!selfiePath) {
      const { data: cadByLink } = await admin
        .from("qa_cadastro_publico")
        .select("selfie_path")
        .eq("cliente_id_vinculado", clienteId)
        .not("selfie_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      selfiePath = cadByLink?.selfie_path || null;
    }
    if (!selfiePath && cliente.cpf) {
      const { data: cadByCpf } = await admin
        .from("qa_cadastro_publico")
        .select("selfie_path")
        .eq("cpf", cliente.cpf)
        .not("selfie_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      selfiePath = cadByCpf?.selfie_path || null;
    }

    const sources = [
      { path: cliente.imagem as string | null, buckets: ["qa-documentos", "qa-cadastro-selfies"], source: "qa_clientes.imagem" },
      { path: selfiePath, buckets: ["qa-cadastro-selfies", "qa-documentos"], source: "qa_cadastro_publico.selfie_path" },
      { path: cliente.avatar_tatico_path as string | null, buckets: ["qa-cadastro-selfies", "qa-documentos"], source: "avatar_tatico_path" },
    ].filter((s) => !!s.path) as { path: string; buckets: string[]; source: string }[];

    for (const s of sources) {
      if (/^https?:\/\//i.test(s.path)) {
        return json({ url: s.path, path: s.path, bucket: null, source: s.source, hasPhoto: true });
      }
      for (const bucket of s.buckets) {
        const { data, error } = await admin.storage.from(bucket).createSignedUrl(s.path, 3600);
        if (!error && data?.signedUrl) {
          return json({ url: data.signedUrl, path: s.path, bucket, source: s.source, hasPhoto: true });
        }
      }
    }

    return json({ url: null, path: null, bucket: null, source: null, hasPhoto: false });
  } catch (err) {
    console.error("[qa-cliente-avatar]", err);
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});