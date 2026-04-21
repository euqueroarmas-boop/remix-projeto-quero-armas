/* =============================================================================
 * Quero Armas — Catálogo de qualificação comercial
 *
 * Estrutura usada na ETAPA 0 do cadastro público:
 *   1) Objetivo principal (motivação comercial)
 *   2) Categoria (técnica)
 *   3) Serviço (operacional)
 *   4) Subtipo (somente quando aplicável)
 *
 * Mantenha esta lista como única fonte de verdade — o admin lê os mesmos rótulos.
 * ============================================================================= */

export const OBJETIVOS_PRINCIPAIS: { value: string; label: string }[] = [
  { value: "atividade_profissional", label: "Atividade profissional / controlada" },
  { value: "caca", label: "Caça" },
  { value: "clube_tiro", label: "Clube de tiro" },
  { value: "colecionamento", label: "Colecionamento" },
  { value: "defesa_pessoal", label: "Defesa pessoal" },
  { value: "loja_armas", label: "Loja de armas" },
  { value: "orientacao", label: "Preciso de orientação" },
  { value: "regularizacao", label: "Regularização documental" },
  { value: "tiro_esportivo", label: "Tiro esportivo" },
];

export interface ServicoOpcao {
  value: string;
  label: string;
  subtipos?: string[];
  /** Quando true, pede um campo de texto livre obrigatório. */
  livre?: boolean;
}

export interface CategoriaOpcao {
  value: string;
  label: string;
  servicos: ServicoOpcao[];
}

const SUBTIPOS_CAC = [
  "Atirador desportivo",
  "Caçador",
  "Colecionador",
  "Atirador desportivo + caçador",
  "Atirador desportivo + colecionador",
  "Caçador + colecionador",
  "Atirador desportivo + caçador + colecionador",
];

const SUBTIPOS_ACERVO = ["Atirador desportivo", "Caçador", "Colecionador"];

export const CATEGORIAS_SERVICO: CategoriaOpcao[] = [
  {
    value: "sinarm_pf",
    label: "SINARM / Polícia Federal",
    servicos: [
      { value: "ameaca_grave_ameaca", label: "Ameaça / grave ameaça" },
      { value: "aquisicao_posse", label: "Aquisição / Posse de arma de fogo" },
      { value: "atividade_de_risco", label: "Atividade de risco" },
      { value: "emissao_craf", label: "Emissão de CRAF" },
      { value: "guia_transito", label: "Guia de trânsito" },
      { value: "magistrado_mpf", label: "Magistrado / MPF" },
      { value: "porte_arma", label: "Porte de arma de fogo" },
      { value: "renovacao_porte", label: "Renovação de porte" },
      { value: "renovacao_registro", label: "Renovação de registro" },
      { value: "seguranca_publica", label: "Segurança pública" },
      { value: "segunda_via_craf", label: "Segunda via de CRAF" },
      { value: "transferencia_propriedade", label: "Transferência de propriedade" },
    ],
  },
  {
    value: "sinarm_cac_cr",
    label: "SINARM CAC / CR",
    servicos: [
      { value: "concessao_cr", label: "Concessão de CR" },
      { value: "renovacao_cr", label: "Renovação de CR" },
      { value: "inclusao_atividade_cr", label: "Inclusão de atividade no CR", subtipos: SUBTIPOS_CAC },
      { value: "remocao_atividade_cr", label: "Remoção de atividade do CR", subtipos: SUBTIPOS_CAC },
      {
        value: "apostilamento_recarga",
        label: "Apostilamento de máquina de recarga",
        subtipos: ["Inclusão", "Exclusão", "Atualização cadastral", "Regularização documental"],
      },
      {
        value: "atualizacao_cr",
        label: "Atualização cadastral do CR",
        subtipos: ["Endereço", "Dados pessoais", "Dados documentais", "Contato", "Outros dados cadastrais"],
      },
      {
        value: "regularizacao_cr",
        label: "Regularização cadastral do CR",
        subtipos: ["Pendência documental", "Correção de cadastro", "Ajuste de dados do processo", "Regularização geral"],
      },
      { value: "aquisicao_acervo", label: "Aquisição de arma para acervo CAC", subtipos: SUBTIPOS_ACERVO },
      { value: "inclusao_arma_acervo", label: "Inclusão de arma no acervo", subtipos: SUBTIPOS_ACERVO },
      { value: "transferencia_arma_acervo", label: "Transferência de arma no acervo", subtipos: SUBTIPOS_ACERVO },
      { value: "guia_trafego", label: "Guia de tráfego", subtipos: SUBTIPOS_ACERVO },
    ],
  },
  {
    value: "empresarial",
    label: "Empresarial / Institucional",
    servicos: [
      { value: "assessoria_loja", label: "Assessoria para loja de armas" },
      { value: "assessoria_clube", label: "Assessoria para clube de tiro" },
      {
        value: "assessoria_profissional",
        label: "Assessoria para profissionais e atividades controladas",
        subtipos: [
          "Instrutor de armamento",
          "Armeiro",
          "Colecionador",
          "Caçador",
          "Atirador desportivo",
          "Empresa com atividade controlada",
          "Consultoria regulatória",
        ],
      },
    ],
  },
  {
    value: "atendimento_especial",
    label: "Atendimento especial",
    servicos: [
      {
        value: "atendimento_emergencial",
        label: "Atendimento emergencial",
        subtipos: ["Prazo urgente", "Exigência urgente", "Recurso urgente", "Regularização urgente"],
      },
      {
        value: "caso_complexo",
        label: "Caso complexo",
        subtipos: ["Indeferimento anterior", "Histórico sensível", "Múltiplos processos", "Necessidade de análise manual"],
      },
      { value: "servico_nao_listado", label: "Serviço não listado", livre: true },
    ],
  },
];

/** Lookup helpers */
export function findCategoria(value: string | null | undefined): CategoriaOpcao | undefined {
  if (!value) return undefined;
  return CATEGORIAS_SERVICO.find((c) => c.value === value);
}

export function findServico(catValue: string | null | undefined, svcValue: string | null | undefined): ServicoOpcao | undefined {
  const cat = findCategoria(catValue);
  if (!cat || !svcValue) return undefined;
  return cat.servicos.find((s) => s.value === svcValue);
}

export function objetivoLabel(value: string | null | undefined): string {
  if (!value) return "";
  return OBJETIVOS_PRINCIPAIS.find((o) => o.value === value)?.label || value;
}

export function categoriaLabel(value: string | null | undefined): string {
  if (!value) return "";
  return findCategoria(value)?.label || value;
}

export function servicoLabel(catValue: string | null | undefined, svcValue: string | null | undefined): string {
  if (!svcValue) return "";
  return findServico(catValue, svcValue)?.label || svcValue;
}