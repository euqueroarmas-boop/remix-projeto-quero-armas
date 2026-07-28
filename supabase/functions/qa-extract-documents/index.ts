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

// ─── Modo de teste interno (preview/dev) ─────────────────────────────────
// Permite chamar a função sem precisar fazer upload via <input type="file">,
// usando um arquivo já presente no bucket privado `qa-cadastro-selfies`
// (identity_storage_path / address_storage_path) OU enviando bytes em base64
// puro (identity_b64 / address_b64). Em AMBOS os casos é obrigatório o
// header `x-internal-token` igual ao secret INTERNAL_FUNCTION_TOKEN, para
// não expor essa rota em produção.
async function fetchStorageAsDataUrl(path: string): Promise<string> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("STORAGE_ENV_MISSING");
  const url = `${SUPABASE_URL}/storage/v1/object/qa-cadastro-selfies/${path.replace(/^\/+/, "")}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
  if (!r.ok) throw new Error(`STORAGE_${r.status}`);
  const ct = r.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  // base64 sem dependências externas
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  return `data:${ct};base64,${b64}`;
}

function bytesToDataUrl(b64: string, mime = "image/jpeg"): string {
  // aceita data URL completo OU base64 puro
  if (b64.startsWith("data:")) return b64;
  return `data:${mime};base64,${b64}`;
}

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

// ─── MODO CLASSIFY (Central de Adesão) ──────────────────────────────────────
const CLASSIFY_TIPOS = [
  "cin","comprovante_residencia","laudo_psicologico","laudo_capacidade_tecnica",
  "antecedentes_criminais","certidao_antecedentes_criminais_federal",
  "comprovante_pagamento","ocupacao_licita","comprovante_renda","cartao_cnpj_mei",
  "craf","gte","nota_fiscal_arma","gov_br","outro",
];

const CLASSIFY_TOOL = {
  type: "function",
  function: {
    name: "classificar_documento",
    description: "Classifica o tipo do documento e extrai campos principais.",
    parameters: {
      type: "object",
      properties: {
        tipo_detectado: { type: "string", enum: CLASSIFY_TIPOS, description: "Tipo do documento. Prefira ocupacao_licita para documentos de renda/trabalho/empresa." },
        confianca: { type: "number" },
        motivo: { type: "string" },
        legivel: { type: "boolean" },
        campos_extraidos: {
          type: "object",
          properties: {
            nome_titular: { type: "string" },
            cpf: { type: "string" },
            numero_documento: { type: "string" },
            data_emissao: { type: "string" },
            data_validade: { type: "string" },
            orgao_emissor: { type: "string" },
            resultado: { type: "string" },
            endereco: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["tipo_detectado","confianca","motivo","legivel","campos_extraidos"],
      additionalProperties: false,
    },
  },
};

const CLASSIFY_SYSTEM = `Classifique o documento entre os tipos:
- cin: RG, CNH, CIN, passaporte — documento de identidade com foto
- comprovante_residencia: conta de luz, água, gás, telefone, IPTU, correspondência bancária com endereço
- laudo_psicologico: laudo de psicólogo com CRP, resultado APTO/INAPTO
- laudo_capacidade_tecnica: laudo de capacidade técnica de atirador/instrutor de tiro
- antecedentes_criminais: certidão estadual de antecedentes (SSP, TJ estadual)
- certidao_antecedentes_criminais_federal: certidão federal (Justiça Federal, DPF, TSE)
- comprovante_pagamento: comprovante de transação bancária — PIX, TED, DOC, comprovante de pagamento com cartão de débito/crédito. Para ser comprovante_pagamento o destinatário/beneficiário deve ser "Willian Rodrigues da Silva Massaroto" OU "Senhor das Armas Comercio de Armas e Municoes Ltda" (ou variações). ATENÇÃO: fatura de cartão de crédito NÃO é comprovante_pagamento nem comprovante_residencia — classificar como outro. Extrato bancário genérico sem destinatário identificado = outro.
- ocupacao_licita: QUALQUER documento que comprove ocupação lícita ou fonte de renda — inclui: holerite, contracheque, carteira de trabalho (CTPS), extrato CNIS, histórico de crédito, contrato social, requerimento de empresário, cartão CNPJ, certificado MEI (CCMEI), QSA (Quadro de Sócios e Administradores), nota fiscal de serviço/produto (exceto de arma), DECORE, declaração de renda
- comprovante_renda: use SOMENTE se for um documento genérico de renda que não se encaixe em ocupacao_licita
- cartao_cnpj_mei: use SOMENTE se for cartão CNPJ/MEI sem outros elementos de ocupacao_licita
- craf: Certificado de Registro de Acervo de Armas (CRAF) ou SINARM
- gte: Guia de Tráfego do Exército (GTE) ou Guia de Transferência (GT)
- nota_fiscal_arma: nota fiscal de COMPRA DE ARMA DE FOGO especificamente
- gov_br: print de tela do portal GOV.BR mostrando login/senha
- outro: não se encaixa em nenhuma categoria acima
REGRA: Prefira sempre ocupacao_licita para documentos de renda/trabalho/empresa. Extraia só dados visíveis.`;

async function classificarUmArquivo(dataUrl: string, mime: string, nome: string, apiKey: string) {
  const model = mime === "application/pdf" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user", content: [
          { type: "text", text: `Classifique este documento. Nome: "${nome}".` },
          { type: "image_url", image_url: { url: dataUrl } },
        ]},
      ],
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "function", function: { name: "classificar_documento" } },
      max_tokens: 512,
    }),
  });
  if (!resp.ok) throw new Error(`gateway_${resp.status}`);
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  // Sem tool call = a IA não conseguiu ler o documento. É FALHA, não classificação
  // "outro" — marca com erro para o frontend preservar o tipo já inferido pelo nome.
  if (!call?.function?.arguments) {
    return { tipo_detectado: "outro", confianca: 0, motivo: "", legivel: false, campos_extraidos: {}, erro: "sem_resposta_ia" };
  }
  const parsed = JSON.parse(call.function.arguments);
  return {
    tipo_detectado: CLASSIFY_TIPOS.includes(parsed.tipo_detectado) ? parsed.tipo_detectado : "outro",
    confianca: typeof parsed.confianca === "number" ? Math.min(1, Math.max(0, parsed.confianca)) : 0.5,
    motivo: parsed.motivo || "",
    legivel: parsed.legivel !== false,
    campos_extraidos: parsed.campos_extraidos || {},
  };
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Modo classify: chamado pela Central de Adesão
    if (body?.mode === "classify") {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
      const arquivos: Array<{ nome: string; mime: string; data_url: string }> =
        Array.isArray(body?.arquivos) ? body.arquivos : [];
      if (arquivos.length === 0) {
        return json({ success: true, resultados: [] });
      }
      const resultados: any[] = new Array(arquivos.length).fill(null);
      const CONC = 4;
      for (let i = 0; i < arquivos.length; i += CONC) {
        const lote = arquivos.slice(i, i + CONC);
        const loteRes = await Promise.all(
          lote.map((a) =>
            classificarUmArquivo(a.data_url, a.mime, a.nome, apiKey)
              .catch((e: any) => ({ tipo_detectado: "outro", confianca: 0, motivo: "", legivel: false, campos_extraidos: {}, erro: String(e?.message || e) }))
          )
        );
        loteRes.forEach((r, j) => { resultados[i + j] = { nome: arquivos[i + j].nome, ...r }; });
      }
      return json({ success: true, resultados });
    }

    let { identity_image, address_image } = body || {};
    const {
      identity_storage_path,
      address_storage_path,
      identity_b64,
      address_b64,
      identity_mime,
      address_mime,
    } = body || {};

    // Modo interno: storage_path / b64 só com token válido
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    const providedToken = req.headers.get("x-internal-token");
    const wantsInternal =
      !!(identity_storage_path || address_storage_path || identity_b64 || address_b64);
    if (wantsInternal) {
      if (!internalToken || providedToken !== internalToken) {
        return json({ error: "internal_mode_forbidden" }, 403);
      }
      try {
        if (!identity_image && identity_storage_path) {
          identity_image = await fetchStorageAsDataUrl(String(identity_storage_path));
        }
        if (!address_image && address_storage_path) {
          address_image = await fetchStorageAsDataUrl(String(address_storage_path));
        }
      } catch (e: any) {
        return json({ error: `storage_fetch_failed: ${e?.message || e}` }, 502);
      }
      if (!identity_image && identity_b64) {
        identity_image = bytesToDataUrl(String(identity_b64), identity_mime || "image/jpeg");
      }
      if (!address_image && address_b64) {
        address_image = bytesToDataUrl(String(address_b64), address_mime || "image/jpeg");
      }
    }

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
            "7) REGRA ESPECIAL CIN (Carteira de Identidade Nacional gov.br): na CIN o número impresso ao lado de 'Registro Geral' / 'CPF' / 'Personal Number' é o PRÓPRIO CPF do cidadão (11 dígitos), e NÃO um RG estadual tradicional. Quando tipo_documento = 'CIN':",
            "   a) Se houver APENAS um número de identificação principal (11 dígitos), trate-o como CPF E como possível RG ao mesmo tempo: NÃO preencha o campo `rg` silenciosamente. Em vez disso, preencha cpf com esse número (com cpf_confidence ~ 0.9) E adicione o MESMO número em rg_candidato. Marque needs_confirmation=true e em confirmation_reason explique: 'Documento é CIN gov.br: o número exibido como Registro Geral é o próprio CPF (identificador nacional unificado). Confirme manualmente se deseja usar este número também como RG.'",
            "   b) Só preencha o campo `rg` da CIN se houver, ALÉM do CPF, um segundo número claramente rotulado como RG estadual antigo (com órgão expedidor estadual diferente do RIC/CIN).",
            "   c) Em CIN, emissor_rg/uf_emissor_rg só devem ser preenchidos se você visualizar EXPLICITAMENTE no documento (ex.: 'IIRGD/SP'); caso contrário deixe vazio.",
            "7.1) INFERÊNCIA DE UF DO ÓRGÃO EMISSOR: sempre que `emissor_rg` for preenchido (RG ou CNH), tente também preencher `uf_emissor_rg` mesmo que a sigla não venha no formato 'SSP/SP'. Use as seguintes regras determinísticas (NÃO são chute — são leitura do próprio documento):",
            "   • Se o órgão expedidor traz a UF explícita após barra ou hífen (ex.: 'SSP/SP', 'SSP-MG', 'PC/RJ', 'IFP/RJ', 'IIRGD/SP', 'DETRAN/PR'), extraia a UF.",
            "   • Se o nome do órgão menciona o estado por extenso (ex.: 'Polícia Civil do Estado de São Paulo', 'Secretaria de Segurança Pública de Minas Gerais', 'DETRAN do Rio Grande do Sul'), converta o nome do estado em UF (São Paulo→SP, Minas Gerais→MG, Rio Grande do Sul→RS, etc.) e preencha `uf_emissor_rg`.",
            "   • Se a CNH/RG mostra um cabeçalho oficial do estado (brasão, 'GOVERNO DO ESTADO DE …', 'REPÚBLICA FEDERATIVA DO BRASIL — ESTADO DE …'), use esse estado como UF do emissor.",
            "   • Em CNH, o campo 'UF' impresso no próprio cartão é a UF do emissor — use-o.",
            "   • Só deixe `uf_emissor_rg` vazio se NENHUMA das pistas acima estiver visível. Nunca invente UF a partir do endereço, naturalidade ou CPF.",
            "8) DOCUMENTOS AUXILIARES VISÍVEIS NA CIN/RG: a CIN nova (gov.br) frequentemente lista, no verso ou em uma seção 'Outros Registros' / 'Outros Documentos' / 'Documentos Vinculados', outros números oficiais do cidadão. SEMPRE inspecione TODA a imagem (frente E verso, incluindo cabeçalhos, rodapés e colunas laterais) e, se visíveis, preencha:",
            "   • titulo_eleitor: número do Título de Eleitor (geralmente 12 dígitos), quando rotulado como 'Título de Eleitor', 'Título Eleitoral' ou 'TE'.",
            "   • cnh: número de registro da CNH (11 dígitos), quando rotulado como 'CNH', 'Carteira de Habilitação', 'Registro Nacional de Habilitação' ou 'RENACH'.",
            "   • ctps: quando rotulado como 'CTPS' ou 'Carteira de Trabalho'.",
            "   • pis_pasep: quando rotulado como 'PIS', 'PASEP' ou 'NIS'.",
            "   Extraia APENAS dígitos (sem pontos, traços ou espaços). Se o número não estiver claramente legível, NÃO invente — deixe vazio. Esses campos são INDEPENDENTES do tipo_documento: extraia mesmo que o documento principal seja CIN, RG ou CNH.",
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
