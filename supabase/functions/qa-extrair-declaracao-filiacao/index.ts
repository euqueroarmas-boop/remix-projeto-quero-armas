// ============================================================================
// qa-extrair-declaracao-filiacao
// ----------------------------------------------------------------------------
// Recebe um arquivo (PDF/imagem) de declaração de filiação a clube de tiro
// e devolve um JSON estruturado com os campos extraídos pela IA (Gemini
// Vision via Lovable AI Gateway).
//
// IMPORTANTE: esta função NÃO grava nada. Apenas extrai e devolve para que o
// cliente revise e confirme antes de qualquer persistência. Quem persiste é
// `qa-clube-sugerir`, depois da confirmação.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TOOL = {
  type: "function",
  function: {
    name: "extrair_declaracao_filiacao",
    description:
      "Extrai dados de uma declaração de filiação a clube de tiro. " +
      "Devolve campos do CLUBE e do CLIENTE separados. Se algum campo não estiver " +
      "presente no documento, deixe vazio — NUNCA invente.",
    parameters: {
      type: "object",
      properties: {
        clube: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Razão social ou nome fantasia do clube." },
            cnpj: { type: "string", description: "CNPJ do clube no formato 00.000.000/0000-00 ou somente dígitos." },
            numero_cr: { type: "string", description: "Número do CR (Certificado de Registro) do clube no Exército." },
            data_cr: { type: "string", description: "Validade do CR no formato DD/MM/AAAA." },
            endereco: { type: "string", description: "Endereço completo do clube (rua, número, bairro)." },
            cidade: { type: "string", description: "Cidade do clube." },
            uf: { type: "string", description: "UF do clube (2 letras)." },
          },
        },
        cliente: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome completo do filiado." },
            cpf: { type: "string", description: "CPF do filiado." },
            numero_filiacao: { type: "string", description: "Número de matrícula/filiação do cliente no clube." },
            validade_filiacao: { type: "string", description: "Validade da filiação no formato DD/MM/AAAA." },
          },
        },
        data_emissao: { type: "string", description: "Data de emissão da declaração no formato DD/MM/AAAA." },
        possui_assinatura: { type: "boolean", description: "Documento traz assinatura/carimbo visível?" },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

async function pdfToDataUrl(base64: string, mimeType: string): Promise<string> {
  return `data:${mimeType};base64,${base64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user?.id) return json({ error: "invalid_token" }, 401);

    if (!LOVABLE_API_KEY) return json({ error: "ai_not_configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const fileBase64: string = body?.file_base64 || "";
    const mimeType: string = body?.mime_type || "application/pdf";
    if (!fileBase64 || fileBase64.length < 100) {
      return json({ error: "file_required" }, 400);
    }
    if (fileBase64.length > 20 * 1024 * 1024) {
      return json({ error: "file_too_large", mensagem: "Arquivo acima de 20MB." }, 413);
    }

    const dataUrl = await pdfToDataUrl(fileBase64, mimeType);

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você extrai dados de declarações de filiação a clubes de tiro brasileiros. " +
              "Responda SEMPRE chamando a função extrair_declaracao_filiacao. " +
              "Nunca invente dados que não estejam visíveis no documento.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os campos desta declaração de filiação." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extrair_declaracao_filiacao" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "rate_limited" }, 429);
    if (aiResp.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[qa-extrair-declaracao-filiacao] gateway", aiResp.status, t);
      return json({ error: "ai_error", status: aiResp.status }, 502);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "ai_no_tool_call" }, 502);
    }
    let extraido: any = {};
    try {
      extraido = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[qa-extrair-declaracao-filiacao] parse", e);
      return json({ error: "ai_invalid_json" }, 502);
    }

    return json({
      success: true,
      extraido,
    });
  } catch (e: any) {
    console.error("[qa-extrair-declaracao-filiacao]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});