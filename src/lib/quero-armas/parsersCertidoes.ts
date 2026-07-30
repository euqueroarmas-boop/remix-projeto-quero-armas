/* =============================================================================
 * Parsers de certidões — um por órgão, a partir do texto do PDF
 *
 * Validado contra documentos reais de DOIS clientes distintos por órgão
 * (30/07/2026). O que só aparecia em um exemplar não virou regra; o que
 * variava entre eles virou campo opcional.
 *
 * Princípio inegociável: nada é inferido. Campo que não aparece rotulado no
 * documento volta `undefined`. A PF indefere por divergência de uma letra —
 * um campo chutado custa o processo do cliente.
 *
 * Sobre FILIAÇÃO: vários órgãos listam pai e mãe sem rótulo individual, e a
 * ordem NÃO é confiável (ver nota em `parseIirgd`). Por isso a filiação sai
 * como CONJUNTO (`filiacao[]`) e a conferência pergunta "o nome da mãe do
 * cadastro está entre os nomes deste documento?" — nunca "o segundo nome é a
 * mãe". Só quando o próprio documento rotula ("Mãe:", "Nome da mãe:") é que
 * `nome_mae` é preenchido.
 * ============================================================================= */

export type OrgaoCertidao =
  | "stm"
  | "tse"
  | "iirgd"
  | "tjsp_distribuicao"
  | "tjsp_execucoes"
  | "trf_regional"
  | "tjm_sp";

export interface CamposCertidao {
  orgao: OrgaoCertidao;
  /** Slug canônico da exigência correspondente. */
  tipoDocumento: string;
  nome_titular?: string;
  cpf?: string;
  rg?: string;
  data_nascimento?: string; // YYYY-MM-DD
  /** Só quando o documento rotula explicitamente a mãe. */
  nome_mae?: string;
  /** Só quando o documento rotula explicitamente o pai. */
  nome_pai?: string;
  /** Nomes de filiação sem papel definido — usar como conjunto. */
  filiacao?: string[];
  naturalidade?: string;
  numero_documento?: string;
  data_emissao?: string; // YYYY-MM-DD
  validade_dias?: number;
  resultado?: "NADA_CONSTA" | "CONSTA";
  titulo_eleitor?: string;
  codigo_autenticidade?: string;
}

const norm = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ \t]+/g, " ");

const flat = (v: string) => norm(v).replace(/\s+/g, " ").trim();

const upper = (v: string) => flat(v).toUpperCase();

function iso(br: string | undefined): string | undefined {
  const m = (br ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  const s = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) ? undefined : s;
}

function cpf11(v: string | undefined): string | undefined {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 11 ? d : undefined;
}

const NADA = /NADA\s*CONSTAR?|NAO\s+CONSTAR?|NAO\s+EXISTE\s+REGISTRO/i;

function resultado(t: string): "NADA_CONSTA" | "CONSTA" | undefined {
  if (NADA.test(t)) return "NADA_CONSTA";
  if (/\bCONSTA\b/i.test(t)) return "CONSTA";
  return undefined;
}

/* ── Identificação do órgão pelo cabeçalho ─────────────────────────────── */

export function identificarOrgao(texto: string): OrgaoCertidao | null {
  const t = flat(texto).toUpperCase();
  if (/JUSTICA MILITAR DA UNIAO/.test(t)) return "stm";
  if (/TRIBUNAL DE JUSTICA MILITAR DO ESTADO/.test(t)) return "tjm_sp";
  if (/TRIBUNAL SUPERIOR ELEITORAL/.test(t)) return "tse";
  if (/IIRGD|RICARDO GUMBLETON DAUNT/.test(t)) return "iirgd";
  if (/TRIBUNAL REGIONAL FEDERAL/.test(t)) return "trf_regional";
  if (/CERTIDAO ESTADUAL DE DISTRIBUICOES CRIMINAIS/.test(t)) {
    // ARMADILHA REAL: as duas certidões do TJSP têm o MESMO título. O que as
    // distingue é o corpo — "distribuições de AÇÕES CRIMINAIS" contra
    // "distribuições de EXECUÇÕES CRIMINAIS". Testar EXECUÇÕES primeiro,
    // porque a de execuções também contém a palavra "distribuições".
    if (/DISTRIBUICOES DE EXECUCOES CRIMINAIS/.test(t)) return "tjsp_execucoes";
    if (/DISTRIBUICOES DE ACOES CRIMINAIS/.test(t)) return "tjsp_distribuicao";
    return null;
  }
  return null;
}

/* ── STM — Justiça Militar da União ────────────────────────────────────── */

function parseStm(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  return {
    orgao: "stm",
    tipoDocumento: "antecedentes_militar",
    numero_documento: g(/CERTIDAO DE ACOES CRIMINAIS\s*\n?\s*(\d{6,20})/i),
    nome_titular: upperOrUndef(g(/^\s*Nome:\s*(.+)$/im)),
    cpf: cpf11(g(/CPF:\s*([\d.\-]+)/i)),
    data_nascimento: iso(g(/Data de Nascimento:\s*([\d/]+)/i)),
    nome_mae: upperOrUndef(g(/Nome da mae:\s*(.+)$/im)),
    data_emissao: iso(g(/emitida em\s*([\d/]+)/i)),
    validade_dias: numOrUndef(g(/valida por\s*(\d{1,3})\s*dias/i)),
    resultado: resultado(t),
  };
}

/* ── TSE — crimes eleitorais ───────────────────────────────────────────── */

function parseTse(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  // "Filiação: - NOME A\n           - NOME B" — a ordem observada põe a mãe
  // primeiro nos dois exemplares, mas duas amostras não fazem regra: sai como
  // conjunto.
  const blocoFil = t.match(/Filiacao:\s*((?:\s*-\s*[^\n]+\n?){1,2})/i)?.[1] ?? "";
  const filiacao = blocoFil
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter((l) => l.length > 2)
    .map(upper);
  return {
    orgao: "tse",
    tipoDocumento: "antecedentes_eleitoral",
    nome_titular: upperOrUndef(g(/Eleitor\(a\):\s*(.+?)\s*$/im)),
    titulo_eleitor: g(/Inscricao:\s*([\d ]{10,20})/i)?.replace(/\D/g, ""),
    data_nascimento: iso(g(/Data de nascimento:\s*([\d/]+)/i)),
    naturalidade: undefined, // o TSE traz domicílio eleitoral, não naturalidade
    filiacao: filiacao.length ? filiacao : undefined,
    data_emissao: iso(g(/Certidao emitida.*?em\s*([\d/]+)/i)),
    resultado: resultado(t),
  };
}

/* ── IIRGD — Polícia Civil / SSP-SP ────────────────────────────────────── */

function parseIirgd(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  // "Filiação:  NOME A" seguido de uma linha solta com "NOME B".
  //
  // NÃO atribuo pai/mãe aqui. Nos dois exemplares reais a ordem é ao mesmo
  // tempo "pai primeiro" E "alfabética" (JOSE/SANDRA, ADRIANO/RENATA) — as
  // duas hipóteses explicam os dados igualmente bem, e escolher uma seria
  // adivinhar. Com um terceiro documento onde a mãe venha antes no alfabeto
  // isso se resolve; até lá, conjunto.
  const bloco = t.match(/Filiacao:\s*([^\n]+)\n\s*\n?\s*([^\n]+)/i);
  const filiacao = [bloco?.[1], bloco?.[2]]
    .map((x) => (x ?? "").trim())
    .filter((x) => x.length > 2 && !/^Data de Nascimento/i.test(x))
    .map(upper);
  return {
    orgao: "iirgd",
    tipoDocumento: "antecedentes_criminais",
    nome_titular: upperOrUndef(g(/^\s*Nome:\s*(.+)$/im)),
    rg: g(/N. RG de SP:\s*([\dA-Za-z\s\-]+)$/im)?.replace(/[\s\-]/g, ""),
    data_nascimento: iso(g(/Data de Nascimento:\s*([\d/]+)/i)),
    filiacao: filiacao.length ? filiacao : undefined,
    data_emissao: iso(g(/emitido em\s*([\d/]+)/i)),
    codigo_autenticidade: g(/\n\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i),
    resultado: resultado(t),
  };
}

/* ── TJSP — distribuições e execuções criminais ────────────────────────── */

function parseTjsp(texto: string, orgao: "tjsp_distribuicao" | "tjsp_execucoes"): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  // O bloco de qualificação vem corrido, com quebras no meio:
  // "NOME, RG: x, CPF: y, nascido em dd/mm/aaaa, natural de Cidade - UF,
  //  filho de PAI e MAE, conforme indicação..."
  const corrido = flat(t);
  const qualificacao = corrido.match(
    /CONSTAR contra:\s*\**\s*(.+?),\s*RG:\s*([^,]+),\s*CPF:\s*([\d.\-]+),\s*nascido em\s*([\d/]+),\s*natural de\s*(.+?),\s*filho de\s*(.+?),?\s*conforme/i,
  );
  // Aqui o documento DIZ "filho de X e Y" — pai e mãe nessa ordem, pela
  // própria redação. Ainda assim devolvo também o conjunto, para a
  // conferência não depender do split dar certo.
  const filhoDe = qualificacao?.[6] ?? "";
  const partes = filhoDe.split(/\s+e\s+/i).map((x) => upper(x)).filter(Boolean);
  return {
    orgao,
    tipoDocumento:
      orgao === "tjsp_execucoes" ? "antecedentes_estadual_execucoes" : "antecedentes_estadual_distribuicao",
    nome_titular: upperOrUndef(qualificacao?.[1]),
    rg: qualificacao?.[2]?.replace(/[^\dA-Za-z]/g, ""),
    cpf: cpf11(qualificacao?.[3]),
    data_nascimento: iso(qualificacao?.[4]),
    naturalidade: qualificacao?.[5] ? flat(qualificacao[5]) : undefined,
    nome_pai: partes.length === 2 ? partes[0] : undefined,
    nome_mae: partes.length === 2 ? partes[1] : undefined,
    filiacao: partes.length ? partes : undefined,
    numero_documento: g(/CERTIDAO N.:\s*(\d+)/i),
    data_emissao: iso(corrido.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)?.[1]),
    resultado: resultado(t),
  };
}

/* ── TRF — certidão regional ───────────────────────────────────────────── */

function parseTrfRegional(texto: string): CamposCertidao {
  const t = norm(texto);
  const corrido = flat(t);
  // "contra: NOME (nome da mãe MAE e data de nascimento dd/mm/aaaa) ou CPF nº x"
  const m = corrido.match(
    /CRIMINAIS contra:\s*(.+?)\s*\(nome da mae\s*(.+?)\s*e data de nascimento\s*([\d/]+)\)\s*ou\s*CPF n.\s*([\d.\-]+)/i,
  );
  return {
    orgao: "trf_regional",
    tipoDocumento: "antecedentes_federal_trf3_regional",
    nome_titular: upperOrUndef(m?.[1]),
    nome_mae: upperOrUndef(m?.[2]),
    data_nascimento: iso(m?.[3]),
    cpf: cpf11(m?.[4]),
    numero_documento: corrido.match(/N\.\s*(\d{4}\/\d{6,15})/)?.[1],
    data_emissao: iso(corrido.match(/Certidao emitida em:\s*([\d/]+)/i)?.[1]),
    validade_dias: numOrUndef(corrido.match(/no prazo de\s*(\d{1,3})\s*\(/i)?.[1]),
    codigo_autenticidade: corrido.match(/codigo de\s*seguranca\s*([A-Z0-9]{10,32})/i)?.[1],
    resultado: resultado(corrido),
  };
}

/* ── TJM/SP — Justiça Militar estadual ─────────────────────────────────── */

function parseTjmSp(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  // Aqui pai e mãe VÊM ROTULADOS — é o único da leva que permite atribuir
  // papel com segurança, junto com STM (só mãe) e TRF (só mãe).
  return {
    orgao: "tjm_sp",
    tipoDocumento: "antecedentes_militar_estadual",
    nome_titular: upperOrUndef(g(/em nome de:\s*\n+\s*(.+?)\s*\n/i)),
    cpf: cpf11(g(/CPF:\s*([\d.\-]+)/i)),
    data_nascimento: iso(g(/Data de Nascimento:\s*([\d/]+)/i)),
    nome_mae: upperOrUndef(g(/Mae:\s*(.+?)\s*$/im)),
    nome_pai: upperOrUndef(g(/Pai:\s*(.+?)\s*$/im)),
    // Naturalidade do TJM/SP NÃO é confiável: num cliente veio "JACAREI - SP"
    // e no outro "3750 - SP" — código do município em vez do nome. Extraio,
    // mas o consumidor não deve usar este campo para conferência de cadastro.
    naturalidade: naturalidadeTjm(t),
    validade_dias: numOrUndef(g(/PRAZO DE\s*(\d{1,3})\s*\(/i)),
    data_emissao: iso(g(/^\s*(\d{2}\/\d{2}\/\d{4}),/m)),
    resultado: resultado(t),
  };
}

/* ── helpers ───────────────────────────────────────────────────────────── */

/**
 * Naturalidade do TJM/SP fica na mesma linha do "Pai:", separada só por
 * espaços. Sem cortar ali, o valor engole o nome do pai inteiro.
 */
function naturalidadeTjm(t: string): string | undefined {
  const linha = t.match(/Naturalidade:\s*([^\n]+)/i)?.[1] ?? "";
  const valor = linha.split(/\s{2,}|\s+Pai:/i)[0]?.trim();
  if (!valor || valor.length < 2) return undefined;
  // Código de município em vez do nome — devolve, mas sinalizado como não
  // comparável pelo formato puramente numérico.
  return flat(valor);
}

function upperOrUndef(v: string | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s.length > 1 ? upper(s) : undefined;
}
function numOrUndef(v: string | undefined): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Ponto de entrada: identifica o órgão e aplica o parser dele.
 * Devolve `null` quando o layout não é conhecido — aí sim a IA entra.
 */
export function parseCertidao(texto: string): CamposCertidao | null {
  const orgao = identificarOrgao(texto);
  if (!orgao) return null;
  switch (orgao) {
    case "stm": return parseStm(texto);
    case "tse": return parseTse(texto);
    case "iirgd": return parseIirgd(texto);
    case "tjsp_distribuicao": return parseTjsp(texto, "tjsp_distribuicao");
    case "tjsp_execucoes": return parseTjsp(texto, "tjsp_execucoes");
    case "trf_regional": return parseTrfRegional(texto);
    case "tjm_sp": return parseTjmSp(texto);
  }
}
