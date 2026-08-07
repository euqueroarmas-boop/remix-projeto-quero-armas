/* =============================================================================
 * Regime documental — teoria dos conjuntos (Quero Armas)
 *
 * A legislação separa dois grandes grupos de processos:
 *   - DEFESA PESSOAL (posse/porte para defesa)
 *   - CAC (tiro esportivo, caça e colecionamento)
 *
 * Muitos documentos pertencem à INTERSEÇÃO dos dois conjuntos (identidade,
 * endereço, certidões, laudos, renda) e por isso são reaproveitáveis entre
 * regimes. Outros são EXCLUSIVOS de um regime e nunca podem vazar para o
 * outro (efetiva necessidade ⇢ só defesa pessoal; filiação/habitualidade/CR
 * ⇢ só CAC).
 *
 * Espelha a coluna `regime` de `public.qa_tipos_documento_catalogo`.
 * ============================================================================= */

export type RegimeDocumento = "comum" | "defesa_pessoal" | "cac";

/** Tipos exclusivos de DEFESA PESSOAL. */
export const TIPOS_SO_DEFESA_PESSOAL = new Set<string>([
  "comprovante_efetiva_necessidade",
  "documento_complementar_caso",
  "requerimento_de_posse_de_arma_de_fogo",
]);

/** Tipos exclusivos de CAC (tiro esportivo, caça e colecionamento). */
export const TIPOS_SO_CAC = new Set<string>([
  "cr",
  "comprovante_clube_tiro",
  "comprovante_filiacao_entidade_tiro",
  "comprovante_competicao",
  "comprovante_habitualidade",
  "declaracao_compromisso_habitualidade",
  "declaracao_endereco_acervo",
  "declaracao_guarda_acervo_1endereco",
  "declaracao_guarda_acervo_2enderecos",
  "declaracao_nao_possuir_segundo_endereco",
  "dsa_declaracao_seguranca_acervo",
  "habilitacao_cacador_ibama",
]);

function norm(tipo?: string | null): string {
  return String(tipo ?? "").trim().toLowerCase();
}

/** Regime de um tipo de documento. Default seguro: "comum". */
export function getRegimeDocumento(tipo?: string | null): RegimeDocumento {
  const t = norm(tipo);
  if (!t) return "comum";
  if (TIPOS_SO_CAC.has(t)) return "cac";
  if (TIPOS_SO_DEFESA_PESSOAL.has(t)) return "defesa_pessoal";
  return "comum";
}

/** Documento da interseção ⇒ reaproveitável entre defesa pessoal e CAC. */
export function isDocumentoComum(tipo?: string | null): boolean {
  return getRegimeDocumento(tipo) === "comum";
}

const PISTAS_CAC = [
  "cac",
  "atirador",
  "esportiv",
  "cacador",
  "caçador",
  "caca-",
  "colecion",
  "clube-de-tiro",
  "habitualidade",
  "gte",
];

/** Regime do serviço/processo a partir do slug ou nome. */
export function getRegimeServico(slugOuNome?: string | null): RegimeDocumento {
  const s = String(slugOuNome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!s) return "comum";
  if (PISTAS_CAC.some((p) => s.includes(p.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    return "cac";
  }
  return "defesa_pessoal";
}

/**
 * O tipo pode ser exigido/exibido em um processo deste regime?
 * Documentos comuns valem sempre; exclusivos só no seu regime.
 */
export function tipoCompativelComRegime(
  tipo?: string | null,
  regimeServico?: RegimeDocumento | null,
): boolean {
  const regimeDoc = getRegimeDocumento(tipo);
  if (regimeDoc === "comum") return true;
  if (!regimeServico || regimeServico === "comum") return true;
  return regimeDoc === regimeServico;
}

/**
 * O documento de origem pode ser reaproveitado por um destino de outro regime?
 * Só a interseção atravessa a fronteira.
 */
export function podeReaproveitarEntreRegimes(
  tipo: string | null | undefined,
  regimeOrigem?: RegimeDocumento | null,
  regimeDestino?: RegimeDocumento | null,
): boolean {
  if (isDocumentoComum(tipo)) return true;
  if (!regimeOrigem || !regimeDestino) return true;
  return regimeOrigem === regimeDestino;
}
