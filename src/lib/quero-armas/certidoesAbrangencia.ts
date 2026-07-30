/* =============================================================================
 * Abrangência territorial das certidões de antecedentes
 *
 * Regra de negócio (definida pelo usuário, 30/07/2026):
 *
 *   A UF que manda é a do COMPROVANTE DE ENDEREÇO do cliente, não a da
 *   naturalidade nem a do RG. Se o cliente mora na Bahia, os antecedentes
 *   estaduais são da Bahia — pedir certidão de SP para ele é exigência
 *   errada, e a PF indefere.
 *
 *   Exceção: as certidões contra a União não têm UF. Valem para o Brasil
 *   inteiro, com o MESMO link, more o cliente onde morar:
 *     • Crimes eleitorais (TSE)
 *     • Crimes militares contra a União (STM)
 *
 * Esta camada é PURAMENTE DESCRITIVA: só declara o que cada certidão cobre e
 * onde emitir. Não decide checklist, não grava nada. Quem monta a exigência
 * consulta aqui antes de escolher a variante.
 *
 * IMPORTANTE — por que os links de outras UFs estão `null`:
 * cada tribunal estadual tem portal próprio, com caminho próprio. Chutar URL
 * faz o cliente perder a viagem e voltar achando que o sistema errou. UF sem
 * link mapeado devolve `null` e a UI deve pedir emissão manual, não inventar.
 * ============================================================================= */

/**
 * - "uniao"       → contra a União. Sem UF, link único nacional.
 * - "federal_trf" → Justiça Federal, mas o TRF competente varia por região.
 * - "estadual"    → vinculada à UF do comprovante de endereço.
 */
export type AbrangenciaCertidao = "uniao" | "federal_trf" | "estadual";

export interface CertidaoAbrangencia {
  tipo: string;
  titulo: string;
  abrangencia: AbrangenciaCertidao;
  /** UF a que a variante pertence. `null` quando a abrangência é nacional. */
  uf: string | null;
  /** Link oficial de emissão, quando confirmado. `null` = emitir manualmente. */
  link: string | null;
  nota?: string;
}

/* ── Contra a União — mesmo link para todo o Brasil ────────────────────── */

export const CERTIDOES_UNIAO: CertidaoAbrangencia[] = [
  {
    tipo: "certidao_crimes_eleitorais_tse",
    titulo: "Crimes eleitorais — TSE",
    abrangencia: "uniao",
    uf: null,
    link: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-crimes-eleitorais",
    nota: "Traz o número do título de eleitor impresso — serve para preencher o cadastro.",
  },
  {
    tipo: "certidao_crimes_militares_stm",
    titulo: "Crimes militares contra a União — STM",
    abrangencia: "uniao",
    uf: null,
    link: "https://www.stm.jus.br/servicos-stm/certidao-negativa/emitir-certidao",
    nota: "Justiça Militar da União. Não confundir com o TJM estadual.",
  },
];

/* ── Justiça Federal — o TRF competente segue a região do endereço ─────── */

export const CERTIDOES_FEDERAIS_TRF: CertidaoAbrangencia[] = [
  {
    tipo: "certidao_federal_trf3_regional",
    titulo: "TRF3 — Regional",
    abrangencia: "federal_trf",
    uf: "SP",
    link: null,
    nota: "TRF3 cobre SP e MS. Cliente de outra UF emite no TRF da região dele (TRF1, TRF2, TRF4, TRF5, TRF6).",
  },
  {
    tipo: "certidao_federal_trf3_sjsp_jef",
    titulo: "TRF3 — SJSP / JEF",
    abrangencia: "federal_trf",
    uf: "SP",
    link: null,
    nota: "Seção Judiciária de São Paulo. Equivalente em outra UF é a Seção Judiciária local.",
  },
];

/* ── Estaduais — hoje só SP mapeado ────────────────────────────────────── */

export const CERTIDOES_ESTADUAIS: CertidaoAbrangencia[] = [
  {
    tipo: "certidao_antecedentes_policia_civil_sp",
    titulo: "Antecedentes criminais — SSP/Polícia Civil",
    abrangencia: "estadual",
    uf: "SP",
    link: null,
    nota: "Emitida pela Secretaria de Segurança Pública do estado de residência.",
  },
  {
    tipo: "certidao_tjsp_distribuicao_criminal",
    titulo: "Distribuição de ações criminais — TJ",
    abrangencia: "estadual",
    uf: "SP",
    link: null,
  },
  {
    tipo: "certidao_tjsp_execucoes_criminais",
    titulo: "Execuções criminais — TJ",
    abrangencia: "estadual",
    uf: "SP",
    link: null,
  },
  {
    tipo: "certidao_estadual_segundo_grau_acoes_criminais",
    titulo: "Segundo grau — ações criminais",
    abrangencia: "estadual",
    uf: "SP",
    link: null,
  },
  {
    tipo: "certidao_estadual_segundo_grau_execucoes_criminais",
    titulo: "Segundo grau — execuções criminais",
    abrangencia: "estadual",
    uf: "SP",
    link: null,
  },
  {
    tipo: "certidao_criminal_tjmsp",
    titulo: "Justiça Militar estadual — TJM/SP",
    abrangencia: "estadual",
    uf: "SP",
    link: "https://certidaocriminal.tjmsp.jus.br/",
    nota:
      "ATENÇÃO: Tribunal de Justiça Militar ESTADUAL só existe em SP, MG e RS. " +
      "Cliente de outra UF não tem esse tribunal — a competência militar estadual " +
      "cai no próprio TJ local. Confirmar com o usuário antes de exigir.",
  },
];

export const CERTIDOES_ABRANGENCIA: CertidaoAbrangencia[] = [
  ...CERTIDOES_UNIAO,
  ...CERTIDOES_FEDERAIS_TRF,
  ...CERTIDOES_ESTADUAIS,
];

const POR_TIPO = new Map(CERTIDOES_ABRANGENCIA.map((c) => [c.tipo, c]));

export function getAbrangenciaCertidao(tipo: string | null | undefined): CertidaoAbrangencia | null {
  if (!tipo) return null;
  return POR_TIPO.get(String(tipo).trim().toLowerCase()) ?? null;
}

/** Certidão que vale em qualquer UF — só as duas contra a União. */
export function isCertidaoNacional(tipo: string | null | undefined): boolean {
  return getAbrangenciaCertidao(tipo)?.abrangencia === "uniao";
}

/**
 * A certidão `tipo` serve para quem mora em `ufCliente`?
 *
 * Nacional → sempre serve. Estadual/regional → só se a UF bater. UF do cliente
 * desconhecida devolve `null` (indefinido), nunca `true`: sem saber onde ele
 * mora não dá para afirmar que a certidão de SP vale.
 */
export function certidaoServeParaUF(
  tipo: string | null | undefined,
  ufCliente: string | null | undefined,
): boolean | null {
  const meta = getAbrangenciaCertidao(tipo);
  if (!meta) return null;
  if (meta.abrangencia === "uniao") return true;
  const uf = String(ufCliente ?? "").trim().toUpperCase();
  if (uf.length !== 2) return null;
  return meta.uf === uf;
}

/** Link de emissão confirmado, ou `null` quando ainda não mapeado para a UF. */
export function getLinkEmissaoCertidao(tipo: string | null | undefined): string | null {
  return getAbrangenciaCertidao(tipo)?.link ?? null;
}
