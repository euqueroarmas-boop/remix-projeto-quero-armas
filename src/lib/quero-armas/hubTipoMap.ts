// ============================================================================
// hubTipoMap.ts
// ----------------------------------------------------------------------------
// Mapa compartilhado entre o Assistente Guiado (wizard antigo) e o novo
// PendenciasGuiadasPopup (unificação Fase 1). Traduz `tipo_documento` do
// checklist do processo para o tipo aceito pelo Hub Documental (constraint
// qa_doc_cliente_tipo_check).
// ============================================================================

export const PROCESSO_TO_HUB_TIPO: Record<string, string> = {
  // ── IDENTIFICAÇÃO — Bloco 1 (07/08/2026) ─────────────────────────────────
  // Nada aqui é traduzido. O vocabulário tem três nomes — `cin`, `rg_com_cpf`,
  // `cnh` — e cada documento é gravado no Hub COMO O QUE ELE É.
  //
  // Antes, `rg_com_cpf` era reescrito para `cin`: o cliente enviava um RG e o
  // Hub arquivava um CIN. O tipo verdadeiro se perdia na gravação, e nenhuma
  // constraint pega isso, porque `cin` é um tipo perfeitamente válido.
  //
  // A dispensa mútua (um dos três satisfaz a exigência dos outros dois) é
  // regra de NEGÓCIO e vive em qa_tipo_documento_aliases, onde pode ser
  // auditada. Não é regra de gravação.
  //
  // As grafias legadas (documento_identidade_nacional, carteira_identidade_
  // nacional, cedula_identidade_rg_com_cpf, documento_identidade, identidade,
  // rg) saíram daqui: nenhum catálogo as produz, e exigência antiga que ainda
  // as carregue fecha pelos apelidos criados em 20260807200000.
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
  // declaracao_compromisso_habitualidade NÃO é traduzida. É documento próprio,
  // com finalidade própria, e tem tipo próprio no Hub — não se confunde com o
  // comprovante de habitualidade. O banco já havia desfeito essa equivalência
  // em 20260729010000; o frontend é que continuava juntando os dois.
  declaracao_compromisso_treino: "declaracao_correlata",
  renda_nf_empresa: "renda_nf_recente",
  // QSA é exigência PRÓPRIA (matriz de ocupação lícita) — não pode colapsar
  // no cartão CNPJ, senão o slot do QSA nunca é cumprido.
  // Tipos legados de MEI passam a cair no CCMEI, que é o documento oficial.
  renda_cnpj_autonomo: "renda_ccmei",
  ccmei: "renda_ccmei",
  certificado_mei: "renda_ccmei",
  // renda_ficha_cadastral_jucesp NÃO é traduzida: virou tipo próprio do Hub
  // em 20260731100000. Rebaixá-la para renda_contrato_social gravava o
  // documento sob outro tipo e o slot do processo — que pede
  // `renda_ficha_cadastral_jucesp` — nunca era satisfeito, porque não existe
  // apelido ligando os dois. Sem entrada aqui, o match é por identidade.
  // Documentos funcionais de servidor/militar: o Hub já tem o slot
  // "Carteira funcional (servidor público)". Antes a identidade funcional caía
  // em "outro"/"documento complementar" e a leitura acabava classificando o
  // cartão como RG — o que disparava rejeição por duplicidade contra o RG já
  // aprovado. Agora ela tem destino próprio dentro de ocupação lícita.
  identidade_funcional: "renda_carteira_funcional",
  identidade_funcional_digital: "renda_carteira_funcional",
  carteira_funcional: "renda_carteira_funcional",
  carteira_identidade_funcional: "renda_carteira_funcional",
  // Contra-cheque é o holerite do SERVIDOR PÚBLICO; holerite (mês atual) é o do
  // CLT. São ocupações lícitas diferentes e o Hub já tem um tipo para cada.
  // Estava apontado para o balde do CLT, jogando servidor público na caixa errada.
  contra_cheque_digital: "renda_holerite_funcionario_publico",
  // Certidão TRF3 longa (gerada por qa_explodir_checklist_processo com
  // o nome completo da seção — mesmo documento que certidao_federal_trf3_sjsp_jef).
  certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciaria_e_juizado_especial_federal_de_sao_paulo: "antecedentes_federal_sjsp_jef",
  // Variante truncada que aparece em alguns processos (limite de tamanho do campo):
  certidao_federal_trf_3_regiao_abrangencia_da_secao_judiciari: "antecedentes_federal_sjsp_jef",
  // Laudos de instituição (psicólogo e instrutor de tiro cadastrados):
  atestado_aptidao_psicologica_instituicao: "laudo_psicologico",
  atestado_capacidade_tecnica_instituicao: "laudo_capacidade_tecnica",
  // Certidão estadual Polícia Civil (antecedentes criminais estaduais):
  certidao_estadual_policia_civil: "antecedentes_criminais",
  // Declarações de endereço/acervo e necessidade efetiva:
  declaracao_endereco_acervo: "declaracao_guarda_acervo_1endereco",
  declaracao_necessidade_efetiva: "comprovante_efetiva_necessidade",
};

const HUB_TIPOS_VALIDOS = new Set([
  "cr","craf","sinarm","gt","gte","autorizacao_compra","nota_fiscal_arma",
  // `cpf` saiu do vocabulário em 20260807200000: o número consta do próprio
  // RG/CIN/CNH e não existe exigência de documento CPF avulso.
  "rg_com_cpf","cin","cnh",
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
