// ============================================================================
// exigenciasPFTipos — o cardápio fechado que a IA pode pedir ao cliente
// ----------------------------------------------------------------------------
// Quando a Polícia Federal notifica ou indefere, a IA lê o texto do delegado e
// diz o que ainda falta. O que ela NÃO pode fazer é inventar um tipo de
// documento: o Hub tem vocabulário fechado (CHECK em `qa_documentos_cliente`),
// e um tipo fora dele faz o upload do cliente morrer com erro de constraint na
// cara dele — exatamente o acidente de 14/08/2026 com a nota fiscal.
//
// Por isso a IA escolhe de uma LISTA, não escreve texto livre. O teste
// `exigenciasPFTipos.test.ts` compara esta lista com o CHECK do banco e falha
// se as duas divergirem, do mesmo jeito que o catálogo do Hub já é protegido.
//
// A lista é curada, não é o catálogo inteiro: só o que a PF de fato costuma
// exigir depois de protocolado. Oferecer 106 opções ao modelo aumenta a chance
// de ele escolher a errada, e um contrato social pedido no lugar de um boletim
// de ocorrência custa 10 dias do cliente.
//
// `documento_complementar_caso` é o ESCAPE. Quando o delegado pede algo que não
// tem tipo próprio ("junte o print da conversa", "traga a ata da assembleia"),
// é para aí que vai — com o título escrito pela IA. Sem escape, o modelo seria
// empurrado a forçar um tipo parecido, e aí o documento entra classificado
// errado no dossiê.
//
// MIRROR: src/lib/quero-armas/exigenciasPFTipos.ts — Deno e Vite não
// compartilham módulo. As duas cópias precisam continuar idênticas.
// ============================================================================

export interface TipoExigenciaPF {
  tipo: string;
  /** Como o cliente vê o passo. */
  rotulo: string;
  /** Ajuda o modelo a escolher — é isto que vai no prompt. */
  quando: string;
}

export const TIPOS_EXIGENCIA_PF: TipoExigenciaPF[] = [
  // ── Prova do fato que justifica o pedido ─────────────────────────────────
  { tipo: "boletim_ocorrencia", rotulo: "Boletim de ocorrência", quando: "a PF quer prova do fato concreto (ameaça, roubo, invasão) que motivou o pedido" },
  { tipo: "comprovante_efetiva_necessidade", rotulo: "Prova da efetiva necessidade", quando: "a PF diz que a justificativa é genérica e pede prova concreta do risco" },
  { tipo: "declaracao_sem_inquerito_processo_criminal", rotulo: "Declaração de que não responde a inquérito ou processo", quando: "a PF aponta dúvida sobre processo criminal em andamento" },

  // ── Idoneidade ───────────────────────────────────────────────────────────
  { tipo: "antecedentes_criminais", rotulo: "Certidão de antecedentes criminais", quando: "a PF pede certidão criminal atualizada" },
  { tipo: "antecedentes_federal", rotulo: "Certidão da Justiça Federal", quando: "a PF pede certidão da Justiça Federal" },
  { tipo: "antecedentes_estadual", rotulo: "Certidão da Justiça Estadual", quando: "a PF pede certidão da Justiça Estadual / distribuição" },
  { tipo: "antecedentes_eleitoral", rotulo: "Certidão de crimes eleitorais", quando: "a PF pede certidão eleitoral" },
  { tipo: "antecedentes_militar", rotulo: "Certidão da Justiça Militar", quando: "a PF pede certidão militar" },
  { tipo: "declaracao_homonimia", rotulo: "Declaração de homonímia", quando: "apareceu registro de outra pessoa com o mesmo nome" },
  { tipo: "certidao_alteracao_nome", rotulo: "Certidão de alteração de nome", quando: "o nome no cadastro difere do nome nas certidões" },

  // ── Endereço e guarda do acervo ──────────────────────────────────────────
  { tipo: "comprovante_residencia", rotulo: "Comprovante de residência", quando: "a PF questiona o endereço ou pede comprovante recente" },
  { tipo: "declaracao_responsavel_imovel", rotulo: "Declaração do responsável pelo imóvel", quando: "o imóvel não está no nome do requerente" },
  { tipo: "declaracao_endereco_acervo", rotulo: "Declaração do endereço do acervo", quando: "a PF quer saber onde as armas ficarão guardadas" },
  { tipo: "declaracao_guarda_responsavel", rotulo: "Declaração de guarda responsável", quando: "a PF questiona as condições de guarda, cofre ou moradores da casa" },
  { tipo: "dsa_declaracao_seguranca_acervo", rotulo: "Declaração de segurança do acervo (DSA)", quando: "a PF exige a DSA" },

  // ── Ocupação lícita ──────────────────────────────────────────────────────
  { tipo: "renda_holerite_mes_atual", rotulo: "Holerite do mês atual", quando: "a PF pede prova de renda de quem é empregado" },
  { tipo: "renda_contrato_social", rotulo: "Contrato social da empresa", quando: "a PF pede prova de ocupação de sócio ou administrador" },
  { tipo: "renda_cartao_cnpj", rotulo: "Cartão CNPJ", quando: "a PF pede comprovação da empresa" },
  { tipo: "renda_comprovante_beneficio", rotulo: "Comprovante de benefício", quando: "a PF pede prova de renda de aposentado ou pensionista" },
  { tipo: "renda_extrato_inss", rotulo: "Extrato do INSS (CNIS)", quando: "a PF pede o histórico de vínculos" },

  // ── Identificação ────────────────────────────────────────────────────────
  { tipo: "cin", rotulo: "Documento de identidade", quando: "a PF pede cópia legível do documento de identificação" },
  { tipo: "foto_3x4", rotulo: "Foto 3x4", quando: "a PF pede fotografia atualizada" },

  // ── Capacidade técnica e psicológica ─────────────────────────────────────
  { tipo: "laudo_psicologico", rotulo: "Laudo de aptidão psicológica", quando: "a PF questiona ou pede novo laudo psicológico" },
  { tipo: "laudo_capacidade_tecnica", rotulo: "Laudo de capacidade técnica", quando: "a PF questiona ou pede novo laudo de manuseio" },

  // ── Acervo e atividade ───────────────────────────────────────────────────
  { tipo: "craf", rotulo: "CRAF da arma", quando: "a PF pede o registro de arma já existente" },
  { tipo: "comprovante_filiacao_entidade_tiro", rotulo: "Comprovante de filiação ao clube", quando: "a PF pede vínculo com entidade de tiro" },
  { tipo: "comprovante_competicao", rotulo: "Comprovante de atividade ou competição", quando: "a PF pede prova de habitualidade" },

  // ── Taxa ─────────────────────────────────────────────────────────────────
  { tipo: "gru_comprovante", rotulo: "Comprovante de pagamento da taxa", quando: "a PF não localizou o pagamento da GRU" },

  // ── ESCAPE — sempre por último ───────────────────────────────────────────
  {
    tipo: "documento_complementar_caso",
    rotulo: "Documento complementar do caso",
    quando:
      "USE ESTE quando o que a PF pediu não se encaixa em nenhum tipo acima. Escreva no título exatamente o que ela pediu",
  },
];

export const TIPO_EXIGENCIA_FALLBACK = "documento_complementar_caso";

const VALIDOS = new Set(TIPOS_EXIGENCIA_PF.map((t) => t.tipo));

/** Devolve o tipo se ele existir no cardápio; senão, o escape. */
export function normalizarTipoExigenciaPF(tipo: string | null | undefined): string {
  const t = String(tipo ?? "").trim().toLowerCase();
  return VALIDOS.has(t) ? t : TIPO_EXIGENCIA_FALLBACK;
}

export function rotuloTipoExigenciaPF(tipo: string | null | undefined): string {
  const t = String(tipo ?? "").trim().toLowerCase();
  return TIPOS_EXIGENCIA_PF.find((x) => x.tipo === t)?.rotulo ?? "Documento complementar do caso";
}

/** Cardápio em texto, do jeito que entra no prompt do modelo. */
export function cardapioParaPrompt(): string {
  return TIPOS_EXIGENCIA_PF.map((t) => `- ${t.tipo}: ${t.rotulo}. Use quando ${t.quando}.`).join("\n");
}
