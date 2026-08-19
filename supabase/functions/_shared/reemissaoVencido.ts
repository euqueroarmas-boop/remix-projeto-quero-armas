// ============================================================================
// reemissaoVencido (shared)
// ----------------------------------------------------------------------------
// ESPELHO de src/lib/quero-armas/reemissaoVencido.ts. Deno e Vite não
// compartilham módulo; as duas cópias mudam juntas.
//
// DECISÃO DO USUÁRIO (19/08/2026): documento que venceu não é cobrado do
// cliente na hora. Certidão e cartão CNPJ valem 30 dias, o processo leva mais;
// cobrar a reemissão cedo faz o cliente pagar duas ou três vezes pela mesma
// certidão e ainda assim chegar vencido ao protocolo.
//
// A reemissão entra na fila quando o processo vira `pronto_para_protocolar`.
// É o mesmo tratamento que a GRU já recebe (ver ehExigenciaEtapaFinal), e por
// isso mora no mesmo portão do lado do front (exigenciaCobravelAgora).
//
// CONSEQUÊNCIA OBRIGATÓRIA: exigência vencida NÃO conta para "o processo está
// pronto" (itemContaParaConclusao) — senão o processo nunca chega ao status que
// libera a cobrança, e a reemissão nunca é pedida. Uma esperando a outra, para
// sempre.
//
// Documento REPROVADO segue fora desta regra: vira `pendente` na hora, porque
// não há nada a esperar — o arquivo está errado agora.
// ============================================================================

/** Status gravado pela varredura diária quando o documento vence. */
export const STATUS_EXIGENCIA_VENCIDA = "expirado";

/**
 * Aliases de "vencido" aceitos na leitura.
 * ESPELHO do bloco "vencido" de src/lib/quero-armas/statusDocumento.ts.
 */
const ALIAS_VENCIDO = new Set(["vencido", "vencida", "expirado", "expirada"]);

export interface ItemComStatus {
  status?: string | null;
}

/** A exigência está aberta por VENCIMENTO (e não por reprovação ou falta)? */
export function ehReemissaoDeVencido(d: ItemComStatus | null | undefined): boolean {
  return ALIAS_VENCIDO.has(String(d?.status ?? "").trim().toLowerCase());
}
