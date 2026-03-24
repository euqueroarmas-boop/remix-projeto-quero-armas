import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitize(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/<[^>]*>/g, "").slice(0, 2000);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true; // optional
  return /^[\d\s()+-]{7,20}$/.test(phone);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const name = sanitize(body.name);
    const email = sanitize(body.email);
    const phone = sanitize(body.phone);
    const company = sanitize(body.company);
    const service_interest = sanitize(body.service_interest);
    const message = sanitize(body.message);
    const source_page = sanitize(body.source_page);
    const utm_source = sanitize(body.utm_source);
    const utm_medium = sanitize(body.utm_medium);
    const utm_campaign = sanitize(body.utm_campaign);

    // Validate required fields
    const errors: string[] = [];
    if (!name) errors.push("Nome é obrigatório");
    if (!email) errors.push("E-mail é obrigatório");
    if (!isValidEmail(email)) errors.push("E-mail inválido");
    if (!message) errors.push("Mensagem é obrigatória");
    if (!isValidPhone(phone)) errors.push("Telefone inválido");

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("leads").insert({
      name,
      email,
      phone: phone || null,
      company: company || null,
      service_interest: service_interest || null,
      message,
      source_page: source_page || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
    });

    if (error) {
      console.error("[submit-lead] DB error:", error);
      await supabase.from("logs_sistema").insert({
        tipo: "erro",
        status: "error",
        mensagem: `[submit-lead] Falha ao inserir lead: ${error.message}`,
        payload: { email, error_code: error.code, error_details: error.details },
      });
      return new Response(
        JSON.stringify({ success: false, errors: ["Erro ao registrar solicitação. Tente novamente."] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log success
    await supabase.from("logs_sistema").insert({
      tipo: "checkout",
      status: "success",
      mensagem: `[submit-lead] Lead registrado: ${email}`,
      payload: { name, email, source_page },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[submit-lead] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, errors: ["Erro interno. Tente novamente ou fale via WhatsApp."] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
