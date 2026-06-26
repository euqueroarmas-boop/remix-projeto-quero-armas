const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = req.headers.get("x-internal-token");
  if (token !== Deno.env.get("INTERNAL_FUNCTION_TOKEN")) {
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }
  const { sections, to } = await req.json() as { sections: { n: string; title: string; html: string }[]; to: string };
  const KEY = Deno.env.get("RESEND_API_KEY")!;
  const FROM = "Quero Armas Hub <onboarding@resend.dev>";
  const results: any[] = [];
  for (const s of sections) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ from: FROM, to: [to], subject: `[HUB DOCS · ${s.n}] ${s.title} — Quero Armas`, html: s.html }),
    });
    const body = await r.text();
    results.push({ n: s.n, title: s.title, status: r.status, body: body.slice(0, 200) });
    await new Promise(res => setTimeout(res, 500));
  }
  return new Response(JSON.stringify({ results }, null, 2), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
