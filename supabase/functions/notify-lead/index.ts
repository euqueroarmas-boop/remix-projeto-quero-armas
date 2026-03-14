import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, company, service_interest, message, source_page } = await req.json();

    // Format notification content
    const notification = `
Novo lead recebido no site WMTi!

Nome: ${name}
Email: ${email}
Telefone: ${phone || "Não informado"}
Empresa: ${company || "Não informada"}
Interesse: ${service_interest || "Não informado"}
Página: ${source_page || "/"}

Mensagem:
${message}

---
Enviado automaticamente pelo site wmti.com.br
    `.trim();

    console.log("📧 Lead notification:", notification);

    // Send WhatsApp-style notification via webhook (optional future integration)
    // For now, log the lead for admin dashboard access via Supabase
    
    return new Response(
      JSON.stringify({ success: true, message: "Notification processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing lead notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process notification" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
