// Edge Function: qa-conformidade-semantica
// Verificação semântica de conformidade entre dois valores de um mesmo campo.
// Acionada apenas quando a comparação local fica na zona cinzenta (similaridade 0.55–0.88).
//
// Entrada (POST JSON):
//   { campo: string, valorA: string, valorB: string }
//
// Saída:
//   { equivalente: boolean, confianca: number, justificativa: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let campo = "", valorA = "", valorB = "";
  try {
    ({ campo, valorA, valorB } = await req.json());
  } catch {
    return json({ equivalente: false, confianca: 0, justificativa: "Payload inválido" }, 400);
  }

  if (!valorA || !valorB) {
    return json({ equivalente: false, confianca: 0, justificativa: "Valores ausentes" }, 400);
  }

  const apiKey = Deno.env.get("GATEWAY_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY") ?? "";

  const prompt = `Você é um verificador de conformidade de dados pessoais para processos de controle de armas no Brasil. Sua tarefa é determinar se dois valores representam o MESMO dado para o campo informado.

Campo: ${campo}
Valor A (do documento): "${valorA}"
Valor B (referência): "${valorB}"

Regras:
- Considere equivalentes: variações de formatação, abreviações (José C. da Silva = José Carlos da Silva), omissão de partículas (da, de, dos, das), diferenças de caixa ou acentuação, e erros de digitação menores.
- Considere divergentes: nomes com sobrenomes diferentes, datas distintas, CPFs com dígitos diferentes, naturalidades de cidades/estados diferentes.
- Seja conservador: em caso de dúvida real sobre pessoas ou locais distintos, responda equivalente: false.

Responda SOMENTE com JSON válido, sem markdown:
{"equivalente": true/false, "confianca": 0.0-1.0, "justificativa": "explicação em uma frase"}`;

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 128,
      }),
    });

    if (!response.ok) {
      throw new Error(`Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta sem JSON");

    const parsed = JSON.parse(match[0]);
    return json({
      equivalente: parsed.equivalente === true,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0.5,
      justificativa: parsed.justificativa ?? "",
    });
  } catch (e) {
    // Por conservadorismo, falha → divergente
    return json({ equivalente: false, confianca: 0, justificativa: `Erro na verificação: ${e}` });
  }
});
