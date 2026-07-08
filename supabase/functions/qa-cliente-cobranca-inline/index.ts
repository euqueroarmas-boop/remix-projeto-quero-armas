// qa-cliente-cobranca-inline
// Retorna dados reais da cobrança Asaas para renderização inline da Central
// Financeira do cliente (PIX QR/copia-e-cola, linha digitável do boleto,
// URL do PDF). Autenticado pelo JWT do cliente; valida que a venda
// pertence ao qa_clientes vinculado ao auth.uid().
//
// Body: { venda_id: number, action?: 'pix' | 'boleto' | 'both' }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");

  // 1) Valida JWT
  let userId = "";
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!r.ok) return json({ error: "invalid_token" }, 401);
    const u = await r.json();
    userId = u?.id || "";
    if (!userId) return json({ error: "invalid_token" }, 401);
  } catch {
    return json({ error: "invalid_token" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const vendaId = Number(body?.venda_id);
  const action = String(body?.action || "both");
  if (!Number.isFinite(vendaId) || vendaId <= 0) return json({ error: "venda_id_required" }, 400);

  const admin = createClient(url, service);

  // 2) Localiza qa_clientes do usuário autenticado.
  // Tenta primeiro user_id direto; cai no cliente_auth_links para clientes
  // vinculados via OTP/link (que podem ter user_id null em qa_clientes).
  let cli: { id: unknown; id_legado: unknown } | null = null;
  {
    const { data } = await admin
      .from("qa_clientes")
      .select("id, id_legado")
      .eq("user_id", userId)
      .maybeSingle();
    cli = data;
  }
  if (!cli) {
    const { data: link } = await admin
      .from("cliente_auth_links")
      .select("qa_cliente_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (link?.qa_cliente_id) {
      const { data } = await admin
        .from("qa_clientes")
        .select("id, id_legado")
        .eq("id", link.qa_cliente_id)
        .maybeSingle();
      cli = data;
    }
  }
  if (!cli) return json({ error: "cliente_not_found" }, 403);

  // 3) Localiza venda e valida ownership + presença do payment_id
  const { data: venda } = await admin
    .from("qa_vendas")
    .select("id, id_legado, cliente_id, asaas_payment_id, asaas_invoice_url, asaas_bank_slip_url, asaas_due_date, status, cobranca_status")
    .eq("id_legado", vendaId)
    .maybeSingle();
  if (!venda) return json({ error: "venda_not_found" }, 404);
  if (Number(venda.cliente_id) !== Number(cli.id_legado)) return json({ error: "forbidden" }, 403);
  if (!venda.asaas_payment_id) return json({ error: "sem_cobranca_asaas" }, 409);

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) return json({ error: "asaas_not_configured" }, 500);

  const headers = { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" };
  const paymentId = venda.asaas_payment_id;

  const out: Record<string, unknown> = {
    venda_id: venda.id_legado,
    asaas_payment_id: paymentId,
    asaas_invoice_url: venda.asaas_invoice_url,
    asaas_bank_slip_url: venda.asaas_bank_slip_url,
    asaas_due_date: venda.asaas_due_date,
  };

  try {
    if (action === "pix" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.pix_payload = d?.payload ?? null;
        out.pix_encoded_image = d?.encodedImage ?? null; // base64 PNG
        out.pix_expiration = d?.expirationDate ?? null;
      } else {
        out.pix_error = `status_${r.status}`;
      }
    }
    if (action === "boleto" || action === "both") {
      const r = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/identificationField`, { headers });
      if (r.ok) {
        const d = await r.json();
        out.boleto_identification_field = d?.identificationField ?? null;
        out.boleto_nossoNumero = d?.nossoNumero ?? null;
        out.boleto_barCode = d?.barCode ?? null;
      } else {
        // Asaas devolve 400 quando a cobrança não é boleto (ex: PIX/cartão).
        // Consulta o pagamento p/ informar o billingType real ao frontend.
        let billing: string | null = null;
        try {
          const p = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, { headers });
          if (p.ok) {
            const pd = await p.json();
            billing = pd?.billingType ?? null;
          }
        } catch { /* ignore */ }
        out.boleto_error = billing && billing !== "BOLETO"
          ? `nao_e_boleto_${billing.toLowerCase()}`
          : `status_${r.status}`;
        out.billing_type = billing;
      }
    }
  } catch (e) {
    return json({ ...out, network_error: e instanceof Error ? e.message : "unknown" }, 502);
  }

  return json({ success: true, ...out });
});