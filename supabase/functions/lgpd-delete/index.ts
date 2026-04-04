import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANON_LABEL = "Titular excluído por solicitação LGPD";
const ANON_DOC = "000.000.000-00";
const ANON_EMAIL = "excluido@lgpd.local";
const ANON_PHONE = "";

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { customer_id, reason } = body;

    // ── Auth check ──
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD");
    if (!ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "ADMIN_PASSWORD not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminToken = req.headers.get("x-admin-token");
    let authorized = false;
    if (adminToken) {
      try {
        const [ts, sig] = adminToken.split(".");
        if (Date.now() - parseInt(ts, 10) <= 8 * 60 * 60 * 1000) {
          authorized = await hmacVerify(ADMIN_PASSWORD, `admin:${ts}`, sig);
        }
      } catch { /* invalid */ }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customer_id) {
      return new Response(JSON.stringify({ error: "customer_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Load customer ──
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (!customer) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (customer.status_cliente === "excluido_lgpd") {
      return new Response(JSON.stringify({ error: "Cliente já foi excluído por LGPD" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const affectedTables: string[] = [];
    const deletedFields: string[] = [];
    const anonymizedFields: string[] = [];
    const retainedFields: string[] = [];

    // ── 1. Delete auth user (invalidate credentials) ──
    if (customer.user_id) {
      try {
        await supabase.auth.admin.deleteUser(customer.user_id);
        affectedTables.push("auth.users");
        deletedFields.push("auth_user (credentials, sessions)");
      } catch (e) {
        console.error("[lgpd-delete] Error deleting auth user:", e);
      }
    }

    // ── 2. Anonymize customer record (keep for contract/financial traceability) ──
    await supabase.from("customers").update({
      razao_social: ANON_LABEL,
      nome_fantasia: null,
      cnpj_ou_cpf: ANON_DOC,
      email: ANON_EMAIL,
      responsavel: ANON_LABEL,
      telefone: ANON_PHONE,
      endereco: null,
      cep: null,
      cidade: null,
      user_id: null,
      status_cliente: "excluido_lgpd",
      suspended_at: new Date().toISOString(),
    }).eq("id", customer_id);
    affectedTables.push("customers");
    anonymizedFields.push("razao_social", "nome_fantasia", "cnpj_ou_cpf", "email", "responsavel", "telefone", "endereco", "cep", "cidade");
    retainedFields.push("id", "created_at", "status_cliente");

    // ── 3. Anonymize contracts (keep IDs, type, value, dates for financial traceability) ──
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, quote_id")
      .eq("customer_id", customer_id);

    if (contracts?.length) {
      for (const c of contracts) {
        await supabase.from("contracts").update({
          contract_text: null,
          client_ip: null,
        }).eq("id", c.id);
      }
      affectedTables.push("contracts");
      deletedFields.push("contract_text", "client_ip");
      retainedFields.push("contract_id", "contract_type", "monthly_value", "status", "dates");
    }

    // ── 4. Anonymize contract signatures ──
    if (contracts?.length) {
      const contractIds = contracts.map(c => c.id);
      await supabase.from("contract_signatures")
        .update({
          signer_name: ANON_LABEL,
          ip_address: null,
          user_agent: null,
          signature_data: "REDACTED_LGPD",
        })
        .in("contract_id", contractIds);
      affectedTables.push("contract_signatures");
      anonymizedFields.push("signer_name", "ip_address", "user_agent", "signature_data");
    }

    // ── 5. Anonymize client_events (keep for audit trail) ──
    await supabase.from("client_events").update({
      description: "Dados removidos por exclusão LGPD",
    }).eq("customer_id", customer_id);
    affectedTables.push("client_events");
    anonymizedFields.push("event_descriptions");
    retainedFields.push("event_type", "title", "created_at");

    // ── 6. Anonymize leads linked via quotes→contracts ──
    if (contracts?.length) {
      const quoteIds = contracts.map((c: any) => c.quote_id).filter(Boolean);
      if (quoteIds.length) {
        const { data: quotes } = await supabase
          .from("quotes")
          .select("id, lead_id")
          .in("id", quoteIds);
        const leadIds = quotes?.map(q => q.lead_id).filter(Boolean) || [];
        if (leadIds.length) {
          for (const lid of leadIds) {
            await supabase.from("leads").update({
              name: ANON_LABEL,
              email: ANON_EMAIL,
              phone: ANON_PHONE,
              whatsapp: ANON_PHONE,
              company: ANON_LABEL,
              message: null,
            }).eq("id", lid);
          }
          affectedTables.push("leads");
          anonymizedFields.push("lead_name", "lead_email", "lead_phone", "lead_whatsapp", "lead_company", "lead_message");
        }
      }
    }

    // ── 7. Anonymize PII in logs_sistema payload ──
    const { data: logs } = await supabase
      .from("logs_sistema")
      .select("id, payload")
      .or(`payload->>customer_id.eq.${customer_id},payload->>email.eq.${customer.email}`);

    if (logs?.length) {
      for (const log of logs) {
        const cleanPayload = { ...(log.payload as Record<string, unknown>) };
        for (const key of ["email", "name", "razao_social", "telefone", "phone", "whatsapp", "cpf", "cnpj", "endereco"]) {
          if (cleanPayload[key]) cleanPayload[key] = "REDACTED_LGPD";
        }
        await supabase.from("logs_sistema").update({ payload: cleanPayload }).eq("id", log.id);
      }
      affectedTables.push("logs_sistema");
      anonymizedFields.push("log_payloads_with_pii");
    }

    // ── 8. Record LGPD deletion event ──
    await supabase.from("client_events").insert({
      customer_id,
      event_type: "lgpd_exclusao",
      title: "Dados pessoais excluídos (LGPD)",
      description: `Exclusão realizada. Motivo: ${reason || "Solicitação do titular"}`,
    });

    // ── 9. Audit log (without PII) ──
    await supabase.from("admin_audit_logs").insert({
      action: "lgpd_data_deletion",
      target_type: "customer",
      target_id: customer_id,
      before_state: {
        had_auth_user: !!customer.user_id,
        had_contracts: contracts?.length || 0,
        status_before: customer.status_cliente,
      },
      after_state: {
        status: "excluido_lgpd",
        affected_tables: affectedTables,
        deleted_fields: deletedFields,
        anonymized_fields: anonymizedFields,
        retained_fields: retainedFields,
        reason: reason || "Solicitação do titular",
      },
    });

    await logSistemaBackend({
      tipo: "admin",
      status: "success",
      mensagem: "Exclusão LGPD executada",
      payload: {
        customer_id,
        affected_tables: affectedTables,
        deleted_count: deletedFields.length,
        anonymized_count: anonymizedFields.length,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      customer_id,
      affected_tables: affectedTables,
      deleted_fields: deletedFields,
      anonymized_fields: anonymizedFields,
      retained_fields: retainedFields,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[lgpd-delete] Error:", error);
    await logSistemaBackend({
      tipo: "erro",
      status: "error",
      mensagem: "Erro na exclusão LGPD",
      payload: { error: error instanceof Error ? error.message : String(error) },
    });
    return new Response(JSON.stringify({ error: "Erro interno na exclusão LGPD" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
