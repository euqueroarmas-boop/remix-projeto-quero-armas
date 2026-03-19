import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeQrImage = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return jsonResponse({ error: "ASAAS_API_KEY not configured" }, 500);
    }

    const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") || "https://sandbox.asaas.com/api/v3";

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_cpf_cnpj,
      billing_type,
      value,
      due_date,
      description,
      quote_id,
    } = body;

    console.log("[create-asaas-payment] Iniciando...", { billing_type, value, quote_id });
    await logSistemaBackend({ tipo: "checkout", status: "info", mensagem: "Início criação de pagamento", payload: { billing_type, value, quote_id } });

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_payment_start",
      request_payload: { customer_name, customer_email, billing_type, value, due_date, quote_id },
      status: "started",
    });

    const customerPayload = {
      name: customer_name,
      email: customer_email,
      cpfCnpj: customer_cpf_cnpj.replace(/\D/g, ""),
    };

    console.log("[create-asaas-payment] Criando cliente no Asaas...");
    const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(customerPayload),
    });

    const customerData = await customerRes.json();
    console.log("[create-asaas-payment] Resposta cliente:", JSON.stringify(customerData));

    let asaasCustomerId = customerData.id;

    if (!customerRes.ok && !asaasCustomerId) {
      console.log("[create-asaas-payment] Cliente não criado, buscando existente...");
      const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${customer_cpf_cnpj.replace(/\D/g, "")}`, {
        headers: { access_token: ASAAS_API_KEY },
      });
      const searchData = await searchRes.json();

      if (!searchData.data?.[0]?.id) {
        await supabase.from("integration_logs").insert({
          integration_name: "asaas",
          operation_name: "create_customer_failed",
          request_payload: customerPayload,
          response_payload: customerData,
          status: "error",
          error_message: "Failed to create/find Asaas customer",
        });
        return jsonResponse({ error: "Failed to create/find Asaas customer", details: customerData }, 400);
      }
      asaasCustomerId = searchData.data[0].id;
    }

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "customer_resolved",
      request_payload: customerPayload,
      response_payload: { asaas_customer_id: asaasCustomerId },
      status: "success",
    });

    // Asaas requires dueDate — default to tomorrow if not provided
    const resolvedDueDate = due_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    const paymentPayload = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value,
      dueDate: resolvedDueDate,
      description: description || "Contrato WMTi",
    };

    console.log("[create-asaas-payment] Criando cobrança...", JSON.stringify(paymentPayload));
    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentRes.json();
    console.log("[create-asaas-payment] Resposta pagamento:", JSON.stringify(paymentData));

    if (!paymentRes.ok) {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_failed",
        request_payload: paymentPayload,
        response_payload: paymentData,
        status: "error",
        error_message: `Asaas returned ${paymentRes.status}`,
      });
      return jsonResponse({ error: "Failed to create payment", details: paymentData }, 400);
    }

    let pixQrCodeImage: string | null = null;
    let pixCopyPaste: string | null = null;

    if (billing_type === "PIX" && paymentData.id) {
      try {
        const pixQrRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
          headers: { access_token: ASAAS_API_KEY },
        });
        const pixQrData = await pixQrRes.json();
        console.log("[create-asaas-payment] Resposta QR Code PIX:", JSON.stringify(pixQrData));

        if (pixQrRes.ok) {
          pixQrCodeImage = normalizeQrImage(pixQrData.encodedImage);
          pixCopyPaste = pixQrData.payload || null;
        }
      } catch (pixError) {
        console.error("[create-asaas-payment] Falha ao obter QR Code PIX:", pixError);
      }
    }

    const invoiceUrl = paymentData.invoiceUrl || paymentData.bankSlipUrl || null;
    const normalizedResponse = {
      success: true,
      billingType: billing_type,
      invoiceUrl,
      pixQrCodeImage,
      pixCopyPaste,
      asaasPaymentId: paymentData.id || null,
      status: String(paymentData.status || "PENDING").toLowerCase(),
      invoice_url: invoiceUrl,
      payment_id: paymentData.id || null,
    };

    const hasRenderablePaymentData = Boolean(invoiceUrl || pixQrCodeImage || pixCopyPaste);
    if (!hasRenderablePaymentData) {
      console.error("[create-asaas-payment] Nenhum dado renderizável retornado. Payment ID:", paymentData.id);
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_no_renderable_data",
        request_payload: paymentPayload,
        response_payload: { paymentData, pixQrCodeImage: !!pixQrCodeImage, pixCopyPaste: !!pixCopyPaste },
        status: "warning",
        error_message: "Asaas did not return invoiceUrl or PIX details",
      });
    }

    if (quote_id) {
      const { error: dbErr } = await supabase
        .from("payments")
        .update({
          asaas_payment_id: paymentData.id,
          payment_method: billing_type,
          payment_status: paymentData.status || "PENDING",
          billing_type,
          due_date,
          asaas_invoice_url: invoiceUrl,
        })
        .eq("quote_id", quote_id);

      if (dbErr) {
        console.error("[create-asaas-payment] Erro ao atualizar payment no DB:", dbErr);
      }
    }

    await supabase.from("integration_logs").insert({
      integration_name: "asaas",
      operation_name: "create_payment_success",
      request_payload: paymentPayload,
      response_payload: normalizedResponse,
      status: hasRenderablePaymentData ? "success" : "warning",
    });

    console.log("[create-asaas-payment] Resposta normalizada:", JSON.stringify(normalizedResponse));
    return jsonResponse(normalizedResponse, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-asaas-payment] Erro fatal:", message);

    try {
      await supabase.from("integration_logs").insert({
        integration_name: "asaas",
        operation_name: "create_payment_error",
        status: "error",
        error_message: message,
      });
    } catch {
      // ignore log failure
    }

    return jsonResponse({ error: message }, 500);
  }
});
