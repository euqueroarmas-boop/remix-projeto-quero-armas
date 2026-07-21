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
  let action: string | undefined;
  try {
    const body = await req.json();
    contract_id = String(body.contract_id ?? "").trim();
    action = typeof body.action === "string" ? body.action : undefined;
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
  const acceptLanguage = req.headers.get("accept-language") ?? null;
  const referer = req.headers.get("referer") ?? null;
  const secChUa = req.headers.get("sec-ch-ua") ?? null;
  const secChUaPlatform = req.headers.get("sec-ch-ua-platform") ?? null;
  const secChUaMobile = req.headers.get("sec-ch-ua-mobile") ?? null;
  const cfCountry = req.headers.get("cf-ipcountry") ?? null;
  // Deriva SO/navegador do user-agent quando client hints não vierem
  const uaLc = userAgent.toLowerCase();
  const so = /windows nt/.test(uaLc) ? "Windows"
    : /mac os x|macintosh/.test(uaLc) ? "macOS"
    : /android/.test(uaLc) ? "Android"
    : /iphone|ipad|ipod/.test(uaLc) ? "iOS"
    : /linux/.test(uaLc) ? "Linux"
    : "desconhecido";
  const browser = /edg\//.test(uaLc) ? "Edge"
    : /chrome\//.test(uaLc) && !/edg\//.test(uaLc) ? "Chrome"
    : /firefox\//.test(uaLc) ? "Firefox"
    : /safari\//.test(uaLc) && !/chrome\//.test(uaLc) ? "Safari"
    : "desconhecido";

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

  // Registra evento com dados de sessão (visualização OU download direto)
  const eventType = action === "download"
    ? "contrato_baixado_cliente"
    : "contrato_visualizado_cliente";
  try {
    await sb.from("qa_contract_events").insert({
      contract_id: data.id,
      event_type: eventType,
      event_payload: {
        ip,
        user_agent: userAgent,
        so,
        browser,
        platform: secChUaPlatform,
        mobile: secChUaMobile,
        client_hints: secChUa,
        accept_language: acceptLanguage,
        country: cfCountry,
        referer,
        contract_number: data.contract_number,
        template_versao: data.template_versao,
        status: data.status,
        venda_id: data.venda_id,
        action: action ?? "view",
        recorded_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[qa-contrato-view-public] evento falhou:", e);
  }

  return json({
    ok: true,
    contract_number: data.contract_number,
    status: data.status,
    issued_at: data.issued_at,
    servico_slug: data.servico_slug,
    venda_id: data.venda_id,
    nome_cliente: "",
    conteudo_html: data.conteudo_renderizado ?? "",
    sessao: {
      ip,
      so,
      browser,
      user_agent: userAgent,
      accept_language: acceptLanguage,
      referer,
      country: cfCountry,
      registrado_em: new Date().toISOString(),
      action: action ?? "view",
    },
  });
});
