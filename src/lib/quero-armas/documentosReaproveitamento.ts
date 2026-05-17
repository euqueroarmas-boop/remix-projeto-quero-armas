/**
 * documentosReaproveitamento — normaliza os documentos pessoais existentes
 * do cliente autenticado (Arsenal / cadastro público vinculado) e decide se
 * um requisito da Etapa 02 do /cadastro Mira já está cumprido sem novo upload.
 *
 * Regra crítica: cliente autenticado com documento válido NÃO deve ser
 * forçado a reenviar identidade/comprovante/selfie. Reaproveitamento só
 * vale quando o documento:
 *   - não foi substituído (substituido_em IS NULL)
 *   - status não é reprovado/invalido
 *   - status é aprovado OU validado_admin === true OU pendente_aprovacao
 *     (este último é mostrado como "EM ANÁLISE" e NÃO satisfaz por si só)
 *   - se tiver data_validade, ainda não venceu
 *
 * Não toca checkout, pagamento, contrato, processo, checklist, WMTi nem
 * Arsenal (Arsenal continua gratuito).
 */
import type { DocumentoArsenal } from "@/pages/quero-armas/cadastro-refinado/hooks/useCadastroRefinadoState";

export type RequisitoDoc = "doc_identidade" | "doc_endereco" | "doc_selfie";

export type ReaproveitamentoStatus =
  | "valido"
  | "em_analise"
  | "vencido"
  | "reprovado"
  | "substituido"
  | "revisar"
  | "nao_encontrado";

export interface ReaproveitamentoMatch {
  status: ReaproveitamentoStatus;
  documento: DocumentoArsenal | null;
}

/* ─────────── Heurísticas de classificação ─────────── */

const RX_IDENTIDADE = /(cin|\brg\b|cnh|identidade|carteira\s*nacional|documento\s*identidade|doc[_-]?id)/i;
const RX_COMPROVANTE = /(comprovante|residencia|residência|endereco|endereço|conta\s*de\s*(luz|agua|água|internet|gas|gás)|fatura|boleto.*end|enel|cemig|copel|cpfl|sabesp)/i;
const RX_SELFIE = /(selfie|foto\s*do\s*titular|biometria)/i;

function txt(d: DocumentoArsenal): string {
  return [d.tipo_documento, d.arquivo_nome].filter(Boolean).join(" ").toLowerCase();
}

export function pertenceAoRequisito(d: DocumentoArsenal, req: RequisitoDoc): boolean {
  const s = txt(d);
  if (!s) return false;
  if (req === "doc_identidade") return RX_IDENTIDADE.test(s);
  if (req === "doc_endereco") return RX_COMPROVANTE.test(s);
  if (req === "doc_selfie") return RX_SELFIE.test(s);
  return false;
}

export function classificarReaproveitavel(
  d: DocumentoArsenal & { substituido_em?: string | null },
): ReaproveitamentoStatus {
  if (d.substituido_em) return "substituido";
  const st = String(d.status || "").toLowerCase();
  if (st === "reprovado" || st === "invalido") return "reprovado";
  if (d.data_validade) {
    const venc = new Date(d.data_validade);
    if (!isNaN(venc.getTime()) && venc.getTime() < Date.now()) return "vencido";
  }
  if (st === "pendente_aprovacao" || st === "em_analise") return "em_analise";
  if (st === "aprovado" || d.validado_admin === true) return "valido";
  // sem status nem validação clara, mas existe e não venceu: considerar válido p/ uso de identidade pessoal
  if (!st) return "valido";
  return "revisar";
}

/**
 * Procura nos documentos reaproveitáveis o melhor match para o requisito.
 * Retorna "valido" se houver um documento utilizável que dispensa novo upload.
 */
export function buscarReaproveitamento(
  req: RequisitoDoc,
  candidatos: DocumentoArsenal[] | undefined,
): ReaproveitamentoMatch {
  const list = Array.isArray(candidatos) ? candidatos : [];
  let melhor: ReaproveitamentoMatch = { status: "nao_encontrado", documento: null };
  for (const d of list) {
    if (!pertenceAoRequisito(d, req)) continue;
    const cls = classificarReaproveitavel(d as DocumentoArsenal & { substituido_em?: string | null });
    // Prioridade: valido > em_analise > revisar > vencido > reprovado > substituido
    const score = (s: ReaproveitamentoStatus) =>
      s === "valido" ? 6
        : s === "em_analise" ? 5
        : s === "revisar" ? 4
        : s === "vencido" ? 3
        : s === "reprovado" ? 2
        : s === "substituido" ? 1 : 0;
    if (score(cls) > score(melhor.status)) {
      melhor = { status: cls, documento: d };
    }
  }
  return melhor;
}

/**
 * Verdadeiro quando o requisito já está cumprido por documento reaproveitável
 * válido — caso em que NÃO devemos pedir novo upload na Etapa 02.
 */
export function requisitoCumpridoPorReaproveitamento(
  req: RequisitoDoc,
  candidatos: DocumentoArsenal[] | undefined,
): boolean {
  return buscarReaproveitamento(req, candidatos).status === "valido";
}