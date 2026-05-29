/**
 * qa-serve-contract-pdf — BLOCO 10 / Pass B
 *
 * Stream autenticado de PDFs de contrato Quero Armas (bucket `paid-contracts`).
 * Bucket NÃO é público.
 *
 * Acesso:
 *  - Equipe Quero Armas (qa_usuarios_perfis ativo) → qualquer contrato.
 *  - Cliente (JWT auth) → apenas contratos cujo cliente_id corresponde a ele.
 *
 * Variantes (?variant=):
 *  - "company_signed" (padrão p/ cliente): exige status >= pending_customer_signature.
 *  - "customer_signed": exige customer_signed_pdf_path.
 *  - "original": apenas staff.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authUser(req: Request): Promise<{ userId: string; email: string | null } | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  try {
    const u = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await u.auth.getUser(token);
    if (error || !data?.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch { return null; }
}

function jsonResp(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await authUser(req);
  if (!user) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();

  // Resolve perfil + cliente
  const [{ data: perfil }, { data: link }] = await Promise.all([
    sb.from("qa_usuarios_perfis").select("perfil, ativo").eq("user_id", user.userId).eq("ativo", true).maybeSingle(),
    sb.from("cliente_auth_links").select("qa_cliente_id, status").eq("user_id", user.userId).eq("status", "active").maybeSingle(),
  ]);
  const isStaff = !!perfil;
  const clienteId = (link as any)?.qa_cliente_id ?? null;

  let contractId: string | null = null;
  let vendaId: number | null = null;
  let variant = "company_signed";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      contractId = body.contract_id ?? null;
      vendaId = body.venda_id ? Number(body.venda_id) : null;
      variant = body.variant || variant;
    } else {
      const u = new URL(req.url);
      contractId = u.searchParams.get("contract_id");
      const v = u.searchParams.get("venda_id");
      vendaId = v ? Number(v) : null;
      variant = u.searchParams.get("variant") || variant;
    }
  } catch { /* ignore */ }

  if (!contractId && !vendaId) return jsonResp({ error: "contract_id ou venda_id obrigatório" }, 400);

  let q = sb.from("qa_contracts").select(
    "id, venda_id, cliente_id, status, original_pdf_path, company_signed_pdf_path, customer_signed_pdf_path, contract_number, conteudo_renderizado"
  );
  if (contractId) q = q.eq("id", contractId);
  else q = q.eq("venda_id", vendaId!);
  const { data: contract } = await q.maybeSingle();
  if (!contract) return jsonResp({ error: "Contrato não encontrado" }, 404);

  // Ownership
  if (!isStaff) {
    if (!clienteId || (contract as any).cliente_id !== clienteId) {
      return jsonResp({ error: "Acesso negado" }, 403);
    }
    if (variant === "original") variant = "company_signed";
  }

  let path: string | null = null;
  if (variant === "original") path = (contract as any).original_pdf_path ?? null;
  else if (variant === "customer_signed") path = (contract as any).customer_signed_pdf_path ?? null;
  else {
    // Contrato de adesão: cliente pode baixar assim que o contrato é emitido.
    // Prioriza versão "assinada pela empresa" se existir, senão o PDF original emitido.
    path = (contract as any).company_signed_pdf_path ?? (contract as any).original_pdf_path ?? null;
  }

  if (!path) {
    // Fallback contrato de adesão: sem PDF físico, devolve o snapshot HTML
    // renderizado (conteudo_renderizado) como documento baixável.
    const html = (contract as any).conteudo_renderizado as string | null;
    if (variant !== "customer_signed" && html && html.trim()) {
      const fname = `contrato-${(contract as any).contract_number || (contract as any).id}.html`;
      // Envelopa o snapshot em documento HTML completo com <meta charset="utf-8">.
      // Sem isso, navegadores (especialmente iOS Safari ao abrir via Blob URL)
      // ignoram o charset do header e renderizam o conteúdo como Latin-1,
      // produzindo mojibake do tipo "CONCESSÃƒO" / "CLÃ□USULA".
      const titulo =
        `Contrato ${(contract as any).contract_number || (contract as any).id} — Quero Armas`;
      const isFullDoc = /<!doctype|<html[\s>]/i.test(html);
      const body = isFullDoc
        ? html
        : `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>${titulo}</title><style>` +
          `body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;` +
          `max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}` +
          `h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:.04em;}` +
          `h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-top:24px;}` +
          `p{margin:10px 0;text-align:justify;}ul,ol{padding-left:22px;}li{margin:6px 0;}` +
          `@media print{body{margin:0;}}` +
          `</style></head><body>${html}</body></html>`;
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${fname}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }
    return jsonResp({ error: "PDF indisponível para esta variante" }, 404);
  }

  const { data: file, error: dlErr } = await sb.storage.from(BUCKET).download(path);
  if (dlErr || !file) return jsonResp({ error: "Falha ao baixar arquivo", detail: dlErr?.message }, 500);

  const bytes = await file.arrayBuffer();
  const fname = `contrato-${(contract as any).contract_number || (contract as any).id}-${variant}.pdf`;
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fname}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
});