const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action || "list";

    // List all instances
    if (action === "list") {
      const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: { apikey: EVOLUTION_API_TOKEN },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ baseUrl, instances: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create instance
    if (action === "create") {
      const instanceName = body.instanceName || "queroarmas";
      const number = body.number || "";

      const res = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_TOKEN,
        },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          number: number.replace(/\D/g, ""),
          qrcode: true,
          reject_call: false,
          always_online: true,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ created: res.ok, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect / get QR code
    if (action === "connect") {
      const instanceName = body.instanceName || "queroarmas";
      const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: EVOLUTION_API_TOKEN },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get connection state
    if (action === "status") {
      const instanceName = body.instanceName || "queroarmas";
      const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: EVOLUTION_API_TOKEN },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: list, create, connect, status" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), baseUrl }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
