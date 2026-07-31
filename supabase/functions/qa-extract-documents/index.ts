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
// Slugs IDÊNTICOS aos do Hub Documental (CHECK de qa_documentos_cliente).
// Qualquer slug próprio faria o documento chegar ao Hub sem identidade e a
// exigência correspondente nunca seria cumprida.
const CLASSIFY_TIPOS = [
  "cin","rg_com_cpf","cnh","cpf","certidao_alteracao_nome",
  "comprovante_residencia","declaracao_responsavel_imovel","documento_identificacao_terceiro",
  "ctps","renda_holerite_mes_atual","renda_holerite_funcionario_publico","renda_carteira_funcional",
  "renda_cartao_cnpj","renda_cnpj_autonomo","renda_contrato_social",
  "renda_nf_recente","renda_comprovante_beneficio","renda_extrato_inss","renda_qsa",
  "antecedentes_criminais","antecedentes_federal",
  "antecedentes_federal_trf3_regional","antecedentes_federal_sjsp_jef",
  "antecedentes_estadual","antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes","antecedentes_militar","antecedentes_eleitoral",
  "laudo_psicologico","laudo_capacidade_tecnica",
  "cr","craf","sinarm","gt","gte","autorizacao_compra","nota_fiscal_arma",
  "comprovante_habitualidade","comprovante_clube_tiro","declaracao_compromisso_habitualidade",
  "habilitacao_cacador_ibama","declaracao_nao_possuir_segundo_endereco",
  "requerimento_de_posse_de_arma_de_fogo","comprovante_pagamento","documento_complementar_caso",
  "gov_br","outro",
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
            data_proxima_leitura: { type: "string", description: "Só para conta de consumo: data da PRÓXIMA LEITURA impressa na fatura. É ela que define a validade do comprovante de residência." },
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

const CLASSIFY_SYSTEM = `Você classifica documentos do processo de aquisição de arma de fogo (CAC) no Brasil.
O slug escolhido é o MESMO usado pelo Hub Documental do cliente: acertar o tipo exato faz a exigência do processo ser cumprida automaticamente; errar faz o sistema pedir o documento de novo ao cliente. Seja específico — só use um tipo genérico quando o documento realmente não permitir distinguir.

IDENTIFICAÇÃO
- cin: CIN (Carteira de Identidade Nacional, layout gov.br com QR code) ou RG antigo sem CPF impresso
- rg_com_cpf: RG que traz o CPF impresso no próprio documento
- cnh: Carteira Nacional de Habilitação — "PERMISSÃO PARA DIRIGIR"/"HABILITAÇÃO", nº de registro, categoria (A/B/AB), validade
- cpf: cartão ou comprovante de inscrição no CPF isolado
- certidao_alteracao_nome: certidão averbada de alteração/retificação de nome

ENDEREÇO
- comprovante_residencia: conta de luz, água, gás, telefone, internet, IPTU ou correspondência bancária com endereço.
  ATENÇÃO — extraia SEMPRE o campo data_proxima_leitura quando existir: contas de consumo trazem
  "PRÓXIMA LEITURA", "PROXIMA LEITURA", "Leitura seguinte" ou "Próxima medição". É essa data que
  define até quando o comprovante vale — NÃO é a emissão nem o vencimento da fatura
- declaracao_responsavel_imovel: declaração assinada pelo responsável/proprietário do imóvel
- documento_identificacao_terceiro: RG, CIN ou CNH do DONO DO IMÓVEL — usado quando o comprovante de residência está em nome de terceiro. O nome NÃO é o do cliente, e isso é esperado: não trate como divergência

OCUPAÇÃO LÍCITA E RENDA (escolha SEMPRE o tipo específico, nunca um genérico)
- ctps: Carteira de Trabalho (CTPS), física ou digital
- renda_holerite_mes_atual: holerite/contracheque de empresa privada
- renda_holerite_funcionario_publico: holerite de servidor público
- renda_carteira_funcional: carteira funcional de servidor público — identifica o servidor e o órgão, comprova o vínculo. NÃO é holerite (não traz valores) nem CTPS
- renda_cartao_cnpj: Cartão CNPJ da Receita Federal (empresa comum)
- renda_cnpj_autonomo: CCMEI (Certificado da Condição de Microempreendedor Individual) ou cartão CNPJ de MEI/autônomo
- renda_contrato_social: contrato social, requerimento de empresário ou alteração contratual (NÃO é o QSA)
- renda_qsa: QSA — Quadro de Sócios e Administradores, emitido pela Receita Federal. Lista os sócios e sua participação. É documento PRÓPRIO, distinto do contrato social e do cartão CNPJ: no grupo "empresário" os quatro (contrato social, cartão CNPJ, QSA e nota fiscal) são exigidos separadamente
- renda_nf_recente: nota fiscal de serviço ou produto emitida pelo cliente (NÃO é nota fiscal de arma)
- renda_comprovante_beneficio: comprovante de benefício (INSS, BPC, aposentadoria, pensão)
- renda_extrato_inss: extrato CNIS ou extrato de contribuições do INSS

ANTECEDENTES (distinga o órgão emissor — cada um cumpre uma exigência diferente)
- antecedentes_criminais: Atestado de Antecedentes da Polícia Civil / SSP / IIRGD
- antecedentes_federal: Certidão de Distribuição Criminal da Justiça Federal (genérica, sem indicação de região ou seção)
- antecedentes_federal_trf3_regional: certidão do TRF (Tribunal Regional Federal) — abrangência REGIONAL. Traz "TRIBUNAL REGIONAL FEDERAL DA Xª REGIÃO"
- antecedentes_federal_sjsp_jef: certidão da Seção Judiciária (SJ) e/ou Juizado Especial Federal (JEF)
- antecedentes_estadual: certidão criminal do Tribunal de Justiça estadual (TJSP, TJRJ, etc.)
- antecedentes_estadual_distribuicao: certidão do TJ especificamente de DISTRIBUIÇÃO de ações criminais
- antecedentes_estadual_execucoes: certidão do TJ especificamente de EXECUÇÕES criminais
- antecedentes_militar: Certidão da Justiça Militar (STM — Superior Tribunal Militar, Justiça Militar da União, ou Justiça Militar estadual)
- antecedentes_eleitoral: Certidão de Crimes Eleitorais (TSE ou TRE)

LAUDOS
- laudo_psicologico: laudo de psicólogo com CRP e resultado APTO/INAPTO
- laudo_capacidade_tecnica: atestado de capacidade técnica de manuseio, assinado por instrutor de tiro

CAC / ATIVIDADE (três documentos DISTINTOS — cada um cumpre uma exigência própria, nunca use um no lugar do outro)
- comprovante_clube_tiro: comprovante de FILIAÇÃO a clube ou entidade de tiro — vincula o cliente à entidade (matrícula, carteirinha, declaração de filiação)
- comprovante_habitualidade: declaração de HABITUALIDADE emitida pelo clube — atesta as sessões de treino já realizadas, com datas e quantidade
- declaracao_compromisso_habitualidade: declaração de COMPROMISSO firmada pelo cliente — ele se compromete a cumprir a habitualidade daqui para frente. É promessa, não registro de treino já feito
- comprovante_competicao: comprovante de participação em competição ou evento de tiro

ARMA E ACERVO
- cr: CR — Certificado de Registro de colecionador/atirador/caçador (Exército)
- craf: CRAF — Certificado de Registro de Arma de Fogo (Exército)
- sinarm: Certificado de Registro de Arma de Fogo emitido pela Polícia Federal (SINARM)
- gt: Guia de Tráfego (GT)
- gte: Guia de Tráfego Eventual (GTE)
- autorizacao_compra: autorização de compra de arma de fogo
- nota_fiscal_arma: nota fiscal de COMPRA DE ARMA DE FOGO especificamente

PROCESSO
- requerimento_de_posse_de_arma_de_fogo: requerimento gerado no site da Polícia Federal, com os dados completos do requerente e o calibre da arma pretendida
- habilitacao_cacador_ibama: certificado de registro do IBAMA/IBRAM que autoriza o cliente a caçar. Documento oficial do órgão, com validade
- declaracao_nao_possuir_segundo_endereco: declaração do próprio cliente, assinada via gov.br, de que não possui segundo endereço de guarda de acervo
- comprovante_pagamento: comprovante de transação bancária — PIX, TED, DOC ou pagamento com cartão. Só use quando o BENEFICIÁRIO for "Willian Rodrigues da Silva Massaroto" ou "Senhor das Armas Comercio de Armas e Municoes Ltda" (ou variações). Fatura de cartão de crédito NÃO é comprovante_pagamento nem comprovante_residencia — use outro. Extrato bancário sem beneficiário identificado = outro.
- documento_complementar_caso: documento do processo que não se encaixa nos anteriores

OUTROS
- gov_br: print de tela do portal GOV.BR mostrando login/senha
- outro: não foi possível determinar o tipo

REGRAS: Decida pelo CONTEÚDO do documento, não pelo nome do arquivo. Leia o cabeçalho e o órgão emissor antes de escolher entre variantes. Extraia apenas dados visíveis.`;

async function classificarUmArquivo(dataUrl: string, mime: string, nome: string, apiKey: string) {
  const model = mime === "application/pdf" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  // Guarda de tamanho: um data URL gigante estoura a memória do worker e derruba
  // a função inteira ("Failed to send a request to the Edge Function").
  if (typeof dataUrl !== "string" || dataUrl.length < 32) throw new Error("data_url_invalida");
  if (dataUrl.length > MAX_DATA_URL_CHARS) throw new Error("arquivo_muito_grande");

  const body = JSON.stringify({
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
  });

  // Timeout duro + 1 retry: sem AbortController um gateway pendurado segura o
  // worker até o kill do runtime, e o cliente vê erro de rede em vez de erro útil.
  let resp: Response | null = null;
  let lastErr = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), GATEWAY_TIMEOUT_MS);
    try {
      resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
    } catch (e: any) {
      lastErr = e?.name === "AbortError" ? "timeout_ia" : `rede_ia_${e?.message || e}`;
      resp = null;
    } finally {
      clearTimeout(t);
    }
    if (resp && (resp.ok || (resp.status !== 429 && resp.status < 500))) break;
    if (resp) lastErr = `gateway_${resp.status}`;
    if (tentativa === 0) await new Promise((r) => setTimeout(r, 1200));
  }
  if (!resp) throw new Error(lastErr || "rede_ia");
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
