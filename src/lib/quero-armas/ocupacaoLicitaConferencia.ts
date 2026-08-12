/**
 * OCUPAÇÃO LÍCITA — regras canônicas de conferência dos documentos de empresa.
 *
 * Fonte ÚNICA das decisões (Hub Documental, pop-up guiado do cliente e
 * validação por IA nas Edge Functions consomem daqui — nunca duplicar regra):
 *
 *  - CCMEI / Contrato Social / Requerimento de Empresário (ficha da Junta):
 *      documentos CONSTITUTIVOS. Não têm emissão nem validade a conferir.
 *      Confronta somente NOME do titular, CPF e SITUAÇÃO CADASTRAL.
 *  - Cartão CNPJ: emissão obrigatória, validade = emissão + 30 dias.
 *  - QSA: 30 dias, emissão herdada do Cartão CNPJ aprovado (mesma consulta).
 *  - Nota fiscal: confere apenas o EMITENTE (prestador) contra o cadastro.
 */

export function soDigitos(v?: string | null): string {
  return String(v || "").replace(/\D/g, "");
}

export function normNome(v?: string | null): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tipos constitutivos: sem emissão e sem validade. */
export function isConstitutivoEmpresa(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return (
    t.includes("ccmei") ||
    t.includes("contrato_social") ||
    t.includes("ficha_cadastral") ||
    t.includes("requerimento_empresario") ||
    t.includes("requerimento_de_empresario")
  );
}

export function isCartaoCnpj(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return t.includes("cartao_cnpj") || t === "renda_cnpj_autonomo";
}

export function isQsa(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return t === "renda_qsa" || t.includes("qsa");
}

export function isNotaFiscalOcupacao(tipo?: string | null): boolean {
  const t = String(tipo || "").toLowerCase();
  return t.includes("nota_fiscal") || /(^|_)nf(_|$)/.test(t) || t.includes("nf_recente") || t.includes("nf_empresa");
}

/** O Hub deve pedir data de emissão/validade para este tipo? */
export function exigeDatasOcupacao(tipo?: string | null): boolean {
  if (isConstitutivoEmpresa(tipo)) return false;
  if (isNotaFiscalOcupacao(tipo)) return false;
  return true;
}

/** ATIVA/ATIVO aprova; qualquer outra situação reprova. Vazio = não avalia. */
export function situacaoCadastralAprovada(valor?: string | null): boolean | null {
  const n = normNome(valor);
  if (!n) return null;
  if (/\bATIVA?\b/.test(n) && !/\bINATIVA?\b/.test(n)) return true;
  return false;
}

/** O QSA precisa conter, no mínimo, o nome do cliente cadastrado. */
export function qsaContemCliente(
  textoOuSocios: string | string[] | null | undefined,
  clienteNome?: string | null,
): boolean | null {
  const alvo = normNome(clienteNome);
  if (!alvo) return null;
  const fonte = Array.isArray(textoOuSocios)
    ? textoOuSocios.map(normNome).join(" | ")
    : normNome(textoOuSocios);
  if (!fonte) return null;
  if (fonte.includes(alvo)) return true;
  // Tolerância: todos os tokens significativos do nome presentes na lista.
  const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
  const tokens = alvo.split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
  if (!tokens.length) return null;
  return tokens.every((t) => fonte.includes(t));
}

/**
 * Emitente da nota fiscal / dados da empresa: aprova quando o CNPJ OU a razão
 * social batem com a referência (cadastro do cliente ou Cartão CNPJ aprovado).
 */
export function emitenteConfere(
  doc: { cnpj?: string | null; razao_social?: string | null },
  ref: { cnpj?: string | null; razao_social?: string | null },
): boolean | null {
  const cnpjDoc = soDigitos(doc.cnpj);
  const cnpjRef = soDigitos(ref.cnpj);
  const razaoDoc = normNome(doc.razao_social);
  const razaoRef = normNome(ref.razao_social);
  const comparacoes: boolean[] = [];
  if (cnpjDoc && cnpjRef) comparacoes.push(cnpjDoc === cnpjRef);
  if (razaoDoc && razaoRef) {
    comparacoes.push(
      razaoDoc === razaoRef || razaoDoc.includes(razaoRef) || razaoRef.includes(razaoDoc),
    );
  }
  if (!comparacoes.length) return null;
  return comparacoes.some(Boolean);
}

/** QSA e Cartão CNPJ devem vir da MESMA consulta da Receita (mesma emissão). */
export function qsaMesmaEmissaoDoCartao(
  emissaoQsa?: string | null,
  emissaoCartao?: string | null,
): boolean | null {
  const a = String(emissaoQsa || "").slice(0, 10);
  const b = String(emissaoCartao || "").slice(0, 10);
  if (!a || !b) return null;
  return a === b;
}
