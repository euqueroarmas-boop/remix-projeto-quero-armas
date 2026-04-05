import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyAdminToken(token: string, adminPassword: string): Promise<boolean> {
  try {
    const [ts, sig] = token.split(".");
    const timestamp = parseInt(ts, 10);
    if (Date.now() - timestamp > 8 * 60 * 60 * 1000) return false;
    const expected = await hmacSign(adminPassword, `admin:${ts}`);
    return expected === sig;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminPassword = Deno.env.get("ADMIN_PASSWORD");
  if (!adminPassword) return jsonResponse({ error: "ADMIN_PASSWORD not configured" }, 500);

  const token = req.headers.get("x-admin-token");
  if (!token || !(await verifyAdminToken(token, adminPassword))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL");
  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    return jsonResponse({ error: "ASAAS_API_KEY or ASAAS_BASE_URL not configured" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get recent confirmed payments that might be missing invoices
    const { data: confirmedPayments } = await supabase
      .from("payments")
      .select("id, asaas_payment_id, quote_id, amount, created_at")
      .in("payment_status", ["CONFIRMED", "RECEIVED"])
      .not("asaas_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!confirmedPayments?.length) {
      return jsonResponse({ success: true, message: "No confirmed payments to reconcile", synced: 0 });
    }

    // Get existing fiscal docs by asaas_invoice_id
    const asaasIds = confirmedPayments.map(p => p.asaas_payment_id).filter(Boolean);
    const { data: existingDocs } = await supabase
      .from("fiscal_documents")
      .select("asaas_invoice_id")
      .in("asaas_invoice_id", asaasIds);

    const existingSet = new Set((existingDocs || []).map(d => d.asaas_invoice_id));
    const missing = confirmedPayments.filter(p => !existingSet.has(p.asaas_payment_id));

    let synced = 0;
    const errors: string[] = [];

    for (const payment of missing) {
      try {
        // Find customer
        const { data: contractRow } = await supabase
          .from("contracts")
          .select("customer_id, contract_type, id")
          .eq("quote_id", payment.quote_id)
          .limit(1)
          .maybeSingle();

        if (!contractRow?.customer_id) continue;

        // Try to fetch fiscal info from Asaas
        let pdfUrl: string | null = null;
        let xmlUrl: string | null = null;
        let invoiceNumber: string | null = null;
        let accessKey: string | null = null;

        try {
          const fiscalRes = await fetch(`${ASAAS_BASE_URL}/payments/${payment.asaas_payment_id}/fiscalInfo`, {
            headers: { access_token: ASAAS_API_KEY, "User-Agent": "WMTi-Integration/1.0" },
          });
          if (fiscalRes.ok) {
            const fiscalData = await fiscalRes.json();
            pdfUrl = fiscalData.invoiceUrl || null;
            xmlUrl = fiscalData.xmlUrl || null;
            invoiceNumber = fiscalData.invoiceNumber ? String(fiscalData.invoiceNumber) : null;
            accessKey = fiscalData.accessKey || null;
          }
        } catch { /* Asaas fiscal info not available */ }

        const { data: insertedDoc } = await supabase.from("fiscal_documents").insert({
          customer_id: contractRow.customer_id,
          payment_id: payment.id,
          contract_id: contractRow.id || null,
          asaas_invoice_id: payment.asaas_payment_id,
          document_type: "nota_fiscal",
          document_number: invoiceNumber,
          issue_date: new Date(payment.created_at).toISOString().split("T")[0],
          amount: payment.amount || 0,
          status: pdfUrl ? "emitido" : "aguardando",
          file_url: pdfUrl,
          xml_url: xmlUrl,
          access_key: accessKey,
          service_reference: contractRow.contract_type || null,
          notes: "NF criada via reconciliação",
        }).select("id").single();

        // Persist files in invoice_files
        if (insertedDoc?.id) {
          const filesToInsert: { invoice_id: string; type: string; file_url: string; filename: string; mime_type: string }[] = [];
          if (pdfUrl) filesToInsert.push({ invoice_id: insertedDoc.id, type: "pdf", file_url: pdfUrl, filename: `NF-${invoiceNumber || payment.asaas_payment_id}.pdf`, mime_type: "application/pdf" });
          if (xmlUrl) filesToInsert.push({ invoice_id: insertedDoc.id, type: "xml", file_url: xmlUrl, filename: `NF-${invoiceNumber || payment.asaas_payment_id}.xml`, mime_type: "application/xml" });
          if (filesToInsert.length) await supabase.from("invoice_files").insert(filesToInsert);
        }

        synced++;
      } catch (err) {
        errors.push(`${payment.asaas_payment_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "invoice_reconciliation",
      request_payload: { total_checked: confirmedPayments.length, missing: missing.length },
      response_payload: { synced, errors: errors.length },
      status: errors.length > 0 ? "warning" : "success",
      error_message: errors.length > 0 ? errors.join("; ") : null,
    });

    return jsonResponse({
      success: true,
      total_checked: confirmedPayments.length,
      already_synced: confirmedPayments.length - missing.length,
      synced,
      errors: errors.length,
      error_details: errors.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
