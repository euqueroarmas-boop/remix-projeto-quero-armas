/**
 * ESPELHO de `src/lib/quero-armas/ordemProtocolo.ts` para o runtime Deno.
 * Deno e Vite não compartilham módulo — as duas cópias mudam juntas. É a mesma
 * convenção já usada em pendenciasGrupos e prazosProcessuais.
 *
 * Ordem canônica do DOSSIÊ DE PROTOCOLO (Polícia Federal).
 *
 * É a mesma numeração do ZIP de referência entregue pela equipe:
 *
 *   1.0 Requerimento do Sinarm            → Grupo 1 — Requerimento e Taxas
 *   1.1 Boleto da GRU                     → Grupo 1
 *   1.2 Comprovante de pagamento da taxa  → Grupo 1
 *   1.3..1.8 Provas do caso               → Grupo 1
 *   1.9 Petição de efetiva necessidade    → Grupo 1 (fecha, depois das provas)
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

/**
 * PENDÊNCIA — fase CAC (anotada em 15/08/2026).
 *
 * O escopo deste mapa hoje é DEFESA PESSOAL. Os demais documentos de
 * arma/acervo seguem sem grupo próprio, caindo em "Grupo 9 — Outros" de
 * propósito: `cr`, `craf`, `gt`, `gte`, `autorizacao_compra`,
 * `nota_fiscal_arma` e as declarações de acervo CAC (guarda de acervo, DSA,
 * endereço do acervo). Definir o grupo deles quando a fase CAC começar.
 */
const MAPA: Record<string, Regra> = {
  requerimento_sinarm: { grupo: 1, ordem: 0, numero: "1.0", rotulo: "Requerimento do Sinarm" },

  // BOLETO e COMPROVANTE são itens SEPARADOS no dossiê (equipe, 16/08/2026):
  // a guia emitida e a prova de que ela foi paga são dois documentos, e é assim
  // que as pastas de referência sempre foram montadas.
  gru: { grupo: 1, ordem: 1, numero: "1.1", rotulo: "Boleto da GRU" },
  gru_boleto: { grupo: 1, ordem: 1, numero: "1.1", rotulo: "Boleto da GRU" },
  gru_comprovante: { grupo: 1, ordem: 2, numero: "1.2", rotulo: "Comprovante de pagamento da taxa" },
  gru_paga: { grupo: 1, ordem: 2, numero: "1.2", rotulo: "Comprovante de pagamento da taxa" },

  // PROVAS PRIMEIRO, PETIÇÃO DEPOIS (equipe, 16/08/2026).
  // A PF não exige ordem nenhuma — quem organiza somos nós. E a leitura fica
  // mais coerente assim: o analista vê os fatos comprovados e só então lê o
  // argumento que os amarra. Petição antes da prova obriga a voltar páginas.
  boletim_ocorrencia: { grupo: 1, ordem: 3, numero: "1.3", rotulo: "Boletim de ocorrencia" },
  bo: { grupo: 1, ordem: 3, numero: "1.3", rotulo: "Boletim de ocorrencia" },
  inquerito_policial: { grupo: 1, ordem: 4, numero: "1.4", rotulo: "Inquerito policial" },
  inquerito: { grupo: 1, ordem: 4, numero: "1.4", rotulo: "Inquerito policial" },
  denuncia: { grupo: 1, ordem: 5, numero: "1.5", rotulo: "Denuncia do Ministerio Publico" },
  denuncia_mp: { grupo: 1, ordem: 5, numero: "1.5", rotulo: "Denuncia do Ministerio Publico" },
  acao_criminal: { grupo: 1, ordem: 6, numero: "1.6", rotulo: "Acao criminal" },
  processo_criminal: { grupo: 1, ordem: 6, numero: "1.6", rotulo: "Acao criminal" },
  sentenca: { grupo: 1, ordem: 6, numero: "1.6", rotulo: "Sentenca" },
  medida_protetiva: { grupo: 1, ordem: 7, numero: "1.7", rotulo: "Medida protetiva" },
  comprovante_efetiva_necessidade: { grupo: 1, ordem: 8, numero: "1.8", rotulo: "Comprovacao de efetiva necessidade" },

  // A petição FECHA o bloco das provas.
  peticao_efetiva_necessidade: { grupo: 1, ordem: 9, numero: "1.9", rotulo: "Peticao de efetiva necessidade" },
  efetiva_necessidade: { grupo: 1, ordem: 9, numero: "1.9", rotulo: "Peticao de efetiva necessidade" },
  declaracao_necessidade_efetiva: { grupo: 1, ordem: 9, numero: "1.9", rotulo: "Peticao de efetiva necessidade" },

  documento_complementar_caso: { grupo: 1, ordem: 10, numero: "1.10", rotulo: "Documento complementar do caso" },

  requerimento_de_posse_de_arma_de_fogo: { grupo: 1, ordem: 0, numero: "1.0", rotulo: "Requerimento de Posse de Arma de Fogo" },

  foto_3x4: { grupo: 2, ordem: 0, numero: "02", rotulo: "Foto 3x4" },

  cnh: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  cin: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  rg: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  rg_com_cpf: { grupo: 3, ordem: 0, numero: "03", rotulo: "Documento de identidade" },
  identidade_funcional: { grupo: 3, ordem: 1, numero: "03", rotulo: "Identidade funcional" },
  // Averbação de nome instrui a identificação civil — não é certidão de
  // idoneidade, apesar do prefixo "certidao_" (que a regraIdoneidade pegaria).
  certidao_alteracao_nome: { grupo: 3, ordem: 2, numero: "03", rotulo: "Certidao averbada de alteracao de nome" },

  comprovante_residencia: { grupo: 4, ordem: 0, numero: "04", rotulo: "Comprovante de residencia" },
  declaracao_residencia: { grupo: 4, ordem: 1, numero: "04", rotulo: "Declaracao de residencia" },
  declaracao_responsavel_imovel: { grupo: 4, ordem: 2, numero: "04", rotulo: "Declaracao do responsavel pelo imovel" },
  documento_identificacao_terceiro: { grupo: 4, ordem: 3, numero: "04", rotulo: "Identificacao do titular do comprovante" },

  ctps: { grupo: 5, ordem: 0, numero: "05", rotulo: "Ocupacao licita - CTPS" },

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
  atestado_aptidao_psicologica_instituicao: { grupo: 7, ordem: 0, numero: "13", rotulo: "Atestado de aptidao psicologica (instituicao)" },
  exame_tiro: { grupo: 7, ordem: 1, numero: "14", rotulo: "Exame de tiro" },
  laudo_tiro: { grupo: 7, ordem: 1, numero: "14", rotulo: "Exame de tiro" },
  // Capacidade técnica É o exame de tiro (item 14 do dossiê). Sem estas duas
  // linhas, o laudo caía em "Grupo 9 — Outros" na árvore e no ZIP.
  laudo_capacidade_tecnica: { grupo: 7, ordem: 1, numero: "14", rotulo: "Atestado de capacidade tecnica" },
  atestado_capacidade_tecnica_instituicao: { grupo: 7, ordem: 1, numero: "14", rotulo: "Atestado de capacidade tecnica (instituicao)" },

  contrato_assinado: { grupo: 8, ordem: 0, numero: "15", rotulo: "Contrato assinado" },
  procuracao_assinada: { grupo: 8, ordem: 1, numero: "16", rotulo: "Procuracao assinada" },
  comprovante_pagamento: { grupo: 8, ordem: 2, numero: "17", rotulo: "Comprovante de pagamento do contrato" },

  // ── ARMA / ACERVO — o CRAF é UM tipo só ──────────────────────────────────
  //
  // Existe um único documento de registro de arma: o CRAF. O que varia não é o
  // tipo, e sim dois ATRIBUTOS da arma, que já têm coluna própria no banco:
  //
  //   SISTEMA    → `qa_cliente_armas_manual.sistema` (CHECK 'SINARM' | 'SIGMA'),
  //                com `numero_sinarm` / `numero_sigma`.
  //                SINARM = Polícia Federal (Lei 10.826/2003, IN DG/PF 201/2021);
  //                SIGMA  = Exército Brasileiro (Decreto 11.615/2023).
  //   FINALIDADE → `qa_clientes.entrada_finalidade_arma`
  //                (CHECK 'defesa_pessoal' | 'caca' | 'tiro_esportivo' |
  //                'colecionamento').
  //
  // Por isso `sinarm` e `craf` compartilham rótulo, grupo e ordem: são o MESMO
  // documento. `sinarm` sobrevive só como grafia legada do tipo (a constraint
  // `qa_doc_cliente_tipo_check` ainda aceita as duas), e o Arsenal já trata
  // `["craf","sinarm"]` como equivalentes. Quem responde "qual sistema?" e
  // "qual finalidade?" são os campos acima, nunca o tipo do documento.
  //
  // COMO ESTÁ HOJE: a análise dos pedidos de CAC passou para a Polícia Federal,
  // mas a EMISSÃO continua saindo em nome do Exército e o documento sai como
  // SIGMA. Mudou a equipe que analisa, não o sistema que emite.
  //
  // "SINARM" também nomeia o SERVIÇO que o cliente compra (autorização de
  // compra / posse, porte) — e nunca o requerimento, que tem os tipos próprios
  // logo acima (`requerimento_sinarm`, `requerimento_de_posse_de_arma_de_fogo`).
  //
  // POSIÇÃO NO DOSSIÊ: o CRAF é o produto final do SEGUNDO processo. O primeiro
  // (autorização de compra / posse) encerra com a autorização; só então abre o
  // processo de registro, que termina com a emissão do CRAF. É RESULTADO, não
  // peça do dossiê de aquisição — por isso fica fora dos grupos 1..8.
  craf: { grupo: 9, ordem: 0, numero: "99", rotulo: "CRAF - Certificado de Registro de Arma de Fogo" },
  sinarm: { grupo: 9, ordem: 0, numero: "99", rotulo: "CRAF - Certificado de Registro de Arma de Fogo" },
};

/** Documentos de ocupação lícita são muitos e todos entram no grupo 5, item 05. */
function regraOcupacao(tipo: string): Regra | null {
  if (!tipo.startsWith("renda_")) return null;
  const nome = tipo.replace(/^renda_/, "").replace(/_/g, " ");
  return { grupo: 5, ordem: 0, numero: "05", rotulo: `Ocupacao licita - ${nome}` };
}

/** Qualquer antecedente não mapeado ainda pertence à Idoneidade. */
function regraIdoneidade(tipo: string): Regra | null {
  if (!/^(antecedentes_|certidao_|declaracao_sem_inquerito|declaracao_idoneidade|declaracao_homonimia)/.test(tipo)) return null;
  return { grupo: 6, ordem: 9, numero: "12", rotulo: tipo.replace(/_/g, " ") };
}

/**
 * Provas do caso (efetiva necessidade) que não estão no mapa: BO complementar,
 * print de ameaça, laudo de lesão, etc. Nunca podem cair em "Outros" — elas
 * instruem a petição e precisam ir junto dela no dossiê.
 */
function regraProvaCaso(tipo: string): Regra | null {
  if (!/(ocorrenc|inquerit|denunc|protetiv|ameac|agress|criminal|prova_|_prova|caso)/.test(tipo)) return null;
  return { grupo: 1, ordem: 9, numero: "1.9", rotulo: tipo.replace(/_/g, " ") };
}

export function posicaoProtocolo(tipoDocumento?: string | null, nomeFallback?: string | null): PosicaoProtocolo {
  const tipo = String(tipoDocumento || "").toLowerCase().trim();
  const regra =
    MAPA[tipo] ||
    regraOcupacao(tipo) ||
    regraIdoneidade(tipo) ||
    regraProvaCaso(tipo) || {
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