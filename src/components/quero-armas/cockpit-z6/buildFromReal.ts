/**
 * Cockpit Z6 Light — adaptador de dados REAIS do cliente.
 *
 * Converte as fontes oficiais do portal (`qa_processos`, `qa_processo_documentos`,
 * `qa_processo_eventos`, `qa_vendas`, `qa_crafs`, `qa_gtes`, `qa_exames_cliente`,
 * `qa_documentos_cliente`) na shape esperada pelo componente Cockpit Z6 Light.
 *
 * Mantém a identidade visual canônica (ver mem://style/quero-armas/cockpit-z6-light-canonical):
 * só monta props, NUNCA altera o componente nem os tokens HEX.
 */
import type {
  CockpitZ6MeusProcessosProps,
  CockpitZ6Process,
  CockpitZ6Stage,
  CockpitZ6TimelineEvent,
  CockpitZ6ChecklistItem,
  CockpitZ6Kpi,
  CockpitZ6FocoDoDia,
} from "./CockpitZ6MeusProcessos";

const MESES_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function fmtDateShort(d: string | Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const dt = d instanceof Date ? d : typeof d === "string" ? new Date(d) : null;
  if (!dt || isNaN(dt.getTime())) return undefined;
  return `${String(dt.getDate()).padStart(2, "0")}/${MESES_PT[dt.getMonth()]}/${dt.getFullYear()}`;
}
function fmtDayMonth(d: string | Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const dt = d instanceof Date ? d : typeof d === "string" ? new Date(d) : null;
  if (!dt || isNaN(dt.getTime())) return undefined;
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function daysBetween(from: string | Date, to: Date = new Date()): number {
  if (from == null) return 0;
  const dt = typeof from === "string" ? new Date(from) : from;
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - dt.getTime()) / 86_400_000));
}
function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return Math.ceil((dt.getTime() - Date.now()) / 86_400_000);
}

/**
 * Normaliza nome de serviço para exibição uniforme na tela do cliente:
 * UPPERCASE + espaços em volta de "/" (com no-break space para evitar quebra feia).
 * Ex: "Aquisição/Registro/Posse de arma de fogo"
 *   → "AQUISIÇÃO / REGISTRO / POSSE DE ARMA DE FOGO"
 */
function formatServicoNome(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "PROCESSO";
  return raw
    .replace(/[ \t]+/g, " ")
    .toLocaleUpperCase("pt-BR")
    .replace(/ *\/ */g, "\u00A0/\u00A0")
    .trim();
}

/** Mapeia status do qa_processos → badge visual canônica do Z6. */
function badgeForStatus(status: string | null | undefined): { badge: string; tone: CockpitZ6Process["badgeTone"] } {
  const s = String(status || "").toLowerCase();
  if (s === "protocolado") return { badge: "NA POLÍCIA FEDERAL", tone: "green" };
  if (s === "pronto_para_protocolar") return { badge: "COM A EQUIPE", tone: "bordo" };
  if (s === "aguardando_pagamento") return { badge: "AGUARDA VOCÊ", tone: "amber" };
  if (s === "aguardando_assinatura") return { badge: "AGUARDA ASSINATURA", tone: "amber" };
  if (s === "aguardando_documentos") return { badge: "AGUARDA VOCÊ", tone: "amber" };
  if (["concluido", "deferido", "finalizado"].includes(s)) return { badge: "CONCLUÍDO", tone: "green" };
  if (["indeferido", "cancelado"].includes(s)) return { badge: "ENCERRADO", tone: "red" };
  return { badge: "EM ANDAMENTO", tone: "bordo" };
}

function progressoTone(pct: number): CockpitZ6Process["progressoTone"] {
  if (pct >= 75) return "green";
  if (pct >= 35) return "bordo";
  return "amber";
}

/** 5 etapas canônicas do funil Z6, alimentadas pelo status real do processo. */
function stagesFromStatus(status: string): CockpitZ6Stage[] {
  const s = String(status || "").toLowerCase();
  // Sequência: CONTRATAÇÃO → ASSINATURA → DOCUMENTAÇÃO → PROTOCOLO → DEFERIMENTO
  const order: Array<{ label: string; matches: string[] }> = [
    { label: "CONTRATAÇÃO",  matches: ["aguardando_pagamento"] },
    { label: "ASSINATURA",   matches: ["aguardando_assinatura"] },
    { label: "DOCUMENTAÇÃO", matches: ["aguardando_documentos"] },
    { label: "PROTOCOLO",    matches: ["pronto_para_protocolar"] },
    { label: "DEFERIMENTO",  matches: ["protocolado"] },
  ];
  let currentIdx = order.findIndex((o) => o.matches.includes(s));
  if (currentIdx === -1) currentIdx = ["concluido","deferido","finalizado"].includes(s) ? order.length : 2;
  return order.map((o, i) => ({
    index: i + 1,
    label: o.label,
    status: i < currentIdx ? "done" : i === currentIdx ? "current" : "pending",
  }));
}

function checklistFromDocs(docs: any[]): CockpitZ6ChecklistItem[] {
  if (!docs.length) return [];
  // pega até 4 documentos da etapa atual / pendentes mais relevantes
  const sortable = [...docs].sort((a, b) => {
    const pa = a.obrigatorio ? 0 : 1;
    const pb = b.obrigatorio ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.ordem ?? 999) - (b.ordem ?? 999);
  });
  return sortable.slice(0, 4).map((d) => {
    const st = String(d.status || "").toLowerCase();
    if (st === "aprovado")
      return { label: String(d.nome_documento || d.tipo_documento || "Documento").toUpperCase(), badge: "RECEBIDO", tone: "green" } as CockpitZ6ChecklistItem;
    if (st === "em_analise" || st === "enviado")
      return { label: String(d.nome_documento || d.tipo_documento || "Documento").toUpperCase(), badge: "EM ANÁLISE", tone: "amber" } as CockpitZ6ChecklistItem;
    if (st === "rejeitado" || st === "reprovado")
      return { label: String(d.nome_documento || d.tipo_documento || "Documento").toUpperCase(), badge: "REENVIAR", tone: "red" } as CockpitZ6ChecklistItem;
    return { label: String(d.nome_documento || d.tipo_documento || "Documento").toUpperCase(), badge: "PENDENTE", tone: "gray" } as CockpitZ6ChecklistItem;
  });
}

function timelineFromEventos(eventos: any[]): CockpitZ6TimelineEvent[] {
  // os eventos vêm DESC; queremos exibir ASC e marcar o mais recente como 'current'
  const ordered = [...eventos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const tail = ordered.slice(-5);
  return tail.map((ev, i) => ({
    title: String(ev.descricao || ev.tipo_evento || "Evento").trim(),
    sub: [fmtDayMonth(ev.created_at) ? `${fmtDayMonth(ev.created_at)}/${new Date(ev.created_at).getFullYear()}` : null, ev.ator].filter(Boolean).join(" · "),
    status: i === tail.length - 1 ? "current" : "done",
  }));
}

function buildProcessoCard(args: {
  proc: any;
  docs: any[];
  eventos: any[];
  detalhado: boolean;
}): CockpitZ6Process {
  const { proc, docs, eventos, detalhado } = args;
  const docsObrig = docs.filter((d) => d.obrigatorio !== false);
  const docsAprov = docsObrig.filter((d) => String(d.status || "").toLowerCase() === "aprovado");
  const totalObrig = docsObrig.length || 1;
  const progressoPct = Math.round((docsAprov.length / totalObrig) * 100);

  const { badge, tone } = badgeForStatus(proc.status);

  // Etapa atual: a etapa do primeiro doc pendente/em_analise; fallback para o status
  const docsAbertos = docs.filter((d) => !["aprovado","arquivado"].includes(String(d.status || "").toLowerCase()));
  const etapasAbertas = Array.from(new Set(docsAbertos.map((d) => String(d.etapa || "").trim()).filter(Boolean)));
  let etapaAtual = (etapasAbertas[0] || "").toUpperCase();
  if (!etapaAtual) {
    const s = String(proc.status || "").toLowerCase();
    etapaAtual = s === "protocolado" ? "ANÁLISE PF"
      : s === "pronto_para_protocolar" ? "PROTOCOLO"
      : s === "aguardando_pagamento" ? "PAGAMENTO"
      : s === "aguardando_documentos" ? "DOCUMENTAÇÃO"
      : "EM ANDAMENTO";
  }

  const previsao = proc.prazo_critico_data || proc.etapa_liberada_ate;
  const diasEmAndamento = daysBetween(proc.data_criacao || proc.created_at);

  const servicoSlug = formatServicoNome(proc.servico_nome || "PROCESSO");
  const protocoloShort = String(proc.id || "").split("-")[0].toUpperCase();
  const titulo = `${servicoSlug} · ${protocoloShort}`;

  const base: CockpitZ6Process = {
    id: proc.id,
    badge,
    badgeTone: tone,
    protocolo: proc.numero_processo ? `PROTOCOLO PF · ${proc.numero_processo}` : undefined,
    titulo,
    progressoPct,
    progressoTone: progressoTone(progressoPct),
    etapaAtual,
    previsao: previsao
      ? { label: "Prev. conclusão", value: fmtDateShort(previsao) || "—" }
      : undefined,
    metricaTempo: { label: "Dias em andamento", value: `${diasEmAndamento} DIAS` },
  };

  if (detalhado) {
    base.detalhado = {
      stages: stagesFromStatus(proc.status),
      timeline: timelineFromEventos(eventos),
      checklist: checklistFromDocs(docs),
      proximoPasso: docsAbertos.length
        ? `${docsAbertos.length} documento(s) pendente(s). Conclua a etapa atual para liberar a próxima.`
        : "Aguardando ação da equipe Quero Armas.",
    };
  } else {
    base.compacto = {
      barras: stagesFromStatus(proc.status).map((s) => ({ label: s.label, tone: s.status })),
    };
  }

  return base;
}

export interface BuildCockpitZ6FromRealInput {
  nomeCliente: string;
  cpfMascarado: string;
  membroDesde: string;
  processos: any[];          // qa_processos
  processoDocs: any[];       // qa_processo_documentos
  processoEventos: any[];    // qa_processo_eventos
  vendas: any[];             // qa_vendas
  crafs: any[];              // qa_crafs (com data_validade)
  gtes: any[];               // qa_gtes (com data_validade)
  examesCliente: any[];      // qa_exames_cliente
  onFocoCta?: () => void;    // callback do botão do Foco do Dia
}

export function buildCockpitZ6FromReal(input: BuildCockpitZ6FromRealInput): CockpitZ6MeusProcessosProps {
  const {
    nomeCliente, cpfMascarado, membroDesde,
    processos, processoDocs, processoEventos,
    vendas, crafs, gtes, examesCliente, onFocoCta,
  } = input;

  // 1) Cards de processo (primeiro detalhado, demais compactos)
  const cards: CockpitZ6Process[] = processos.map((proc, i) => {
    const docs = processoDocs.filter((d) => d.processo_id === proc.id);
    const eventos = processoEventos.filter((e) => e.processo_id === proc.id);
    return buildProcessoCard({ proc, docs, eventos, detalhado: i === 0 });
  });

  // 2) KPIs humanos derivados do estado real
  const comVoce = processos.filter((p) => ["aguardando_pagamento", "aguardando_assinatura", "aguardando_documentos"].includes(String(p.status || "").toLowerCase())).length;
  const comEquipe = processos.filter((p) => ["pronto_para_protocolar"].includes(String(p.status || "").toLowerCase())).length;
  const naPF = processos.filter((p) => String(p.status || "").toLowerCase() === "protocolado").length;
  const concluidos = processos.filter((p) => ["concluido","deferido","finalizado"].includes(String(p.status || "").toLowerCase())).length;

  const anoAtual = new Date().getFullYear();
  // Só entram vendas efetivamente PAGAS (e não canceladas). Se o cliente
  // cancela um pedido, ele deixa este total automaticamente.
  const vendasPagas = vendas.filter((v) => {
    const st = String(v.status || "").toUpperCase();
    const cob = String(v.cobranca_status || "").toLowerCase();
    if (st === "CANCELADO" || cob === "cancelada") return false;
    return st === "PAGO" || cob === "confirmada";
  });
  const vendasPagasAno = vendasPagas.filter((v) => {
    const dt = v.cobranca_confirmada_em || v.aprovado_em || v.data_cadastro;
    return dt && new Date(dt).getFullYear() === anoAtual;
  });
  // Valor = soma do PREÇO DO CATÁLOGO dos itens de cada venda paga.
  // Fallback para o valor do próprio item apenas quando o catálogo não tem preço.
  const pagoAno = vendasPagasAno.reduce((acc, v) => {
    const itens: any[] = Array.isArray(v.qa_itens_venda) ? v.qa_itens_venda : [];
    if (!itens.length) return acc + Number(v.valor_aprovado ?? v.valor_a_pagar ?? 0);
    return acc + itens.reduce((s, it) => {
      const preco = Number(it?.qa_servicos_catalogo?.preco);
      if (Number.isFinite(preco) && preco > 0) return s + preco;
      return s + (Number(it?.valor) || 0);
    }, 0);
  }, 0);

  // Docs vencendo nos próximos 30 dias (CRAF, GT, Exames)
  const vencendo: { label: string; dias: number }[] = [];
  const pushIf = (label: string, validade: any) => {
    const d = daysUntil(validade);
    if (d !== null && d <= 30) vencendo.push({ label, dias: d });
  };
  crafs.forEach((c) => pushIf("CR", c.data_validade));
  gtes.forEach((g) => pushIf("GT", g.data_validade));
  examesCliente.forEach((e) => pushIf(String(e.tipo_exame || "Exame").toUpperCase(), e.data_vencimento));

  const pagoFmt = pagoAno >= 1000
    ? `R$ ${(pagoAno / 1000).toFixed(1).replace(".", ",")}K`
    : `R$ ${pagoAno.toFixed(0)}`;

  const kpis: CockpitZ6Kpi[] = [
    { label: "COM VOCÊ",     value: String(comVoce),    sub: comVoce ? "aguardando ação" : "nada pendente",   dot: comVoce ? "amber" : "gray" },
    { label: "COM EQUIPE",   value: String(comEquipe),  sub: "em análise",                                    dot: "blue" },
    { label: "NA PF",        value: String(naPF),       sub: naPF ? "aguardando deferimento" : "nenhum",      dot: "bordo" },
    { label: "CONCLUÍDOS",   value: String(concluidos), sub: "últimos 12 meses",                              dot: "green" },
    { label: `PAGO ${anoAtual}`, value: pagoFmt,        sub: `${vendasPagasAno.length} pedido${vendasPagasAno.length === 1 ? "" : "s"} pago${vendasPagasAno.length === 1 ? "" : "s"}`, dot: "gray" },
    {
      label: "DOC VENCENDO",
      value: String(vencendo.length),
      sub: vencendo.length
        ? vencendo.slice(0, 2).map((v) => `${v.label} em ${v.dias}d`).join(" · ")
        : "tudo em dia",
      dot: vencendo.length ? "amber" : "green",
    },
  ];

  // 3) Foco do dia: prioriza pagamento → assinatura → documento pendente
  let focoDoDia: CockpitZ6FocoDoDia | null = null;
  const procPagamento = processos.find((p) => String(p.status).toLowerCase() === "aguardando_pagamento");
  const procAssinatura = processos.find((p) => String(p.status).toLowerCase() === "aguardando_assinatura");
  const procDocs = processos.find((p) => String(p.status).toLowerCase() === "aguardando_documentos");
  if (procPagamento) {
    focoDoDia = {
      titulo: `Pagamento pendente — ${formatServicoNome(procPagamento.servico_nome || "Processo")}`,
      descricao: "Liberamos a próxima etapa assim que o pagamento for confirmado.",
      cta: { label: "PAGAR AGORA →", onClick: onFocoCta },
    };
  } else if (procAssinatura) {
    focoDoDia = {
      titulo: `Assinatura pendente — ${formatServicoNome(procAssinatura.servico_nome || "Processo")}`,
      descricao: "Pagamento confirmado. Assine o contrato para liberarmos o checklist e iniciarmos o seu processo. O Arsenal Inteligente segue liberado.",
      cta: { label: "ASSINAR CONTRATO →", onClick: onFocoCta },
    };
  } else if (procDocs) {
    const docsAbertos = processoDocs.filter((d) => d.processo_id === procDocs.id && !["aprovado","arquivado"].includes(String(d.status || "").toLowerCase()));
    focoDoDia = {
      titulo: `${docsAbertos.length} documento(s) pendente(s) — ${formatServicoNome(procDocs.servico_nome || "Processo")}`,
      descricao: "Conclua a etapa atual para liberar o próximo passo do seu processo.",
      cta: { label: "ENVIAR DOCUMENTOS →", onClick: onFocoCta },
    };
  }

  const processosAtivos = processos.filter((p) => !["concluido","deferido","finalizado","indeferido","cancelado"].includes(String(p.status || "").toLowerCase())).length;

  return {
    nomeCliente,
    cpfMascarado,
    membroDesde,
    processosAtivos,
    focoDoDia,
    kpis,
    processos: cards,
  };
}