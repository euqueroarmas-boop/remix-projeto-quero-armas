// Edge Function: qa-adesao-classificar-docs
// Classifica documentos da Central de Adesão via Gemini Vision.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const TIPOS_VALIDOS = [
  "cin",
  "comprovante_residencia",
  "laudo_psicologico",
  "laudo_capacidade_tecnica",
  "antecedentes_criminais",
  "certidao_antecedentes_criminais_federal",
  "comprovante_renda",
  "cartao_cnpj_mei",
  "craf",
  "gte",
  "nota_fiscal_arma",
  "gov_br",
  "outro",
];

const SYSTEM_PROMPT = `Você é um classificador de documentos para o processo de aquisição de armas de fogo no Brasil (CAC).

Analise o documento e identifique o tipo exato entre as categorias:
- cin: RG, CNH, CIN, passaporte — documento de identidade com foto
- comprovante_residencia: conta de luz, água, gás, telefone, IPTU, correspondência bancária com endereço
- laudo_psicologico: laudo de psicólogo com CRP, resultado APTO/INAPTO
- laudo_capacidade_tecnica: laudo de capacidade técnica de atirador/instrutor de tiro
- antecedentes_criminais: certidão estadual de antecedentes (SSP, TJ estadual)
- certidao_antecedentes_criminais_federal: certidão federal (Justiça Federal, DPF, TSE)
- comprovante_renda: holerite, contracheque, declaração de renda, DECORE
- cartao_cnpj_mei: cartão CNPJ ou certificado MEI da Receita Federal
- craf: Certificado de Registro de Acervo de Armas (CRAF) ou SINARM
- gte: Guia de Tráfego do Exército (GTE) ou Guia de Transferência (GT)
- nota_fiscal_arma: nota fiscal de compra de arma de fogo
- gov_br: print de tela do portal GOV.BR mostrando login/senha
- outro: não se encaixa em nenhuma categoria acima

REGRAS: Só extraia dados visíveis. Se ilegível, marque legivel=false e confianca abaixo de 0.3.`;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "classificar_documento",
    description: "Classifica o tipo do documento e extrai campos principais.",
    parameters: {
      type: "object",
      properties: {
        tipo_detectado: {
          type: "string",
          enum: TIPOS_VALIDOS,
          description: "Tipo do documento. Use 'outro' se não se encaixar.",
        },
        confianca: {
          type: "number",
          description: "Confiança 0..1 na classificação.",
        },
        motivo: {
          type: "string",
          description: "Justificativa curta da classificação em português.",
        },
        legivel: {
          type: "boolean",
          description: "O documento está legível para extração?",
        },
        campos_extraidos: {
          type: "object",
          description: "Campos relevantes extraídos.",
          properties: {
            nome_titular: { type: "string" },
            cpf: { type: "string" },
            numero_documento: { type: "string" },
            data_emissao: { type: "string" },
            data_validade: { type: "string" },
            orgao_emissor: { type: "string" },
            resultado: { type: "string" },
            endereco: { type: "string" },
            cidade: { type: "string" },
            estado: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["tipo_detectado", "confianca", "motivo", "legivel", "campos_extraidos"],
      additionalProperties: false,
    },
  },
};

async function classificarArquivo(
  dataUrl: string,
  mime: string,
  nome: string,
  apiKey: string,
) {
  const model = mime === "application/pdf"
    ? "google/gemini-2.5-pro"
    : "google/gemini-2.5-flash";

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Classifique este documento. Nome do arquivo: "${nome}".` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [TOOL_DEF],
      tool_choice: { type: "function", function: { name: "classificar_documento" } },
      max_tokens: 512,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.status.toString());
    throw new Error(`gateway_${resp.status}: ${errText.slice(0, 100)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    return { tipo_detectado: "outro", confianca: 0, motivo: "Sem resposta da IA", legivel: false, campos_extraidos: {} };
  }

  const parsed = JSON.parse(call.function.arguments);
  return {
    tipo_detectado: TIPOS_VALIDOS.includes(parsed.tipo_detectado) ? parsed.tipo_detectado : "outro",
    confianca: typeof parsed.confianca === "number" ? Math.min(1, Math.max(0, parsed.confianca)) : 0.5,
    motivo: parsed.motivo || "",
    legivel: parsed.legivel !== false,
    campos_extraidos: parsed.campos_extraidos || {},
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const body = await req.json();
    const arquivos: Array<{ nome: string; mime: string; data_url: string }> = body?.arquivos ?? [];

    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      return json({ error: "Envie ao menos 1 arquivo em arquivos[]" }, 400);
    }

    const CONCURRENCY = 4;
    const resultados: unknown[] = new Array(arquivos.length).fill(null);

    for (let i = 0; i < arquivos.length; i += CONCURRENCY) {
      const lote = arquivos.slice(i, i + CONCURRENCY);
      const loteRes = await Promise.all(
        lote.map((arq) =>
          classificarArquivo(arq.data_url, arq.mime, arq.nome, apiKey)
            .catch((e: Error) => ({ tipo_detectado: "outro", confianca: 0, motivo: "", legivel: false, campos_extraidos: {}, erro: e.message }))
        ),
      );
      loteRes.forEach((r, j) => { resultados[i + j] = { nome: arquivos[i + j].nome, ...r }; });
    }

    return json({ success: true, resultados });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[qa-adesao-classificar-docs]", msg);
    return json({ error: msg }, 500);
  }
});
