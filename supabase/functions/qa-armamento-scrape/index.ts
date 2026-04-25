const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, marca, modelo } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "url é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Conector Firecrawl não está ativo. Conecte em Connectors > Firecrawl." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // 1) Scrape com Firecrawl
    const fcRes = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const fc = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ error: fc?.error || "Falha no Firecrawl" }), { status: fcRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const markdown: string = fc?.markdown || fc?.data?.markdown || "";
    if (!markdown) return new Response(JSON.stringify({ error: "Página sem conteúdo extraível" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 2) Manda IA estruturar
    const sys = `Extraia especificações técnicas reais de uma arma de fogo a partir do conteúdo fornecido. Use null quando o dado não estiver explícito. Não invente.`;
    const user = `Marca/modelo de referência: ${marca || "?"} ${modelo || "?"}\nURL: ${url}\n\nConteúdo:\n${markdown.slice(0, 18000)}`;
    const tool = {
      type: "function",
      function: {
        name: "registrar_armamento",
        parameters: {
          type: "object",
          properties: {
            marca: { type: "string" }, modelo: { type: "string" }, apelido: { type: ["string","null"] },
            tipo: { type: "string", enum: ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"] },
            calibre: { type: "string" },
            capacidade_carregador: { type: ["integer","null"] }, peso_gramas: { type: ["integer","null"] },
            comprimento_cano_mm: { type: ["integer","null"] }, alcance_efetivo_m: { type: ["integer","null"] },
            velocidade_projetil_ms: { type: ["integer","null"] },
            origem: { type: ["string","null"] }, classificacao_legal: { type: ["string","null"] },
            descricao: { type: ["string","null"] },
            stat_dano: { type: "integer", minimum: 0, maximum: 100 }, stat_precisao: { type: "integer", minimum: 0, maximum: 100 },
            stat_alcance: { type: "integer", minimum: 0, maximum: 100 }, stat_cadencia: { type: "integer", minimum: 0, maximum: 100 },
            stat_mobilidade: { type: "integer", minimum: 0, maximum: 100 }, stat_controle: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["marca","modelo","tipo","calibre","stat_dano","stat_precisao","stat_alcance","stat_cadencia","stat_mobilidade","stat_controle"],
          additionalProperties: false,
        },
      },
    };
    const aiRes = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools: [tool], tool_choice: { type: "function", function: { name: "registrar_armamento" } },
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text(); console.error("AI:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Erro ao estruturar dados via IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aj = await aiRes.json();
    const args = aj?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return new Response(JSON.stringify({ error: "IA não estruturou os dados" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ data: JSON.parse(args), source_url: url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});