// Analisa decisão administrativa de indeferimento da PF e extrai estrutura
// para uso na geração de Recurso Administrativo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um advogado administrativista sênior especializado em armas de fogo.
Sua tarefa: ANALISAR uma decisão de INDEFERIMENTO emitida pela Polícia Federal e extrair, de forma estruturada,
os elementos jurídicos que serão rebatidos em RECURSO ADMINISTRATIVO.

REGRAS:
- NÃO invente fatos, normas ou jurisprudência.
- Trabalhe SOMENTE com o texto fornecido.
- Identifique vícios reais (motivação genérica, ausência de análise individual, extrapolação de discricionariedade, falta de fundamentação adequada, contradições, omissões).
- Linguagem técnica, objetiva, jurídica. Sem floreio.
- Cada item das listas deve ser CURTO e DIRETO (máx 240 caracteres), pronto para virar bullet em peça jurídica.
- Cite o artigo/dispositivo conforme aparece no texto. Se não houver, deixe em branco.

Você DEVE responder via tool call estruturado.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { requireQAStaff } = await import("../_shared/qaAuth.ts");
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const texto: string = String(body.texto || "").trim();
    const caso_id: string | null = body.caso_id ? String(body.caso_id) : null;

    if (texto.length < 100) {
      return json({ error: "Texto do indeferimento muito curto (mínimo 100 caracteres)." }, 400);
    }
    if (texto.length > 60000) {
      return json({ error: "Texto excede 60.000 caracteres. Resuma e tente novamente." }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Analise a seguinte DECISÃO ADMINISTRATIVA DE INDEFERIMENTO da Polícia Federal e extraia a estrutura solicitada:\n\n────── INÍCIO DO DOCUMENTO ──────\n${texto}\n────── FIM DO DOCUMENTO ──────`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_analise_indeferimento",
            description: "Estrutura a análise técnica do indeferimento.",
            parameters: {
              type: "object",
              properties: {
                resumo_decisao: { type: "string", description: "Resumo objetivo (2-4 linhas) do que a autoridade decidiu e por quê." },
                autoridade: { type: "string", description: "Autoridade signatária (delegado, chefe, etc) e unidade da PF, se houver." },
                fundamentos_de_indef: {
                  type: "array",
                  items: { type: "string" },
                  description: "Cada motivo invocado pela autoridade para indeferir. Um item por motivo.",
                },
                artigos_citados: {
                  type: "array",
                  items: { type: "string" },
                  description: "Dispositivos legais citados textualmente no indeferimento (ex: 'art. 4º, III da Lei 10.826/03').",
                },
                pontos_nao_enfrentados: {
                  type: "array",
                  items: { type: "string" },
                  description: "Argumentos/documentos do requerente que a autoridade IGNOROU ou não enfrentou.",
                },
                falhas_logicas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Inconsistências, contradições, motivação genérica, extrapolação de discricionariedade.",
                },
                vicios_formais: {
                  type: "array",
                  items: { type: "string" },
                  description: "Vícios formais: ausência de motivação adequada (Lei 9.784/99 art.50), violação de ampla defesa, falta de individualização, etc.",
                },
              },
              required: [
                "resumo_decisao",
                "fundamentos_de_indef",
                "artigos_citados",
                "pontos_nao_enfrentados",
                "falhas_logicas",
                "vicios_formais",
              ],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "registrar_analise_indeferimento" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "Limite de requisições excedido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha ao analisar com IA" }, 500);
    }

    const ai = await aiResp.json();
    const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "Resposta de IA sem estrutura esperada" }, 500);
    }
    let analise: any;
    try {
      analise = JSON.parse(toolCall.function.arguments);
    } catch {
      return json({ error: "Falha ao decodificar análise estruturada" }, 500);
    }

    // Persistir no caso, se fornecido
    if (caso_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("qa_casos")
        .update({
          indeferimento_texto: texto,
          indeferimento_analise: analise,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caso_id);
    }

    return json({ analise });
  } catch (e) {
    console.error("qa-analisar-indeferimento error", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});