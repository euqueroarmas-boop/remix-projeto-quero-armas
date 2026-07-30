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
 * NÃO EXISTEM certidões de "segundo grau" neste sistema. Os códigos
 * `certidao_estadual_segundo_grau_*` foram criados por premissa errada e o
 * usuário já os eliminou em 22/07/2026 — ver as migrations
 * `20260722211500_qa_corrige_certidoes_estaduais_sem_segundo_grau.sql` e
 * `20260722212200_qa_remove_legado_segundo_grau_certidoes_estaduais.sql`,
 * que renomearam os dois para Polícia Civil e Justiça Militar e arquivaram
 * os registros legados. Eles sobrevivem apenas como apelido de compatibilidade
 * para checklists antigos; nunca devem voltar a ser exigência visível.
 *
 * Esta camada é PURAMENTE DESCRITIVA: só declara o que cada certidão cobre e
 * onde emitir. Não decide checklist, não grava nada.
 *
 * Os slugs abaixo são os CANÔNICOS da CHECK constraint de
 * `qa_documentos_cliente` (migration `20260730010000_fecha_catalogo_e_apelidos`),
 * família `antecedentes_*`. Os códigos `certidao_*` são apelidos de biblioteca.
 *
 * IMPORTANTE — por que os links estão `null`:
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
  /** Slug canônico da CHECK constraint (família `antecedentes_*`). */
  tipo: string;
  titulo: string;
  abrangencia: AbrangenciaCertidao;
  /** UF a que a variante mapeada pertence. `null` quando é nacional. */
  uf: string | null;
  /** Link oficial de emissão, quando confirmado. `null` = emitir manualmente. */
  link: string | null;
  nota?: string;
}

/* ── Contra a União — mesmo link para todo o Brasil ────────────────────── */

export const CERTIDOES_UNIAO: CertidaoAbrangencia[] = [
  {
    tipo: "antecedentes_eleitoral",
    titulo: "Crimes eleitorais — TSE",
    abrangencia: "uniao",
    uf: null,
    link: "https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-crimes-eleitorais",
    nota: "Traz o número do título de eleitor impresso — serve para preencher o cadastro.",
  },
  {
    tipo: "antecedentes_militar",
    titulo: "Crimes militares contra a União — STM",
    abrangencia: "uniao",
    uf: null,
    link: "https://www.stm.jus.br/servicos-stm/certidao-negativa/emitir-certidao",
    nota:
      "Justiça Militar da UNIÃO. Atenção: hoje o apelido " +
      "`certidao_estadual_justica_militar` (TJM estadual) também aponta para " +
      "este mesmo slug canônico — são certidões diferentes disputando um slot só.",
  },
];

/* ── Justiça Federal — o TRF competente segue a região do endereço ─────── */

export const CERTIDOES_FEDERAIS_TRF: CertidaoAbrangencia[] = [
  {
    tipo: "antecedentes_federal",
    titulo: "Justiça Federal — certidão criminal",
    abrangencia: "federal_trf",
    uf: null,
    link: null,
    nota: "Item genérico. As variantes regional e de seção judiciária são as que o cliente emite.",
  },
  {
    tipo: "antecedentes_federal_trf3_regional",
    titulo: "TRF — Regional",
    abrangencia: "federal_trf",
    uf: "SP",
    link: null,
    nota: "TRF3 cobre SP e MS. Cliente de outra UF emite no TRF da região dele (TRF1, TRF2, TRF4, TRF5, TRF6).",
  },
  {
    tipo: "antecedentes_federal_sjsp_jef",
    titulo: "Justiça Federal — Seção Judiciária / JEF",
    abrangencia: "federal_trf",
    uf: "SP",
    link: null,
    nota:
      "NÃO se aplica a São Paulo: a PF de SP exige apenas a certidão regional " +
      "do TRF3 (regra do usuário, 30/07/2026). Nas demais UFs a exigência da " +
      "Seção Judiciária local continua valendo.",
  },
];

/* ── Estaduais — as 4 do pacote "Justiça Estadual" ─────────────────────── */

export const CERTIDOES_ESTADUAIS: CertidaoAbrangencia[] = [
  {
    tipo: "antecedentes_estadual_distribuicao",
    titulo: "Distribuição de ações criminais — TJ",
    abrangencia: "estadual",
    uf: null,
    link: null,
    nota: "Emitida no Tribunal de Justiça do estado de residência.",
  },
  {
    tipo: "antecedentes_estadual_execucoes",
    titulo: "Execuções criminais — TJ",
    abrangencia: "estadual",
    uf: null,
    link: null,
    nota: "Não substitui a de distribuição — são conferências diferentes.",
  },
  {
    tipo: "antecedentes_criminais",
    titulo: "Antecedentes criminais — Polícia Civil",
    abrangencia: "estadual",
    uf: null,
    link: null,
    nota: "Emitida pela Secretaria de Segurança Pública do estado de residência.",
  },
  {
    tipo: "antecedentes_militar",
    titulo: "Justiça Militar estadual — TJM",
    abrangencia: "estadual",
    uf: null,
    link: null,
    nota:
      "Só existe em SP, MG e RS — ver UFS_COM_TJM_ESTADUAL. Cliente de UF sem " +
      "TJM não recebe esta exigência e nada entra no lugar.",
  },
];

/**
 * Item pai do pacote estadual. É agrupador conceitual: o cliente não baixa
 * nada dele, entrega as filhas. Fica fora dos mapas de emissão de propósito.
 */
export const CERTIDAO_ESTADUAL_AGRUPADOR = "antecedentes_estadual";

export const CERTIDOES_ABRANGENCIA: CertidaoAbrangencia[] = [
  ...CERTIDOES_UNIAO,
  ...CERTIDOES_FEDERAIS_TRF,
  ...CERTIDOES_ESTADUAIS,
];

/**
 * Slugs que nunca devem voltar como exigência. Existem só como apelido de
 * compatibilidade para checklists montados antes de 22/07/2026.
 */
export const CERTIDOES_DESCONTINUADAS = new Set([
  "certidao_estadual_segundo_grau_acoes_criminais",
  "certidao_estadual_segundo_grau_execucoes_criminais",
]);

export function isCertidaoDescontinuada(tipo: string | null | undefined): boolean {
  return CERTIDOES_DESCONTINUADAS.has(String(tipo ?? "").trim().toLowerCase());
}

const POR_TIPO = new Map(CERTIDOES_ABRANGENCIA.map((c) => [c.tipo, c]));

export function getAbrangenciaCertidao(tipo: string | null | undefined): CertidaoAbrangencia | null {
  if (!tipo) return null;
  return POR_TIPO.get(String(tipo).trim().toLowerCase()) ?? null;
}

/** Certidão que vale em qualquer UF — só as duas contra a União. */
export function isCertidaoNacional(tipo: string | null | undefined): boolean {
  return getAbrangenciaCertidao(tipo)?.abrangencia === "uniao";
}

/* ── Justiça Federal — mapa de regiões ─────────────────────────────────── */

/**
 * TRF competente por UF.
 *
 * A Justiça Federal não é organizada por estado nem é única para o país: são
 * 6 regiões, cada uma cobrindo um conjunto fixo de UFs. Consequência prática
 * para a exigência: a certidão do TRF3 serve para quem mora em SP **e em MS**
 * (mesma região), mas NÃO serve para quem mora na Bahia — esse é TRF1, e os
 * processos federais dele não aparecem na certidão do TRF3.
 *
 * O TRF6 foi criado em 2022, desmembrando Minas Gerais do TRF1.
 */
export const TRF_POR_UF: Record<string, number> = {
  // TRF1
  AC: 1, AM: 1, AP: 1, BA: 1, DF: 1, GO: 1, MA: 1,
  MT: 1, PA: 1, PI: 1, RO: 1, RR: 1, TO: 1,
  // TRF2
  RJ: 2, ES: 2,
  // TRF3
  SP: 3, MS: 3,
  // TRF4
  RS: 4, SC: 4, PR: 4,
  // TRF5
  AL: 5, CE: 5, PB: 5, PE: 5, RN: 5, SE: 5,
  // TRF6
  MG: 6,
};

/** Número do TRF competente para a UF de residência, ou `null` se UF inválida. */
export function getTrfDaUF(ufCliente: string | null | undefined): number | null {
  const uf = String(ufCliente ?? "").trim().toUpperCase();
  if (uf.length !== 2) return null;
  return TRF_POR_UF[uf] ?? null;
}

/**
 * Uma certidão emitida no TRF de `ufOrigem` cobre quem mora em `ufCliente`?
 *
 * Verdadeiro só quando as duas UFs caem na MESMA região. É o que torna a
 * certidão do TRF3 válida para o cliente de MS e inválida para o da Bahia.
 * Devolve `null` quando alguma UF é desconhecida — nunca `true` no escuro.
 */
export function trfCobreUF(
  ufOrigem: string | null | undefined,
  ufCliente: string | null | undefined,
): boolean | null {
  const a = getTrfDaUF(ufOrigem);
  const b = getTrfDaUF(ufCliente);
  if (a === null || b === null) return null;
  return a === b;
}

/* ── Justiça Militar estadual — só três estados a possuem ──────────────── */

/**
 * UFs que mantêm Tribunal de Justiça Militar estadual próprio.
 *
 * Regra do usuário: para cliente de UF fora desta lista a certidão NÃO é
 * exigida — não existe substituta e nada entra no lugar. Continuam valendo,
 * para ele, as duas contra a União (TSE e STM).
 */
export const UFS_COM_TJM_ESTADUAL = new Set(["SP", "MG", "RS"]);

/** A certidão de Justiça Militar estadual deve ser exigida deste cliente? */
export function exigeCertidaoTjmEstadual(ufCliente: string | null | undefined): boolean {
  const uf = String(ufCliente ?? "").trim().toUpperCase();
  if (uf.length !== 2) return false;
  return UFS_COM_TJM_ESTADUAL.has(uf);
}

/**
 * A certidão da Seção Judiciária deve ser exigida deste cliente?
 *
 * Em São Paulo, não: a PF de SP confere só a regional do TRF3. Fora de SP a
 * exigência permanece. Regra restrita a SP por enquanto — se outras delegacias
 * adotarem o mesmo entendimento, esta lista cresce.
 */
const UFS_SEM_EXIGENCIA_SECAO_JUDICIARIA = new Set(["SP"]);

export function exigeCertidaoSecaoJudiciaria(ufCliente: string | null | undefined): boolean {
  const uf = String(ufCliente ?? "").trim().toUpperCase();
  if (uf.length !== 2) return false;
  return !UFS_SEM_EXIGENCIA_SECAO_JUDICIARIA.has(uf);
}
