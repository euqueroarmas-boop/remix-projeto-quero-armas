const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { marca, modelo, calibre, tipo } = await req.json();
    if (!marca || !modelo) {
      return new Response(JSON.stringify({ error: "marca e modelo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const sys = `Você é um especialista em armamentos brasileiros e legislação CAC (Lei 10.826/03 e Decreto 11.615/23).
Devolva DADOS TÉCNICOS REAIS de uma arma de fogo. Se não tiver certeza absoluta de um campo, use null. Nunca invente.
Use as unidades exatas: peso em gramas, comprimento em mm, alcance efetivo em metros, velocidade em m/s.
Os "stats gamificados" (0-100) devem refletir a realidade comparativa: dano (energia/calibre), precisão (cano + ergonomia), alcance, cadência (tipo de ação), mobilidade (peso/tamanho), controle (recuo/ergonomia).`;

    const user = `Arma: ${marca} ${modelo}${calibre ? ` calibre ${calibre}` : ""}${tipo ? ` (tipo: ${tipo})` : ""}.
Pesquise e devolva os dados técnicos reais.`;

    const tool = {
      type: "function",
      function: {
        name: "registrar_armamento",
        description: "Registra os dados técnicos reais de uma arma de fogo",
        parameters: {
          type: "object",
          properties: {
            marca: { type: "string" },
            modelo: { type: "string" },
            apelido: { type: ["string", "null"] },
            tipo: { type: "string", enum: ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"] },
            calibre: { type: "string" },
            capacidade_carregador: { type: ["integer","null"] },
            peso_gramas: { type: ["integer","null"] },
            comprimento_cano_mm: { type: ["integer","null"] },
            alcance_efetivo_m: { type: ["integer","null"] },
            velocidade_projetil_ms: { type: ["integer","null"] },
            origem: { type: ["string","null"], description: "País de origem" },
            classificacao_legal: { type: ["string","null"], enum: ["Uso Permitido","Uso Restrito",null] },
            descricao: { type: ["string","null"], description: "Descrição técnica curta (1-2 frases)" },
            stat_dano: { type: "integer", minimum: 0, maximum: 100 },
            stat_precisao: { type: "integer", minimum: 0, maximum: 100 },
            stat_alcance: { type: "integer", minimum: 0, maximum: 100 },
            stat_cadencia: { type: "integer", minimum: 0, maximum: 100 },
            stat_mobilidade: { type: "integer", minimum: 0, maximum: 100 },
            stat_controle: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["marca","modelo","tipo","calibre","stat_dano","stat_precisao","stat_alcance","stat_cadencia","stat_mobilidade","stat_controle"],
          additionalProperties: false,
        },
      },
    };

    const resp = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "registrar_armamento" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});