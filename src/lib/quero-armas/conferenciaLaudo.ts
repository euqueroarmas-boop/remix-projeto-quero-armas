/* =============================================================================
 * Conferência dos laudos — psicológico e capacidade técnica (tiro)
 *
 * Regras do usuário (01/08/2026), todas com o mesmo motivo: é assim que a
 * Polícia Federal analisa, e errar aqui custa o indeferimento do cliente.
 *
 *  1. VALIDADE conta da DATA DE REALIZAÇÃO do exame, nunca da assinatura.
 *     Psicólogo que examina hoje e assina daqui uma semana já queimou uma
 *     semana da validade. O ônus é do cliente, não nosso — mas avisar cedo é.
 *
 *  2. ORDEM É LEI: o psicológico precede o tiro. Se o psicológico vigente for
 *     POSTERIOR ao tiro, a PF indefere — parece que o candidato atirou antes
 *     de ser considerado apto.
 *
 *  3. CREDENCIADO tem de existir no cadastro da PF. Quando não encontramos,
 *     o cliente AVANÇA e quem é avisado é a equipe. Nunca alarmar o cliente
 *     por uma dúvida nossa (regra explícita do usuário).
 *
 * Os laudos chegam como digitalização, então os campos vêm da leitura por IA.
 * Este módulo NÃO lê documento — recebe campos já extraídos e decide.
 * ============================================================================= */

export type TipoLaudo = "psicologico" | "tiro";

export type VeredictoLaudo =
  /** Confere e está no prazo. */
  | "aprovado"
  /** O documento está errado, vencido ou fora de ordem. O cliente resolve. */
  | "rejeitado"
  /** Falta dado NOSSO para decidir (o outro laudo, o cadastro). Não é culpa dele. */
  | "aguardando_contraparte"
  /** Passa, mas a equipe precisa olhar. O cliente não é alarmado. */
  | "aprovado_com_alerta_interno";

export interface CamposLaudo {
  tipo: TipoLaudo;
  /** Data em que o exame FOI REALIZADO (YYYY-MM-DD). É a que vale. */
  data_realizacao?: string | null;
  /** Data de assinatura/emissão, quando diferente. Só para exibir a diferença. */
  data_emissao?: string | null;
  nome_avaliado?: string | null;
  cpf_avaliado?: string | null;
  resultado?: string | null;
  /** Psicológico: CRP. Tiro: portaria de credenciamento. */
  credencial?: string | null;
  credenciado_nome?: string | null;
  /**
   * Só no tiro. Vêm manuscritos e podem não ter sido lidos — `null` significa
   * "não deu para ler", e nesse caso a pergunta vai para o cliente, que sabe
   * a própria nota. NÃO confundir com zero.
   */
  nota_teorica?: number | null;
  pontuacao_5m?: number | null;
  pontuacao_7m?: number | null;
}

export interface CadastroLaudo {
  nome_completo?: string | null;
  cpf?: string | null;
}

export interface ContextoLaudo {
  /** Data de realização do OUTRO laudo, quando já entregue (YYYY-MM-DD). */
  outroLaudoRealizacao?: string | null;
  /**
   * Resultado da busca do credenciado no cadastro da PF.
   *  - "encontrado"     → confere
   *  - "nao_encontrado" → avança, mas avisa a equipe
   *  - "nao_consultado" → ainda não olhamos; não é motivo para nada
   */
  credenciado?: "encontrado" | "nao_encontrado" | "nao_consultado";
}

export interface AchadoLaudo {
  campo: string;
  label: string;
  mensagem: string;
  /** `true` quando o achado deve ir para a equipe e NÃO para o cliente. */
  interno?: boolean;
}

export interface ResultadoLaudo {
  veredicto: VeredictoLaudo;
  achados: AchadoLaudo[];
  /** Texto para o cliente. Vazio quando não há nada que ELE deva resolver. */
  mensagemCliente: string;
  /** Texto para o painel da equipe. */
  mensagemEquipe: string;
  /** Vencimento calculado da realização + 1 ano. */
  vence_em?: string;
  /** Dias restantes na data de referência. Negativo = vencido. */
  dias_restantes?: number;
}

/** Validade legal do laudo, em dias. Um ano contado da realização. */
export const VALIDADE_LAUDO_DIAS = 365;

/**
 * Nota mínima legal, tanto na prova teórica quanto em cada distância do alvo
 * (5 m e 7 m). Regra do usuário (01/08/2026): está na lei, e abaixo disso é
 * reprovação.
 */
export const NOTA_MINIMA_LEGAL = 60;

const LABEL: Record<TipoLaudo, string> = {
  psicologico: "laudo psicológico",
  tiro: "teste de capacidade técnica",
};

function diaISO(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // Aceita ISO e DD/MM/AAAA — a IA devolve nos dois formatos conforme o
  // documento, e normalizar aqui evita espalhar parsing pelo resto do código.
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diffDias(de: string, ate: string): number {
  const a = new Date(`${de}T00:00:00Z`).getTime();
  const b = new Date(`${ate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function soDigitos(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizarNome(v: string | null | undefined): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vencimento do laudo: um ano da REALIZAÇÃO.
 *
 * Exposto à parte porque a tela também precisa exibir "vence em X dias" sem
 * rodar a conferência inteira.
 */
export function validadeLaudo(
  dataRealizacao: string | null | undefined,
  hoje: string = new Date().toISOString().slice(0, 10),
): { vence_em: string; dias_restantes: number } | null {
  const real = diaISO(dataRealizacao);
  if (!real) return null;
  const vence = somarDias(real, VALIDADE_LAUDO_DIAS);
  return { vence_em: vence, dias_restantes: diffDias(hoje, vence) };
}

/**
 * A ordem foi respeitada?
 *
 * `true` quando o psicológico é anterior OU do mesmo dia do tiro. Mesmo dia
 * passa: a PF aceita os dois exames na mesma data, e é comum o cliente
 * resolver tudo num dia só.
 */
export function ordemLaudosOk(
  psicoRealizacao: string | null | undefined,
  tiroRealizacao: string | null | undefined,
): boolean | null {
  const p = diaISO(psicoRealizacao);
  const t = diaISO(tiroRealizacao);
  if (!p || !t) return null; // falta um dos dois: não dá para afirmar nada
  return diffDias(p, t) >= 0;
}

/**
 * Confere um laudo recém-recebido.
 *
 * Devolve o veredicto E as duas mensagens — a do cliente e a da equipe —
 * porque há achados que só a equipe pode ver.
 */
export function conferirLaudo(
  campos: CamposLaudo,
  cadastro: CadastroLaudo,
  contexto: ContextoLaudo = {},
  hoje: string = new Date().toISOString().slice(0, 10),
): ResultadoLaudo {
  const achados: AchadoLaudo[] = [];
  const label = LABEL[campos.tipo];
  const realizacao = diaISO(campos.data_realizacao);

  // ── 1) Sem data de realização não há o que decidir ─────────────────────
  if (!realizacao) {
    return {
      veredicto: "rejeitado",
      achados: [{
        campo: "data_realizacao",
        label: "Data de realização",
        mensagem:
          campos.tipo === "psicologico"
            ? "Não foi possível ler a data da avaliação no laudo. Ela fica no bloco de identificação do avaliado."
            : "Não foi possível ler a data do exame. Ela fica no bloco da declaração, onde você declara não ter feito outro teste nos últimos 30 dias.",
      }],
      mensagemCliente:
        `Não conseguimos identificar a data em que o ${label} foi realizado. ` +
        `Reenvie o documento completo e legível — se for foto, capture a página inteira, sem cortes.`,
      mensagemEquipe: `Leitura sem data de realização no ${label}.`,
    };
  }

  const { vence_em, dias_restantes } = validadeLaudo(realizacao, hoje)!;

  // ── 2) Titular ─────────────────────────────────────────────────────────
  // Confere só o que dá para afirmar. Cadastro incompleto é falha nossa e não
  // pode reprovar documento do cliente.
  const cpfDoc = soDigitos(campos.cpf_avaliado);
  const cpfCad = soDigitos(cadastro.cpf);
  if (cpfDoc && cpfCad && cpfDoc !== cpfCad) {
    achados.push({
      campo: "cpf",
      label: "CPF",
      mensagem: "O CPF do laudo não é o seu. Confirme se o documento é mesmo seu.",
    });
  }
  const nomeDoc = normalizarNome(campos.nome_avaliado);
  const nomeCad = normalizarNome(cadastro.nome_completo);
  if (nomeDoc && nomeCad && nomeDoc !== nomeCad) {
    achados.push({
      campo: "nome",
      label: "Nome",
      mensagem: `No laudo consta "${campos.nome_avaliado}", e no seu cadastro "${cadastro.nome_completo}".`,
    });
  }

  // ── 3) Resultado ───────────────────────────────────────────────────────
  const res = String(campos.resultado ?? "").toLowerCase();
  if (res.includes("inapto") || res.includes("reprovado")) {
    achados.push({
      campo: "resultado",
      label: "Resultado",
      mensagem: `O ${label} está como INAPTO. A Polícia Federal exige resultado apto.`,
    });
  }

  // ── 4) Validade — conta da REALIZAÇÃO ──────────────────────────────────
  if (dias_restantes < 0) {
    const atraso =
      campos.data_emissao && diaISO(campos.data_emissao) !== realizacao
        ? " Lembrando que o prazo conta do dia do exame, não do dia em que o laudo foi assinado."
        : "";
    achados.push({
      campo: "validade",
      label: "Validade",
      mensagem:
        `O exame foi realizado em ${realizacao.split("-").reverse().join("/")} e a validade ` +
        `de 1 ano terminou em ${vence_em.split("-").reverse().join("/")}.${atraso}`,
    });
  }

  // ── 4b) Notas do tiro — a lei exige 60 em cada ────────────────────────
  //
  // Quem DECIDE é a conclusão do instrutor, não a nossa leitura do manuscrito.
  // Ele tem fé pública; nós temos um OCR sobre letra de mão. Se ele marcou
  // APTO e lemos nota abaixo de 60, o mais provável é que tenhamos lido
  // errado — e reprovar o cliente por isso seria cobrar dele o nosso erro.
  //
  // Por isso a divergência vira ALERTA INTERNO: a equipe abre o documento e
  // resolve em dez segundos. Nota ausente (`null`) não gera nada: a pergunta
  // vai para o cliente, que sabe a própria nota.
  if (campos.tipo === "tiro") {
    const abaixo: string[] = [];
    if (typeof campos.nota_teorica === "number" && campos.nota_teorica < NOTA_MINIMA_LEGAL) {
      abaixo.push(`prova teórica ${campos.nota_teorica}`);
    }
    if (typeof campos.pontuacao_5m === "number" && campos.pontuacao_5m < NOTA_MINIMA_LEGAL) {
      abaixo.push(`alvo de 5 m ${campos.pontuacao_5m}`);
    }
    if (typeof campos.pontuacao_7m === "number" && campos.pontuacao_7m < NOTA_MINIMA_LEGAL) {
      abaixo.push(`alvo de 7 m ${campos.pontuacao_7m}`);
    }
    if (abaixo.length) {
      const conclusaoApta = /aprovado|apto/.test(String(campos.resultado ?? "").toLowerCase())
        && !/inapto/.test(String(campos.resultado ?? "").toLowerCase());
      achados.push({
        campo: "notas",
        label: "Notas",
        interno: conclusaoApta,
        mensagem: conclusaoApta
          ? `Leitura indica nota abaixo do mínimo legal de ${NOTA_MINIMA_LEGAL} (${abaixo.join(", ")}), ` +
            `mas o instrutor concluiu APTO. Provável erro de leitura do manuscrito — conferir no documento.`
          : `A nota está abaixo do mínimo legal de ${NOTA_MINIMA_LEGAL} pontos (${abaixo.join(", ")}).`,
      });
    }
  }

  // ── 5) Ordem: psicológico precede o tiro ───────────────────────────────
  // Só é possível avaliar quando os DOIS já existem.
  const outro = diaISO(contexto.outroLaudoRealizacao);
  let inversaoDeOrdem = false;
  if (outro) {
    const psico = campos.tipo === "psicologico" ? realizacao : outro;
    const tiro = campos.tipo === "tiro" ? realizacao : outro;
    if (ordemLaudosOk(psico, tiro) === false) {
      inversaoDeOrdem = true;
      achados.push({
        campo: "ordem",
        label: "Ordem dos exames",
        mensagem:
          `O laudo psicológico (${psico.split("-").reverse().join("/")}) é posterior ao teste de tiro ` +
          `(${tiro.split("-").reverse().join("/")}). A Polícia Federal exige que a aptidão psicológica venha ANTES.`,
      });
    }
  }

  // ── 6) Credenciado ─────────────────────────────────────────────────────
  // NUNCA vira mensagem para o cliente. Regra explícita do usuário: a equipe
  // valida e, se for o caso, a equipe avisa.
  if (contexto.credenciado === "nao_encontrado") {
    achados.push({
      campo: "credenciado",
      label: "Credenciado",
      interno: true,
      mensagem:
        `${campos.credenciado_nome || "Profissional"} (${campos.credencial || "sem credencial legível"}) ` +
        `não foi localizado no cadastro da Polícia Federal. Conferir manualmente antes de protocolar.`,
    });
  }

  // ── Veredicto ──────────────────────────────────────────────────────────
  const bloqueios = achados.filter((a) => !a.interno);
  const internos = achados.filter((a) => a.interno);

  const veredicto: VeredictoLaudo = bloqueios.length
    ? "rejeitado"
    : internos.length
      ? "aprovado_com_alerta_interno"
      : "aprovado";

  const mensagemCliente = bloqueios.length
    ? (inversaoDeOrdem
        ? bloqueios.map((a) => a.mensagem).join(" ") +
          " Se você tiver o laudo psicológico ANTERIOR, envie-o: ele prova que a ordem foi respeitada na época. " +
          "Se não tiver, será necessário refazer o teste de tiro — nunca o psicológico."
        : bloqueios.map((a) => a.mensagem).join(" "))
    : "";

  const mensagemEquipe = achados.length
    ? achados.map((a) => `${a.label}: ${a.mensagem}`).join(" | ")
    : `${label} conferido: realizado em ${realizacao}, válido até ${vence_em}.`;

  return { veredicto, achados, mensagemCliente, mensagemEquipe, vence_em, dias_restantes };
}
