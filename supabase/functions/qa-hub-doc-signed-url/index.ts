/**
 * qa-hub-doc-signed-url
 *
 * Gera signed URL (service role) para um documento do Hub cujo arquivo esteja
 * em bucket privado sem RLS direto ao cliente (ex.: paid-contracts). Verifica
 * ownership: o qa_cliente_id do documento deve pertencer ao usuário autenticado
 * via qa_clientes.user_id ou cliente_auth_links.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function authUserId(req: Request): Promise<string | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  try {
    const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${t}` } },
    });
    const { data } = await u.auth.getUser(t);
    return data?.user?.id ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const userId = await authUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Body inválido" }, 400); }
  const documentoId = String(body.documento_id || "").trim();
  const download = Boolean(body.download);
  if (!documentoId) return json({ error: "documento_id obrigatório" }, 400);

  const sb = svc();
  const { data: doc, error } = await sb
    .from("qa_documentos_cliente")
    .select("id, qa_cliente_id, arquivo_storage_path, arquivo_nome, metadados_documento_json")
    .eq("id", documentoId)
    .maybeSingle();
  if (error || !doc) return json({ error: "Documento não encontrado" }, 404);
  if (!(doc as any).arquivo_storage_path) return json({ error: "Documento sem arquivo" }, 400);

  // Ownership: qa_clientes.user_id OU cliente_auth_links
  const clienteId = Number((doc as any).qa_cliente_id);
  const owners = new Set<string>();
  const { data: cli } = await sb.from("qa_clientes").select("user_id").or(`id.eq.${clienteId},id_legado.eq.${clienteId}`);
  for (const c of (cli ?? []) as any[]) if (c.user_id) owners.add(String(c.user_id));
  const { data: links } = await sb.from("cliente_auth_links").select("user_id").eq("qa_cliente_id", clienteId).eq("status", "active");
  for (const l of (links ?? []) as any[]) if (l.user_id) owners.add(String(l.user_id));
  if (!owners.has(userId)) return json({ error: "Acesso negado" }, 403);

  const bucket = (doc as any)?.metadados_documento_json?.bucket || "qa-documentos";
  const nome = (doc as any).arquivo_nome || "documento";
  const { data: signed, error: sErr } = await sb.storage
    .from(bucket)
    .createSignedUrl((doc as any).arquivo_storage_path, 3600, download ? { download: nome } : undefined);
  if (sErr || !signed?.signedUrl) return json({ error: "Falha ao gerar link", detail: sErr?.message }, 500);

  return json({ signed_url: signed.signedUrl, nome, bucket });
});