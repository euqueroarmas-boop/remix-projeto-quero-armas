/**
 * qa-contrato-view-public — PÚBLICA (anon)
 *
 * Retorna o HTML renderizado de um contrato pelo UUID.
 * O UUID de 128 bits é o próprio token de acesso — impossível adivinhar.
 * Usado pela página /area-do-cliente/contratos/:id enviada ao cliente por e-mail.
 * Registra evento contrato_visualizado_cliente em qa_contract_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let contract_id: string | undefined;
  try {
    const body = await req.json();
    contract_id = String(body.contract_id ?? "").trim();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (!contract_id || !UUID_RE.test(contract_id)) {
    return json({ error: "contract_id inválido" }, 400);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconhecido";
  const userAgent = req.headers.get("user-agent") ?? "desconhecido";

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await sb
    .from("qa_contracts")
    .select("id, contract_number, status, conteudo_renderizado, issued_at, servico_slug, venda_id, template_versao")
    .eq("id", contract_id)
    .maybeSingle();

  if (error || !data) {
    return json({ error: "Contrato não encontrado" }, 404);
  }

  // Registra visualização — falha silenciosa para não bloquear entrega
  try {
    await sb.from("qa_contract_events").insert({
      contract_id: data.id,
      acao: "contrato_visualizado_cliente",
      detalhes: {
        ip,
        user_agent: userAgent,
        contract_number: data.contract_number,
        template_versao: data.template_versao,
        status: data.status,
        venda_id: data.venda_id,
      },
    });
  } catch (_) { /* silencioso */ }

  return json({
    ok: true,
    contract_number: data.contract_number,
    status: data.status,
    issued_at: data.issued_at,
    servico_slug: data.servico_slug,
    venda_id: data.venda_id,
    nome_cliente: "",
    conteudo_html: data.conteudo_renderizado ?? "",
  });
});
