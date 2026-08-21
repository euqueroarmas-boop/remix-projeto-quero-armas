import { isDocDeArma } from "./documentosDeArma";

export type HubCategoria =
  | "identificacao"
  | "endereco"
  | "renda_ocupacao"
  | "antecedentes_regularidade"
  | "declaracoes"
  | "laudos_exames"
  | "efetiva_necessidade"
  | "arma_acervo"
  | "cac_atividade"
  | "documentos_processo"
  | "juridico"
  | "outros";

export type EscopoDocumental = "permanente" | "arma" | "processo" | "cac_atividade";

export interface HubCategoriaMeta {
  value: HubCategoria;
  label: string;
  description: string;
  escopoPadrao: EscopoDocumental;
}

export interface HubTipoDocumentoMeta {
  value: string;
  label: string;
  short: string;
  categoria: HubCategoria;
  escopo: EscopoDocumental;
  aceitaIA?: boolean;
  aceitaVinculoArma?: boolean;
  exigeValidade?: boolean;
  revisaoHumanaObrigatoria?: boolean;
}

export const HUB_CATEGORIAS: readonly HubCategoriaMeta[] = [
  {
    value: "identificacao",
    label: "Identificação civil",
    description: "RG com CPF, CNH, CIN, CPF e documentos civis do titular.",
    escopoPadrao: "permanente",
  },
  {
    value: "endereco",
    label: "Residência",
    description: "Comprovantes residenciais e declarações relacionadas ao imóvel.",
    escopoPadrao: "permanente",
  },
  {
    value: "renda_ocupacao",
    label: "Renda / ocupação",
    description: "Comprovantes de atividade profissional, renda e benefício.",
    escopoPadrao: "permanente",
  },
  {
    value: "antecedentes_regularidade",
    label: "Certidões e regularidade",
    description: "Antecedentes e certidões utilizadas na triagem administrativa.",
    escopoPadrao: "permanente",
  },
  {
    value: "declaracoes",
    label: "Declarações pessoais",
    description: "Declarações do titular, de guarda responsável e declarações correlatas.",
    escopoPadrao: "permanente",
  },
  {
    value: "laudos_exames",
    label: "Laudos psicológico / tiro",
    description: "Laudo psicológico, atestado de capacidade técnica (tiro) e laudos institucionais equivalentes.",
    escopoPadrao: "permanente",
  },
  {
    value: "efetiva_necessidade",
    label: "Justificativas / necessidade",
    description: "Efetiva necessidade e documentos complementares do caso concreto.",
    escopoPadrao: "processo",
  },
  {
    value: "arma_acervo",
    label: "Armas e acervo",
    description: "CR, CRAF, GTE, GT, autorizações de compra e documentos da arma.",
    escopoPadrao: "arma",
  },
  {
    value: "cac_atividade",
    label: "CAC / habitualidade",
    description: "Documentos de habitualidade, clube, competição e atividade do CAC.",
    escopoPadrao: "cac_atividade",
  },
  {
    value: "documentos_processo",
    label: "Documentos processuais",
    description: "Protocolos, ofícios, despachos, exigências, indeferimentos, recursos e peças do caso.",
    escopoPadrao: "processo",
  },
  {
    value: "juridico",
    label: "Documentos jurídicos",
    description: "Procurações, recursos, mandados e demais peças jurídicas do caso.",
    escopoPadrao: "processo",
  },
  {
    value: "outros",
    label: "Outros",
    description: "Anexos complementares que ainda não se encaixam no catálogo.",
    escopoPadrao: "processo",
  },
] as const;

/**
 * PADRÃO CANÔNICO DE NOME DAS CERTIDÕES DE ANTECEDENTES (fonte única).
 *
 * Formato fixo: `Certidão <espécie> — <órgão/abrangência>`.
 *
 * Este mapa é a ÚNICA verdade sobre como cada certidão se chama. Ele alimenta
 * ao mesmo tempo:
 *   • o rótulo do catálogo (`HUB_TIPOS_DOCUMENTO[].label`), usado no seletor
 *     "Alterar tipo", nos agrupamentos e em toda tela que só conhece o tipo;
 *   • o nome inferido do documento real (`inferNomeCertidaoOficial`), usado no
 *     resumo do cliente e nos cards do Hub.
 *
 * Antes eles eram listas separadas e divergiram: o resumo dizia "Certidão
 * Estadual de Distribuições Criminais — TJSP" e o Hub Documental, para o MESMO
 * documento, dizia "Certidão de Distribuição de Ações Criminais — TJSP".
 * Nunca mais duplicar: mexeu no nome, mexe aqui.
 */
export const NOME_CANONICO_ANTECEDENTES: Readonly<Record<string, string>> = {
  antecedentes_criminais: "Certidão de Antecedentes Criminais — Polícia Civil",
  antecedentes_estadual_distribuicao: "Certidão Estadual de Distribuições Criminais — Tribunal de Justiça",
  antecedentes_estadual_execucoes: "Certidão Estadual de Execuções Criminais — Tribunal de Justiça",
  antecedentes_federal_trf3_regional:
    "Certidão de Distribuição Criminal — Justiça Federal (abrangência regional)",
  antecedentes_federal_sjsp_jef:
    "Certidão de Distribuição Criminal — Seção Judiciária e JEF",
  antecedentes_militar: "Certidão Negativa de Crimes Militares — Justiça Militar da União (STM)",
  antecedentes_militar_estadual: "Certidão de Antecedentes Criminais — Justiça Militar Estadual (TJM)",
  antecedentes_eleitoral: "Certidão de Crimes Eleitorais — TSE",
  // Legados: ficam só para registros antigos (não aparecem no seletor).
  antecedentes_estadual: "Certidão Estadual Criminal — Tribunal de Justiça",
  antecedentes_federal: "Certidão de Distribuição Criminal — Justiça Federal",
} as const;

/** Nome canônico de uma certidão de antecedentes, quando existir. */
export function getNomeCanonicoAntecedentes(tipoDocumento: string | null | undefined): string | null {
  const tipo = String(tipoDocumento || "").trim().toLowerCase();
  return NOME_CANONICO_ANTECEDENTES[tipo] ?? null;
}

export const HUB_TIPOS_DOCUMENTO: readonly HubTipoDocumentoMeta[] = [
  { value: "rg_com_cpf", label: "RG com CPF", short: "RG", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "foto_3x4", label: "Foto 3x4 do requerente", short: "FOTO 3X4", categoria: "identificacao", escopo: "permanente" },
  { value: "cin", label: "CIN — Carteira de Identidade Nacional", short: "CIN", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "cnh", label: "CNH — Carteira Nacional de Habilitação", short: "CNH", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "certidao_alteracao_nome", label: "Certidão averbada de alteração de nome", short: "AVERBADA", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "comprovante_residencia", label: "Comprovante de residência", short: "END", categoria: "endereco", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "declaracao_responsavel_imovel", label: "Declaração do responsável pelo imóvel", short: "DECL. IMÓVEL", categoria: "endereco", escopo: "permanente" },
  { value: "documento_identificacao_terceiro", label: "Identificação do titular do comprovante (terceiro)", short: "ID TERCEIRO", categoria: "endereco", escopo: "permanente", aceitaIA: true },
  { value: "ctps", label: "Carteira de Trabalho (CTPS)", short: "CTPS", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_holerite_mes_atual", label: "Demonstrativo de Pagamento — Contracheque", short: "HOLERITE", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_holerite_funcionario_publico", label: "Demonstrativo de Pagamento — Contracheque (servidor público)", short: "HOL. SERVIDOR", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_carteira_funcional", label: "Identidade Funcional", short: "IDENT. FUNCIONAL", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_cartao_cnpj", label: "Comprovante de Inscrição e de Situação Cadastral do CNPJ", short: "CNPJ", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_qsa", label: "QSA — Quadro de Sócios e Administradores", short: "QSA", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_contrato_social", label: "Contrato Social / Requerimento de Empresário", short: "CONTRATO", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_ficha_cadastral_jucesp", label: "Ficha Cadastral Completa (Junta Comercial)", short: "FICHA JUNTA", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_ccmei", label: "CCMEI — Certificado da Condição de MEI", short: "CCMEI", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_cnpj_autonomo", label: "Cartão CNPJ (autônomo / MEI)", short: "CNPJ MEI", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  // Renomeada em 20260807270000: a nota fiscal NÃO precisa ser recente, logo
  // não tem prazo de validade (`validade_dias` foi a NULL na migration). O slug
  // antigo `renda_nf_recente` saiu do CHECK e vive apenas em TIPOS_RETIRADOS.
  { value: "renda_nf_empresa", label: "Nota Fiscal da Empresa", short: "NF", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_comprovante_beneficio", label: "Comprovante de benefício", short: "BENEFÍCIO", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_extrato_inss", label: "Extrato INSS", short: "INSS", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  // Certidões de antecedentes: `label` SEMPRE vem de NOME_CANONICO_ANTECEDENTES
  // (padrão "Certidão <espécie> — <órgão>"). Nunca escrever o nome à mão aqui.
  { value: "antecedentes_criminais", label: NOME_CANONICO_ANTECEDENTES.antecedentes_criminais, short: "ANTECEDENTES PC", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_federal", label: NOME_CANONICO_ANTECEDENTES.antecedentes_federal, short: "DISTRIBUIÇÃO FEDERAL", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_estadual", label: NOME_CANONICO_ANTECEDENTES.antecedentes_estadual, short: "ESTADUAL TJ", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_federal_trf3_regional", label: NOME_CANONICO_ANTECEDENTES.antecedentes_federal_trf3_regional, short: "FEDERAL REGIONAL", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_federal_sjsp_jef", label: NOME_CANONICO_ANTECEDENTES.antecedentes_federal_sjsp_jef, short: "FEDERAL SEÇÃO/JEF", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_estadual_distribuicao", label: NOME_CANONICO_ANTECEDENTES.antecedentes_estadual_distribuicao, short: "DISTRIBUIÇÕES TJ", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_estadual_execucoes", label: NOME_CANONICO_ANTECEDENTES.antecedentes_estadual_execucoes, short: "EXECUÇÕES TJ", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_militar", label: NOME_CANONICO_ANTECEDENTES.antecedentes_militar, short: "CRIMES MILITARES STM", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_militar_estadual", label: NOME_CANONICO_ANTECEDENTES.antecedentes_militar_estadual, short: "ANTECEDENTES TJM", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_eleitoral", label: NOME_CANONICO_ANTECEDENTES.antecedentes_eleitoral, short: "CRIMES ELEITORAIS TSE", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "declaracao_sem_inquerito_processo_criminal", label: "Declaração de não responder a inquérito/processo", short: "DECL. PENAL", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_responsavel", label: "Declaração de guarda responsável", short: "DECL. GUARDA", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_correlata", label: "Declaração correlata", short: "DECLARAÇÃO", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_acervo_1endereco", label: "Declaração de guarda de acervo — 1 endereço", short: "GUARDA 1 END", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_acervo_2enderecos", label: "Declaração de guarda de acervo — 2 endereços", short: "GUARDA 2 END", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_endereco_acervo", label: "Declaração de endereço do acervo", short: "END. ACERVO", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "dsa_declaracao_seguranca_acervo", label: "DSA — Declaração de Segurança do Acervo", short: "DSA", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_nao_possuir_segundo_endereco", label: "Declaração de não possuir 2º endereço de acervo", short: "SEM 2º END", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_homonimia", label: "Declaração de homonímia", short: "HOMONÍMIA", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "laudo_psicologico", label: "Laudo psicológico", short: "LAUDO PSI", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "laudo_capacidade_tecnica", label: "Atestado de capacidade técnica", short: "LAUDO TÉC.", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "atestado_aptidao_psicologica_instituicao", label: "Atestado de aptidão psicológica emitido pela instituição", short: "PSI INSTITUIÇÃO", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "atestado_capacidade_tecnica_instituicao", label: "Atestado de capacidade técnica emitido pela instituição", short: "TIRO INSTITUIÇÃO", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "comprovante_efetiva_necessidade", label: "Comprovação de efetiva necessidade", short: "NECESSIDADE", categoria: "efetiva_necessidade", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "boletim_ocorrencia", label: "Boletim de Ocorrência", short: "BO", categoria: "efetiva_necessidade", escopo: "processo", aceitaIA: true },
  { value: "documento_complementar_caso", label: "Documento complementar do caso", short: "COMPLEMENTAR", categoria: "efetiva_necessidade", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "cr", label: "CR — Certificado de Registro de Colecionador, Atirador Desportivo e Caçador (Exército)", short: "CR · Cert. Registro CAC", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, exigeValidade: true },
  { value: "craf", label: "CRAF — Certificado de Registro de Arma de Fogo", short: "CRAF · Cert. Reg. de Arma de Fogo", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "sinarm", label: "SINARM — Certificado de Registro de Arma de Fogo (Polícia Federal)", short: "SINARM · Reg. PF", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "gt", label: "GT — Guia de Tráfego", short: "GT · Guia de Tráfego", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "gte", label: "GTE — Guia de Tráfego Eventual", short: "GTE · Guia de Tráfego Eventual", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "autorizacao_compra", label: "Autorização de compra", short: "AC", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "nota_fiscal_arma", label: "Nota fiscal da arma", short: "NF ARMA", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true },
  // O CHECK conhece `comprovante_filiacao_entidade_tiro`; `comprovante_clube_tiro`
  // é o nome legado que hubTipoMap já traduzia — o Hub é que continuava gravando
  // o slug morto porque o seletor o oferecia direto, sem passar pela tradução.
  { value: "comprovante_filiacao_entidade_tiro", label: "Comprovante de clube / entidade", short: "CLUBE", categoria: "cac_atividade", escopo: "cac_atividade", exigeValidade: true },
  { value: "habilitacao_cacador_ibama", label: "Habilitação ambiental de caçador (IBAMA/IBRAM)", short: "HAB. CAÇADOR", categoria: "cac_atividade", escopo: "cac_atividade", aceitaIA: true, exigeValidade: true },
  { value: "comprovante_competicao", label: "Comprovante de competição / atividade", short: "COMPETIÇÃO", categoria: "cac_atividade", escopo: "cac_atividade", exigeValidade: true },
  // REGRA GLOBAL: o comprovante de pagamento pertence ao CONTRATO (documento da
  // transação), não ao processo administrativo. O único comprovante de pagamento
  // que pertence ao processo é a GRU (taxa da Polícia Federal / Exército).
  { value: "comprovante_pagamento", label: "Comprovante de pagamento do contrato", short: "PAGTO. CONTRATO", categoria: "juridico", escopo: "processo", aceitaIA: true },
  // BOLETO E COMPROVANTE SÃO DUAS PEÇAS (equipe, 16/08/2026): o boleto prova o
  // valor e o código da taxa, o comprovante prova que ela foi paga. No dossiê
  // entregue à PF são os itens 1.1 e 1.2, separados.
  { value: "gru", label: "GRU — boleto da taxa do processo", short: "GRU", categoria: "documentos_processo", escopo: "processo", aceitaIA: true },
  { value: "gru_comprovante", label: "GRU — comprovante de pagamento da taxa", short: "GRU PAGA", categoria: "documentos_processo", escopo: "processo", aceitaIA: true },
  { value: "requerimento_de_posse_de_arma_de_fogo", label: "Requerimento de Posse de Arma de Fogo (Polícia Federal)", short: "REQUERIMENTO", categoria: "documentos_processo", escopo: "processo", aceitaIA: true },
  // O dossiê fechado, assinado pelo cliente no gov.br — é o arquivo que
  // efetivamente entra na delegacia. Arquivá-lo como "outro" apagaria a peça
  // que mais precisa ser reencontrada depois.
  { value: "juntada_assinada", label: "Juntada final assinada no gov.br", short: "JUNTADA", categoria: "documentos_processo", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "protocolo_processo", label: "Protocolo do processo", short: "PROTOCOLO", categoria: "documentos_processo", escopo: "processo" },
  { value: "oficio", label: "Ofício", short: "OFÍCIO", categoria: "documentos_processo", escopo: "processo" },
  { value: "despacho", label: "Despacho / movimentação", short: "DESPACHO", categoria: "documentos_processo", escopo: "processo" },
  { value: "exigencia", label: "Exigência administrativa", short: "EXIGÊNCIA", categoria: "documentos_processo", escopo: "processo" },
  { value: "indeferimento", label: "Indeferimento", short: "INDEFER.", categoria: "documentos_processo", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "procuracao", label: "Procuração", short: "PROC.", categoria: "juridico", escopo: "processo", exigeValidade: true, revisaoHumanaObrigatoria: true },
  { value: "procuracao_assinada", label: "Procuração assinada (Gov.br)", short: "PROC. ASSINADA", categoria: "juridico", escopo: "processo", aceitaIA: true, exigeValidade: true, revisaoHumanaObrigatoria: true },
  { value: "contrato_assinado", label: "Contrato assinado (Gov.br)", short: "CONTRATO ASSINADO", categoria: "juridico", escopo: "processo", aceitaIA: true, revisaoHumanaObrigatoria: true },
  { value: "recurso_administrativo_doc", label: "Recurso administrativo", short: "RECURSO", categoria: "juridico", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "mandado_seguranca_doc", label: "Mandado de segurança / peça jurídica", short: "MS", categoria: "juridico", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "outro", label: "Outro documento", short: "OUTRO", categoria: "outros", escopo: "processo" },
] as const;

const META_BY_TIPO = new Map(HUB_TIPOS_DOCUMENTO.map((item) => [item.value, item] as const));

/**
 * Tipos legados mantidos no catálogo apenas para retrocompatibilidade de
 * registros antigos (label/meta lookup). Não devem mais aparecer nos selects:
 * toda certidão foi refinada em subtipos específicos (Distribuição vs
 * Execuções, TRF3 Regional vs SJSP/JEF).
 */
const TIPOS_LEGADOS_OCULTOS = new Set<string>([
  "antecedentes_estadual",
  // Substituída pelos subtipos TRF3 Regional e Seção Judiciária/JEF-SP.
  "antecedentes_federal",
]);

/**
 * Slugs que o CHECK `qa_doc_cliente_tipo_check` NÃO aceita mais, e o tipo vivo
 * que os substitui (`null` = aposentado sem sucessor).
 *
 * Por que isto existe: o seletor do Hub grava `tipo_documento` direto na
 * tabela, sem passar por `hubTipoMap` (que só traduz slug de PROCESSO para slug
 * de Hub). Quando uma migration renomeava um tipo, o catálogo do front ficava
 * para trás e o INSERT estourava a constraint na cara do cliente — foi o que
 * aconteceu com a nota fiscal em 14/08/2026.
 *
 * Mantenha esta tabela ao renomear/aposentar qualquer tipo. O teste
 * `catalogoHubVsConstraint.test.ts` falha se o catálogo divergir do CHECK.
 */
export const TIPOS_RETIRADOS: Readonly<Record<string, string | null>> = {
  renda_nf_recente: "renda_nf_empresa",
  comprovante_clube_tiro: "comprovante_filiacao_entidade_tiro",
  cpf: "rg_com_cpf",
  comprovante_habitualidade: null,
  declaracao_compromisso_habitualidade: null,
};

/**
 * Última barreira antes de gravar em `qa_documentos_cliente`: converte slug
 * aposentado no slug vivo. Um bundle em cache, uma classificação da IA ou uma
 * exigência antiga não podem mais derrubar o INSERT com erro cru de constraint.
 *
 * Slug aposentado SEM sucessor cai em `outro` — o documento entra e um humano
 * reclassifica, que é sempre melhor do que perder o upload do cliente.
 */
export function normalizeTipoDocumentoParaBanco(tipoDocumento: string | null | undefined): string {
  const tipo = normalizeTipoDocumento(tipoDocumento);
  if (!tipo) return "outro";
  if (!(tipo in TIPOS_RETIRADOS)) return tipo;
  return TIPOS_RETIRADOS[tipo] ?? "outro";
}

/**
 * Tipos que podem existir por compatibilidade/auditoria, mas não pertencem ao
 * Hub monitorável do cliente. Contrato assinado é artefato do processo/venda:
 * deve ficar disponível no fluxo de contratos/processos, sem prazo documental.
 */
const TIPOS_NAO_MONITORAVEIS_HUB = new Set<string>([
  "contrato_assinado",
  // Comprovante de pagamento do contrato: recibo de fato passado, pertence ao
  // contrato (não ao processo) e NÃO tem prazo de validade.
  "comprovante_pagamento",
]);

function normalizeTipoDocumento(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function isTipoDocumentoMonitoravelNoHub(tipoDocumento: string | null | undefined): boolean {
  const tipo = normalizeTipoDocumento(tipoDocumento);
  return !!tipo && !TIPOS_NAO_MONITORAVEIS_HUB.has(tipo);
}

const CATEGORIA_BY_TIPO_PREFIX: Array<[RegExp, HubCategoria]> = [
  [/^renda_/, "renda_ocupacao"],
  [/^antecedentes_/, "antecedentes_regularidade"],
  [/^declaracao_/, "declaracoes"],
  [/^laudo_/, "laudos_exames"],
  [/^atestado_(aptidao_psicologica|capacidade_tecnica)/, "laudos_exames"],
];

export function getHubCategoriaMeta(categoria: HubCategoria): HubCategoriaMeta {
  return (
    HUB_CATEGORIAS.find((item) => item.value === categoria) ?? HUB_CATEGORIAS[HUB_CATEGORIAS.length - 1]
  );
}

export function getTipoDocumentoMeta(tipoDocumento: string | null | undefined): HubTipoDocumentoMeta | null {
  const tipo = normalizeTipoDocumento(tipoDocumento);
  if (!tipo) return null;
  return META_BY_TIPO.get(tipo) ?? null;
}

function normalizeDocumentoName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—\-/_.|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Preposições, conjunções e artigos do português que ficam em minúscula
// quando não são a primeira palavra do título.
const PREP_PT = new Set([
  "a", "à", "ao", "aos", "às",
  "com", "contra", "de", "da", "das", "do", "dos",
  "e", "em", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "per", "por",
  "sem", "sob", "sobre", "um", "uma", "uns", "umas",
]);

export function toTitleCasePtBR(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\s—\-\/()]+/g, (word, offset) => {
      // Preserva tokens alfanuméricos (protocolos, códigos como QAPOSSE20260012,
      // CRAF SP-12345, etc.) em UPPERCASE — nunca aplicar title case a códigos.
      const original = value.substr(offset, word.length);
      if (/\d/.test(original) && /[A-Za-z]/.test(original)) {
        return original.toUpperCase();
      }
      if (offset === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (PREP_PT.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

function cleanDocumentoName(value: unknown): string {
  const raw = String(value || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  // Aplica title case apenas quando o nome vier todo em maiúsculas (padrão da IA).
  const upper = raw.replace(/[^a-zA-ZÀ-ú\s]/g, "");
  const isAllCaps = upper.length > 0 && upper === upper.toUpperCase();
  return isAllCaps ? toTitleCasePtBR(raw) : raw;
}

function inferNomeCertidaoOficial(doc: Record<string, unknown>): string | null {
  const tipo = String(doc?.tipo_documento || "").trim().toLowerCase();
  const haystack = normalizeDocumentoName([
    doc?.nome_documento,
    doc?.arquivo_nome,
    doc?.orgao_emissor,
    doc?.numero_documento,
  ].filter(Boolean).join(" "));

  // Certidões de antecedentes — o nome sai SEMPRE de NOME_CANONICO_ANTECEDENTES.
  // Aqui só resolvemos QUAL certidão é, quando o tipo gravado é genérico/legado.
  const CANON = NOME_CANONICO_ANTECEDENTES;

  if (
    tipo === "trf" ||
    tipo === "trf3" ||
    tipo === "certidao_federal_trf" ||
    tipo === "certidao_federal_trf3" ||
    tipo === "antecedentes_federal_trf" ||
    tipo === "antecedentes_federal_trf3"
  ) {
    if (haystack.includes("3 REGIAO") || haystack.includes("3A REGIAO") || haystack.includes("TRF3")) {
      return CANON.antecedentes_federal_trf3_regional;
    }
    return CANON.antecedentes_federal;
  }

  if (tipo === "antecedentes_eleitoral" || haystack.includes("CRIMES ELEITORAIS")) {
    return CANON.antecedentes_eleitoral;
  }

  if (tipo === "antecedentes_estadual") {
    if (haystack.includes("EXECUCOES") || haystack.includes("EXECUCAO") || haystack.includes("1448406")) {
      return CANON.antecedentes_estadual_execucoes;
    }
    if (haystack.includes("DISTRIBUICOES") || haystack.includes("DISTRIBUICAO") || haystack.includes("1448405")) {
      return CANON.antecedentes_estadual_distribuicao;
    }
    return CANON.antecedentes_estadual;
  }
  if (tipo === "antecedentes_estadual_execucoes") {
    return CANON.antecedentes_estadual_execucoes;
  }
  if (tipo === "antecedentes_estadual_distribuicao") {
    return CANON.antecedentes_estadual_distribuicao;
  }

  if (tipo === "antecedentes_federal") {
    if (haystack.includes("JUDICIARIA SP") || haystack.includes("SECAO JUDICIARIA") || haystack.includes("JEF") || haystack.includes("871659")) {
      return CANON.antecedentes_federal_sjsp_jef;
    }
    if (haystack.includes("TRIBUNAL REGIONAL FEDERAL") || haystack.includes("TRF DA 3") || haystack.includes("3A REGIAO") || haystack.includes("3 REGIAO")) {
      return CANON.antecedentes_federal_trf3_regional;
    }
    return CANON.antecedentes_federal;
  }
  if (tipo === "antecedentes_federal_sjsp_jef") {
    return CANON.antecedentes_federal_sjsp_jef;
  }
  if (tipo === "antecedentes_federal_trf3_regional") {
    return CANON.antecedentes_federal_trf3_regional;
  }

  if (tipo === "antecedentes_militar_estadual") {
    return CANON.antecedentes_militar_estadual;
  }

  if (tipo === "antecedentes_militar") {
    // Registros legados: o tipo "antecedentes_militar" já foi usado tanto para
    // o STM quanto para o TJM. O texto do documento desempata; na dúvida vale
    // o slot atual do catálogo, que é o da União (STM).
    if (haystack.includes("TJM") || haystack.includes("JUSTICA MILITAR DO ESTADO DE SAO PAULO") || haystack.includes("22E982")) {
      return CANON.antecedentes_militar_estadual;
    }
    return CANON.antecedentes_militar;
  }

  if (tipo === "antecedentes_criminais") {
    return CANON.antecedentes_criminais;
  }

  // ===== Identificação civil =====
  if (tipo === "rg_com_cpf" || tipo === "rg") {
    return "Cédula de Identidade (RG) com CPF";
  }
  if (tipo === "cin") {
    return "Carteira de Identidade Nacional (CIN)";
  }
  if (tipo === "cnh") {
    return "Carteira Nacional de Habilitação (CNH)";
  }
  if (tipo === "cpf") {
    return "Cadastro de Pessoas Físicas (CPF)";
  }

  // ===== Comprovante de residência =====
  if (tipo === "comprovante_residencia") {
    if (haystack.includes("ENERGIA") || haystack.includes("ELETROPAULO") || haystack.includes("ENEL") || haystack.includes("CPFL") || haystack.includes("LIGHT") || haystack.includes("ELETRICA")) {
      return "Comprovante de Residência — Conta de Energia Elétrica";
    }
    if (haystack.includes("SABESP") || haystack.includes("AGUA") || haystack.includes("SANEAMENTO")) {
      return "Comprovante de Residência — Conta de Água";
    }
    if (haystack.includes("COMGAS") || haystack.includes("GAS NATURAL") || haystack.includes(" GAS ")) {
      return "Comprovante de Residência — Conta de Gás";
    }
    if (haystack.includes("VIVO") || haystack.includes("CLARO") || haystack.includes("TIM") || haystack.includes("OI ") || haystack.includes("TELEFONE") || haystack.includes("INTERNET") || haystack.includes("BANDA LARGA")) {
      return "Comprovante de Residência — Conta de Telefone/Internet";
    }
    if (haystack.includes("IPTU")) {
      return "Comprovante de Residência — IPTU";
    }
    if (haystack.includes("CONDOMINIO")) {
      return "Comprovante de Residência — Boleto de Condomínio";
    }
    return "Comprovante de Residência";
  }

  // ===== Laudos e exames =====
  if (tipo === "laudo_psicologico") {
    return "Laudo de Avaliação Psicológica para Aquisição/Porte de Arma de Fogo";
  }
  if (tipo === "laudo_capacidade_tecnica") {
    return "Atestado de Capacidade Técnica para Manuseio de Arma de Fogo";
  }

  // ===== Documentos de arma / acervo =====
  if (tipo === "cr") {
    return "CR — Certificado de Registro de Colecionador, Atirador Desportivo e Caçador (Exército)";
  }
  if (tipo === "craf") {
    return "CRAF — Certificado de Registro de Arma de Fogo";
  }
  if (tipo === "sinarm") {
    return "SINARM — Certificado de Registro de Arma de Fogo (Polícia Federal)";
  }
  if (tipo === "gt") {
    return "GT — Guia de Tráfego";
  }
  if (tipo === "gte") {
    return "GTE — Guia de Tráfego Eventual";
  }

  // ===== CAC / habitualidade =====
  if (tipo === "comprovante_filiacao_entidade_tiro" || tipo === "comprovante_clube_tiro") {
    const orgao = String(doc?.orgao_emissor || "").trim();
    if (orgao) return `Declaração de Filiação — ${orgao}`;
    return "Declaração de Filiação a Clube de Tiro";
  }
  if (tipo === "comprovante_habitualidade") {
    return "Comprovante de Habitualidade";
  }
  if (tipo === "comprovante_competicao") {
    return "Comprovante de Competição";
  }

  return null;
}

function shouldReplaceNomeCertidao(nome: string, tipoDocumento: string | null | undefined): boolean {
  const tipo = String(tipoDocumento || "").trim().toLowerCase();
  // Renda / ocupação: o título literal impresso no documento varia por órgão e
  // é ilegível para o cliente ("FÉ PÚBLICA DECRETO 14.298 DE 21/11/79 POLÍCIA
  // MILITAR DO ESTADO DE SÃO PAULO"). Nesses tipos o nome canônico do catálogo
  // sempre prevalece — o cliente precisa reconhecer o que enviou, não decorar o
  // cabeçalho do emissor.
  if (tipo === "renda_carteira_funcional" || tipo.startsWith("renda_holerite")) return true;
  const elegivelInferencia =
    tipo.startsWith("antecedentes_") ||
    tipo === "rg_com_cpf" ||
    tipo === "rg" ||
    tipo === "cin" ||
    tipo === "cnh" ||
    tipo === "cpf" ||
    tipo === "comprovante_residencia" ||
    tipo === "laudo_psicologico" ||
    tipo === "laudo_capacidade_tecnica" ||
    tipo === "cr" ||
    tipo === "craf" ||
    tipo === "sinarm" ||
    tipo === "gt" ||
    tipo === "gte";
  if (!elegivelInferencia) return false;
  const normalized = normalizeDocumentoName(nome);
  const meta = getTipoDocumentoMeta(tipo);
  return (
    !normalized ||
    normalized.includes("QUITACAO ELEITORAL") ||
    normalized.startsWith("ANT ") ||
    normalized.startsWith("ANT.") ||
    normalized === "RG" ||
    normalized === "CIN" ||
    normalized === "CNH" ||
    normalized === "CPF" ||
    normalized === "END" ||
    normalized === "LAUDO PSI" ||
    normalized === "LAUDO TEC" ||
    normalized === "LAUDO PSICOLOGICO" ||
    normalized === "COMPROVANTE DE RESIDENCIA" ||
    normalized === "CR" ||
    normalized === "CR CAC" ||
    normalized === "CRAF" ||
    normalized === "SINARM" ||
    normalized === "GT" ||
    normalized === "GTE" ||
    normalized === normalizeDocumentoName(meta?.label) ||
    normalized === normalizeDocumentoName(meta?.short)
  );
}

export function getNomeDocumentoDisplay(doc: Record<string, unknown> | null | undefined, fallback = "Documento"): string {
  if (!doc) return fallback;
  const tipo = String(doc?.tipo_documento || "").trim().toLowerCase();
  const meta = getTipoDocumentoMeta(tipo);
  const explicit = cleanDocumentoName(doc?.nome_documento);
  const inferred = inferNomeCertidaoOficial(doc);

  // Padronização: para tipos canônicos com nome oficial inferido (Title Case),
  // o nome canônico SEMPRE prevalece sobre o título literal extraído pela IA
  // (que costuma vir em UPPERCASE e com sufixos variáveis como "Nº 0005/2025").
  // Isso garante o mesmo padrão visual em todos os documentos do hub.
  // Tipos com nome canônico obrigatório (renda/ocupação): o rótulo do catálogo
  // sempre vence, inclusive sobre o título inferido do texto do documento.
  if (meta?.label && shouldReplaceNomeCertidao(explicit || inferred || "", tipo)) return meta.label;
  if (inferred) return inferred;
  if (explicit && !shouldReplaceNomeCertidao(explicit, tipo)) return explicit;
  // `short` é a sigla para chips e badges ("CNPJ", "QSA", "END"), nunca o nome
  // do documento. Usá-lo antes do label fazia a lista do cliente exibir "Cnpj",
  // "Qsa" e "Outro" no lugar de "Cartão CNPJ", "QSA — Quadro de Sócios e
  // Administradores" e "Outro documento".
  return inferred || explicit || meta?.label || meta?.short || cleanDocumentoName(doc?.arquivo_nome) || fallback;
}

/**
 * Resgata o código do catálogo a partir do rótulo devolvido pela leitura.
 *
 * O front traduz o rótulo da classificação por um mapa de chaves EXATAS. Rótulo
 * que o mapa não conhece vira "outro documento" — e aí o slot, que pedia
 * justamente aquele documento, reprova o arquivo certo. Foi assim que o
 * requerimento da PF foi recusado mesmo depois de a leitura tê-lo identificado
 * corretamente: o servidor já devolvia
 * "REQUERIMENTO_DE_POSSE_DE_ARMA_DE_FOGO" e a versão do site em uso ainda não
 * tinha essa chave.
 *
 * Rótulo e código são a mesma palavra em caixas diferentes. Comparar assim
 * fecha o buraco para QUALQUER tipo, não só para o que já quebrou.
 */
export function tipoDoCatalogoPorRotulo(rotulo: unknown): string | null {
  const codigo = String(rotulo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return codigo && getTipoDocumentoMeta(codigo) ? codigo : null;
}

export function inferHubCategoriaFromTipo(tipoDocumento: string | null | undefined): HubCategoria {
  const tipo = String(tipoDocumento || "").trim().toLowerCase();
  if (!tipo) return "outros";
  const meta = getTipoDocumentoMeta(tipo);
  if (meta) return meta.categoria;
  if (isDocDeArma(tipo)) return "arma_acervo";
  if (tipo.includes("efetiva_necessidade")) return "efetiva_necessidade";
  if (tipo.includes("procuracao") || tipo.includes("recurso") || tipo.includes("mandado")) return "juridico";
  if (tipo.includes("protocolo") || tipo.includes("indeferimento") || tipo.includes("exigencia")) return "documentos_processo";
  if (tipo.includes("oficio") || tipo.includes("despacho")) return "documentos_processo";
  if (tipo.includes("habitualidade") || tipo.includes("clube") || tipo.includes("competicao")) return "cac_atividade";
  if (
    tipo === "trf" ||
    tipo === "trf3" ||
    tipo.includes("certidao_federal_trf") ||
    tipo.includes("antecedentes_federal_trf")
  ) {
    return "antecedentes_regularidade";
  }
  for (const [pattern, categoria] of CATEGORIA_BY_TIPO_PREFIX) {
    if (pattern.test(tipo)) return categoria;
  }
  return "outros";
}

export function inferEscopoDocumental(input: {
  tipo_documento?: string | null;
  categoria_hub?: HubCategoria | null;
  arma_id?: string | null;
}): EscopoDocumental {
  const categoria = input.categoria_hub ?? inferHubCategoriaFromTipo(input.tipo_documento);
  if (input.arma_id && String(input.arma_id).trim()) return "arma";
  const meta = getTipoDocumentoMeta(String(input.tipo_documento || "").toLowerCase());
  if (meta) return meta.escopo;
  return getHubCategoriaMeta(categoria).escopoPadrao;
}

export function listTiposByCategoria(categoria: HubCategoria): HubTipoDocumentoMeta[] {
  return HUB_TIPOS_DOCUMENTO.filter(
    (item) =>
      item.categoria === categoria &&
      !TIPOS_LEGADOS_OCULTOS.has(item.value) &&
      isTipoDocumentoMonitoravelNoHub(item.value),
  );
}

export function isCategoriaArmaAcervo(categoria: HubCategoria | null | undefined): boolean {
  return categoria === "arma_acervo";
}

export function isCategoriaPermanente(categoria: HubCategoria | null | undefined): boolean {
  return (
    categoria === "identificacao" ||
    categoria === "endereco" ||
    categoria === "renda_ocupacao" ||
    categoria === "antecedentes_regularidade" ||
    categoria === "declaracoes" ||
    categoria === "laudos_exames"
  );
}
