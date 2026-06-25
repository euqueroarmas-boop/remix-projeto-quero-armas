import { useEffect, useState, useMemo, Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, User, Phone, Mail, MapPin, LogOut, Calendar, DollarSign,
  CheckCircle, Clock, XCircle, AlertTriangle, Activity, FileText,
  Crosshair, CreditCard, ChevronRight, ChevronLeft, Bell, Target, Zap, History,
  FolderArchive, Plus, Trash2, Sparkles, BadgeCheck, Paperclip,
  ShoppingBag, FileStack, Image as ImageIcon, ClipboardCheck, Menu,
  MessageCircle, Settings, Wallet, BriefcaseBusiness, Grid2X2, HelpCircle,
  ShieldCheck, BellDot, FolderKanban, Files, ScrollText, Headphones, SlidersHorizontal,
} from "lucide-react";
import { getValidadeInfo } from "@/lib/quero-armas/validadeDocumento";
import { HistoricoAtualizacoes } from "@/components/quero-armas/clientes/HistoricoAtualizacoes";
import { CentralAjudaCliente } from "@/components/quero-armas/cliente/CentralAjudaCliente";
import { Button } from "@/components/ui/button";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { Camera, Wand2 } from "lucide-react";
import { ArsenalView } from "@/components/quero-armas/arsenal/ArsenalView";
import { ClienteProcessosSection } from "@/components/quero-armas/processos/ClienteProcessosSection";
import ContratoBlock from "@/components/quero-armas/portal/ContratoBlock";
import ContratosPosPagamentoCard from "@/components/quero-armas/portal/ContratosPosPagamentoCard";
import QAContratosCockpitV1 from "@/components/quero-armas/portal/QAContratosCockpitV1";
import ChecklistGuiado from "@/components/quero-armas/portal/ChecklistGuiado";
import ChecklistGuiadoBotao from "@/components/quero-armas/portal/ChecklistGuiadoBotao";
import { abrirChecklistGuiado } from "@/lib/quero-armas/checklistGuiadoBus";
import { PortalFilterProvider, type PortalScope } from "@/components/quero-armas/portal/PortalFilterContext";
import PortalScopeSelector from "@/components/quero-armas/portal/PortalScopeSelector";
import { CockpitZ6MeusProcessos, buildCockpitZ6FromReal } from "@/components/quero-armas/cockpit-z6";
import { Crosshair as CrosshairIcon, LayoutDashboard, Upload } from "lucide-react";
import { ForcePasswordChangeModal } from "@/components/quero-armas/clientes/ForcePasswordChangeModal";
import { ensureClienteFromAuthUser } from "@/lib/quero-armas/ensureClienteFromAuthUser";
import ArmaManualForm from "@/components/quero-armas/arsenal/ArmaManualForm";
import { getQAServiceDisplayName } from "@/lib/quero-armas/serviceDisplay";
import ClienteHealthBadge from "@/components/quero-armas/clientes/ClienteHealthBadge";
import ClienteResumoKanban from "@/components/quero-armas/clientes/ClienteResumoKanban";
import { calcularPrazosProcessuais, corPrazo } from "@/lib/quero-armas/prazosProcessuais";
import { computeChecklistMetrics, isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";
import ClienteCadastroProgressivoModal from "@/components/quero-armas/portal/ClienteCadastroProgressivoModal";
import { cadastroEstaIncompleto, resumoFaltantesCadastro } from "@/lib/quero-armas/cadastroCompleteness";
import EntradaWizard, { type EntradaWizardRespostas } from "@/components/quero-armas/portal/entrada-wizard/EntradaWizard";
import { getHubCategoriaMeta, inferEscopoDocumental, getTipoDocumentoMeta } from "@/lib/quero-armas/documentosHubCatalogo";
import DocumentosCategoriaZ6V3Panel from "@/components/quero-armas/portal/DocumentosCategoriaZ6V3Panel";
import logoColor from "@/assets/logo-color.png";
import logoIcon from "@/assets/logo-wmti-icon.webp";
import ClienteFotoUploadModal from "@/components/quero-armas/clientes/ClienteFotoUploadModal";
import CustomThemesUploader from "@/components/quero-armas/portal/CustomThemesUploader";
import {
  QA_SIDEBAR_THEMES,
  getStoredSidebarTheme,
  setStoredSidebarTheme,
  type QASidebarTheme,
  QA_CUSTOM_SLOTS,
  getCustomThemes,
  setCustomThemeSlot,
  customToTheme,
  type QACustomTheme,
} from "@/components/quero-armas/portal/sidebarThemes";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try { const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR"); } catch { return d; }
};
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  try { const p = new Date(d); return isNaN(p.getTime()) ? null : Math.ceil((p.getTime() - Date.now()) / 86400000); } catch { return null; }
};
const urgencyColor = (d: number | null) =>
  d === null ? "text-slate-400" :
  d < 0     ? "text-red-700" :
  d <= 7    ? "text-red-600" :
  d <= 30   ? "text-amber-700" :
  d <= 90   ? "text-slate-500" :
              "text-emerald-600";
const urgencyBg = (d: number | null) =>
  d === null ? "" :
  d < 0     ? "bg-red-50" :
  d <= 7    ? "bg-red-50" :
  d <= 30   ? "bg-amber-50" :
              "";
const urgencyLabel = (d: number | null) => {
  if (d === null) return "SEM DATA";
  if (d < 0) {
    const n = Math.abs(d);
    return `VENCIDO HÁ ${n} ${n === 1 ? "DIA" : "DIAS"}`;
  }
  if (d === 0) return "VENCE HOJE";
  return `${d} ${d === 1 ? "DIA RESTANTE" : "DIAS RESTANTES"}`;
};


interface ExpiringDoc { label: string; date: string | null; days: number | null; category: string; }

interface ClienteAvatarOficial {
  url: string | null;
  path: string | null;
  bucket: string | null;
  source: "qa_clientes.imagem" | "qa_cadastro_publico.selfie_path" | "avatar_tatico_path" | null;
  hasPhoto: boolean;
}

function SectionCard({ icon: Icon, title, color, children, containerClassName, headerClassName }: { icon: any; title: string; color: string; children: React.ReactNode; containerClassName?: string; headerClassName?: string }) {
  return (
    <div className={containerClassName ?? "bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"}>
      <div className={headerClassName ?? "flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100"}>
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
  // BLOCO 12 — guarda o destino de navegação pendente enquanto o cliente
  // (que respondeu "sim possuo arma" no wizard) preenche o cadastro mínimo.
  const [pendingTrilhaDestino, setPendingTrilhaDestino] = useState<string | null>(null);
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [pendingContracts, setPendingContracts] = useState<number>(0);
  const [pendingContractsLoaded, setPendingContractsLoaded] = useState(false);
  const [showContratoPopup, setShowContratoPopup] = useState(false);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [activeSection, setActiveSection] = useState<
    | "resumo"
    | "pendencias"
    | "processos"
    | "financeiro"
    | "documentos"
    | "contratos"
    | "contratacoes"
    | "arsenal"
    | "mensagens"
    | "configuracoes"
  >("resumo");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTheme, setSidebarTheme] = useState<QASidebarTheme>(() => getStoredSidebarTheme());
  useEffect(() => {
    const onChange = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as string | undefined;
      if (!key) return;
      if (key.startsWith("custom-")) {
        const slot = Number(key.split("-")[1]);
        const c = getCustomThemes()[slot];
        if (c) setSidebarTheme(customToTheme(c));
        return;
      }
      const next = QA_SIDEBAR_THEMES.find((t) => t.key === key);
      if (next) setSidebarTheme(next);
    };
    window.addEventListener("qa:sidebar-theme-change", onChange);
    const onCustom = () => setSidebarTheme(getStoredSidebarTheme());
    window.addEventListener("qa:sidebar-custom-change", onCustom);
    return () => {
      window.removeEventListener("qa:sidebar-theme-change", onChange);
      window.removeEventListener("qa:sidebar-custom-change", onCustom);
    };
  }, []);
  // Em telas < lg (1024px) o sidebar é sempre forçado para o modo colapsado (mini-rail),
  // mantendo o mesmo layout/fontes/paleta do desktop em tablet e mobile.
  const [isBelowLg, setIsBelowLg] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = (e: MediaQueryListEvent) => setIsBelowLg(e.matches);
    mql.addEventListener("change", onChange);
    setIsBelowLg(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const effectiveCollapsed = isBelowLg ? true : sidebarCollapsed;
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [avatarOficial, setAvatarOficial] = useState<ClienteAvatarOficial | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarReloadKey, setAvatarReloadKey] = useState(0);
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [processos, setProcessos] = useState<any[]>([]);
  const [processoDocs, setProcessoDocs] = useState<any[]>([]);
  // BLOCO 9 — Assistente de Entrada (wizard inicial do portal).
  const [entradaWizardOpen, setEntradaWizardOpen] = useState(false);
  const [entradaAutoChecked, setEntradaAutoChecked] = useState(false);
  // BLOCO 5 — eventos do processo (linha do tempo expandida). Camada aditiva,
  // lê qa_processo_eventos (somente os processos do cliente).
  const [processoEventos, setProcessoEventos] = useState<any[]>([]);
  // Fase 3 — escopo selecionado no segmented control das abas detalhadas.
  const [selectedScopeId, setSelectedScopeId] = useState<string>("todos");

  // Fonte oficial do header: função autenticada resolve e assina, em ordem:
  // qa_clientes.imagem → qa_cadastro_publico.selfie_path → avatar_tatico_path.
  const avatarUrl = avatarOficial?.url || null;
  const hasTacticalAvatar = avatarOficial?.source === "avatar_tatico_path";
  const hasAnyPhoto = avatarOficial?.hasPhoto || Boolean((cliente as any)?.imagem || (cliente as any)?.avatar_tatico_path);
  const avatarResolving = Boolean((cliente as any)?.id) && (avatarLoading || avatarOficial === null);
  const activeTab: "arsenal" | "resumo" | null = activeSection === "arsenal" ? "arsenal" : activeSection === "resumo" ? "resumo" : null;
  const setActiveTab = (tab: "arsenal" | "resumo") => setActiveSection(tab);

  function handleEntradaConcluido(respostas: EntradaWizardRespostas) {
    setCliente((prev: any) =>
      prev
        ? {
            ...prev,
            entrada_objetivo: respostas.objetivo,
            entrada_possui_arma: respostas.possuiArma,
            entrada_respondida_em: new Date().toISOString(),
          }
        : prev,
    );
    const trilha = respostas.objetivo;
    const params = new URLSearchParams();
    if (trilha !== "indefinido") params.set("trilha", trilha);
    if (respostas.possuiArma) params.set("possuiArma", respostas.possuiArma);
    if (respostas.finalidadeArma) params.set("finalidade", respostas.finalidadeArma);
    const destino = `/area-do-cliente/contratar?${params.toString()}`;

    // BLOCO 12 — Cadastro mínimo de arma.
    // Se o cliente declarou possuir arma (ou escolheu continuidade, que é implicitamente sim)
    // E ainda não tem nada no acervo, ofereça o cadastro rápido antes de ir ao catálogo.
    if (respostas.possuiArma === "sim" || respostas.objetivo === "continuidade") {
      void (async () => {
        try {
          const { count } = await supabase
            .from("qa_cliente_armas" as any)
            .select("arma_uid", { count: "exact", head: true })
            .eq("qa_cliente_id", (cliente as any)?.id);
          if ((count ?? 0) === 0) {
            setPendingTrilhaDestino(destino);
            setShowArmaManual(true);
            return;
          }
        } catch {
          /* falha silenciosa — segue para o catálogo */
        }
        navigate(destino);
      })();
      return;
    }

    // Navega direto para o catálogo (chip removível "Trilha: ..." lá).
    navigate(destino);
  }

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

        // [DIAG ARSENAL] Surface de erros — antes eram silenciosamente convertidos em [].
        const arsenalErrors: Record<string, string> = {};
        if (vRes.error) arsenalErrors.qa_vendas = vRes.error.message;
        if (crRes.error) arsenalErrors.qa_cadastro_cr = crRes.error.message;
        if (cfRes.error) arsenalErrors.qa_crafs = cfRes.error.message;
        if (gtRes.error) arsenalErrors.qa_gtes = gtRes.error.message;
        if (flRes.error) arsenalErrors.qa_filiacoes = flRes.error.message;
        if (exRes.error) arsenalErrors.qa_exames_cliente = exRes.error.message;
        if (Object.keys(arsenalErrors).length > 0) {
          console.warn("[ArsenalDiag] queries com erro:", arsenalErrors);
        }
        if (import.meta.env.DEV) {
          console.table({
            clienteIdReal,
            clienteIdLegado: (clienteData as any)?.id_legado ?? null,
            clienteIdVendas,
            vendas: (vRes.data as any[] | null)?.length ?? 0,
            cadastro_cr: (crRes.data as any[] | null)?.length ?? 0,
            crafs: (cfRes.data as any[] | null)?.length ?? 0,
            gtes: (gtRes.data as any[] | null)?.length ?? 0,
            filiacoes: (flRes.data as any[] | null)?.length ?? 0,
            exames: (exRes.data as any[] | null)?.length ?? 0,
          });
        }

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
          .select("id, cliente_id, venda_id, servico_id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, prazo_critico_data, prazo_critico_doc_id, primeiro_doc_aprovado_em, respostas_questionario_json")
          .eq("cliente_id", clienteIdReal)
          // Processos órfãos (cancelados/arquivados pela reconciliação porque
          // o admin removeu a venda/contrato) NUNCA devem aparecer ao cliente.
          .not("status", "in", "(cancelado,arquivado)")
          .order("data_criacao", { ascending: false });
        const procsList = (procsData as any[]) ?? [];
        setProcessos(procsList);
        if (procsList.length > 0) {
          const procIds = procsList.map((p) => p.id);
          const { data: procDocsData } = await supabase
            .from("qa_processo_documentos" as any)
            .select("id, processo_id, status, obrigatorio, tipo_documento, nome_documento, etapa, ordem, data_emissao, data_validade_efetiva, data_validade, updated_at")
            .in("processo_id", procIds);
          setProcessoDocs((procDocsData as any[]) ?? []);
          // Eventos da linha do tempo (envios, aprovações, reprovações, etc).
          const { data: eventosData } = await supabase
            .from("qa_processo_eventos" as any)
            .select("id, processo_id, tipo_evento, descricao, ator, created_at, documento_id")
            .in("processo_id", procIds)
            .order("created_at", { ascending: false })
            .limit(200);
          setProcessoEventos((eventosData as any[]) ?? []);
        } else {
          setProcessoDocs([]);
          setProcessoEventos([]);
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
  }, [cliente?.id, cliente?.imagem, cliente?.avatar_tatico_path, docsReloadKey, avatarReloadKey]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/area-do-cliente/login", { replace: true });
  };

  // Fallback idempotente — para cada processo ativo, dispara o checador de
  // conclusão server-side. Se algum processo virar pronto_para_protocolar,
  // recarrega para refletir o novo badge. A edge function é guardada por
  // idempotência (não reenvia e-mail/evento).
  useEffect(() => {
    if (!processos || processos.length === 0) return;
    const STATUS_FINAL = new Set([
      "pronto_para_protocolar", "protocolado", "em_analise_orgao",
      "deferido", "indeferido", "concluido", "finalizado", "cancelado",
    ]);
    const candidatos = processos.filter(
      (p: any) => !STATUS_FINAL.has(String(p.status || "").toLowerCase()),
    );
    if (candidatos.length === 0) return;
    let cancelled = false;
    (async () => {
      let alguemPromovido = false;
      for (const p of candidatos) {
        try {
          const { data } = await supabase.functions.invoke(
            "qa-processo-checar-conclusao-checklist",
            { body: { processo_id: p.id, origem: "portal_cliente" } },
          );
          if ((data as any)?.pronto && !(data as any)?.ja_estava) {
            alguemPromovido = true;
          }
        } catch (e) {
          console.warn("[portal] checar-conclusao falhou", e);
        }
      }
      if (!cancelled && alguemPromovido) {
        setDocsReloadKey((k) => k + 1);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processos.map((p: any) => `${p.id}:${p.status}`).join("|")]);

  // Realtime: ouve mudanças nos próprios documentos (admin aprovou/reprovou/excluiu)
  // e nas tabelas de arsenal — recarrega imediatamente.
  useEffect(() => {
    const clienteIdReal = cliente?.id ?? null;
    if (!clienteIdReal && !customerId) return;
    const channel = supabase
      .channel(`portal-cliente-${clienteIdReal ?? customerId}`);

    channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_documentos_cliente" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.qa_cliente_id === clienteIdReal || row.customer_id === customerId) {
            setDocsReloadKey((k) => k + 1);
          }
        },
      );

    // Filtros que dependem de clienteIdReal só são registrados se ele existir,
    // evitando assinatura com `cliente_id=eq.null` (que vinha do Pass anterior).
    if (clienteIdReal) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "qa_crafs", filter: `cliente_id=eq.${clienteIdReal}` }, () => setDocsReloadKey((k) => k + 1))
        .on("postgres_changes", { event: "*", schema: "public", table: "qa_cadastro_cr", filter: `cliente_id=eq.${clienteIdReal}` }, () => setDocsReloadKey((k) => k + 1))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "qa_clientes", filter: `id=eq.${clienteIdReal}` }, () => setDocsReloadKey((k) => k + 1));
    }

    channel.subscribe();
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
      // Evita duplicar o CR já presente em qa_cadastro_cr (validade_cr)
      if (tipoRaw === "cr" && cadastro?.validade_cr) return;
      const tipoMeta = getTipoDocumentoMeta(tipoRaw);
      const tipoLabel = tipoMeta?.short || tipoMeta?.label
        || tipoRaw.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
      const catLabel = getHubCategoriaMeta(tipoMeta?.categoria || "outros").label;
      const armaInfo = d.arma_modelo
        ? ` — ${d.arma_modelo}${d.arma_calibre ? ` ${d.arma_calibre}` : ""}`
        : "";
      expDocs.push({
        label: `${tipoLabel}${armaInfo}`,
        date: d.data_validade,
        days: daysUntil(d.data_validade),
        category: catLabel,
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
      pronto_para_protocolar: "Documentação completa — pronto para protocolo",
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
    const events: { date: string; label: string; icon: any; color: string; sub?: string | null }[] = [];
    vendas.forEach((v: any) => events.push({ date: v.data_cadastro || v.created_at, label: `Serviço contratado — ${formatCurrency(Number(v.valor_a_pagar || 0))}`, icon: CreditCard, color: "hsl(352 60% 30%)" }));
    itens.forEach((it: any) => {
      const servicoLabel = getQAServiceDisplayName({ ...catalogoByServicoId[Number(it.servico_id)], servico_id: it.servico_id, servico_nome: SERVICO_MAP[it.servico_id] }) || "Serviço";
      if (it.data_protocolo) events.push({ date: it.data_protocolo, label: `${servicoLabel} — Protocolado`, icon: FileText, color: "hsl(38 92% 50%)" });
      if (it.data_deferimento) events.push({ date: it.data_deferimento, label: `${servicoLabel} — Deferido`, icon: CheckCircle, color: "hsl(152 60% 42%)" });
    });
    // BLOCO 5 — eventos do qa_processo_eventos (envios, aprovações, rejeições, etc).
    // Anexa "Válido até DD/MM/AAAA" quando o evento referencia um documento.
    const docById = new Map<string, any>(processoDocs.map((d) => [String(d.id), d]));
    processoEventos.forEach((ev: any) => {
      const tipo = String(ev.tipo_evento || "").toLowerCase();
      let icon: any = Activity;
      let color = "hsl(220 60% 48%)";
      if (tipo.includes("aprov")) { icon = CheckCircle; color = "hsl(152 60% 42%)"; }
      else if (tipo.includes("reje") || tipo.includes("inval") || tipo.includes("reprov")) { icon = AlertTriangle; color = "hsl(352 70% 45%)"; }
      else if (tipo.includes("envio") || tipo.includes("upload")) { icon = Upload; color = "hsl(210 60% 50%)"; }
      else if (tipo.includes("revis")) { icon = ShieldCheck; color = "hsl(38 92% 50%)"; }
      const baseLabel = ev.descricao || ev.tipo_evento || "Evento";
      const doc = ev.documento_id ? docById.get(String(ev.documento_id)) : null;
      let sub: string | null = null;
      if (doc) {
        const v = getValidadeInfo({
          tipo_documento: doc.tipo_documento,
          data_emissao: doc.data_emissao,
          data_validade_efetiva: doc.data_validade_efetiva,
          data_validade: doc.data_validade,
          ano_competencia: (doc as any).ano_competencia ?? null,
          regra_validacao: (doc as any).regra_validacao ?? null,
        });
        if (v.semVencimento && v.label) {
          sub = `${doc.nome_documento || doc.tipo_documento} · ${v.label}`;
        } else if (v.label) {
          sub = v.status === "vencido" ? `${doc.nome_documento || doc.tipo_documento} · vencido em ${v.label}` : `${doc.nome_documento || doc.tipo_documento} · válido até ${v.label}`;
        } else if (doc.nome_documento) {
          sub = String(doc.nome_documento);
        }
      }
      events.push({ date: ev.created_at, label: baseLabel, icon, color, sub });
    });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.slice(0, 20);
  }, [vendas, itens, catalogoByServicoId, SERVICO_MAP, processoEventos, processoDocs]);

  // Nova IA do portal (Fase 1): as 6 abas oficiais aparecem primeiro, na ordem
  // do briefing. Arsenal / Mensagens / Configurações continuam acessíveis como
  // seções secundárias do sidebar — não foram removidas (zero regressão).
  // `contratacoes` permanece como chave válida para deep-links legados, mas
  // não é mais exposta como item de navegação — "Meus processos" cobre o
  // mesmo conteúdo na Fase 2.
  const navItems = useMemo(() => [
    { key: "resumo" as const, label: "Resumo", icon: LayoutDashboard, path: "/area-do-cliente", group: "primary" as const },
    { key: "contratos" as const, label: "Contratos", icon: ScrollText, path: "/area-do-cliente/contratos", group: "primary" as const },
    { key: "pendencias" as const, label: "Pendências", icon: BellDot, path: "/area-do-cliente/pendencias", group: "primary" as const },
    { key: "processos" as const, label: "Meus processos", icon: FolderKanban, path: "/area-do-cliente/processos", group: "primary" as const },
    { key: "financeiro" as const, label: "Financeiro", icon: CreditCard, path: "/area-do-cliente/financeiro", group: "primary" as const },
    { key: "documentos" as const, label: "Documentos", icon: Files, path: "/area-do-cliente/documentos", group: "primary" as const },
    { key: "arsenal" as const, label: "Arsenal Inteligente", icon: Crosshair, path: "/area-do-cliente/arsenal", group: "secondary" as const },
    { key: "mensagens" as const, label: "Suporte", icon: Headphones, path: "/area-do-cliente/mensagens", group: "secondary" as const },
    { key: "configuracoes" as const, label: "Configurações", icon: SlidersHorizontal, path: "/area-do-cliente/configuracoes", group: "secondary" as const },
  ], []);

  // Fase 3 — escopos exibidos no PortalScopeSelector. Um item por processo
  // do cliente, mais "Todos os processos" (injetado pelo provider se ausente).
  const portalScopes = useMemo<PortalScope[]>(() => {
    const items: PortalScope[] = processos.map((p: any) => {
      const nome = getQAServiceDisplayName({
        ...catalogoByServicoId[Number(p.servico_id)],
        servico_id: p.servico_id,
        servico_nome: p.servico_nome || SERVICO_MAP[p.servico_id],
      }) || p.servico_nome || "Processo";
      return {
        id: String(p.id),
        label: String(nome).toUpperCase(),
        type: "processo" as const,
        processoId: String(p.id),
        vendaId: p.venda_id != null ? Number(p.venda_id) : null,
        serviceSlug: p.servico_slug ?? null,
        serviceName: nome,
      };
    });
    return [{ id: "todos", label: "Todos os processos", type: "todos" as const }, ...items];
  }, [processos, catalogoByServicoId, SERVICO_MAP]);

  // Se o escopo selecionado deixar de existir (processo removido), volta a "todos".
  useEffect(() => {
    if (!portalScopes.some((s) => s.id === selectedScopeId)) {
      setSelectedScopeId("todos");
    }
  }, [portalScopes, selectedScopeId]);

  const currentScope = useMemo<PortalScope>(
    () => portalScopes.find((s) => s.id === selectedScopeId) || portalScopes[0],
    [portalScopes, selectedScopeId],
  );

  // Sincroniza seção a partir da URL apenas no primeiro mount / quando a rota base muda.
  // Navegação interna do portal NÃO altera URL — apenas estado.
  useEffect(() => {
    const match = navItems.find((item) => item.path !== "/area-do-cliente" && location.pathname.startsWith(item.path));
    if (match) setActiveSection(match.key);
    // Suporte a deep link via query string: /area-do-cliente?secao=arsenal
    const params = new URLSearchParams(location.search);
    const secao = params.get("secao");
    if (secao && navItems.some((item) => item.key === secao)) {
      setActiveSection(secao as typeof activeSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const goSection = (key: typeof navItems[number]["key"]) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[PortalNav] section click", key);
    }
    setActiveSection(key);
    // Não usar navigate(): rotas internas como /area-do-cliente/arsenal não existem
    // e o catch-all do router devolveria para "/". Mantemos a URL em /area-do-cliente.
  };

  const goContractsSection = () => {
    setShowContratoPopup(false);
    setActiveSection("contratos");
    navigate("/area-do-cliente?secao=contratos", { replace: true });
    window.setTimeout(() => {
      const contratos = document.getElementById("qa-portal-contratos");
      contratos?.scrollIntoView({ behavior: "smooth", block: "start" });
      contratos?.focus({ preventScroll: true });
    }, 80);
  };

  const resumoState = useMemo(() => {
    const cadastroIncompleto = cadastroEstaIncompleto(cliente);
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
        onClick: () => goSection("processos"),
      };
    } else if (docVencidoHoje) {
      proximaAcao = {
        titulo: `Renovar ${docVencidoHoje.label}`,
        descricao: docVencidoHoje.days === 0 ? "Vence hoje — regularize imediatamente." : `Vencido há ${Math.abs(docVencidoHoje.days as number)} dia(s).`,
        icon: AlertTriangle,
        onClick: () => goSection("documentos"),
      };
    } else if (checklistReproc) {
      proximaAcao = { titulo: `Reenviar ${String(checklistReproc.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, descricao: "Documento obrigatório reprovado precisa ser corrigido.", icon: FileText, onClick: () => abrirChecklistGuiado({ processoId: checklistReproc.processo_id, focusDocId: checklistReproc.id }) };
    } else if (docsHubReprovados > 0) {
      proximaAcao = { titulo: "Reenviar documento reprovado", descricao: `${docsHubReprovados} documento(s) do hub precisam de correção.`, icon: FileText, onClick: () => setShowAddDoc(true) };
    } else if (checklistPend) {
      proximaAcao = { titulo: `Enviar ${String(checklistPend.tipo_documento || "documento").replace(/_/g, " ").toUpperCase()}`, descricao: "Documento obrigatório para dar andamento.", icon: FileText, onClick: () => abrirChecklistGuiado({ processoId: checklistPend.processo_id, focusDocId: checklistPend.id }) };
    } else if (cadastroIncompleto) {
      proximaAcao = { titulo: "Completar seu cadastro", descricao: resumoFaltantesCadastro(cliente) || "Dados básicos faltando.", icon: User, onClick: () => setShowCadastroModal(true) };
    } else if (docsHubEmAnalise > 0) {
      proximaAcao = { titulo: "Aguardar análise da equipe", descricao: `${docsHubEmAnalise} documento(s) em validação operacional.`, icon: Clock, onClick: () => goSection("documentos") };
    }
    return { cadastroIncompleto, docsHubEmAnalise, docsHubReprovados, checklistReproc, checklistPend, prazoCritico, totalPendencias, proximaAcao, aguardandoDocsReal: processoSnap.aguardandoAcaoCliente > 0 || docsHubReprovados > 0 };
  }, [cliente, meusDocs, processoDocs, processoSnap, analysis, navigate]);

  const portalStartupAction = useMemo(() => {
    if (loading || !cliente || !pendingContractsLoaded) return null;

    if (pendingContracts > 0) return { type: "contrato" as const };
    // Cadastro incompleto tem prioridade sobre pendências documentais:
    // sem dados básicos, o cliente não consegue resolver o resto.
    if (resumoState.cadastroIncompleto) return { type: "cadastro" as const };
    if (resumoState.checklistReproc) return { type: "checklist_reprovado" as const };
    if (resumoState.docsHubReprovados > 0) return { type: "doc_hub_reprovado" as const };
    if (resumoState.checklistPend) return { type: "checklist_pendente" as const };
    if (resumoState.prazoCritico) return { type: "prazo" as const };

    const respondida = (cliente as any)?.entrada_respondida_em ?? null;
    const semProcessos = !processos || processos.length === 0;
    if (respondida == null && semProcessos) return { type: "entrada_wizard" as const };

    return null;
  }, [cliente, loading, pendingContracts, pendingContractsLoaded, processos, resumoState]);

  // BLOCO 9 — Orquestrador de entrada do portal.
  // Obrigações do cliente sempre aparecem antes do assistente de compra.
  useEffect(() => {
    if (entradaAutoChecked) return;
    if (!portalStartupAction) return;

    const idLegado = (cliente as any)?.id_legado ?? (cliente as any)?.id ?? "anon";
    const key = `qa-portal-startup-${idLegado}-${portalStartupAction.type}`;
    // Cadastro incompleto reabre em todo refresh até ser preenchido —
    // é bloqueante para o restante do fluxo.
    const ignorarTrava = portalStartupAction.type === "cadastro";
    if (!ignorarTrava && sessionStorage.getItem(key)) {
      setEntradaAutoChecked(true);
      return;
    }
    if (!ignorarTrava) sessionStorage.setItem(key, "1");
    setEntradaAutoChecked(true);

    if (portalStartupAction.type === "contrato") {
      setShowContratoPopup(true);
      return;
    }

    if (portalStartupAction.type === "checklist_reprovado" && resumoState.checklistReproc) {
      setActiveSection("pendencias");
      window.setTimeout(() => abrirChecklistGuiado({
        processoId: resumoState.checklistReproc.processo_id,
        focusDocId: resumoState.checklistReproc.id,
      }), 150);
      return;
    }

    if (portalStartupAction.type === "checklist_pendente" && resumoState.checklistPend) {
      setActiveSection("pendencias");
      window.setTimeout(() => abrirChecklistGuiado({
        processoId: resumoState.checklistPend.processo_id,
        focusDocId: resumoState.checklistPend.id,
      }), 150);
      return;
    }

    if (portalStartupAction.type === "doc_hub_reprovado") {
      setShowAddDoc(true);
      return;
    }

    if (portalStartupAction.type === "cadastro") {
      setShowCadastroModal(true);
      return;
    }

    if (portalStartupAction.type === "prazo") {
      setActiveSection("processos");
      return;
    }

    if (portalStartupAction.type === "entrada_wizard") {
      setEntradaWizardOpen(true);
    }
  }, [cliente, entradaAutoChecked, portalStartupAction, resumoState]);

  // Carrega contratos pós-pagamento pendentes de assinatura do cliente.
  // A abertura do popup é feita pelo orquestrador de entrada, para não
  // concorrer com o assistente de compra.
  useEffect(() => {
    const idLegado = (cliente as any)?.id_legado as number | null | undefined;
    if (!idLegado) {
      setPendingContracts(0);
      setPendingContractsLoaded(true);
      return;
    }
    let alive = true;
    setPendingContractsLoaded(false);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("qa_contracts" as any)
          .select("id, status")
          .eq("cliente_id", idLegado)
          .in("status", [
            "generated_pending_company_signature",
            "pending_customer_signature",
            "rejected",
          ]);
        if (!alive) return;
        if (error) {
          setPendingContracts(0);
          setPendingContractsLoaded(true);
          return;
        }
        const count = Array.isArray(data) ? data.length : 0;
        setPendingContracts(count);
        setPendingContractsLoaded(true);
      } catch {
        if (alive) {
          setPendingContracts(0);
          setPendingContractsLoaded(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [cliente, docsReloadKey]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 bg-slate-50">
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
    <PortalFilterProvider
      scopes={portalScopes}
      selectedScopeId={selectedScopeId}
      onScopeChange={setSelectedScopeId}
    >
    <div className={`min-h-dvh bg-[#F2F2F2] text-slate-900 overflow-x-hidden transition-[padding-left] duration-200 ${effectiveCollapsed ? "pl-[68px]" : "pl-[68px] lg:pl-[260px]"}`}>
      <ForcePasswordChangeModal
        open={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      <EntradaWizard
        open={entradaWizardOpen}
        onOpenChange={setEntradaWizardOpen}
        clienteId={(cliente as any)?.id ?? null}
        onConcluido={handleEntradaConcluido}
      />
      <ClienteFotoUploadModal
        open={showFotoModal}
        onOpenChange={setShowFotoModal}
        onUploaded={() => {
          setAvatarReloadKey((k) => k + 1);
          setDocsReloadKey((k) => k + 1);
        }}
      />
      {/* ═══ SIDEBAR Z6 DARK — sempre visível (mobile/tablet em mini-rail) ═══ */}
      <aside
        className={`flex fixed inset-y-0 left-0 z-50 flex-col text-[#E8E8E8] transition-[width] duration-200 ${effectiveCollapsed ? "w-[68px]" : "w-[260px]"}`}
        style={{ background: sidebarTheme.bg }}
        data-qa-sb-theme={sidebarTheme.key}
      >
        {/* Faixa decorativa do tema — 3px no topo, não interfere com texto */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
          style={{ background: sidebarTheme.stripe }}
        />
        {/* ── BLOCO DE TOPO (hero) — apenas temas com topMode "hero" expandidos ── */}
        {sidebarTheme.topMode === "hero" && !effectiveCollapsed && (
          <div
            aria-hidden
            className="relative w-full h-[200px] overflow-hidden shrink-0"
            style={
              sidebarTheme.heroEmpty
                ? { background: "transparent" }
                : sidebarTheme.heroImage
                ? {
                    backgroundImage: `linear-gradient(transparent 40%, rgba(0,0,0,0.85)), url("${sidebarTheme.heroImage}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }
                : { background: sidebarTheme.bg }
            }
          >
            {!sidebarTheme.heroImage && !sidebarTheme.heroEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[48px] leading-none select-none">{sidebarTheme.emblem}</div>
                <div
                  className="mt-2 text-[10px] tracking-[0.2em] uppercase text-white/70"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  {sidebarTheme.label}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Brand: avatar + ARSENAL INTELIGENTE / ÁREA DO CLIENTE ── */}
        {(() => {
          const isHero = sidebarTheme.topMode === "hero" && !effectiveCollapsed;
          const avatarSizeCls = isHero ? "w-16 h-16" : "w-12 h-12";
          return (
            <div
              className={
                isHero
                  ? "relative flex items-center px-4 pt-5 pb-4 gap-2.5"
                  : `flex items-center px-4 py-6 ${effectiveCollapsed ? "justify-center" : "gap-2.5"}`
              }
            >
              {/* Wrapper do avatar — inline na linha do brand, no lugar do logo */}
              <div className="relative shrink-0">
                {isHero && (
                  <span
                    aria-hidden
                    className="absolute inset-0 -m-3 rounded-full pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(0,0,0,0.55) 40%, transparent 75%)",
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowFotoModal(true)}
                  title={avatarUrl ? "Trocar minha foto" : "Adicionar minha foto"}
                  aria-label={avatarUrl ? "Trocar minha foto" : "Adicionar minha foto"}
                  className={`relative ${avatarSizeCls} rounded-full overflow-hidden shrink-0 ring-1 ring-[#2a2a2a] transition-all duration-200 group`}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 18px 3px ${sidebarTheme.accent}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName || "Foto do cliente"} className="w-full h-full object-cover" />
                  ) : (
                    <span
                      className="w-full h-full flex items-center justify-center bg-[#7A1F2B] text-white font-bold text-[14px] tracking-[0.04em]"
                      style={{ fontFamily: "Oswald, sans-serif" }}
                    >
                      QA
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition flex items-center justify-center">
                    <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition" />
                  </span>
                </button>
              </div>
              {!effectiveCollapsed && (
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[12.5px] font-semibold text-white leading-tight tracking-[0.06em] uppercase"
                    style={{ fontFamily: "Oswald, sans-serif" }}
                  >
                    Arsenal Inteligente
                  </div>
                  <div
                    className="text-[9px] text-[#7A7A7A] tracking-[0.2em] mt-0.5 uppercase"
                    style={{ fontFamily: "Oswald, sans-serif" }}
                  >
                    Área do Cliente
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Botão moderno: regredir/expandir menu — apenas desktop (mobile/tablet fixo em mini) */}
        {!isBelowLg && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(v => !v)}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-[#141414] border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#9a9a9a] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = sidebarTheme.accent; e.currentTarget.style.color = sidebarTheme.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
          >
            {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Nav com grupos Principal / Secundário */}
        <nav
          className="relative z-[1] flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
          style={
            !effectiveCollapsed && sidebarTheme.heroEmpty
              ? {
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 48%, rgba(0,0,0,0.94) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.06)",
                }
              : undefined
          }
        >
          {!effectiveCollapsed && (
            <div className="px-1 pt-2 pb-1.5 text-[9.5px] tracking-[0.18em] text-[#D6A64B] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>Principal</div>
          )}
          {navItems.filter(i => i.group === "primary").map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key || (item.key === "processos" && activeSection === "contratacoes");
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goSection(item.key)}
                title={effectiveCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${effectiveCollapsed ? "justify-center px-0" : "gap-3 px-3"} py-2.5 text-[12px] font-semibold border-l-2 transition ${active ? "text-white" : "text-[#F6F1E7] border-transparent bg-black/35 hover:text-white hover:bg-black/55"}`}
                style={active ? {
                  background: `linear-gradient(90deg, ${sidebarTheme.accent}47 0%, ${sidebarTheme.accent}12 100%)`,
                  border: `1px solid ${sidebarTheme.accent}8C`,
                  borderRadius: "8px",
                  borderLeftColor: sidebarTheme.accent,
                } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" style={active ? { color: sidebarTheme.accent } : undefined} />
                {!effectiveCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              </button>
            );
          })}
          {!effectiveCollapsed && (
            <div className="px-1 pt-4 pb-1.5 text-[9.5px] tracking-[0.18em] text-[#D6A64B] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>Secundário</div>
          )}
          {effectiveCollapsed && <div className="my-2 mx-3 border-t border-[#1a1a1a]" />}
          {navItems.filter(i => i.group === "secondary").map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goSection(item.key)}
                title={effectiveCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${effectiveCollapsed ? "justify-center px-0" : "gap-3 px-3"} py-2.5 text-[12px] font-semibold border-l-2 transition ${active ? "text-white" : "text-[#F6F1E7] border-transparent bg-black/35 hover:text-white hover:bg-black/55"}`}
                style={active ? {
                  background: `linear-gradient(90deg, ${sidebarTheme.accent}47 0%, ${sidebarTheme.accent}12 100%)`,
                  border: `1px solid ${sidebarTheme.accent}8C`,
                  borderRadius: "8px",
                  borderLeftColor: sidebarTheme.accent,
                } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" style={active ? { color: sidebarTheme.accent } : undefined} />
                {!effectiveCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Rodapé: WhatsApp + Sair */}
        {effectiveCollapsed ? (
          <div className="mb-3.5 pt-3.5 mx-2 border-t border-[#1a1a1a] flex flex-col items-center gap-2">
            <a
              href="https://wa.me/5511978481919"
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp +55 11 97848-1919"
              className="w-10 h-10 rounded-md flex items-center justify-center bg-[#1CC355] hover:bg-[#19B14C] text-white transition"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              className="w-10 h-10 rounded-md flex items-center justify-center text-[#7A7A7A] hover:text-white hover:bg-[#141414] transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mx-3.5 mb-3.5 pt-3.5 border-t border-[#1a1a1a]">
            <div className="text-[12px] font-semibold text-[#E8E8E8] mb-0.5">Precisa de ajuda?</div>
            <div className="text-[10.5px] text-[#7A7A7A] mb-2.5">Atendimento direto pelo WhatsApp</div>
            <a
              href="https://wa.me/5511978481919"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#1CC355] hover:bg-[#19B14C] text-white px-3 py-2 rounded text-[11.5px] font-semibold transition"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              +55 11 97848-1919
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center gap-2 text-[10px] tracking-[0.18em] uppercase font-semibold text-[#7A7A7A] hover:text-white py-2 transition"
            >
              <LogOut className="h-3 w-3" /> Sair
            </button>
          </div>
        )}
      </aside>

      {/* TOP BAR mobile removida — sidebar dark é a navegação única em todas as larguras. */}

      <main className="max-w-[1540px] mx-auto px-4 lg:px-8 py-6 space-y-5 overflow-x-hidden">
        {activeTab === "arsenal" && cliente && analysis && (
          <>
          {/* bloco arsenal carregado normalmente */}
          {import.meta.env.DEV && (() => {
            // [DIAG ARSENAL] log na renderização
            // eslint-disable-next-line no-console
            console.table({
              activeSection,
              activeTab,
              hasCliente: !!cliente,
              clienteIdReal: (cliente as any)?.id,
              clienteIdLegado: (cliente as any)?.id_legado,
              hasAnalysis: !!analysis,
              crafs: crafs.length,
              gtes: gtes.length,
              meusDocs: meusDocs.length,
              cadastro: !!cadastro,
              processos: processos.length,
              processoDocs: processoDocs.length,
            });
            return null;
          })()}
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
              const [crRes, cfRes, gtRes, dRes] = await Promise.all([
                supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", clienteIdReal).order("id", { ascending: false }).limit(1),
                supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteIdReal),
                supabase.from("qa_gtes" as any).select("*").eq("cliente_id", clienteIdReal),
                supabase.from("qa_documentos_cliente" as any).select("*").eq("qa_cliente_id", clienteIdReal).neq("status", "excluido").order("created_at", { ascending: false }),
              ]);
              setCadastro(Array.isArray(crRes.data) ? ((crRes.data as any[])[0] ?? null) : (crRes.data as any));
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
            onOpenChange={(v) => {
              setShowArmaManual(v);
              // BLOCO 12 — ao fechar (salvou OU pulou), prossegue para o
              // catálogo se havia uma navegação pendente do wizard.
              if (!v && pendingTrilhaDestino) {
                const dest = pendingTrilhaDestino;
                setPendingTrilhaDestino(null);
                navigate(dest);
              }
            }}
            qaClienteId={cliente.id}
            defaultEmail={cliente.email}
            defaultCpf={cliente.cpf}
            defaultNome={cliente.nome_completo}
            onSaved={() => { /* dados aparecerão na ficha do admin via view qa_cliente_armas */ }}
          />
          </>
        )}

        {/* Fallback diagnóstico: aba Arsenal selecionada mas faltou cliente ou analysis. */}
        {activeSection === "arsenal" && (!cliente || !analysis) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            <div className="text-[14px] font-bold uppercase tracking-wide text-slate-900">
              Arsenal indisponível no momento
            </div>
            <p className="mt-2 text-[13px] text-slate-600">
              Não foi possível carregar o Arsenal agora. Tente recarregar a página em instantes.
            </p>
            {import.meta.env.DEV && (
              <pre className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-700 overflow-x-auto">
{JSON.stringify({
  hasCliente: !!cliente,
  clienteIdReal: (cliente as any)?.id ?? null,
  clienteIdLegado: (cliente as any)?.id_legado ?? null,
  hasAnalysis: !!analysis,
  crafs: crafs.length,
  gtes: gtes.length,
  meusDocs: meusDocs.length,
  cadastro: !!cadastro,
  processos: processos.length,
}, null, 2)}
              </pre>
            )}
          </div>
        )}

        {activeTab === "resumo" && (
        <div className="qa-resumo-light space-y-4">
        <ClienteResumoKanban
          cliente={cliente}
          vendas={vendas}
          itens={itens}
          crafs={crafs}
          gtes={gtes}
          filiacoes={filiacoes}
          cadastro={cadastro}
          examesAtuais={examesCliente}
          meusDocs={meusDocs}
          processoDocs={processoDocs}
          onNavigate={(tab) => setActiveSection(tab as any)}
          onOpenCadastro={() => setShowCadastroModal(true)}
          onOpenDocsHub={() => setShowAddDoc(true)}
        />
        {false && (() => {
          const cadastroIncompleto = cadastroEstaIncompleto(cliente);
          const docsAprovados   = meusDocs.filter((d: any) => d.status === "aprovado").length;
          const docsAnalise     = meusDocs.filter((d: any) => d.status === "pendente_aprovacao").length;
          const docsHubReprovados = meusDocs.filter((d: any) => d.status === "reprovado").length;
          const totalDocs       = meusDocs.length;
          const vencido         = analysis?.expDocs.find((d) => d.days !== null && (d.days as number) < 0);
          const venceHoje       = analysis?.expDocs.find((d) => d.days === 0);
          const checklistPend   = processoDocs.find((d) => d.obrigatorio && isChecklistPendente(d.status));
          const checklistReproc = processoDocs.find((d) => d.obrigatorio && ["invalido", "reprovado", "divergente", "pendente_reenvio"].includes(String(d.status || "").toLowerCase()));
          const temPendChecklist = !!checklistPend || !!checklistReproc;
          const acaoDoc = checklistReproc || checklistPend;

          // Ação prioritária
          let acaoTitulo = "";
          let acaoSub = "";
          let acaoOnClick: (() => void) | null = null;
          let acaoChecklistBotao = false;

          if (pendingContracts > 0) {
            acaoTitulo = "Assinar contrato pendente";
            acaoSub = "Pagamento confirmado. Assine digitalmente para liberar a execução.";
            acaoOnClick = () => goSection("contratos");
          } else if (vencido) {
            acaoTitulo = `Renovar: ${vencido.label}`;
            acaoSub = `Vencido há ${Math.abs(vencido.days as number)} dia(s) — regularize com urgência.`;
            acaoOnClick = () => setShowAddDoc(true);
          } else if (venceHoje) {
            acaoTitulo = `Renovar: ${venceHoje.label}`;
            acaoSub = "Vence hoje — providencie a renovação imediatamente.";
            acaoOnClick = () => setShowAddDoc(true);
          } else if (temPendChecklist) {
            const tipo = String(acaoDoc?.tipo_documento || "documento").replace(/_/g, " ");
            acaoTitulo = checklistReproc ? `Reenviar: ${tipo}` : `Enviar: ${tipo}`;
            acaoSub = checklistReproc ? "Documento reprovado no processo — reenvie corrigido." : "Documento obrigatório ainda não enviado.";
            acaoChecklistBotao = true;
          } else if (docsHubReprovados > 0) {
            acaoTitulo = "Reenviar documento reprovado";
            acaoSub = `${docsHubReprovados} documento(s) precisam ser corrigidos.`;
            acaoOnClick = () => setShowAddDoc(true);
          } else if (cadastroIncompleto) {
            acaoTitulo = "Completar cadastro";
            acaoSub = resumoFaltantesCadastro(cliente) || "Dados básicos faltando.";
            acaoOnClick = () => setShowCadastroModal(true);
          }
          const temAcao = !!acaoOnClick || acaoChecklistBotao;

          // Anel de progresso
          const pct = totalDocs > 0 ? Math.round((docsAprovados / totalDocs) * 100) : 0;
          const circ = 188.5;
          const dashoffset = circ * (1 - pct / 100);
          const ringColor = pct >= 80 ? "#639922" : pct >= 50 ? "#BA7517" : "#E24B4A";

          // Jornada
          const hasProcess = processoSnap.ativos.length > 0;
          const hasCompletedProcess = processoSnap.ativos.some((p: any) =>
            ["concluido", "deferido", "finalizado"].includes(String(p.status || "").toLowerCase())
          );
          const steps: { label: string; state: "done" | "active" | "next" }[] = [
            { label: "Cadastro",   state: cadastroIncompleto ? "active" : "done" },
            { label: "Documentos", state: docsAprovados > 0 ? "done" : totalDocs > 0 ? "active" : "next" },
            { label: "Análise",    state: hasProcess ? "done" : totalDocs > 0 ? "active" : "next" },
            { label: "Processo",   state: hasCompletedProcess ? "done" : hasProcess ? "active" : "next" },
            { label: "Conclusão",  state: hasCompletedProcess ? "done" : "next" },
          ];

          // Docs vencendo
          const docsVencendoBreve = (analysis?.expDocs || []).filter(d => d.days !== null && (d.days as number) >= 0 && (d.days as number) <= 30);
          const docsVencidos2 = (analysis?.expDocs || []).filter(d => d.days !== null && (d.days as number) < 0);

          return (
            <>
              {/* ── Hero card ── */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-5 flex items-center gap-5">
                  {/* Anel */}
                  <div className="relative w-[72px] h-[72px] shrink-0">
                    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                      <circle cx="36" cy="36" r="30" fill="none"
                        stroke={ringColor} strokeWidth="7"
                        strokeDasharray={String(circ)}
                        strokeDashoffset={String(dashoffset)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[15px] font-bold text-slate-900 leading-none">{pct}%</span>
                      <span className="text-[8px] text-slate-400 uppercase tracking-wide mt-0.5">pronto</span>
                    </div>
                  </div>
                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-slate-900">
                      {cliente.nome_completo.split(" ")[0]},{" "}
                      {temAcao ? "há uma ação necessária" : docsVencendoBreve.length > 0 ? "atenção aos vencimentos" : "seu dossiê está em dia"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {totalDocs} documento{totalDocs !== 1 ? "s" : ""} enviado{totalDocs !== 1 ? "s" : ""} · {docsAprovados} aprovado{docsAprovados !== 1 ? "s" : ""}{docsAnalise > 0 ? ` · ${docsAnalise} em análise` : ""}
                    </div>
                    {temAcao ? (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Ação necessária
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Nenhuma ação necessária agora
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner de ação (só quando tem) */}
                {temAcao && (
                  <div className="border-t border-slate-100 bg-[#7A1F2B]/5 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[#7A1F2B] truncate">{acaoTitulo}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{acaoSub}</div>
                    </div>
                    <div className="shrink-0">
                      {acaoChecklistBotao && acaoDoc ? (
                        <ChecklistGuiadoBotao processoId={acaoDoc.processo_id} focusDocId={acaoDoc.id} />
                      ) : acaoOnClick ? (
                        <button type="button" onClick={acaoOnClick}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-bold transition">
                          Resolver <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Jornada */}
                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">Sua jornada</div>
                  <div className="flex items-center">
                    {steps.map((s, i) => (
                      <Fragment key={s.label}>
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                            ${s.state === "done" ? "bg-emerald-500 text-white" : s.state === "active" ? "bg-[#7A1F2B] text-white" : "bg-slate-100 text-slate-400"}`}>
                            {s.state === "done" ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                          </div>
                          <div className={`text-[9px] mt-1 font-medium text-center w-14 leading-tight
                            ${s.state === "done" ? "text-emerald-600" : s.state === "active" ? "text-[#7A1F2B]" : "text-slate-400"}`}>
                            {s.label}
                          </div>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-[2px] mb-4 ${s.state === "done" ? "bg-emerald-400" : "bg-slate-200"}`} />
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Números de documentos ── */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Documentos
                  </span>
                  <button type="button" onClick={() => setActiveSection("documentos")}
                    className="text-[11px] font-semibold text-[#7A1F2B] hover:underline flex items-center gap-0.5">
                    Ver hub <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-100">
                  {[
                    { val: docsAprovados,          lbl: "Aprovados",  color: "#639922", w: totalDocs ? (docsAprovados / totalDocs) * 100 : 0 },
                    { val: docsAnalise,             lbl: "Em análise", color: "#BA7517", w: totalDocs ? (docsAnalise / totalDocs) * 100 : 0 },
                    { val: docsVencendoBreve.length, lbl: "Vencendo",  color: "#E24B4A", w: docsVencendoBreve.length > 0 ? 100 : 0 },
                    { val: docsVencidos2.length,    lbl: "Vencidos",   color: "#888",    w: docsVencidos2.length > 0 ? 100 : 0 },
                  ].map((k) => (
                    <div key={k.lbl} className="p-3 flex flex-col gap-1">
                      <div className="text-[22px] font-bold leading-none" style={{ color: k.val > 0 ? k.color : "#cbd5e1" }}>{k.val}</div>
                      <div className="text-[9px] uppercase tracking-wide text-slate-400">{k.lbl}</div>
                      <div className="h-[3px] rounded-full bg-slate-100 mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${k.w}%`, background: k.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Vencendo em breve (condicional) ── */}
              {docsVencendoBreve.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Atenção — vencendo em breve</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {docsVencendoBreve.slice(0, 4).map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${(doc.days as number) <= 7 ? "bg-red-500" : "bg-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-slate-800 truncate">{doc.label}</div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wide">{doc.category}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap
                          ${(doc.days as number) <= 7 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {doc.days === 0 ? "Vence hoje" : `${doc.days}D restantes`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/60 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">Renove antes do vencimento para manter seu processo ativo.</span>
                    <button type="button" onClick={() => setShowAddDoc(true)}
                      className="text-[11px] font-bold text-[#7A1F2B] hover:underline flex items-center gap-0.5 shrink-0">
                      Renovar <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Processos + Financeiro ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                      <BriefcaseBusiness className="h-3.5 w-3.5" /> Processos
                    </span>
                    {processoSnap.ativos.length > 0 && (
                      <button type="button" onClick={() => setActiveSection("processos")}
                        className="text-[11px] font-semibold text-[#7A1F2B] hover:underline flex items-center gap-0.5">
                        Ver todos <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {processoSnap.ativos.length === 0 ? (
                    <div className="flex flex-col items-center gap-2.5 py-7 px-4 text-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        <BriefcaseBusiness className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-[12px] text-slate-500 leading-snug">Seu dossiê está pronto.<br />Inicie seu primeiro processo.</p>
                      <button type="button" onClick={() => navigate("/area-do-cliente/contratar")}
                        className="inline-flex items-center gap-1 h-8 px-4 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-bold transition">
                        Contratar serviço
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {processoSnap.ativos.slice(0, 3).map((p: any) => {
                        const meus = processoDocs.filter((d) => d.processo_id === p.id);
                        const metrics = computeChecklistMetrics(meus);
                        const sKey = String(p.status || "").toLowerCase();
                        const done = ["concluido", "deferido", "finalizado"].includes(sKey);
                        const bad = ["indeferido", "cancelado"].includes(sKey);
                        return (
                          <button key={p.id} type="button" onClick={() => setActiveSection("processos")}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="text-[12px] font-bold text-slate-900 truncate">{p.servico_nome || "Serviço"}</div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0
                                ${done ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                                {sKey.replace(/_/g, " ") || "ativo"}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${metrics.progresso}%`, background: done ? "#639922" : bad ? "#E24B4A" : "#BA7517" }} />
                            </div>
                            <div className="flex justify-between text-[10px] mt-1 text-slate-400">
                              <span>{metrics.cumpridos}/{metrics.total} documentos</span>
                              <span className="font-bold">{metrics.progresso}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {analysis && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" /> Financeiro
                      </span>
                      <button type="button" onClick={() => setActiveSection("financeiro")}
                        className="text-[11px] font-semibold text-[#7A1F2B] hover:underline flex items-center gap-0.5">
                        Ver tudo <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-[11px] text-slate-500">Total contratado</span>
                        <span className="text-[13px] font-bold text-slate-900">{formatCurrency(analysis.totalVendas)}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-[11px] text-slate-500">Cobranças</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                          ${vendas.length > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {vendas.length > 0 ? `${vendas.length} em aberto` : "Em dia"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Suporte ── */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-slate-800">Precisa de ajuda?</div>
                    <div className="text-[11px] text-slate-500">Fale com a equipe Quero Armas pelo WhatsApp</div>
                  </div>
                  <a href="https://wa.me/5511973000060" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-slate-700 text-[11px] font-bold hover:border-[#7A1F2B]/40 transition shrink-0">
                    Falar agora
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center py-4">
                <p className="text-[10px] text-slate-300 tracking-wider">Quero Armas · Área do Cliente · Acesso seguro e auditado</p>
              </div>
            </>
          );
        })()}
        </div>
        )}

        {(activeSection === "contratacoes" || activeSection === "processos") && (() => {
          /**
           * Cockpit Z6 Light — stack canônica do portal do cliente.
           * Renderiza o layout aprovado em `cockpits/cockpit-z6.jpg` populado
           * com dados reais do cliente quando disponíveis; cai no mock oficial
           * apenas se o cadastro ainda não tem processos reais.
           * Não alterar layout/tokens — ver mem://style/quero-armas/cockpit-z6-light-canonical.
           */
          const firstName = String(userName || cliente?.nome || "Cliente").trim().split(/\s+/)[0] || "Cliente";
          const cpfRaw = String(cliente?.cpf || "").replace(/\D/g, "");
          const cpfMascarado = cpfRaw.length === 11
            ? `${cpfRaw.slice(0, 3)}.${cpfRaw.slice(3, 6)}.${cpfRaw.slice(6, 9)}-${cpfRaw.slice(9)}`
            : "—";
          const membroDate = cliente?.created_at ? new Date(cliente.created_at) : null;
          const mesesPt = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
          const membroDesde = membroDate
            ? `${mesesPt[membroDate.getMonth()]}/${membroDate.getFullYear()}`
            : "—";
          const ativosCount = processos.filter((p: any) => !["concluido","deferido","finalizado","indeferido","cancelado"].includes(String(p.status || "").toLowerCase())).length;

          // Sem processos reais → não mostra mock/serviço de exemplo no portal do cliente.
          // Com processos reais → monta TODA a tela a partir das fontes reais (qa_processos,
          // qa_processo_documentos, qa_processo_eventos, qa_vendas, qa_crafs, qa_gtes,
          // qa_exames_cliente) preservando 100% o layout/tokens do Cockpit Z6 Light.
          if (processos.length === 0) {
            return (
              <div className="rounded-sm border border-[#E5E5E5] bg-white p-10 text-center text-[13px] text-[#6A6A6A]">
                Você ainda não possui processos ativos.
              </div>
            );
          }

          const cockpitProps = buildCockpitZ6FromReal({
            nomeCliente: firstName,
            cpfMascarado,
            membroDesde,
            processos,
            processoDocs,
            processoEventos,
            vendas,
            crafs,
            gtes,
            examesCliente,
            onFocoCta: () => setActiveSection("contratos"),
          });

          return (
            <div>
              <CockpitZ6MeusProcessos {...cockpitProps} />
            </div>
          );
        })()}

        {activeSection === "documentos" && analysis && (
          <DocumentosCategoriaZ6V3Panel
            cliente={cliente}
            meusDocs={meusDocs}
            customerId={customerId}
            onReload={() => setDocsReloadKey((k) => k + 1)}
            onOpenAdd={() => setShowAddDoc(true)}
          />
        )}

        {activeSection === "mensagens" && (
          <SectionCard icon={MessageCircle} title="Mensagens" color="hsl(35 92% 48%)">
            <CentralAjudaCliente />
          </SectionCard>
        )}

        {activeSection === "financeiro" && analysis && (
          <div className="space-y-4">
            <PortalScopeSelector hint="Cobranças sem venda vinculada só aparecem em 'Todos os processos'." />
            <SectionCard icon={Wallet} title="Financeiro" color="hsl(152 60% 42%)">
              {(() => {
                const vendaIdAlvo = currentScope.type === "processo" ? currentScope.vendaId : null;
                const vendasFiltradas = vendaIdAlvo != null
                  ? vendas.filter((v: any) => Number(getVendaFK(v)) === Number(vendaIdAlvo))
                  : vendas;
                const totalFiltrado = vendasFiltradas.reduce((a: number, v: any) => a + Number(v.valor_a_pagar || 0), 0);
                if (vendasFiltradas.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-slate-500">
                      {currentScope.type === "processo"
                        ? "Nenhuma cobrança vinculada a este processo."
                        : "Nenhuma cobrança registrada."}
                    </p>
                  );
                }
                return (
                  <>
                    <div className="space-y-2">{vendasFiltradas.map((v: any) => <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3"><div><div className="text-[12px] font-bold text-slate-800">{formatDate(v.data_cadastro || v.created_at)}</div><div className="text-[10px] text-slate-500">{v.forma_pagamento || 'Contratação'}</div></div><div className="font-mono text-sm font-bold text-slate-900">{formatCurrency(Number(v.valor_a_pagar || 0))}</div></div>)}</div>
                    <div className="mt-4 flex justify-between border-t border-slate-200 pt-3"><span className="text-[11px] font-bold uppercase text-slate-500">{currentScope.type === "processo" ? "Total do processo" : "Total investido"}</span><span className="font-mono text-base font-bold text-slate-900">{formatCurrency(totalFiltrado)}</span></div>
                  </>
                );
              })()}
            </SectionCard>
          </div>
        )}

        {activeSection === "configuracoes" && (
          <SectionCard icon={Settings} title="Configurações" color="hsl(220 65% 48%)">
            <div className="grid gap-3 md:grid-cols-2 mb-4">
              <div className="rounded-xl border border-slate-200 p-4"><div className="text-[12px] font-bold text-slate-900">Dados de acesso</div><p className="mt-1 text-[11px] text-slate-500">Seu acesso está vinculado ao cadastro ativo da Área do Cliente.</p></div>
              <button type="button" onClick={handleLogout} className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"><div className="text-[12px] font-bold text-slate-900">Sair com segurança</div><p className="mt-1 text-[11px] text-slate-500">Encerra a sessão neste dispositivo.</p></button>
            </div>

            {/* ── Tema do menu lateral ─────────────────────────────────────── */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[12px] font-bold text-slate-900 uppercase tracking-wider">Tema do menu lateral</div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Personalize a aparência do menu preto à esquerda. O texto permanece sempre legível.
                  </p>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Atual: {sidebarTheme.label}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Escolha o tema
                  </label>
                  <select
                    value={sidebarTheme.key}
                    onChange={(e) => {
                      const next = QA_SIDEBAR_THEMES.find((t) => t.key === e.target.value);
                      if (!next) return;
                      setSidebarTheme(next);
                      setStoredSidebarTheme(next.key);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none focus:border-slate-500"
                  >
                    {QA_SIDEBAR_THEMES.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Os temas mudam apenas o acabamento visual do menu preto: topo, gradiente sutil e cor de destaque.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = QA_SIDEBAR_THEMES.find((t) => t.key === sidebarTheme.key);
                    if (!next) return;
                    setSidebarTheme(next);
                    setStoredSidebarTheme(next.key);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900">Prévia do menu</div>
                      <div className="text-[10px] text-slate-500">{sidebarTheme.description}</div>
                    </div>
                    <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7A1F2B] text-white">
                      {sidebarTheme.label}
                    </span>
                  </div>

                  <div className="h-[120px] w-full rounded-xl relative overflow-hidden" style={{ background: sidebarTheme.bg }}>
                    <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: sidebarTheme.stripe }} />
                    <div className="absolute inset-y-0 left-0 w-[84px] border-r border-white/10 bg-black/30" />
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-[#7A1F2B] flex items-center justify-center text-[10px] font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>QA</div>
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white" style={{ fontFamily: "Oswald, sans-serif" }}>Arsenal Inteligente</div>
                        <div className="text-[7px] uppercase tracking-[0.22em] text-white/50" style={{ fontFamily: "Oswald, sans-serif" }}>Área do Cliente</div>
                      </div>
                    </div>
                    <div className="absolute left-0 top-[48px] w-[84px] px-0">
                      <div className="flex items-center gap-2 border-l-2 bg-white/6 px-3 py-2" style={{ borderLeftColor: sidebarTheme.accent }}>
                        <div className="h-2.5 w-2.5 rounded-sm bg-white/80" />
                        <div className="h-[5px] w-8 rounded bg-white/90" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 opacity-70">
                        <div className="h-2.5 w-2.5 rounded-sm bg-white/60" />
                        <div className="h-[5px] w-7 rounded bg-white/60" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 opacity-70">
                        <div className="h-2.5 w-2.5 rounded-sm bg-white/60" />
                        <div className="h-[5px] w-9 rounded bg-white/60" />
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Suas Criações (upload de temas) ──────────────────────────── */}
            <CustomThemesUploader
              currentKey={sidebarTheme.key}
              onApply={(t) => { setSidebarTheme(t); setStoredSidebarTheme(t.key); }}
            />
          </SectionCard>
        )}

        {activeSection === "pendencias" && (
          <div className="space-y-4">
            <PortalScopeSelector hint="Filtra pendências do checklist por processo." />
            <SectionCard icon={AlertTriangle} title="Pendências" color="hsl(352 60% 30%)">
              {(() => {
                const docsBase = processoDocs.filter((d) =>
                  d.obrigatorio &&
                  (isChecklistPendente(d.status) ||
                    ["invalido", "reprovado", "divergente", "rejeitado", "pendente_reenvio"].includes(String(d.status || "").toLowerCase())),
                );
                const docsFilt = currentScope.type === "processo"
                  ? docsBase.filter((d) => String(d.processo_id) === String(currentScope.processoId))
                  : docsBase;
                if (docsFilt.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 font-semibold">
                        {currentScope.type === "processo"
                          ? "Sem pendências obrigatórias neste processo."
                          : "Você não tem pendências obrigatórias agora."}
                      </p>
                    </div>
                  );
                }
                // Agrupa por processo (UI mais clara mesmo em "Todos").
                const byProc = new Map<string, any[]>();
                for (const d of docsFilt) {
                  const key = String(d.processo_id);
                  if (!byProc.has(key)) byProc.set(key, []);
                  byProc.get(key)!.push(d);
                }
                return (
                  <div className="space-y-4">
                    <div className="flex justify-end"><ChecklistGuiadoBotao /></div>
                    {Array.from(byProc.entries()).map(([procId, lista]) => {
                      const proc = processos.find((p) => String(p.id) === procId);
                      const nome = proc?.servico_nome || "Processo";
                      return (
                        <div key={procId} className="rounded-xl border border-slate-200 bg-white">
                          <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            {nome} <span className="ml-1 text-slate-400">· {lista.length} pendência(s)</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {lista.map((d) => {
                              const reprov = ["invalido", "reprovado", "divergente", "rejeitado", "pendente_reenvio"].includes(String(d.status || "").toLowerCase());
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => abrirChecklistGuiado({ processoId: d.processo_id, focusDocId: d.id })}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition"
                                >
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-semibold text-slate-800 truncate">
                                      {String(d.tipo_documento || "Documento").replace(/_/g, " ").toUpperCase()}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {d.etapa ? String(d.etapa).toUpperCase() : "—"}
                                    </div>
                                  </div>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${reprov ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                                    {reprov ? "Reenviar" : "Pendente"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </SectionCard>
          </div>
        )}

        {activeSection === "contratos" && (
          <div id="qa-portal-contratos" tabIndex={-1} className="space-y-4 outline-none">
            {cliente?.id ? (
              <QAContratosCockpitV1 cliente={cliente} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Nenhum contrato disponível.</p>
            )}
          </div>
        )}
      </main>

      {(customerId || cliente?.id) && (
        <ClienteDocsHubModal
          open={showAddDoc}
          onClose={() => setShowAddDoc(false)}
          customerId={customerId}
          qaClienteId={cliente?.id ?? null}
          mode="portal"
          clienteCpf={String(cliente?.cpf || "").replace(/\D/g, "") || null}
          clienteNome={cliente?.nome_completo || null}
          clienteDataNascimento={cliente?.data_nascimento || null}
          clienteNomeMae={cliente?.nome_mae || null}
          docsAprovados={meusDocs.filter((d: any) => d.status === "aprovado")}
          onSaved={() => setDocsReloadKey((k) => k + 1)}
        />
      )}

      {cliente?.id ? (
        <ChecklistGuiado clienteId={cliente.id} onUpdated={() => setDocsReloadKey((k) => k + 1)} />
      ) : null}

      {cliente?.id ? (
        <ClienteCadastroProgressivoModal
          open={showCadastroModal}
          onClose={() => setShowCadastroModal(false)}
          cliente={cliente}
          onUpdated={() => setDocsReloadKey((k) => k + 1)}
        />
      ) : null}

      {showContratoPopup && pendingContracts > 0 && (
        <div
          className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowContratoPopup(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-sm border border-[#E4E4E4] shadow-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E4E4] bg-[#FAFAFA]">
              <div className="flex gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </div>
              <div className="text-[10px] font-bold text-[#6A6A6A] tracking-[0.1em] uppercase">
                Protocolo {new Date().toISOString().slice(0,10).replace(/-/g,'.')}
              </div>
              <div className="w-8" />
            </div>

            {/* Split Body */}
            <div className="flex flex-col md:flex-row">
              {/* Sidebar: Status Column */}
              <div className="hidden md:flex w-48 bg-[#FAFAFA] border-r border-[#E4E4E4] p-8 flex-col items-center justify-center text-center shrink-0">
                <div className="text-6xl font-light text-[#0A0A0A] leading-none tracking-tighter">
                  {String(pendingContracts).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-[#6A6A6A] uppercase mt-1 mb-8">
                  Pendentes
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="w-px h-10 bg-[#E4E4E4]" />
                  <div className="w-9 h-9 rounded-full border border-[#E4E4E4] flex items-center justify-center bg-white my-2">
                    <FileText className="h-4 w-4 text-[#0A0A0A]" />
                  </div>
                  <div className="w-px h-10 bg-[#E4E4E4]" />
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
                <header className="mb-6">
                  <span className="inline-block text-[10px] font-bold tracking-[0.25em] text-[#6A6A6A] uppercase mb-2">
                    Contrato aguardando sua assinatura
                  </span>
                  <h2 className="text-xl md:text-2xl font-medium text-[#0A0A0A] leading-tight tracking-tight">
                    {pendingContracts === 1
                      ? "Você tem 1 contrato pendente"
                      : `Você tem ${pendingContracts} contratos pendentes`}
                  </h2>
                </header>

                <div className="space-y-5">
                  <p className="text-[#6A6A6A] text-sm leading-relaxed">
                    Utilize sua conta{" "}
                    <span className="text-[#0A0A0A] font-semibold border-b border-[#E4E4E4]">GOV.BR</span>{" "}
                    ou certificado{" "}
                    <span className="text-[#0A0A0A] font-semibold border-b border-[#E4E4E4]">ICP-Brasil</span>{" "}
                    para assinar os documentos de forma segura e com validade jurídica.
                  </p>

                  <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowContratoPopup(false)}
                      className="h-10 px-5 rounded-sm border border-[#E4E4E4] text-[#0A0A0A] text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-[#FAFAFA] transition-colors"
                    >
                      Agora não
                    </button>
                    <button
                      type="button"
                      onClick={goContractsSection}
                      className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-sm bg-[#0A0A0A] hover:bg-[#1a1a1a] text-white text-[11px] font-bold uppercase tracking-[0.18em] transition-colors"
                    >
                      Assinar agora <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer info */}
            <div className="px-6 md:px-10 py-3 bg-white border-t border-[#FAFAFA] flex justify-end items-center">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#28C840]" />
                <span className="text-[10px] font-medium text-[#6A6A6A] uppercase tracking-wider">
                  Ambiente seguro
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PortalFilterProvider>
  );
}
