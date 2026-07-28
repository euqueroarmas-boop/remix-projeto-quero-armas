// Edge Function: qa-adesao-classificar-docs
// Classifica automaticamente documentos enviados na Central de Adesão (pré-piloto).
// Recebe uma lista de arquivos em base64 e retorna o tipo detectado pela IA,
// campos extraídos e score de confiança para cada arquivo.
// Modelos: Gemini 2.5 Flash (imagens) e Gemini 2.5 Pro (PDFs).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Tipos reconhecidos pelo sistema — espelha TIPO_LABELS do front
const TIPOS_VALIDOS = [
  "cin",                            // CIN / RG / CNH — documento de identidade
  "comprovante_residencia",
  "laudo_psicologico",
  "laudo_capacidade_tecnica",
  "antecedentes_criminais",         // certidão estadual
  "certidao_antecedentes_criminais_federal",
  "comprovante_renda",
  "cartao_cnpj_mei",
  "craf",
  "gte",
  "nota_fiscal_arma",
  "gov_br",                         // print/foto da senha GOV.BR
  "outro",
] as const;

type TipoDoc = typeof TIPOS_VALIDOS[number];

const TIPO_LABELS_PT: Record<TipoDoc, string> = {
  cin: "CIN / RG / CNH",
  comprovante_residencia: "Comprovante de Residência",
  laudo_psicologico: "Laudo Psicológico",
  laudo_capacidade_tecnica: "Laudo de Capacidade Técnica",
  antecedentes_criminais: "Certidão de Antecedentes (estadual)",
  certidao_antecedentes_criminais_federal: "Certidão de Antecedentes (federal)",
  comprovante_renda: "Comprovante de Renda",
  cartao_cnpj_mei: "Cartão CNPJ / MEI",
  craf: "CRAF / SINARM",
  gte: "GTE / GT",
  nota_fiscal_arma: "Nota Fiscal de Arma",
  gov_br: "Print GOV.BR (senha)",
  outro: "Outro",
};

const CLASSIFICATION_TOOL = {
  type: "function",
  function: {
    name: "classificar_documento",
    description:
      "Analisa a imagem ou PDF de um documento brasileiro e retorna o tipo mais provável, " +
      "campos extraídos e score de confiança.",
    parameters: {
      type: "object",
      properties: {
        tipo_detectado: {
          type: "string",
          enum: TIPOS_VALIDOS as unknown as string[],
          description:
            "Tipo do documento detectado. Use 'outro' apenas se não se encaixar em nenhuma categoria.",
        },
        confianca: {
          type: "number",
          description: "Score de confiança 0..1 na classificação do tipo.",
        },
        motivo: {
          type: "string",
          description:
            "Justificativa curta (1-2 frases) da classificação. Em português.",
        },
        legivel: {
          type: "boolean",
          description: "O documento está legível o suficiente para extração?",
        },
        campos_extraidos: {
          type: "object",
          description: "Campos relevantes extraídos do documento (nome, número, datas, etc.)",
          properties: {
            nome_titular: { type: "string" },
            cpf: { type: "string", description: "11 dígitos numéricos apenas" },
            rg: { type: "string" },
            numero_documento: { type: "string" },
            data_emissao: { type: "string", description: "DD/MM/AAAA" },
            data_validade: { type: "string", description: "DD/MM/AAAA" },
            orgao_emissor: { type: "string" },
            resultado: {
              type: "string",
              description: "Para laudos/certidões: APTO, INAPTO, NADA CONSTA, etc.",
            },
            cep: { type: "string" },
            endereco: { type: "string" },
            cidade: { type: "string" },
            estado: { type: "string", description: "UF 2 letras" },
          },
          additionalProperties: false,
        },
      },
      required: ["tipo_detectado", "confianca", "motivo", "legivel", "campos_extraidos"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Você é um classificador especialista de documentos para o processo de aquisição de armas de fogo no Brasil (CAC — Colecionador, Atirador e Caçador).

Analise o documento fornecido e:
1. Identifique o tipo exato entre as categorias disponíveis
2. Extraia os campos relevantes que conseguir ler
3. Atribua um score de confiança honesto (0..1)

TIPOS POSSÍVEIS e como identificá-los:
- cin: RG, CNH, CIN (Carteira de Identidade Nacional gov.br), passaporte. Tem foto, nome completo, CPF ou RG.
- comprovante_residencia: conta de luz, água, gás, telefone, IPTU, correspondência bancária com endereço.
- laudo_psicologico: laudo emitido por psicólogo, com CRP, carimbo, resultado APTO/INAPTO, data da avaliação.
- laudo_capacidade_tecnica: laudo de capacidade técnica para atirador/colecionador, emitido por instrutor/entidade de tiro.
- antecedentes_criminais: certidão estadual de antecedentes criminais (SSP, TJSP, TJ etc), geralmente diz "NADA CONSTA" ou lista ocorrências.
- certidao_antecedentes_criminais_federal: certidão da Justiça Federal, DPF ou TSE de antecedentes.
- comprovante_renda: holerite, contracheque, declaração de renda, extrato bancário com salário, DECORE.
- cartao_cnpj_mei: cartão do CNPJ ou certificado MEI emitido pela Receita Federal.
- craf: Certificado de Registro de Acervo de Armas e Fogos (CRAF) ou consulta SINARM.
- gte: Guia de Tráfego do Exército (GTE) ou Guia de Transferência (GT).
- nota_fiscal_arma: nota fiscal eletrônica (NF-e) de compra de arma de fogo.
- gov_br: print de tela ou foto do portal GOV.BR mostrando login/senha ou dados de acesso.
- outro: qualquer documento que não se encaixe nas categorias acima.

REGRAS:
- Nunca invente dados. Só extraia o que está visível.
- Se ilegível, marque legivel=false e confianca <= 0.3.
- Para CPF: exatamente 11 dígitos, diferente do RG.`;

async function classificarArquivo(
  dataUrl: string,
  mime: string,
  nome: string,
  apiKey: string,
): Promise<{
  tipo_detectado: TipoDoc;
  confianca: number;
  motivo: string;
  legivel: boolean;
  campos_extraidos: Record<string, string | undefined>;
  erro?: string;
}> {
  // PDFs usam modelo mais pesado para melhor leitura
  const model = mime === "application/pdf"
    ? "google/gemini-2.5-pro"
    : "google/gemini-2.5-flash";

  try {
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
              {
                type: "text",
                text: `Classifique e extraia dados deste documento. Nome do arquivo: "${nome}". Analise a imagem/PDF abaixo.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [CLASSIFICATION_TOOL],
        tool_choice: { type: "function", function: { name: "classificar_documento" } },
        max_tokens: 1024,
      }),
    });

    if (resp.status === 429) return fallback("outro", "Limite de requisições atingido.");
    if (resp.status === 402) return fallback("outro", "Créditos de IA esgotados.");
    if (!resp.ok) return fallback("outro", `Erro IA: ${resp.status}`);

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return fallback("outro", "IA não retornou resultado.");

    const parsed = JSON.parse(call.function.arguments);
    return {
      tipo_detectado: TIPOS_VALIDOS.includes(parsed.tipo_detectado) ? parsed.tipo_detectado : "outro",
      confianca: typeof parsed.confianca === "number" ? Math.min(1, Math.max(0, parsed.confianca)) : 0.5,
      motivo: parsed.motivo || "",
      legivel: parsed.legivel !== false,
      campos_extraidos: parsed.campos_extraidos || {},
    };
  } catch (e: any) {
    return fallback("outro", e?.message || "Erro desconhecido");
  }
}

function fallback(tipo: TipoDoc, erro: string) {
  return {
    tipo_detectado: tipo,
    confianca: 0,
    motivo: "",
    legivel: false,
    campos_extraidos: {},
    erro,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const body = await req.json();
    const { arquivos } = body as {
      arquivos: Array<{ nome: string; mime: string; data_url: string }>;
    };

    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      return json({ error: "Envie ao menos 1 arquivo em arquivos[]" }, 400);
    }

    if (arquivos.length > 30) {
      return json({ error: "Máximo de 30 arquivos por chamada" }, 400);
    }

    // Processa todos em paralelo (com limite de concorrência de 6)
    const CONCURRENCY = 6;
    const resultados: any[] = new Array(arquivos.length);
    for (let i = 0; i < arquivos.length; i += CONCURRENCY) {
      const lote = arquivos.slice(i, i + CONCURRENCY);
      const loteResultados = await Promise.all(
        lote.map((arq) =>
          classificarArquivo(arq.data_url, arq.mime, arq.nome, apiKey)
        ),
      );
      loteResultados.forEach((r, j) => {
        resultados[i + j] = { nome: arquivos[i + j].nome, ...r };
      });
    }

    return json({ success: true, resultados, tipo_labels: TIPO_LABELS_PT });
  } catch (err: any) {
    console.error("[qa-adesao-classificar-docs]", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
