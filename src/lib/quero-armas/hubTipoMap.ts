// ============================================================================
// hubTipoMap.ts
// ----------------------------------------------------------------------------
// Mapa compartilhado entre o Assistente Guiado (wizard antigo) e o novo
// PendenciasGuiadasPopup (unificação Fase 1). Traduz `tipo_documento` do
// checklist do processo para o tipo aceito pelo Hub Documental (constraint
// qa_doc_cliente_tipo_check).
// ============================================================================

export const PROCESSO_TO_HUB_TIPO: Record<string, string> = {
  rg_com_cpf: "cin",
  documento_identidade_nacional: "cin",
  carteira_identidade_nacional: "cin",
  cedula_identidade_rg_com_cpf: "cin",
  comprovante_endereco_ano_2022: "comprovante_residencia",
  comprovante_endereco_ano_2023: "comprovante_residencia",
  comprovante_endereco_ano_2024: "comprovante_residencia",
  comprovante_endereco_ano_2025: "comprovante_residencia",
  comprovante_endereco_ano_2026: "comprovante_residencia",
  comprovante_endereco_ano_2027: "comprovante_residencia",
  certidao_antecedentes_policia_civil_sp: "antecedentes_criminais",
  certidao_crimes_eleitorais_tse: "antecedentes_eleitoral",
  // STM (União) e TJM (Estadual) são certidões DIFERENTES e têm slots
  // diferentes no processo. Mapeá-las para o mesmo tipo do Hub fazia o TJM
  // colidir com o STM: o slot da TJM nunca casava e era pedido de novo.
  certidao_crimes_militares_stm: "antecedentes_militar",
  certidao_criminal_tjmsp: "antecedentes_militar_estadual",
  certidao_estadual_justica_militar: "antecedentes_militar_estadual",
  certidao_federal_trf3_regional: "antecedentes_federal_trf3_regional",
  certidao_federal_trf3_sjsp_jef: "antecedentes_federal_sjsp_jef",
  certidao_tjsp_distribuicao_criminal: "antecedentes_estadual_distribuicao",
  certidao_tjsp_execucoes_criminais: "antecedentes_estadual_execucoes",
  // Variantes canônicas usadas pelo qa_explodir_checklist_processo:
  certidao_antecedentes_criminais_eleitoral: "antecedentes_eleitoral",
  certidao_antecedentes_criminais_estadual: "antecedentes_estadual",
  certidao_antecedentes_criminais_federal: "antecedentes_federal",
  certidao_antecedentes_criminais_militar: "antecedentes_militar_estadual",
  certidao_estadual_distribuicao_acoes_criminais: "antecedentes_estadual_distribuicao",
  certidao_estadual_execucoes_criminais: "antecedentes_estadual_execucoes",
  // 2º grau ainda não tem slot próprio no Hub — mapeia para o equivalente de 1º grau
  // (o cliente envia como "distribuição/execuções"; a instrução do popup explica o 2º grau).
  certidao_estadual_segundo_grau_acoes_criminais: "antecedentes_estadual_distribuicao",
  certidao_estadual_segundo_grau_execucoes_criminais: "antecedentes_estadual_execucoes",
  comprovante_filiacao_entidade_tiro: "comprovante_clube_tiro",
  declaracao_habitualidade_clube: "comprovante_habitualidade",
  declaracao_compromisso_habitualidade: "comprovante_habitualidade",
  declaracao_compromisso_treino: "declaracao_correlata",
  renda_nf_empresa: "renda_nf_recente",
  // QSA é exigência PRÓPRIA (matriz de ocupação lícita) — não pode colapsar
  // no cartão CNPJ, senão o slot do QSA nunca é cumprido.
  // Tipos legados de MEI passam a cair no CCMEI, que é o documento oficial.
  renda_cnpj_autonomo: "renda_ccmei",
  ccmei: "renda_ccmei",
  certificado_mei: "renda_ccmei",
  renda_ficha_cadastral_jucesp: "renda_contrato_social",
  // Documentos funcionais de servidor/militar: sem slot próprio no Hub,
  // mapeados para os equivalentes semânticos mais próximos.
  identidade_funcional_digital: "documento_complementar_caso",
  contra_cheque_digital: "renda_holerite_mes_atual",
  // Certidão TRF3 longa (gerada por qa_explodir_checklist_processo com
  // o nome completo da seção — mesmo documento que certidao_federal_trf3_sjsp_jef).
  certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo: "antecedentes_federal_sjsp_jef",
};

const HUB_TIPOS_VALIDOS = new Set([
  "cr","craf","sinarm","gt","gte","autorizacao_compra","nota_fiscal_arma",
  "rg_com_cpf","cin","cnh","cpf",
  "comprovante_residencia","declaracao_responsavel_imovel",
  "ctps","renda_holerite_mes_atual","renda_holerite_funcionario_publico",
  "renda_carteira_funcional",
  "renda_cartao_cnpj","renda_cnpj_autonomo","renda_contrato_social",
  "renda_ccmei","renda_qsa",
  "renda_nf_recente","renda_comprovante_beneficio","renda_extrato_inss",
  "antecedentes_criminais","antecedentes_federal","antecedentes_estadual",
  "antecedentes_militar","antecedentes_militar_estadual","antecedentes_eleitoral",
  "antecedentes_federal_trf3_regional","antecedentes_federal_sjsp_jef",
  "antecedentes_estadual_distribuicao","antecedentes_estadual_execucoes",
  "declaracao_sem_inquerito_processo_criminal","declaracao_guarda_responsavel",
  "declaracao_correlata","declaracao_guarda_acervo_1endereco",
  "laudo_psicologico","laudo_capacidade_tecnica",
  "comprovante_efetiva_necessidade","documento_complementar_caso",
  "comprovante_habitualidade","comprovante_clube_tiro","comprovante_competicao",
  "protocolo_processo","oficio","despacho","exigencia","indeferimento",
  "procuracao","recurso_administrativo_doc","mandado_seguranca_doc",
  "certidao_alteracao_nome",
  "documento_identificacao_terceiro","foto_3x4","boletim_ocorrencia",
  "requerimento_de_posse_de_arma_de_fogo","comprovante_pagamento",
  "habilitacao_cacador_ibama","declaracao_compromisso_habitualidade",
  "contrato_assinado","procuracao_assinada",
  "outro",
]);

export function toHubTipoCompartilhado(processoTipo: string | null | undefined): string {
  const raw = String(processoTipo || "").trim().toLowerCase();
  if (!raw) return "outro";
  const mapped = PROCESSO_TO_HUB_TIPO[raw] ?? raw;
  return HUB_TIPOS_VALIDOS.has(mapped) ? mapped : "outro";
}
