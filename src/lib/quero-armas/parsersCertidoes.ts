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
  | "tjm_sp"
  | "cr_exercito"
  | "boletim_ocorrencia"
  /* ── Grupo OCUPAÇÃO LÍCITA E RENDA ──────────────────────────────────────
   * Não são certidões, mas entram pelo MESMO motor de propósito: mesma
   * extração local de texto (`extracaoLocalPdf`), mesmo contrato de campos,
   * mesma conferência contra o cadastro. Criar um parser paralelo só para
   * esse grupo duplicaria as regras de "nada é inferido" e de rejeição.
   */
  | "ccmei"
  | "cartao_cnpj"
  | "qsa"
  | "nota_fiscal";

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
  /** Só no CR: validade, órgão vinculador e atividades apostiladas. */
  data_validade?: string; // YYYY-MM-DD
  orgao_vinculacao?: string;
  amparo_legal?: string;
  /** Modalidades apostiladas: colecionador | atirador | cacador. */
  atividades?: string[];
  /* ── Só no Boletim de Ocorrência ── */
  /** Nº do boletim, como impresso (ex.: "EP6371-1/2026"). */
  numero_bo?: string;
  protocolo?: string;
  delegacia?: string;
  /** Tipificações: "Código Penal - Ameaça (art. 147)". */
  naturezas?: string[];
  data_fato?: string;      // YYYY-MM-DD
  hora_fato?: string;
  local_fato?: string;
  /** Nome da vítima, para conferir se o BO é do cliente. */
  vitima_nome?: string;
  vitima_cpf?: string;
  relato?: string;
  /* ── Só na certidão do TRF ── */
  /**
   * Número da região do Tribunal Regional Federal (1 a 6), lido do próprio
   * documento.
   *
   * Existe porque a certidão federal é REGIONAL: a do TRF3 cobre SP e MS, e
   * não cobre quem mora na Bahia (TRF1). Sem este campo o sistema tratava
   * toda certidão federal como se fosse TRF3 — inclusive as que não são —, e
   * um documento passaria a cumprir a exigência de quem ele não cobre.
   *
   * `undefined` quando o documento não declara a região. Não inferir.
   */
  trf_regiao?: number;

  /* ── Só no grupo de ocupação lícita e renda ── */
  /** CNPJ com 14 dígitos, sem máscara. */
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  /** Como impresso: "ATIVA", "BAIXADA", "SUSPENSA", "INAPTA". */
  situacao_cadastral?: string;
  data_abertura?: string; // YYYY-MM-DD
  /** Ocupação principal do MEI / CNAE principal, como impresso. */
  ocupacao_principal?: string;
  /** Sócios e administradores lidos do QSA, sem inferir papel. */
  socios?: string[];
  numero_nf?: string;
  valor_nf?: string;
  /** Chave de acesso de 44 dígitos da NFS-e (padrão nacional / DANFSe). */
  chave_acesso?: string;

  /* ── Só na NFS-e (DANFSe padrão nacional) ── */
  /** Competência da NFS-e (YYYY-MM-DD). */
  competencia?: string;
  numero_dps?: string;
  serie_dps?: string;
  municipio_emissor?: string;
  email_municipio?: string;
  prestador_inscricao_municipal?: string;
  prestador_telefone?: string;
  prestador_email?: string;
  prestador_endereco?: string;
  prestador_municipio?: string;
  prestador_cep?: string;
  prestador_simples_nacional?: string;
  prestador_regime_apuracao?: string;
  tomador_documento?: string;
  tomador_nome?: string;
  tomador_inscricao_municipal?: string;
  tomador_telefone?: string;
  tomador_email?: string;
  tomador_endereco?: string;
  tomador_municipio?: string;
  tomador_cep?: string;
  codigo_tributacao_nacional?: string;
  codigo_tributacao_municipal?: string;
  local_prestacao?: string;
  pais_prestacao?: string;
  descricao_servico?: string;
  /** Itens lidos da descrição do serviço (mercadoria/quantidade/preço/total). */
  itens_servico?: { descricao: string; quantidade?: number; preco?: number; total?: number }[];
  tributacao_issqn?: string;
  municipio_incidencia_issqn?: string;
  retencao_issqn?: string;
  valor_liquido?: string;
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

const MESES_PT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

/**
 * Data por extenso: "São Paulo, 23 de julho de 2026."
 *
 * O TJM/SP fecha a certidão assim, e é a ÚNICA data de emissão no documento —
 * o "10/06/2026" que aparece no exemplar de outro cliente é o cabeçalho do
 * navegador, não faz parte da certidão. Procurar só por dd/mm/aaaa dava o
 * documento como sem data e o rejeitava indevidamente.
 */
function dataPorExtenso(t: string): string | undefined {
  const m = norm(t).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
  if (!m) return undefined;
  const mes = MESES_PT[m[2].toLowerCase()];
  if (!mes) return undefined;
  const s = `${m[3]}-${mes}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) ? undefined : s;
}

/* ── Identificação do órgão pelo cabeçalho ─────────────────────────────── */

export function identificarOrgao(texto: string): OrgaoCertidao | null {
  const t = flat(texto).toUpperCase();
  /* Ocupação lícita primeiro: são os únicos com CNPJ no cabeçalho, e o
   * CCMEI precisa vir antes do cartão CNPJ porque também imprime
   * "SITUACAO CADASTRAL". */
  if (/CERTIFICADO DA CONDICAO DE MICROEMPREENDEDOR INDIVIDUAL|CCMEI/.test(t)) return "ccmei";
  if (/QUADRO DE SOCIOS E ADMINISTRADORES/.test(t)) return "qsa";
  if (/COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL/.test(t)) return "cartao_cnpj";
  if (
    /NOTA FISCAL(\s+DE\s+SERVICOS?)?\s*(ELETRONICA)?|NFS-?E|DANFS?E|CHAVE DE ACESSO DA NFS/.test(t)
  )
    return "nota_fiscal";
  if (/CERTIFICADO DE REGISTRO/.test(t) && /N. CR/.test(t)) return "cr_exercito";
  if (/BOLETIM DE OCORRENCIA|BOLETIM N/.test(t)) return "boletim_ocorrencia";
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
  //
  // "natural de" é OPCIONAL: a certidão de Distribuições do primeiro cliente
  // simplesmente não traz esse trecho, enquanto as outras três trazem. Com o
  // segmento obrigatório o regex falhava inteiro e o documento era rejeitado
  // por "não traz nome/CPF/nascimento" — falso negativo que só apareceu no
  // quarto exemplar.
  const qualificacao = corrido.match(
    /CONSTAR contra:\s*\**\s*(.+?),\s*RG:\s*([^,]+),\s*CPF:\s*([\d.\-]+),\s*nascido em\s*([\d/]+),\s*(?:natural de\s*(.+?),\s*)?filho de\s*(.+?),?\s*conforme/i,
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

/**
 * Região do TRF, lida do cabeçalho do documento.
 *
 * Aceita algarismo ("DA 3ª REGIÃO") e romano ("DA III REGIÃO") porque os
 * portais das seis regiões não seguem a mesma grafia. Devolve `undefined`
 * quando não encontra — nunca assume TRF3.
 */
function trfRegiao(texto: string): number | undefined {
  const t = flat(texto).toUpperCase();
  const arabe = t.match(/TRIBUNAL REGIONAL FEDERAL DA\s*(\d)\s*[ªAO]?\s*REGIAO/);
  if (arabe) {
    const n = Number(arabe[1]);
    return n >= 1 && n <= 6 ? n : undefined;
  }
  const romano = t.match(/TRIBUNAL REGIONAL FEDERAL DA\s*(I{1,3}|IV|V|VI)\s*REGIAO/);
  if (romano) {
    const mapa: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
    return mapa[romano[1]];
  }
  // Forma abreviada usada por alguns portais: "TRF3", "TRF-3".
  const curto = t.match(/\bTRF\s*-?\s*([1-6])\b/);
  return curto ? Number(curto[1]) : undefined;
}

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
    // Campo NOVO, ao lado do slug — não substitui `tipoDocumento`. O slot do
    // Hub continua sendo `antecedentes_federal_trf3_regional` para as seis
    // regiões; quem diz qual região é este campo.
    trf_regiao: trfRegiao(texto),
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
    // Naturalidade aqui é digitada por quem PEDE a certidão, não pelo tribunal.
    // Num cliente veio "JACAREI - SP" e no outro "3750 - SP" — este segundo é
    // erro de digitação do próprio requerente. Por isso o campo É comparado e,
    // divergindo, a certidão é REJEITADA (ver conferenciaCertidao.ts).
    naturalidade: naturalidadeTjm(t),
    validade_dias: numOrUndef(g(/PRAZO DE\s*(\d{1,3})\s*\(/i)),
    // Prioriza a data POR EXTENSO, que é a da própria certidão. O dd/mm/aaaa
    // do topo é cabeçalho do navegador e some quando o cliente salva o PDF
    // com essa opção desligada.
    data_emissao: dataPorExtenso(t) ?? iso(g(/^\s*(\d{2}\/\d{2}\/\d{4}),/m)),
    resultado: resultado(t),
  };
}

/* ── CR — Certificado de Registro ──────────────────────────────────────── */

/**
 * As três atividades que o CR pode apostilar.
 *
 * O documento as escreve por extenso e numeradas: "1- Tiro Desportivo -
 * Atirador Desportivo; 2- Caça - Caçador; 3- Colecionamento - Colecionador".
 * O cliente pode ter uma, duas ou as três — e cada autorização de compra sai
 * em UMA delas, nunca em mais de uma.
 */
const ATIVIDADES_CR: Array<{ re: RegExp; codigo: string }> = [
  { re: /ATIRADOR DESPORTIVO|TIRO DESPORTIVO/i, codigo: "atirador" },
  { re: /CA[CÇ]ADOR|\bCA[CÇ]A\b/i, codigo: "cacador" },
  { re: /COLECIONADOR|COLECIONAMENTO/i, codigo: "colecionador" },
];

/**
 * A linha de valores do CR: "755.477.752-15        SR/PF/SP".
 *
 * Usa `\s+`, não `\s{2,}`: o `norm()` já colapsou os espaços múltiplos do
 * layout em um só. A âncora `^` é o que impede casar com a linha do topo
 * ("N° CR 300.532.598-90 VALIDADE ..."), onde o número do CR também tem
 * formato de CPF mas não começa a linha.
 */
function linhaCpfOrgao(t: string): [string, string, string] | null {
  const m = t.match(/^\s*(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\S.*?)\s*$/m);
  return m ? [m[0], m[1], m[2].trim()] : null;
}

function parseCr(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();

  // O bloco de atividades vai do rótulo até a linha da assinatura.
  const bloco = t.match(/ATIVIDADES AUTORIZADAS([\s\S]*?)(?:Documento Assinado|QR Code|$)/i)?.[1] ?? "";
  const atividades = ATIVIDADES_CR.filter((a) => a.re.test(bloco)).map((a) => a.codigo);

  return {
    orgao: "cr_exercito",
    tipoDocumento: "cr",
    // O nº do CR tem formato de CPF mas NÃO é CPF: é o registro. Não passa
    // por cpf11() para não ser confundido com o documento do titular.
    numero_documento: g(/N.\s*CR\s+([\d.\-]{10,20})/i)?.replace(/\D/g, ""),
    data_validade: iso(g(/VALIDADE\s+([\d/]+)/i)),
    nome_titular: upperOrUndef(g(/NOME COMPLETO\s*\n\s*(.+)$/im)),
    // CPF e órgão dividem a MESMA linha, separados só por espaços — o rótulo
    // fica na linha de cima. Capturar a linha inteira colava um no outro.
    cpf: cpf11(linhaCpfOrgao(t)?.[1]),
    orgao_vinculacao: linhaCpfOrgao(t)?.[2],
    amparo_legal: g(/AMPARO LEGAL\s*\n\s*(.+?)\s*$/im),
    atividades: atividades.length ? atividades : undefined,
    codigo_autenticidade: g(/SisGCOrp\s+([0-9a-f]{16,64})/i),
    data_emissao: iso(g(/,\s*([\d]{2}\/[\d]{2}\/[\d]{4})\s*$/m)),
  };
}

/* ── Boletim de Ocorrência ─────────────────────────────────────────────── */

/**
 * O BO é a prova que sustenta a efetiva necessidade.
 *
 * O que importa extrair não é só identificar o documento: é a MATÉRIA — o que
 * aconteceu, quando e contra quem. São esses campos que alimentam a narrativa
 * cronológica e o e-mail específico que o cliente recebe ("recebemos o BO nº
 * X, referente a ameaça, ocorrida em ...").
 *
 * Sobre a VÍTIMA: o nome é extraído para contexto, NÃO para rejeitar. BO de
 * terceiro é aceito quando a vítima está intrinsecamente ligada a ele — por
 * exemplo, um fato ocorrido na empresa do patrão que colocou o cliente em
 * risco. O BO em nome do próprio cliente tem mais peso, e é isso que o sistema
 * o orienta a providenciar; mas a falta dele não invalida a prova.
 */
function parseBoletimOcorrencia(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();

  // "Naturezas da Ocorrência" lista uma ou mais tipificações, uma por linha.
  const blocoNat = t.match(/Naturezas da Ocorrencia([\s\S]*?)Dados da Ocorrencia/i)?.[1] ?? "";
  const naturezas = blocoNat
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /art\.|Lei |Codigo Penal|Decreto/i.test(l))
    .map((l) => l.replace(/\s+/g, " "));

  // O bloco da vítima vem depois do rótulo "- Vítima".
  const blocoVit = t.match(/-\s*Vitima\s+Nome:\s*([\s\S]{0,400})/i)?.[1] ?? "";

  const dataHora = t.match(/^\s*Ocorrencia:\s*(\d{2}\/\d{2}\/\d{4})(?:\s*as\s*([\d:]+))?/im);

  return {
    orgao: "boletim_ocorrencia",
    tipoDocumento: "boletim_ocorrencia",
    numero_bo: g(/Boletim N.:\s*([A-Z0-9\-\/]+)/i),
    numero_documento: g(/Boletim N.:\s*([A-Z0-9\-\/]+)/i)?.replace(/\D/g, ""),
    protocolo: g(/Protocolo N.:\s*([\d\/]+)/i),
    delegacia: g(/Dependencia:\s*(.+?)\s*$/im) ?? g(/Circunscricao:\s*(.+?)\s*$/im),
    naturezas: naturezas.length ? naturezas : undefined,
    data_fato: iso(dataHora?.[1]),
    hora_fato: dataHora?.[2],
    local_fato: g(/Local do Fato:\s*(.+?)\s*$/im),
    vitima_nome: upperOrUndef(blocoVit.split("\n")[0]),
    vitima_cpf: cpf11(blocoVit.match(/CPF:\s*([\d.\-]{11,14})/i)?.[1]),
    data_emissao: iso(g(/Emitido:\s*(\d{2}\/\d{2}\/\d{4})/i)),
    relato: g(/Descricao ocorrencia cidadao:\s*([\s\S]{0,1200}?)(?:\n\s*Documento assinado|$)/i)
      ?.replace(/\s+/g, " ")
      .trim(),
    codigo_autenticidade: g(/Chave de Impressao:\s*([A-F0-9]{16,64})/i),
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
    case "cr_exercito": return parseCr(texto);
    case "boletim_ocorrencia": return parseBoletimOcorrencia(texto);
    case "ccmei": return parseCcmei(texto);
    case "cartao_cnpj": return parseCartaoCnpj(texto);
    case "qsa": return parseQsa(texto);
    case "nota_fiscal": return parseNotaFiscal(texto);
  }
}

/* =============================================================================
 * Grupo OCUPAÇÃO LÍCITA E RENDA
 *
 * Mesmas regras do resto do arquivo: campo que não aparece rotulado volta
 * `undefined`. Situação cadastral sai como está impressa — quem decide se
 * "BAIXADA" reprova é a conferência, não o parser.
 * ============================================================================= */

function cnpj14(v: string | undefined): string | undefined {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : undefined;
}

function situacao(t: string): string | undefined {
  const m = norm(t).match(/SITUACAO CADASTRAL\s*:?\s*([A-ZÁÉÍÓÚÃÕÇa-z]+)/i);
  const s = m?.[1]?.toUpperCase();
  return s && /ATIVA|BAIXADA|SUSPENSA|INAPTA|NULA/.test(s) ? s : undefined;
}

/**
 * Documentos oficiais em layout de FORMULÁRIO (CCMEI, cartão CNPJ, QSA,
 * DANFSe): o rótulo fica em uma linha e o valor na linha seguinte, em
 * colunas separadas por espaços. Retorna a primeira linha útil após o rótulo.
 */
function linhaAposRotulo(texto: string, rotulo: RegExp): string | undefined {
  const linhas = texto.split(/\r?\n/);
  const i = linhas.findIndex((l) => rotulo.test(l));
  if (i < 0) return undefined;
  for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
    const v = linhas[j].trim();
    if (v && !/^[-\s]+$/.test(v)) return v;
  }
  return undefined;
}

const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
const RE_DATA = /\b\d{2}\/\d{2}\/\d{4}\b/;
const RE_SIT = /\b(ATIVA|BAIXADA|SUSPENSA|INAPTA|NULA)\b/i;

function parseCcmei(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  const linha = (re: RegExp) => linhaAposRotulo(t, re);
  const linhaCpf = linha(/^\s*Nome\s+Civil\b/im);
  const linhaCnpj = linha(/^\s*CNPJ\b/im);
  const linhaSit = linha(/Situa[cç][aã]o\s+Cadastral\s+Vigente/i);
  return {
    orgao: "ccmei",
    tipoDocumento: "renda_ccmei",
    nome_titular: upperOrUndef(
      linhaCpf?.replace(RE_CPF, "").trim() ||
        g(/Nome\s+(?:Empresarial|do\s+Empres[aá]rio)\s*:?\s*(.+)$/im),
    ),
    cpf: cpf11(g(/CPF\s*:?\s*([\d.\-]+)/i) ?? linhaCpf?.match(RE_CPF)?.[0]),
    cnpj: cnpj14(g(/CNPJ\s*:?\s*([\d./\-]+)/i) ?? linhaCnpj?.match(RE_CNPJ)?.[0]),
    razao_social: upperOrUndef(g(/Nome\s+Empresarial\s*:?\s*(.+)$/im)),
    nome_fantasia: upperOrUndef(g(/Nome\s+Fantasia\s*:?\s*(.+)$/im)),
    situacao_cadastral: situacao(t) ?? linhaSit?.match(RE_SIT)?.[1]?.toUpperCase(),
    data_abertura: iso(
      g(/Data\s+de\s+(?:In[ií]cio\s+de\s+Atividades|Abertura)\s*:?\s*([\d/]+)/i) ??
        linhaCnpj?.match(RE_DATA)?.[0],
    ),
    ocupacao_principal: upperOrUndef(g(/Ocupa[cç][aã]o\s+Principal\s*:?\s*(.+)$/im)),
    data_emissao: iso(
      g(/(?:Emitido(?:\s+no\s+dia)?|Data\s+de\s+emiss[aã]o)\s*(?:em)?\s*:?\s*([\d/]+)/i),
    ),
  };
}

function parseCartaoCnpj(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  const linha = (re: RegExp) => linhaAposRotulo(t, re);
  const linhaInscricao = linha(/N[UÚ]MERO DE INSCRI[CÇ][AÃ]O/i);
  const linhaSit = linha(/^\s*SITUA[CÇ][AÃ]O CADASTRAL\b/im);
  return {
    orgao: "cartao_cnpj",
    tipoDocumento: "renda_cartao_cnpj",
    cnpj: cnpj14(
      g(/N[UÚ]MERO DE INSCRI[CÇ][AÃ]O\s*:?\s*([\d./\-]+)/i) ??
        g(/CNPJ\s*:?\s*([\d./\-]+)/i) ??
        linhaInscricao?.match(RE_CNPJ)?.[0],
    ),
    razao_social: upperOrUndef(
      g(/NOME EMPRESARIAL\s*:?\s*(.+)$/im) ?? linha(/^\s*NOME EMPRESARIAL\b/im),
    ),
    nome_fantasia: upperOrUndef(g(/T[IÍ]TULO DO ESTABELECIMENTO[^:]*:?\s*(.+)$/im)),
    situacao_cadastral: situacao(t) ?? linhaSit?.match(RE_SIT)?.[1]?.toUpperCase(),
    data_abertura: iso(
      g(/DATA DE ABERTURA\s*:?\s*([\d/]+)/i) ?? linhaInscricao?.match(RE_DATA)?.[0],
    ),
    ocupacao_principal: upperOrUndef(
      g(/ATIVIDADE ECON[OÔ]MICA PRINCIPAL\s*:?\s*(.+)$/im),
    ),
    data_emissao: iso(g(/Emitido no dia\s*:?\s*([\d/]+)/i) ?? linha(/Emitido no dia/i)?.match(RE_DATA)?.[0]),
  };
}

function parseQsa(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  // Cada sócio aparece como "Nome do Sócio: FULANO" ou em linhas após o
  // cabeçalho do quadro. Só o que vem ROTULADO é lido — sem varrer linhas
  // soltas, que trariam endereço e capital social como se fossem nomes.
  const socios = Array.from(
    t.matchAll(/Nome(?:\/Nome Empresarial)?\s+do\s+S[oó]cio\s*:?\s*(.+)$/gim),
  )
    .map((m) => upper(m[1]))
    .filter((s) => s.length > 2);
  return {
    orgao: "qsa",
    tipoDocumento: "renda_qsa",
    cnpj: cnpj14(
      g(/CNPJ\s*:?\s*([\d./\-]+)/i) ??
        linhaAposRotulo(t, /N[UÚ]MERO DE INSCRI[CÇ][AÃ]O/i)?.match(RE_CNPJ)?.[0] ??
        t.match(RE_CNPJ)?.[0],
    ),
    razao_social: upperOrUndef(
      g(/NOME EMPRESARIAL\s*:?\s*(.+)$/im) ?? linhaAposRotulo(t, /^\s*NOME EMPRESARIAL\b/im),
    ),
    socios: socios.length ? socios : undefined,
    data_emissao: iso(
      g(/Emitido no dia\s*:?\s*([\d/]+)/i) ??
        linhaAposRotulo(t, /Emitido no dia/i)?.match(RE_DATA)?.[0],
    ),
  };
}

function parseNotaFiscal(texto: string): CamposCertidao {
  const t = norm(texto);
  const g = (re: RegExp) => t.match(re)?.[1]?.trim();
  /* Recorta as seções do DANFSe: os mesmos rótulos (CNPJ, Endereço, CEP…)
   * aparecem no prestador e no tomador — sem recorte, o parser leria o
   * endereço do cliente do Gilson como se fosse o dele. */
  const secao = (ini: RegExp, fim: RegExp): string => {
    const i = t.search(ini);
    if (i < 0) return "";
    const resto = t.slice(i);
    const j = resto.slice(1).search(fim);
    return j < 0 ? resto : resto.slice(0, j + 1);
  };
  const secPrest = secao(/EMITENTE DA NFS-?E/i, /TOMADOR DO SERVI[CÇ]O/i);
  const secTom = secao(/TOMADOR DO SERVI[CÇ]O/i, /INTERMEDI[AÁ]RIO|SERVI[CÇ]O PRESTADO/i);
  const secServ = secao(/SERVI[CÇ]O PRESTADO/i, /TRIBUTA[CÇ][AÃ]O MUNICIPAL/i);
  /** Lê um rótulo dentro de uma seção: valor na mesma linha ou na linha seguinte. */
  const campo = (bloco: string, re: RegExp): string | undefined => {
    const inline = bloco.match(new RegExp(re.source + String.raw`\s*:?\s*(.+)`, "i"))?.[1];
    const v = (inline ?? linhaAposRotulo(bloco, re) ?? "").split(/\s{2,}/)[0].trim();
    return v && v !== "-" ? v : undefined;
  };
  const limpaEmail = (v?: string) => v?.replace(/\S+@\S+/g, "").trim() || undefined;
  const num = (v?: string) =>
    v ? Number(v.replace(/\./g, "").replace(",", ".")) || undefined : undefined;

  // DANFSe (padrão nacional): os rótulos ficam em uma linha e os valores na
  // linha seguinte, em colunas — daí os fallbacks posicionais abaixo.
  const chave =
    t.match(/Chave\s+de\s+Acesso[^\d]{0,80}(\d{40,60})/i)?.[1] ?? t.match(/\b(\d{44,50})\b/)?.[1];
  const nomeEmpresarial = limpaEmail(
    campo(secPrest || t, /Nome\s*\/\s*Nome\s+Empresarial/i) ??
      linhaAposRotulo(t, /Nome\s*\/\s*Nome\s+Empresarial/i) ??
      undefined,
  );
  const dataHora = t.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}(?::\d{2})?/)?.[1];
  const valorNacional =
    g(/Valor\s+L[ií]quido\s+da\s+NFS-?e[^\d]{0,60}([\d.,]+)/i) ??
    g(/Valor\s+do\s+Servi[cç]o[^\d]{0,60}([\d.,]+)/i);
  const numeroNacional = g(/N[uú]mero\s+da\s+NFS-?e\D{0,120}?(\d{1,9})\b/i);

  /* Descrição do serviço → itens (mercadoria, quantidade, preço, total). */
  const descricao = (() => {
    const bloco = secServ || t;
    const m = bloco.match(/Descri[cç][aã]o\s+do\s+Servi[cç]o\s*:?\s*([\s\S]{0,1200}?)(?=TRIBUTA|$)/i);
    const bruto = (m?.[1] ?? "").replace(/\s+/g, " ").trim();
    return bruto.replace(/^Descri[cç][aã]o do servi[cç]o\s*/i, "").trim() || undefined;
  })();
  const itens: NonNullable<CamposCertidao["itens_servico"]> = [];
  if (descricao) {
    const re =
      /([A-Za-z][A-Za-z0-9À-ÿ\/ .-]{2,60}?)\s+bruto\s*:?\s*([\d.,]+)\s*pre[cç]o\s*:?\s*([\d.,]+)\s*total\s*:?\s*([\d.,]+)/gi;
    for (const m of descricao.matchAll(re)) {
      itens.push({
        descricao: upper(m[1]).replace(/^[,.;]\s*/, ""),
        quantidade: num(m[2]),
        preco: num(m[3]),
        total: num(m[4]),
      });
    }
  }

  return {
    orgao: "nota_fiscal",
    tipoDocumento: "renda_nf_recente",
    numero_nf:
      g(/N[UÚ]MERO DA NOTA\s*:?\s*(\d+)/i) ??
      g(/N[º°o]\s*(?:da\s*)?Nota\s*:?\s*(\d+)/i) ??
      numeroNacional,
    cnpj: cnpj14(
      secPrest.match(/Prestador\s+do\s+Servi[cç]o[^\d]{0,40}([\d./\-]{14,20})/i)?.[1] ??
        secPrest.match(RE_CNPJ)?.[0] ??
        g(/CNPJ\s*\/?\s*CPF[^\d]{0,60}([\d./\-]{14,20})/i) ??
        g(/CNPJ\s*:?\s*([\d./\-]+)/i),
    ),
    razao_social:
      upperOrUndef(g(/(?:Raz[aã]o Social|Nome\/Raz[aã]o Social)\s*:?\s*(.+)$/im)) ??
      upperOrUndef(nomeEmpresarial),
    valor_nf:
      g(/VALOR (?:TOTAL )?D[AO] (?:NOTA|SERVI[CÇ]O)[^\d]{0,20}([\d.,]+)/i) ?? valorNacional,
    chave_acesso: chave,
    data_emissao:
      iso(g(/Data(?:\s+e\s+Hora)?\s+de\s+Emiss[aã]o\s*:?\s*([\d/]+)/i)) ??
      iso(g(/Emiss[aã]o\s+da\s+NFS-?e\D{0,120}?(\d{2}\/\d{2}\/\d{4})/i)) ??
      iso(g(/Emiss[aã]o\s*:?\s*([\d/]+)/i)) ??
      iso(dataHora),

    /* ── Cabeçalho ── */
    competencia: iso(g(/Compet[eê]ncia\s+da\s+NFS-?e\D{0,120}?(\d{2}\/\d{2}\/\d{4})/i)),
    numero_dps: g(/N[uú]mero\s+da\s+DPS\D{0,120}?(\d{1,9})\b/i),
    serie_dps: g(/S[eé]rie\s+da\s+DPS\D{0,120}?(\d{1,9})\b/i),
    municipio_emissor: upperOrUndef(g(/PREFEITURA\s+MUNICIPAL\s+DE\s+(.+)$/im)),
    email_municipio: t.match(/([\w.\-]+@[\w.\-]*gov\.br)/i)?.[1]?.toLowerCase(),

    /* ── Prestador ── */
    prestador_inscricao_municipal: campo(secPrest, /Inscri[cç][aã]o\s+Municipal/i),
    prestador_telefone: campo(secPrest, /Telefone/i),
    prestador_email: secPrest.match(/([\w.\-]+@[\w.\-]+\.\w+)/)?.[1]?.toLowerCase(),
    prestador_endereco: upperOrUndef(campo(secPrest, /Endere[cç]o/i)),
    prestador_municipio: upperOrUndef(campo(secPrest, /Munic[ií]pio/i)),
    prestador_cep: campo(secPrest, /CEP/i)?.replace(/\D/g, "") || undefined,
    prestador_simples_nacional: campo(secPrest, /Simples\s+Nacional\s+na\s+Data\s+de\s+Compet[eê]ncia/i),
    prestador_regime_apuracao: campo(secPrest, /Regime\s+de\s+Apura[cç][aã]o\s+Tribut[aá]ria/i),

    /* ── Tomador ── */
    tomador_documento:
      campo(secTom, /CNPJ\s*\/\s*CPF\s*\/\s*NIF/i)?.replace(/[^\d]/g, "") || undefined,
    tomador_nome: upperOrUndef(limpaEmail(campo(secTom, /Nome\s*\/\s*Nome\s+Empresarial/i))),
    tomador_inscricao_municipal: campo(secTom, /Inscri[cç][aã]o\s+Municipal/i),
    tomador_telefone: campo(secTom, /Telefone/i),
    tomador_email: secTom.match(/([\w.\-]+@[\w.\-]+\.\w+)/)?.[1]?.toLowerCase(),
    tomador_endereco: upperOrUndef(campo(secTom, /Endere[cç]o/i)),
    tomador_municipio: upperOrUndef(campo(secTom, /Munic[ií]pio/i)),
    tomador_cep: campo(secTom, /CEP/i)?.replace(/\D/g, "") || undefined,

    /* ── Serviço prestado ── */
    codigo_tributacao_nacional: campo(secServ, /C[oó]digo\s+de\s+Tributa[cç][aã]o\s+Nacional/i),
    codigo_tributacao_municipal: campo(secServ, /C[oó]digo\s+de\s+Tributa[cç][aã]o\s+Municipal/i),
    local_prestacao: upperOrUndef(campo(secServ, /Local\s+da\s+Presta[cç][aã]o/i)),
    pais_prestacao: campo(secServ, /Pa[ií]s\s+da\s+Presta[cç][aã]o/i),
    descricao_servico: descricao,
    itens_servico: itens.length ? itens : undefined,

    /* ── Tributação / valores ── */
    tributacao_issqn: campo(t, /Tributa[cç][aã]o\s+do\s+ISSQN/i),
    municipio_incidencia_issqn: upperOrUndef(campo(t, /Munic[ií]pio\s+de\s+Incid[eê]ncia\s+do\s+ISSQN/i)),
    retencao_issqn: campo(t, /Reten[cç][aã]o\s+do\s+ISSQN/i),
    valor_liquido: g(/Valor\s+L[ií]quido\s+da\s+NFS-?e[^\d]{0,60}([\d.,]+)/i),
  };
}
