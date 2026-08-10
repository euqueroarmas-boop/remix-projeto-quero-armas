/**
 * Ordem canônica do DOSSIÊ DE PROTOCOLO (Polícia Federal).
 *
 * É a mesma numeração do ZIP de referência entregue pela equipe:
 *
 *   1.0 Requerimento do Sinarm            → Grupo 1 — Requerimento e Taxas
 *   1.1 GRU paga                          → Grupo 1
 *   1.2 Petição de efetiva necessidade    → Grupo 1
 *   2.  Foto 3x4                          → Grupo 2 — Foto
 *   3.  Documento de identidade           → Grupo 3 — Identificação Civil
 *   4.  Comprovante de residência         → Grupo 4 — Identificação Residencial
 *   5.  Ocupação lícita                   → Grupo 5 — Ocupação Lícita
 *   6..12 Antecedentes/certidões          → Grupo 6 — Idoneidade
 *   13. Laudo psicológico                 → Grupo 7 — Laudos
 *   14. Exame de tiro                     → Grupo 7
 *
 * Usada para (a) ordenar a linha do tempo do Hub e (b) numerar os arquivos
 * no ZIP baixado pela equipe, para o dossiê sair pronto para protocolo.
 */

export interface GrupoProtocolo {
  indice: number;
  nome: string;
}

export const GRUPOS_PROTOCOLO: GrupoProtocolo[] = [
  { indice: 1, nome: "Requerimento e Taxas" },
  { indice: 2, nome: "Foto" },
  { indice: 3, nome: "Identificação Civil" },
  { indice: 4, nome: "Identificação Residencial" },
  { indice: 5, nome: "Ocupação Lícita" },
  { indice: 6, nome: "Idoneidade" },
  { indice: 7, nome: "Laudos" },
  { indice: 8, nome: "Contrato e Procuração" },
  { indice: 9, nome: "Outros" },
];

export interface PosicaoProtocolo {
  /** Grupo (1..9) */
  grupo: number;
  /** Nome do grupo, para cabeçalho na UI e pasta no ZIP. */
  grupoNome: string;
  /** Ordem dentro do grupo. */
  ordem: number;
  /** Rótulo humano do documento (nome no ZIP). */
  rotulo: string;
  /** Prefixo numérico do arquivo no ZIP (ex.: "1.0", "06"). */
  numero: string;
}

interface Regra {
  grupo: number;
  ordem: number;
  numero: string;
  rotulo: string;
}

const MAPA: Record<string, Regra> = {
  sinarm: { grupo: 1, ordem: 0, numero: "1.0", rotulo: "Requerimento do Sinarm" },
  requerimento_sinarm: { grupo: 1, ordem: 0, numero: "1.0", rotulo: "Requerimento do Sinarm" },
  gru: { grupo: 1, ordem: 1, numero: "1.1", rotulo: "GRU paga" },
  gru_paga: { grupo: 1, ordem: 1, numero: "1.1", rotulo: "GRU paga" },
  peticao_efetiva_necessidade: { grupo: 1, ordem: 2, numero: "1.2", rotulo: "Peticao de efetiva necessidade" },
  efetiva_necessidade: { grupo: 1, ordem: 2, numero: "1.2", rotulo: "Peticao de efetiva necessidade" },

  foto_3x4: { grupo: 2, ordem: 0, numero: "02", rotulo: "Foto 3x4" },

  cnh: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  cin: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  rg: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  rg_com_cpf: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  identidade_funcional: { grupo: 3, ordem: 1, numero: "03", rotulo: "Identidade funcional" },

  comprovante_residencia: { grupo: 4, ordem: 0, numero: "04", rotulo: "Comprovante de residencia" },
  declaracao_residencia: { grupo: 4, ordem: 1, numero: "04", rotulo: "Declaracao de residencia" },

  antecedentes_criminais: { grupo: 6, ordem: 0, numero: "06", rotulo: "AAC Policia Civil" },
  antecedentes_federal_trf3_regional: { grupo: 6, ordem: 1, numero: "07", rotulo: "Certidao Justica Federal TRF3" },
  antecedentes_federal_sjsp_jef: { grupo: 6, ordem: 2, numero: "08", rotulo: "Certidao Justica Federal SJSP e JEF" },
  antecedentes_estadual_distribuicao: { grupo: 6, ordem: 3, numero: "09", rotulo: "Certidao Justica Estadual distribuicao" },
  antecedentes_estadual_execucoes: { grupo: 6, ordem: 4, numero: "10", rotulo: "Certidao Justica Estadual execucoes criminais" },
  antecedentes_eleitoral: { grupo: 6, ordem: 5, numero: "11", rotulo: "Certidao Justica Eleitoral" },
  antecedentes_militar: { grupo: 6, ordem: 6, numero: "12", rotulo: "Certidao Justica Militar da Uniao STM" },
  antecedentes_militar_estadual: { grupo: 6, ordem: 7, numero: "12", rotulo: "Certidao Justica Militar Estadual TJM" },

  laudo_psicologico: { grupo: 7, ordem: 0, numero: "13", rotulo: "Laudo psicologico" },
  exame_psicologico: { grupo: 7, ordem: 0, numero: "13", rotulo: "Laudo psicologico" },
  exame_tiro: { grupo: 7, ordem: 1, numero: "14", rotulo: "Exame de tiro" },
  laudo_tiro: { grupo: 7, ordem: 1, numero: "14", rotulo: "Exame de tiro" },

  contrato_assinado: { grupo: 8, ordem: 0, numero: "15", rotulo: "Contrato assinado" },
  procuracao_assinada: { grupo: 8, ordem: 1, numero: "16", rotulo: "Procuracao assinada" },
  comprovante_pagamento: { grupo: 8, ordem: 2, numero: "17", rotulo: "Comprovante de pagamento do contrato" },
};

/** Documentos de ocupação lícita são muitos e todos entram no grupo 5, item 05. */
function regraOcupacao(tipo: string): Regra | null {
  if (!tipo.startsWith("renda_")) return null;
  const nome = tipo.replace(/^renda_/, "").replace(/_/g, " ");
  return { grupo: 5, ordem: 0, numero: "05", rotulo: `Ocupacao licita - ${nome}` };
}

/** Qualquer antecedente não mapeado ainda pertence à Idoneidade. */
function regraIdoneidade(tipo: string): Regra | null {
  if (!/^(antecedentes_|certidao_|declaracao_sem_inquerito|declaracao_idoneidade)/.test(tipo)) return null;
  return { grupo: 6, ordem: 9, numero: "12", rotulo: tipo.replace(/_/g, " ") };
}

export function posicaoProtocolo(tipoDocumento?: string | null, nomeFallback?: string | null): PosicaoProtocolo {
  const tipo = String(tipoDocumento || "").toLowerCase().trim();
  const regra =
    MAPA[tipo] ||
    regraOcupacao(tipo) ||
    regraIdoneidade(tipo) || {
      grupo: 9,
      ordem: 99,
      numero: "99",
      rotulo: String(nomeFallback || tipo || "documento").replace(/_/g, " "),
    };
  const grupo = GRUPOS_PROTOCOLO.find((g) => g.indice === regra.grupo)!;
  return {
    grupo: regra.grupo,
    grupoNome: grupo.nome,
    ordem: regra.ordem,
    rotulo: regra.rotulo,
    numero: regra.numero,
  };
}

/** Comparador para ordenar documentos na ordem do protocolo. */
export function compararProtocolo(a: { tipo_documento?: string | null }, b: { tipo_documento?: string | null }): number {
  const pa = posicaoProtocolo(a.tipo_documento);
  const pb = posicaoProtocolo(b.tipo_documento);
  return pa.grupo - pb.grupo || pa.ordem - pb.ordem;
}

/** Nome do arquivo dentro do ZIP, já numerado. */
export function nomeArquivoDossie(
  doc: { tipo_documento?: string | null; nome_documento?: string | null; arquivo_nome?: string | null },
  sufixo?: string | number,
): string {
  const p = posicaoProtocolo(doc.tipo_documento, doc.nome_documento);
  const ext = String(doc.arquivo_nome || "").split(".").pop();
  const extensao = ext && ext.length <= 5 ? `.${ext.toLowerCase()}` : ".pdf";
  const base = `${p.numero}. ${p.rotulo}`.replace(/[\\/:*?"<>|]/g, "-");
  return sufixo != null ? `${base} (${sufixo})${extensao}` : `${base}${extensao}`;
}