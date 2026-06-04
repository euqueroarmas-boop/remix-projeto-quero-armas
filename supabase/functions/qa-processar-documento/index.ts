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
  | "requerimento_sinarm"
  | "funcional_ocupacao"
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
  /boletim\s+de\s+ocorr[eê]ncia/i, /\bB\.?O\.?\b/, /ocorr[eê]ncia\s+policial/i,
  /registro\s+policial/i, /registro\s+de\s+ocorr[eê]ncia/i, /\bTCO\b/i,
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

  const local = text.match(/(?:local\s+(?:do\s+)?fato|local\s+da\s+ocorr[eê]ncia|endere[çc]o\s+(?:do\s+)?fato)[:\s]+([^\n]{5,120})/i);
  campos.local_fato = local?.[1]?.trim() || null;

  // Delegacia
  const delegacia = text.match(/(?:delegacia|distrito\s+policial|unidade\s+policial|DP)[:\s]+([^\n]{5,80})/i);
  campos.delegacia = delegacia?.[1]?.trim() || null;

  // Envolvidos
  const vitima = text.match(/(?:v[ií]tima|comunicante|ofendid[oa]|declarante)[:\s]+([^\n]{3,80})/i);
  campos.vitima = vitima?.[1]?.trim() || null;
  const autor = text.match(/(?:autor|suspeito|indiciado|acusado|agressor)[:\s]+([^\n]{3,80})/i);
  campos.autor = autor?.[1]?.trim() || null;

  // Narrativa — capturar bloco extenso
  const narrativa = text.match(/(?:hist[oó]rico|relato|narrativa|descri[çc][ãa]o\s+(?:do\s+)?fato|fatos?)[:\s]*\n?([\s\S]{20,2000}?)(?=\n\s*(?:[A-Z]{2,}|Assinatura|Delegad|Protocolo|\d{2}\/\d{2}\/\d{4}|$))/i);
  campos.narrativa_resumo = narrativa?.[1]?.trim()?.substring(0, 500) || null;

  campos.menciona_arma = /arma|faca|facão|rev[oó]lver|pistola|espingarda|arma\s+(?:de\s+fogo|branca)|objeto\s+(?:cortante|perfurante)/i.test(text);
  campos.menciona_familiares = /fam[ií]lia|esposa|marido|filh[oa]|m[ãa]e|pai|irm[ãa]o|companheira|c[oô]njuge|menor|crian[çc]a/i.test(text);
  campos.relacao_profissional = /profiss[ãa]o|trabalho|emprego|com[eé]rcio|empresa|estabelecimento|atividade\s+profissional|transporte\s+de\s+valores|seguran[çc]a\s+(?:privada|patrimonial)|vigilante/i.test(text);
  campos.reiteracao = /reiter|recorr[eê]n|novamente|outra\s+vez|mais\s+uma\s+vez|j[aá]\s+(?:havia|houve|tinha)|anterior|pregressa|reincid|pela\s+\d+[ªa]\s+vez/i.test(text);
  campos.menciona_medida_protetiva = /medida\s+protetiva|Lei\s+(?:Maria\s+da\s+Penha|11\.340)/i.test(text);

  const riskPatterns: [RegExp, string][] = [
    [/amea[çc]a\s+(?:de\s+)?morte/i, "ameaça de morte"], [/amea[çc]a/i, "ameaça"],
    [/agress[ãa]o\s+f[ií]sica/i, "agressão física"], [/agress[ãa]o/i, "agressão"],
    [/les[ãa]o\s+corporal/i, "lesão corporal"], [/intimida[çc][ãa]o/i, "intimidação"],
    [/persegui[çc][ãa]o/i, "perseguição"], [/risco\s+(?:de\s+)?(?:vida|morte|integridade)/i, "risco à vida"],
    [/viol[eê]ncia\s+dom[eé]stica/i, "violência doméstica"], [/tentativa\s+de\s+homic[ií]dio/i, "tentativa de homicídio"],
    [/roubo/i, "roubo"], [/furto/i, "furto"], [/invas[ãa]o/i, "invasão de domicílio"],
    [/disparo/i, "disparo de arma"], [/extors[ãa]o/i, "extorsão"], [/sequest/i, "sequestro"],
    [/estupro/i, "estupro"], [/c[aá]rcere\s+privado/i, "cárcere privado"],
    [/dano\s+(?:ao\s+)?patrim[oô]nio/i, "dano patrimonial"],
  ];
  const riscos = riskPatterns.filter(([p]) => p.test(text)).map(([, l]) => l);

  return {
    tipo_documental: "boletim_ocorrencia", campos, indicadores_risco: riscos,
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
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
  const header = text.substring(0, 800);
  if (/psiqui[aá]tr/i.test(header)) return "laudo_psiquiatrico";
  if (/psicol[oó]g/i.test(header)) return "laudo_psicologico";
  return "laudo_medico";
}

function extractLaudo(text: string, subtype: TipoDocProbatorio): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const profMatch = text.match(/(?:Dr\.?|Dra\.?|Psic[oó]log[oa]|M[eé]dic[oa]|Profissional)\s*[:\s]*([^\n]{3,80})/i);
  campos.profissional_emissor = profMatch?.[1]?.trim() || null;

  const crmMatch = text.match(/(?:CRM|CRP)\s*[:\s/]*([^\n,;]{3,30})/i);
  campos.registro_profissional = crmMatch?.[1]?.trim() || null;

  const espMatch = text.match(/(?:especialidade|especialista\s+em|[aá]rea)[:\s]+([^\n]{3,60})/i);
  campos.especialidade = espMatch?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|emitido\s+em|em)\s*[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_documento = dateMatch?.[1] || null;

  // Paciente
  const paciente = text.match(/(?:paciente|nome|avaliand[oa])[:\s]+([^\n]{3,80})/i);
  campos.paciente = paciente?.[1]?.trim() || null;

  // CID / Diagnosis
  const cidMatch = text.match(/(?:CID[-\s]?10?\s*[:\s-]*[A-Z]\d{1,3}(?:\.\d{1,2})?)/i);
  campos.codigo_cid = cidMatch?.[0]?.trim() || null;
  const diagMatch = text.match(/(?:diagn[oó]stico|hip[oó]tese\s+diagn[oó]stica|conclus[ãa]o\s+diagn[oó]stica)[:\s-]*([^\n]{3,200})/i);
  campos.diagnostico = diagMatch?.[1]?.trim() || null;

  // Histórico clínico
  const histMatch = text.match(/(?:hist[oó]rico|anamnese|queixa\s+principal|relato)[:\s]*([^\n]{10,400})/i);
  campos.historico_clinico = histMatch?.[1]?.trim()?.substring(0, 400) || null;

  // Sintomas — expanded
  const sintomas: string[] = [];
  const sintomaPatterns: [RegExp, string][] = [
    [/ansiedade/i, "ansiedade"], [/depress[ãa]o/i, "depressão"],
    [/ins[oô]nia/i, "insônia"], [/estresse\s+p[oó]s-traum[aá]tico|TEPT/i, "TEPT"],
    [/p[aâ]nico/i, "pânico"], [/medo\s+(?:constante|intenso|crônico)/i, "medo intenso"],
    [/fobia/i, "fobia"], [/trauma/i, "trauma"],
    [/idea[çc][ãa]o\s+suicida/i, "ideação suicida"],
    [/ang[uú]stia/i, "angústia"], [/irritabilidade/i, "irritabilidade"],
    [/hipervigilância/i, "hipervigilância"], [/pesadelos/i, "pesadelos"],
    [/flashback/i, "flashback"], [/isolamento/i, "isolamento social"],
    [/paranoia/i, "paranoia"], [/choro\s+(?:frequente|constante|imotivado)/i, "choro frequente"],
    [/perda\s+de\s+apetite/i, "perda de apetite"], [/baixa\s+autoestima/i, "baixa autoestima"],
    [/dificuldade\s+de\s+concentra/i, "dificuldade de concentração"],
    [/agita[çc][ãa]o/i, "agitação"], [/taquicardia/i, "taquicardia"],
    [/cefaleia|dor\s+de\s+cabe[çc]a/i, "cefaleia"], [/tremor/i, "tremor"],
  ];
  sintomaPatterns.forEach(([p, l]) => { if (p.test(text)) sintomas.push(l); });
  campos.sintomas_detectados = sintomas.length > 0 ? sintomas : null;

  // Medicação
  const medMatch = text.match(/(?:medica[çc][ãa]o|medicamento|prescri[çc][ãa]o|uso\s+de)[:\s]*([^\n]{5,200})/i);
  campos.medicacao = medMatch?.[1]?.trim() || null;

  // Recommendation
  const recMatch = text.match(/(?:recomend|orient|encaminh|prescrev|indica[çc][ãa]o|conduta)[:\s]*([^\n]{5,300})/i);
  campos.recomendacao = recMatch?.[1]?.trim() || null;

  // Prognóstico
  const progMatch = text.match(/(?:progn[oó]stico|evolu[çc][ãa]o|perspectiva)[:\s]*([^\n]{5,200})/i);
  campos.prognostico = progMatch?.[1]?.trim() || null;

  // Tempo de acompanhamento
  const tempoMatch = text.match(/(?:acompanhamento|tratamento)\s+(?:h[aá]|desde|por)\s+(\d+)\s*(anos?|meses?|semanas?)/i);
  campos.tempo_acompanhamento = tempoMatch ? `${tempoMatch[1]} ${tempoMatch[2]}` : null;

  // Impact
  campos.impacto_funcional = /(?:incapacidad|afastamento|restrição|limitação|impacto\s+funcional|prejuízo\s+(?:funcional|laborat))/i.test(text);
  campos.impacto_psiquico = /(?:abalo\s+ps[ií]quic|sofrimento\s+ps[ií]|desestabiliza|fragilidade\s+emocional|vulnerabilidade\s+emocional)/i.test(text);
  campos.necessidade_protecao = /(?:prote[çc][ãa]o|seguran[çc]a|afastamento|risco|salvaguarda|acolhimento)/i.test(text);
  campos.aptidao_psicologica = /(?:apto|inapto|aptid[ãa]o|capacidade\s+psicol[oó]gica)/i.test(text);

  const riscos: string[] = [];
  if (campos.impacto_funcional) riscos.push("impacto funcional");
  if (campos.impacto_psiquico) riscos.push("abalo psíquico");
  if (campos.necessidade_protecao) riscos.push("necessidade de proteção");
  if (sintomas.length >= 3) riscos.push("quadro clínico relevante");
  if (sintomas.includes("ideação suicida")) riscos.push("ideação suicida");
  if (sintomas.includes("TEPT")) riscos.push("TEPT documentado");

  return {
    tipo_documental: subtype, campos, indicadores_risco: riscos,
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: `qa-processar-documento/${subtype}`,
  };
}

// ═══ NOTIFICAÇÃO / INDEFERIMENTO ═══
const NOTIFICACAO_PATTERNS = [/notifica[çc][ãa]o/i, /intima[çc][ãa]o/i, /comunica[çc][ãa]o/i];
const INDEFERIMENTO_PATTERNS = [/indeferimento/i, /despacho\s+denegat[oó]rio/i, /despacho\s+de\s+indeferimento/i, /decis[ãa]o\s+(?:administrativa|desfavor[aá]vel)/i];

function extractNotificacao(text: string, isIndeferimento: boolean): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const numProc = text.match(/(?:processo|protocolo|n[ºo°]|auto)\s*[:\s]*(\d[\d./-]+\d)/i);
  campos.numero_processo = numProc?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|em)\s*[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const autoridadeMatch = text.match(/(?:delegad[oa]|superintendente|chefe|coordenador|diretor|autoridade|servidor)[:\s]*([^\n]{3,80})/i);
  campos.autoridade_emissora = autoridadeMatch?.[1]?.trim() || null;

  const prazoMatch = text.match(/(?:prazo)\s*(?:de)?\s*(\d+)\s*(dias?|horas?|[uú]teis)/i);
  campos.prazo = prazoMatch ? `${prazoMatch[1]} ${prazoMatch[2]}` : null;

  const fundMatch = text.match(/(?:fundamenta[çc][ãa]o|motivo|fundamento|com\s+base\s+em|nos\s+termos\s+d[ao])[:\s]*([^\n]{10,300})/i);
  campos.fundamento = fundMatch?.[1]?.trim() || null;

  // Exigências listadas
  const exigencias: string[] = [];
  const exigRegex = /(?:\d+[\).\s]|[-•])\s*([^\n]{10,200})/g;
  let match;
  while ((match = exigRegex.exec(text)) !== null) {
    if (exigencias.length < 10) exigencias.push(match[1].trim());
  }
  campos.exigencias_listadas = exigencias.length > 0 ? exigencias : null;

  const pendencias: string[] = [];
  const pendPatterns: [RegExp, string][] = [
    [/document[oa]?\s+(?:n[ãa]o\s+)?apresentad/i, "documento não apresentado"],
    [/falta\s+de/i, "falta de documento/requisito"],
    [/aus[eê]ncia\s+de/i, "ausência de requisito"],
    [/irregular/i, "irregularidade"],
    [/desconform/i, "desconformidade"],
    [/n[ãa]o\s+atend/i, "requisito não atendido"],
    [/pendente/i, "pendência"],
    [/exig[eê]ncia/i, "exigência administrativa"],
    [/intempestiv/i, "intempestividade"],
    [/vencid[oa]/i, "prazo/documento vencido"],
  ];
  pendPatterns.forEach(([p, l]) => { if (p.test(text)) pendencias.push(l); });
  campos.pendencias_apontadas = pendencias.length > 0 ? pendencias : null;

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
    campos, indicadores_risco: riscos, leitura_integral: true,
    total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: `qa-processar-documento/${isIndeferimento ? "indeferimento" : "notificacao"}`,
  };
}

// ═══ DOCUMENTO PESSOAL (CNH / RG / CPF / Identidade) ═══
function extractDocPessoal(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const nomeMatch = text.match(/(?:nome\s*(?:completo)?|titular|portador|identificad[oa])[:\s]+([^\n]{3,80})/i);
  campos.nome_completo = nomeMatch?.[1]?.trim() || null;

  const cpfMatch = text.match(/(?:CPF|C\.P\.F\.?)\s*[:\s]*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
  campos.cpf = cpfMatch?.[1]?.trim() || null;

  const rgMatch = text.match(/(?:RG|R\.G\.?|identidade|registro\s+geral)\s*[:\s]*([\d./-]+)/i);
  campos.rg = rgMatch?.[1]?.trim() || null;

  const orgaoMatch = text.match(/(?:[oó]rg[ãa]o\s+(?:emissor|expedidor)|expedid[oa]\s+(?:pel[oa]|por)|SSP|SDS|DETRAN|IFP|IGP|PC|SESP)[:\s/]*([^\n]{2,40})/i);
  campos.orgao_emissor = orgaoMatch?.[1]?.trim() || null;

  const nascMatch = text.match(/(?:data\s+(?:de\s+)?nascimento|nascid[oa]\s+em|DN)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_nascimento = nascMatch?.[1] || null;

  const filiacaoMae = text.match(/(?:m[ãa]e|filia[çc][ãa]o\s*(?:materna)?)[:\s]+([^\n]{3,80})/i);
  campos.filiacao_mae = filiacaoMae?.[1]?.trim() || null;
  const filiacaoPai = text.match(/(?:pai|filia[çc][ãa]o\s*paterna)[:\s]+([^\n]{3,80})/i);
  campos.filiacao_pai = filiacaoPai?.[1]?.trim() || null;

  const naturalidade = text.match(/(?:naturalidade|natural\s+de)[:\s]+([^\n]{3,60})/i);
  campos.naturalidade = naturalidade?.[1]?.trim() || null;

  const nacionalidade = text.match(/(?:nacionalidade)[:\s]+([^\n]{3,40})/i);
  campos.nacionalidade = nacionalidade?.[1]?.trim() || null;

  // CNH specific
  const cnhNum = text.match(/(?:CNH|habilita[çc][ãa]o|registro\s+nacional)\s*[:\sn°º]*(\d{9,11})/i);
  campos.numero_cnh = cnhNum?.[1] || null;
  const catMatch = text.match(/(?:categoria)[:\s]*([A-E]{1,2}(?:\/[A-E])?)/i);
  campos.categoria_cnh = catMatch?.[1] || null;
  const validadeMatch = text.match(/(?:validade|v[aá]lid[oa]\s+at[eé])[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.validade = validadeMatch?.[1] || null;

  const endMatch = text.match(/(?:endere[çc]o|resid[eê]ncia|domicílio)[:\s]+([^\n]{5,120})/i);
  campos.endereco = endMatch?.[1]?.trim() || null;

  const sexoMatch = text.match(/(?:sexo|g[eê]nero)[:\s]*(masculino|feminino|M|F)/i);
  campos.sexo = sexoMatch?.[1] || null;

  const dateMatch = text.match(/(?:data\s+(?:de\s+)?emiss[ãa]o|emitido\s+em|expedido\s+em)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_emissao = dateMatch?.[1] || null;

  return {
    tipo_documental: "documento_pessoal", campos, indicadores_risco: [],
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: "qa-processar-documento/documento_pessoal",
  };
}

// ═══ COMPROVANTE DE RESIDÊNCIA ═══
function extractComprovante(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const nomeMatch = text.match(/(?:nome|titular|cliente|consumidor|destinat[aá]rio|benefici[aá]rio)[:\s]+([^\n]{3,80})/i);
  campos.nome = nomeMatch?.[1]?.trim() || null;

  const logradouro = text.match(/(?:logradouro|endere[çc]o|rua|avenida|av\.?|travessa|alameda)[:\s,]*([^\n]{5,120})/i);
  campos.logradouro = logradouro?.[1]?.trim() || null;

  const numMatch = text.match(/(?:n[ºo°]?\.?\s*|número\s*[:\s]*)(\d{1,6})/i);
  campos.numero = numMatch?.[1] || null;

  const bairroMatch = text.match(/(?:bairro|setor)[:\s]+([^\n]{3,60})/i);
  campos.bairro = bairroMatch?.[1]?.trim() || null;

  const cidadeMatch = text.match(/(?:cidade|munic[ií]pio|localidade)[:\s]+([^\n]{3,60})/i);
  campos.cidade = cidadeMatch?.[1]?.trim() || null;

  const ufMatch = text.match(/(?:UF|estado)[:\s]+([A-Z]{2})/i);
  campos.uf = ufMatch?.[1]?.toUpperCase() || null;

  const cepMatch = text.match(/(?:CEP)[:\s]*(\d{5}[-.]?\d{3})/i);
  campos.cep = cepMatch?.[1] || null;

  const dateMatch = text.match(/(?:data|refer[eê]ncia|compet[eê]ncia|emiss[ãa]o|vencimento)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const emitente = text.match(/(?:empresa|concession[aá]ria|emitente|prestador|raz[ãa]o\s+social)[:\s]+([^\n]{3,80})/i);
  campos.emitente = emitente?.[1]?.trim() || null;

  // Tipo de conta
  const tipoConta = text.match(/(energia|[aá]gua|g[aá]s|telefone|internet|condom[ií]nio|IPTU|banco)/i);
  campos.tipo_conta = tipoConta?.[1] || null;

  return {
    tipo_documental: "comprovante_residencia", campos, indicadores_risco: [],
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: "qa-processar-documento/comprovante_residencia",
  };
}

// ═══ REQUERIMENTO SINARM ═══
const SINARM_PATTERNS = [/SINARM/i, /requerimento/i, /solicita[çc][ãa]o/i, /pedido\s+de\s+(?:registro|aquisi)/i];

function extractRequerimento(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const numProc = text.match(/(?:processo|protocolo|n[ºo°]|SINARM)\s*[:\s]*(\d[\d./-]+\d)/i);
  campos.numero_processo = numProc?.[1]?.trim() || null;

  const tipoReq = text.match(/(?:tipo\s+(?:de\s+)?requerimento|objeto|solicita[çc][ãa]o)[:\s]+([^\n]{5,100})/i);
  campos.tipo_requerimento = tipoReq?.[1]?.trim() || null;

  const status = text.match(/(?:status|situa[çc][ãa]o|andamento)[:\s]+([^\n]{3,60})/i);
  campos.status = status?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|protocola|registr)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const requerente = text.match(/(?:requerente|solicitante|interessado|nome)[:\s]+([^\n]{3,80})/i);
  campos.requerente = requerente?.[1]?.trim() || null;

  const cpf = text.match(/CPF\s*[:\s]*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
  campos.cpf = cpf?.[1] || null;

  const unidade = text.match(/(?:unidade|delegacia|[oó]rg[ãa]o\s+(?:responsável|competente))[:\s]+([^\n]{3,80})/i);
  campos.unidade_responsavel = unidade?.[1]?.trim() || null;

  // Arma específica
  const arma = text.match(/(?:arma|calibre|marca|modelo)[:\s]+([^\n]{3,80})/i);
  campos.dados_arma = arma?.[1]?.trim() || null;
  const calibre = text.match(/(?:calibre)[:\s]+([^\n]{3,30})/i);
  campos.calibre = calibre?.[1]?.trim() || null;

  campos.menciona_registro = /registro/i.test(text);
  campos.menciona_aquisicao = /aquisi[çc][ãa]o/i.test(text);
  campos.menciona_transferencia = /transfer[eê]ncia/i.test(text);

  return {
    tipo_documental: "requerimento_sinarm", campos, indicadores_risco: [],
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: "qa-processar-documento/requerimento_sinarm",
  };
}

// ═══ FUNCIONAL / OCUPAÇÃO LÍCITA ═══
function extractFuncional(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const nomeMatch = text.match(/(?:nome|servidor|funcion[aá]rio|empregado|contratad[oa])[:\s]+([^\n]{3,80})/i);
  campos.nome = nomeMatch?.[1]?.trim() || null;

  const cargo = text.match(/(?:cargo|fun[çc][ãa]o|ocupa[çc][ãa]o|profiss[ãa]o|atividade)[:\s]+([^\n]{3,80})/i);
  campos.cargo = cargo?.[1]?.trim() || null;

  const orgao = text.match(/(?:[oó]rg[ãa]o|institui[çc][ãa]o|empresa|empregador|entidade)[:\s]+([^\n]{3,80})/i);
  campos.orgao = orgao?.[1]?.trim() || null;

  const matricula = text.match(/(?:matr[ií]cula|registro\s+funcional|SIAPE|n[ºo°]\s+funcional)[:\s]*([^\n]{3,30})/i);
  campos.matricula = matricula?.[1]?.trim() || null;

  const lotacao = text.match(/(?:lota[çc][ãa]o|setor|departamento|divis[ãa]o|unidade)[:\s]+([^\n]{3,80})/i);
  campos.lotacao = lotacao?.[1]?.trim() || null;

  const dataAdmissao = text.match(/(?:admiss[ãa]o|posse|ingresso|contrata[çc][ãa]o|desde)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_admissao = dataAdmissao?.[1] || null;

  const dateMatch = text.match(/(?:data|emitido|expedido)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data_documento = dateMatch?.[1] || null;

  // Atividades de risco
  campos.atividade_risco = /(?:seguran[çc]a|vigilante|escolta|transporte\s+de\s+valores|policial|agente|guarda|inspetor|investigador|militar|bombeiro)/i.test(text);

  return {
    tipo_documental: "funcional_ocupacao", campos, indicadores_risco: campos.atividade_risco ? ["atividade de risco"] : [],
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: "qa-processar-documento/funcional",
  };
}

// ═══ CERTIDÃO ═══
function extractCertidao(text: string): DadosEstruturados {
  const campos: Record<string, string | string[] | boolean | null> = {};

  const nomeMatch = text.match(/(?:nome|titular|requerente|interessad[oa]|certific[oa]\s+que)[:\s]+([^\n]{3,80})/i);
  campos.nome = nomeMatch?.[1]?.trim() || null;

  const cpfMatch = text.match(/(?:CPF|C\.P\.F\.?)\s*[:\s]*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
  campos.cpf = cpfMatch?.[1]?.trim() || null;

  const rgMatch = text.match(/(?:RG|identidade)\s*[:\s]*([\d./-]+)/i);
  campos.rg = rgMatch?.[1]?.trim() || null;

  const dateMatch = text.match(/(?:data|emitido|expedido)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  campos.data = dateMatch?.[1] || null;

  const orgaoMatch = text.match(/(?:[oó]rg[ãa]o\s+emissor|expedid[oa]\s+(?:pel[oa]|por)|cart[oó]rio|tribunal|juízo)[:\s]+([^\n]{3,80})/i);
  campos.orgao_emissor = orgaoMatch?.[1]?.trim() || null;

  // Tipo de certidão
  const tipoCert = text.match(/(?:certid[ãa]o\s+(?:negativa|positiva)?\s*(?:de\s+)?)((?:antecedentes|distribui[çc][ãa]o|nascimento|casamento|[oó]bito|protestos?|feitos?\s+cíveis|criminal)[^\n]{0,60})/i);
  campos.tipo_certidao = tipoCert?.[1]?.trim() || null;

  campos.resultado_negativa = /negativa|nada\s+consta|n[ãa]o\s+(?:consta|h[aá])/i.test(text);
  campos.resultado_positiva = /positiva|consta|registr[oa]/i.test(text) && !campos.resultado_negativa;

  const validade = text.match(/(?:validade|v[aá]lid[oa]\s+(?:at[eé]|por))[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d+\s*dias?)/i);
  campos.validade = validade?.[1] || null;

  const endMatch = text.match(/(?:endere[çc]o|resid[eê]ncia)[:\s]+([^\n]{5,120})/i);
  campos.endereco = endMatch?.[1]?.trim() || null;

  return {
    tipo_documental: "certidao", campos, indicadores_risco: [],
    leitura_integral: true, total_caracteres: text.length, total_blocos: 1,
    pipeline_usado: "qa-processar-documento/certidao",
  };
}

// ═══ DOCUMENT TYPE DETECTOR ═══
function detectDocType(titulo: string, tipoInformado: string, text: string): TipoDocProbatorio {
  const combined = `${titulo} ${tipoInformado}`.toLowerCase();
  const header = text.substring(0, 800).toLowerCase();

  for (const p of BO_PATTERNS) { if (p.test(combined) || p.test(header)) return "boletim_ocorrencia"; }
  for (const p of LAUDO_PATTERNS) {
    if (p.test(combined) || p.test(header)) return detectLaudoSubtype(titulo, tipoInformado, text);
  }
  for (const p of INDEFERIMENTO_PATTERNS) { if (p.test(combined) || p.test(header)) return "indeferimento_administrativo"; }
  for (const p of NOTIFICACAO_PATTERNS) { if (p.test(combined) || p.test(header)) return "notificacao_administrativa"; }
  for (const p of SINARM_PATTERNS) { if (p.test(combined) || p.test(header)) return "requerimento_sinarm"; }

  if (/certid[ãa]o/i.test(combined) || /certid[ãa]o/i.test(header)) return "certidao";
  if (/comprovante\s+(?:de\s+)?resid/i.test(combined)) return "comprovante_residencia";
  if (/(?:funcional|ocupação|emprego|cargo|ctps)/i.test(combined)) return "funcional_ocupacao";
  if (/(?:documento\s+pessoal|identidade|CPF|RG|CNH|carteira\s+(?:de\s+)?(?:identidade|motorista|habilita))/i.test(combined)) return "documento_pessoal";

  const tipoMap: Record<string, TipoDocProbatorio> = {
    boletim_ocorrencia: "boletim_ocorrencia",
    laudo_medico: "laudo_medico", laudo_psiquiatrico: "laudo_psiquiatrico",
    laudo_psicologico: "laudo_psicologico", relatorio_clinico: "relatorio_clinico",
    atestado_medico: "atestado_medico", notificacao: "notificacao_administrativa",
    notificacao_administrativa: "notificacao_administrativa",
    indeferimento: "indeferimento_administrativo", indeferimento_administrativo: "indeferimento_administrativo",
    certidao: "certidao", documento_pessoal: "documento_pessoal",
    comprovante: "comprovante_residencia", comprovante_residencia: "comprovante_residencia",
    funcional_ocupacao: "funcional_ocupacao", declaracao: "outro_documento_probatorio",
  };
  if (tipoMap[tipoInformado]) return tipoMap[tipoInformado];

  return "outro_documento_probatorio";
}

// ═══ MAIN PROCESSOR ═══
function processarPorTipo(text: string, tipoDetectado: TipoDocProbatorio, titulo: string, tipoInformado: string): DadosEstruturados {
  switch (tipoDetectado) {
    case "boletim_ocorrencia": return extractBo(text);
    case "laudo_medico": case "laudo_psiquiatrico": case "laudo_psicologico":
    case "relatorio_clinico": case "atestado_medico": return extractLaudo(text, tipoDetectado);
    case "notificacao_administrativa": return extractNotificacao(text, false);
    case "indeferimento_administrativo": return extractNotificacao(text, true);
    case "documento_pessoal": return extractDocPessoal(text);
    case "comprovante_residencia": return extractComprovante(text);
    case "requerimento_sinarm": return extractRequerimento(text);
    case "funcional_ocupacao": return extractFuncional(text);
    case "certidao": return extractCertidao(text);
    default:
      return {
        tipo_documental: tipoDetectado, campos: {},
        indicadores_risco: [], leitura_integral: true,
        total_caracteres: text.length, total_blocos: 1,
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

    const tipoDetectado = detectDocType(doc.titulo || "", doc.tipo_documento || doc.categoria || "", text);
    console.log(`Document ${documento_id}: detected type = ${tipoDetectado}`);

    const dados = processarPorTipo(text, tipoDetectado, doc.titulo || "", doc.tipo_documento || "");

    // Multi-block for long documents
    if (text.length > 15000) {
      const BLOCK = 15000;
      const blocks = Math.ceil(text.length / BLOCK);
      dados.total_blocos = blocks;
      for (let b = 1; b < blocks; b++) {
        const blockText = text.substring(b * BLOCK, (b + 1) * BLOCK);
        const blockData = processarPorTipo(blockText, tipoDetectado, doc.titulo || "", doc.tipo_documento || "");
        blockData.indicadores_risco.forEach(r => {
          if (!dados.indicadores_risco.includes(r)) dados.indicadores_risco.push(r);
        });
        for (const [k, v] of Object.entries(blockData.campos)) {
          if (v && !dados.campos[k]) dados.campos[k] = v;
        }
      }
    }

    // Save structured data
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
          campos_extraidos: Object.keys(dados.campos).filter(k => dados.campos[k] !== null),
          indicadores_risco: dados.indicadores_risco,
          total_caracteres: dados.total_caracteres,
          total_blocos: dados.total_blocos,
          leitura_integral: dados.leitura_integral,
          pipeline: dados.pipeline_usado,
        },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      tipo_detectado: tipoDetectado,
      dados_estruturados: dados,
    }), { headers: { ...corsH, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
