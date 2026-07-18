/**
 * Agrupamento canônico de documentos por família (tipo/subtipo).
 *
 * Uso principal: consolidar múltiplas versões de um mesmo documento
 * (ex.: comprovantes de residência 2022/2023/2024/2025/2026) em um
 * "documento principal" para efeito de banners, resumo e alertas de
 * vencimento — evitando que versões antigas vencidas continuem
 * disparando alerta quando já existe uma versão vigente.
 *
 * NÃO substitui a lógica de checklist/processo, que segue avaliando
 * exigências específicas. Serve como camada de consolidação para UI e
 * para reaproveitamento (o documento principal do grupo é o candidato
 * natural quando uma exigência aceita "documento atual" do mesmo tipo).
 *
 * Base normativa: Lei 10.826/2003, Decreto 11.615/2023, Decreto
 * 12.345/2024, IN DG/PF 201 e IN DG/PF 311. Certidões de tipos distintos
 * (ex.: TJSP Distribuição vs. TJSP Execuções Criminais) NÃO se
 * agrupam entre si — a chave de família preserva o subtipo.
 */

import { getValidadeInfo, type ValidadeInfo } from "./validadeDocumento";

export type FamiliaDocumento = string;

export interface DocumentoAgrupavel {
  id?: string | number | null;
  tipo_documento?: string | null;
  status?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  data_validade_efetiva?: string | null;
  ano_competencia?: number | string | null;
  regra_validacao?: any;
  numero_arma?: string | null;
  numero_serie?: string | null;
  arma_id?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: any;
}

export interface GrupoDocumental<T extends DocumentoAgrupavel = DocumentoAgrupavel> {
  familia: FamiliaDocumento;
  chave: string; // familia + qualificador (ex.: arma_id) — única no cliente
  principal: T;
  historico: T[]; // versões anteriores, ordenadas mais recente → mais antiga
  todos: T[];
  validadePrincipal: ValidadeInfo;
  /**
   * Estado consolidado do grupo:
   *  - "vigente": principal vigente (independentemente de haver antigos vencidos)
   *  - "vence_em_breve": principal a vencer nos próximos 7 dias
   *  - "vencido": nenhum documento vigente no grupo
   *  - "historico": grupo só tem versões históricas sem vencimento (ex.: comprovantes de anos passados)
   *  - "indefinido": sem data de validade calculável
   */
  statusConsolidado: "vigente" | "vence_em_breve" | "vencido" | "historico" | "indefinido";
  /** True quando existe pelo menos 1 vencido/histórico "silenciado" pelo principal vigente. */
  alertaSuprimido: boolean;
  versoesAnteriores: number;
}

/**
 * Reduz variações de tipo_documento à FAMÍLIA canônica.
 *
 * Regras:
 *  - `comprovante_residencia_YYYY` / `comprovante_endereco_ano_YYYY`
 *    → `comprovante_residencia`
 *  - `antecedentes_militar_*` → `antecedentes_militar` (STM+TJM-SP consolidados)
 *  - Certidões PERMANECEM distintas por subtipo:
 *      `certidao_criminal_tjsp_distribuicao` ≠ `certidao_criminal_tjsp_execucoes`
 *      `certidao_federal_trf3_regional` ≠ `certidao_federal_trf3_nacional`
 */
export function familiaDocumento(tipo?: string | null): FamiliaDocumento {
  const raw = String(tipo || "").toLowerCase().trim();
  if (!raw) return "desconhecido";

  // Comprovantes de residência anuais colapsam à família canônica.
  const mRes = /^comprovante_(?:endereco|residencia)(?:_ano)?_\d{4}$/.exec(raw);
  if (mRes) return "comprovante_residencia";
  if (raw === "comprovante_endereco" || raw === "comprovante_de_endereco") return "comprovante_residencia";
  if (raw === "comprovante_de_residencia") return "comprovante_residencia";

  return raw;
}

/** Qualificador adicional (ex.: número de série da arma) que impede agrupar CRAFs de armas diferentes. */
function qualificadorGrupo(doc: DocumentoAgrupavel, familia: FamiliaDocumento): string {
  if (familia === "craf" || familia === "gte" || familia === "sinarm" || familia === "guia_trafego") {
    const arma = String(
      doc.numero_serie || doc.numero_arma || doc.arma_id || doc.regra_validacao?.numero_serie || "",
    ).trim().toLowerCase();
    return arma ? `::${arma}` : "";
  }
  return "";
}

function tsFromDoc(doc: DocumentoAgrupavel): number {
  const iso = doc.data_emissao || doc.updated_at || doc.created_at || null;
  if (!iso) return 0;
  const t = new Date(String(iso).slice(0, 10)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isAprovado(status?: string | null): boolean {
  const s = String(status || "").toLowerCase();
  return ["aprovado", "validado", "ok", "vigente"].includes(s);
}

/**
 * Escolhe o documento principal de um grupo, aplicando prioridade:
 *   1. aprovado + vigente com validade mais distante
 *   2. qualquer vigente com validade mais distante
 *   3. vence_em_breve (menor prazo positivo = alerta útil)
 *   4. vencido mais recente (para representar o alerta)
 *   5. histórico mais recente
 *   6. fallback: mais recente por data_emissao/created_at
 */
export function escolherPrincipal<T extends DocumentoAgrupavel>(docs: T[], hoje: Date = new Date()): T {
  if (docs.length === 1) return docs[0];

  const enriched = docs.map((d) => ({ doc: d, info: getValidadeInfo(d, hoje), ts: tsFromDoc(d) }));

  const aprovadosVigentes = enriched.filter(
    (x) => x.info.status === "vigente" && isAprovado(x.doc.status),
  );
  if (aprovadosVigentes.length) {
    aprovadosVigentes.sort((a, b) => (b.info.dias ?? -Infinity) - (a.info.dias ?? -Infinity));
    return aprovadosVigentes[0].doc;
  }

  const vigentes = enriched.filter((x) => x.info.status === "vigente");
  if (vigentes.length) {
    vigentes.sort((a, b) => (b.info.dias ?? -Infinity) - (a.info.dias ?? -Infinity));
    return vigentes[0].doc;
  }

  const venceEmBreve = enriched.filter((x) => x.info.status === "vence_em_breve");
  if (venceEmBreve.length) {
    venceEmBreve.sort((a, b) => (a.info.dias ?? Infinity) - (b.info.dias ?? Infinity));
    return venceEmBreve[0].doc;
  }

  const vencidos = enriched.filter((x) => x.info.status === "vencido");
  if (vencidos.length) {
    // Mais recentemente vencido primeiro (dias menos negativo).
    vencidos.sort((a, b) => (b.info.dias ?? -Infinity) - (a.info.dias ?? -Infinity));
    return vencidos[0].doc;
  }

  const historicos = enriched.filter((x) => x.info.status === "historico");
  if (historicos.length) {
    historicos.sort((a, b) => b.ts - a.ts);
    return historicos[0].doc;
  }

  enriched.sort((a, b) => b.ts - a.ts);
  return enriched[0].doc;
}

function statusConsolidadoDoGrupo(
  docs: DocumentoAgrupavel[],
  principal: DocumentoAgrupavel,
  hoje: Date,
): { status: GrupoDocumental["statusConsolidado"]; validadePrincipal: ValidadeInfo } {
  const infos = docs.map((d) => getValidadeInfo(d, hoje));
  const validadePrincipal = getValidadeInfo(principal, hoje);

  const temVigente = infos.some((i) => i.status === "vigente");
  if (temVigente) {
    // Se o principal é vigente e existe algum vence_em_breve? Ainda "vigente".
    return { status: "vigente", validadePrincipal };
  }
  const temVenceEmBreve = infos.some((i) => i.status === "vence_em_breve");
  if (temVenceEmBreve) return { status: "vence_em_breve", validadePrincipal };

  const temVencido = infos.some((i) => i.status === "vencido");
  if (temVencido) return { status: "vencido", validadePrincipal };

  const soHistorico = infos.length > 0 && infos.every((i) => i.status === "historico");
  if (soHistorico) return { status: "historico", validadePrincipal };

  return { status: "indefinido", validadePrincipal };
}

/**
 * Agrupa documentos por família canônica + qualificador (arma_id).
 * Retorna um array de grupos, com principal, histórico ordenado e
 * status consolidado — pronto para alimentar o Resumo/banners.
 */
export function agruparDocumentosPorFamilia<T extends DocumentoAgrupavel>(
  docs: T[] | null | undefined,
  hoje: Date = new Date(),
): GrupoDocumental<T>[] {
  const seguros = Array.isArray(docs) ? docs.filter(Boolean) : [];
  const buckets = new Map<string, T[]>();
  for (const d of seguros) {
    const familia = familiaDocumento(d.tipo_documento);
    const chave = familia + qualificadorGrupo(d, familia);
    if (!buckets.has(chave)) buckets.set(chave, []);
    buckets.get(chave)!.push(d);
  }

  const grupos: GrupoDocumental<T>[] = [];
  for (const [chave, itens] of buckets.entries()) {
    const familia = chave.split("::")[0];
    const principal = escolherPrincipal(itens, hoje);
    const historico = itens
      .filter((d) => d !== principal)
      .sort((a, b) => tsFromDoc(b) - tsFromDoc(a));
    const { status, validadePrincipal } = statusConsolidadoDoGrupo(itens, principal, hoje);
    const alertaSuprimido =
      status === "vigente" &&
      itens.some((d) => {
        const info = getValidadeInfo(d, hoje);
        return info.status === "vencido";
      });
    grupos.push({
      familia,
      chave,
      principal,
      historico,
      todos: itens,
      validadePrincipal,
      statusConsolidado: status,
      alertaSuprimido,
      versoesAnteriores: historico.length,
    });
  }
  return grupos;
}

/** Dias até vencer do documento PRINCIPAL — ignora versões antigas. */
export function diasAteVencerPrincipal(grupo: GrupoDocumental): number | null {
  return grupo.validadePrincipal.dias;
}

/** Serializa auditoria consolidada de um grupo (para logs_sistema / qa_venda_eventos). */
export function auditoriaGrupo(grupo: GrupoDocumental): Record<string, unknown> {
  return {
    grupo_documental: grupo.familia,
    documento_principal_id: (grupo.principal as any).id ?? null,
    documentos_historicos_ids: grupo.historico.map((d) => (d as any).id).filter((v) => v != null),
    versoes_anteriores: grupo.versoesAnteriores,
    status_consolidado: grupo.statusConsolidado,
    alerta_suprimido_por_documento_valido: grupo.alertaSuprimido,
  };
}