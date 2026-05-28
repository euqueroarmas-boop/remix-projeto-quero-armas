// ============================================================================
// checklistWizardGate.ts
// ----------------------------------------------------------------------------
// Permite que uma exigência documental (qa_servicos_documentos) declare, via
// `regra_validacao.wizard_pre_documento`, um Wizard de Perguntas que precisa
// estar respondido ANTES do cliente poder baixar, anexar, reaproveitar ou
// concluir o documento.
//
// Estrutura esperada em regra_validacao:
//   {
//     "wizard_pre_documento": {
//       "enabled": true,
//       "wizard_key": "clube_filiacao",
//       "required": true,
//       "bloquear_documento_ate_responder": true
//     }
//   }
//
// Hoje há um único wizard composto disponível ("clube_filiacao"). Novos
// wizards podem ser registrados em WIZARD_REGISTRY sem mexer nas telas.
// ============================================================================

export type WizardKey = "clube_filiacao";

export interface WizardOption {
  key: WizardKey;
  label: string;
  /** Texto curto exibido ao cliente quando o wizard estiver pendente. */
  descricaoCliente: string;
}

export const WIZARD_REGISTRY: WizardOption[] = [
  {
    key: "clube_filiacao",
    label: "CLUBE DE TIRO E FILIAÇÃO",
    descricaoCliente:
      "Antes deste documento, confirme o clube de tiro e a filiação que serão usados na emissão.",
  },
];

export interface WizardPreDocumentoConfig {
  enabled: boolean;
  wizard_key: WizardKey;
  required: boolean;
  bloquear_documento_ate_responder: boolean;
}

/** Lê a config do wizard a partir de regra_validacao. Tolerante a JSON solto. */
export function getWizardPreDocumento(
  regraValidacao: unknown,
): WizardPreDocumentoConfig | null {
  if (!regraValidacao || typeof regraValidacao !== "object") return null;
  const raw = (regraValidacao as any).wizard_pre_documento;
  if (!raw || typeof raw !== "object") return null;
  const wizardKey = String(raw.wizard_key || "").trim();
  if (!wizardKey) return null;
  if (!WIZARD_REGISTRY.some((w) => w.key === wizardKey)) return null;
  return {
    enabled: raw.enabled !== false,
    wizard_key: wizardKey as WizardKey,
    required: raw.required !== false,
    bloquear_documento_ate_responder:
      raw.bloquear_documento_ate_responder !== false,
  };
}

/** Helpers de completude por wizard. */
function strOk(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Verifica se o wizard foi concluído NESTE processo (fonte de verdade nova).
 * O ClubeFiliacaoStep pode variar por processo — não basta olhar para o cliente.
 */
export function isWizardCompletoNoProcesso(
  wizardKey: WizardKey,
  processo: { respostas_questionario_json?: unknown } | null | undefined,
): boolean {
  if (!processo) return false;
  const raw = (processo as any).respostas_questionario_json;
  if (!raw || typeof raw !== "object") return false;
  const bloco = (raw as any).wizard_pre_documento;
  if (!bloco || typeof bloco !== "object") return false;
  const entry = bloco[wizardKey];
  if (!entry || typeof entry !== "object") return false;
  if (entry.completed === true) return true;
  // Fallback: campos mínimos preenchidos no próprio bloco.
  if (wizardKey === "clube_filiacao") {
    return strOk(entry.nome_clube) && (strOk(entry.numero_filiacao) || strOk(entry.validade_filiacao));
  }
  return false;
}

/** Verifica se os dados mínimos do wizard já estão preenchidos no cliente (legado). */
export function isWizardCompleto(
  wizardKey: WizardKey,
  cliente: Record<string, any> | null | undefined,
): boolean {
  if (!cliente) return false;
  if (wizardKey === "clube_filiacao") {
    // Mínimo aceito: clube identificado + filiação informada.
    const temClube = strOk(cliente.nome_clube);
    const temFiliacao =
      strOk(cliente.numero_filiacao) || strOk(cliente.validade_filiacao);
    return temClube && temFiliacao;
  }
  return true;
}

/**
 * Devolve a config quando o wizard está pendente para este documento; null
 * quando não há wizard vinculado, está desabilitado ou já foi resolvido.
 *
 * Para exigências documentais dentro de processo, a fonte é o PRÓPRIO processo.
 * O fallback em qa_clientes só vale para chamadas legadas sem processo.
 */
export function wizardPendentePara(
  doc: { regra_validacao?: unknown } | null | undefined,
  cliente: Record<string, any> | null | undefined,
  processo?: { respostas_questionario_json?: unknown } | null | undefined,
): WizardPreDocumentoConfig | null {
  if (!doc) return null;
  const cfg = getWizardPreDocumento(doc.regra_validacao);
  if (!cfg || !cfg.enabled || !cfg.bloquear_documento_ate_responder) return null;
  if (processo) {
    return isWizardCompletoNoProcesso(cfg.wizard_key, processo) ? null : cfg;
  }
  if (isWizardCompleto(cfg.wizard_key, cliente)) return null;
  return cfg;
}

export function getWizardLabel(key: string): string {
  return WIZARD_REGISTRY.find((w) => w.key === key)?.label || key.toUpperCase();
}

export function getWizardDescricaoCliente(key: string): string {
  return (
    WIZARD_REGISTRY.find((w) => w.key === key)?.descricaoCliente ||
    "Antes deste documento, complete o wizard correspondente."
  );
}