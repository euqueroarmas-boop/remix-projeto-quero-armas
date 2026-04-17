import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, User, Phone, Mail, MapPin, LogOut, Calendar, DollarSign,
  CheckCircle, Clock, XCircle, AlertTriangle, Activity, FileText,
  Crosshair, CreditCard, ChevronRight, Bell, Target, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try { const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR"); } catch { return d; }
};
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  try { const p = new Date(d); return isNaN(p.getTime()) ? null : Math.ceil((p.getTime() - Date.now()) / 86400000); } catch { return null; }
};
const urgencyColor = (d: number | null) => d === null ? "text-slate-400" : d < 0 ? "text-red-600" : d <= 30 ? "text-red-500" : d <= 90 ? "text-amber-500" : "text-emerald-600";
const urgencyBg = (d: number | null) => d === null ? "bg-slate-50 border-slate-200" : d < 0 ? "bg-red-50/60 border-red-200/60" : d <= 30 ? "bg-red-50/60 border-red-200/60" : d <= 90 ? "bg-amber-50/60 border-amber-200/60" : "bg-emerald-50/60 border-emerald-200/60";
const urgencyLabel = (d: number | null) => d === null ? "SEM DATA" : d < 0 ? `VENCIDO HÁ ${Math.abs(d)}D` : d === 0 ? "VENCE HOJE" : `${d}D RESTANTES`;


interface ExpiringDoc { label: string; date: string | null; days: number | null; category: string; }

function SectionCard({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function QAClientePortalPage() {
  const navigate = useNavigate();
  const { map: SERVICO_MAP } = useQAServicosMap();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<any>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [examesCliente, setExamesCliente] = useState<any[]>([]);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/quero-armas/area-do-cliente/login", { replace: true }); return; }

        // Check client profile
        const { data: profile } = await supabase
          .from("qa_usuarios_perfis" as any)
          .select("*")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (!profile) { toast.error("Perfil não encontrado."); navigate("/quero-armas/area-do-cliente/login", { replace: true }); return; }

        setUserName((profile as any).nome || user.email || "");

        // Find client by CPF from user email or profile
        const cpfDigits = (user.email || "").replace(/\D/g, "");
        let clienteData: any = null;

        // Try by user_id linkage first, then by CPF match
        const { data: clienteByCpf } = await supabase
          .from("qa_clientes" as any)
          .select("*")
          .eq("cpf", cpfDigits)
          .maybeSingle();

        if (clienteByCpf) {
          clienteData = clienteByCpf;
        } else {
          // Try matching by email
          const { data: clienteByEmail } = await supabase
            .from("qa_clientes" as any)
            .select("*")
            .eq("email", user.email)
            .maybeSingle();
          clienteData = clienteByEmail;
        }

        if (!clienteData) { setLoading(false); return; }
        setCliente(clienteData);

        const clienteId = getClienteFK(clienteData);

        // Load sub-data in parallel. Exames usam o ID REAL do cliente (não o id_legado),
        // pois qa_exames_cliente.cliente_id referencia qa_clientes.id.
        const clienteIdReal = clienteData.id;
        // Carrega vendas primeiro, depois itens via venda_id (qa_itens_venda NÃO possui cliente_id).
        const [vRes, crRes, cfRes, gtRes, flRes, exRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("*").eq("cliente_id", clienteId).order("data_cadastro", { ascending: false }),
          supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", clienteId).maybeSingle(),
          supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteId),
          supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteId),
          supabase.from("qa_filiacoes" as any).select("*").eq("cliente_id", clienteId),
          supabase.from("qa_exames_cliente" as any)
            .select("id, tipo, data_realizacao, data_vencimento, observacoes")
            .eq("cliente_id", clienteIdReal)
            .order("data_realizacao", { ascending: false }),
        ]);

        const vendasData = (vRes.data as any[]) ?? [];
        setVendas(vendasData);

        // Itens só pertencem ao cliente se sua venda_id estiver nas vendas dele.
        let itensData: any[] = [];
        if (vendasData.length > 0) {
          const vendaIds = vendasData.map((v: any) => getVendaFK(v));
          const { data: iData } = await supabase
            .from("qa_itens_venda" as any)
            .select("*")
            .in("venda_id", vendaIds);
          itensData = (iData as any[]) ?? [];
        }
        setItens(itensData);
        setCadastro(crRes.data);
        setCrafs((cfRes.data as any[]) ?? []);
        setGtes((gtRes.data as any[]) ?? []);
        setFiliacoes((flRes.data as any[]) ?? []);

        // Pega apenas o exame mais recente de cada tipo (psicologico, tiro)
        const exames = (exRes.data as any[]) ?? [];
        const latestByTipo = new Map<string, any>();
        for (const e of exames) {
          if (!latestByTipo.has(e.tipo)) latestByTipo.set(e.tipo, e);
        }
        setExamesCliente(Array.from(latestByTipo.values()));
      } catch (e: any) {
        console.error("[Portal] load error:", e);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/quero-armas/area-do-cliente/login", { replace: true });
  };

  const analysis = useMemo(() => {
    if (!cliente) return null;
    const totalServicos = itens.length;
    const concluidos = itens.filter((i: any) => i.status === "CONCLUÍDO" || i.status === "DEFERIDO").length;
    const emAndamento = itens.filter((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
    const totalVendas = vendas.reduce((a: number, v: any) => a + Number(v.valor_a_pagar || 0), 0);

    const expDocs: ExpiringDoc[] = [];
    if (cadastro) {
      if (cadastro.validade_cr) expDocs.push({ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntil(cadastro.validade_cr), category: "CR" });
    }
    // Exames psicológico e tiro: SEMPRE usar qa_exames_cliente (data_vencimento = data_realizacao + 1 ano).
    // Os campos legados validade_laudo_psicologico / validade_exame_tiro foram descontinuados
    // porque historicamente armazenavam a data de realização, não o vencimento real.
    examesCliente.forEach((e: any) => {
      const dias = daysUntil(e.data_vencimento);
      expDocs.push({
        label: e.tipo === "psicologico" ? "Laudo Psicológico" : "Exame de Tiro",
        date: e.data_vencimento,
        days: dias,
        category: "EXAME",
      });
    });
    crafs.forEach((cr: any) => { if (cr.data_validade) expDocs.push({ label: `CRAF — ${cr.nome_arma || "Arma"}`, date: cr.data_validade, days: daysUntil(cr.data_validade), category: "CRAF" }); });
    gtes.forEach((g: any) => { if (g.data_validade) expDocs.push({ label: `GTE — ${g.nome_arma || "Arma"}`, date: g.data_validade, days: daysUntil(g.data_validade), category: "GTE" }); });
    expDocs.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    const alerts = expDocs.filter(d => d.days !== null && d.days <= 90);

    return { totalServicos, concluidos, emAndamento, totalVendas, expDocs, alerts };
  }, [cliente, vendas, itens, crafs, gtes, cadastro, examesCliente]);

  // Timeline
  const timeline = useMemo(() => {
    const events: { date: string; label: string; icon: any; color: string }[] = [];
    vendas.forEach((v: any) => events.push({ date: v.data_cadastro || v.created_at, label: `Serviço contratado — ${formatCurrency(Number(v.valor_a_pagar || 0))}`, icon: CreditCard, color: "hsl(230 80% 56%)" }));
    itens.forEach((it: any) => {
      if (it.data_protocolo) events.push({ date: it.data_protocolo, label: `${SERVICO_MAP[it.servico_id] || "Serviço"} — Protocolado`, icon: FileText, color: "hsl(38 92% 50%)" });
      if (it.data_deferimento) events.push({ date: it.data_deferimento, label: `${SERVICO_MAP[it.servico_id] || "Serviço"} — Deferido`, icon: CheckCircle, color: "hsl(152 60% 42%)" });
    });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.slice(0, 12);
  }, [vendas, itens]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="text-center max-w-sm">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-700">Perfil não vinculado</h2>
          <p className="text-sm text-slate-500 mt-2">Seu cadastro ainda não foi vinculado a um perfil de cliente. Entre em contato conosco para ativar seu acesso.</p>
          <Button onClick={handleLogout} variant="outline" className="mt-6">Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* ═══ TOP BAR ═══ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(230 80% 96%)" }}>
              <Shield className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: "hsl(220 20% 18%)" }}>Quero Armas</span>
              <span className="text-[10px] text-slate-400 block">Área do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-slate-500 hidden sm:block">{userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 px-3 text-[11px] text-slate-500 hover:text-red-500">
              <LogOut className="h-3.5 w-3.5 mr-1" /> SAIR
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ═══ WELCOME HEADER ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(230 80% 56%), hsl(262 60% 55%))" }} />
          <div className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
                <User className="h-6 w-6" style={{ color: "hsl(230 80% 56%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold" style={{ color: "hsl(220 20% 18%)" }}>Olá, {cliente.nome_completo.split(" ")[0]}!</h1>
                <p className="text-[12px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>Aqui está o resumo completo do seu atendimento conosco.</p>
              </div>
            </div>
            {/* Quick stats */}
            {analysis && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
                {[
                  { label: "SERVIÇOS", value: analysis.totalServicos, color: "hsl(230 80% 56%)", icon: Target },
                  { label: "EM ANDAMENTO", value: analysis.emAndamento, color: "hsl(38 92% 50%)", icon: Activity },
                  { label: "CONCLUÍDOS", value: analysis.concluidos, color: "hsl(152 60% 42%)", icon: CheckCircle },
                  { label: "INVESTIDO", value: formatCurrency(analysis.totalVendas), color: "hsl(220 20% 25%)", icon: DollarSign },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: `${s.color}06` }}>
                      <Icon className="h-4 w-4 shrink-0" style={{ color: s.color }} />
                      <div>
                        <div className="text-sm font-bold" style={{ color: "hsl(220 20% 18%)" }}>{s.value}</div>
                        <div className="text-[9px] font-bold tracking-wider" style={{ color: s.color }}>{s.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ ALERTS ═══ */}
        {analysis && analysis.alerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200/60 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                {analysis.alerts.length} {analysis.alerts.length === 1 ? "ALERTA" : "ALERTAS"}
              </span>
            </div>
            <div className="space-y-1.5">
              {analysis.alerts.map((a, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${urgencyBg(a.days)}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${urgencyColor(a.days)}`} />
                    <span className="text-[11px] font-medium text-slate-700 truncate">{a.label}</span>
                  </div>
                  <span className={`text-[9px] font-bold shrink-0 ${urgencyColor(a.days)}`}>{urgencyLabel(a.days)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SERVICES ═══ */}
        <SectionCard icon={Target} title="Meus Serviços" color="hsl(230 80% 56%)">
          {itens.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">Nenhum serviço contratado.</p>
          ) : (
            <div className="space-y-2">
              {itens.map((it: any) => {
                const done = it.status === "CONCLUÍDO" || it.status === "DEFERIDO";
                const bad = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(it.status);
                const progress = done ? 100 : bad ? 0 : 60;
                return (
                  <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:shadow-sm transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      done ? "bg-emerald-50" : bad ? "bg-red-50" : "bg-amber-50"
                    }`}>
                      {done ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : bad ? <XCircle className="h-4 w-4 text-red-500" /> : <Zap className="h-4 w-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-slate-800 truncate">
                        {SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`}
                      </div>
                      {it.numero_processo && <div className="text-[10px] text-slate-500 font-mono">{it.numero_processo}</div>}
                      <div className="w-full h-1 rounded-full bg-slate-100 mt-1.5">
                        <div className="h-full rounded-full" style={{
                          width: `${progress}%`,
                          background: done ? "hsl(152 60% 42%)" : bad ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)",
                        }} />
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      done ? "text-emerald-700 bg-emerald-50" : bad ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"
                    }`}>{it.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ═══ DOCUMENTS ═══ */}
        {analysis && analysis.expDocs.length > 0 && (
          <SectionCard icon={Calendar} title="Documentos e Validades" color="hsl(262 60% 55%)">
            <div className="space-y-2">
              {analysis.expDocs.map((doc, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${urgencyBg(doc.days)}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/70 text-slate-500">{doc.category}</span>
                      <span className="text-[11px] font-semibold text-slate-800 truncate">{doc.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">{formatDate(doc.date)}</span>
                    <span className={`text-[9px] font-bold ${urgencyColor(doc.days)}`}>{urgencyLabel(doc.days)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ═══ FINANCIAL ═══ */}
        {vendas.length > 0 && (
          <SectionCard icon={DollarSign} title="Financeiro" color="hsl(152 60% 42%)">
            <div className="space-y-2">
              {vendas.map((v: any) => {
                const vItens = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
                return (
                  <div key={v.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-slate-200/60">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-800">
                        {formatDate(v.data_cadastro)} — {vItens.length} {vItens.length === 1 ? "serviço" : "serviços"}
                      </div>
                      {v.forma_pagamento && <div className="text-[10px] text-slate-500">{v.forma_pagamento}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-bold font-mono text-slate-800">{formatCurrency(Number(v.valor_a_pagar || 0))}</div>
                      {Number(v.desconto) > 0 && <div className="text-[10px] text-amber-600 font-mono">-{formatCurrency(Number(v.desconto))}</div>}
                    </div>
                  </div>
                );
              })}
              {analysis && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">TOTAL</span>
                  <span className="text-base font-bold font-mono text-slate-800">{formatCurrency(analysis.totalVendas)}</span>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ═══ TIMELINE ═══ */}
        {timeline.length > 0 && (
          <SectionCard icon={Activity} title="Linha do Tempo" color="hsl(190 80% 42%)">
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-200" />
              <div className="space-y-3">
                {timeline.map((ev, i) => {
                  const Icon = ev.icon;
                  return (
                    <div key={i} className="relative flex items-start gap-3">
                      <div className="absolute -left-3.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center z-10" style={{ background: `${ev.color}18` }}>
                        <Icon className="h-2.5 w-2.5" style={{ color: ev.color }} />
                      </div>
                      <div className="flex-1 pl-4">
                        <div className="text-[11px] font-medium text-slate-700">{ev.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(ev.date)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-300 tracking-wider">Quero Armas · Área do Cliente · Acesso seguro e auditado</p>
        </div>
      </main>
    </div>
  );
}
