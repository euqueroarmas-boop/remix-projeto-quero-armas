// Edge Function: qa-extract-documents
// OCR/Vision extraction of identity document and proof of address using Lovable AI (Gemini 2.5 Flash).
// Public endpoint — no auth required (verify_jwt = false in config.toml by default for Lovable).

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

const ID_TOOL = {
  type: "function",
  function: {
    name: "extract_identity",
    description:
      "Extrai dados estruturados de um documento oficial de identificação brasileiro (RG, CNH, CIN, Passaporte). " +
      "Regras CRÍTICAS: (1) o número do CPF SEMPRE tem 11 dígitos e é distinto do RG. " +
      "(2) o RG tem formato variável (números, dígito verificador X) e nunca deve ser copiado para o campo CPF. " +
      "(3) se houver dúvida sobre qual número é CPF e qual é RG, NÃO PREENCHA cpf nem rg — preencha cpf_candidato/rg_candidato com os números encontrados e marque needs_confirmation=true.",
    parameters: {
      type: "object",
      properties: {
        nome_completo: { type: "string", description: "Nome completo conforme aparece no documento" },
        cpf: { type: "string", description: "Apenas números, EXATAMENTE 11 dígitos. Só preencha se tiver certeza absoluta de que é o CPF (não o RG)." },
        rg: { type: "string", description: "Número do Registro Geral. NUNCA copie o CPF aqui. Pode conter dígito verificador X." },
        cpf_confidence: { type: "number", description: "Confiança 0..1 de que o valor em cpf é realmente o CPF" },
        rg_confidence: { type: "number", description: "Confiança 0..1 de que o valor em rg é realmente o RG" },
        cpf_candidato: { type: "array", items: { type: "string" }, description: "Candidatos a CPF (11 dígitos) quando há ambiguidade" },
        rg_candidato: { type: "array", items: { type: "string" }, description: "Candidatos a RG quando há ambiguidade" },
        needs_confirmation: { type: "boolean", description: "true quando não foi possível separar CPF e RG com segurança" },
        confirmation_reason: { type: "string", description: "Motivo curto, em PT-BR, do porquê precisa confirmação" },
        emissor_rg: { type: "string", description: "Órgão expedidor (ex: SSP, DETRAN)" },
        uf_emissor_rg: { type: "string", description: "UF do órgão emissor (2 letras)" },
        data_expedicao_rg: { type: "string", description: "Data de expedição do RG no formato DD/MM/AAAA" },
        data_nascimento: { type: "string", description: "Formato DD/MM/AAAA" },
        sexo: { type: "string", description: "M, F ou texto exato como aparece" },
        nome_mae: { type: "string" },
        nome_pai: { type: "string" },
        naturalidade: { type: "string", description: "Texto bruto da naturalidade (ex: 'São Paulo/SP')" },
        naturalidade_municipio: { type: "string", description: "Apenas o município de nascimento" },
        naturalidade_uf: { type: "string", description: "UF de nascimento (2 letras)" },
        naturalidade_pais: { type: "string", description: "País de nascimento, se houver" },
        titulo_eleitor: { type: "string" },
        cnh: { type: "string", description: "Número do registro CNH se aplicável" },
        ctps: { type: "string" },
        pis_pasep: { type: "string" },
        estado_civil: { type: "string" },
        tipo_documento: { type: "string", enum: ["RG", "CNH", "CIN", "PASSAPORTE", "OUTRO"] },
      },
      required: ["tipo_documento"],
      additionalProperties: false,
    },
  },
};

const ADDRESS_TOOL = {
  type: "function",
  function: {
    name: "extract_address",
    description: "Extrai endereço estruturado de um comprovante de residência brasileiro (conta de luz, água, telefone, etc.).",
    parameters: {
      type: "object",
      properties: {
        cep: { type: "string", description: "Apenas números, 8 dígitos" },
        logradouro: { type: "string", description: "Rua, Avenida, etc. (sem número)" },
        numero: { type: "string" },
        complemento: { type: "string", description: "Apto, Bloco, Casa, Sala, etc." },
        bairro: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", description: "UF, 2 letras" },
        titular_nome: { type: "string", description: "Nome do titular da conta/comprovante" },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

async function callVision(imageDataUrl: string, tool: any, systemPrompt: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados do documento desta imagem. Use APENAS dados visíveis. Se um campo não estiver legível, omita-o." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });

  if (resp.status === 429) {
    throw new Error("RATE_LIMIT");
  }
  if (resp.status === 402) {
    throw new Error("PAYMENT_REQUIRED");
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[ai-gateway]", resp.status, t);
    throw new Error(`AI_GATEWAY_${resp.status}`);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { identity_image, address_image } = body || {};

    if (!identity_image && !address_image) {
      return json({ error: "Envie pelo menos uma imagem (identity_image ou address_image)" }, 400);
    }

    const tasks: Promise<any>[] = [];
    tasks.push(
      identity_image
        ? callVision(
            identity_image,
            ID_TOOL,
          [
            "Você é um extrator forense de dados de documentos brasileiros (RG, CNH, CIN, Passaporte).",
            "REGRAS OBRIGATÓRIAS:",
            "1) Extraia APENAS o que está visível e legível na imagem. Nunca invente dados.",
            "2) CPF e RG são campos DISTINTOS. CPF tem exatamente 11 dígitos numéricos. NUNCA copie o RG para o campo CPF.",
            "3) Se um documento estrangeiro disser 'Personal Number' separado do CPF, mantenha-os separados.",
            "4) Se você encontrar um único número de identificação e não puder determinar com segurança se é CPF ou RG, NÃO preencha cpf nem rg. Em vez disso preencha cpf_candidato e/ou rg_candidato com os números encontrados e marque needs_confirmation=true com confirmation_reason explicando.",
            "5) Para cada campo cpf e rg preenchido, retorne também cpf_confidence/rg_confidence (0..1). Se a confiança for menor que 0.7, prefira retornar como candidato e marcar needs_confirmation=true.",
            "6) Datas sempre em DD/MM/AAAA. Sexo apenas M ou F quando claro.",
          ].join("\n"),
          ).catch((e) => ({ __error: String(e?.message || e) }))
        : Promise.resolve(null),
    );
    tasks.push(
      address_image
        ? callVision(
            address_image,
            ADDRESS_TOOL,
            "Você é um extrator de endereços de comprovantes de residência brasileiros (contas de luz, água, telefone, banco). Extraia APENAS o que está visível.",
          ).catch((e) => ({ __error: String(e?.message || e) }))
        : Promise.resolve(null),
    );

    const [idResult, addrResult] = await Promise.all(tasks);

    const errors: string[] = [];
    if (idResult?.__error) errors.push(`identidade: ${idResult.__error}`);
    if (addrResult?.__error) errors.push(`endereço: ${addrResult.__error}`);

    // Surface specific errors
    if (errors.some((e) => e.includes("RATE_LIMIT"))) {
      return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
    }
    if (errors.some((e) => e.includes("PAYMENT_REQUIRED"))) {
      return json({ error: "Créditos de IA esgotados. Contate o administrador." }, 402);
    }

    return json({
      success: true,
      identity: idResult?.__error ? null : idResult,
      address: addrResult?.__error ? null : addrResult,
      partial_errors: errors.length ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[qa-extract-documents]", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
