/**
 * Helper global de cores de status — Quero Armas.
 *
 * Fonte única para Arsenal, área da Equipe Quero Armas e portal do cliente.
 * Reutiliza COR_BADGE_CLASS / COR_DOT_CLASS já definidos em statusUnificado.ts
 * e adiciona variantes (texto, borda, soft bg) para os diferentes contextos.
 *
 * Aceita:
 *   - CorStatus já resolvida (verde/azul/amarelo/laranja/vermelho/cinza)
 *   - StatusUnificado completo (extrai .cor)
 *   - String legada (passa por canonStatus → mapeia para cor)
 */

import {
  COR_BADGE_CLASS,
  COR_DOT_CLASS,
  normalizeQaStatus,
  type CorStatus,
  type StatusUnificado,
} from "./statusUnificado";

export type StatusColorInput = CorStatus | StatusUnificado | string | null | undefined;

const STATUS_TO_TONE: Record<string, CorStatus> = {
  // Verde — OK / sucesso / decisão favorável
  ok: "verde",
  deferido: "verde",
  finalizado: "verde",
  concluido: "verde",
  documentos_aprovados: "verde",
  aprovado: "verde",
  ativo: "verde",
  pago: "verde",
  confirmado: "verde",
  recebido: "verde",
  reaproveitado_do_hub_cliente: "verde",
  // Azul — em andamento / análise / protocolo
  em_analise: "azul",
  documentos_em_analise: "azul",
  em_analise_orgao: "azul",
  enviado_ao_orgao: "azul",
  protocolado: "azul",
  em_validacao: "azul",
  em_leitura_ia: "azul",
  em_analise_equipe: "azul",
  // Amarelo — atenção / vencendo médio
  vencendo_180: "amarelo",
  vencendo_90: "amarelo",
  notificado: "amarelo",
  aprovado_com_observacao: "amarelo",
  aguardando_leitura_ia: "amarelo",
  leitura_ia_concluida: "amarelo",
  // Laranja — pendência / vencendo crítico
  vencendo_60: "laranja",
  vencendo_30: "laranja",
  vencendo_15: "laranja",
  documentos_incompletos: "laranja",
  aguardando_documentacao: "laranja",
  exigencia: "laranja",
  recurso_administrativo: "laranja",
  aguardando_complementacao: "laranja",
  divergente: "laranja",
  // Vermelho — vencido / erro / decisão desfavorável
  vencido: "vermelho",
  iminente: "vermelho",
  expirado: "vermelho",
  indeferido: "vermelho",
  invalido: "vermelho",
  recusado: "vermelho",
  reprovado: "vermelho",
  falhou: "vermelho",
  failed: "vermelho",
  cancelado: "vermelho",
  reembolsado: "vermelho",
  pagamento_falhou: "vermelho",
  // Cinza — sem dado / aguardando leitura / não aplicável
  sem_data: "cinza",
  sem_dado: "cinza",
  leitura_pendente: "cinza",
  nao_enviado: "cinza",
  nao_cadastrado: "cinza",
  aguardando_pagamento: "cinza",
  pendente: "cinza",
  enviado: "cinza",
  substituido: "cinza",
};

const COR_VALIDA: Set<CorStatus> = new Set([
  "verde",
  "azul",
  "amarelo",
  "laranja",
  "vermelho",
  "cinza",
]);

function isStatusUnificado(v: unknown): v is StatusUnificado {
  return !!v && typeof v === "object" && "cor" in (v as any) && "codigo" in (v as any);
}

/** Resolve a cor canônica (tom) a partir de qualquer entrada. */
export function getStatusTone(input: StatusColorInput): CorStatus {
  if (!input) return "cinza";
  if (isStatusUnificado(input)) return input.cor;
  if (typeof input === "string") {
    if (COR_VALIDA.has(input as CorStatus)) return input as CorStatus;
    const n = normalizeQaStatus(input);
    return STATUS_TO_TONE[n] ?? "cinza";
  }
  return "cinza";
}

export const TONE_TEXT_CLASS: Record<CorStatus, string> = {
  verde: "text-emerald-700",
  azul: "text-sky-700",
  amarelo: "text-amber-700",
  laranja: "text-orange-700",
  vermelho: "text-red-700",
  cinza: "text-slate-600",
};

export const TONE_BORDER_CLASS: Record<CorStatus, string> = {
  verde: "border-emerald-300",
  azul: "border-sky-300",
  amarelo: "border-amber-300",
  laranja: "border-orange-300",
  vermelho: "border-red-300",
  cinza: "border-slate-300",
};

export const TONE_SOFT_BG_CLASS: Record<CorStatus, string> = {
  verde: "bg-emerald-50",
  azul: "bg-sky-50",
  amarelo: "bg-amber-50",
  laranja: "bg-orange-50",
  vermelho: "bg-red-50",
  cinza: "bg-slate-50",
};

export interface StatusColorBundle {
  tone: CorStatus;
  badge: string;
  dot: string;
  text: string;
  border: string;
  softBg: string;
}

/** Retorna o pacote completo de classes para o status. */
export function getStatusColor(input: StatusColorInput): StatusColorBundle {
  const tone = getStatusTone(input);
  return {
    tone,
    badge: COR_BADGE_CLASS[tone],
    dot: COR_DOT_CLASS[tone],
    text: TONE_TEXT_CLASS[tone],
    border: TONE_BORDER_CLASS[tone],
    softBg: TONE_SOFT_BG_CLASS[tone],
  };
}

/** Compara dois tons e retorna o mais crítico (vermelho > laranja > amarelo > azul > cinza > verde). */
export const TONE_PRIORIDADE: Record<CorStatus, number> = {
  vermelho: 1,
  laranja: 2,
  amarelo: 3,
  azul: 4,
  cinza: 5,
  verde: 6,
};

export function piorTone(tones: CorStatus[]): CorStatus {
  if (!tones.length) return "cinza";
  return tones.slice().sort((a, b) => TONE_PRIORIDADE[a] - TONE_PRIORIDADE[b])[0];
}