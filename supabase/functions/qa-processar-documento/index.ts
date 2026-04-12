import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ═══ DOCUMENT TYPE CATEGORIES ═══

type TipoDocProbatorio =
  | "boletim_ocorrencia"
  | "laudo_medico"
  | "laudo_psiquiatrico"
  | "laudo_psicologico"
  | "relatorio_clinico"
  | "atestado_medico"
  | "notificacao_administrativa"
  | "indeferimento_administrativo"
  | "certidao"
  | "documento_pessoal"
  | "comprovante_residencia"
  | "outro_documento_probatorio";

interface DadosEstruturados {
  tipo_documental: TipoDocProbatorio;
  campos: Record<string, string | string[] | boolean | null>;
  indicadores_risco: string[];
  leitura_integral: boolean;
  total_caracteres: number;
  total_blocos: number;
  pipeline_usado: string;
}

// ═══ BO HEURISTICS ═══
const BO_PATTERNS = [
  /boletim\s+de\s+ocorr[eê]ncia/i,
  /\bB\.?O\.?\b/,
  /ocorr[eê]ncia\s+policial/i,
  /registro\s+policial/i,
  /registro\s+de\s+ocorr[eê]ncia/i,
  /\bTCO\b/i,
];

function extractBo(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const numMatch = text.match(/(?:B\.?O\.?|boletim|ocorr[eê]ncia|registro)\s*(?:n[ºo°]?\.?\s*|:?\s*)(\d[\d./-]+\d)/i);
  campos.numero_bo = numMatch?.[1]?.trim() || null;

  const dataFato = text.match(/data\s+(?:do\s+)?fato[:\s]+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_fato = dataFato?.[1] || null;

  const dataReg = text.match(/data\s+(?:do\s+)?registro[:\s]+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_registro = dataReg?.[1] || null;

  if (!campos.data_fato && !campos.data_registro) {
    const anyDate = text.substring(0, 500).match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);
    if (anyDate) campos.data_registro = anyDate[1];
  }

  const natureza = text.match(/(?:natureza|tipo\s+(?:da\s+)?ocorr[eê]ncia|tipifica[çc][ãa]o)[:\s]+([^\n]{5,80})/i);
  campos.tipo_ocorrencia = natureza?.[1]?.trim() || null;

  const local = text.match(/(?:local\s+(?:do\s+)?fato|local\s+da\s+ocorr[eê]ncia|endere[çc]o)[:\s]+([^\n]{5,120})/i);
  campos.local_fato = local?.[1]?.trim() || null;

  campos.menciona_arma = /arma|faca|facão|rev[oó]lver|pistola|espingarda|arma\s+(?:de\s+fogo|branca)|objeto\s+cortante/i.test(text);
  campos.menciona_familiares = /fam[ií]lia|esposa|marido|filh[oa]|m[ãa]e|pai|irm[ãa]o|companheira|c[oô]njuge|menor|crian[çc]a/i.test(text);
  campos.relacao_profissional = /profiss[ãa]o|trabalho|emprego|com[eé]rcio|empresa|estabelecimento|atividade\s+profissional|transporte\s+de\s+valores|seguran[çc]a\s+(?:privada|patrimonial)|vigilante/i.test(text);
  campos.reiteracao = /reiter|recorr[eê]n|novamente|outra\s+vez|mais\s+uma\s+vez|j[aá]\s+(?:havia|houve|tinha)|anterior|pregressa|reincid|pela\s+\d+[ªa]\s+vez/i.test(text);

  const riskPatterns: [RegExp, string][] = [
    [/amea[çc]a/i, "ameaça"], [/agress[ãa]o/i, "agressão"], [/les[ãa]o\s+corporal/i, "lesão corporal"],
    [/intimida[çc][ãa]o/i, "intimidação"], [/persegui[çc][ãa]o/i, "perseguição"],
    [/risco\s+(?:de\s+)?(?:vida|morte|integridade)/i, "risco à vida"],
    [/viol[eê]ncia\s+dom[eé]stica/i, "violência doméstica"], [/tentativa\s+de\s+homic[ií]dio/i, "tentativa de homicídio"],
    [/roubo/i, "roubo"], [/furto/i, "furto"], [/invas[ãa]o/i, "invasão"],
    [/disparo/i, "disparo de arma"], [/extors[ãa]o/i, "extorsão"], [/sequest/i, "sequestro"],
  ];
  const riscos = riskPatterns.filter(([p]) => p.test(text)).map(([, l]) => l);

  return {
    tipo_documental: "boletim_ocorrencia",
    campos,
    indicadores_risco: riscos,
    leitura_integral: true,
    total_caracteres: text.length,
    total_blocos: 1,
    pipeline_usado: "qa-processar-documento/bo",
  };
}

// ═══ LAUDO HEURISTICS ═══
const LAUDO_PATTERNS = [
  /laudo\s+m[eé]dico/i, /laudo\s+psiqui[aá]trico/i, /laudo\s+psicol[oó]gico/i,
  /relat[oó]rio\s+cl[ií]nico/i, /relat[oó]rio\s+m[eé]dico/i, /relat[oó]rio\s+terap[eê]utico/i,
  /atestado\s+m[eé]dico/i, /prontu[aá]rio/i, /avalia[çc][ãa]o\s+psicol[oó]gica/i,
  /parecer\s+m[eé]dico/i, /documento\s+hospitalar/i,
];

function detectLaudoSubtype(titulo: string, tipo: string, text: string): TipoDocProbatorio {
  const combined = `${titulo} ${tipo}`.toLowerCase();
  if (/psiqui[aá]tr/i.test(combined)) return "laudo_psiquiatrico";
  if (/psicol[oó]g/i.test(combined)) return "laudo_psicologico";
  if (/atestado/i.test(combined)) return "atestado_medico";
  if (/relat[oó]rio\s+cl[ií]n/i.test(combined)) return "relatorio_clinico";
  // Check content
  const header = text.substring(0, 800);
  if (/psiqui[aá]tr/i.test(header)) return "laudo_psiquiatrico";
  if (/psicol[oó]g/i.test(header)) return "laudo_psicologico";
  return "laudo_medico";
}

function extractLaudo(text: string, subtype: TipoDocProbatorio): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  // Professional
  const profMatch = text.match(/(?:Dr\.?|Dra\.?|Psic[oó]log[oa]|M[eé]dic[oa]|Profissional|CRM|CRP)\s*[:\s]*([^\n]{3,80})/i);
  campos.profissional_emissor = profMatch?.[1]?.trim() || null;

  // Specialty
  const espMatch = text.match(/(?:especialidade|especialista\s+em)[:\s]+([^\n]{3,60})/i);
  campos.especialidade = espMatch?.[1]?.trim() || null;

  // Date
  const dateMatch = text.match(/(?:data|emitido\s+em|em)\s*[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_documento = dateMatch?.[1] || null;

  // CID / Diagnosis
  const cidMatch = text.match(/(?:CID|diagn[oó]stico|hip[oó]tese\s+diagn[oó]stica)[:\s-]*([^\n]{3,120})/i);
  campos.diagnostico = cidMatch?.[1]?.trim() || null;

  // CRM / CRP
  const crmMatch = text.match(/(?:CRM|CRP)[:\s]*([^\n,]{3,30})/i);
  campos.registro_profissional = crmMatch?.[1]?.trim() || null;

  // Symptoms
  const sintomas: string[] = [];
  const sintomaPatterns = [
    /ansiedade/i, /depress[ãa]o/i, /ins[oô]nia/i, /estresse\s+p[oó]s-traum[aá]tico/i,
    /TEPT/i, /p[aâ]nico/i, /medo/i, /fobia/i, /trauma/i, /ideação\s+suicida/i,
    /angústia/i, /ang[uú]stia/i, /irritabilidade/i, /hipervigilância/i,
    /pesadelos/i, /flashback/i, /isola/i, /paranoia/i,
  ];
  sintomaPatterns.forEach(p => { if (p.test(text)) sintomas.push(p.source.replace(/\\/g, "")); });
  campos.sintomas_detectados = sintomas.length > 0 ? sintomas : null;

  // Recommendation
  const recMatch = text.match(/(?:recomend|orient|encaminh|prescrev|indica[çc][ãa]o)[:\s]*([^\n]{5,200})/i);
  campos.recomendacao = recMatch?.[1]?.trim() || null;

  // Impact
  campos.impacto_funcional = /(?:incapacidad|afastamento|restrição|limitação|impacto\s+funcional|prejuízo)/i.test(text);
  campos.impacto_psiquico = /(?:abalo\s+psíquico|sofrimento\s+psí|desestabiliza|fragilidade\s+emocional|vulnerabilidade)/i.test(text);
  campos.necessidade_protecao = /(?:prote[çc][ãa]o|seguran[çc]a|afastamento|risco|salvaguarda)/i.test(text);

  const riscos: string[] = [];
  if (campos.impacto_funcional) riscos.push("impacto funcional");
  if (campos.impacto_psiquico) riscos.push("abalo psíquico");
  if (campos.necessidade_protecao) riscos.push("necessidade de proteção");
  if (sintomas.length >= 3) riscos.push("quadro clínico relevante");

  return {
    tipo_documental: subtype,
    campos,
    indicadores_risco: riscos,
    leitura_integral: true,
    total_caracteres: text.length,
    total_blocos: 1,
    pipeline_usado: `qa-processar-documento/${subtype}`,
  };
}

// ═══ NOTIFICAÇÃO / INDEFERIMENTO HEURISTICS ═══
const NOTIFICACAO_PATTERNS = [
  /notifica[çc][ãa]o/i, /intima[çc][ãa]o/i, /comunica[çc][ãa]o/i,
];
const INDEFERIMENTO_PATTERNS = [
  /indeferimento/i, /despacho\s+denegat[oó]rio/i, /despacho\s+de\s+indeferimento/i,
  /decis[ãa]o\s+(?:administrativa|desfavor[aá]vel)/i,
];

function extractNotificacao(text: string, isIndeferimento: boolean): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const numProc = text.match(/(?:processo|protocolo|n[ºo°])\s*[:\s]*(\d[\d./-]+\d)/i);
  campos.numero_processo = numProc?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|em)\s*[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const autoridadeMatch = text.match(/(?:delegad[oa]|superintendente|chefe|coordenador|diretor|autoridade)[:\s]*([^\n]{3,80})/i);
  campos.autoridade_emissora = autoridadeMatch?.[1]?.trim() || null;

  const prazoMatch = text.match(/(?:prazo)\s*(?:de)?\s*(\d+)\s*(?:dias?|horas?)/i);
  campos.prazo = prazoMatch ? `${prazoMatch[1]} ${prazoMatch[2] || "dias"}` : null;

  // Fundamento
  const fundMatch = text.match(/(?:fundamenta[çc][ãa]o|motivo|fundamento|com\s+base\s+em|nos\s+termos\s+d[ao])[:\s]*([^\n]{10,200})/i);
  campos.fundamento = fundMatch?.[1]?.trim() || null;

  // Pendências
  const pendencias: string[] = [];
  const pendPatterns = [
    /document[oa]?\s+(?:n[ãa]o\s+)?apresentad/i, /falta\s+de/i, /aus[eê]ncia\s+de/i,
    /irregular/i, /desconform/i, /n[ãa]o\s+atend/i, /pendente/i, /exigência/i,
  ];
  pendPatterns.forEach(p => { if (p.test(text)) pendencias.push(p.source.replace(/\\/g, "")); });
  campos.pendencias_apontadas = pendencias.length > 0 ? pendencias : null;

  // Vícios
  campos.vicio_motivacao = /(?:motiva[çc][ãa]o\s+(?:insuficiente|gen[eé]rica|ausente))|(?:aus[eê]ncia\s+de\s+motiva)/i.test(text);
  campos.erro_material = /(?:erro\s+material|equívoco|inconsist[eê]ncia|erro\s+de\s+fato)/i.test(text);
  campos.omissao = /(?:omiss[ãa]o|n[ãa]o\s+considerou|deixou\s+de\s+analisar|ignorou)/i.test(text);
  campos.contradicao = /(?:contradi[çc][ãa]o|contradit[oó]rio|incoer[eê]ncia)/i.test(text);

  const riscos: string[] = [];
  if (campos.vicio_motivacao) riscos.push("vício de motivação");
  if (campos.erro_material) riscos.push("erro material");
  if (campos.omissao) riscos.push("omissão");
  if (campos.contradicao) riscos.push("contradição");

  return {
    tipo_documental: isIndeferimento ? "indeferimento_administrativo" : "notificacao_administrativa",
    campos,
    indicadores_risco: riscos,
    leitura_integral: true,
    total_caracteres: text.length,
    total_blocos: 1,
    pipeline_usado: `qa-processar-documento/${isIndeferimento ? "indeferimento" : "notificacao"}`,
  };
}

// ═══ CERTIDÃO / DOC PESSOAL ═══
function extractCertidao(text: string, tipo: TipoDocProbatorio): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const nomeMatch = text.match(/(?:nome|titular|requerente)[:\s]+([^\n]{3,80})/i);
  campos.nome = nomeMatch?.[1]?.trim() || null;

  const cpfMatch = text.match(/(?:CPF|C\.P\.F\.?)\s*[:\s]*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
  campos.cpf = cpfMatch?.[1]?.trim() || null;

  const rgMatch = text.match(/(?:RG|identidade|R\.G\.?)\s*[:\s]*([\d./-]+)/i);
  campos.rg = rgMatch?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|emitido|expedido)\s*[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const orgaoMatch = text.match(/(?:[oó]rg[ãa]o\s+emissor|expedid[oa]\s+(?:pel[oa]|por))[:\s]+([^\n]{3,60})/i);
  campos.orgao_emissor = orgaoMatch?.[1]?.trim() || null;

  const endMatch = text.match(/(?:endere[çc]o|resid[eê]ncia)[:\s]+([^\n]{5,120})/i);
  campos.endereco = endMatch?.[1]?.trim() || null;

  return {
    tipo_documental: tipo,
    campos,
    indicadores_risco: [],
    leitura_integral: true,
    total_caracteres: text.length,
    total_blocos: 1,
    pipeline_usado: `qa-processar-documento/${tipo}`,
  };
}

// ═══ DOCUMENT TYPE DETECTOR ═══
function detectDocType(titulo: string, tipoInformado: string, text: string): TipoDocProbatorio {
  const combined = `${titulo} ${tipoInformado}`.toLowerCase();
  const header = text.substring(0, 800).toLowerCase();

  // BO
  for (const p of BO_PATTERNS) { if (p.test(combined) || p.test(header)) return "boletim_ocorrencia"; }

  // Laudos
  for (const p of LAUDO_PATTERNS) {
    if (p.test(combined) || p.test(header)) return detectLaudoSubtype(titulo, tipoInformado, text);
  }

  // Notificação
  for (const p of INDEFERIMENTO_PATTERNS) { if (p.test(combined) || p.test(header)) return "indeferimento_administrativo"; }
  for (const p of NOTIFICACAO_PATTERNS) { if (p.test(combined) || p.test(header)) return "notificacao_administrativa"; }

  // Certidão
  if (/certid[ãa]o/i.test(combined) || /certid[ãa]o/i.test(header)) return "certidao";
  if (/comprovante\s+(?:de\s+)?resid/i.test(combined)) return "comprovante_residencia";
  if (/(?:documento\s+pessoal|identidade|CPF|RG|CNH)/i.test(combined)) return "documento_pessoal";

  // Tipo informado direto
  const tipoMap: Record<string, TipoDocProbatorio> = {
    boletim_ocorrencia: "boletim_ocorrencia",
    laudo_medico: "laudo_medico",
    laudo_psiquiatrico: "laudo_psiquiatrico",
    laudo_psicologico: "laudo_psicologico",
    relatorio_clinico: "relatorio_clinico",
    atestado_medico: "atestado_medico",
    notificacao: "notificacao_administrativa",
    notificacao_administrativa: "notificacao_administrativa",
    indeferimento: "indeferimento_administrativo",
    indeferimento_administrativo: "indeferimento_administrativo",
    certidao: "certidao",
    documento_pessoal: "documento_pessoal",
    comprovante: "comprovante_residencia",
    comprovante_residencia: "comprovante_residencia",
  };
  if (tipoMap[tipoInformado]) return tipoMap[tipoInformado];

  return "outro_documento_probatorio";
}

// ═══ MAIN PROCESSOR ═══
function processarPorTipo(text: string, tipoDetectado: TipoDocProbatorio, titulo: string, tipoInformado: string): DadosEstruturados {
  switch (tipoDetectado) {
    case "boletim_ocorrencia":
      return extractBo(text);
    case "laudo_medico":
    case "laudo_psiquiatrico":
    case "laudo_psicologico":
    case "relatorio_clinico":
    case "atestado_medico":
      return extractLaudo(text, tipoDetectado);
    case "notificacao_administrativa":
      return extractNotificacao(text, false);
    case "indeferimento_administrativo":
      return extractNotificacao(text, true);
    case "certidao":
    case "documento_pessoal":
    case "comprovante_residencia":
      return extractCertidao(text, tipoDetectado);
    default:
      return {
        tipo_documental: tipoDetectado,
        campos: {},
        indicadores_risco: [],
        leitura_integral: true,
        total_caracteres: text.length,
        total_blocos: 1,
        pipeline_usado: "qa-processar-documento/generico",
      };
  }
}

// ═══ EDGE FUNCTION HANDLER ═══
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { documento_id, user_id } = await req.json();
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("qa_documentos_conhecimento")
      .select("id, titulo, tipo_documento, texto_extraido, resumo_extraido, papel_documento, caso_id, categoria")
      .eq("id", documento_id)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const text = doc.texto_extraido || doc.resumo_extraido || "";
    if (!text || text.length < 10) {
      return new Response(JSON.stringify({ error: "Texto extraído insuficiente", dados_estruturados: null }), {
        status: 422, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    // Detect type
    const tipoDetectado = detectDocType(doc.titulo || "", doc.tipo_documento || doc.categoria || "", text);
    console.log(`Document ${documento_id}: detected type = ${tipoDetectado}`);

    // Process
    const dados = processarPorTipo(text, tipoDetectado, doc.titulo || "", doc.tipo_documento || "");

    // Multi-block for long documents
    if (text.length > 15000) {
      const BLOCK = 15000;
      const blocks = Math.ceil(text.length / BLOCK);
      dados.total_blocos = blocks;
      // For long docs, merge structured data from each block
      for (let b = 1; b < blocks; b++) {
        const blockText = text.substring(b * BLOCK, (b + 1) * BLOCK);
        const blockData = processarPorTipo(blockText, tipoDetectado, doc.titulo || "", doc.tipo_documento || "");
        // Merge risk indicators
        blockData.indicadores_risco.forEach(r => {
          if (!dados.indicadores_risco.includes(r)) dados.indicadores_risco.push(r);
        });
        // Merge non-null campos
        for (const [k, v] of Object.entries(blockData.campos)) {
          if (v && !dados.campos[k]) dados.campos[k] = v;
        }
      }
    }

    // Save structured data to document
    await supabase.from("qa_documentos_conhecimento")
      .update({
        tipo_documento: tipoDetectado,
        metodo_extracao: dados.pipeline_usado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documento_id);

    // Audit log
    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: user_id || null,
        entidade: "qa_documentos_conhecimento",
        entidade_id: documento_id,
        acao: "processamento_tipado",
        detalhes_json: {
          tipo_detectado: tipoDetectado,
          tipo_informado: doc.tipo_documento,
          pipeline: dados.pipeline_usado,
          total_chars: dados.total_caracteres,
          total_blocos: dados.total_blocos,
          leitura_integral: dados.leitura_integral,
          campos_extraidos: Object.keys(dados.campos).filter(k => dados.campos[k] !== null),
          indicadores_risco: dados.indicadores_risco,
        },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      documento_id,
      tipo_detectado: tipoDetectado,
      dados_estruturados: dados,
    }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("qa-processar-documento error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
