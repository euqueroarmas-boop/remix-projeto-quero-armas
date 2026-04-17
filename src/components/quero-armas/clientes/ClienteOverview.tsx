import { useMemo } from "react";
import {
  AlertTriangle, ShoppingBag, Crosshair, Shield, Calendar,
  DollarSign, Clock, CheckCircle, XCircle, TrendingUp, FileText,
  ArrowRight, Eye, Activity, Zap, Target, Bell, CreditCard,
  ChevronRight, MapPin, Phone, Mail, User,
} from "lucide-react";
import { computeExameStatus, formatExameCountdown } from "@/components/quero-armas/clientes/ClienteExames";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
  examesAtuais?: any[]; // qa_exames_cliente_status — fonte de verdade
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

export default function ClienteOverview({ cliente, vendas, itens, crafs, gtes, filiacoes, cadastro, examesAtuais = [], onNavigate }: Props) {
  const { map: SERVICO_MAP, getNome: getServicoNome } = useQAServicosMap();
  const analysis = useMemo(() => {
    const totalServicos = itens.length;
    const concluidos = itens.filter((i: any) => i.status === "CONCLUÍDO" || i.status === "DEFERIDO").length;
    const emAndamento = itens.filter((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const cancelados = itens.filter((i: any) => ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const totalVendas = vendas.reduce((acc: number, v: any) => acc + Number(v.valor_a_pagar || 0), 0);
    const totalDescontos = vendas.reduce((acc: number, v: any) => acc + Number(v.desconto || 0), 0);
    const totalArmas = crafs.length + gtes.length;

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

    expDocs.sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

    const alerts = expDocs.filter(d => d.days !== null && d.days <= 90);
    const vencidos = expDocs.filter(d => d.days !== null && d.days < 0);
    const validos = expDocs.filter(d => d.days !== null && d.days > 90);

    return { totalServicos, concluidos, emAndamento, cancelados, totalVendas, totalDescontos, totalArmas, expDocs, alerts, vencidos, validos };
  }, [vendas, itens, crafs, gtes, filiacoes, cadastro, examesAtuais]);

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
        color: "hsl(230 80% 56%)",
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

      if (it.data_deferimento) {
        const isIndef = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes((it.status || "").toUpperCase());
        events.push({
          date: it.data_deferimento,
          label: `${tag} — ${isIndef ? it.status : "Deferido"}`,
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

  const statusText = cliente.status === "ATIVO" ? "ATIVO" : cliente.status || "—";
  const statusColor = cliente.status === "ATIVO" ? "hsl(152 60% 42%)" : "hsl(38 92% 50%)";

  return (
    <div className="space-y-4 md:space-y-5">
      {/* ═══ STRATEGIC HEADER ═══ */}
      <div className="qa-card overflow-hidden">
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(230 80% 56%), hsl(262 60% 55%), hsl(190 80% 42%))" }} />
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            {/* Avatar & Name */}
            <div className="w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
              <User className="h-5 w-5 md:h-6 md:w-6" style={{ color: "hsl(230 80% 56%)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] md:text-lg font-bold truncate" style={{ color: "hsl(220 20% 18%)" }}>{cliente.nome_completo}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}14`, color: statusColor }}>
                  {statusText}
                </span>
                {cliente.cpf && <span className="text-[10px] font-mono" style={{ color: "hsl(220 10% 55%)" }}>CPF: {cliente.cpf}</span>}
                {cadastro?.numero_cr && <span className="text-[10px] font-mono" style={{ color: "hsl(262 60% 55%)" }}>CR: {cadastro.numero_cr}</span>}
              </div>
            </div>
          </div>
          {/* Contact pills — stacked on mobile */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {cliente.celular && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 46%)" }}>
                <Phone className="h-2.5 w-2.5" /> {cliente.celular}
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium truncate max-w-[180px] md:max-w-[200px]" style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 46%)" }}>
                <Mail className="h-2.5 w-2.5 shrink-0" /> {cliente.email}
              </div>
            )}
            {cliente.cidade && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 46%)" }}>
                <MapPin className="h-2.5 w-2.5" /> {cliente.cidade}/{cliente.estado}
              </div>
            )}
          </div>
          {/* Quick stats row */}
          <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 pt-3 border-t" style={{ borderColor: "hsl(220 13% 94%)" }}>
            <StatPill label="Serviços" value={analysis.totalServicos} color="hsl(230 80% 56%)" />
            <StatPill label="Andamento" value={analysis.emAndamento} color="hsl(38 92% 50%)" />
            <StatPill label="Concluídos" value={analysis.concluidos} color="hsl(152 60% 42%)" />
            <StatPill label="Armas" value={analysis.totalArmas} color="hsl(262 60% 55%)" />
            <StatPill label="Investido" value={formatCurrency(analysis.totalVendas)} color="hsl(220 20% 25%)" />
            {analysis.vencidos.length > 0 && <StatPill label="Vencidos" value={analysis.vencidos.length} color="hsl(0 72% 55%)" />}
          </div>
        </div>
      </div>

      {/* ═══ ALERT BANNER ═══ */}
      {analysis.alerts.length > 0 && (
        <div className="qa-card p-0 overflow-hidden">
          <div className="h-0.5 w-full" style={{ background: analysis.vencidos.length > 0 ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)" }} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4" style={{ color: analysis.vencidos.length > 0 ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)" }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: analysis.vencidos.length > 0 ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)" }}>
                {analysis.alerts.length} {analysis.alerts.length === 1 ? "Alerta" : "Alertas"} de Vencimento
              </span>
            </div>
            <div className="space-y-1.5">
              {analysis.alerts.slice(0, 6).map((a, i) => {
                const Icon = urgencyIcon(a.days);
                return (
                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${urgencyBg(a.days)}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${urgencyColor(a.days)}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium block truncate" style={{ color: "hsl(220 20% 18%)" }}>{a.label}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: "hsl(220 10% 50%)" }}>{formatDate(a.date)}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${urgencyColor(a.days)}`}>
                          {urgencyLabel(a.days)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
        {[
          { icon: ShoppingBag, label: "SERVIÇOS", value: analysis.totalServicos, sub: `${analysis.concluidos} concluídos`, color: "hsl(230 80% 56%)", tab: "servicos" },
          { icon: Activity, label: "ANDAMENTO", value: analysis.emAndamento, sub: analysis.cancelados > 0 ? `${analysis.cancelados} cancel.` : "nenhum cancel.", color: "hsl(38 92% 50%)", tab: "servicos" },
          { icon: Crosshair, label: "ARMAS", value: analysis.totalArmas, sub: `${crafs.length} CRAFs · ${gtes.length} GTEs`, color: "hsl(262 60% 55%)", tab: "armas" },
          { icon: DollarSign, label: "INVESTIDO", value: formatCurrency(analysis.totalVendas), sub: analysis.totalDescontos > 0 ? `${formatCurrency(analysis.totalDescontos)} desc.` : "sem descontos", color: "hsl(152 60% 42%)", tab: "servicos" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={() => onNavigate(c.tab)}
              className="qa-card p-3 md:p-4 text-left hover:shadow-md active:scale-[0.98] transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-[0.04]" style={{ background: c.color, transform: "translate(30%, -30%)" }} />
              <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center mb-2 md:mb-3" style={{ background: `${c.color}12` }}>
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color: c.color }} />
              </div>
              <div className="text-lg md:text-xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
                {c.value}
              </div>
              <div className="text-[9px] md:text-[10px] font-bold tracking-[0.1em] mt-0.5" style={{ color: c.color }}>{c.label}</div>
              <div className="text-[9px] md:text-[10px] mt-0.5" style={{ color: "hsl(220 10% 58%)" }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* ═══ STEP FLOW / SERVICES ═══ */}
      <div className="qa-card p-4 md:p-5">
        <SectionHeader icon={Target} title="Serviços e Andamento" color="hsl(230 80% 56%)" action="Ver Todos" onAction={() => onNavigate("servicos")} />
        {itens.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "hsl(220 10% 62%)" }}>Nenhum serviço contratado ainda.</div>
        ) : (
          <div className="space-y-2">
            {itens.slice(0, 10).map((it: any) => {
              const statusDone = it.status === "CONCLUÍDO" || it.status === "DEFERIDO";
              const statusBad = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(it.status);
              const progress = statusDone ? 100 : statusBad ? 0 : 60;
              return (
                <div key={it.id} className="group flex items-center gap-3 py-3 px-4 rounded-xl border transition-all hover:shadow-sm" style={{ borderColor: "hsl(220 13% 93%)" }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    statusDone ? "bg-emerald-50" : statusBad ? "bg-red-50" : "bg-amber-50"
                  }`}>
                    {statusDone ? <CheckCircle className="h-4 w-4 text-emerald-600" /> :
                     statusBad ? <XCircle className="h-4 w-4 text-red-500" /> :
                     <Zap className="h-4 w-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: "hsl(220 20% 18%)" }}>
                      {SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                      {it.numero_processo && <span className="font-mono">{it.numero_processo}</span>}
                      {it.data_protocolo && <span>Prot: {formatDate(it.data_protocolo)}</span>}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 rounded-full mt-2" style={{ background: "hsl(220 13% 94%)" }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${progress}%`,
                        background: statusDone ? "hsl(152 60% 42%)" : statusBad ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)",
                      }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      statusDone ? "text-emerald-700 bg-emerald-50" : statusBad ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"
                    }`}>{it.status}</span>
                    <span className="text-[11px] font-bold font-mono" style={{ color: "hsl(220 20% 25%)" }}>
                      {formatCurrency(Number(it.valor || 0))}
                    </span>
                  </div>
                </div>
              );
            })}
            {itens.length > 10 && (
              <button onClick={() => onNavigate("servicos")} className="w-full text-center py-2 text-[11px] font-semibold hover:underline" style={{ color: "hsl(230 80% 56%)" }}>
                + {itens.length - 10} serviços adicionais
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ DOCUMENTS & EXPIRATIONS ═══ */}
      <div className="qa-card p-4 md:p-5">
        <SectionHeader icon={Calendar} title="Documentos e Validades" color="hsl(262 60% 55%)" action="Gerenciar" onAction={() => onNavigate("cr")} />
        {analysis.expDocs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "hsl(220 10% 62%)" }}>Nenhum documento com validade cadastrado.</div>
        ) : (
          <div className="space-y-1.5">
            {analysis.expDocs.map((doc, i) => {
              const Icon = urgencyIcon(doc.days);
              return (
                <div key={i} className={`flex items-start gap-2.5 py-2 px-3 rounded-xl border ${urgencyBg(doc.days)} transition-all`}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${urgencyColor(doc.days)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/70 shrink-0 uppercase" style={{ color: "hsl(220 10% 46%)" }}>{doc.category}</span>
                      <span className="text-[10px] md:text-[11px] font-semibold truncate" style={{ color: "hsl(220 20% 18%)" }}>{doc.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono" style={{ color: "hsl(220 10% 50%)" }}>{formatDate(doc.date)}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${urgencyColor(doc.days)} bg-white/60`}>
                        {urgencyLabel(doc.days)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ TIMELINE ═══ */}
      {timeline.length > 0 && (
        <div className="qa-card p-5">
          <SectionHeader icon={Activity} title="Linha do Tempo" color="hsl(190 80% 42%)" />
          <div className="text-[10px] mb-3" style={{ color: "hsl(220 10% 55%)" }}>
            {timeline.length} eventos · ordem cronológica (mais antigo → mais recente)
          </div>
          <div className="relative pl-6">
            <div className="absolute left-2.5 top-1 bottom-1 w-px" style={{ background: "hsl(220 13% 90%)" }} />
            <div className="space-y-3">
              {timeline.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <div key={i} className="relative flex items-start gap-3">
                    <div className="absolute -left-3.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center z-10" style={{ background: `${ev.color}18` }}>
                      <Icon className="h-2.5 w-2.5" style={{ color: ev.color }} />
                    </div>
                    <div className="flex-1 min-w-0 pl-4">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: ev.color }}>
                          {formatDate(ev.date)}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
                          {ev.label}
                        </span>
                      </div>
                      {ev.sublabel && (
                        <div className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                          {ev.sublabel}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FINANCIAL SUMMARY ═══ */}
      {vendas.length > 0 && (
        <div className="qa-card p-5">
          <SectionHeader icon={TrendingUp} title="Histórico Financeiro" color="hsl(152 60% 42%)" action="Ver Todos" onAction={() => onNavigate("servicos")} />
          <div className="space-y-2">
            {vendas.map((v: any) => {
              const vItens = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
              return (
                <div key={v.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border transition-all hover:shadow-sm" style={{ borderColor: "hsl(220 13% 93%)" }}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
                      Venda #{v.id_legado ?? v.id}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>
                      <span>{formatDate(v.data_cadastro)}</span>
                      <span>·</span>
                      <span>{vItens.length} {vItens.length === 1 ? "serviço" : "serviços"}</span>
                      {v.forma_pagamento && <><span>·</span><span>{v.forma_pagamento}</span></>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-bold font-mono" style={{ color: "hsl(220 20% 18%)" }}>
                      {formatCurrency(Number(v.valor_a_pagar || 0))}
                    </div>
                    {Number(v.desconto) > 0 && (
                      <div className="text-[10px] font-mono text-amber-600">
                        -{formatCurrency(Number(v.desconto))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-3 mt-1 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(220 10% 46%)" }}>TOTAL INVESTIDO</span>
              <span className="text-base font-bold font-mono" style={{ color: "hsl(220 20% 18%)" }}>
                {formatCurrency(analysis.totalVendas)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ QUICK ACCESS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">
        <button onClick={() => onNavigate("cr")} className="qa-card p-3 md:p-4 text-left hover:shadow-md active:scale-[0.98] transition-all group">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="h-3.5 w-3.5" style={{ color: "hsl(262 60% 55%)" }} />
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "hsl(262 60% 55%)" }}>CR</span>
          </div>
          {cadastro ? (
            <>
              <div className="text-[11px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
                CR: {cadastro.numero_cr || "Sem nº"}
              </div>
              <div className={`text-[9px] font-bold mt-0.5 ${urgencyColor(daysUntil(cadastro.validade_cr))}`}>
                {cadastro.validade_cr ? `Val: ${formatDate(cadastro.validade_cr)}` : "Sem validade"}
              </div>
            </>
          ) : (
            <div className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>Não cadastrado</div>
          )}
        </button>

        <button onClick={() => onNavigate("armas")} className="qa-card p-3 md:p-4 text-left hover:shadow-md active:scale-[0.98] transition-all group">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Crosshair className="h-3.5 w-3.5" style={{ color: "hsl(190 80% 42%)" }} />
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "hsl(190 80% 42%)" }}>ARMAS</span>
          </div>
          <div className="text-[11px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
            {crafs.length} CRAFs · {gtes.length} GTEs
          </div>
        </button>

        <button onClick={() => onNavigate("dados")} className="qa-card p-3 md:p-4 text-left hover:shadow-md active:scale-[0.98] transition-all group">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Eye className="h-3.5 w-3.5" style={{ color: "hsl(38 92% 50%)" }} />
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "hsl(38 92% 50%)" }}>FILIAÇÕES</span>
          </div>
          <div className="text-[11px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
            {filiacoes.length} {filiacoes.length === 1 ? "filiação" : "filiações"}
          </div>
        </button>
      </div>
    </div>
  );
}
