import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, User, Phone, Mail, MapPin, LogOut, Calendar, DollarSign,
  CheckCircle, Clock, XCircle, AlertTriangle, Activity, FileText,
  Crosshair, CreditCard, ChevronRight, Bell, Target, Zap, History,
  FolderArchive, Plus, Trash2, Sparkles, BadgeCheck, Paperclip,
} from "lucide-react";
import { HistoricoAtualizacoes } from "@/components/quero-armas/clientes/HistoricoAtualizacoes";
import { Button } from "@/components/ui/button";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { usePrivateStorageUrl } from "@/hooks/usePrivateStorageUrl";
import { Camera, Wand2 } from "lucide-react";
import { ArsenalView } from "@/components/quero-armas/arsenal/ArsenalView";
import { Crosshair as CrosshairIcon, LayoutDashboard } from "lucide-react";
import { ForcePasswordChangeModal } from "@/components/quero-armas/clientes/ForcePasswordChangeModal";

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

function ClientAvatar({
  url,
  name,
  hasPhoto,
  isTactical,
}: {
  url: string | null;
  name: string;
  hasPhoto: boolean;
  isTactical: boolean;
}) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const ring = isTactical
    ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-white"
    : "ring-1 ring-slate-200 ring-offset-2 ring-offset-white";

  if (hasPhoto && url) {
    return (
      <div className="relative shrink-0">
        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden ${ring} shadow-md`}>
          <img src={url} alt={name} className="w-full h-full object-cover" />
        </div>
        {isTactical && (
          <span
            title="Avatar tático"
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div
        className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-md text-white font-bold text-xl tracking-wider ring-1 ring-amber-200/50"
        style={{ background: "linear-gradient(135deg, hsl(220 25% 18%), hsl(220 30% 28%))" }}
      >
        <span className="text-amber-300">{initials || "?"}</span>
      </div>
      <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-900 shadow-md">
        <Camera className="h-3 w-3" />
      </span>
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
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [meusDocs, setMeusDocs] = useState<any[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [cadastroPub, setCadastroPub] = useState<{ selfie_path: string | null } | null>(null);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<"arsenal" | "resumo">("arsenal");
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const avatarPath: string | null =
    (cliente as any)?.avatar_tatico_path || cadastroPub?.selfie_path || null;
  const avatarUrl = usePrivateStorageUrl("qa-cadastro-selfies", avatarPath);
  const hasTacticalAvatar = !!(cliente as any)?.avatar_tatico_path;
  const hasAnyPhoto = !!avatarPath;

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/area-do-cliente/login", { replace: true }); return; }

        // Força troca de senha no primeiro acesso
        if (user.user_metadata?.password_change_required === true) {
          setMustChangePassword(true);
        }

        const [{ data: profile }, { data: customerLink }] = await Promise.all([
          supabase
            .from("qa_usuarios_perfis" as any)
            .select("*")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .maybeSingle(),
          supabase
            .from("customers")
            .select("id, email, cnpj_ou_cpf, razao_social, responsavel")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle(),
        ]);

        if (!profile && !customerLink) { toast.error("Perfil não encontrado."); navigate("/area-do-cliente/login", { replace: true }); return; }

        setUserName((profile as any)?.nome || customerLink?.responsavel || customerLink?.razao_social || user.email || "");
        setCustomerId(customerLink?.id ?? null);

        const cpfDigits = String(customerLink?.cnpj_ou_cpf || "").replace(/\D/g, "");
        const lookupEmail = (customerLink?.email || user.email || "").trim();
        let clienteData: any = null;

        const { data: clienteByCpf } = cpfDigits
          ? await supabase
              .from("qa_clientes" as any)
              .select("*")
              .eq("cpf", cpfDigits)
              .limit(1)
              .maybeSingle()
          : { data: null };

        if (clienteByCpf) {
          clienteData = clienteByCpf;
        } else {
          const { data: clienteByEmail } = lookupEmail
            ? await supabase
                .from("qa_clientes" as any)
                .select("*")
                .ilike("email", lookupEmail)
                .limit(1)
                .maybeSingle()
            : { data: null };
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

        // Documentos enviados/rastreados para o cliente (hub pessoal + vínculo direto do QA)
        const docFilters = [
          clienteData.id ? `qa_cliente_id.eq.${clienteData.id}` : "",
          customerLink?.id ? `customer_id.eq.${customerLink.id}` : "",
        ].filter(Boolean).join(",");
        if (docFilters) {
          const { data: docsData } = await supabase
            .from("qa_documentos_cliente" as any)
            .select("*")
            .or(docFilters)
            .order("created_at", { ascending: false });
          setMeusDocs((docsData as any[]) ?? []);
        }

        // Selfie do cadastro público (para avatar) — tenta CPF e cai para email
        let cadPubData: any = null;
        if (cpfDigits) {
          const { data } = await supabase
            .from("qa_cadastro_publico" as any)
            .select("selfie_path")
            .eq("cpf", cpfDigits)
            .not("selfie_path", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          cadPubData = data;
        }
        if (!cadPubData?.selfie_path && lookupEmail) {
          const { data } = await supabase
            .from("qa_cadastro_publico" as any)
            .select("selfie_path")
            .ilike("email", lookupEmail)
            .not("selfie_path", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          cadPubData = data;
        }
        setCadastroPub((cadPubData as any) || null);
      } catch (e: any) {
        console.error("[Portal] load error:", e);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, docsReloadKey]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/area-do-cliente/login", { replace: true });
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
    // Documentos enviados pelo próprio cliente (hub pessoal)
    meusDocs.forEach((d: any) => {
      if (!d.data_validade) return;
      const tipoRaw = (d.tipo_documento || "outro").toLowerCase();
      const cat = tipoRaw.toUpperCase();
      // Evita duplicar o CR já presente em qa_cadastro_cr (validade_cr)
      if (tipoRaw === "cr" && cadastro?.validade_cr) return;
      // Para CRAFs, prioriza modelo (mais curto) sobre marca para não truncar em mobile
      const armaInfo = d.arma_modelo
        ? ` — ${d.arma_modelo}${d.arma_calibre ? ` ${d.arma_calibre}` : ""}`
        : "";
      expDocs.push({
        label: `${cat}${armaInfo}`,
        date: d.data_validade,
        days: daysUntil(d.data_validade),
        category: cat,
      });
    });
    expDocs.sort((a, b) => {
      // CR sempre primeiro
      if (a.category === "CR" && b.category !== "CR") return -1;
      if (b.category === "CR" && a.category !== "CR") return 1;
      return (a.days ?? 999) - (b.days ?? 999);
    });
    const alerts = expDocs.filter(d => d.days !== null && d.days <= 90);

    return { totalServicos, concluidos, emAndamento, totalVendas, expDocs, alerts };
  }, [cliente, vendas, itens, crafs, gtes, cadastro, examesCliente, meusDocs]);

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
      <div data-tactical-portal className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div data-tactical-portal className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Shield className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold">Perfil não vinculado</h2>
          <p className="text-sm mt-2">Seu cadastro ainda não foi vinculado a um perfil de cliente. Entre em contato conosco para ativar seu acesso.</p>
          <Button onClick={handleLogout} variant="outline" className="mt-6">Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-tactical-portal className="min-h-screen">
      <ForcePasswordChangeModal
        open={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      {/* ═══ TOP BAR ═══ */}
      <header
        className="sticky top-0 z-50 border-b border-[#c9a961]/25 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)]"
        style={{ background: "linear-gradient(180deg, rgba(8,8,8,0.96) 0%, rgba(4,4,4,0.92) 100%)" }}
      >
        {/* Faixa superior tática (corner ticks + scanline) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,169,97,0.55), transparent)" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)" }} />
        <div className="relative max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          {/* Identidade */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Insígnia tática com cantos */}
            <div className="relative hidden sm:block">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#c9a961]/50"
                style={{
                  background: "linear-gradient(135deg, rgba(201,169,97,0.22), rgba(201,169,97,0.04) 60%, rgba(0,0,0,0.6))",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5), 0 0 18px -8px rgba(201,169,97,0.55)",
                }}
              >
                <CrosshairIcon className="h-5 w-5" style={{ color: "#c9a961" }} />
              </div>
              {/* corner ticks */}
              <span className="pointer-events-none absolute -left-1 -top-1 h-2 w-2 border-l border-t border-[#c9a961]/70" />
              <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 border-r border-t border-[#c9a961]/70" />
              <span className="pointer-events-none absolute -left-1 -bottom-1 h-2 w-2 border-l border-b border-[#c9a961]/70" />
              <span className="pointer-events-none absolute -right-1 -bottom-1 h-2 w-2 border-r border-b border-[#c9a961]/70" />
            </div>

            {/* Divisor vertical dourado */}
            <div className="hidden sm:block h-10 w-px" style={{ background: "linear-gradient(180deg, transparent, rgba(201,169,97,0.55), transparent)" }} />

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-[#c9a961] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.34em]" style={{ color: "#c9a961" }}>
                  Área do Cliente
                </span>
              </div>
              <span
                className="truncate text-[14px] md:text-[15px] font-black uppercase tracking-[0.06em] text-white leading-tight"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.6)" }}
              >
                {userName || "Cliente"}
              </span>
              <span className="text-[9px] uppercase tracking-[0.28em] text-white/35 leading-tight font-semibold">
                · Arsenal Inteligente ·
              </span>
            </div>
          </div>

          {/* Ações */}
          <button
            type="button"
            onClick={handleLogout}
            className="group relative inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-md border border-[#c9a961]/30 bg-black/40 px-3.5 text-[10px] font-black uppercase tracking-[0.28em] text-white/85 transition hover:border-red-400/60 hover:text-red-300"
            style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5)" }}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,169,97,0.6), transparent)" }} />
            <LogOut className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /> Sair
          </button>
        </div>
        {/* Faixa inferior dourada */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(201,169,97,0.45), transparent)" }} />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ═══ TABS NAVIGATION ═══ */}
        <div className="sticky top-[60px] z-30 -mx-4 mb-1 border-b border-slate-200/70 bg-gradient-to-b from-white/95 to-white/85 px-4 py-2 backdrop-blur-md">
          <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("arsenal")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "arsenal"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <CrosshairIcon className="h-3.5 w-3.5" /> Arsenal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("resumo")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "resumo"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Resumo
            </button>
          </div>
        </div>

        {activeTab === "arsenal" && cliente && analysis && (
          <ArsenalView
            clienteId={cliente.id}
            clienteNome={cliente.nome_completo}
            crafs={crafs}
            gtes={gtes}
            cadastroCr={cadastro}
            meusDocs={meusDocs}
            expDocs={analysis.expDocs}
            alerts={analysis.alerts as any}
            onOpenAddDoc={() => setShowAddDoc(true)}
          />
        )}

        {activeTab === "resumo" && (
        <>
        {/* ═══ WELCOME HEADER ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(230 80% 56%), hsl(262 60% 55%))" }} />
          <div className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <ClientAvatar
                url={avatarUrl}
                name={cliente.nome_completo}
                hasPhoto={hasAnyPhoto}
                isTactical={hasTacticalAvatar}
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold" style={{ color: "hsl(220 20% 18%)" }}>Olá, {cliente.nome_completo.split(" ")[0]}!</h1>
                <p className="text-[12px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>Aqui está o resumo completo do seu atendimento conosco.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!hasAnyPhoto ? (
                    <Button
                      size="sm"
                      onClick={() => navigate("/quero-armas/cadastro/foto")}
                      className="h-8 px-3 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" /> Enviar minha foto
                    </Button>
                  ) : !hasTacticalAvatar ? (
                    <Button
                      size="sm"
                      disabled={generatingAvatar}
                      onClick={async () => {
                        if (!cliente?.cpf) return;
                        setGeneratingAvatar(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("qa-gerar-avatar-tatico", {
                            body: { cpf: cliente.cpf },
                          });
                          if (error) throw error;
                          if ((data as any)?.error) throw new Error((data as any).error);
                          toast.success("Avatar tático criado!");
                          setCliente({ ...cliente, avatar_tatico_path: (data as any).avatar_path });
                        } catch (e: any) {
                          toast.error(e?.message || "Falha ao gerar avatar.");
                        } finally {
                          setGeneratingAvatar(false);
                        }
                      }}
                      className="h-8 px-3 text-[11px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                    >
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                      {generatingAvatar ? "Criando avatar..." : "Gerar avatar tático com IA"}
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-slate-900/5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                      <BadgeCheck className="h-3 w-3 text-emerald-600" /> Avatar tático ativo
                    </span>
                  )}
                </div>
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

        {/* ═══ HISTÓRICO DE ATUALIZAÇÕES ═══ */}
        {cliente?.id && (
          <SectionCard icon={History} title="Histórico de Atualizações" color="hsl(220 65% 48%)">
            <HistoricoAtualizacoes clienteId={cliente.id} showSnapshot={false} />
          </SectionCard>
        )}

        {/* ═══ MEU HUB DE DOCUMENTOS (CR, CRAF, GT, AC...) ═══ */}
        {customerId && (
          <SectionCard icon={FolderArchive} title="Meu Hub de Documentos" color="hsl(280 60% 50%)">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-slate-500 leading-snug max-w-[70%]">
                Cadastre seus CR, CRAF/SINARM, GT, GTE e Autorizações de Compra. A IA pode preencher os campos a partir da foto.
              </p>
              <Button
                size="sm"
                onClick={() => setShowAddDoc(true)}
                className="h-8 text-[10px] uppercase tracking-wider"
                style={{ background: "hsl(280 60% 50%)" }}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>

            {meusDocs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <FolderArchive className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400">Nenhum documento cadastrado ainda.</p>
                <p className="text-[10px] text-slate-400 mt-1">Use o botão acima para começar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {meusDocs.map((d: any) => {
                  const dias = daysUntil(d.data_validade);
                  const cat = (d.tipo_documento || "outro").toUpperCase();
                  return (
                    <div key={d.id} className={`p-3 rounded-xl border ${urgencyBg(dias)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/70 text-slate-600">{cat}</span>
                            {d.validado_admin && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5">
                                <BadgeCheck className="h-2.5 w-2.5" /> VALIDADO
                              </span>
                            )}
                            {d.ia_status === "sugerido" && !d.validado_admin && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> IA
                              </span>
                            )}
                            {d.arquivo_storage_path && (
                              <span className="text-[9px] text-slate-500 inline-flex items-center gap-0.5">
                                <Paperclip className="h-2.5 w-2.5" /> anexo
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] font-semibold text-slate-800 mt-1">
                            {d.numero_documento || "Sem número"}
                            {d.arma_modelo && (
                              <span className="font-normal text-slate-500"> · {d.arma_marca} {d.arma_modelo}{d.arma_calibre ? ` (${d.arma_calibre})` : ""}</span>
                            )}
                          </div>
                          {d.orgao_emissor && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{d.orgao_emissor}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-500 font-mono">{formatDate(d.data_validade)}</div>
                          <div className={`text-[9px] font-bold ${urgencyColor(dias)}`}>{urgencyLabel(dias)}</div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Remover este documento?")) return;
                            const { error } = await supabase
                              .from("qa_documentos_cliente" as any)
                              .delete()
                              .eq("id", d.id);
                            if (error) { toast.error("Erro ao remover."); return; }
                            toast.success("Documento removido.");
                            setDocsReloadKey((k) => k + 1);
                          }}
                          className="text-[10px] text-slate-400 hover:text-red-500 inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-300 tracking-wider">Quero Armas · Área do Cliente · Acesso seguro e auditado</p>
        </div>
        </>
        )}
      </main>

      {customerId && (
        <ClienteDocsHubModal
          open={showAddDoc}
          onClose={() => setShowAddDoc(false)}
          customerId={customerId}
          qaClienteId={cliente?.id ?? null}
          onSaved={() => setDocsReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
