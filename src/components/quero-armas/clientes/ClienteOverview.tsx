import { useMemo } from "react";
import {
  AlertTriangle, ShoppingBag, Crosshair, Shield, Calendar,
  DollarSign, Clock, CheckCircle, XCircle, TrendingUp, FileText,
  ArrowRight, Eye, Activity, Zap, Target, Bell, CreditCard,
  ChevronRight, MapPin, Phone, Mail, Users, ShieldCheck, Info, ListChecks,
} from "lucide-react";
import { computeExameStatus, formatExameCountdown } from "@/components/quero-armas/clientes/ClienteExames";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import ClienteArsenalReview from "@/components/quero-armas/clientes/ClienteArsenalReview";
import { calcularPrazosProcessuais } from "@/lib/quero-armas/prazosProcessuais";

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
  examesAtuais?: any[]; // qa_exames_cliente_status — fonte de verdade
  /** FASE 4 — armas vindas de qa_cliente_armas_manual (cadastro manual / IA / OCR). */
  armasManual?: any[];
  onNavigate: (tab: string) => void;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("pt-BR");
  } catch { return d; }
};

const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;


function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return computeExameStatus(dateStr).dias_restantes;
  } catch {
    return null;
  }
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days < 0) return "text-red-600";
  if (days <= 30) return "text-red-500";
  if (days <= 90) return "text-amber-500";
  return "text-emerald-600";
}

function urgencyBg(days: number | null): string {
  if (days === null) return "bg-slate-50 border-slate-200";
  if (days < 0) return "bg-red-50/60 border-red-200/60";
  if (days <= 30) return "bg-red-50/60 border-red-200/60";
  if (days <= 90) return "bg-amber-50/60 border-amber-200/60";
  return "bg-emerald-50/60 border-emerald-200/60";
}

function urgencyLabel(days: number | null): string {
  if (days === null) return "Sem data";
  return formatExameCountdown(days);
}

function urgencyIcon(days: number | null) {
  if (days === null) return Clock;
  if (days < 0) return XCircle;
  if (days <= 30) return AlertTriangle;
  if (days <= 90) return Bell;
  return CheckCircle;
}

interface ExpiringDoc {
  label: string;
  date: string | null;
  days: number | null;
  category: string;
}

/* ─── Section Header ─── */
function SectionHeader({ icon: Icon, title, color, action, onAction }: {
  icon: any; title: string; color: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color }}>
          {title}
        </h3>
      </div>
      {action && onAction && (
        <button onClick={onAction} className="flex items-center gap-1 text-[10px] font-semibold hover:underline transition-colors" style={{ color }}>
          {action} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ─── Stat Pill ─── */
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <span className="text-[9px] md:text-[10px] font-medium" style={{ color: "hsl(220 10% 50%)" }}>{label}</span>
      <span className="text-[10px] md:text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

export default function ClienteOverview({ cliente, vendas, itens, crafs, gtes, filiacoes, cadastro, examesAtuais = [], armasManual = [], onNavigate }: Props) {
  const { map: SERVICO_MAP, getNome: getServicoNome } = useQAServicosMap();
  const analysis = useMemo(() => {
    const totalServicos = itens.length;
    const concluidos = itens.filter((i: any) => i.status === "CONCLUÍDO" || i.status === "DEFERIDO").length;
    const emAndamento = itens.filter((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const cancelados = itens.filter((i: any) => ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const totalVendas = vendas.reduce((acc: number, v: any) => acc + Number(v.valor_a_pagar || 0), 0);
    const totalDescontos = vendas.reduce((acc: number, v: any) => acc + Number(v.desconto || 0), 0);
    const totalArmas = crafs.length + gtes.length + (armasManual?.length || 0);
    const armasReview = (armasManual || []).filter((a: any) => a?.needs_review).length;

    const expDocs: ExpiringDoc[] = [];
    if (cadastro?.validade_cr) {
      expDocs.push({ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntil(cadastro.validade_cr), category: "CR" });
    }

    const exameByTipo = new Map<string, any>();
    for (const e of examesAtuais) {
      if (e?.tipo && !exameByTipo.has(e.tipo)) exameByTipo.set(e.tipo, e);
    }
    const psi = exameByTipo.get("psicologico");
    const tiro = exameByTipo.get("tiro");

    if (psi?.data_vencimento) {
      expDocs.push({
        label: "Laudo Psicológico",
        date: psi.data_vencimento,
        days: computeExameStatus(psi.data_vencimento).dias_restantes,
        category: "EXAME",
      });
    }
    if (tiro?.data_vencimento) {
      expDocs.push({
        label: "Exame de Tiro",
        date: tiro.data_vencimento,
        days: computeExameStatus(tiro.data_vencimento).dias_restantes,
        category: "EXAME",
      });
    }

    crafs.forEach((cr: any) => { if (cr.data_validade) expDocs.push({ label: `CRAF — ${cr.nome_arma || cr.nome_craf || "Arma"}`, date: cr.data_validade, days: daysUntil(cr.data_validade), category: "CRAF" }); });
    gtes.forEach((g: any) => { if (g.data_validade) expDocs.push({ label: `GTE — ${g.nome_arma || g.nome_gte || "Arma"}`, date: g.data_validade, days: daysUntil(g.data_validade), category: "GTE" }); });
    filiacoes.forEach((f: any) => { if (f.validade_filiacao) expDocs.push({ label: `Filiação — ${f.nome_filiacao || `Clube #${f.clube_id}`}`, date: f.validade_filiacao, days: daysUntil(f.validade_filiacao), category: "FILIAÇÃO" }); });
    itens.forEach((it: any) => { if (it.data_vencimento) expDocs.push({ label: `Serviço — ${SERVICO_MAP[it.servico_id] || `#${it.servico_id}`}`, date: it.data_vencimento, days: daysUntil(it.data_vencimento), category: "SERVIÇO" }); });

    // Prazos processuais administrativos: 10 dias (notificação / indeferimento /
    // restituição) ou 120 dias (Mandado de Segurança após indeferimento do
    // recurso administrativo). Fonte única: lib/quero-armas/prazosProcessuais.
    const prazosProc = calcularPrazosProcessuais(
      itens.map((it: any) => ({
        id: it.id,
        servico_id: it.servico_id,
        servico_nome: SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`,
        status: it.status,
        numero_processo: it.numero_processo,
        data_notificacao: it.data_notificacao,
        data_indeferimento: it.data_indeferimento,
        data_recurso_administrativo: it.data_recurso_administrativo,
        data_indeferimento_recurso: it.data_indeferimento_recurso,
      })),
    );
    for (const p of prazosProc) {
      const nome = p.servicoNome || `Serviço #${p.servicoId ?? "?"}`;
      const sufixoPrazo =
        p.evento === "MANDADO DE SEGURANÇA"
          ? "para impetração de MS (120d · art. 23 Lei 12.016/09)"
          : p.evento === "RESTITUIÇÃO"
            ? "para manifestação (10d)"
            : "para recurso (10d)";
      expDocs.push({
        label: `${p.evento} — ${nome} · prazo ${sufixoPrazo}`,
        date: p.dataLimite,
        days: p.diasRestantes,
        category: "PRAZO ADM",
      });
    }

    expDocs.sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

    const alerts = expDocs.filter(d => d.days !== null && d.days <= 90);
    const vencidos = expDocs.filter(d => d.days !== null && d.days < 0);
    const validos = expDocs.filter(d => d.days !== null && d.days > 90);

    return { totalServicos, concluidos, emAndamento, cancelados, totalVendas, totalDescontos, totalArmas, armasReview, expDocs, alerts, vencidos, validos, prazosProc };
  }, [vendas, itens, crafs, gtes, filiacoes, cadastro, examesAtuais, armasManual, SERVICO_MAP]);

  // Timeline events — ORDEM CRONOLÓGICA ASCENDENTE com TODOS os marcos por serviço
  const timeline = useMemo(() => {
    type Ev = {
      date: string;
      label: string;
      sublabel?: string;
      type: string;
      icon: any;
      color: string;
      vendaNum?: string | number;
      servico?: string;
      status?: string;
    };
    const events: Ev[] = [];

    // 1) Recebimento do cliente (venda criada)
    vendas.forEach((v: any) => {
      const vendaNum = v.id_legado ?? v.id;
      const vItens = itens.filter((i: any) => i.venda_id === vendaNum);
      const servicosNomes = vItens.map((i: any) => SERVICO_MAP[i.servico_id] || `#${i.servico_id}`).join(" · ");
      events.push({
        date: v.data_cadastro || v.created_at,
        label: `Venda #${vendaNum} recebida — ${formatCurrency(Number(v.valor_a_pagar || 0))}`,
        sublabel: servicosNomes ? `Serviços: ${servicosNomes}${v.forma_pagamento ? ` · ${v.forma_pagamento}` : ""}` : undefined,
        type: "venda",
        icon: CreditCard,
        color: "hsl(352 60% 30%)",
        vendaNum,
      });
    });

    // 2) Marcos por item de serviço
    itens.forEach((it: any) => {
      const servicoNome = SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`;
      const venda = vendas.find((v: any) => (v.id_legado ?? v.id) === it.venda_id);
      const vendaNum = venda ? (venda.id_legado ?? venda.id) : it.venda_id;
      const tag = `Venda #${vendaNum} · ${servicoNome}`;

      if (it.data_protocolo) {
        events.push({
          date: it.data_protocolo,
          label: `${tag} — Protocolado`,
          sublabel: it.numero_processo ? `Processo: ${it.numero_processo}` : undefined,
          type: "protocolo",
          icon: FileText,
          color: "hsl(38 92% 50%)",
          vendaNum, servico: servicoNome, status: "PROTOCOLADO",
        });
      }

      // Indeferimento (pode existir mesmo que o serviço seja posteriormente DEFERIDO via recurso).
      if (it.data_indeferimento) {
        events.push({
          date: it.data_indeferimento,
          label: `${tag} — Indeferido`,
          sublabel: "Aberto prazo de 10 dias para recurso administrativo",
          type: "indeferimento",
          icon: XCircle,
          color: "hsl(0 72% 55%)",
          vendaNum, servico: servicoNome, status: "INDEFERIDO",
        });
      }

      // Recurso administrativo protocolado (parte da MESMA linha do tempo do processo).
      if (it.data_recurso_administrativo) {
        events.push({
          date: it.data_recurso_administrativo,
          label: `${tag} — Recurso Administrativo protocolado`,
          sublabel: "Aguardando análise do recurso pela Polícia Federal",
          type: "recurso",
          icon: Activity,
          color: "hsl(262 60% 55%)",
          vendaNum, servico: servicoNome, status: "RECURSO ADMINISTRATIVO",
        });
      }

      if (it.data_deferimento) {
        const isIndef = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes((it.status || "").toUpperCase());
        // Se houve indeferimento prévio + recurso, o deferimento representa o ACATAMENTO do recurso.
        const houveRecurso = !!it.data_recurso_administrativo || !!it.data_indeferimento;
        const labelDef = isIndef
          ? it.status
          : (houveRecurso ? "Deferido (recurso acatado)" : "Deferido");
        events.push({
          date: it.data_deferimento,
          label: `${tag} — ${labelDef}`,
          type: isIndef ? "indeferimento" : "deferimento",
          icon: isIndef ? XCircle : CheckCircle,
          color: isIndef ? "hsl(0 72% 55%)" : "hsl(152 60% 42%)",
          vendaNum, servico: servicoNome, status: it.status,
        });
      }

      // Última atualização de status (apenas se diferir de protocolo/deferimento)
      if (
        it.data_ultima_atualizacao &&
        it.data_ultima_atualizacao !== it.data_protocolo &&
        it.data_ultima_atualizacao !== it.data_deferimento &&
        it.status &&
        !["DEFERIDO", "CONCLUÍDO", "INDEFERIDO"].includes((it.status || "").toUpperCase())
      ) {
        events.push({
          date: it.data_ultima_atualizacao,
          label: `${tag} — ${it.status}`,
          sublabel: "Atualização de status",
          type: "status",
          icon: Activity,
          color: "hsl(262 60% 55%)",
          vendaNum, servico: servicoNome, status: it.status,
        });
      }

      // Vencimento (futuro ou passado)
      if (it.data_vencimento) {
        events.push({
          date: it.data_vencimento,
          label: `${tag} — Vencimento`,
          type: "vencimento",
          icon: Clock,
          color: "hsl(220 10% 50%)",
          vendaNum, servico: servicoNome,
        });
      }
    });

    // Ordem cronológica ASCENDENTE (do mais antigo ao mais recente)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  }, [vendas, itens]);

  /* ─── helpers de status do cliente ─── */
  const statusCliente = String((cliente as any)?.status_cliente || "ativo").toLowerCase();
  const isAtivo = !["inativo", "cancelado", "excluido_lgpd", "suspenso"].includes(statusCliente);
  const piorDias = analysis.expDocs
    .map((d) => d.days)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)[0];
  const emDia = piorDias === undefined ? true : piorDias > 30;
  const totalArmasReais = crafs.length + gtes.length;
  const armasReview = (armasManual || []).filter((a: any) => a?.needs_review).length;

  /* ─── KPI principal: 4 cards ─── */
  const kpis = [
    { id: "servicos", icon: ShoppingBag, label: "SERVIÇOS", value: String(analysis.totalServicos), sub: `${analysis.concluidos} concluídos`, color: "#B91C1C", bg: "#FEE2E2", tab: "servicos" },
    { id: "andamento", icon: Activity, label: "EM ANDAMENTO", value: String(analysis.emAndamento), sub: analysis.cancelados > 0 ? `${analysis.cancelados} cancel.` : "nenhum cancel.", color: "#B45309", bg: "#FEF3C7", tab: "servicos" },
    { id: "armas", icon: Crosshair, label: "ARMAS", value: String(analysis.totalArmas), sub: `${crafs.length} CRAFs · ${gtes.length} GTEs`, color: "#6D28D9", bg: "#EDE9FE", tab: "arsenal" },
    { id: "investido", icon: DollarSign, label: "INVESTIDO", value: formatCurrency(analysis.totalVendas), sub: analysis.totalDescontos > 0 ? `${formatCurrency(analysis.totalDescontos)} desc.` : "sem descontos", color: "#047857", bg: "#D1FAE5", tab: "servicos" },
  ];

  /* ─── Próximos passos por status do serviço ─── */
  const STEPS_BY_STATUS: Record<string, string[]> = {
    "AGUARDANDO_DOCUMENTACAO": [
      "Aguardar envio de documentos",
      "Análise de documentos",
      "Emissão do Certificado de Registro (CR)",
    ],
    "EM_ANALISE": [
      "Análise de documentos",
      "Emissão de protocolo",
      "Acompanhamento junto à PF",
    ],
    "PROTOCOLADO": [
      "Acompanhamento junto à PF",
      "Decisão (deferimento)",
      "Emissão do documento final",
    ],
  };
  const itemAtivo = itens.find((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(String(i.status || "").toUpperCase())) || itens[0];
  const statusItem = String(itemAtivo?.status || "AGUARDANDO_DOCUMENTACAO").toUpperCase();
  const proximosPassos = STEPS_BY_STATUS[statusItem.replace(/\s+/g, "_")] || [
    "Aguardar envio de documentos",
    "Análise de documentos",
    "Conclusão do serviço",
  ];

  return (
    <div className="space-y-3">
      {/* CHIPS DE STATUS ─ alinhados à direita */}
      <div className="flex flex-wrap items-center justify-end gap-2 px-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: "#DBEAFE", borderColor: "#BFDBFE", color: "#1E40AF" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#1D4ED8" }} /> Auditoria
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: "#F1F5F9", borderColor: "#E2E8F0", color: "#475569" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#94A3B8" }} /> Visão 360°
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: isAtivo ? "#D1FAE5" : "#FEE2E2", borderColor: isAtivo ? "#A7F3D0" : "#FCA5A5", color: isAtivo ? "#065F46" : "#7F1D1D" }}>
          <CheckCircle className="h-3 w-3" /> Cliente {isAtivo ? "Ativo" : "Inativo"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: emDia ? "#D1FAE5" : "#FEF3C7", borderColor: emDia ? "#A7F3D0" : "#FDE68A", color: emDia ? "#065F46" : "#7C2D12" }}>
          <CheckCircle className="h-3 w-3" /> {emDia ? "Em Dia" : "Atenção"}
        </span>
      </div>

      {/* LINHA 1 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => onNavigate(k.tab)}
              className="text-left rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:border-[#7A1F2B] transition-all group"
              style={{ borderColor: "hsl(220 13% 90%)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: k.bg, color: k.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#7A1F2B]" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] mt-3" style={{ color: "hsl(220 10% 50%)" }}>{k.label}</div>
              <div className="text-[24px] font-bold leading-tight mt-0.5" style={{ color: "hsl(220 20% 18%)" }}>{k.value}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>{k.sub}</div>
            </button>
          );
        })}
      </div>

      {/* LINHA 2 — Serviços e Andamento + Próximos passos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* SERVIÇOS E ANDAMENTO */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4" style={{ color: "#B91C1C" }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 20% 22%)" }}>Serviços e Andamento</h3>
          </div>
          {itens.length === 0 ? (
            <div className="text-center py-6 text-[12px]" style={{ color: "hsl(220 10% 62%)" }}>Nenhum serviço contratado.</div>
          ) : itemAtivo ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FEF3C7", color: "#B45309" }}>
                  <Zap className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                    {SERVICO_MAP[itemAtivo.servico_id] || `Serviço #${itemAtivo.servico_id}`}
                  </div>
                  <div className="text-[11px] text-slate-500">Progresso do serviço</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ background: "#FEF3C7", borderColor: "#FDE68A", color: "#7C2D12" }}>
                  {String(itemAtivo.status || "aguardando_documentacao").toLowerCase()}
                </span>
              </div>
              {(() => {
                const statusDone = ["CONCLUÍDO", "DEFERIDO"].includes(String(itemAtivo.status || "").toUpperCase());
                const statusBad = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(String(itemAtivo.status || "").toUpperCase());
                const progress = statusDone ? 100 : statusBad ? 0 : 68;
                return (
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F59E0B, #EA580C)" }} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[12px] font-bold" style={{ color: "#B45309" }}>{progress}%</span>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Valor total</div>
                        <div className="text-[14px] font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                          {formatCurrency(Number(itemAtivo.valor || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onNavigate("servicos")}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] border-[#E5C2C6] bg-white hover:bg-[#FBF3F4]"
                >
                  Ver todos <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* PRÓXIMOS PASSOS */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="h-4 w-4" style={{ color: "#6D28D9" }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 20% 22%)" }}>Próximos Passos</h3>
          </div>
          <div className="text-[11px] text-slate-500 mb-3">O que está pendente</div>
          <ol className="space-y-2.5">
            {proximosPassos.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: i === 0 ? "#FEF3C7" : "#F1F5F9", color: i === 0 ? "#B45309" : "#64748B" }}>
                  {i === 0 ? <Clock className="h-3.5 w-3.5" /> : i === 1 ? <FileText className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>{step}</div>
                </div>
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#7F1D1D" }}>
                    Prioridade alta
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onNavigate("servicos")}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] border-[#E5C2C6] bg-white hover:bg-[#FBF3F4]"
            >
              Ver todos os passos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* LINHA 3 — Documentos e validades + Arsenal revisão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* DOCUMENTOS E VALIDADES */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4" style={{ color: "#6D28D9" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] truncate" style={{ color: "hsl(220 20% 22%)" }}>Documentos e Validades</h3>
            </div>
            <button onClick={() => onNavigate("hub")} className="text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline">
              Gerenciar documentos
            </button>
          </div>
          {analysis.expDocs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-500">
              Nenhum documento com validade cadastrado.
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.expDocs.slice(0, 4).map((doc, i) => {
                const days = doc.days;
                const tone = days === null ? { bg: "#F1F5F9", bd: "#E2E8F0", fg: "#475569", chip: "#64748B" }
                  : days < 0 ? { bg: "#FEE2E2", bd: "#FCA5A5", fg: "#7F1D1D", chip: "#B91C1C" }
                  : days <= 30 ? { bg: "#FEE2E2", bd: "#FCA5A5", fg: "#7F1D1D", chip: "#B91C1C" }
                  : days <= 90 ? { bg: "#FEF3C7", bd: "#FDE68A", fg: "#7C2D12", chip: "#B45309" }
                  : { bg: "#D1FAE5", bd: "#A7F3D0", fg: "#065F46", chip: "#047857" };
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ background: tone.bg, borderColor: tone.bd }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white shrink-0">
                      <CheckCircle className="h-3.5 w-3.5" style={{ color: tone.chip }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/70" style={{ color: tone.fg }}>{doc.category}</span>
                        <span className="text-[12px] font-semibold truncate" style={{ color: "hsl(220 20% 18%)" }}>{doc.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono" style={{ color: "hsl(220 10% 50%)" }}>{formatDate(doc.date)}</span>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/70" style={{ color: tone.fg }}>
                          {urgencyLabel(days)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ARSENAL — REVISÃO */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="h-4 w-4" style={{ color: "#1D4ED8" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] truncate" style={{ color: "hsl(220 20% 22%)" }}>Arsenal — Revisão</h3>
            </div>
            <button onClick={() => onNavigate("arsenal")} className="text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline">
              Ver detalhes
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "TOTAL", value: totalArmasReais },
              { label: "CRAF (R/O)", value: crafs.length },
              { label: "MANUAL/IA", value: armasManual.length },
              { label: "REVISÃO", value: armasReview },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border bg-slate-50 px-3 py-2" style={{ borderColor: "hsl(220 13% 92%)" }}>
                <div className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 10% 50%)" }}>{m.label}</div>
                <div className="text-[20px] font-bold leading-tight" style={{ color: "hsl(220 20% 18%)" }}>{m.value}</div>
              </div>
            ))}
          </div>
          {totalArmasReais === 0 && armasManual.length === 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 border px-3 py-2 text-[11px] text-slate-500" style={{ borderColor: "hsl(220 13% 92%)" }}>
              <Info className="h-3.5 w-3.5 shrink-0" />
              Nenhuma arma cadastrada.
            </div>
          )}
        </div>
      </div>

      {/* LINHA 4 — Linha do tempo + Histórico financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* LINHA DO TEMPO */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="h-4 w-4" style={{ color: "#1D4ED8" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] truncate" style={{ color: "hsl(220 20% 22%)" }}>Linha do Tempo</h3>
            </div>
            <button onClick={() => onNavigate("historico")} className="text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline">
              Ver todos
            </button>
          </div>
          {timeline.length === 0 ? (
            <div className="text-[11px] text-slate-500">Sem eventos registrados.</div>
          ) : (
            <ol className="space-y-3">
              {timeline.slice(-3).reverse().map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: "#B91C1C" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B91C1C" }}>
                        {formatDate(ev.date)}
                      </div>
                      <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>{ev.label}</div>
                      {ev.sublabel && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{ev.sublabel}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* HISTÓRICO FINANCEIRO */}
        <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="h-4 w-4" style={{ color: "#047857" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] truncate" style={{ color: "hsl(220 20% 22%)" }}>Histórico Financeiro</h3>
            </div>
            <button onClick={() => onNavigate("servicos")} className="text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline">
              Ver todos
            </button>
          </div>
          {vendas.length === 0 ? (
            <div className="text-[11px] text-slate-500">Sem vendas registradas.</div>
          ) : (
            <>
              <div className="space-y-1">
                {vendas.slice(0, 4).map((v: any) => {
                  const vItens = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
                  return (
                    <div key={v.id} className="grid grid-cols-12 items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: "hsl(220 13% 94%)" }}>
                      <div className="col-span-4 min-w-0">
                        <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Venda #{v.id_legado ?? v.id}</div>
                        <div className="text-[10px] text-slate-500">{formatDate(v.data_cadastro)}</div>
                      </div>
                      <div className="col-span-3 text-[11px] text-slate-600">{vItens.length} {vItens.length === 1 ? "serviço" : "serviços"}</div>
                      <div className="col-span-2 text-[11px] uppercase font-semibold text-slate-600">{v.forma_pagamento || "—"}</div>
                      <div className="col-span-3 text-right text-[12px] font-bold font-mono" style={{ color: "hsl(220 20% 18%)" }}>
                        {formatCurrency(Number(v.valor_a_pagar || 0))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-3 mt-2 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Investido</span>
                <span className="text-[15px] font-bold font-mono" style={{ color: "#047857" }}>{formatCurrency(analysis.totalVendas)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* LINHA 5 — Resumo operacional inferior (3 cards compactos) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => onNavigate("arsenal")} className="text-left rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:border-[#7A1F2B] transition-all" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FE", color: "#6D28D9" }}>
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 10% 50%)" }}>CR</span>
          </div>
          {cadastro ? (
            <>
              <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
                CR: {cadastro.numero_cr || "Sem nº"}
              </div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: "#047857" }}>
                {cadastro.validade_cr ? `Val: ${formatDate(cadastro.validade_cr)}` : "Sem validade"}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-500">Não cadastrado</div>
          )}
        </button>

        <button onClick={() => onNavigate("arsenal")} className="text-left rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:border-[#7A1F2B] transition-all" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>
              <Crosshair className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 10% 50%)" }}>Armas</span>
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
            {crafs.length} CRAFs · {gtes.length} GTEs
          </div>
        </button>

        <button onClick={() => onNavigate("dados")} className="text-left rounded-xl border bg-white p-4 shadow-sm hover:shadow-md hover:border-[#7A1F2B] transition-all" style={{ borderColor: "hsl(220 13% 90%)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FFEDD5", color: "#C2410C" }}>
              <Users className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "hsl(220 10% 50%)" }}>Filiações</span>
          </div>
          <div className="text-[12px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
            {filiacoes.length} {filiacoes.length === 1 ? "filiação" : "filiações"}
          </div>
        </button>
      </div>
    </div>
  );
}
