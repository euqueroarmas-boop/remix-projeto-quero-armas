// Edge Function: valida via IA (Gemini Vision) se uma imagem corresponde
// EXATAMENTE ao modelo de arma cadastrado. Não confia em modelos similares
// da mesma marca (ex.: Glock 17 não vale como Glock 26).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ValidacaoResp = { valida: boolean; motivo: string; confianca: number };

async function validar(
  imagemUrl: string,
  arma: { marca: string; modelo: string; tipo?: string | null; calibre?: string | null },
): Promise<ValidacaoResp> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { valida: true, motivo: "LOVABLE_API_KEY ausente — validação ignorada", confianca: 0 };
  }

  const tipoTxt = arma.tipo ? ` (${arma.tipo})` : "";
  const calTxt = arma.calibre ? `, calibre ${arma.calibre}` : "";
  const prompt = `Esta imagem mostra EXATAMENTE uma "${arma.marca}" "${arma.modelo}"${tipoTxt}${calTxt}?

Verifique especialmente:
1. O texto/gravação no ferrolho, receptor ou cano combina com o modelo "${arma.modelo}"?
2. A silhueta, formato e proporções correspondem à "${arma.marca} ${arma.modelo}" (e não a outro modelo da mesma marca)?
3. NÃO se trata de um modelo diferente, mesmo que da mesma fabricante (ex.: Glock 17 ≠ Glock 26 ≠ Glock 19)?
4. NÃO é caminhão, carro, brinquedo, logo, banner, ícone, desenho ou outro objeto fora de contexto?

Se houver QUALQUER dúvida razoável, responda valida=false.

Responda SOMENTE através da função 'responder_validacao'.`;

  const tool = {
    type: "function",
    function: {
      name: "responder_validacao",
      description: "Responde se a imagem corresponde exatamente ao modelo cadastrado.",
      parameters: {
        type: "object",
        properties: {
          valida: { type: "boolean" },
          motivo: { type: "string", description: "Motivo curto (1-2 frases) em português." },
          confianca: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["valida", "motivo", "confianca"],
        additionalProperties: false,
      },
    },
  };

  try {
    const resp = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imagemUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "responder_validacao" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.warn("[validar-imagem] gateway falhou", resp.status, t.slice(0, 200));
      return { valida: true, motivo: `gateway_${resp.status}`, confianca: 0 };
    }
    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { valida: true, motivo: "ia_sem_resposta", confianca: 0 };
    const parsed = JSON.parse(args) as ValidacaoResp;
    return {
      valida: !!parsed.valida,
      motivo: String(parsed.motivo || "").slice(0, 400),
      confianca: Math.max(0, Math.min(100, Number(parsed.confianca) || 0)),
    };
  } catch (e) {
    console.warn("[validar-imagem] erro", e);
    return { valida: true, motivo: "erro_validacao", confianca: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const imagemUrl = body?.imagemUrl as string | undefined;
    const marca = body?.marca as string | undefined;
    const modelo = body?.modelo as string | undefined;
    if (!imagemUrl || !marca || !modelo) {
      return new Response(
        JSON.stringify({ error: "imagemUrl, marca e modelo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const r = await validar(imagemUrl, {
      marca,
      modelo,
      tipo: body?.tipo ?? null,
      calibre: body?.calibre ?? null,
    });
    return new Response(JSON.stringify(r), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as any)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});