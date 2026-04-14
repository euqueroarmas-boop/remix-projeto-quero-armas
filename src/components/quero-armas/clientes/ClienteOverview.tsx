import { useMemo } from "react";
import {
  AlertTriangle, ShoppingBag, Crosshair, Shield, Calendar,
  DollarSign, Clock, CheckCircle, XCircle, TrendingUp,
} from "lucide-react";

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
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

const SERVICO_MAP: Record<number, string> = {
  2: "Posse PF", 3: "Porte PF", 4: "Lions Gun", 5: "COMBO Autoriz.", 6: "COMBO CRAF",
  7: "COMBO GTE", 8: "Apost. Atual.", 9: "Apost. Mudança", 10: "Apost. 2º End.",
  11: "Curso Pistola", 12: "Curso Cal.12", 13: "Mudança Serv.", 14: "Reg. Recarga",
  15: "Autoriz. Compra", 16: "Reg. Arma", 17: "GTE Avulso", 18: "GTE", 20: "CR EB", 21: "VIP Pistola",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  } catch { return null; }
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days < 0) return "text-red-600";
  if (days <= 30) return "text-red-500";
  if (days <= 90) return "text-amber-500";
  return "text-emerald-500";
}

function urgencyBg(days: number | null): string {
  if (days === null) return "bg-slate-50 border-slate-200";
  if (days < 0) return "bg-red-50 border-red-200";
  if (days <= 30) return "bg-red-50 border-red-200";
  if (days <= 90) return "bg-amber-50 border-amber-200";
  return "bg-emerald-50 border-emerald-200";
}

function urgencyLabel(days: number | null): string {
  if (days === null) return "Sem data";
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return "Vence hoje";
  return `${days}d restantes`;
}

interface ExpiringDoc {
  label: string;
  date: string | null;
  days: number | null;
  category: string;
}

export default function ClienteOverview({ cliente, vendas, itens, crafs, gtes, filiacoes, cadastro, onNavigate }: Props) {
  const analysis = useMemo(() => {
    // Services analysis
    const totalServicos = itens.length;
    const concluidos = itens.filter((i: any) => i.status === "CONCLUÍDO" || i.status === "DEFERIDO").length;
    const emAndamento = itens.filter((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const cancelados = itens.filter((i: any) => ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;

    // Financial
    const totalVendas = vendas.reduce((acc: number, v: any) => acc + Number(v.valor_a_pagar || 0), 0);
    const totalDescontos = vendas.reduce((acc: number, v: any) => acc + Number(v.desconto || 0), 0);

    // Arms
    const totalArmas = crafs.length + gtes.length;

    // Expiring documents
    const expDocs: ExpiringDoc[] = [];

    // CR expirations
    if (cadastro) {
      if (cadastro.validade_cr) {
        expDocs.push({ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntil(cadastro.validade_cr), category: "CR" });
      }
      if (cadastro.validade_laudo_psicologico) {
        expDocs.push({ label: "Laudo Psicológico", date: cadastro.validade_laudo_psicologico, days: daysUntil(cadastro.validade_laudo_psicologico), category: "CR" });
      }
      if (cadastro.validade_exame_tiro) {
        expDocs.push({ label: "Exame de Tiro", date: cadastro.validade_exame_tiro, days: daysUntil(cadastro.validade_exame_tiro), category: "CR" });
      }
    }

    // CRAF expirations
    crafs.forEach((cr: any) => {
      if (cr.data_validade) {
        expDocs.push({ label: `CRAF — ${cr.nome_arma || cr.nome_craf || "Arma"}`, date: cr.data_validade, days: daysUntil(cr.data_validade), category: "CRAF" });
      }
    });

    // GTE expirations
    gtes.forEach((g: any) => {
      if (g.data_validade) {
        expDocs.push({ label: `GTE — ${g.nome_arma || g.nome_gte || "Arma"}`, date: g.data_validade, days: daysUntil(g.data_validade), category: "GTE" });
      }
    });

    // Filiações expirations
    filiacoes.forEach((f: any) => {
      if (f.validade_filiacao) {
        expDocs.push({ label: `Filiação — ${f.nome_filiacao || `Clube #${f.clube_id}`}`, date: f.validade_filiacao, days: daysUntil(f.validade_filiacao), category: "Filiação" });
      }
    });

    // Item expirations (data_vencimento on itens_venda)
    itens.forEach((it: any) => {
      if (it.data_vencimento) {
        expDocs.push({ label: `Serviço — ${SERVICO_MAP[it.servico_id] || `#${it.servico_id}`}`, date: it.data_vencimento, days: daysUntil(it.data_vencimento), category: "Serviço" });
      }
    });

    // Sort by urgency
    expDocs.sort((a, b) => {
      if (a.days === null && b.days === null) return 0;
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

    const alerts = expDocs.filter(d => d.days !== null && d.days <= 90);

    return { totalServicos, concluidos, emAndamento, cancelados, totalVendas, totalDescontos, totalArmas, expDocs, alerts };
  }, [vendas, itens, crafs, gtes, filiacoes, cadastro]);

  const cards = [
    { icon: ShoppingBag, label: "Serviços Contratados", value: analysis.totalServicos, sub: `${analysis.concluidos} concluídos`, color: "hsl(230 80% 56%)", bg: "hsl(230 80% 97%)", tab: "servicos" },
    { icon: Clock, label: "Em Andamento", value: analysis.emAndamento, sub: analysis.cancelados > 0 ? `${analysis.cancelados} cancelados` : "nenhum cancelado", color: "hsl(38 92% 50%)", bg: "hsl(38 92% 97%)", tab: "servicos" },
    { icon: Crosshair, label: "Armas Registradas", value: analysis.totalArmas, sub: `${crafs.length} CRAFs • ${gtes.length} GTEs`, color: "hsl(262 60% 55%)", bg: "hsl(262 60% 97%)", tab: "armas" },
    { icon: DollarSign, label: "Total Investido", value: `R$ ${analysis.totalVendas.toLocaleString("pt-BR")}`, sub: analysis.totalDescontos > 0 ? `R$ ${analysis.totalDescontos.toLocaleString("pt-BR")} em descontos` : "sem descontos", color: "hsl(152 60% 40%)", bg: "hsl(152 60% 96%)", tab: "servicos" },
  ];

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      {analysis.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              {analysis.alerts.length} {analysis.alerts.length === 1 ? "Alerta" : "Alertas"} de Vencimento
            </span>
          </div>
          <div className="space-y-1.5">
            {analysis.alerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-amber-900">{a.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700">{formatDate(a.date)}</span>
                  <span className={`font-bold ${a.days !== null && a.days < 0 ? "text-red-600" : "text-amber-600"}`}>
                    {urgencyLabel(a.days)}
                  </span>
                </div>
              </div>
            ))}
            {analysis.alerts.length > 5 && (
              <div className="text-[10px] text-amber-600 text-center pt-1">
                + {analysis.alerts.length - 5} alertas adicionais
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => onNavigate(c.tab)}
              className="qa-card p-4 text-left hover:shadow-md transition-all group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: c.bg }}>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <div className="text-lg font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                {c.value}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "hsl(220 10% 46%)" }}>{c.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Services timeline */}
      <div className="qa-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: "hsl(230 80% 56%)" }}>
            Serviços Contratados
          </h3>
          {itens.length > 0 && (
            <button onClick={() => onNavigate("servicos")} className="text-[10px] font-medium hover:underline" style={{ color: "hsl(230 80% 56%)" }}>
              Ver todos →
            </button>
          )}
        </div>
        {itens.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "hsl(220 10% 62%)" }}>
            Nenhum serviço contratado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {itens.slice(0, 8).map((it: any) => {
              const statusDone = it.status === "CONCLUÍDO" || it.status === "DEFERIDO";
              const statusBad = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(it.status);
              return (
                <div key={it.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border" style={{ borderColor: "hsl(220 13% 93%)" }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    statusDone ? "bg-emerald-100" : statusBad ? "bg-red-100" : "bg-amber-100"
                  }`}>
                    {statusDone ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> :
                     statusBad ? <XCircle className="h-3.5 w-3.5 text-red-500" /> :
                     <Clock className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>
                      {SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>
                      {it.numero_processo && <span className="font-mono">{it.numero_processo}</span>}
                      {it.data_protocolo && <span>Prot: {formatDate(it.data_protocolo)}</span>}
                      {it.data_deferimento && <span>Def: {formatDate(it.data_deferimento)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-medium ${
                      statusDone ? "text-emerald-700 bg-emerald-50" :
                      statusBad ? "text-red-700 bg-red-50" :
                      "text-amber-700 bg-amber-50"
                    }`}>{it.status}</span>
                    <span className="text-[11px] font-mono" style={{ color: "hsl(220 20% 25%)" }}>
                      R$ {Number(it.valor || 0).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              );
            })}
            {itens.length > 8 && (
              <button onClick={() => onNavigate("servicos")} className="w-full text-center py-2 text-[11px] font-medium hover:underline" style={{ color: "hsl(230 80% 56%)" }}>
                + {itens.length - 8} serviços adicionais
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document expirations */}
      {analysis.expDocs.length > 0 && (
        <div className="qa-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
            <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: "hsl(230 80% 56%)" }}>
              Vencimentos e Validades
            </h3>
          </div>
          <div className="space-y-2">
            {analysis.expDocs.map((doc, i) => (
              <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg border ${urgencyBg(doc.days)}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/60 shrink-0" style={{ color: "hsl(220 10% 46%)" }}>
                    {doc.category}
                  </span>
                  <span className="text-[11px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>
                    {doc.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 46%)" }}>{formatDate(doc.date)}</span>
                  <span className={`text-[10px] font-bold ${urgencyColor(doc.days)}`}>
                    {urgencyLabel(doc.days)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial summary */}
      {vendas.length > 0 && (
        <div className="qa-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4" style={{ color: "hsl(152 60% 40%)" }} />
            <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: "hsl(152 60% 40%)" }}>
              Histórico Financeiro
            </h3>
          </div>
          <div className="space-y-2">
            {vendas.map((v: any) => {
              const vItens = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
              return (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg border" style={{ borderColor: "hsl(220 13% 93%)" }}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
                      Venda #{v.id_legado ?? v.id} — {formatDate(v.data_cadastro)}
                    </div>
                    <div className="text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>
                      {vItens.length} {vItens.length === 1 ? "serviço" : "serviços"} • {v.forma_pagamento || "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                      R$ {Number(v.valor_a_pagar || 0).toLocaleString("pt-BR")}
                    </div>
                    {Number(v.desconto) > 0 && (
                      <div className="text-[10px] text-amber-600">
                        -R$ {Number(v.desconto).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
              <span className="text-[11px] font-bold" style={{ color: "hsl(220 10% 46%)" }}>TOTAL</span>
              <span className="text-[13px] font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                R$ {analysis.totalVendas.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick info */}
      <div className="grid grid-cols-2 gap-3">
        {/* CR Status */}
        <button onClick={() => onNavigate("cr")} className="qa-card p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4" style={{ color: "hsl(262 60% 55%)" }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "hsl(262 60% 55%)" }}>CR</span>
          </div>
          {cadastro ? (
            <>
              <div className="text-[12px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
                CR: {cadastro.numero_cr || "Sem número"}
              </div>
              <div className={`text-[10px] font-bold mt-1 ${urgencyColor(daysUntil(cadastro.validade_cr))}`}>
                {cadastro.validade_cr ? `Validade: ${formatDate(cadastro.validade_cr)}` : "Sem validade"}
              </div>
            </>
          ) : (
            <div className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>Não cadastrado</div>
          )}
        </button>

        {/* Filiações */}
        <button onClick={() => onNavigate("dados")} className="qa-card p-4 text-left hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4" style={{ color: "hsl(190 80% 42%)" }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "hsl(190 80% 42%)" }}>Filiações</span>
          </div>
          <div className="text-[12px] font-medium" style={{ color: "hsl(220 20% 18%)" }}>
            {filiacoes.length} {filiacoes.length === 1 ? "filiação" : "filiações"}
          </div>
          {filiacoes.length > 0 && (
            <div className="text-[10px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>
              {filiacoes.map((f: any) => f.nome_filiacao || `Clube #${f.clube_id}`).join(", ")}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
