// Edge Function: qa-extract-cliente-doc
// Extrai campos estruturados de documentos do cliente CAC (CR, CRAF/SINARM, GT/GTE, AC, etc.)
// usando Lovable AI Gateway (Gemini Vision). Retorna sugestão para revisão híbrida.

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
const MODEL = "google/gemini-2.5-flash";

const TIPOS_VALIDOS = ["cr", "craf", "sinarm", "gt", "gte", "autorizacao_compra", "outro"] as const;
type TipoDoc = typeof TIPOS_VALIDOS[number];

function buildTool(tipo: TipoDoc) {
  const baseProps: Record<string, unknown> = {
    numero_documento: { type: "string", description: "Número, código ou identificador do documento (ex: número do CR, CRAF, GT, AC)." },
    orgao_emissor: { type: "string", description: "Órgão emissor (ex: Exército Brasileiro, Polícia Federal, SR/PF/UF, R-MIL/CMA)." },
    data_emissao: { type: "string", description: "Data de emissão no formato DD/MM/AAAA." },
    data_validade: { type: "string", description: "Data de validade/vencimento no formato DD/MM/AAAA." },
    observacoes: { type: "string", description: "Notas relevantes (categoria, restrições, finalidade)." },
  };

  const armaProps: Record<string, unknown> = {
    arma_marca: { type: "string", description: "Marca/fabricante (ex: Taurus, Glock, CBC, IMBEL)." },
    arma_modelo: { type: "string", description: "Modelo (ex: G2C, PT838, 1911)." },
    arma_calibre: { type: "string", description: "Calibre (ex: .380 ACP, 9mm, .40 S&W, .38 SPL)." },
    arma_numero_serie: { type: "string", description: "Número de série da arma." },
    arma_especie: { type: "string", description: "Espécie/tipo (Pistola, Revólver, Carabina, Espingarda, Fuzil)." },
  };

  const includeArma = tipo !== "cr";
  const properties = includeArma ? { ...baseProps, ...armaProps } : baseProps;

  return {
    type: "function",
    function: {
      name: "extrair_documento_cac",
      description: `Extrai dados de um documento CAC do tipo ${tipo.toUpperCase()}.`,
      parameters: {
        type: "object",
        properties,
        required: [],
        additionalProperties: false,
      },
    },
  };
}

function systemPromptFor(tipo: TipoDoc): string {
  const map: Record<TipoDoc, string> = {
    cr: "Você é especialista em documentos do Exército Brasileiro. Extraia os dados do CERTIFICADO DE REGISTRO (CR) de Colecionador, Atirador ou Caçador.",
    craf: "Você é especialista em documentos do SIGMA/Exército. Extraia os dados do CRAF (Certificado de Registro de Arma de Fogo), incluindo dados completos da arma.",
    sinarm: "Você é especialista em documentos da Polícia Federal/SINARM. Extraia os dados do registro de arma (Posse ou Porte) emitido pela PF, incluindo dados da arma.",
    gt: "Você é especialista em documentos do Exército. Extraia os dados da GUIA DE TRÁFEGO (GT) permanente, incluindo dados da arma.",
    gte: "Você é especialista em documentos do Exército. Extraia os dados da GUIA DE TRÁFEGO EVENTUAL (GTE), incluindo dados da arma e validade.",
    autorizacao_compra: "Você é especialista em documentos do Exército/PF. Extraia os dados da AUTORIZAÇÃO DE COMPRA (AC) de arma de fogo.",
    outro: "Você é especialista em documentos SIGMA/SINARM. Extraia todos os dados estruturados que conseguir identificar.",
  };
  return `${map[tipo]} Responda exclusivamente chamando a função extrair_documento_cac. Use null/vazio para campos não encontrados. Datas no formato DD/MM/AAAA.`;
}

async function callVision(imageDataUrl: string, tipo: TipoDoc) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const tool = buildTool(tipo);
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPromptFor(tipo) },
        {
          role: "user",
          content: [
            { type: "text", text: `Extraia todos os dados deste documento ${tipo.toUpperCase()}.` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extrair_documento_cac" } },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
    if (resp.status === 402) throw new Error("Sem créditos disponíveis no Lovable AI.");
    throw new Error(`AI gateway error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    return {};
  }
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return {};
  }
}

function ddmmaaaaToISO(s?: string | null): string | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo_documento || "outro").toLowerCase() as TipoDoc;
    const imageDataUrl = String(body?.imageDataUrl || "");

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return json({ error: "tipo_documento inválido" }, 400);
    }
    if (!imageDataUrl.startsWith("data:")) {
      return json({ error: "imageDataUrl deve ser uma data URL (data:image/... ou data:application/pdf)" }, 400);
    }

    const raw = await callVision(imageDataUrl, tipo);

    const sugestao = {
      numero_documento: raw.numero_documento || null,
      orgao_emissor: raw.orgao_emissor || null,
      data_emissao: ddmmaaaaToISO(raw.data_emissao),
      data_validade: ddmmaaaaToISO(raw.data_validade),
      observacoes: raw.observacoes || null,
      arma_marca: raw.arma_marca || null,
      arma_modelo: raw.arma_modelo || null,
      arma_calibre: raw.arma_calibre || null,
      arma_numero_serie: raw.arma_numero_serie || null,
      arma_especie: raw.arma_especie || null,
    };

    return json({ ok: true, sugestao, raw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    console.error("[qa-extract-cliente-doc]", msg);
    return json({ error: msg }, 500);
  }
});