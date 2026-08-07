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
  // ── CERTIDÕES — LEGADO a partir do Bloco 2B (20260807230000) ────────────
  // Os slugs de certidão do processo foram renomeados para o tipo do Hub, e
  // exigência e documento passaram a ter o MESMO nome: o casamento é por
  // identidade e não precisa de tradução.
  //
  // As entradas abaixo ficam para processos ENCERRADOS, que mantêm o slug da
  // época — histórico não se reescreve. Elas dizem exatamente o mesmo que
  // qa_tipo_documento_aliases, então não há divergência possível.
  // Nenhuma delas reescreve um tipo válido do Hub em outro tipo válido, que
  // era o padrão perigoso (rg_com_cpf→cin, JUCESP→contrato social,
  // contra-cheque→holerite CLT).

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
  // comprovante_filiacao_entidade_tiro saiu no Bloco 4 (20260807280000):
  // o destino comprovante_clube_tiro foi removido do Hub junto com todo o
  // conceito de habitualidade, que não pertence a este fluxo.
  // QSA é exigência PRÓPRIA (matriz de ocupação lícita) — não pode colapsar
  // no cartão CNPJ, senão o slot do QSA nunca é cumprido.
  // Tipos legados de MEI passam a cair no CCMEI, que é o documento oficial.
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
  carteira_funcional: "renda_carteira_funcional",
  carteira_identidade_funcional: "renda_carteira_funcional",
  // contra_cheque_digital e identidade_funcional_digital saíram daqui no Bloco 3
  // (20260807260000): foram renomeados para renda_contra_cheque_mes_atual e
  // renda_carteira_funcional, então casam por identidade. As grafias sem
  // "_digital" acima permanecem porque nenhum catálogo as produz — servem só a
  // processo encerrado que ainda as carregue.
  //
  // renda_cnpj_autonomo também saiu: é tipo PRÓPRIO do Hub, e traduzi-lo para
  // renda_ccmei era o mesmo padrão destrutivo do RG virando CIN — grava um
  // documento válido sob outro tipo válido, sem erro nenhum para denunciar.
  // Tinha zero uso em catálogo, processo e Hub.

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
  // declaracao_endereco_acervo NÃO é traduzida. É tipo próprio do Hub e tem 5
  // linhas ativas no catálogo, enquanto o destino antigo —
  // declaracao_guarda_acervo_1endereco — tem ZERO uso. A tradução mandava um
  // slug real para um tipo que ninguém usa, gravando o documento sob outro
  // nome: mesmo padrão do RG virando CIN e da JUCESP virando contrato social.
  declaracao_necessidade_efetiva: "comprovante_efetiva_necessidade",
};

const HUB_TIPOS_VALIDOS = new Set([
  "cr","craf","sinarm","gt","gte","autorizacao_compra","nota_fiscal_arma",
  // `cpf` saiu do vocabulário em 20260807200000: o número consta do próprio
  // RG/CIN/CNH e não existe exigência de documento CPF avulso.
  "rg_com_cpf","cin","cnh",
  "comprovante_residencia","declaracao_responsavel_imovel",
  "ctps","renda_holerite_mes_atual",
  // Bloco 3: o CHECK do banco aceita `renda_holerite_funcionario_publico`
  // desde sempre, mas esta lista não conhecia o tipo. O holerite do servidor
  // público chegava e era rebaixado para "outro", exatamente como acontecia
  // com a JUCESP — sem erro nenhum para denunciar, e o slot de ocupação
  // lícita nunca fechava.
  "renda_holerite_funcionario_publico",
  "renda_carteira_funcional",
  "renda_cartao_cnpj","renda_cnpj_autonomo","renda_contrato_social",
  "renda_ccmei","renda_qsa",
  "renda_nf_empresa","renda_comprovante_beneficio","renda_extrato_inss",
  // Faltava aqui, e o efeito era pior do que parece: em 20260807160000 eu tirei
  // a tradução `renda_ficha_cadastral_jucesp -> renda_contrato_social` dizendo
  // que passaria a casar por identidade, sem conferir se o tipo constava desta
  // lista. Não constava — então o documento deixava de ser gravado com tipo
  // errado e passava a ser gravado como "outro", sem tipo nenhum.
  "renda_ficha_cadastral_jucesp","renda_contra_cheque_mes_atual",
  "antecedentes_criminais","antecedentes_federal","antecedentes_estadual",
  "antecedentes_militar","antecedentes_militar_estadual","antecedentes_eleitoral",
  "antecedentes_federal_trf3_regional","antecedentes_federal_sjsp_jef",
  "antecedentes_estadual_distribuicao","antecedentes_estadual_execucoes",
  // ── Bloco 3 (07/08/2026) — certidões fora de São Paulo ───────────────────
  // O catálogo (qa_tipos_documento_catalogo) já oferecia certidão criminal
  // estadual das 27 unidades da federação e as regiões federais TRF1, TRF2,
  // TRF4, TRF5 e TRF6. Nem esta lista nem o CHECK do banco as conheciam: o
  // cliente de fora de SP entregava a certidão certa e ela era gravada como
  // "outro". A exigência ficava aberta e ele era mandado emitir de novo.
  // O CHECK foi ampliado na mesma leva; esta lista agora o espelha.
  "antecedentes_estadual_ac","antecedentes_estadual_al","antecedentes_estadual_am",
  "antecedentes_estadual_ap","antecedentes_estadual_ba","antecedentes_estadual_ce",
  "antecedentes_estadual_df","antecedentes_estadual_es","antecedentes_estadual_go",
  "antecedentes_estadual_ma","antecedentes_estadual_mg","antecedentes_estadual_ms",
  "antecedentes_estadual_mt","antecedentes_estadual_pa","antecedentes_estadual_pb",
  "antecedentes_estadual_pe","antecedentes_estadual_pi","antecedentes_estadual_pr",
  "antecedentes_estadual_rj","antecedentes_estadual_rn","antecedentes_estadual_ro",
  "antecedentes_estadual_rr","antecedentes_estadual_rs","antecedentes_estadual_sc",
  "antecedentes_estadual_se","antecedentes_estadual_sp","antecedentes_estadual_to",
  "antecedentes_federal_trf1_regional","antecedentes_federal_trf2_regional",
  "antecedentes_federal_trf4_regional","antecedentes_federal_trf5_regional",
  "antecedentes_federal_trf6_regional",
  "declaracao_sem_inquerito_processo_criminal","declaracao_guarda_responsavel",
  "declaracao_correlata","declaracao_guarda_acervo_1endereco",
  // Cinco tipos que o CHECK do banco aceita e esta lista não conhecia. O
  // documento chegava, era rebaixado para "outro" e perdia o tipo — mesmo
  // efeito da JUCESP, sem erro nenhum para denunciar.
  // `declaracao_nao_possuir_segundo_endereco` sequer existe em migration
  // alguma do repositório: entrou no banco por fora.
  "declaracao_guarda_acervo_2enderecos","declaracao_endereco_acervo",
  "dsa_declaracao_seguranca_acervo","declaracao_nao_possuir_segundo_endereco",
  "declaracao_homonimia",
  "laudo_psicologico","laudo_capacidade_tecnica",
  "comprovante_efetiva_necessidade","documento_complementar_caso",
  // comprovante_habitualidade e comprovante_clube_tiro removidos no Bloco 4
  // (20260807280000): o conceito de habitualidade não pertence ao processo.
  "comprovante_competicao",
  "protocolo_processo","oficio","despacho","exigencia","indeferimento",
  "procuracao","recurso_administrativo_doc","mandado_seguranca_doc",
  "certidao_alteracao_nome",
  "documento_identificacao_terceiro","foto_3x4","boletim_ocorrencia",
  "requerimento_de_posse_de_arma_de_fogo","comprovante_pagamento",
  "habilitacao_cacador_ibama",
  "contrato_assinado","procuracao_assinada",
  "outro",
]);

export function toHubTipoCompartilhado(processoTipo: string | null | undefined): string {
  const raw = String(processoTipo || "").trim().toLowerCase();
  if (!raw) return "outro";
  const mapped = PROCESSO_TO_HUB_TIPO[raw] ?? raw;
  return HUB_TIPOS_VALIDOS.has(mapped) ? mapped : "outro";
}
