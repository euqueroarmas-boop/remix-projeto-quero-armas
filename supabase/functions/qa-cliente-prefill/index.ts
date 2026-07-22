// Edge Function: qa-cliente-prefill
//
// Pré-preenche o cadastro "Novo Cliente" da Equipe Quero Armas a partir de
// múltiplos arquivos (imagens/PDFs) e/ou texto livre.
//
// Reutiliza o gateway Lovable AI (Gemini Vision) com um único tool-schema
// abrangente cobrindo todos os campos do formulário de cliente.
//
// Retorna campos extraídos + confiança por campo + warnings, mas NUNCA salva
// nada no banco — a equipe revisa e confirma antes de gravar.
//
// Requer JWT (verify_jwt = true por padrão neste projeto). Apenas autenticados.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PREFILL_TOOL = {
  type: "function",
  function: {
    name: "preencher_cadastro_cliente",
    description:
      "Extrai e consolida TODOS os dados cadastrais possíveis a partir de múltiplos documentos brasileiros (RG, CIN, CNH, CPF, comprovante de endereço, CR, CRAF, GTE, contratos, procurações, fichas, prints, PDFs ou texto livre). Use apenas dados visíveis. Nunca invente.",
    parameters: {
      type: "object",
      properties: {
        nome_completo: { type: "string" },
        cpf: { type: "string", description: "Apenas dígitos. 11 caracteres. NUNCA copie o RG aqui." },
        cnpj: { type: "string", description: "Apenas dígitos. 14 caracteres se for PJ." },
        tipo_documento_identidade: { type: "string", description: "RG ou CIN. CIN usa o mesmo número do CPF." },
        rg: { type: "string", description: "Número do RG/CIN. Se for CIN, pode coincidir com CPF (legal)." },
        emissor_rg: { type: "string", description: "Órgão expedidor SEM a UF (ex: SSP, DETRAN, SSP-PC). NÃO incluir a UF aqui." },
        uf_emissor_rg: { type: "string", description: "UF do órgão emissor do RG/CIN, SEMPRE em 2 letras maiúsculas (ex: SP, RJ, MG). Extraia separadamente do órgão." },
        data_expedicao_rg: { type: "string", description: "DD/MM/AAAA" },
        data_nascimento: { type: "string", description: "DD/MM/AAAA" },
        sexo: { type: "string", description: "M, F ou Outro" },
        nacionalidade: { type: "string" },
        estado_civil: { type: "string" },
        profissao: { type: "string" },
        escolaridade: { type: "string" },
        nome_mae: { type: "string" },
        nome_pai: { type: "string" },
        naturalidade_municipio: { type: "string" },
        naturalidade_uf: { type: "string", description: "2 letras" },
        naturalidade_pais: { type: "string" },
        titulo_eleitor: { type: "string", description: "Apenas dígitos" },
        cnh: { type: "string", description: "Número da CNH" },
        ctps: { type: "string" },
        pis_pasep: { type: "string" },
        celular: { type: "string", description: "Apenas dígitos com DDD" },
        telefone_secundario: { type: "string" },
        email: { type: "string" },
        cep: { type: "string", description: "Apenas dígitos, 8 caracteres" },
        endereco: { type: "string", description: "Logradouro sem número" },
        numero: { type: "string" },
        complemento: { type: "string" },
        bairro: { type: "string" },
        cidade: { type: "string" },
        estado: { type: "string", description: "UF, 2 letras" },
        pais: { type: "string" },
        cep_secundario: { type: "string", description: "CEP do endereço secundário (opcional). Apenas dígitos." },
        endereco_secundario: { type: "string", description: "Logradouro do endereço secundário (sem número)." },
        numero_secundario: { type: "string" },
        complemento_secundario: { type: "string" },
        bairro_secundario: { type: "string" },
        cidade_secundario: { type: "string" },
        estado_secundario: { type: "string", description: "UF, 2 letras" },
        pais_secundario: { type: "string" },
        cr_numero: { type: "string", description: "Número do Certificado de Registro (CAC)" },
        cr_categoria: { type: "string", description: "Atirador, Caçador, Colecionador" },
        cr_data_emissao: { type: "string", description: "DD/MM/AAAA" },
        cr_data_validade: { type: "string", description: "DD/MM/AAAA" },
        cr_orgao_emissor: { type: "string" },
        data_realizacao_exame_psicologico: { type: "string", description: "DD/MM/AAAA — DATA DE REALIZAÇÃO do exame/laudo psicológico. Não é data de validade." },
        data_realizacao_exame_tiro: { type: "string", description: "DD/MM/AAAA — DATA DE REALIZAÇÃO do exame de capacidade técnica/tiro. Não é data de validade." },
        validade_laudo_psicologico: { type: "string", description: "Legado: preencher com a DATA DE REALIZAÇÃO do exame/laudo psicológico quando o formulário antigo usar este nome." },
        validade_exame_tiro: { type: "string", description: "Legado: preencher com a DATA DE REALIZAÇÃO do exame de tiro quando o formulário antigo usar este nome." },
        senha_gov: { type: "string", description: "LEGADO: deixe vazio. Use senha_gov_raw para senha GOV.BR." },
        senha_gov_raw: { type: "string", description: "Campo literal/raw. Transcreva a senha GOV.BR EXATAMENTE como aparece no print/documento, entre aspas, preservando maiúsculas, minúsculas, acentos, números, espaços e símbolos. Se houver dúvida em qualquer caractere, deixe vazio." },
        senha_gov_confidence: { type: "number", description: "Confiança 0..1 da transcrição literal da senha GOV.BR. Use >=0.9 apenas quando todos os caracteres estiverem nítidos." },
        senha_gov_needs_review: { type: "boolean", description: "true se a senha GOV.BR estiver ausente, duvidosa, ilegível, inferida ou com qualquer caractere de baixa confiança." },
        emissor_rg_needs_review: { type: "boolean", description: "true quando o emissor RG/CIN extraído for incomum, inconsistente ou de baixa confiança." },
        acervo: {
          type: "array",
          description: "Itens do acervo identificados (CRAFs, GTs etc.).",
          items: {
            type: "object",
            properties: {
              tipo_documento: { type: "string", description: "craf, sinarm, gt, gte, autorizacao_compra ou outro" },
              numero_documento: { type: "string" },
              orgao_emissor: { type: "string" },
              data_emissao: { type: "string", description: "DD/MM/AAAA" },
              data_validade: { type: "string", description: "DD/MM/AAAA" },
              arma_marca: { type: "string" },
              arma_modelo: { type: "string", description: "Modelo COMERCIAL apenas. Nunca número." },
              arma_calibre: { type: "string" },
              arma_numero_serie: { type: "string" },
              arma_especie: { type: "string", description: "Pistola, Revólver, Carabina, etc." },
            },
            required: [
              "tipo_documento", "numero_documento", "orgao_emissor", "data_emissao",
              "data_validade", "arma_marca", "arma_modelo", "arma_calibre",
              "arma_numero_serie", "arma_especie",
            ],
          },
        },
        observacoes: { type: "string", description: "Notas relevantes para a equipe." },
        warnings: {
          type: "array",
          description: "Avisos para revisão humana (ex: 'CPF e RG idênticos — confirmar se é CIN', 'Endereço extraído divergente entre documentos').",
          items: { type: "string" },
        },
        confidence_pairs: {
          type: "array",
          description: "Confiança de 0..1 por campo extraído. Uma entrada por campo preenchido.",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              score: { type: "number" },
            },
            required: ["field", "score"],
          },
        },
      },
      required: [
        "nome_completo", "cpf", "cnpj", "tipo_documento_identidade", "rg", "emissor_rg",
        "uf_emissor_rg", "data_expedicao_rg", "data_nascimento", "sexo", "nacionalidade", "estado_civil",
        "profissao", "escolaridade", "nome_mae", "nome_pai", "naturalidade_municipio",
        "naturalidade_uf", "naturalidade_pais", "titulo_eleitor", "cnh", "ctps",
        "pis_pasep", "celular", "telefone_secundario", "email", "cep", "endereco",
        "numero", "complemento", "bairro", "cidade", "estado", "pais", "cr_numero",
        "cep_secundario", "endereco_secundario", "numero_secundario", "complemento_secundario",
        "bairro_secundario", "cidade_secundario", "estado_secundario", "pais_secundario",
        "cr_categoria", "cr_data_emissao", "cr_data_validade", "cr_orgao_emissor",
        "data_realizacao_exame_psicologico", "data_realizacao_exame_tiro",
        "validade_laudo_psicologico", "validade_exame_tiro", "senha_gov",
        "senha_gov_raw", "senha_gov_confidence", "senha_gov_needs_review", "emissor_rg_needs_review",
        "acervo", "observacoes", "warnings", "confidence_pairs",
      ],
    },
  },
};

const SYSTEM_PROMPT = [
  "Você é um extrator forense de dados cadastrais brasileiros para o painel da Equipe Quero Armas.",
  "Receberá MÚLTIPLOS arquivos (RG, CIN, CNH, CPF, comprovante de endereço, CR, CRAF, GTE, contrato, procuração, ficha antiga, prints, PDFs) e/ou texto livre.",
  "Sua missão: consolidar TODOS os dados cadastrais possíveis em um único objeto, chamando a função preencher_cadastro_cliente.",
  "REGRAS:",
  "1) Use APENAS o que está visível/escrito. Nunca invente.",
  "2) CPF tem 11 dígitos e é distinto do RG. NUNCA copie um para o outro.",
  "3) Se o documento for CIN gov.br, o número impresso como 'Registro Geral' é o próprio CPF — preencha tipo_documento_identidade='CIN' e rg=mesmo CPF.",
  "4) Se for RG tradicional e o número for igual ao CPF, adicione warning 'RG igual ao CPF — pode ser CIN'.",
  "5) Datas SEMPRE em DD/MM/AAAA.",
  "6) Se diferentes documentos divergirem (ex: 2 endereços diferentes), use o mais recente e adicione um warning descrevendo a divergência.",
  "6.1) Se houver MAIS DE UM endereço (ex: residencial + comercial, ou principal + alternativo), preencha o primeiro em cep/endereco/... e o segundo em cep_secundario/endereco_secundario/...",
  "6.2) ESTADO CIVIL: quando o documento oficial de identidade (CIN/RG/CNH) divergir de texto livre (WhatsApp, e-mail, observação verbal), SEMPRE prevaleça o texto livre — o documento oficial pode estar desatualizado (ex.: cliente casou depois de emitir o CIN/RG). Esta regra é fixa: nunca use o valor do documento em vez do texto livre para este campo quando houver divergência. Adicione warning descrevendo a divergência e os dois valores encontrados, para a equipe ter ciência (mas o campo já vem preenchido com o valor do texto livre).",
    "7) Para cada campo preenchido, registre a confiança em confidence (0..1). Campos com confidence < 0.6 devem aparecer como warning de 'campo a revisar'.",
  "8) NÃO preencha o número da arma (arma_numero_serie) no campo arma_modelo. Modelo é COMERCIAL (G2C, TS9, 1911, etc.).",
  "9) Se houver vários CRAFs/GTs, retorne todos em acervo[].",
  "10) Em fichas antigas, os campos 'DATA EXAME PSICOLÓGICO' e 'DATA EXAME DE TIRO' são DATAS DE REALIZAÇÃO: a data em que o exame FOI FEITO. Datas passadas nesses campos são normais, esperadas e corretas. Retorne em data_realizacao_exame_psicologico e data_realizacao_exame_tiro, nunca trate como validade.",
    "10.1) NUNCA reclame que DATA DE REALIZAÇÃO DO EXAME está no passado. NUNCA gere warning de futuro/vencimento/validade para data_realizacao_exame_psicologico, data_realizacao_exame_tiro, validade_laudo_psicologico ou validade_exame_tiro quando o documento indicar que é data do exame realizado.",
    "11) SENHA GOV.BR É CAMPO SENSÍVEL DE TRANSCRIÇÃO LITERAL/RAW. Use senha_gov_raw, não senha_gov. NÃO normalize, NÃO corrija, NÃO interprete, NÃO converta maiúscula/minúscula, NÃO remova acentos, NÃO troque símbolos, NÃO complete e NÃO infira por contexto.",
    "11.1) senha_gov_raw deve refletir EXATAMENTE o que aparece no print/documento, caractere por caractere, respeitando letras, números, maiúsculas, minúsculas, acentos, espaços e caracteres especiais. Exemplo literal: senha_gov_raw: \"Eduisa7050$\". Se houver dúvida em qualquer caractere, retorne senha_gov_raw='' e senha_gov_needs_review=true.",
    "11.1.1) ATENÇÃO ESPECIAL A SÍMBOLOS: $ # @ ! % & * ? / \\ + - _ . , ; : ' \". Nunca converta '$' em '6' ou 'S'. Nunca converta '!' em '1'. Nunca converta '@' em 'a'. Nunca converta 'O' em '0' nem o contrário. Se o último caractere for um símbolo, transcreva o símbolo, não o omita.",
    "11.1.2) Se a senha visualmente parece terminar em símbolo (ex: $) e você está em dúvida, deixe senha_gov_raw='' e senha_gov_needs_review=true. NUNCA salve uma versão sanitizada/alfanumérica de uma senha que contém símbolo.",
    "11.2) Só use senha_gov_confidence >= 0.9 quando todos os caracteres estiverem visualmente/textualmente nítidos. Caso contrário, deixe a senha vazia e adicione warning: 'Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento.'.",
    "11.3) Para senha GOV.BR, releia 2x antes de retornar. Qualquer caractere errado bloqueia o acesso do cliente.",
    "12) Emissor RG/CIN: se o emissor extraído for incomum, inconsistente ou de baixa confiança, marque emissor_rg_needs_review=true e adicione warning 'Verificar emissor do RG. Extração possivelmente incorreta.'. Exemplo: 'SSP ISP' deve gerar revisão.",
    "13) Se nada útil for encontrado, retorne objeto vazio sem warnings falsos.",
    "14) NUNCA gere warning de 'data no futuro' a menos que tenha certeza absoluta da data atual. Datas em DD/MM/AAAA podem ser confundidas com MM/DD/AAAA — não emita esse tipo de warning.",
    "15) TEXTO LIVRE (conversas WhatsApp, e-mails, prints): LEIA linha por linha e extraia TODO dado cadastral encontrado — em especial telefone/celular (qualquer sequência com DDD, ex.: (11) 94010-4125, 11940104125, +55 11 9...), e-mail (qualquer token com @), CEP (00000-000 ou 8 dígitos), endereço, RG, CPF, data de nascimento, nome da mãe/pai, senha GOV.BR. Assinaturas de e-mail, rodapés e cabeçalhos frequentemente contêm telefone e e-mail — não ignore.",
    "16) Telefone/celular: normalize para apenas dígitos com DDD (10 ou 11 dígitos). Se houver mais de um número, use o mais mencionado ou o marcado como principal em celular, e coloque o outro em telefone_secundario.",
    "16.1) NOMES DE ARQUIVO (bloco '=== NOMES DE ARQUIVO ==='): trate cada nome como fonte válida de telefone. Ex.: 'Conversa do WhatsApp com Rubens 17 8455-6650.zip' → celular '17984556650' (celulares brasileiros pré-2016 com 8 dígitos começando 6-9 devem receber '9' prefixado após o DDD).",
    "17) E-mail: extraia qualquer endereço válido (contém '@' e domínio). Prefira o de uso pessoal (gmail, hotmail, outlook, icloud, yahoo, uol, terra) ao corporativo se houver conflito.",
    "18) Nome completo, nome da mãe, nome do pai, profissão, estado civil, escolaridade, nacionalidade, naturalidade, emissor do RG, logradouro, complemento, bairro, cidade e país: escreva SEMPRE com a ortografia correta em português (com acentos e cedilha corretos, ex.: 'EMPRESÁRIO', 'SÃO PAULO', 'JOÃO'), mesmo que o documento original esteja sem acentuação, todo em maiúsculas ou com abreviações. Nunca altere o CONTEÚDO do dado (não troque nomes por sinônimos), apenas a grafia/acentuação. E-mail e senha GOV.BR NUNCA são alterados — preserve exatamente como estão.",
].join("\n");

async function callPrefill(content: any[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      tools: [PREFILL_TOOL],
      tool_choice: { type: "function", function: { name: "preencher_cadastro_cliente" } },
    }),
  });

  if (resp.status === 429) throw new Error("RATE_LIMIT");
  if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[ai-gateway]", resp.status, t);
    throw new Error(`AI_GATEWAY_${resp.status}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return {};
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return {};
  }
}

async function verifySenhaGov(content: any[], proposed: unknown) {
  const senha = typeof proposed === "string" ? proposed : "";
  if (!senha) return { ok: false, senha: "", confidence: 0, warning: "Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento." };

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Auditor independente roda em modelo Flash (mais rápido) — a tarefa
      // é binária (confere/não confere) e não exige raciocínio profundo.
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um auditor forense de senha GOV.BR. Confira APENAS o campo senha_gov nos documentos. " +
            "Nunca corrija por aproximação, nunca normalize, nunca troque símbolos/letras/números parecidos. " +
            "Retorne JSON puro: {\"ok\":boolean,\"senha\":string,\"confidence\":number,\"warning\":string,\"has_symbol_in_source\":boolean}. " +
            "Extraia novamente a senha diretamente do documento/print e retorne em senha exatamente como aparece, caractere por caractere. " +
            "ok só pode ser true se a senha retornada estiver EXATAMENTE igual ao documento, mesmo que seja diferente da senha proposta. " +
            "Se qualquer caractere estiver duvidoso, ilegível ou inferido, ok=false e senha=\"\". " +
            "has_symbol_in_source=true se a senha visível no documento contém qualquer símbolo ($, #, @, !, %, &, *, ?, /, \\, +, -, _, ., ,, ;, :, ', \"). " +
            "Se has_symbol_in_source=true e a senha proposta NÃO contiver esse símbolo, retorne ok=false. " +
            "confidence só pode ser >=0.9 quando houver correspondência literal nítida no trecho visual/textual extraído.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Senha proposta para conferência literal: ${senha}\n` +
                "Confira nos arquivos/textos abaixo e, se necessário, corrija pela transcrição literal do print. Preserve símbolos como $, #, @, ! sem trocar por números/letras. Responda somente JSON.",
            },
            ...content.slice(1),
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) return { ok: false, senha: "", confidence: 0, warning: "Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento." };
  try {
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const checked = typeof parsed?.senha === "string" ? parsed.senha : "";
    const confidence = typeof parsed?.confidence === "number" ? parsed.confidence : 0;
    const hasSymbolInSource = parsed?.has_symbol_in_source === true;
    const checkedHasSymbol = /[^\p{L}\p{N}]/u.test(checked);
    // Se a primeira extração perdeu um símbolo, aceita a correção literal do auditor.
    if (hasSymbolInSource && !checkedHasSymbol) {
      return { ok: false, senha: "", confidence, warning: "Senha GOV.BR aparenta conter símbolo no documento que não foi capturado. Confira manualmente." };
    }
    return parsed?.ok === true && checked && confidence >= 0.9
      ? { ok: true, senha: checked, confidence, warning: "" }
      : { ok: false, senha: "", confidence, warning: parsed?.warning || "Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento." };
  } catch {
    return { ok: false, senha: "", confidence: 0, warning: "Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento." };
  }
}

// Parse de data brasileira (DD/MM/AAAA) ou ISO. Retorna Date em UTC ou null.
function parseBrDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
    if (d.getUTCFullYear() === +yyyy && d.getUTCMonth() === +mm - 1 && d.getUTCDate() === +dd) return d;
    return null;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

// Remove warnings falsos sobre "data no futuro" quando a data citada já passou.
function filterFalseFutureWarnings(warnings: string[]): string[] {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return warnings.filter((w) => {
    if (!/futuro|future/i.test(w)) return true;
    if (/exame|psicol[oó]gico|tiro|laudo|realiza[cç][aã]o/i.test(w)) return false;
    const dates = w.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (dates.length === 0) return true;
    // Se TODAS as datas do warning já passaram, descarta o warning.
    const allPast = dates.every((d) => {
      const parsed = parseBrDate(d);
      return parsed != null && parsed.getTime() <= todayUtc.getTime();
    });
    return !allPast;
  });
}

// Máscaras determinísticas aplicadas no fim da extração — a IA já normaliza
// para "apenas dígitos", então essas funções só formatam para exibição.
function formatCpf(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 11) return typeof v === "string" ? v : null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatCep(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 8) return typeof v === "string" ? v : null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function formatTelefone(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return typeof v === "string" ? v : null;
}
// RG varia demais de formato entre estados — só aplica máscara padrão
// (XX.XXX.XXX-X) quando o valor for puramente numérico com 8 ou 9 dígitos;
// caso contrário preserva como veio (ex.: CIN com letras, formatos de outros
// estados) para não corromper um número válido.
function formatRg(v: unknown): string | null {
  const raw = String(v ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (!/^\d+$/.test(raw.replace(/[.\-\s]/g, ""))) return typeof v === "string" ? v : null;
  if (d.length === 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length === 9) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
  return typeof v === "string" ? v : null;
}
// Todo campo de texto sai em maiúsculas (padrão de documentos brasileiros),
// exceto os explicitamente listados aqui: e-mail e senha GOV.BR são
// transcrição literal e nunca podem ser alterados; observações/warnings são
// texto livre para a equipe, não dado cadastral.
const CAMPOS_SEM_MAIUSCULA = new Set([
  "email", "senha_gov_raw", "observacoes", "warnings", "confidence",
  "confidence_pairs", "senha_gov_confidence", "senha_gov_needs_review",
  "emissor_rg_needs_review",
]);
function upperDeep(value: any): any {
  if (typeof value === "string") return value.trim() ? value.trim().toUpperCase() : value;
  if (Array.isArray(value)) return value.map(upperDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = upperFieldsExcept(k, v);
    return out;
  }
  return value;
}
function upperFieldsExcept(key: string, value: any): any {
  if (CAMPOS_SEM_MAIUSCULA.has(key)) return value;
  return upperDeep(value);
}

function emissorRgNeedsReview(value: unknown, confidence?: number): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  const compact = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (typeof confidence === "number" && confidence < 0.75) return true;
  if (/SSP\s*ISP/i.test(raw) || compact.includes("SSPISP")) return true;
  const common = new Set(["SSP", "SSPPC", "PC", "PCMG", "PCRJ", "DETRAN", "IFP", "IIRGD", "SJS", "SESP", "SDS", "DGPC"]);
  if (compact.startsWith("SSP") && !["SSP", "SSPPC"].includes(compact)) return true;
  return compact.length > 0 && !common.has(compact) && compact.length > 8;
}

// Extração determinística de telefone/celular e e-mail a partir do texto livre.
// Serve de fallback quando o modelo ignora dados de conversa WhatsApp/e-mail.
function extractPhonesFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // DDDs válidos no Brasil (ANATEL). Sem esta lista, sequências de dígitos
  // (timestamps, protocolos, IDs de mensagem do WhatsApp) viram "telefone".
  const DDD_VALIDOS = new Set([
    "11","12","13","14","15","16","17","18","19",
    "21","22","24","27","28",
    "31","32","33","34","35","37","38",
    "41","42","43","44","45","46","47","48","49",
    "51","53","54","55",
    "61","62","63","64","65","66","67","68","69",
    "71","73","74","75","77","79",
    "81","82","83","84","85","86","87","88","89",
    "91","92","93","94","95","96","97","98","99",
  ]);
  // Só aceita padrões claramente telefônicos:
  //   +55 (DD) 9XXXX-XXXX / (DD) 9XXXX-XXXX / DD 9XXXX XXXX
  //   Exige separador (parênteses, espaço, hífen, ponto) OU prefixo +55
  //   para evitar casar dentro de sequências longas (timestamps, IDs).
  const re = /(?:\+?55[\s.-]*)?(?:\(?(\d{2})\)?[\s.-]+)(9?\d{4})[\s.-]?(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const ddd = m[1];
    if (!DDD_VALIDOS.has(ddd)) continue;
    const rest = (m[2] + m[3]).replace(/\D/g, "");
    // Celular novo: 9 dígitos começando com 9.
    // Celular legado (pré-2016): 8 dígitos começando com 6-9 → prefixamos "9".
    // Fixo: 8 dígitos começando 2-5.
    const isMobileNovo = rest.length === 9 && rest.startsWith("9");
    const isMobileLegado = rest.length === 8 && /^[6-9]/.test(rest);
    const isFixo = rest.length === 8 && /^[2-5]/.test(rest);
    if (!isMobileNovo && !isMobileLegado && !isFixo) continue;
    const restNorm = isMobileLegado ? "9" + rest : rest;
    const digits = ddd + restNorm;
    if (!seen.has(digits)) {
      seen.add(digits);
      out.push(digits);
    }
  }
  // Prioriza celulares (11 dígitos) sobre fixos (10 dígitos)
  out.sort((a, b) => b.length - a.length);
  return out;
}

function extractEmailFromText(text: string): string | null {
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const matches = Array.from(new Set((text.match(re) || []).map((e) => e.toLowerCase())));
  if (matches.length === 0) return null;
  const pessoais = ["gmail.com", "hotmail.com", "outlook.com", "icloud.com", "yahoo.com", "uol.com.br", "terra.com.br", "bol.com.br", "live.com"];
  const pessoal = matches.find((e) => pessoais.some((d) => e.endsWith("@" + d)));
  return pessoal || matches[0];
}

async function lookupCep(cep: string): Promise<Record<string, string> | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  // 1) BrasilAPI v2
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d?.street || d?.city) {
        return {
          cep: clean,
          endereco: String(d.street || ""),
          bairro: String(d.neighborhood || ""),
          cidade: String(d.city || ""),
          estado: String(d.state || ""),
        };
      }
    }
  } catch { /* fallback abaixo */ }
  // 2) ViaCEP
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const d = await r.json();
      if (!d?.erro && (d?.logradouro || d?.localidade)) {
        return {
          cep: clean,
          endereco: String(d.logradouro || ""),
          bairro: String(d.bairro || ""),
          cidade: String(d.localidade || ""),
          estado: String(d.uf || ""),
        };
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Valida o dígito verificador do CNPJ (algoritmo oficial da Receita
// Federal). Evita consultar a API com um número que a IA leu errado do
// documento — nesse caso é melhor avisar a equipe do que falhar em silêncio.
function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(d.slice(0, 12) + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d === d.slice(0, 12) + String(dv1) + String(dv2);
}

// Busca dados públicos de CNPJ (BrasilAPI). Usado quando o cliente PF
// informa um CNPJ como comprovação de ocupação lícita — NÃO cadastra a
// empresa como entidade própria (qa_clientes não tem colunas para isso),
// só enriquece profissão/observações do cliente pessoa física.
async function lookupCnpj(cnpj: string): Promise<{
  razao_social: string; nome_fantasia: string; cnae_fiscal_descricao: string;
  logradouro: string; numero: string; complemento: string; bairro: string;
  municipio: string; uf: string; cep: string; ddd_telefone_1: string;
} | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.razao_social) return null;
    return {
      razao_social: String(d.razao_social || ""),
      nome_fantasia: String(d.nome_fantasia || ""),
      cnae_fiscal_descricao: String(d.cnae_fiscal_descricao || ""),
      logradouro: String(d.logradouro || ""),
      numero: String(d.numero || ""),
      complemento: String(d.complemento || ""),
      bairro: String(d.bairro || ""),
      municipio: String(d.municipio || ""),
      uf: String(d.uf || ""),
      cep: String(d.cep || ""),
      ddd_telefone_1: String(d.ddd_telefone_1 || ""),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const files = Array.isArray(body?.files) ? body.files : [];
    const text: string = typeof body?.text === "string" ? body.text.trim() : "";

    if (files.length === 0 && !text) {
      return json({ error: "Envie ao menos um arquivo ou cole um texto." }, 400);
    }
    if (files.length > 10) {
      return json({ error: "Máximo de 10 arquivos por extração." }, 400);
    }

    const content: any[] = [];
    content.push({
      type: "text",
      text:
        "Analise TODOS os arquivos e textos abaixo e consolide os dados cadastrais do cliente. " +
        "Chame preencher_cadastro_cliente UMA ÚNICA VEZ com todos os campos extraídos.",
    });

    if (text) {
      content.push({
        type: "text",
        text: `\n\n=== TEXTO LIVRE / OBSERVAÇÕES ===\n${text.slice(0, 12000)}`,
      });
    }

    for (const f of files) {
      const dataUrl = String(f?.data_url ?? "");
      const mime = String(f?.mime ?? "");
      if (!dataUrl.startsWith("data:")) continue;
      // Imagens vão como image_url. PDFs/outros vão como image_url também
      // (Gemini 2.5 aceita PDF inline via data URL). Texto bruto seria ideal,
      // mas mantemos a passagem ao modelo, que faz OCR/visão multimodal.
      if (mime.startsWith("image/") || mime === "application/pdf") {
        content.push({ type: "image_url", image_url: { url: dataUrl } });
      } else {
        // outros tipos: ignora silenciosamente, registra warning
        content.push({
          type: "text",
          text: `\n[Aviso: arquivo ignorado por tipo não suportado: ${f?.name ?? "?"} (${mime || "sem mime"})]`,
        });
      }
    }

    const result = await callPrefill(content);
    const normalized: any = { ...(result ?? {}) };
    const senhaCandidate = typeof normalized.senha_gov_raw === "string" ? normalized.senha_gov_raw : normalized.senha_gov;
    delete normalized.senha_gov;
    if (senhaCandidate) {
      const checked = await verifySenhaGov(content, senhaCandidate);
      if (!checked.ok) {
        normalized.senha_gov_raw = "";
        normalized.senha_gov_confidence = checked.confidence ?? 0;
        normalized.senha_gov_needs_review = true;
        normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
        normalized.warnings.push(checked.warning);
      } else {
        normalized.senha_gov_raw = checked.senha;
        normalized.senha_gov_confidence = checked.confidence;
        normalized.senha_gov_needs_review = false;
      }
    } else if (normalized.senha_gov_needs_review) {
      normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
      normalized.warnings.push("Senha GOV.BR não preenchida automaticamente por baixa confiança. Conferir manualmente no documento.");
    }
    // Convert confidence_pairs[] -> confidence{} for frontend compatibility
    if (Array.isArray(normalized.confidence_pairs)) {
      const conf: Record<string, number> = {};
      for (const p of normalized.confidence_pairs) {
        if (p?.field && typeof p.score === "number") conf[p.field] = p.score;
      }
      normalized.confidence = conf;
      delete normalized.confidence_pairs;
    }
    if (emissorRgNeedsReview(normalized.emissor_rg, normalized.confidence?.emissor_rg)) {
      normalized.emissor_rg_needs_review = true;
      normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
      if (!normalized.warnings.includes("Verificar emissor do RG. Extração possivelmente incorreta.")) {
        normalized.warnings.push("Verificar emissor do RG. Extração possivelmente incorreta.");
      }
    }
    // Fallback determinístico para uf_emissor_rg:
    // Quando o órgão emissor (emissor_rg) foi extraído mas a UF não, inferimos
    // a UF a partir de pistas já presentes no próprio documento/cadastro,
    // nesta ordem de prioridade:
    //   1) sufixo "/UF" no próprio emissor_rg (ex.: "SSP/SP", "SSP-PC/PR")
    //   2) naturalidade_uf (estado emissor do RG normalmente = estado natal)
    //   3) estado (UF do endereço atual) — última tentativa, marca needs_review
    // Nunca inventa: se nenhuma pista existir, deixa vazio.
    {
      const emissor = typeof normalized.emissor_rg === "string" ? normalized.emissor_rg.trim() : "";
      const ufAtual = typeof normalized.uf_emissor_rg === "string" ? normalized.uf_emissor_rg.trim().toUpperCase() : "";
      if (emissor && (!ufAtual || !/^[A-Z]{2}$/.test(ufAtual))) {
        let ufInferida = "";
        let origem: "emissor" | "naturalidade" | "endereco" | "" = "";
        const m = emissor.toUpperCase().match(/[\/\-\s]([A-Z]{2})\s*$/);
        if (m && m[1] !== "PC" && m[1] !== "PM") {
          ufInferida = m[1];
          origem = "emissor";
          // limpa o sufixo do campo emissor_rg para evitar duplicação
          normalized.emissor_rg = emissor.replace(/[\/\-\s][A-Z]{2}\s*$/i, "").trim();
        } else if (typeof normalized.naturalidade_uf === "string" && /^[A-Z]{2}$/.test(normalized.naturalidade_uf.trim().toUpperCase())) {
          ufInferida = normalized.naturalidade_uf.trim().toUpperCase();
          origem = "naturalidade";
        } else if (typeof normalized.estado === "string" && /^[A-Z]{2}$/.test(normalized.estado.trim().toUpperCase())) {
          ufInferida = normalized.estado.trim().toUpperCase();
          origem = "endereco";
        }
        if (ufInferida) {
          normalized.uf_emissor_rg = ufInferida;
          normalized.confidence = normalized.confidence || {};
          // Confiança alta quando vem do próprio emissor; média na naturalidade;
          // baixa quando inferida apenas do endereço.
          const score = origem === "emissor" ? 0.95 : origem === "naturalidade" ? 0.7 : 0.45;
          if (typeof normalized.confidence.uf_emissor_rg !== "number") {
            normalized.confidence.uf_emissor_rg = score;
          }
          if (origem !== "emissor") {
            normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
            const msg = origem === "naturalidade"
              ? `UF do emissor do RG inferida a partir da naturalidade (${ufInferida}). Conferir no documento.`
              : `UF do emissor do RG inferida a partir do endereço atual (${ufInferida}). Conferir no documento.`;
            if (!normalized.warnings.includes(msg)) normalized.warnings.push(msg);
          }
        }
      }
    }
    // Filtra warnings falsos de "data no futuro" quando a data já passou.
    if (Array.isArray(normalized.warnings)) {
      normalized.warnings = filterFalseFutureWarnings(normalized.warnings);
    }
    // Fallback determinístico: telefone e e-mail a partir do texto livre.
    if (text) {
      if (!normalized.celular) {
        const phones = extractPhonesFromText(text);
        if (phones.length > 0) {
          normalized.celular = phones[0];
          normalized.confidence = normalized.confidence || {};
          normalized.confidence.celular = 0.8;
          if (phones.length > 1 && !normalized.telefone_secundario) {
            normalized.telefone_secundario = phones[1];
            normalized.confidence.telefone_secundario = 0.7;
          }
        }
      }
      if (!normalized.email) {
        const email = extractEmailFromText(text);
        if (email) {
          normalized.email = email;
          normalized.confidence = normalized.confidence || {};
          normalized.confidence.email = 0.85;
        }
      }
    }
    // Resolve CEP → endereço completo (BrasilAPI). Preenche apenas campos vazios.
    if (typeof normalized.cep === "string" && normalized.cep.replace(/\D/g, "").length === 8) {
      const cepData = await lookupCep(normalized.cep);
      if (cepData) {
        normalized.cep = cepData.cep;
        normalized.confidence = normalized.confidence || {};
        // Logradouro: preenche só se a IA não extraiu nada do documento — em
        // cidades menores um CEP cobre um range de ruas, então a resposta da
        // API pode ser o nome "oficial" do range e divergir do comprovante real.
        const enderecoAtual = typeof normalized.endereco === "string" ? normalized.endereco.trim() : "";
        if (!enderecoAtual && cepData.endereco) {
          normalized.endereco = cepData.endereco;
          normalized.confidence.endereco = 0.9;
        }
        // Bairro/cidade/estado: preenche só se estiver vazio (respeita extração).
        for (const k of ["bairro", "cidade", "estado"] as const) {
          const atual = typeof normalized[k] === "string" ? normalized[k].trim() : "";
          if (!atual && cepData[k]) {
            normalized[k] = cepData[k];
            normalized.confidence[k] = 0.9;
          }
        }
      }
    }
    if (typeof normalized.cep_secundario === "string" && normalized.cep_secundario.replace(/\D/g, "").length === 8) {
      const cepData = await lookupCep(normalized.cep_secundario);
      if (cepData) {
        normalized.cep_secundario = cepData.cep;
        if (cepData.endereco) normalized.endereco_secundario = cepData.endereco;
        for (const [k, v] of Object.entries({
          bairro_secundario: cepData.bairro,
          cidade_secundario: cepData.cidade,
          estado_secundario: cepData.estado,
        })) {
          const atual = typeof normalized[k] === "string" ? normalized[k].trim() : "";
          if (!atual && v) normalized[k] = v;
        }
      }
    }
    // Resolve CNPJ → dados públicos da empresa (BrasilAPI). O cliente é
    // pessoa física; o CNPJ aqui serve como comprovação de ocupação lícita
    // (Estatuto do Desarmamento), não cadastra a empresa como entidade
    // própria. Enriquece apenas profissão (se vazia) e observações.
    if (typeof normalized.cnpj === "string" && normalized.cnpj.replace(/\D/g, "").length === 14) {
      if (!cnpjValido(normalized.cnpj)) {
        // Dígito verificador não bate — provável erro de leitura da IA/OCR.
        // Avisa a equipe em vez de falhar em silêncio na consulta à API.
        normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : [];
        normalized.warnings.push(`CNPJ extraído (${normalized.cnpj}) é inválido (dígito verificador não confere) — confira o documento e corrija manualmente.`);
      } else {
        const cnpjData = await lookupCnpj(normalized.cnpj);
        if (cnpjData) {
          normalized.confidence = normalized.confidence || {};
          // Campos próprios de "Ocupação Lícita (CNPJ)" — nunca tocam em
          // profissão, que fica livre para o cliente/equipe preencher.
          const enderecoEmpresa = [
            cnpjData.logradouro,
            cnpjData.numero && `nº ${cnpjData.numero}`,
            cnpjData.complemento,
            cnpjData.bairro,
            cnpjData.municipio && cnpjData.uf ? `${cnpjData.municipio}/${cnpjData.uf}` : cnpjData.municipio,
            cnpjData.cep && `CEP ${cnpjData.cep}`,
          ].filter(Boolean).join(", ");
          normalized.ocupacao_licita_cnpj = normalized.cnpj;
          normalized.ocupacao_licita_razao_social = cnpjData.razao_social || null;
          normalized.ocupacao_licita_nome_fantasia = cnpjData.nome_fantasia || null;
          normalized.ocupacao_licita_atividade = cnpjData.cnae_fiscal_descricao || null;
          normalized.ocupacao_licita_endereco = enderecoEmpresa || null;
          normalized.ocupacao_licita_telefone = cnpjData.ddd_telefone_1 || null;
          normalized.confidence.ocupacao_licita_cnpj = 0.9;
        }
      }
    }
    // Máscaras de exibição — CPF/CEP/telefones/RG.
    if (normalized.cpf) normalized.cpf = formatCpf(normalized.cpf);
    if (normalized.cep) normalized.cep = formatCep(normalized.cep);
    if (normalized.cep_secundario) normalized.cep_secundario = formatCep(normalized.cep_secundario);
    if (normalized.celular) normalized.celular = formatTelefone(normalized.celular);
    if (normalized.telefone_secundario) normalized.telefone_secundario = formatTelefone(normalized.telefone_secundario);
    if (normalized.rg) normalized.rg = formatRg(normalized.rg);
    // Maiúsculas em todo campo de texto (exceto e-mail/senha/observações/warnings) —
    // aplicado por último, depois das máscaras acima (que não têm letras a afetar).
    for (const k of Object.keys(normalized)) {
      normalized[k] = upperFieldsExcept(k, normalized[k]);
    }
    // Strip empty strings so frontend "fill only empty" logic works cleanly
    for (const k of Object.keys(normalized)) {
      if (normalized[k] === "" && k !== "senha_gov_raw") delete normalized[k];
    }
    return json({ success: true, fields: normalized });
  } catch (err: any) {
    if (err?.message === "RATE_LIMIT") {
      return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
    }
    if (err?.message === "PAYMENT_REQUIRED") {
      return json({ error: "Créditos da IA esgotados. Contate o administrador." }, 402);
    }
    console.error("[qa-cliente-prefill]", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});