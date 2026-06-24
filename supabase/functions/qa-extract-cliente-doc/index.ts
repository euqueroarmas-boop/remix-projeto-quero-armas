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

const TIPOS_VALIDOS = [
  "cr",
  "craf",
  "sinarm",
  "gt",
  "gte",
  "autorizacao_compra",
  "laudo_psicologico",
  "exame_psicologico",
  "laudo_psicotecnico",
  "exame_tiro",
  "capacidade_tecnica",
  "outro",
] as const;
type TipoDoc = typeof TIPOS_VALIDOS[number];

function buildTool(tipo: TipoDoc) {
  const baseProps: Record<string, unknown> = {
    titulo_oficial: {
      type: "string",
      description:
        "TÍTULO OFICIAL LITERAL DO DOCUMENTO, exatamente como impresso no cabeçalho/topo do PDF " +
        "(ex.: 'CERTIDÃO DE DISTRIBUIÇÃO CRIMINAL — JUSTIÇA FEDERAL DE 1ª INSTÂNCIA — SP', " +
        "'CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS — EXECUÇÕES CRIMINAIS', " +
        "'CERTIDÃO DE QUITAÇÃO ELEITORAL', 'LAUDO PSICOLÓGICO PARA REGISTRO DE ARMA DE FOGO'). " +
        "Sempre em UPPERCASE, sem acrescentar texto que não esteja no documento. " +
        "NUNCA invente o nome — se não estiver legível, deixe vazio.",
    },
    numero_documento: { type: "string", description: "Número, código ou identificador do documento (ex: número do CR, CRAF, GT, AC)." },
    orgao_emissor: { type: "string", description: "Órgão emissor (ex: Exército Brasileiro, Polícia Federal, SR/PF/UF, R-MIL/CMA)." },
    data_emissao: { type: "string", description: "Data de emissão no formato DD/MM/AAAA." },
    data_validade: { type: "string", description: "Data de validade/vencimento no formato DD/MM/AAAA." },
    observacoes: { type: "string", description: "Notas relevantes (categoria, restrições, finalidade)." },
  };

  const laudoProps: Record<string, unknown> = {
    data_avaliacao: {
      type: "string",
      description:
        "Data em que a AVALIAÇÃO/EXAME foi REALIZADA pelo profissional (não confundir com data de emissão do laudo). Formato DD/MM/AAAA. " +
        "Procure por termos como 'data da avaliação', 'data do exame', 'avaliado em', 'realizado em', 'data de aplicação', 'sessão em'. " +
        "Este é o campo MAIS IMPORTANTE em laudos psicológicos — a validade é sempre 1 ano após esta data.",
    },
  };

  const armaProps: Record<string, unknown> = {
    arma_marca: { type: "string", description: "Marca/fabricante (ex: Taurus, Glock, CBC, IMBEL)." },
    arma_modelo: {
      type: "string",
      description:
        "Modelo COMERCIAL/TÉCNICO da arma (ex: G2C, PT838, 1911, G25, TS9, TX22, PUMP MILITARY 3.0). " +
        "PROIBIDO preencher com número de série, número de registro, número de CRAF, número de SINARM, " +
        "número de SIGMA, protocolo, ou qualquer valor apenas numérico. Se houver dúvida entre número e modelo, " +
        "DEIXE VAZIO — não invente e nunca use número como modelo.",
    },
    arma_calibre: { type: "string", description: "Calibre (ex: .380 ACP, 9mm, .40 S&W, .38 SPL)." },
    arma_numero_serie: { type: "string", description: "Número de série da arma." },
    arma_especie: { type: "string", description: "Espécie/tipo (Pistola, Revólver, Carabina, Espingarda, Fuzil)." },
  };

  const isLaudo =
    tipo === "laudo_psicologico" ||
    tipo === "exame_psicologico" ||
    tipo === "laudo_psicotecnico" ||
    tipo === "exame_tiro" ||
    tipo === "capacidade_tecnica";
  const includeArma = !isLaudo && tipo !== "cr";
  let properties: Record<string, unknown> = { ...baseProps };
  if (includeArma) properties = { ...properties, ...armaProps };
  if (isLaudo) properties = { ...properties, ...laudoProps };

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
    laudo_psicologico:
      "Você é especialista em LAUDOS PSICOLÓGICOS para concessão/renovação de registro de arma de fogo (Lei 10.826/03). " +
      "REGRA CRÍTICA DE VALIDADE: laudos psicológicos têm validade de EXATAMENTE 1 ANO contado a partir da DATA DA AVALIAÇÃO " +
        "(quando o psicólogo aplicou os testes/entrevistou o avaliado), NUNCA a partir da data de emissão/assinatura do laudo. " +
        "Sempre extraia 'data_avaliacao' do corpo do laudo (geralmente referenciada como 'data da avaliação', 'avaliado em', " +
        "'realizado em', 'data de aplicação dos testes'). " +
      "EXEMPLO DE TREINAMENTO: avaliação realizada em 03/03/2025 → data_avaliacao=03/03/2025 e data_validade=03/03/2026. " +
      "Em 'orgao_emissor' coloque o nome do(a) psicólogo(a) com registro CRP. " +
      "Em 'numero_documento' coloque o número do CRP do profissional.",
    exame_psicologico:
      "Você é especialista em EXAMES PSICOLÓGICOS para registro de arma (Lei 10.826/03). Validade = data da avaliação + 1 ano.",
    laudo_psicotecnico:
      "Você é especialista em LAUDOS PSICOTÉCNICOS para registro de arma (Lei 10.826/03). Validade = data da avaliação + 1 ano.",
    exame_tiro:
      "Você é especialista em EXAMES DE CAPACIDADE TÉCNICA / EXAMES DE TIRO para concessão/renovação de registro de arma de fogo (Lei 10.826/03). " +
      "REGRA CRÍTICA DE VALIDADE: o exame de tiro / capacidade técnica tem validade de EXATAMENTE 1 ANO contado a partir da DATA DA AVALIAÇÃO " +
        "(quando o avaliado efetivamente realizou o teste prático de tiro no estande), NUNCA a partir da data de emissão/assinatura do laudo. " +
      "Sempre extraia 'data_avaliacao' procurando por termos como 'data da avaliação', 'data do exame', 'avaliado em', " +
        "'realizado em', 'data do teste prático', 'data da prova de tiro', 'realizado no dia'. " +
      "EXEMPLO DE TREINAMENTO: avaliação realizada em 03/03/2025 → data_avaliacao=03/03/2025 e data_validade=03/03/2026. " +
      "Em 'orgao_emissor' coloque o nome do instrutor de tiro responsável (com credencial PF/EB) ou o clube/estande. " +
      "Em 'numero_documento' coloque o número do credenciamento do instrutor (CR/PF) quando disponível.",
    capacidade_tecnica:
      "Você é especialista em LAUDOS DE CAPACIDADE TÉCNICA para registro de arma (Lei 10.826/03). Validade = data da avaliação + 1 ano.",
    outro: "Você é especialista em documentos SIGMA/SINARM. Extraia todos os dados estruturados que conseguir identificar.",
  };
  return (
    `${map[tipo]} Responda exclusivamente chamando a função extrair_documento_cac. ` +
    `Use null/vazio para campos não encontrados. Datas no formato DD/MM/AAAA. ` +
    `REGRA CRÍTICA SOBRE arma_modelo: o campo arma_modelo deve conter SOMENTE o modelo comercial da arma ` +
    `(ex: G25, TS9, TX22, PT838, PUMP MILITARY 3.0). É TERMINANTEMENTE PROIBIDO colocar em arma_modelo: ` +
    `número de série, número de registro, número de CRAF, número de SINARM, número de SIGMA, protocolo, ` +
    `ou qualquer valor puramente numérico. Esses números têm campos próprios: numero_documento, arma_numero_serie. ` +
    `Se você não tiver certeza absoluta do modelo, deixe arma_modelo vazio.`
  );
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

/**
 * Defesa server-side: o campo arma_modelo NUNCA pode receber número de
 * documento/registro/CRAF/SINARM/SIGMA/protocolo. Se a IA insistir em devolver
 * algo numérico, descartamos para que o cadastro fique pendente de revisão.
 */
function sanitizeArmaModelo(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (v.length < 2) return null;
  if (/^[0-9.\-\/\s]+$/.test(v)) return null;
  if (/^(CRAF|SINARM|SIGMA|REGISTRO|DOCUMENTO|PROTOCOLO|ARMA)$/i.test(v)) return null;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tipoRaw = String(body?.tipo_documento || "outro").toLowerCase();
    // Tipos desconhecidos (ex: laudo_psicologico, exame_tiro, comprovante_residencia,
    // certidões) caem em "outro" para extração genérica em vez de quebrar o fluxo.
    const tipo = (TIPOS_VALIDOS as readonly string[]).includes(tipoRaw)
      ? (tipoRaw as TipoDoc)
      : ("outro" as TipoDoc);
    const imageDataUrl = String(body?.imageDataUrl || "");

    if (!imageDataUrl.startsWith("data:")) {
      return json({ error: "imageDataUrl deve ser uma data URL (data:image/... ou data:application/pdf)" }, 400);
    }

    const raw = await callVision(imageDataUrl, tipo);

    // Laudo psicológico: validade = data_avaliacao + 1 ano (regra legal Lei 10.826/03).
    // Sobrescreve qualquer data_validade que a IA tenha tentado inferir errado.
    const isLaudo =
      tipo === "laudo_psicologico" ||
      tipo === "exame_psicologico" ||
      tipo === "laudo_psicotecnico" ||
      tipo === "exame_tiro" ||
      tipo === "capacidade_tecnica";
    let dataValidadeISO = ddmmaaaaToISO(raw.data_validade);
    const dataAvaliacaoISO = ddmmaaaaToISO(raw.data_avaliacao);
    if (isLaudo && dataAvaliacaoISO) {
      const [y, m, d] = dataAvaliacaoISO.split("-").map(Number);
      const venc = new Date(Date.UTC(y + 1, m - 1, d));
      dataValidadeISO = venc.toISOString().slice(0, 10);
    }

    const sugestao = {
      numero_documento: raw.numero_documento || null,
      orgao_emissor: raw.orgao_emissor || null,
      data_emissao: ddmmaaaaToISO(raw.data_emissao),
      data_avaliacao: dataAvaliacaoISO,
      data_validade: dataValidadeISO,
      observacoes: raw.observacoes || null,
      arma_marca: raw.arma_marca || null,
      arma_modelo: sanitizeArmaModelo(raw.arma_modelo),
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