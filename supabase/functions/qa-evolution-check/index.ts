const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_TOKEN = Deno.env.get("EVOLUTION_API_TOKEN") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
  
  try {
    // List all instances
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_API_TOKEN },
    });
    const data = await res.json();
    
    return new Response(JSON.stringify({ 
      baseUrl,
      instances: data,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), baseUrl }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
