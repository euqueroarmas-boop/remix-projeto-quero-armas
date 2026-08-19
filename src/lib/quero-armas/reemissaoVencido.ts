/* =============================================================================
 * DOCUMENTO VENCIDO — a reemissão é pedida na hora do protocolo, não antes
 * -----------------------------------------------------------------------------
 * ESPELHO de `supabase/functions/_shared/reemissaoVencido.ts`.
 * Deno e Vite não compartilham módulo; as duas cópias mudam juntas.
 *
 * DECISÃO DO USUÁRIO (19/08/2026), a partir do caso do Gilson e estendida a
 * todos os clientes: "não peça reemissão agora; o momento é quando o
 * requerimento estiver pronto".
 *
 * O PROBLEMA QUE ISSO RESOLVE. Cartão CNPJ, QSA e certidões de antecedentes
 * valem 30 dias. Um processo leva mais que isso. Se o sistema cobra a reemissão
 * no dia seguinte ao vencimento, o cliente vai atrás do documento, paga,
 * entrega — e ele vence de novo antes de o processo ser protocolado. O cliente
 * paga duas, três vezes pela mesma certidão e continua sem protocolar. É
 * esteira, não progresso.
 *
 * A REGRA. Documento que venceu não vira cobrança imediata: fica marcado como
 * VENCIDO (a equipe vê, o cliente vê, ninguém é surpreendido) e só entra na fila
 * do cliente quando o processo chega a `pronto_para_protocolar` — quando a
 * equipe fechou a documentação e o protocolo é questão de dias.
 *
 * É EXATAMENTE O PADRÃO DA GRU, e por isso mora no MESMO portão
 * (`exigenciaCobravelAgora`, em `etapaFinalProtocolo.ts`): a taxa da PF não é
 * pedida enquanto o cliente junta certidão, porque "dinheiro do cliente não pode
 * depender de ele ter lido o aviso com atenção". Reemissão de certidão é o mesmo
 * dinheiro e o mesmo raciocínio. Um portão só, para não haver duas respostas
 * diferentes para "posso cobrar isto agora?".
 *
 * CONSEQUÊNCIA OBRIGATÓRIA, igual à da etapa final: exigência vencida NÃO conta
 * para "o processo está pronto" (ver `itemContaParaConclusao`). Se contasse, o
 * processo nunca chegaria a `pronto_para_protocolar` — e a reemissão nunca seria
 * pedida. Uma esperando a outra, para sempre.
 *
 * O QUE ESTA REGRA NÃO COBRE, de propósito: documento REPROVADO. Ali não há o
 * que esperar — o arquivo está errado agora, e o cliente precisa saber agora.
 * A varredura diária continua devolvendo esses para `pendente` na hora.
 * ============================================================================= */

/**
 * Status gravado pela varredura diária quando o documento vence
 * (`qa_reabrir_exigencias_documento_invalido`). Já existia no vocabulário da
 * tabela; até 19/08/2026 ninguém escrevia nele.
 */
export const STATUS_EXIGENCIA_VENCIDA = "expirado";

/**
 * Aliases de "vencido" aceitos na leitura.
 * ESPELHO do bloco "vencido" de `statusDocumento.ts` — repetido aqui de
 * propósito para este módulo não depender do dicionário inteiro e poder ser
 * espelhado no Deno sem arrastar meio front junto.
 */
const ALIAS_VENCIDO: ReadonlySet<string> = new Set([
  "vencido",
  "vencida",
  "expirado",
  "expirada",
]);

export interface ItemComStatus {
  status?: string | null;
}

/** A exigência está aberta por VENCIMENTO (e não por reprovação ou falta)? */
export function ehReemissaoDeVencido(d: ItemComStatus | null | undefined): boolean {
  return ALIAS_VENCIDO.has(String(d?.status ?? "").trim().toLowerCase());
}

/**
 * Frase para a tela, no lugar da cobrança.
 *
 * O cliente PRECISA ver que o documento venceu — esconder viraria surpresa no
 * dia do protocolo. O que ele não deve ver é um botão mandando resolver já.
 */
export function avisoReemissaoAdiada(nomeDocumento?: string | null): string {
  const nome = String(nomeDocumento ?? "").trim() || "Este documento";
  return (
    `${nome} venceu. Não emita outro agora: como ele vale poucos dias, emitir ` +
    `antes da hora faria você pagar de novo. Vamos avisar assim que o seu ` +
    `requerimento estiver pronto — aí você emite uma vez só e nós protocolamos.`
  );
}
