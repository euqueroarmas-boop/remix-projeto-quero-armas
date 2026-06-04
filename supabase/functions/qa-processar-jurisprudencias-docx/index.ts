import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import mammoth from "npm:mammoth@1.12.0";
import { Buffer } from "node:buffer";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    // Auth: require active QA staff
    const { requireQAStaff } = await import("../_shared/qaAuth.ts");
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { storage_path, tribunal, tema, categoria_tematica, palavras_chave } = await req.json();
    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path obrigatório" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-documentos")
      .download(storage_path);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Erro ao baixar arquivo: " + (dlErr?.message || "não encontrado") }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Extract text with mammoth - use Buffer for Deno compatibility
    const arrayBuf = await fileData.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuf);
    const result = await mammoth.extractRawText({ buffer: nodeBuffer });
    const fullText = result.value;

    if (!fullText || fullText.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Documento vazio ou texto insuficiente" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract structured jurisprudências
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um extrator de jurisprudências. Analise o texto e extraia CADA decisão judicial individual.
Para cada uma, retorne um objeto JSON com:
- tribunal (sigla: STF, STJ, TRF1, TRF2, TRF3, TRF4, TRF5, etc.)
- numero_processo (número do processo, se disponível)
- relator (nome do relator/desembargador)
- orgao_julgador (turma/câmara)
- data_julgamento (formato YYYY-MM-DD, se disponível, senão null)
- data_publicacao (formato YYYY-MM-DD, se disponível, senão null)
- tema (assunto principal em poucas palavras)
- ementa_resumida (a ementa completa da decisão)
- tese_aplicavel (a tese jurídica principal aplicada)
- categoria_tematica (categoria temática geral)

Retorne APENAS um array JSON válido. Sem markdown, sem explicações. Exemplo: [{"tribunal":"TRF4",...},...]`
          },
          {
            role: "user",
            content: fullText.substring(0, 120000),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_jurisprudencias",
              description: "Salva as jurisprudências extraídas do documento",
              parameters: {
                type: "object",
                properties: {
                  jurisprudencias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tribunal: { type: "string" },
                        numero_processo: { type: "string" },
                        relator: { type: "string" },
                        orgao_julgador: { type: "string" },
                        data_julgamento: { type: "string" },
                        data_publicacao: { type: "string" },
                        tema: { type: "string" },
                        ementa_resumida: { type: "string" },
                        tese_aplicavel: { type: "string" },
                        categoria_tematica: { type: "string" },
                      },
                      required: ["tribunal", "ementa_resumida"],
                    },
                  },
                },
                required: ["jurisprudencias"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_jurisprudencias" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsH, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsH, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro na IA: " + status }), {
        status: 500, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();

    // Extract from tool call response
    let jurisprudencias: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        jurisprudencias = parsed.jurisprudencias || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    if (jurisprudencias.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma jurisprudência identificada no documento" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Insert all extracted jurisprudências
    let saved = 0;
    let errors = 0;
    for (const j of jurisprudencias) {
      const { error: insErr } = await supabase.from("qa_jurisprudencias").insert({
        tribunal: j.tribunal || tribunal || "A classificar",
        numero_processo: j.numero_processo || null,
        relator: j.relator || null,
        orgao_julgador: j.orgao_julgador || null,
        data_julgamento: j.data_julgamento || null,
        data_publicacao: j.data_publicacao || null,
        tema: j.tema || tema || null,
        ementa_resumida: j.ementa_resumida,
        tese_aplicavel: j.tese_aplicavel || null,
        categoria_tematica: j.categoria_tematica || categoria_tematica || null,
        palavras_chave: palavras_chave || [],
        origem: "upload_docx_ia",
        arquivo_url: storage_path,
        validada_humanamente: false,
      });
      if (insErr) {
        console.error("Insert error:", insErr.message);
        errors++;
      } else {
        saved++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_extraidas: jurisprudencias.length,
      salvas: saved,
      erros: errors,
    }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
