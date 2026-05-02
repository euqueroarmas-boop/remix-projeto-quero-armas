// qa-processo-doc-validar-ia
// Regras endurecidas:
//  - Threshold confiança: >=0.90 aprova / 0.70-0.89 revisao_humana / <0.70 invalido
//  - QUALQUER divergência (independente de severidade) -> divergente
//  - Documento ilegível, tipo errado, sem campos exigidos, sem dados objetivos -> invalido
//  - Validade vencida (data_emissao + validade_dias < hoje) -> invalido
//  - "esperado" da regra_validacao não bate (ex.: resultado != NADA_CONSTA / APTO) -> invalido
//  - NUNCA aprova por presunção.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
// `unpdf` é uma porta de pdfjs-dist sem dependências de canvas/Node,
// pensada para edge runtimes (Deno/Workers/Bun). Usamos só `extractText`
// para ler a camada de texto nativa de PDFs (Receita Federal, Detran,
// cartórios). Não convertemos PDF em imagem nesta função: o runtime do
// Supabase Edge não tem Poppler/Ghostscript. Quando o PDF é só imagem
// escaneada (sem texto), o fallback abaixo encaminha para revisão
// humana — nunca rejeita como "campo faltando".
// @ts-ignore esm.sh fornece tipos mínimos
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const APROVA_AUTO_MIN = 0.90;
const REVISAO_HUMANA_MIN = 0.70;

// ===== APRENDIZADO SUPERVISIONADO — utilitários =====
function normalizarTexto(s: string): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

async function gerarEmbedding(texto: string, lovableKey: string): Promise<number[] | null> {
  try {
    const trimmed = (texto || "").slice(0, 8000);
    if (trimmed.length < 20) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({ model: "google/text-embedding-004", input: trimmed }),
    });
    if (!resp.ok) {
      console.warn("[validar-ia] embedding falhou:", resp.status);
      return null;
    }
    const j = await resp.json();
    const v = j?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : null;
  } catch (e) {
    console.warn("[validar-ia] embedding erro:", e);
    return null;
  }
}

/**
 * Busca os top-3 modelos aprovados do mesmo tipo e retorna o melhor.
 * Também checa cobertura de palavras-chave do modelo no texto do doc novo.
 */
async function compararContraModelos(
  supabase: any,
  embedding: number[] | null,
  textoNorm: string,
  tipoDocumento: string,
): Promise<{ modeloId: string | null; similaridade: number; coberturaKw: number; nomeModelo: string | null }> {
  if (!embedding) return { modeloId: null, similaridade: 0, coberturaKw: 0, nomeModelo: null };
  try {
    const { data, error } = await supabase.rpc("match_qa_modelos_aprovados", {
      query_embedding: embedding,
      filtro_tipo: tipoDocumento,
      match_limit: 3,
    });
    if (error || !Array.isArray(data) || data.length === 0) {
      return { modeloId: null, similaridade: 0, coberturaKw: 0, nomeModelo: null };
    }
    const top = data[0];
    const sim = Number(top.similaridade ?? 0);
    const palavras: string[] = Array.isArray(top.palavras_chave_json) ? top.palavras_chave_json : [];
    let cobertos = 0;
    for (const p of palavras.slice(0, 30)) {
      if (textoNorm.includes(String(p).toUpperCase())) cobertos++;
    }
    const cobertura = palavras.length > 0 ? cobertos / Math.min(palavras.length, 30) : 0;
    return {
      modeloId: top.id,
      similaridade: sim,
      coberturaKw: cobertura,
      nomeModelo: top.nome_modelo ?? null,
    };
  } catch (e) {
    console.warn("[validar-ia] compararContraModelos erro:", e);
    return { modeloId: null, similaridade: 0, coberturaKw: 0, nomeModelo: null };
  }
}

/**
 * Busca config de limites por tipo. Default conservador se não houver linha.
 */
async function carregarConfigTipo(
  supabase: any,
  tipoDocumento: string,
): Promise<{ aprovaAuto: number; analiseHumana: number; permiteAuto: boolean }> {
  try {
    const { data } = await supabase
      .from("qa_validacao_config")
      .select("limite_aprovacao_auto, limite_analise_humana, permite_aprovacao_auto")
      .eq("tipo_documento", tipoDocumento)
      .maybeSingle();
    if (data) {
      return {
        aprovaAuto: Number(data.limite_aprovacao_auto ?? 0.85),
        analiseHumana: Number(data.limite_analise_humana ?? 0.50),
        permiteAuto: data.permite_aprovacao_auto !== false,
      };
    }
  } catch (e) {
    console.warn("[validar-ia] config tipo erro:", e);
  }
  return { aprovaAuto: 0.85, analiseHumana: 0.50, permiteAuto: true };
}

const TIPO_DOC_PROMPTS: Record<string, string> = {
  // === IDENTIFICAÇÃO (FASE 2: extração ampliada) ===
  rg: "RG (Registro Geral). Extraia TODOS os dados visíveis: nome_completo, cpf (se houver), tipo_documento_detectado ('rg'), numero_documento, rg, data_nascimento (YYYY-MM-DD), naturalidade, nacionalidade, nome_mae, nome_pai, filiacao_completa, orgao_emissor, uf_emissao, data_emissao (YYYY-MM-DD), validade (YYYY-MM-DD se houver). Tudo o que enxergar e tiver utilidade documental.",
  cin: "CIN (Carteira de Identidade Nacional). Extraia TODOS os dados: nome_completo, cpf, tipo_documento_detectado ('cin'), numero_documento (pode ser igual ao CPF — isso é normal na CIN, NÃO marque divergência), rg (se ainda exibido), data_nascimento (YYYY-MM-DD), naturalidade, nacionalidade, nome_mae, nome_pai, filiacao_completa, orgao_emissor, uf_emissao, data_emissao (YYYY-MM-DD), validade (YYYY-MM-DD).",
  cnh: "CNH (Carteira Nacional de Habilitação). Extraia TODOS: nome_completo, cpf, tipo_documento_detectado ('cnh'), numero_documento (n. registro), rg (se exibido), data_nascimento (YYYY-MM-DD), naturalidade, nacionalidade, nome_mae, nome_pai, filiacao_completa, orgao_emissor, uf_emissao, data_emissao/primeira_habilitacao (YYYY-MM-DD), validade (YYYY-MM-DD), categoria_cnh, registro_cnh, numero_espelho (se houver).",
  cpf: "Comprovante de CPF. Extraia: nome_completo, cpf (apenas dígitos).",
  comprovante_residencia: "Comprovante de residência ACEITO APENAS se for: conta de energia elétrica, água, gás, internet fixa, telefone fixo ou IPTU. NÃO aceite: fatura de cartão de crédito, boleto genérico, correspondência bancária, extrato bancário, ou qualquer documento sem vínculo claro com o imóvel — nesses casos marque tipo_correto=false e cite em motivo_rejeicao. Quando válido, extraia TODOS: nome_titular, cpf_cnpj_titular (apenas dígitos), endereco_completo, logradouro, numero, complemento, bairro, cidade, uf, cep (apenas dígitos), data_emissao (YYYY-MM-DD), mes_referencia (YYYY-MM), tipo_conta (energia/agua/gas/internet/telefone_fixo/iptu), empresa_emissora, codigo_instalacao (matrícula/UC/instalação se houver). Se o nome_titular for diferente do nome do cliente cadastrado, NÃO trate como divergência: preencha endereco_em_nome_de_terceiro=true e os campos titular_comprovante_*; o endereço deve ser extraído normalmente.",
  comprovante_renda: "Holerite/decore/IR. Extraia: nome_titular, ocupacao, renda_mensal_aproximada, periodo_referencia, data_emissao (YYYY-MM-DD).",
  renda_holerite_mes_atual: "Holerite mais recente. Extraia OBRIGATORIAMENTE: nome_titular, cpf (se houver), empregador, periodo_referencia (mes/ano no formato YYYY-MM), mes_referencia (YYYY-MM), data_emissao (YYYY-MM-DD se houver).",
  renda_cnpj_autonomo: "Cartão CNPJ de autônomo/MEI. Extraia: razao_social, nome_fantasia (se houver), cnpj (apenas dígitos), situacao_cadastral, data_abertura (YYYY-MM-DD se houver), atividade_principal, endereco_sede, cidade_sede e uf_sede. NÃO exija 'nome_titular': cartão CNPJ identifica empresa por razão social/CNPJ.",
  renda_nf_recente: "Nota fiscal recente emitida por CNPJ/MEI/autônomo. Extraia: razao_social_emitente, cnpj_emitente (apenas dígitos), numero_nota, serie, data_emissao (YYYY-MM-DD), valor_total, municipio_emissao e natureza_operacao/servico. NÃO exija 'nome_titular': nota fiscal identifica emitente por razão social/CNPJ.",
  certidao_civel: "Certidão Cível Federal. Extraia: nome_titular, cpf, resultado (NADA_CONSTA ou CONSTA), data_emissao (YYYY-MM-DD).",
  certidao_criminal_federal: "Criminal Federal. Extraia: nome_titular, cpf, resultado, data_emissao.",
  certidao_criminal_estadual: "Criminal Estadual. Extraia: nome_titular, cpf, uf, resultado, data_emissao.",
  certidao_militar: "Justiça Militar. Extraia: nome_titular, cpf, resultado, data_emissao.",
  certidao_eleitoral: "Quitação Eleitoral. Extraia: nome_titular, titulo_eleitor, resultado, data_emissao.",
  laudo_psicologico: "Laudo Psicológico. Extraia: nome_titular, cpf, psicologo_nome, psicologo_crp, resultado (APTO/INAPTO), data_emissao.",
  laudo_capacidade_tecnica: "Capacidade Técnica de tiro. Extraia: nome_titular, cpf, instrutor_nome, instrutor_credencial, resultado (APTO/INAPTO), data_emissao.",
  cr_cac: "Certificado de Registro CAC. Extraia: nome_titular, cpf, numero_cr, categoria, validade (YYYY-MM-DD).",
  nota_fiscal_arma: "Nota fiscal de arma. Extraia: comprador_nome, comprador_cpf, modelo, calibre, numero_serie, data_emissao, valor.",
  guia_trafego: "Guia de Tráfego. Extraia: nome_titular, cpf, numero_guia, validade (YYYY-MM-DD).",
  justificativa_porte: "Justificativa fundamentada. Extraia: texto integral (resumo curto), assinatura, data.",
  // === DOCUMENTOS DE PESSOA JURÍDICA (sócio/empresa) ===
  // ATENÇÃO: estes documentos NÃO têm 'nome_titular' único — listam SÓCIOS e dados da EMPRESA.
  // Não exija nome_titular. Extraia razao_social, cnpj e a lista de sócios.
  renda_cartao_cnpj:
    "Cartão CNPJ da empresa emitido pela Receita Federal. Extraia: razao_social, nome_fantasia (se houver), cnpj (apenas dígitos), situacao_cadastral, data_abertura (YYYY-MM-DD se houver), atividade_principal, atividades_secundarias, natureza_juridica, endereco_sede, cidade_sede e uf_sede. NÃO exija 'nome_titular': cartão CNPJ identifica empresa por razão social/CNPJ. NÃO exija QSA neste documento: o QSA é um documento SEPARADO, enviado em outro item do checklist. Se o Cartão CNPJ apresentar razao_social + cnpj + situacao_cadastral=ATIVA, é VÁLIDO por si só — não rejeite nem coloque em revisão humana por 'falta de QSA'.",
  renda_contrato_social:
    "Contrato Social (ou última alteração consolidada) de PESSOA JURÍDICA. Extraia: razao_social, nome_fantasia (se houver), cnpj (apenas dígitos), data_constituicao (YYYY-MM-DD se houver), capital_social (número), endereco_sede, cidade_sede, uf_sede, objeto_social (resumo curto), socios (array com objetos {nome, cpf, participacao_percentual, qualificacao}). NÃO exija um campo 'nome_titular' único: este documento lista sócios; preencha o array 'socios'. Se o cliente cadastrado aparecer entre os sócios, registre cliente_e_socio=true em campos_complementares.",
  renda_qsa:
    "QSA (Quadro de Sócios e Administradores) emitido pela Receita Federal a partir do Cartão CNPJ. Extraia: razao_social, cnpj (apenas dígitos), data_emissao (YYYY-MM-DD se houver), socios (array {nome, cpf, qualificacao, data_entrada}), administradores (array {nome, cpf, qualificacao}). NÃO exija um campo 'nome_titular' único. Se o cliente cadastrado aparecer no QSA, registre cliente_e_socio=true em campos_complementares.",
  renda_nf_empresa:
    "Nota fiscal recente emitida pela PESSOA JURÍDICA. Extraia: razao_social_emitente, cnpj_emitente (apenas dígitos), razao_social_tomador (se houver), cnpj_tomador (se houver), numero_nota, serie, data_emissao (YYYY-MM-DD), valor_total, municipio_emissao e natureza_operacao/servico. NÃO exija 'nome_titular': nota fiscal de empresa identifica a empresa por razão social/CNPJ/emitente.",
};

function buildSystemPrompt(tipoDoc: string, cadastro: any): string {
  const docHint = TIPO_DOC_PROMPTS[tipoDoc] ||
    "Documento administrativo. Extraia nome_titular, cpf, datas, números identificadores.";
  const isIdentificacao = ["rg", "cin", "cnh"].includes(tipoDoc);
  const isComprovanteEnd = tipoDoc === "comprovante_residencia";
  return `Você é um auditor RIGOROSO de documentos para Polícia Federal / Exército Brasileiro.
TAREFA: Valide a imagem/PDF e responda SEMPRE chamando "validar_documento".
REGRAS CRÍTICAS:
1. Se o documento NÃO corresponde ao tipo "${tipoDoc}", marque tipo_correto=false.
2. Se ilegível, marque legivel=false.
3. Se faltar QUALQUER campo crítico, deixe em branco no campos_extraidos e cite em motivo_rejeicao.
4. Compare CADA campo com o cadastro abaixo. QUALQUER diferença textual relevante (nome, CPF, RG, data nascimento, endereço, CEP) é divergência.
REGRA PJ (cartão CNPJ, contrato social, QSA, NF de empresa, CNPJ de autônomo): NUNCA gere divergência de endereço, CEP, cidade, UF, bairro, logradouro ou nome entre a EMPRESA e o cliente. O endereço da SEDE da empresa é independente do endereço residencial do cliente. O vínculo do cliente com a empresa se prova pela presença do CPF/nome dele no QSA / lista de sócios / administradores. O que importa para PJ é: situação_cadastral=ATIVA e cliente_e_socio=true. Endereço da empresa deve ser extraído nos campos endereco_sede / cidade_sede / uf_sede / cep_sede, nunca nos campos de endereço do cliente.
5. NUNCA assuma campos não vistos. Se incerto, baixe a confiança.
6. Datas YYYY-MM-DD.
7. EXTRAIA TUDO O QUE FOR ÚTIL: campos com correspondência no cadastro vão em "campos_extraidos"; dados úteis sem campo fixo (observações, códigos auxiliares, anotações, números de protocolo, etc.) vão em "campos_complementares"; metadados gerais do documento (resolução, idioma, observações de qualidade) vão em "metadados_documento".
${isIdentificacao ? `8. DOCUMENTO DE IDENTIFICAÇÃO: aceitos somente RG, CIN ou CNH. Para CIN, o numero_documento pode coincidir com o CPF — isso é VÁLIDO, não gere divergência. Para RG, se rg == cpf, ainda assim aceite mas registre uma observação de alerta (não bloqueie).` : ""}
${isComprovanteEnd ? `8. COMPROVANTE DE RESIDÊNCIA: REJEITE (tipo_correto=false) se for fatura de cartão de crédito, boleto genérico, correspondência bancária, extrato, ou documento sem vínculo claro com imóvel. ACEITE apenas energia, água, gás, internet fixa, telefone fixo ou IPTU.
9. TERCEIROS: se o titular do comprovante for diferente do cliente, NÃO marque divergência de nome. Em vez disso, preencha campos_extraidos.endereco_em_nome_de_terceiro=true, titular_comprovante_nome e titular_comprovante_documento. O endereço deve ser extraído normalmente.` : ""}
Tipo esperado: ${tipoDoc}
Detalhes: ${docHint}
Cadastro do cliente:
${JSON.stringify({
  nome: cadastro?.nome_completo ?? cadastro?.nome,
  cpf: cadastro?.cpf,
  rg: cadastro?.rg,
  data_nascimento: cadastro?.data_nascimento,
  endereco: cadastro?.endereco,
  cidade: cadastro?.cidade,
  uf: cadastro?.estado ?? cadastro?.uf,
  cep: cadastro?.cep,
}, null, 2)}`;
}

const VALIDAR_TOOL = {
  type: "function",
  function: {
    name: "validar_documento",
    description: "Validação estruturada do documento.",
    parameters: {
      type: "object",
      properties: {
        tipo_correto: { type: "boolean" },
        legivel: { type: "boolean" },
        confianca: { type: "number" },
        tipo_documento_detectado: { type: "string", description: "Tipo real detectado: rg, cin, cnh, energia, agua, gas, internet, telefone_fixo, iptu, cartao_credito, boleto, extrato_bancario, outro." },
        campos_extraidos: { type: "object", additionalProperties: true },
        campos_complementares: { type: "object", additionalProperties: true, description: "Dados úteis sem campo fixo no cadastro principal." },
        metadados_documento: { type: "object", additionalProperties: true, description: "Metadados gerais (qualidade, idioma, observações operacionais)." },
        orientacoes_cliente: { type: "string", description: "Orientações claras ao cliente sobre o que melhorar/enviar, se aplicável." },
        divergencias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              campo: { type: "string" },
              valor_documento: { type: "string" },
              valor_cadastro: { type: "string" },
              severidade: { type: "string", enum: ["baixa", "media", "alta"] },
            },
            required: ["campo", "severidade"],
            additionalProperties: false,
          },
        },
        motivo_rejeicao: { type: "string" },
        observacoes: { type: "string" },
      },
      required: ["tipo_correto", "legivel", "confianca", "campos_extraidos", "divergencias"],
      additionalProperties: false,
    },
  },
};

async function downloadAsBase64(supabase: any, path: string): Promise<{ b64: string; mime: string }> {
  const { data, error } = await supabase.storage.from("qa-processo-docs").download(path);
  if (error || !data) throw new Error("Falha ao baixar arquivo: " + (error?.message || "vazio"));
  const buf = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return { b64: btoa(bin), mime: data.type || "application/octet-stream" };
}

/**
 * Baixa o PDF e tenta extrair a camada de texto nativa via pdfjs-dist.
 * Retorna string vazia se o PDF não tem texto extraível (PDF de imagem
 * escaneada). NÃO há conversão PDF→imagem nesta função: Deno edge não
 * tem Poppler/Ghostscript. Quando não há texto, o caller encaminha para
 * revisão humana.
 */
async function extractPdfText(supabase: any, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage.from("qa-processo-docs").download(path);
    if (error || !data) return "";
    const arr = new Uint8Array(await data.arrayBuffer());
    const pdf = await getDocumentProxy(arr);
    const { text } = await extractText(pdf, { mergePages: true });
    const out = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    return out.trim();
  } catch (e) {
    console.warn("[validar-ia] unpdf falhou:", e);
    return "";
  }
}

/**
 * Heurística para detectar se a IA produziu algo útil:
 * - campos_extraidos com pelo menos 1 chave útil OU
 * - divergências OU
 * - rejeição explícita (tipo_correto=false + motivo_rejeicao).
 */
function extraiuAlgo(parsed: any): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const cx = parsed.campos_extraidos;
  const camposUteis = cx && typeof cx === "object"
    ? Object.entries(cx).filter(([, v]) =>
        v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "")
      ).length
    : 0;
  const divs = Array.isArray(parsed.divergencias) ? parsed.divergencias.length : 0;
  const temMotivo = typeof parsed.motivo_rejeicao === "string" && parsed.motivo_rejeicao.trim().length > 0;
  return camposUteis > 0 || divs > 0 || (parsed.tipo_correto === false && temMotivo);
}

/**
 * Sinônimos comuns de "razão social" no Cartão CNPJ da Receita Federal
 * e em documentos de PJ. Se a regra exigir `razao_social` e a IA tiver
 * extraído um destes, consideramos satisfeito.
 */
const SINONIMOS_RAZAO_SOCIAL = [
  "razao_social", "razão_social", "razao social",
  "nome_empresarial", "nome empresarial",
  "nome_da_empresa", "nome da empresa", "empresa",
  "nome", "cnpj_nome", "razao_social_emitente", "emitente",
];
function temRazaoSocialOuEquivalente(extraidos: Record<string, any>): boolean {
  if (!extraidos || typeof extraidos !== "object") return false;
  for (const k of SINONIMOS_RAZAO_SOCIAL) {
    const v = extraidos[k];
    if (v != null && !(typeof v === "string" && v.trim() === "")) return true;
  }
  return false;
}

/**
 * Verifica campos obrigatórios no payload extraído pela IA.
 *
 * Para documentos de PESSOA JURÍDICA, `nome_titular` historicamente foi
 * cadastrado como exigido — porém esses documentos identificam EMPRESA,
 * emitente/tomador ou sócios. Aceitamos como satisfeito quando há razão
 * social/CNPJ/emitente/sócios no payload, sem afrouxar documentos de PF.
 */
function checaCamposExigidos(
  extraidos: Record<string, any>,
  exige: string[] = [],
  tipoDocumento?: string,
): string[] {
  const faltando: string[] = [];
  const isPJ = ["renda_qsa", "renda_contrato_social", "renda_nf_empresa", "renda_cartao_cnpj", "renda_cnpj_autonomo", "renda_nf_recente"].includes(tipoDocumento || "");
  const sociosArr = Array.isArray(extraidos?.socios) ? extraidos.socios : [];
  const adminsArr = Array.isArray(extraidos?.administradores) ? extraidos.administradores : [];
  const hasValue = (v: any) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
  const temIdentPJ =
    [
      extraidos?.razao_social,
      extraidos?.nome_fantasia,
      extraidos?.cnpj,
      extraidos?.razao_social_emitente,
      extraidos?.cnpj_emitente,
      extraidos?.emitente,
      extraidos?.prestador,
      extraidos?.empresa,
    ].some(hasValue) ||
    sociosArr.length > 0 ||
    adminsArr.length > 0;

  for (const k of exige) {
    const v = extraidos?.[k];
    const vazio = !hasValue(v);
    if (!vazio) continue;
    // Equivalência semântica para PJ: nome_titular / razao_social podem ser
    // satisfeitos por sócios, administradores, cnpj, razão social ou nome
    // fantasia presentes no payload.
    if (
      isPJ &&
      (k === "nome_titular" || k === "nome_completo" || k === "titular" || k === "razao_social") &&
      temIdentPJ
    ) {
      continue;
    }
    // Sinônimos de razão social no Cartão CNPJ / QSA emitidos pela RF.
    if (
      (k === "razao_social" || k === "nome_empresarial") &&
      temRazaoSocialOuEquivalente(extraidos)
    ) {
      continue;
    }
    faltando.push(k);
  }
  return faltando;
}

function checaEsperado(extraidos: Record<string, any>, esperado: Record<string, any> = {}): string[] {
  const violacoes: string[] = [];
  for (const [k, vEsp] of Object.entries(esperado)) {
    const v = String(extraidos?.[k] ?? "").toUpperCase();
    if (v !== String(vEsp).toUpperCase()) violacoes.push(`${k} esperado ${vEsp}, encontrado ${v || "vazio"}`);
  }
  return violacoes;
}

function isVencido(dataEmissao: string | undefined, validadeDias: number | null | undefined): boolean {
  if (!dataEmissao || !validadeDias) return false;
  const d = new Date(dataEmissao);
  if (isNaN(d.getTime())) return false;
  const limite = new Date(d.getTime() + validadeDias * 86400000);
  return limite < new Date();
}

// Holerite: precisa corresponder ao mês atual ou mês imediatamente anterior.
// Aceita "periodo_referencia" ou "mes_referencia" no formato YYYY-MM, "MM/YYYY" ou nomes.
const MESES_PT: Record<string, number> = {
  "janeiro":1,"fevereiro":2,"marco":3,"março":3,"abril":4,"maio":5,"junho":6,
  "julho":7,"agosto":8,"setembro":9,"outubro":10,"novembro":11,"dezembro":12,
};
function parseMesAno(raw: any): { y: number; m: number } | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/(\d{4})[-\/](\d{1,2})/))) return { y: +m[1], m: +m[2] };
  if ((m = s.match(/(\d{1,2})[-\/](\d{4})/))) return { y: +m[2], m: +m[1] };
  for (const [nome, idx] of Object.entries(MESES_PT)) {
    if (s.includes(nome)) {
      const ya = s.match(/(\d{4})/);
      if (ya) return { y: +ya[1], m: idx };
    }
  }
  return null;
}
function holeriteForaDoPeriodo(extraidos: Record<string, any>): boolean {
  const ref = parseMesAno(extraidos?.mes_referencia)
           ?? parseMesAno(extraidos?.periodo_referencia)
           ?? parseMesAno(extraidos?.data_emissao);
  if (!ref) return true; // não conseguimos identificar o mês -> trata como inválido
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth() + 1;
  // aceita: mês atual ou mês anterior
  const monthsDiff = (cy - ref.y) * 12 + (cm - ref.m);
  return monthsDiff < 0 || monthsDiff > 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const internal = req.headers.get("x-internal-call") === "1";
    if (!internal) {
      const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
      if (!guard.ok) return guard.response;
    }

    const { processo_id, documento_id, storage_path } = await req.json();
    if (!processo_id || !documento_id) return json({ error: "processo_id e documento_id obrigatórios" }, 400);

    const supabase = createClient(url, service);

    const { data: doc } = await supabase
      .from("qa_processo_documentos")
      .select("*")
      .eq("id", documento_id)
      .maybeSingle();
    if (!doc) return json({ error: "Documento não encontrado" }, 404);

    const path = storage_path || doc.arquivo_storage_key;
    if (!path) return json({ error: "storage_path ausente" }, 400);

    const { data: processo } = await supabase
      .from("qa_processos").select("id, cliente_id, servico_id").eq("id", processo_id).maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    const { data: cliente } = await supabase
      .from("qa_clientes")
      .select("id, nome_completo, cpf, rg, data_nascimento, endereco, cidade, estado, cep")
      .eq("id", processo.cliente_id).maybeSingle();

    await supabase.from("qa_processo_documentos")
      .update({ status: "em_analise", validacao_ia_status: "processando" })
      .eq("id", documento_id);

    const { b64, mime } = await downloadAsBase64(supabase, path);
    const systemPrompt = buildSystemPrompt(doc.tipo_documento, cliente);

    // Estratégia por tipo de arquivo:
    //  - PDF: tenta primeiro extrair a CAMADA DE TEXTO via pdfjs-dist
    //    (PDFs emitidos pela Receita Federal, Detran, cartórios etc. são
    //    nativos e têm texto). Se houver texto, mandamos texto puro para
    //    o modelo (mais confiável que image_url com mime application/pdf,
    //    que vinha resultando em extração vazia).
    //  - Se o PDF não tem texto (escaneado/imagem), enviamos como
    //    image_url e o guard `extraiuAlgo` cuida do encaminhamento para
    //    revisão humana caso a IA também não consiga ler.
    //  - Imagens (JPG/PNG): sempre image_url.
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(path);
    let pdfTexto = "";
    if (isPdf) {
      pdfTexto = await extractPdfText(supabase, path);
    }
    const usandoTextoPdf = isPdf && pdfTexto.length >= 40;
    const modelo = isPdf ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const userContent: any[] = usandoTextoPdf
      ? [{
          type: "text",
          text:
            "Este é o TEXTO EXTRAÍDO de um PDF nativo (provavelmente emitido por órgão público como Receita Federal). " +
            "Use APENAS este texto para preencher os campos solicitados e em seguida chame validar_documento.\n\n" +
            "===== INÍCIO DO TEXTO DO PDF =====\n" +
            pdfTexto.slice(0, 60000) +
            "\n===== FIM DO TEXTO DO PDF =====",
        }]
      : [
          {
            type: "text",
            text: isPdf
              ? "Este é um PDF (não foi possível extrair camada de texto — provavelmente é escaneado). Tente ler como imagem; se não conseguir, devolva tipo_correto=false e motivo_rejeicao explicando que o arquivo está ilegível. Em seguida chame validar_documento."
              : "Analise este documento e chame validar_documento.",
          },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [VALIDAR_TOOL],
        tool_choice: { type: "function", function: { name: "validar_documento" } },
      }),
    });

    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const msg = aiResp.status === 429 ? "IA temporariamente indisponível (rate limit)"
                : aiResp.status === 402 ? "Créditos da IA esgotados"
                : `Erro IA: ${errBody}`;
      // Em falha de IA: marcar para revisão humana, NUNCA aprovar
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: msg, status: "revisao_humana" })
        .eq("id", documento_id);
      return json({ error: msg }, status);
    }

    const aiJson = await aiResp.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      await supabase.from("qa_processo_documentos")
        .update({ validacao_ia_status: "erro", validacao_ia_erro: "IA não retornou tool_call", status: "revisao_humana" })
        .eq("id", documento_id);
      return json({ error: "IA não retornou validação estruturada" }, 500);
    }

    let parsed: any;
    try { parsed = JSON.parse(args); }
    catch { return json({ error: "Falha ao parsear resposta IA" }, 500); }

    // ===== GUARDA: extração vazia =====
    // Se a IA retornou tool_call mas sem nada de útil (campos_extraidos vazio,
    // sem divergências, sem motivo concreto), NÃO podemos marcar como
    // inválido: o mais provável é que o modelo não conseguiu ler o arquivo
    // (ex.: PDF nativo da RF). Nesses casos vai para revisão humana.
    if (!extraiuAlgo(parsed)) {
      const motivoTec = "Não foi possível ler automaticamente o arquivo. Revisão manual necessária.";
      await supabase.from("qa_processo_documentos")
        .update({
          status: "revisao_humana",
          motivo_rejeicao: null, // não é falha do cliente
          validacao_ia_status: "revisao_humana",
          validacao_ia_erro: motivoTec,
          validacao_ia_confianca: null,
          validacao_ia_modelo: modelo,
          data_validacao: new Date().toISOString(),
          dados_extraidos_json: parsed?.campos_extraidos ?? {},
        })
        .eq("id", documento_id);
      await supabase.from("qa_processo_eventos").insert({
        processo_id, documento_id,
        tipo_evento: "validacao_ia_revisao_humana",
        descricao: `IA não conseguiu interpretar ${doc.nome_documento}. Encaminhado para revisão manual da Equipe Quero Armas.`,
        dados_json: { motivo_tecnico: motivoTec, modelo, mime, tipo_documento: doc.tipo_documento },
        ator: "ia",
      });
      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: "revisao_humana" },
        });
      } catch (e) { console.warn("[validar-ia] notificação revisao_humana falhou:", e); }
      return json({
        success: true,
        status: "revisao_humana",
        aceito: false,
        motivo_rejeicao: null,
        motivo_tecnico: motivoTec,
        erros: [],
        campos_extraidos: parsed?.campos_extraidos ?? {},
        validacao: parsed,
      });
    }

    // ===== FASE 2: tratamento de comprovante em nome de TERCEIRO =====
    // Se a IA detectou que o titular não é o cliente, NÃO é divergência:
    // promovemos para flag operacional + remove divergência de nome.
    if (doc.tipo_documento === "comprovante_residencia") {
      const cx: Record<string, any> = parsed.campos_extraidos || {};
      const titularDoc = String(cx.nome_titular ?? cx.titular_comprovante_nome ?? "").trim();
      const nomeCadastro = String(cliente?.nome_completo ?? cliente?.nome ?? "").trim();
      const flagIA = cx.endereco_em_nome_de_terceiro === true || cx.endereco_em_nome_de_terceiro === "true";
      const titularDivergente = !!titularDoc && !!nomeCadastro &&
        titularDoc.toLowerCase().replace(/\s+/g, " ") !==
        nomeCadastro.toLowerCase().replace(/\s+/g, " ");
      if (flagIA || titularDivergente) {
        cx.endereco_em_nome_de_terceiro = true;
        if (!cx.titular_comprovante_nome && titularDoc) cx.titular_comprovante_nome = titularDoc;
        if (!cx.titular_comprovante_documento && cx.cpf_cnpj_titular) cx.titular_comprovante_documento = cx.cpf_cnpj_titular;
        // remove divergências baseadas em nome do titular
        parsed.divergencias = (parsed.divergencias || []).filter((d: any) => {
          const c = String(d?.campo || "").toLowerCase();
          return !["nome", "nome_titular", "titular", "nome_completo"].includes(c);
        });
        const aviso = "Comprovante em nome de terceiro. Futuramente poderá ser solicitada declaração do responsável pelo imóvel e documento do titular.";
        parsed.observacoes = parsed.observacoes ? `${parsed.observacoes} | ${aviso}` : aviso;
      }
      parsed.campos_extraidos = cx;
    }

    // ===== PESSOA JURÍDICA (Cartão CNPJ, Contrato Social, QSA, NF empresa) =====
    // O endereço da SEDE da empresa NÃO precisa ser igual ao endereço residencial
    // do cliente. Empresário pode morar em outro lugar. Não tratar como divergência.
    // O que importa é: empresa ATIVA + cliente consta no QSA/sócios.
    {
      const PJ_TIPOS = new Set([
        "renda_qsa",
        "renda_contrato_social",
        "renda_nf_empresa",
        "renda_cartao_cnpj",
        "renda_cnpj_autonomo",
        "renda_nf_recente",
      ]);
      if (PJ_TIPOS.has(doc.tipo_documento)) {
        const cx: Record<string, any> = parsed.campos_extraidos || {};
        // Mantém endereço da sede como dado extraído (vamos precisar), mas
        // separa em campos próprios para nunca colidir com endereço do cliente.
        const enderecoSede = cx.endereco_sede || cx.endereco_completo || cx.endereco || cx.logradouro;
        if (enderecoSede && !cx.endereco_sede) cx.endereco_sede = enderecoSede;
        if (cx.cep && !cx.cep_sede) cx.cep_sede = cx.cep;
        if (cx.cidade && !cx.cidade_sede) cx.cidade_sede = cx.cidade;
        if (cx.uf && !cx.uf_sede) cx.uf_sede = cx.uf;
        // Remove campos que confundiriam a reconciliação com cadastro PF do cliente
        delete cx.endereco;
        delete cx.endereco_completo;
        delete cx.logradouro;
        delete cx.cep;
        delete cx.bairro;
        // cidade/uf/numero/complemento da sede ficam apenas em *_sede
        delete cx.cidade;
        delete cx.uf;
        delete cx.estado;
        delete cx.numero;
        delete cx.complemento;

        // Remove divergências derivadas de comparação endereço/cep/cidade/uf:
        // não fazem sentido para documentos de empresa.
        const CAMPOS_PJ_IGNORAR = new Set([
          "endereco", "endereco_completo", "logradouro", "numero", "complemento",
          "bairro", "cep", "cidade", "uf", "estado",
          // nome do cliente também não deve gerar divergência aqui — o vínculo
          // se prova pela presença no QSA/sócios, não pela "razao_social".
          "nome", "nome_titular", "nome_completo", "razao_social",
        ]);
        parsed.divergencias = (parsed.divergencias || []).filter((d: any) => {
          const c = String(d?.campo || "").toLowerCase();
          return !CAMPOS_PJ_IGNORAR.has(c);
        });

        // Cruzamento CNPJ ↔ QSA: marca cliente_e_socio se o CPF do cliente
        // aparece na lista de sócios/administradores extraída.
        const cpfCliente = String(cliente?.cpf ?? "").replace(/\D+/g, "");
        const nomeCliente = String(cliente?.nome_completo ?? "").trim().toLowerCase();
        const socios = Array.isArray(cx.socios) ? cx.socios : [];
        const admins = Array.isArray(cx.administradores) ? cx.administradores : [];
        const todos = [...socios, ...admins];
        const ehSocio = todos.some((s: any) => {
          const cpfS = String(s?.cpf ?? "").replace(/\D+/g, "");
          const nomeS = String(s?.nome ?? "").trim().toLowerCase();
          if (cpfCliente && cpfS && cpfS.length >= 11 && cpfS === cpfCliente) return true;
          if (nomeCliente && nomeS && nomeS === nomeCliente) return true;
          return false;
        });
        if (ehSocio) cx.cliente_e_socio = true;

        parsed.campos_extraidos = cx;
      }
    }

    // ===== FASE 2: regras de identificação (RG/CIN/CNH) =====
    if (["rg", "cin", "cnh"].includes(doc.tipo_documento)) {
      const cx: Record<string, any> = parsed.campos_extraidos || {};
      const cpfDigits = String(cx.cpf ?? cliente?.cpf ?? "").replace(/\D+/g, "");
      const numDoc = String(cx.numero_documento ?? cx.rg ?? "").replace(/\D+/g, "");
      // CIN: numero_documento == cpf é VÁLIDO. Remove qualquer divergência derivada disso.
      if (doc.tipo_documento === "cin" && cpfDigits && numDoc && cpfDigits === numDoc) {
        parsed.divergencias = (parsed.divergencias || []).filter((d: any) => {
          const c = String(d?.campo || "").toLowerCase();
          return !["rg", "numero_documento"].includes(c);
        });
      }
      // RG: rg == cpf gera apenas observação, não bloqueia
      if (doc.tipo_documento === "rg" && cpfDigits && numDoc && cpfDigits === numDoc) {
        const aviso = "Atenção: número do RG informado coincide com CPF — verificar manualmente.";
        parsed.observacoes = parsed.observacoes ? `${parsed.observacoes} | ${aviso}` : aviso;
      }
    }

    // ===== Reconciliação de "divergências falsas" =====
    // Se a IA marcou algo como divergência mas o cadastro do cliente está vazio
    // (campo não pôde ser comparado), NÃO é divergência: é um dado novo extraído.
    // Move para campos_extraidos e remove da lista de divergências.
    {
      const camposIA: Record<string, any> = parsed.campos_extraidos || {};
      const divsIn: any[] = Array.isArray(parsed.divergencias) ? parsed.divergencias : [];
      const divsKeep: any[] = [];
      for (const d of divsIn) {
        const _cv = d?.valor_cadastro;
        const cadVazio =
          _cv == null ||
          (typeof _cv === "string" &&
            ["", "none", "null", "undefined", "n/a", "na", "-"].includes(_cv.trim().toLowerCase()));
        const docVal = d?.valor_documento;
        const temDocVal =
          docVal != null && !(typeof docVal === "string" && docVal.trim() === "");
        if (cadVazio && temDocVal) {
          // promove para campo extraído (sem sobrescrever campo já presente)
          if (camposIA[d.campo] == null || (typeof camposIA[d.campo] === "string" && camposIA[d.campo].trim() === "")) {
            camposIA[d.campo] = docVal;
          }
          continue; // descarta a divergência falsa
        }
        divsKeep.push(d);
      }
      parsed.campos_extraidos = camposIA;
      parsed.divergencias = divsKeep;
    }

    // ========== LÓGICA DE DECISÃO ENDURECIDA ==========
    const regra = (doc.regra_validacao ?? {}) as any;
    const exige: string[] = Array.isArray(regra.exige) ? regra.exige : [];
    const esperado: Record<string, any> = regra.esperado || {};
    const camposFaltando = checaCamposExigidos(
      parsed.campos_extraidos || {},
      exige,
      doc.tipo_documento,
    );
    const esperadoViolado = checaEsperado(parsed.campos_extraidos || {}, esperado);
    const dataEmissao = parsed.campos_extraidos?.data_emissao || parsed.campos_extraidos?.validade;
    const vencido = isVencido(dataEmissao, doc.validade_dias);
    const divergencias = parsed.divergencias || [];
    const conf = parsed.confianca ?? 0;
    let novoStatus: string;
    // Decisão BRUTA da IA (antes de ajustes por modelo aprovado).
    // É essa que vai para `decisao_ia` — separa, de forma definitiva,
    // decisão automática vs decisão manual da Equipe.
    let decisaoIA: "aprovado_auto" | "rejeitado_auto" | "revisao_humana" | "divergente" | "erro" = "revisao_humana";
    let motivoRejeicao: string | null = null;

    if (!parsed.tipo_correto) {
      novoStatus = "invalido";
      motivoRejeicao = parsed.motivo_rejeicao || "Documento não corresponde ao tipo esperado.";
    } else if (!parsed.legivel) {
      novoStatus = "invalido";
      motivoRejeicao = "Documento ilegível. Envie um arquivo mais nítido.";
    } else if (camposFaltando.length > 0) {
      // Se a IA conseguiu LER o documento (achou divergências, dados
      // complementares ou um tipo detectado) mas não preencheu o campo
      // exato exigido pela regra, NÃO é falha do cliente — é limitação
      // de leitura. Vai para revisão humana.
      const temSinalDeLeitura =
        (Array.isArray(parsed.divergencias) && parsed.divergencias.length > 0) ||
        (parsed.tipo_documento_detectado && String(parsed.tipo_documento_detectado).length > 0) ||
        (parsed.campos_complementares && Object.keys(parsed.campos_complementares).length > 0);
      if (temSinalDeLeitura) {
        novoStatus = "revisao_humana";
        motivoRejeicao = null;
      } else {
        novoStatus = "invalido";
        motivoRejeicao = "Campos obrigatórios não identificados: " + camposFaltando.join(", ");
      }
    } else if (esperadoViolado.length > 0) {
      novoStatus = "invalido";
      motivoRejeicao = "Conteúdo esperado não confirmado: " + esperadoViolado.join("; ");
    } else if (
      doc.tipo_documento === "renda_holerite_mes_atual" &&
      holeriteForaDoPeriodo(parsed.campos_extraidos || {})
    ) {
      novoStatus = "invalido";
      motivoRejeicao = "O holerite enviado não corresponde ao período atual ou mais recente aceitável.";
    } else if (vencido) {
      novoStatus = "invalido";
      motivoRejeicao = `Documento fora do prazo de validade (${doc.validade_dias} dias).`;
    } else if (divergencias.length > 0) {
      // QUALQUER divergência (não só "alta") trava o avanço e exige decisão do cliente
      novoStatus = "divergente";
      motivoRejeicao = "Divergência entre o documento e seu cadastro: " +
        divergencias.map((d: any) => d.campo).join(", ");
    } else if (conf < REVISAO_HUMANA_MIN) {
      novoStatus = "invalido";
      motivoRejeicao = `Confiança da IA insuficiente (${conf.toFixed(2)}). Reenvie ou aguarde revisão manual.`;
    } else if (conf < APROVA_AUTO_MIN) {
      novoStatus = "revisao_humana";
    } else {
      novoStatus = "aprovado";
    }

    // ===================================================================
    // APRENDIZADO SUPERVISIONADO — comparação contra modelos aprovados
    // ===================================================================
    // Reusa o texto extraído do PDF (quando disponível) ou um resumo dos
    // campos extraídos pela IA (quando o doc é imagem). Calcula embedding
    // e compara contra os modelos aprovados do MESMO tipo. O resultado
    // pode REFORÇAR (subir revisão_humana → aprovado) ou ENDURECER
    // (rebaixar aprovado para revisão_humana / invalido) a decisão.
    let textoParaModelo = "";
    if (typeof pdfTexto === "string" && pdfTexto.length >= 40) {
      textoParaModelo = pdfTexto;
    } else {
      // Imagem: monta um proxy textual a partir dos campos extraídos.
      try {
        textoParaModelo = JSON.stringify(parsed.campos_extraidos ?? {});
      } catch { textoParaModelo = ""; }
    }
    const textoNormParaModelo = normalizarTexto(textoParaModelo).slice(0, 12000);
    const embeddingDoc = await gerarEmbedding(textoNormParaModelo, lovableKey);
    const cfg = await carregarConfigTipo(supabase, doc.tipo_documento);
    const matchModelo = await compararContraModelos(
      supabase, embeddingDoc, textoNormParaModelo, doc.tipo_documento,
    );
    // Score combinado: 70% similaridade semântica + 30% cobertura de palavras-chave
    const scoreModelo = matchModelo.modeloId
      ? (matchModelo.similaridade * 0.7 + matchModelo.coberturaKw * 0.3)
      : 0;

    // Aplicação conservadora — NUNCA aprova doc que a IA marcou como
    // invalido/divergente; só ajusta entre aprovado ↔ revisao_humana.
    if (matchModelo.modeloId && novoStatus === "aprovado") {
      // Se o tipo NÃO permite aprovação automática (ex.: CR/CRAF/laudos),
      // sempre vai para revisão humana, mesmo com bom score.
      if (!cfg.permiteAuto) {
        novoStatus = "revisao_humana";
        motivoRejeicao = null;
      } else if (scoreModelo > 0 && scoreModelo < cfg.analiseHumana) {
        // Modelo aprovado existe mas o doc atual é muito diferente:
        // rebaixa para revisão humana.
        novoStatus = "revisao_humana";
        motivoRejeicao = null;
      }
    } else if (matchModelo.modeloId && novoStatus === "revisao_humana" && cfg.permiteAuto) {
      // Sobe revisão humana → aprovado se o doc bate fortemente com modelo aprovado.
      if (scoreModelo >= cfg.aprovaAuto && camposFaltando.length === 0 && divergencias.length === 0) {
        novoStatus = "aprovado";
        motivoRejeicao = null;
      }
    }

    // calcula data_validade quando aplicável
    let dataValidade: string | null = null;
    if (dataEmissao && doc.validade_dias) {
      const d = new Date(dataEmissao);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + doc.validade_dias);
        dataValidade = d.toISOString().slice(0, 10);
      }
    }

    // ===== FASE 2: separar campos para os novos slots aditivos =====
    const camposExtraidosFinal: Record<string, any> = parsed.campos_extraidos || {};
    const titularNome = camposExtraidosFinal.titular_comprovante_nome ?? null;
    const titularDoc = camposExtraidosFinal.titular_comprovante_documento ?? null;
    const enderecoTerceiro = camposExtraidosFinal.endereco_em_nome_de_terceiro === true;
    const metadados = parsed.metadados_documento || {};
    const camposComplementares = {
      ...(parsed.campos_complementares || {}),
      ...(parsed.tipo_documento_detectado ? { tipo_documento_detectado: parsed.tipo_documento_detectado } : {}),
      ...(parsed.orientacoes_cliente ? { orientacoes_cliente: parsed.orientacoes_cliente } : {}),
    };

    await supabase.from("qa_processo_documentos")
      .update({
        status: novoStatus,
        motivo_rejeicao: motivoRejeicao,
        dados_extraidos_json: camposExtraidosFinal,
        divergencias_json: divergencias,
        validacao_ia_status: "concluido",
        validacao_ia_erro: null,
        validacao_ia_confianca: conf,
        validacao_ia_modelo: modelo,
        data_validacao: new Date().toISOString(),
        data_validade: dataValidade,
        // Novos campos aditivos (Fase 1)
        metadados_documento_json: metadados,
        campos_complementares_json: camposComplementares,
        titular_comprovante_nome: titularNome,
        titular_comprovante_documento: titularDoc,
        endereco_em_nome_de_terceiro: enderecoTerceiro,
        // APRENDIZADO SUPERVISIONADO
        texto_ocr_extraido: textoParaModelo ? textoParaModelo.slice(0, 30000) : null,
        score_modelo_aprovado: matchModelo.modeloId ? Number(scoreModelo.toFixed(4)) : null,
        modelo_aprovado_id: matchModelo.modeloId,
      })
      .eq("id", documento_id);

    await supabase.from("qa_processo_eventos").insert({
      processo_id, documento_id,
      tipo_evento: "validacao_ia",
      descricao: `IA: ${doc.nome_documento} → ${novoStatus}`,
      dados_json: {
        confianca: conf,
        divergencias: divergencias.length,
        vencido,
        campos_faltando: camposFaltando,
        esperado_violado: esperadoViolado,
        modelo_aprovado_id: matchModelo.modeloId,
        modelo_aprovado_nome: matchModelo.nomeModelo,
        score_modelo: matchModelo.modeloId ? Number(scoreModelo.toFixed(4)) : null,
        similaridade_semantica: matchModelo.modeloId ? Number(matchModelo.similaridade.toFixed(4)) : null,
        cobertura_palavras_chave: matchModelo.modeloId ? Number(matchModelo.coberturaKw.toFixed(4)) : null,
      },
      ator: "ia",
    });

    // ===================================================================
    // FASE 3: RECONCILIAÇÃO SEGURA — preenche SOMENTE campos vazios do cliente
    // ===================================================================
    // Regras inegociáveis:
    //  - Cliente é a fonte da verdade. NUNCA sobrescreve dado existente.
    //  - Só roda se o documento foi APROVADO pela IA (confiança >= 0.90).
    //  - Só promove campos da whitelist (nome/cpf/rg/data_nascimento/endereço).
    //  - Campos sensíveis já preenchidos (nome, cpf) são intocáveis.
    //  - Conflitos são registrados em campos_complementares_json + evento auditável.
    //  - Toda promoção é rastreável (origem='ia', com documento_id e timestamp).
    if (novoStatus === "aprovado" && cliente?.id) {
      try {
        const cx: Record<string, any> = camposExtraidosFinal || {};
        const cleanStr = (v: any) => (v == null ? "" : String(v).trim());
        const isCampoVazio = (v: any) => {
          const s = cleanStr(v).toLowerCase();
          return s === "" || ["none", "null", "undefined", "n/a", "na", "-"].includes(s);
        };
        const onlyDigits = (v: any) => cleanStr(v).replace(/\D+/g, "");

        // Whitelist de promoção automática (ordem importa para auditoria)
        // Mapeia: campo do cliente -> possíveis chaves no extraído da IA + sanitizer
        const promocoes: Array<{
          campoCliente: string;
          fontesIA: string[];
          sanitize?: (v: any) => string;
          sensivel?: boolean; // se true, JAMAIS promove se não estiver vazio
        }> = [
          { campoCliente: "nome_completo",   fontesIA: ["nome_completo", "nome"], sensivel: true },
          { campoCliente: "cpf",             fontesIA: ["cpf"], sanitize: onlyDigits, sensivel: true },
          { campoCliente: "rg",              fontesIA: ["rg", "numero_documento"] },
          { campoCliente: "data_nascimento", fontesIA: ["data_nascimento"] },
          // Endereço — não promove se for em nome de terceiro
          ...(enderecoTerceiro ? [] : [
            { campoCliente: "endereco", fontesIA: ["endereco", "endereco_completo", "logradouro"] },
            { campoCliente: "cidade",   fontesIA: ["cidade"] },
            { campoCliente: "estado",   fontesIA: ["uf", "estado"] },
            { campoCliente: "cep",      fontesIA: ["cep"], sanitize: onlyDigits },
          ]),
        ];

        const patchCliente: Record<string, any> = {};
        const promovidos: Array<{ campo: string; valor: string; fonte: string }> = [];
        const conflitos: Array<{ campo: string; valor_cliente: string; valor_ia: string; fonte: string }> = [];

        for (const p of promocoes) {
          const valorAtual = (cliente as any)[p.campoCliente];
          let valorIA = "";
          let fonteUsada = "";
          for (const k of p.fontesIA) {
            const raw = cx[k];
            const v = p.sanitize ? p.sanitize(raw) : cleanStr(raw);
            if (!isCampoVazio(v)) { valorIA = v; fonteUsada = k; break; }
          }
          if (!valorIA) continue;

          if (isCampoVazio(valorAtual)) {
            // Cliente está vazio → promove
            patchCliente[p.campoCliente] = valorIA;
            promovidos.push({ campo: p.campoCliente, valor: valorIA, fonte: fonteUsada });
          } else {
            // Cliente já tem valor → NUNCA sobrescreve
            const atualNorm = (p.sanitize ? p.sanitize(valorAtual) : cleanStr(valorAtual)).toLowerCase();
            const iaNorm = valorIA.toLowerCase();
            if (atualNorm !== iaNorm) {
              conflitos.push({
                campo: p.campoCliente,
                valor_cliente: cleanStr(valorAtual),
                valor_ia: valorIA,
                fonte: fonteUsada,
              });
            }
          }
        }

        // 1) Aplica patch no cliente (somente se houve campos vazios para preencher)
        if (Object.keys(patchCliente).length > 0) {
          const { error: cliErr } = await supabase
            .from("qa_clientes")
            .update(patchCliente)
            .eq("id", cliente.id);
          if (cliErr) {
            console.warn("[FASE3] Falha ao promover dados ao cliente:", cliErr.message);
          } else {
            await supabase.from("qa_processo_eventos").insert({
              processo_id, documento_id,
              tipo_evento: "reconciliacao_cliente",
              descricao: `Promoção automática de dados ao cadastro do cliente a partir de ${doc.nome_documento}.`,
              dados_json: {
                origem: "ia",
                documento_id,
                tipo_documento: doc.tipo_documento,
                confianca: conf,
                campos_promovidos: promovidos,
                politica: "preenche_apenas_campos_vazios",
              },
              ator: "ia",
            });
          }
        }

        // 2) Conflitos (cliente já preenchido com valor diferente) → registra,
        //    nunca sobrescreve. Vai para campos_complementares_json do documento + evento.
        if (conflitos.length > 0) {
          const novosComplementares = {
            ...camposComplementares,
            conflitos_reconciliacao: [
              ...(Array.isArray((camposComplementares as any).conflitos_reconciliacao)
                ? (camposComplementares as any).conflitos_reconciliacao
                : []),
              ...conflitos.map((c) => ({
                ...c,
                origem: "ia",
                documento_id,
                detectado_em: new Date().toISOString(),
                acao: "nao_sobrescrito_cliente_e_fonte_da_verdade",
              })),
            ],
          };
          await supabase.from("qa_processo_documentos")
            .update({
              campos_complementares_json: novosComplementares,
              observacoes: (doc.observacoes ? doc.observacoes + " | " : "") +
                `Conflito de reconciliação não aplicado (cliente=fonte da verdade): ${conflitos.map((c) => c.campo).join(", ")}`,
            })
            .eq("id", documento_id);

          await supabase.from("qa_processo_eventos").insert({
            processo_id, documento_id,
            tipo_evento: "reconciliacao_conflito",
            descricao: `Conflito de dados detectado entre ${doc.nome_documento} e cadastro do cliente. Cadastro preservado.`,
            dados_json: {
              origem: "ia",
              documento_id,
              tipo_documento: doc.tipo_documento,
              confianca: conf,
              conflitos,
              politica: "cliente_e_fonte_da_verdade_nao_sobrescreve",
            },
            ator: "ia",
          });
        }
      } catch (e) {
        // Falha na reconciliação NUNCA derruba a validação do documento
        console.warn("[FASE3] Reconciliação falhou (não crítico):", e);
      }
    }

    // ===== GRUPO ALTERNATIVO: se aprovado, dispensa demais itens do mesmo grupo =====
    if (novoStatus === "aprovado") {
      const grupo = (regra?.grupo_alternativo as string | undefined) ?? null;
      if (grupo) {
        const { data: irmaos } = await supabase
          .from("qa_processo_documentos")
          .select("id, status, regra_validacao, nome_documento")
          .eq("processo_id", processo_id);
        const dispensar = (irmaos ?? []).filter((it: any) =>
          it.id !== documento_id &&
          it?.regra_validacao?.grupo_alternativo === grupo &&
          !["aprovado", "dispensado_grupo"].includes(String(it.status))
        );
        if (dispensar.length > 0) {
          const ids = dispensar.map((d: any) => d.id);
          await supabase.from("qa_processo_documentos")
            .update({
              status: "dispensado_grupo",
              motivo_rejeicao: null,
              observacoes: `dispensado:grupo=${grupo}`,
            })
            .in("id", ids);
          await supabase.from("qa_processo_eventos").insert(
            dispensar.map((d: any) => ({
              processo_id, documento_id: d.id,
              tipo_evento: "grupo_alternativo_satisfeito",
              descricao: `${d.nome_documento} dispensado: grupo "${grupo}" satisfeito por ${doc.nome_documento}.`,
              dados_json: { grupo, satisfeito_por: documento_id },
              ator: "sistema",
            }))
          );
        }
      }
    }

    // Notifica granular (cobra SOMENTE este item)
    const eventoEmail =
      novoStatus === "aprovado" ? "documento_aprovado" :
      novoStatus === "divergente" ? "divergencia_dados" :
      novoStatus === "invalido" && doc.tipo_documento.startsWith("certidao_") ? "certidao_invalida" :
      novoStatus === "invalido" ? "documento_invalido" :
      novoStatus === "revisao_humana" ? "revisao_humana" : null;
    if (eventoEmail) {
      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: eventoEmail, motivo: motivoRejeicao ?? undefined },
        });
      } catch (e) { console.warn("[validar-ia] notificação falhou:", e); }
    }

    // ===== FASE 2: retorno enriquecido =====
    const exigeList: string[] = Array.isArray((doc.regra_validacao as any)?.exige) ? (doc.regra_validacao as any).exige : [];
    const camposPreenchidos = Object.keys(camposExtraidosFinal).filter((k) => {
      const v = camposExtraidosFinal[k];
      return v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");
    });
    const camposAusentes = exigeList.filter((k) => !camposPreenchidos.includes(k));
    return json({
      success: true,
      status: novoStatus,
      aceito: novoStatus === "aprovado",
      motivo_rejeicao: motivoRejeicao,
      erros: motivoRejeicao ? [motivoRejeicao] : [],
      campos_extraidos: camposExtraidosFinal,
      campos_preenchidos: camposPreenchidos,
      campos_ausentes: camposAusentes,
      campos_complementares: camposComplementares,
      metadados_documento: metadados,
      orientacoes_cliente: parsed.orientacoes_cliente ?? null,
      titular_comprovante: enderecoTerceiro ? { nome: titularNome, documento: titularDoc } : null,
      endereco_em_nome_de_terceiro: enderecoTerceiro,
      validacao: parsed,
    });
  } catch (err: any) {
    console.error("qa-processo-doc-validar-ia:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
