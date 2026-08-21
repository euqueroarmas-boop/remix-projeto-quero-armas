/**
 * Avisos de vencimento — fonte única dos textos da badge "PRÓXIMO VENCIMENTO"
 * da home do cliente e das janelas de alerta por tipo de documento.
 *
 * REGRAS DE NEGÓCIO CANÔNICAS (não alterar sem decisão de produto):
 *
 * 1) CR — o pedido de renovação precisa estar PROTOCOLADO até 90 dias antes do
 *    vencimento. Passado esse marco, o caso deixa de ser renovação e vira NOVA
 *    CONCESSÃO; a partir do vencimento o CR é bloqueado no sistema da PF e o
 *    CRAF de todas as armas fica suspenso. Por isso a janela abre em 180 dias.
 *
 * 2) LAUDOS (psicológico e capacidade técnica) — valem ATÉ o último dia. O
 *    processo não trava se o protocolo acontecer dentro da validade; só trava
 *    se for protocolado depois de vencido. Monitoramento começa em 120 dias.
 *
 * 3) Tipos SEM prazo de validade (ex.: nota fiscal recente) não entram no motor
 *    de alerta — continuam normalmente no Hub Documental e no checklist.
 *
 * 4) DOCUMENTOS DE CICLO CURTO (antecedentes de 30 dias e comprovante de
 *    endereço) — a janela padrão de 30 dias fazia o alerta nascer junto com o
 *    documento: recém-emitido já entrava em "PRÓXIMO VENCIMENTO". Eles abrem a
 *    janela em 9 dias, o mesmo dia em que a faixa vira amarela
 *    (`inicioAlertaDias` em validadeDocumento.ts).
 */

import { inicioAlertaDias, isVencimentoCicloCurto } from "./validadeDocumento";

export const JANELA_ALERTA_PADRAO_DIAS = 30;
export const JANELA_ALERTA_CR_DIAS = 180;
export const JANELA_ALERTA_LAUDO_DIAS = 120;

/** Antecedência mínima, em dias, para protocolar a renovação do CR. */
export const CR_PRAZO_FATAL_PROTOCOLO_DIAS = 90;

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export const TIPOS_LAUDO = new Set(["laudo_psicologico", "laudo_capacidade_tecnica"]);

/** Tipos que nunca geram alerta de vencimento na badge. */
export const TIPOS_SEM_ALERTA_VENCIMENTO = new Set([
  "renda_nf_empresa",
  // Slug aposentado: registro antigo do Hub ainda o carrega.
  "renda_nf_recente",
  "nota_fiscal_arma",
]);

export function tipoGeraAlertaVencimento(tipo?: string | null): boolean {
  return !TIPOS_SEM_ALERTA_VENCIMENTO.has(norm(tipo));
}

/** Janela (em dias) a partir da qual o item começa a alertar na badge. */
export function janelaAlertaDias(tipo?: string | null): number {
  const t = norm(tipo);
  if (t === "cr") return JANELA_ALERTA_CR_DIAS;
  if (TIPOS_LAUDO.has(t)) return JANELA_ALERTA_LAUDO_DIAS;
  // Ciclo curto (30 dias): alerta só quando a faixa vira amarela — 9 dias.
  if (isVencimentoCicloCurto(t)) return inicioAlertaDias(t);
  return JANELA_ALERTA_PADRAO_DIAS;
}

const LAUDO_NOTA_ULTIMO_DIA =
  "Vale até o último dia. Protocolado dentro da validade, o processo segue normalmente — depois de vencido, trava.";

/** Texto explicativo por tipo de documento (só aparece na badge da home). */
export const AVISO_POR_TIPO: Record<string, string> = {
  // ── Arsenal ──────────────────────────────────────────────────────────────
  craf:
    "O CRAF é o documento da arma. Vencido, o porte/transporte dela é irregular. Não saia para treinar neste momento e não porte sua arma, mesmo que você tenha permissão para isso.",
  sinarm:
    "Registro da arma na Polícia Federal. Sem ele vigente, a arma fica irregular.",
  gt: "Sem guia válida você não pode transportar a arma.",
  gte:
    "Guia de Tráfego Especial vencida bloqueia o transporte da arma para treino, caça ou competição.",
  autorizacao_compra:
    "A autorização de compra tem prazo. Vencida, é preciso pedir nova à autoridade que a emitiu e passar novamente por todo o processo.",

  // ── Filiação e atividade CAC (textos pendentes de revisão de produto) ────
  comprovante_habitualidade: "A habitualidade precisa estar atualizada para manter seu CR.",
  comprovante_clube_tiro: "Comprovante do clube desatualizado trava a análise na PF/Exército.",
  comprovante_filiacao_entidade_tiro: "Filiação vigente é exigida para manter o CAC ativo.",
  comprovante_competicao: "Comprovante de atividade fora do prazo não é aceito na renovação.",
  habilitacao_cacador_ibama: "Habilitação ambiental vencida impede o exercício da caça.",

  // ── Renda / ocupação ─────────────────────────────────────────────────────
  renda_holerite_mes_atual: "A PF aceita contracheque do mês corrente. O seu está saindo da validade.",
  renda_holerite_funcionario_publico:
    "A PF aceita contracheque do mês corrente. O seu está saindo da validade.",
  renda_comprovante_beneficio: "O comprovante de benefício precisa ser do mês corrente.",
  renda_extrato_inss: "Extrato do INSS fora do mês corrente não é aceito como comprovação.",

  // ── Certidões (nomenclatura canônica) ────────────────────────────────────
  antecedentes_criminais:
    "Certidão de antecedentes criminais fora da validade. Emita a nova no site da Polícia Civil.",
  // ── Certidões TERRITORIAIS: o tribunal muda com o estado do cliente ──────
  //
  // Estes textos nasceram com São Paulo cravado, quando SP era o único estado
  // atendido. Depois que o checklist passou a nomear a certidão pelo tribunal
  // do cliente (migration 20260821040000), o cliente do Paraná lia "TJPR" no
  // item e "emita no portal do TJSP" no aviso de vencimento — duas instruções
  // diferentes para o mesmo papel.
  //
  // A frase base é NEUTRA, portanto certa em qualquer estado, inclusive nos
  // caminhos que não sabem a UF (e-mail, painel sem cadastro carregado). Onde
  // a UF é conhecida, `aplicarUfEmTexto` troca a forma neutra pelo tribunal
  // com nome e sobrenome ("no portal do TJPR").
  antecedentes_estadual_distribuicao:
    "Certidão de distribuição de ações criminais fora da validade. Emita a nova no portal do Tribunal de Justiça do seu estado.",
  antecedentes_estadual_execucoes:
    "Certidão de execuções criminais fora da validade. Emita a nova no portal do Tribunal de Justiça do seu estado.",
  antecedentes_militar_estadual:
    "Certidão da Justiça Militar Estadual fora da validade. Emita a nova no portal do TJM.",
  antecedentes_federal_trf3_regional:
    "Certidão da Justiça Federal, abrangência regional, fora da validade. Emita a nova no portal do TRF da sua região.",
  antecedentes_federal_sjsp_jef:
    "Certidão da Seção Judiciária/JEF do seu estado fora da validade. Emita a nova no portal do TRF da sua região.",
  antecedentes_militar:
    "Certidão da Justiça Militar da União fora da validade. Emita a nova no portal do STM.",
  antecedentes_eleitoral:
    "Certidão de crimes eleitorais fora da validade. Emita a nova no portal do TSE.",

  // ── Laudos ───────────────────────────────────────────────────────────────
  laudo_psicologico:
    `Laudo psicológico com prazo curto. Acelere a entrega de seus documentos ou, decida-se agora se irá comprar outro armamento ou não pois irá vencer e você terá que refazê-lo. ${LAUDO_NOTA_ULTIMO_DIA}`,
  laudo_capacidade_tecnica:
    `Laudo de capacidade técnica / tiro com prazo curto. Acelere a entrega de seus documentos ou, decida-se agora se irá comprar outro armamento ou não pois irá vencer e você terá que refazê-lo. ${LAUDO_NOTA_ULTIMO_DIA}`,

  // ── Jurídico ─────────────────────────────────────────────────────────────
  procuracao:
    "Procuração com prazo perto do fim. Sem ela válida não podemos atuar no seu processo.",
  procuracao_assinada:
    "Procuração com prazo perto do fim. Sem ela válida não podemos atuar no seu processo.",
};

export const AVISO_GENERICO_DOCUMENTO = "Certidão ou regularidade próxima do vencimento";
export const AVISO_DOC_PROCESSO_SEM_HUB = "Documento entregue no processo com prazo perto do fim.";
export const AVISO_PRAZO_PROCESSUAL = "Prazo processual crítico · ação imediata na PF.";

/**
 * Aviso do documento. Passando `dias`, a frase respeita o estado real: os
 * textos das certidões afirmam "fora da validade", o que era exibido junto de
 * "30 DIAS RESTANTES" — o cartão dizia que o documento venceu e que faltavam
 * 30 dias ao mesmo tempo. Só quem já venceu (dias < 0) recebe a afirmação; o
 * resto vira "vence em N dias", preservando a instrução de onde emitir.
 */
export function avisoParaTipo(
  tipo?: string | null,
  fallback = AVISO_GENERICO_DOCUMENTO,
  dias?: number | null,
): string {
  const base = AVISO_POR_TIPO[norm(tipo)] ?? fallback;
  if (typeof dias !== "number" || Number.isNaN(dias) || dias < 0) return base;
  const prazo = dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return base.replace(/\bfora da validade\b/i, prazo);
}

// ─────────────────────────────────────────────────────────────────────────────
// CR — copy em três estágios
// ─────────────────────────────────────────────────────────────────────────────

function dataBR(iso: unknown): string | null {
  const m = String(iso ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function addDiasISO(iso: string, dias: number): string | null {
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Data-limite para protocolar a renovação do CR (vencimento − 90 dias). */
export function crDataLimiteProtocolo(validadeCr?: string | null): string | null {
  if (!validadeCr) return null;
  return addDiasISO(validadeCr, -CR_PRAZO_FATAL_PROTOCOLO_DIAS);
}

export type EstagioCR = "comece_agora" | "ultima_janela" | "janela_perdida";

export function estagioCR(dias: number): EstagioCR {
  if (dias > 120) return "comece_agora";
  if (dias > CR_PRAZO_FATAL_PROTOCOLO_DIAS) return "ultima_janela";
  return "janela_perdida";
}

export const CR_LINHA_APOIO =
  "CR vence em dezembro? Documentos em junho, protocolo até setembro. Em 1º de outubro, o CR já está bloqueado.";

export function kickerCR(dias: number): string {
  const e = estagioCR(dias);
  if (e === "comece_agora") return "RENOVAÇÃO DO CR · COMECE AGORA";
  if (e === "ultima_janela") return "RENOVAÇÃO DO CR · ÚLTIMA JANELA";
  return "CR · JANELA PERDIDA · RISCO DE BLOQUEIO";
}

/** Texto completo da badge para o CR, já com datas e contagens resolvidas. */
export function avisoCR(dias: number, validadeCr?: string | null): string {
  const limiteISO = crDataLimiteProtocolo(validadeCr);
  const limite = dataBR(limiteISO) ?? "a data-limite";
  const venc = dataBR(validadeCr) ?? "o vencimento";
  const e = estagioCR(dias);

  if (e === "comece_agora") {
    return `Seu CR vence em ${dias} dias. A renovação precisa estar PROTOCOLADA até 90 dias antes do vencimento — ou seja, você tem até ${limite} para dar entrada. Comece a reunir os documentos hoje: certidões e laudos levam semanas para ficar prontos. ${CR_LINHA_APOIO}`;
  }
  if (e === "ultima_janela") {
    const restam = Math.max(0, dias - CR_PRAZO_FATAL_PROTOCOLO_DIAS);
    return `Faltam ${dias} dias para o seu CR vencer e só restam ${restam} ${restam === 1 ? "dia" : "dias"} para protocolar a renovação. Depois de ${limite}, seu caso deixa de ser renovação e vira uma NOVA CONCESSÃO — processo do zero, do começo ao fim. ${CR_LINHA_APOIO}`;
  }
  return `A janela de renovação do seu CR fechou em ${limite}. A partir do vencimento (${venc}), o CR é bloqueado no sistema da Polícia Federal e o CRAF de TODAS as suas armas fica suspenso. Fale com a gente hoje para definir o caminho: nova concessão ou regularização. ${CR_LINHA_APOIO}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcos de e-mail
// ─────────────────────────────────────────────────────────────────────────────

/** Certidões de 90 dias: 15, 10 e depois contagem regressiva diária. */
export const MARCOS_EMAIL_CERTIDAO = [15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

/**
 * Certidões de CICLO CURTO (30 dias): o primeiro e-mail sai no mesmo dia em que
 * a faixa vira amarela. Marcos em 15/10 avisariam com o documento ainda verde.
 */
export const MARCOS_EMAIL_CERTIDAO_CICLO_CURTO = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

/** Laudos: 120/90/60/45/30/20/10 e regressiva diária até o último dia. */
export const MARCOS_EMAIL_LAUDO = [120, 90, 60, 45, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

export function marcosEmailParaTipo(tipo?: string | null): readonly number[] | null {
  const t = norm(tipo);
  if (TIPOS_LAUDO.has(t)) return MARCOS_EMAIL_LAUDO;
  if (t.startsWith("antecedentes_")) {
    return isVencimentoCicloCurto(t) ? MARCOS_EMAIL_CERTIDAO_CICLO_CURTO : MARCOS_EMAIL_CERTIDAO;
  }
  return null;
}

/** Retorna o marco exato atingido hoje, ou null se não é dia de aviso. */
export function marcoAtingido(tipo: string | null | undefined, dias: number): number | null {
  const marcos = marcosEmailParaTipo(tipo);
  if (!marcos) return null;
  return marcos.includes(dias) ? dias : null;
}
