import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, User, Phone, Mail, MapPin, LogOut, Calendar, DollarSign,
  CheckCircle, Clock, XCircle, AlertTriangle, Activity, FileText,
  Crosshair, CreditCard, ChevronRight, Bell, Target, Zap, History,
  FolderArchive, Plus, Trash2, Sparkles, BadgeCheck, Paperclip,
  ShoppingBag, FileStack, Image as ImageIcon, ClipboardCheck, Menu,
  MessageCircle, Settings, Wallet, BriefcaseBusiness, Grid2X2, HelpCircle,
} from "lucide-react";
import { HistoricoAtualizacoes } from "@/components/quero-armas/clientes/HistoricoAtualizacoes";
import { CentralAjudaCliente } from "@/components/quero-armas/cliente/CentralAjudaCliente";
import { Button } from "@/components/ui/button";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { Camera, Wand2 } from "lucide-react";
import { ArsenalView } from "@/components/quero-armas/arsenal/ArsenalView";
import { ClienteProcessosSection } from "@/components/quero-armas/processos/ClienteProcessosSection";
import { Crosshair as CrosshairIcon, LayoutDashboard, Upload } from "lucide-react";
import { ForcePasswordChangeModal } from "@/components/quero-armas/clientes/ForcePasswordChangeModal";
import { ensureClienteFromAuthUser } from "@/lib/quero-armas/ensureClienteFromAuthUser";
import ArmaManualForm from "@/components/quero-armas/arsenal/ArmaManualForm";
import { getQAServiceDisplayName } from "@/lib/quero-armas/serviceDisplay";
import ClienteHealthBadge from "@/components/quero-armas/clientes/ClienteHealthBadge";
import { calcularPrazosProcessuais, corPrazo } from "@/lib/quero-armas/prazosProcessuais";
import { computeChecklistMetrics, isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";
import logoColor from "@/assets/logo-color.png";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try { const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR"); } catch { return d; }
};
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  try { const p = new Date(d); return isNaN(p.getTime()) ? null : Math.ceil((p.getTime() - Date.now()) / 86400000); } catch { return null; }
};
const urgencyColor = (d: number | null) => d === null ? "text-slate-400" : d < 0 ? "text-red-600" : d <= 30 ? "text-red-500" : d <= 90 ? "text-[#7A1F2B]" : "text-emerald-600";
const urgencyBg = (d: number | null) => d === null ? "bg-slate-50 border-slate-200" : d < 0 ? "bg-red-50/60 border-red-200/60" : d <= 30 ? "bg-red-50/60 border-red-200/60" : d <= 90 ? "bg-[#7A1F2B]/60 border-[#7A1F2B]/60" : "bg-emerald-50/60 border-emerald-200/60";
const urgencyLabel = (d: number | null) => d === null ? "SEM DATA" : d < 0 ? `VENCIDO HÁ ${Math.abs(d)}D` : d === 0 ? "VENCE HOJE" : `${d}D RESTANTES`;


interface ExpiringDoc { label: string; date: string | null; days: number | null; category: string; }

interface ClienteAvatarOficial {
  url: string | null;
  path: string | null;
  bucket: string | null;
  source: "qa_clientes.imagem" | "qa_cadastro_publico.selfie_path" | "avatar_tatico_path" | null;
  hasPhoto: boolean;
}

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
    ? "ring-2 ring-[#8E2532] ring-offset-2 ring-offset-white"
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
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#8E2532] to-[#641722] text-white shadow-md"
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
        className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-md text-white font-bold text-xl tracking-wider ring-1 ring-[#7A1F2B]/50"
        style={{ background: "linear-gradient(135deg, hsl(220 25% 18%), hsl(220 30% 28%))" }}
      >
        <span className="text-[#B43543]">{initials || "?"}</span>
      </div>
      <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#8E2532] text-slate-900 shadow-md">
        <Camera className="h-3 w-3" />
      </span>
    </div>
  );
}

export default function QAClientePortalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { map: SERVICO_MAP } = useQAServicosMap();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<any>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [catalogoByServicoId, setCatalogoByServicoId] = useState<Record<number, { service_slug: string; nome: string }>>({});
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [examesCliente, setExamesCliente] = useState<any[]>([]);
  const [userName, setUserName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [meusDocs, setMeusDocs] = useState<any[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showArmaManual, setShowArmaManual] = useState(false);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [activeSection, setActiveSection] = useState<"resumo" | "contratacoes" | "documentos" | "arsenal" | "mensagens" | "financeiro" | "configuracoes">("resumo");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [avatarOficial, setAvatarOficial] = useState<ClienteAvatarOficial | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [processos, setProcessos] = useState<any[]>([]);
  const [processoDocs, setProcessoDocs] = useState<any[]>([]);

  // Fonte oficial do header: função autenticada resolve e assina, em ordem:
  // qa_clientes.imagem → qa_cadastro_publico.selfie_path → avatar_tatico_path.
  const avatarUrl = avatarOficial?.url || null;
  const hasTacticalAvatar = avatarOficial?.source === "avatar_tatico_path";
  const hasAnyPhoto = avatarOficial?.hasPhoto || Boolean((cliente as any)?.imagem || (cliente as any)?.avatar_tatico_path);
  const avatarResolving = Boolean((cliente as any)?.id) && (avatarLoading || avatarOficial === null);
  const activeTab: "arsenal" | "resumo" | null = activeSection === "arsenal" ? "arsenal" : activeSection === "resumo" ? "resumo" : null;
  const setActiveTab = (tab: "arsenal" | "resumo") => setActiveSection(tab);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/area-do-cliente/login", { replace: true }); return; }

        // Força troca de senha no primeiro acesso
        if (user.user_metadata?.password_change_required === true) {
          setMustChangePassword(true);
        }

        const [{ data: profile }, { data: authLink }] = await Promise.all([
          supabase
            .from("qa_usuarios_perfis" as any)
            .select("*")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .maybeSingle(),
          supabase
            .from("cliente_auth_links" as any)
            .select("id, status, email, qa_cliente_id, customer_id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("activated_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!profile && !authLink) { toast.error("Perfil não encontrado."); navigate("/area-do-cliente/login", { replace: true }); return; }

        let customerLink: any = null;
        if ((authLink as any)?.customer_id) {
          const { data } = await supabase
            .from("customers" as any)
            .select("id, email, cnpj_ou_cpf, razao_social, responsavel")
            .eq("id", (authLink as any).customer_id)
            .maybeSingle();
          customerLink = data;
        }

        let clienteData: any = null;
        if ((authLink as any)?.qa_cliente_id) {
          const { data } = await supabase
            .from("qa_clientes" as any)
            .select("*")
            .eq("id", (authLink as any).qa_cliente_id)
            .maybeSingle();
          clienteData = data;
        }

        const cpfDigits = String(customerLink?.cnpj_ou_cpf || clienteData?.cpf || "").replace(/\D/g, "");
        const lookupEmail = ((authLink as any)?.email || customerLink?.email || clienteData?.email || user.email || "").trim();

        if (!clienteData) {
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
        }

        // FASE 2 — Fundação de identidade.
        // Se ainda não temos cliente nesta sessão, garante vínculo via RPC segura
        // (auth.uid() é resolvido server-side; nunca enviamos user_id daqui).
        if (!clienteData) {
          try {
            const ensured = await ensureClienteFromAuthUser({
              email: lookupEmail || user.email || null,
              cpf: cpfDigits || null,
              nome:
                (profile as any)?.nome ||
                customerLink?.responsavel ||
                customerLink?.razao_social ||
                null,
            });
            if (ensured.needs_manual_review) {
              toast.error(
                "Encontramos mais de um cadastro com seus dados. Nossa equipe foi avisada para vincular manualmente.",
              );
              setLoading(false);
              return;
            }
            if (ensured.qa_cliente_id) {
              const { data: ensuredCliente } = await supabase
                .from("qa_clientes" as any)
                .select("*")
                .eq("id", ensured.qa_cliente_id)
                .maybeSingle();
              clienteData = ensuredCliente;
            }
          } catch (e: any) {
            console.error("[QAClientePortalPage] ensureClienteFromAuthUser falhou", e);
          }
        }
        if (!clienteData) { setLoading(false); return; }
        setCliente(clienteData);
        setUserName((profile as any)?.nome || clienteData?.nome_completo || customerLink?.responsavel || customerLink?.razao_social || user.email || "");
        setCustomerId(customerLink?.id ?? null);

        // FK para vendas/itens (regra legada: qa_vendas.cliente_id → qa_clientes.id_legado).
        const clienteIdVendas = getClienteFK(clienteData);
        // ID REAL do cliente. As tabelas qa_cadastro_cr / qa_crafs / qa_gtes / qa_filiacoes
        // possuem RLS owner que filtra por `cliente_id = qa_current_cliente_id(auth.uid())`,
        // e `cliente_auth_links.qa_cliente_id` armazena o ID REAL (qa_clientes.id).
        // Portanto, no portal do cliente, devemos consultar essas tabelas pelo ID REAL,
        // não pelo id_legado — caso contrário a RLS bloqueia silenciosamente os registros.
        const clienteIdReal = clienteData.id;
        // Carrega vendas primeiro, depois itens via venda_id (qa_itens_venda NÃO possui cliente_id).
        const [vRes, crRes, cfRes, gtRes, flRes, exRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("*").eq("cliente_id", clienteIdVendas).order("data_cadastro", { ascending: false }),
          // Cliente pode ter mais de um CR (ex.: CR antigo vencido + CR novo). Mostramos o mais recente.
          supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", clienteIdReal).order("id", { ascending: false }).limit(1),
          supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteIdReal),
          supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteIdReal),
          supabase.from("qa_filiacoes" as any).select("*").eq("cliente_id", clienteIdReal),
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
          const servicoIds = Array.from(new Set(itensData.map((i: any) => Number(i.servico_id)).filter(Number.isFinite)));
          if (servicoIds.length > 0) {
            const { data: catalogoData } = await supabase
              .from("qa_servicos_catalogo" as any)
              .select("servico_id, slug, nome")
              .in("servico_id", servicoIds)
              .eq("ativo", true);
            const catalogMap: Record<number, { service_slug: string; nome: string }> = {};
            ((catalogoData as any[]) ?? []).forEach((c: any) => {
              if (Number.isFinite(Number(c.servico_id)) && !catalogMap[Number(c.servico_id)]) {
                catalogMap[Number(c.servico_id)] = { service_slug: c.slug, nome: c.nome };
              }
            });
            setCatalogoByServicoId(catalogMap);
          } else {
            setCatalogoByServicoId({});
          }
        }
        setItens(itensData);
        setCadastro(Array.isArray(crRes.data) ? (crRes.data[0] ?? null) : crRes.data);
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
            .neq("status", "excluido")
            .order("created_at", { ascending: false });
          setMeusDocs((docsData as any[]) ?? []);
        }

        // Processos canônicos do cliente (fonte real de progresso/etapa/checklist)
        const { data: procsData } = await supabase
          .from("qa_processos" as any)
          .select("id, cliente_id, venda_id, servico_id, servico_nome, servico_slug, status, pagamento_status, data_criacao, prazo_critico_data, primeiro_doc_aprovado_em")
          .eq("cliente_id", clienteIdReal)
          .order("data_criacao", { ascending: false });
        const procsList = (procsData as any[]) ?? [];
        setProcessos(procsList);
        if (procsList.length > 0) {
          const procIds = procsList.map((p) => p.id);
          const { data: procDocsData } = await supabase
            .from("qa_processo_documentos" as any)
            .select("id, processo_id, status, obrigatorio, tipo_documento, etapa, ordem")
            .in("processo_id", procIds);
          setProcessoDocs((procDocsData as any[]) ?? []);
        } else {
          setProcessoDocs([]);
        }

      } catch (e: any) {
        console.error("[Portal] load error:", e);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, docsReloadKey]);

  useEffect(() => {
    const clienteId = Number((cliente as any)?.id);
    if (!Number.isFinite(clienteId)) {
      setAvatarOficial(null);
      setAvatarLoading(false);
      return;
    }

    let active = true;
    setAvatarLoading(true);
    void supabase.functions
      .invoke("qa-cliente-avatar", { body: { cliente_id: clienteId } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("[Portal] avatar oficial não resolvido:", error.message);
          setAvatarOficial({ url: null, path: null, bucket: null, source: null, hasPhoto: false });
          return;
        }
        setAvatarOficial((data as ClienteAvatarOficial) || { url: null, path: null, bucket: null, source: null, hasPhoto: false });
      })
      .finally(() => {
        if (active) setAvatarLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cliente?.id, cliente?.imagem, cliente?.avatar_tatico_path, docsReloadKey]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/area-do-cliente/login", { replace: true });
  };

  // Realtime: ouve mudanças nos próprios documentos (admin aprovou/reprovou/excluiu)
  // e nas tabelas de arsenal — recarrega imediatamente.
  useEffect(() => {
    const clienteIdReal = cliente?.id ?? null;
    if (!clienteIdReal && !customerId) return;
    const channel = supabase
      .channel(`portal-cliente-${clienteIdReal ?? customerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_documentos_cliente" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.qa_cliente_id === clienteIdReal || row.customer_id === customerId) {
            setDocsReloadKey((k) => k + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_crafs", filter: `cliente_id=eq.${clienteIdReal}` },
        () => setDocsReloadKey((k) => k + 1),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_cadastro_cr", filter: `cliente_id=eq.${clienteIdReal}` },
        () => setDocsReloadKey((k) => k + 1),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qa_clientes", filter: `id=eq.${clienteIdReal}` },
        () => setDocsReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cliente?.id, customerId]);

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
    itens.forEach((it: any) => {
      if (!it.data_vencimento) return;
      const servicoLabel = getQAServiceDisplayName({ ...catalogoByServicoId[Number(it.servico_id)], servico_id: it.servico_id, servico_nome: SERVICO_MAP[it.servico_id] }) || `#${it.servico_id}`;
      expDocs.push({ label: `Serviço — ${servicoLabel}`, date: it.data_vencimento, days: daysUntil(it.data_vencimento), category: "SERVIÇO" });
    });
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
  }, [cliente, vendas, itens, crafs, gtes, cadastro, examesCliente, meusDocs, catalogoByServicoId, SERVICO_MAP]);

  // ─── Snapshot canônico de processos/checklist/prazos do cliente ─────────────
  // Tudo derivado das fontes oficiais: qa_processos, qa_processo_documentos e
  // qa_itens_venda via helper canônico de prazos processuais.
  const processoSnap = useMemo(() => {
    const STATUS_CONCLUIDO = new Set(["concluido", "deferido", "finalizado"]);
    const STATUS_ENCERRADO = new Set(["concluido", "deferido", "finalizado", "indeferido", "cancelado", "desistiu", "restituido"]);
    const ETAPA_LABELS: Record<string, string> = {
      endereco: "Comprovação de endereço",
      base: "Documentação básica",
      complementar: "Documentação complementar",
      tecnico: "Exames técnicos",
      final: "Revisão final",
      antecedentes: "Antecedentes criminais",
      declaracoes: "Declarações e compromissos",
      renda: "Condição profissional",
    };
    const STATUS_LABELS: Record<string, string> = {
      aguardando_pagamento: "Aguardando pagamento",
      aguardando_documentos: "Aguardando documentação",
      aguardando_documentacao: "Aguardando documentação",
      em_validacao_ia: "Validando documentos",
      em_revisao_humana: "Em revisão pela equipe",
      aprovado: "Documentação aprovada",
      enviado_ao_orgao: "Protocolado no órgão",
      protocolado: "Protocolado no órgão",
      em_analise_orgao: "Em análise pelo órgão",
      deferido: "Deferido",
      indeferido: "Indeferido",
      concluido: "Concluído",
      finalizado: "Concluído",
    };

    const ativos = processos.filter((p) => !STATUS_ENCERRADO.has(String(p.status || "").toLowerCase()));
    const concluidos = processos.filter((p) => STATUS_CONCLUIDO.has(String(p.status || "").toLowerCase())).length;
    const STATUS_ANDAMENTO = new Set(["em_validacao_ia", "em_revisao_humana", "aprovado", "enviado_ao_orgao", "protocolado", "em_analise_orgao"]);
    const emAndamento = ativos.filter((p) => STATUS_ANDAMENTO.has(String(p.status || "").toLowerCase())).length;

    // Pendências reais do checklist usando helpers canônicos.
    const pendentesChecklist = processoDocs.filter((d) => d.obrigatorio && isChecklistPendente(d.status)).length;
    const reprovadosChecklist = processoDocs.filter((d) => ["invalido", "reprovado", "divergente", "rejeitado", "pendente_reenvio"].includes(String(d.status || "").toLowerCase())).length;
    const aguardandoAcaoCliente = processoDocs.filter((d) => d.obrigatorio && isChecklistPendente(d.status)).length;
    const prazosProcessuais = calcularPrazosProcessuais(itens.map((it: any) => ({
      id: it.id,
      servico_id: it.servico_id ?? null,
      servico_nome: getQAServiceDisplayName({ ...catalogoByServicoId[Number(it.servico_id)], servico_id: it.servico_id, servico_nome: SERVICO_MAP[it.servico_id] }) || null,
      status: it.status ?? null,
      numero_processo: it.numero_processo ?? null,
      data_notificacao: it.data_notificacao ?? null,
      data_indeferimento: it.data_indeferimento ?? null,
      data_restituicao: it.data_restituicao ?? null,
      data_recurso_administrativo: it.data_recurso_administrativo ?? null,
      data_indeferimento_recurso: it.data_indeferimento_recurso ?? null,
    })));

    // Processo principal = primeiro ativo (mais recente já vem ordenado por data_criacao desc)
    const principal = ativos[0] || null;
    let principalView: {
      processo: any;
      nome: string;
      statusLabel: string;
      statusBadge: string;
      etapaLabel: string;
      progresso: number;
      total: number;
      aprovados: number;
      pendentes: number;
      prazoCritico: string | null;
    } | null = null;
    if (principal) {
      const meus = processoDocs.filter((d) => d.processo_id === principal.id);
      const metrics = computeChecklistMetrics(meus);
      const pendenteAtual = meus
        .filter((d) => d.obrigatorio && isChecklistPendente(d.status))
        .sort((a, b) => Number(a.ordem ?? 999) - Number(b.ordem ?? 999))[0] || null;
      const statusKey = String(principal.status || "").toLowerCase();
      const statusLabel = STATUS_LABELS[statusKey] || statusKey.replace(/_/g, " ").toUpperCase();
      const etapaKey = String(pendenteAtual?.etapa || "").toLowerCase();
      const etapa = pendenteAtual
        ? ETAPA_LABELS[etapaKey] || String(pendenteAtual.tipo_documento || "Documento pendente").replace(/_/g, " ").toUpperCase()
        : statusLabel;
      principalView = {
        processo: principal,
        nome: principal.servico_nome || "Serviço",
        statusLabel,
        statusBadge: statusKey,
        etapaLabel: etapa,
        progresso: metrics.progresso,
        total: metrics.total,
        aprovados: metrics.cumpridos,
        pendentes: metrics.pendentes,
        prazoCritico: principal.prazo_critico_data || null,
      };
    }

    return {
      processos,
      ativos,
      concluidos,
      emAndamento,
      pendentesChecklist,
      reprovadosChecklist,
      aguardandoAcaoCliente,
      prazosProcessuais,
      principal: principalView,
    };
  }, [processos, processoDocs, itens, catalogoByServicoId, SERVICO_MAP]);

  // Timeline
  const timeline = useMemo(() => {
    const events: { date: string; label: string; icon: any; color: string }[] = [];
    vendas.forEach((v: any) => events.push({ date: v.data_cadastro || v.created_at, label: `Serviço contratado — ${formatCurrency(Number(v.valor_a_pagar || 0))}`, icon: CreditCard, color: "hsl(352 60% 30%)" }));
    itens.forEach((it: any) => {
      const servicoLabel = getQAServiceDisplayName({ ...catalogoByServicoId[Number(it.servico_id)], servico_id: it.servico_id, servico_nome: SERVICO_MAP[it.servico_id] }) || "Serviço";
      if (it.data_protocolo) events.push({ date: it.data_protocolo, label: `${servicoLabel} — Protocolado`, icon: FileText, color: "hsl(38 92% 50%)" });
      if (it.data_deferimento) events.push({ date: it.data_deferimento, label: `${servicoLabel} — Deferido`, icon: CheckCircle, color: "hsl(152 60% 42%)" });
    });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.slice(0, 12);
  }, [vendas, itens, catalogoByServicoId, SERVICO_MAP]);

  const navItems = useMemo(() => [
    { key: "resumo" as const, label: "Resumo", icon: Grid2X2, path: "/area-do-cliente" },
    { key: "contratacoes" as const, label: "Contratações", icon: BriefcaseBusiness, path: "/area-do-cliente/contratacoes" },
    { key: "documentos" as const, label: "Documentos", icon: FileText, path: "/area-do-cliente/documentos" },
    { key: "arsenal" as const, label: "Arsenal", icon: Shield, path: "/area-do-cliente/arsenal" },
    { key: "mensagens" as const, label: "Mensagens", icon: MessageCircle, path: "/area-do-cliente/mensagens" },
    { key: "financeiro" as const, label: "Financeiro", icon: Wallet, path: "/area-do-cliente/financeiro" },
    { key: "configuracoes" as const, label: "Configurações", icon: Settings, path: "/area-do-cliente/configuracoes" },
  ], []);

  useEffect(() => {
    const match = navItems.find((item) => item.path !== "/area-do-cliente" && location.pathname.startsWith(item.path));
    setActiveSection(match?.key ?? "resumo");
  }, [location.pathname, navItems]);

  const goSection = (key: typeof navItems[number]["key"]) => {
    const item = navItems.find((n) => n.key === key);
    if (!item) return;
    setActiveSection(key);
    setMobileNavOpen(false);
    navigate(item.path);
  };

  const resumoState = useMemo(() => {
    const cadastroIncompleto = !cliente?.cep || !cliente?.endereco || !cliente?.telefone;
    const docsHubEmAnalise = meusDocs.filter((d: any) => d.status === "pendente_aprovacao").length;
    const docsHubReprovados = meusDocs.filter((d: any) => d.status === "reprovado").length;
    const checklistReproc = processoDocs.find((d) => d.obrigatorio && ["invalido", "reprovado", "divergente", "rejeitado", "pendente_reenvio"].includes(String(d.status || "").toLowerCase()));
    const checklistPend = processoDocs.find((d) => d.obrigatorio && isChecklistPendente(d.status));
    const prazoCritico = processoSnap.prazosProcessuais[0] || null;
    const docVencidoHoje = analysis?.expDocs.find((d) => d.days !== null && (d.days as number) <= 0) || null;
    const totalPendencias = processoSnap.aguardandoAcaoCliente + docsHubReprovados + (prazoCritico ? 1 : 0) + (docVencidoHoje ? 1 : 0);
    let proximaAcao: { titulo: string; descricao: string; icon: any; onClick: () => void } | null = null;
    if (prazoCritico && prazoCritico.diasRestantes <= 10) {
      proximaAcao = {
        titulo: `${prazoCritico.evento}: manifestar-se até ${formatDate(prazoCritico.dataLimite)}`,
        descricao: `${prazoCritico.servicoNome || "Processo"} · ${prazoCritico.statusLabel}`,
        icon: AlertTriangle,
        onClick: () => goSection("contratacoes"),
      };
    } else if (docVencidoHoje) {
      proximaAcao = {
        titulo: `Renovar ${docVencidoHoje.label}`,
        descricao: docVencidoHoje.days === 0 ? "Vence hoje — regularize imediatamente." : `Vencido há ${Math.abs(docVencidoHoje.days as number)} dia(s).`,
        icon: AlertTriangle,
        onClick: () => goSection("documentos"),
      };
    } else if (checklistReproc) {
      proximaAcao = { titulo: `Reenviar ${String(checklistReproc.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, descricao: "Documento obrigatório reprovado precisa ser corrigido.", icon: FileText, onClick: () => setShowAddDoc(true) };
    } else if (docsHubReprovados > 0) {
      proximaAcao = { titulo: "Reenviar documento reprovado", descricao: `${docsHubReprovados} documento(s) do hub precisam de correção.`, icon: FileText, onClick: () => setShowAddDoc(true) };
    } else if (checklistPend) {
      proximaAcao = { titulo: `Enviar ${String(checklistPend.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, descricao: "Documento obrigatório para dar andamento.", icon: FileText, onClick: () => setShowAddDoc(true) };
    } else if (cadastroIncompleto) {
      proximaAcao = { titulo: "Completar seu cadastro", descricao: "Endereço, telefone e dados básicos faltando.", icon: User, onClick: () => navigate("/cadastro/foto", { state: { cpf: cliente?.cpf || "", returnTo: "/area-do-cliente" } }) };
    } else if (docsHubEmAnalise > 0) {
      proximaAcao = { titulo: "Aguardar análise da equipe", descricao: `${docsHubEmAnalise} documento(s) em validação operacional.`, icon: Clock, onClick: () => goSection("documentos") };
    }
    return { cadastroIncompleto, docsHubEmAnalise, docsHubReprovados, checklistReproc, checklistPend, prazoCritico, totalPendencias, proximaAcao, aguardandoDocsReal: processoSnap.aguardandoAcaoCliente > 0 || docsHubReprovados > 0 };
  }, [cliente, meusDocs, processoDocs, processoSnap, analysis, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900">Perfil não vinculado</h2>
          <p className="text-sm mt-2 text-slate-600">Seu cadastro ainda não foi vinculado a um perfil de cliente. Entre em contato conosco para ativar seu acesso.</p>
          <Button onClick={handleLogout} variant="outline" className="mt-6">Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ForcePasswordChangeModal
        open={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      {/* ═══ TOP BAR — Premium Light ═══ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Foto oficial do cliente (mesma fonte de /clientes) com fallback p/ iniciais */}
            <button
              type="button"
              onClick={() => navigate("/cadastro/foto", { state: { cpf: (cliente as any)?.cpf || "", returnTo: "/area-do-cliente" } })}
              title={hasAnyPhoto ? "Alterar minha foto" : "Enviar minha foto"}
              className="relative shrink-0 group rounded-full focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]"
            >
              {avatarUrl ? (
                <div className="h-12 w-12 sm:h-[52px] sm:w-[52px] overflow-hidden rounded-full ring-1 ring-slate-200 shadow-sm bg-white">
                  <img
                    src={avatarUrl}
                    alt={userName || "Foto do cliente"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : avatarResolving ? (
                <div className="flex h-12 w-12 sm:h-[52px] sm:w-[52px] items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 shadow-sm">
                  <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-[#7A1F2B] animate-spin" />
                </div>
              ) : (
                <div className="flex h-12 w-12 sm:h-[52px] sm:w-[52px] items-center justify-center rounded-full bg-[#7A1F2B] ring-1 ring-slate-200 shadow-sm">
                  <span className="font-serif text-[16px] sm:text-[18px] font-bold tracking-wider text-white">
                    {(userName || "C")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                </div>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7A1F2B] ring-2 ring-white shadow-sm opacity-90 group-hover:opacity-100 transition"
                title={hasAnyPhoto ? "Alterar foto" : "Enviar foto"}
              >
                <Camera className="h-2.5 w-2.5 text-white" />
              </span>
            </button>

            <div className="hidden sm:block h-11 w-px bg-slate-200" />

            <div className="flex flex-col min-w-0 leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Área do Cliente
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.16em] text-slate-700">
                  {cliente?.tipo_cliente === "cliente_app" ? "Arsenal Gratuito" : "Premium"}
                </span>
              </div>

              <h1 className="mt-1 truncate text-[15px] sm:text-[17px] font-bold uppercase text-slate-900 tracking-wide">
                {(() => {
                  const parts = (userName || "Cliente").trim().split(/\s+/).filter(Boolean);
                  if (parts.length <= 1) return parts[0] || "Cliente";
                  return `${parts[0]} ${parts[parts.length - 1]}`;
                })()}
              </h1>

              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-px w-3 bg-slate-300" />
                <span className="text-[8.5px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Arsenal Inteligente
                </span>
                <span className="h-px w-3 bg-slate-300" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 sm:h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 sm:px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ═══ TABS NAVIGATION ═══ */}
        <div className="sticky top-[60px] z-30 -mx-4 mb-1 border-b border-slate-200/70 bg-gradient-to-b from-white/95 to-white/85 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab("arsenal")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  activeTab === "arsenal"
                    ? "bg-[#7A1F2B] text-white shadow-sm"
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
                    ? "bg-[#7A1F2B] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Resumo
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDoc(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#7A1F2B] bg-[#FBF3F4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] shadow-sm hover:bg-[#FBF3F4]"
            >
              <Upload className="h-3.5 w-3.5" /> Enviar documento
            </button>
          </div>
        </div>

        {activeTab === "arsenal" && cliente && analysis && (
          <>
          {(() => {
            const isFree = cliente?.tipo_cliente === "cliente_app";
            const isEmpty =
              (crafs?.length ?? 0) === 0 &&
              (gtes?.length ?? 0) === 0 &&
              (meusDocs?.length ?? 0) === 0 &&
              !cadastro;
            if (!isFree || !isEmpty) return null;
            return (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#7A1F2B] to-zinc-900" />
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[#FBF3F4] text-[#641722] border border-[#E5C2C6] flex items-center justify-center">
                      <CrosshairIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[15px] sm:text-[17px] font-bold uppercase tracking-wide text-slate-900">
                        Comece montando seu Arsenal Digital
                      </h2>
                      <p className="mt-1 text-[12px] sm:text-[13px] leading-relaxed text-slate-600">
                        Cadastre suas armas, documentos e vencimentos para manter tudo organizado em um só lugar. Esta conta é gratuita e não gera cobrança.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setShowArmaManual(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Cadastrar minha primeira arma
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddDoc(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7A1F2B] hover:bg-[#8E2532] text-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition"
                    >
                      <Upload className="h-3.5 w-3.5" /> Enviar documento do acervo
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/area-do-cliente/contratar")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Contratar serviço da Quero Armas
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {[
                      { n: "1", t: "Cadastre suas armas", d: "Registre acervo, modelo, calibre e número de série." },
                      { n: "2", t: "Envie seus documentos", d: "CR, CRAF, GTE, autorizações e comprovantes." },
                      { n: "3", t: "Acompanhe vencimentos", d: "Receba alertas antes que algo expire." },
                      { n: "4", t: "Contrate se precisar", d: "Solicite assessoria diretamente pelo portal." },
                    ].map((step) => (
                      <div key={step.n} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="h-6 w-6 shrink-0 rounded-md bg-white border border-slate-200 text-[#641722] text-[11px] font-bold flex items-center justify-center">{step.n}</span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-slate-900">{step.t}</div>
                          <div className="text-[11px] text-slate-500 leading-snug">{step.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          <ArsenalView
            clienteId={cliente.id}
            clienteNome={cliente.nome_completo}
            clienteCidade={cliente?.cidade ?? null}
            clienteUf={cliente?.estado ?? null}
            crafs={crafs}
            gtes={gtes}
            cadastroCr={cadastro}
            meusDocs={meusDocs}
            expDocs={analysis.expDocs}
            alerts={analysis.alerts as any}
            onOpenAddDoc={() => setShowAddDoc(true)}
            onArsenalChanged={async () => {
              const clienteIdReal = cliente.id;
              const [cfRes, gtRes, dRes] = await Promise.all([
                supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteIdReal),
                supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteIdReal),
                supabase.from("qa_documentos_cliente" as any).select("*").eq("qa_cliente_id", clienteIdReal).neq("status", "excluido").order("created_at", { ascending: false }),
              ]);
              setCrafs((cfRes.data as any[]) ?? []);
              setGtes((gtRes.data as any[]) ?? []);
              setMeusDocs((dRes.data as any[]) ?? []);
            }}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowArmaManual(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#7A1F2B] bg-[#FBF3F4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] shadow-sm hover:bg-[#FBF3F4]"
            >
              <Plus className="h-3.5 w-3.5" /> Cadastrar arma manualmente
            </button>
          </div>
          <ArmaManualForm
            open={showArmaManual}
            onOpenChange={setShowArmaManual}
            qaClienteId={cliente.id}
            defaultEmail={cliente.email}
            defaultCpf={cliente.cpf}
            defaultNome={cliente.nome_completo}
            onSaved={() => { /* dados aparecerão na ficha do admin via view qa_cliente_armas */ }}
          />
          </>
        )}

        {activeTab === "resumo" && (
        <div className="qa-resumo-light space-y-4">
        {/* ═══ HERO — Saudação + Próxima Ação (sem duplicar foto do cliente) ═══ */}
        {(() => {
          const cadastroIncompleto = !cliente?.cep || !cliente?.endereco || !cliente?.telefone;
          const docsHubEmAnalise = meusDocs.filter((d: any) => d.status === "pendente_aprovacao").length;
          const docsHubReprovados = meusDocs.filter((d: any) => d.status === "reprovado").length;
          // Pendências reais = checklist canônico + reprovados do hub + alertas de validade críticos
          const totalPendencias =
            processoSnap.aguardandoAcaoCliente +
            docsHubReprovados +
            (analysis?.alerts.filter((a) => a.days !== null && (a.days as number) <= 30).length || 0);
          const aguardandoDocsReal =
            processoSnap.aguardandoAcaoCliente > 0 || docsHubReprovados > 0;

          // Prioridade canônica:
          // 1) prazo processual crítico / documento vencido
          // 2) reprovado do hub que exige reenvio
          // 3) checklist obrigatório não enviado
          // 4) cadastro incompleto
          // 5) documento em análise (informativo)
          let proximaAcao: { titulo: string; descricao: string; onClick: () => void } | null = null;
          const vencido = analysis?.expDocs.find((d) => d.days !== null && (d.days as number) < 0);
          const venceHoje = analysis?.expDocs.find((d) => d.days === 0);
          const checklistPend = processoDocs.find((d) => d.obrigatorio && ["pendente"].includes(String(d.status || "").toLowerCase()));
          const checklistReproc = processoDocs.find((d) => d.obrigatorio && ["invalido", "reprovado", "divergente", "pendente_reenvio"].includes(String(d.status || "").toLowerCase()));
          if (vencido) {
            proximaAcao = { titulo: `Renovar ${vencido.label}`, descricao: `Vencido há ${Math.abs(vencido.days as number)} dia(s) — regularize com urgência.`, onClick: () => setShowAddDoc(true) };
          } else if (venceHoje) {
            proximaAcao = { titulo: `Renovar ${venceHoje.label}`, descricao: "Vence hoje — providencie a renovação imediatamente.", onClick: () => setShowAddDoc(true) };
          } else if (checklistReproc) {
            const tipo = String(checklistReproc.tipo_documento || "documento").replace(/_/g, " ").toUpperCase();
            proximaAcao = { titulo: `Reenviar ${tipo}`, descricao: "Documento do processo precisa ser corrigido e reenviado.", onClick: () => setShowAddDoc(true) };
          } else if (docsHubReprovados > 0) {
            proximaAcao = { titulo: "Reenviar documento reprovado", descricao: `${docsHubReprovados} documento(s) do hub precisam ser corrigidos.`, onClick: () => setShowAddDoc(true) };
          } else if (checklistPend) {
            const tipo = String(checklistPend.tipo_documento || "documento").replace(/_/g, " ").toUpperCase();
            proximaAcao = { titulo: `Enviar ${tipo}`, descricao: "Documento obrigatório do checklist ainda não enviado.", onClick: () => setShowAddDoc(true) };
          } else if (cadastroIncompleto) {
            proximaAcao = { titulo: "Completar seu cadastro", descricao: "Endereço, telefone e dados básicos faltando.", onClick: () => navigate("/cadastro/foto", { state: { cpf: cliente?.cpf || "", returnTo: "/area-do-cliente" } }) };
          } else if (docsHubEmAnalise > 0) {
            proximaAcao = { titulo: "Aguardando análise", descricao: `${docsHubEmAnalise} documento(s) em análise pela equipe.`, onClick: () => setActiveTab("arsenal") };
          }

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* COL ESQUERDA — Saudação */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(352 60% 30%), hsl(262 60% 55%))" }} />
                <div className="p-5 md:p-6">
                  <h1 className="text-xl md:text-2xl font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                    Olá, {cliente.nome_completo.split(" ")[0]}!
                  </h1>
                  <p className="text-[13px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>
                    Aqui está um resumo do seu atendimento.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cadastroIncompleto && (
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Cadastro incompleto
                      </span>
                    )}
                    {aguardandoDocsReal && (
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-sky-300 bg-sky-50 text-[11px] font-semibold text-sky-800">
                        <Clock className="h-3 w-3" /> Aguardando documentos
                      </span>
                    )}
                    {!cadastroIncompleto && !aguardandoDocsReal && totalPendencias === 0 && (
                      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-800">
                        <CheckCircle className="h-3 w-3" /> Em dia
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-start gap-2 text-[12px]" style={{ color: "hsl(220 10% 45%)" }}>
                    <Shield className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(352 60% 30%)" }} />
                    <p>A Quero Armas cuida de todo o processo para você. Acompanhe suas contratações, documentos e próximas etapas.</p>
                  </div>
                </div>
              </div>

              {/* COL DIREITA — O que você precisa fazer agora */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(38 92% 50%), hsl(28 92% 55%))" }} />
                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <h2 className="text-base md:text-lg font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                    O que você precisa fazer agora
                  </h2>
                  {proximaAcao ? (
                    <button
                      type="button"
                      onClick={proximaAcao.onClick}
                      className="mt-3 group flex items-center gap-3 w-full text-left rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 transition px-4 py-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-[#7A1F2B]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-900">{proximaAcao.titulo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{proximaAcao.descricao}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition" />
                    </button>
                  ) : (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="text-[12px] text-emerald-800 font-semibold">Sem pendências no momento.</div>
                    </div>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FBF3F4] text-[#7A1F2B] text-[11px] font-bold">
                        {totalPendencias}
                      </span>
                      pendências restantes
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("arsenal")}
                      className="text-[11px] font-semibold text-slate-600 underline hover:text-slate-900"
                    >
                      Ver todas
                    </button>
                  </div>
                  {proximaAcao && (
                    <button
                      type="button"
                      onClick={proximaAcao.onClick}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[#7A1F2B] hover:bg-[#641722] text-white text-[12px] font-bold uppercase tracking-wider transition shadow-sm"
                    >
                      Resolver agora <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ KPIs REAIS ═══ */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: "Serviços ativos", sub: "Contratação em andamento", value: processoSnap.ativos.length, color: "hsl(352 60% 30%)", icon: Target },
              { label: "Em andamento", sub: "Aguardando próximas etapas", value: processoSnap.emAndamento, color: "hsl(38 92% 50%)", icon: Activity },
              { label: "Documentos pendentes", sub: "Precisam da sua ação", value: processoSnap.aguardandoAcaoCliente, color: "hsl(262 60% 55%)", icon: FileText },
              { label: "Investido", sub: "Total investido até o momento", value: formatCurrency(analysis.totalVendas), color: "hsl(152 60% 42%)", icon: DollarSign },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}12` }}>
                      <Icon className="h-5 w-5" style={{ color: s.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold" style={{ color: "hsl(220 10% 55%)" }}>{s.label}</div>
                      <div className="text-xl md:text-2xl font-bold mt-0.5" style={{ color: "hsl(220 20% 14%)" }}>{s.value}</div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "hsl(220 10% 60%)" }}>{s.sub}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 3 COLUNAS — Central de documentos | Meu atendimento | Próximos passos ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Central de documentos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold inline-flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
                    <FileText className="h-4 w-4 text-[#7A1F2B]" /> Central de documentos
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                    Acompanhe seus documentos e mantenha tudo em dia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddDoc(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[10px] font-bold uppercase tracking-wider shrink-0"
                >
                  <Upload className="h-3 w-3" /> Enviar
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 flex-1">
              {(() => {
                const pendentes = meusDocs.filter((d: any) => d.status === "pendente_aprovacao").length;
                const enviados = meusDocs.length;
                const aprovados = meusDocs.filter((d: any) => d.status === "aprovado").length;
                const rejeitados = meusDocs.filter((d: any) => d.status === "reprovado").length;
                const cards = [
                  { label: "Pendentes", value: pendentes, color: "hsl(352 60% 30%)", icon: FileText, dot: true },
                  { label: "Enviados", value: enviados, color: "hsl(220 65% 48%)", icon: Upload },
                  { label: "Aprovados", value: aprovados, color: "hsl(152 60% 42%)", icon: CheckCircle },
                  { label: "Rejeitados", value: rejeitados, color: "hsl(0 72% 55%)", icon: XCircle },
                ];
                return cards.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${c.color}14` }}>
                        <Icon className="h-4 w-4" style={{ color: c.color }} />
                      </div>
                      <div className="text-xl font-bold" style={{ color: "hsl(220 20% 14%)" }}>{c.value}</div>
                      <div className="text-[10px] font-semibold mt-0.5 inline-flex items-center gap-1" style={{ color: c.color }}>
                        {c.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />}
                        {c.label}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("arsenal")}
              className="border-t border-slate-100 py-3 px-5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-between"
            >
              Ver todos os documentos <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Meu atendimento */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-[14px] font-bold inline-flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
                <Activity className="h-4 w-4 text-[#7A1F2B]" /> Meu atendimento
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                Acompanhe seu serviço contratado.
              </p>
            </div>
            <div className="p-5 flex-1">
              {(() => {
                const view = processoSnap.principal;
                if (!view) {
                  return (
                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                      <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-[12px] text-slate-500 mb-3">Nenhum serviço contratado ainda.</p>
                      <button
                        type="button"
                        onClick={() => navigate("/area-do-cliente/contratar")}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-bold uppercase tracking-wider"
                      >
                        Contratar serviço
                      </button>
                    </div>
                  );
                }
                const sKey = String(view.processo.status || "").toLowerCase();
                const done = ["concluido", "deferido", "finalizado"].includes(sKey);
                const bad = ["indeferido", "cancelado"].includes(sKey);
                const progress = view.progresso;
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-bold text-slate-900">{view.nome}</div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${done ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {view.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500">Etapa atual</div>
                    <div className="text-[12px] font-semibold text-slate-800">{view.etapaLabel}</div>
                    <div className="mt-3">
                      <div className="w-full h-2 rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: done ? "hsl(152 60% 42%)" : bad ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)" }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-1">
                        <span className="text-slate-500">{view.aprovados} de {view.total} documentos aprovados</span>
                        <span className="font-bold text-slate-700">{progress}%</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider">Início</div>
                        <div className="text-slate-700 font-semibold">{formatDate(view.processo.data_criacao)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider">Prazo crítico</div>
                        <div className="text-slate-700 font-semibold">{view.prazoCritico ? formatDate(view.prazoCritico) : "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400 uppercase tracking-wider">Pendentes</div>
                        <div className="text-slate-900 font-bold">{view.pendentes}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <button
              type="button"
              onClick={() => navigate("/area-do-cliente/contratacoes")}
              className="border-t border-slate-100 py-3 px-5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-between"
            >
              Ver detalhes da contratação <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Próximos passos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-[14px] font-bold inline-flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
                <ClipboardCheck className="h-4 w-4 text-[#7A1F2B]" /> Próximos passos
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                Foque no que precisa ser feito agora.
              </p>
            </div>
            <div className="p-3 flex-1 space-y-1.5">
              {(() => {
                const passos: { icon: any; titulo: string; sub: string; onClick: () => void }[] = [];
                const cadastroIncompleto = !cliente?.cep || !cliente?.endereco || !cliente?.telefone;
                // Prioridade: vencidos/críticos > checklist reprovado > checklist pendente > hub reprovado > cadastro > foto
                analysis?.alerts.filter((a) => a.days !== null && (a.days as number) <= 30).slice(0, 2).forEach((a) => {
                  passos.push({ icon: AlertTriangle, titulo: a.label, sub: urgencyLabel(a.days), onClick: () => setActiveTab("arsenal") });
                });
                processoDocs.filter((d) => d.obrigatorio && ["invalido", "reprovado", "divergente", "pendente_reenvio"].includes(String(d.status || "").toLowerCase())).slice(0, 3).forEach((d) => {
                  passos.push({ icon: AlertTriangle, titulo: `Reenviar ${String(d.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, sub: "Reprovado no checklist", onClick: () => setShowAddDoc(true) });
                });
                processoDocs.filter((d) => d.obrigatorio && String(d.status || "").toLowerCase() === "pendente").slice(0, 3).forEach((d) => {
                  passos.push({ icon: FileText, titulo: `Enviar ${String(d.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, sub: "Obrigatório", onClick: () => setShowAddDoc(true) });
                });
                meusDocs.filter((d: any) => d.status === "reprovado").slice(0, 2).forEach((d: any) => {
                  passos.push({ icon: AlertTriangle, titulo: `Reenviar ${(d.tipo_documento || "documento").toUpperCase()}`, sub: "Reprovado — corrigir", onClick: () => setShowAddDoc(true) });
                });
                if (cadastroIncompleto) passos.push({ icon: User, titulo: "Completar cadastro", sub: "Obrigatório", onClick: () => navigate("/cadastro/foto", { state: { cpf: cliente?.cpf || "", returnTo: "/area-do-cliente" } }) });
                if (!hasAnyPhoto) passos.push({ icon: ImageIcon, titulo: "Enviar foto 3x4", sub: "Documento obrigatório", onClick: () => navigate("/cadastro/foto", { state: { cpf: cliente?.cpf || "", returnTo: "/area-do-cliente" } }) });
                if (passos.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-[12px] text-slate-500">Nada pendente. Tudo em dia!</p>
                    </div>
                  );
                }
                return passos.slice(0, 4).map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={p.onClick}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition group text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#FBF3F4] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#7A1F2B]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-slate-900 truncate">{p.titulo}</div>
                        <div className="text-[10px] text-slate-500 truncate">{p.sub}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
                    </button>
                  );
                });
              })()}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("arsenal")}
              className="border-t border-slate-100 py-3 px-5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-between"
            >
              Ver todas as pendências <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ═══ ALERTS ═══ */}
        {analysis && analysis.alerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#7A1F2B]/60 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-[#7A1F2B]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#641722]">
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

        {/* ═══ PRÓXIMA AÇÃO PRIORITÁRIA — destaque do item mais urgente (≤30d ou vencido) ═══ */}
        {analysis && (() => {
          const prioridade = [...analysis.expDocs]
            .filter((d) => d.days !== null && (d.days as number) <= 30)
            .sort((a, b) => (a.days as number) - (b.days as number))[0];
          if (!prioridade) return null;
          const isVencido = (prioridade.days as number) < 0;
          return (
            <div
              className="relative overflow-hidden rounded-2xl border shadow-sm"
              style={{
                background: isVencido
                  ? "linear-gradient(135deg, hsl(0 80% 97%), hsl(0 60% 99%))"
                  : "linear-gradient(135deg, hsl(38 95% 96%), hsl(38 80% 99%))",
                borderColor: isVencido ? "hsl(0 70% 85%)" : "hsl(38 80% 80%)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: isVencido
                    ? "linear-gradient(90deg, hsl(0 72% 55%), hsl(15 80% 55%))"
                    : "linear-gradient(90deg, hsl(38 92% 50%), hsl(28 92% 55%))",
                }}
              />
              <div className="p-4 md:p-5 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: isVencido ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)",
                    color: "white",
                  }}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: isVencido ? "hsl(0 72% 45%)" : "hsl(28 80% 38%)" }}
                    >
                      Próxima ação prioritária
                    </span>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: "white",
                        color: isVencido ? "hsl(0 72% 45%)" : "hsl(28 80% 38%)",
                      }}
                    >
                      {prioridade.category}
                    </span>
                  </div>
                  <div className="text-[14px] font-bold text-slate-800 truncate">
                    {prioridade.label}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {isVencido
                      ? `Vencido há ${Math.abs(prioridade.days as number)} dia(s) — regularize com urgência.`
                      : `Vence em ${prioridade.days} dia(s) — providencie a renovação.`}
                    {prioridade.date && (
                      <span className="font-mono ml-2 opacity-70">({formatDate(prioridade.date)})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ SERVICES ═══ */}
        {cliente?.id && (
          <SectionCard icon={FolderArchive} title="Central de Documentos" color="hsl(262 70% 55%)">
            <ClienteProcessosSection clienteId={cliente.id} />
          </SectionCard>
        )}

        <SectionCard icon={Target} title="Meus Serviços" color="hsl(352 60% 30%)">
          {/* CTA — Contratar novo serviço */}
          <button
            onClick={() => navigate("/area-do-cliente/contratar")}
            className="w-full mb-3 flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-[#FBF3F4] to-[#7A1F2B]/60 hover:from-[#F1D9DC] hover:to-[#7A1F2B]/60 border border-[#E5C2C6] hover:border-[#B43543] transition group"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#7A1F2B] text-white shrink-0 group-hover:scale-105 transition">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12px] font-bold text-slate-900 uppercase tracking-tight">
                Contratar novo serviço
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                Posse, porte, CRAF, CR, GTE e mais — escolha e agilizamos para você.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#4F121C] shrink-0" />
          </button>
          {/* KPIs — padrão Arsenal Review */}
          {itens.length > 0 && (() => {
            const totalServ = itens.length;
            const concluidos = itens.filter((i: any) => i.status === "CONCLUÍDO" || i.status === "DEFERIDO").length;
            const indeferidos = itens.filter((i: any) => ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(i.status)).length;
            const emAndamento = totalServ - concluidos - indeferidos;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3 text-[10px]">
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Total</div>
                  <div className="text-[14px] font-bold text-slate-800">{totalServ}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Concluídos</div>
                  <div className="text-[14px] font-bold" style={{ color: "hsl(152 60% 28%)" }}>{concluidos}</div>
                </div>
                <div
                  className="rounded-md border px-2 py-1.5"
                  style={{
                    background: emAndamento > 0 ? "hsl(38 92% 50% / 0.10)" : "white",
                    borderColor: emAndamento > 0 ? "hsl(38 92% 50% / 0.40)" : "hsl(220 13% 90%)",
                  }}
                >
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Em andamento</div>
                  <div className="text-[14px] font-bold" style={{ color: emAndamento > 0 ? "hsl(28 92% 32%)" : "hsl(220 10% 50%)" }}>{emAndamento}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Indeferidos</div>
                  <div className="text-[14px] font-bold" style={{ color: "hsl(0 72% 45%)" }}>{indeferidos}</div>
                </div>
              </div>
            );
          })()}
          {itens.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">
              {cliente?.tipo_cliente === "cliente_app"
                ? "Você ainda não contratou serviços da Quero Armas. Quando precisar de posse, porte, CRAF, GTE, CR ou apostilamento, solicite diretamente pelo portal."
                : "Nenhum serviço contratado."}
            </p>
          ) : (
            <div className="space-y-2">
              {itens.map((it: any) => {
                const done = it.status === "CONCLUÍDO" || it.status === "DEFERIDO";
                const bad = ["INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes(it.status);
                const progress = done ? 100 : bad ? 0 : 60;
                return (
                  <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:shadow-sm transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      done ? "bg-emerald-50" : bad ? "bg-red-50" : "bg-[#FBF3F4]"
                    }`}>
                      {done ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : bad ? <XCircle className="h-4 w-4 text-red-500" /> : <Zap className="h-4 w-4 text-[#641722]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-slate-800 truncate">
                        {getQAServiceDisplayName({ ...catalogoByServicoId[Number(it.servico_id)], servico_id: it.servico_id, servico_nome: SERVICO_MAP[it.servico_id] }) || `Serviço #${it.servico_id}`}
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
                      done ? "text-emerald-700 bg-emerald-50" : bad ? "text-red-700 bg-red-50" : "text-[#4F121C] bg-[#FBF3F4]"
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
                      {Number(v.desconto) > 0 && <div className="text-[10px] text-[#641722] font-mono">-{formatCurrency(Number(v.desconto))}</div>}
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

        {/* ═══ CENTRAL DE AJUDA (Base Operacional do Cliente) ═══ */}
        <SectionCard icon={Bell} title="Central de Ajuda" color="hsl(35 92% 48%)">
          <CentralAjudaCliente />
        </SectionCard>

        {/* ═══ MEU HUB DE DOCUMENTOS (CR, CRAF, GT, AC...) ═══ */}
        {(customerId || cliente?.id) && (
          <SectionCard icon={FolderArchive} title="Meu Hub de Documentos" color="hsl(280 60% 50%)">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-slate-500 leading-snug max-w-[70%]">
                {cliente?.tipo_cliente === "cliente_app" && !customerId
                  ? "Envie aqui seus documentos de acervo, CR, CRAF, GTE, autorização de compra ou comprovantes para manter tudo organizado."
                  : "Cadastre seus CR, CRAF/SINARM, GT, GTE e Autorizações de Compra. A IA pode preencher os campos a partir da foto."}
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
                <p className="text-[11px] text-slate-400">
                  {cliente?.tipo_cliente === "cliente_app"
                    ? "Você ainda não enviou documentos do acervo."
                    : "Nenhum documento cadastrado ainda."}
                </p>
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
                            {d.status === "aprovado" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5">
                                <BadgeCheck className="h-2.5 w-2.5" /> APROVADO
                              </span>
                            )}
                            {d.status === "pendente_aprovacao" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F1D9DC] text-[#4F121C] inline-flex items-center gap-0.5">
                                AGUARDANDO ANÁLISE
                              </span>
                            )}
                            {d.status === "reprovado" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 inline-flex items-center gap-0.5">
                                REPROVADO
                              </span>
                            )}
                            {d.ia_status === "sugerido" && d.status !== "aprovado" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FBF3F4] text-[#7A1F2B] inline-flex items-center gap-0.5">
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
                          {d.status === "reprovado" && d.motivo_reprovacao && (
                            <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">
                              <span className="font-bold uppercase">Motivo da reprovação:</span> {d.motivo_reprovacao}
                              <div className="mt-1 text-[9px] text-red-600">Reenvie o documento corrigido pelo botão Adicionar.</div>
                            </div>
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
        </div>
        )}
      </main>

      {(customerId || cliente?.id) && (
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
