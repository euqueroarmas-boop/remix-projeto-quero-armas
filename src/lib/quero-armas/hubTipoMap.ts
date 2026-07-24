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
  comprovante_endereco_ano_2022: "comprovante_residencia",
  comprovante_endereco_ano_2023: "comprovante_residencia",
  comprovante_endereco_ano_2024: "comprovante_residencia",
  comprovante_endereco_ano_2025: "comprovante_residencia",
  comprovante_endereco_ano_2026: "comprovante_residencia",
  comprovante_endereco_ano_2027: "comprovante_residencia",
  certidao_antecedentes_policia_civil_sp: "antecedentes_criminais",
  certidao_crimes_eleitorais_tse: "antecedentes_eleitoral",
  certidao_crimes_militares_stm: "antecedentes_militar",
  certidao_criminal_tjmsp: "antecedentes_militar",
  certidao_federal_trf3_regional: "antecedentes_federal_trf3_regional",
  certidao_federal_trf3_sjsp_jef: "antecedentes_federal_sjsp_jef",
  certidao_tjsp_distribuicao_criminal: "antecedentes_estadual_distribuicao",
  certidao_tjsp_execucoes_criminais: "antecedentes_estadual_execucoes",
  comprovante_filiacao_entidade_tiro: "comprovante_clube_tiro",
  declaracao_habitualidade_clube: "comprovante_habitualidade",
  declaracao_compromisso_habitualidade: "comprovante_habitualidade",
  declaracao_compromisso_treino: "declaracao_correlata",
  renda_nf_empresa: "renda_nf_recente",
  renda_qsa: "renda_cartao_cnpj",
};

const HUB_TIPOS_VALIDOS = new Set([
  "cr","craf","sinarm","gt","gte","autorizacao_compra","nota_fiscal_arma",
  "rg_com_cpf","cin","cnh","cpf",
  "comprovante_residencia","declaracao_responsavel_imovel",
  "ctps","renda_holerite_mes_atual","renda_holerite_funcionario_publico",
  "renda_cartao_cnpj","renda_cnpj_autonomo","renda_contrato_social",
  "renda_nf_recente","renda_comprovante_beneficio","renda_extrato_inss",
  "antecedentes_criminais","antecedentes_federal","antecedentes_estadual",
  "antecedentes_militar","antecedentes_eleitoral",
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
  "contrato_assinado","procuracao_assinada",
  "outro",
]);

export function toHubTipoCompartilhado(processoTipo: string | null | undefined): string {
  const raw = String(processoTipo || "").trim().toLowerCase();
  if (!raw) return "outro";
  const mapped = PROCESSO_TO_HUB_TIPO[raw] ?? raw;
  return HUB_TIPOS_VALIDOS.has(mapped) ? mapped : "outro";
}