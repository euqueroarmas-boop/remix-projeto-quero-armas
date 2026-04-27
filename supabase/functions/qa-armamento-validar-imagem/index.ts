import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ValidacaoResp = { valida: boolean; motivo: string; confianca: number };
type Decisao = "correta" | "incorreta";

function decisaoFinal(resultado: ValidacaoResp): Decisao {
  if (resultado.valida) return "correta";
  if (!resultado.valida && resultado.confianca >= 80) return "incorreta";
  return "correta";
}

async function validar(
  imagemUrl: string,
  arma: { marca: string; modelo: string; tipo?: string | null; calibre?: string | null; origem?: string | null },
): Promise<ValidacaoResp> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { valida: true, motivo: "LOVABLE_API_KEY ausente — validação ignorada", confianca: 0 };
  }

  const prompt = `Você é um especialista em armas de fogo.

Analise se esta imagem corresponde ao modelo cadastrado.

ARMA CADASTRADA:
- Marca: ${arma.marca}
- Modelo: ${arma.modelo}
- Tipo: ${arma.tipo || "não informado"}
- Calibre: ${arma.calibre || "não informado"}
- Origem: ${arma.origem || "não informada"}

REGRAS DE VALIDAÇÃO (aplique com bom senso):

✅ CONSIDERE CORRETA se:
- A silhueta/formato geral bate com o tipo (pistola, espingarda, fuzil, etc.)
- A marca visual bate com a marca cadastrada
- O modelo é compatível considerando variações de nomenclatura (ex: "G26" = "Glock 26" = "26")
- Pequenas diferenças de geração ou acabamento são aceitáveis (ex: Gen4 vs Gen5 do mesmo modelo)

❌ CONSIDERE INCORRETA apenas se:
- É claramente um tipo diferente de arma (ex: espingarda no lugar de pistola)
- É de uma marca completamente diferente
- É um modelo claramente diferente da mesma marca (ex: Glock 17 no lugar de Glock 26 — tamanhos muito distintos)
- É um objeto que não é uma arma de fogo

ATENÇÃO: Seja generoso na validação.
Dúvida razoável = considere CORRETA.
Só rejeite se tiver CERTEZA que está errada.

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