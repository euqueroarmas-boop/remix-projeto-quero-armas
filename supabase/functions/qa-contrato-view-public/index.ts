/**
 * qa-contrato-view-public — PÚBLICA (anon)
 *
 * Retorna o HTML renderizado de um contrato pelo UUID.
 * O UUID de 128 bits é o próprio token de acesso — impossível adivinhar.
 * Usado pela página /area-do-cliente/contratos/:id enviada ao cliente por e-mail.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await sb
    .from("qa_contracts")
    .select("id, contract_number, status, conteudo_renderizado, issued_at, servico_slug, venda_id, qa_vendas(nome_completo)")
    .eq("id", contract_id)
    .maybeSingle();

  if (error || !data) {
    return json({ error: "Contrato não encontrado" }, 404);
  }

  const nomeCliente: string = (data as any).qa_vendas?.nome_completo ?? "";

  return json({
    ok: true,
    contract_number: data.contract_number,
    status: data.status,
    issued_at: data.issued_at,
    servico_slug: data.servico_slug,
    venda_id: data.venda_id,
    nome_cliente: nomeCliente,
    conteudo_html: data.conteudo_renderizado ?? "",
  });
});
