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
  ShieldCheck,
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
import ChecklistGuiado from "@/components/quero-armas/portal/ChecklistGuiado";
import ChecklistGuiadoBotao from "@/components/quero-armas/portal/ChecklistGuiadoBotao";
import { abrirChecklistGuiado } from "@/lib/quero-armas/checklistGuiadoBus";
import { PortalFilterProvider, type PortalScope } from "@/components/quero-armas/portal/PortalFilterContext";
import PortalScopeSelector from "@/components/quero-armas/portal/PortalScopeSelector";
import { Crosshair as CrosshairIcon, LayoutDashboard, Upload } from "lucide-react";
import { ForcePasswordChangeModal } from "@/components/quero-armas/clientes/ForcePasswordChangeModal";
import { ensureClienteFromAuthUser } from "@/lib/quero-armas/ensureClienteFromAuthUser";
import ArmaManualForm from "@/components/quero-armas/arsenal/ArmaManualForm";
import { getQAServiceDisplayName } from "@/lib/quero-armas/serviceDisplay";
import ClienteHealthBadge from "@/components/quero-armas/clientes/ClienteHealthBadge";
import { calcularPrazosProcessuais, corPrazo } from "@/lib/quero-armas/prazosProcessuais";
import { computeChecklistMetrics, isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";
import ClienteCadastroProgressivoModal from "@/components/quero-armas/portal/ClienteCadastroProgressivoModal";
import { cadastroEstaIncompleto, resumoFaltantesCadastro } from "@/lib/quero-armas/cadastroCompleteness";
import EntradaWizard, { type EntradaWizardRespostas } from "@/components/quero-armas/portal/entrada-wizard/EntradaWizard";
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
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [avatarOficial, setAvatarOficial] = useState<ClienteAvatarOficial | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
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

  // BLOCO 9 — Auto-abre o Assistente de Entrada para cliente novo que NUNCA
  // respondeu (entrada_respondida_em IS NULL) E ainda não tem processo ativo.
  // Clientes legados foram backfillados na migração; não vêem o wizard de surpresa.
  useEffect(() => {
    if (entradaAutoChecked) return;
    if (!cliente) return;
    const respondida = (cliente as any)?.entrada_respondida_em ?? null;
    const semProcessos = !processos || processos.length === 0;
    if (respondida == null && semProcessos) {
      setEntradaWizardOpen(true);
    }
    setEntradaAutoChecked(true);
  }, [cliente, processos, entradaAutoChecked]);

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
    // Navega para o catálogo com filtro de trilha aplicado (chip removível lá).
    const trilha = respostas.objetivo;
    navigate(`/area-do-cliente/contratar${trilha !== "indefinido" ? `?trilha=${trilha}` : ""}`);
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
          .select("id, cliente_id, venda_id, servico_id, servico_nome, servico_slug, status, pagamento_status, data_criacao, prazo_critico_data, primeiro_doc_aprovado_em")
          .eq("cliente_id", clienteIdReal)
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
    { key: "resumo" as const, label: "Resumo", icon: Grid2X2, path: "/area-do-cliente", group: "primary" as const },
    { key: "pendencias" as const, label: "Pendências", icon: AlertTriangle, path: "/area-do-cliente/pendencias", group: "primary" as const },
    { key: "processos" as const, label: "Meus processos", icon: BriefcaseBusiness, path: "/area-do-cliente/processos", group: "primary" as const },
    { key: "financeiro" as const, label: "Financeiro", icon: Wallet, path: "/area-do-cliente/financeiro", group: "primary" as const },
    { key: "documentos" as const, label: "Documentos", icon: FileText, path: "/area-do-cliente/documentos", group: "primary" as const },
    { key: "contratos" as const, label: "Contratos", icon: FileStack, path: "/area-do-cliente/contratos", group: "primary" as const },
    { key: "arsenal" as const, label: "Meu Arsenal", icon: Shield, path: "/area-do-cliente/arsenal", group: "secondary" as const },
    { key: "mensagens" as const, label: "Suporte", icon: MessageCircle, path: "/area-do-cliente/mensagens", group: "secondary" as const },
    { key: "configuracoes" as const, label: "Configurações", icon: Settings, path: "/area-do-cliente/configuracoes", group: "secondary" as const },
  ], []);
  const primaryNavItems = useMemo(() => navItems.filter((i) => i.group === "primary"), [navItems]);
  const secondaryNavItems = useMemo(() => navItems.filter((i) => i.group === "secondary"), [navItems]);

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
    setMobileNavOpen(false);
    // Não usar navigate(): rotas internas como /area-do-cliente/arsenal não existem
    // e o catch-all do router devolveria para "/". Mantemos a URL em /area-do-cliente.
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
    <div className="min-h-dvh bg-slate-50 text-slate-900 lg:pl-72 overflow-x-hidden">
      <ForcePasswordChangeModal
        open={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-slate-200 bg-white/95 p-4 shadow-[12px_0_40px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between h-20">
          <img src={logoColor} alt="Quero Armas" className="h-10 w-auto object-contain" draggable={false} />
          <button type="button" aria-label="Recolher menu lateral" className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-500 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1F2B]"><ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" /></button>
        </div>
        <nav className="mt-6 space-y-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key || (item.key === "processos" && activeSection === "contratacoes");
            return (
              <button key={item.key} type="button" onClick={() => goSection(item.key)} className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-bold transition ${active ? "bg-[#FBF3F4] text-[#7A1F2B]" : "text-slate-700 hover:bg-slate-50"}`}>
                <Icon className="h-5 w-5" /> {item.label}
              </button>
            );
          })}
          <div className="mt-4 mb-1 px-4 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Mais</div>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button key={item.key} type="button" onClick={() => goSection(item.key)} className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-[12px] font-semibold transition ${active ? "bg-[#FBF3F4] text-[#7A1F2B]" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-900"><HelpCircle className="h-4 w-4" /> Precisa de ajuda?</div>
          <p className="mt-2 text-[12px] text-slate-500">Fale com nosso time</p>
          <button type="button" onClick={() => goSection("mensagens")} className="mt-3 h-10 w-full rounded-lg border border-[#7A1F2B] text-[12px] font-bold text-[#7A1F2B]">Abrir chat</button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/35 lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-[82vw] max-w-xs bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <img src={logoColor} alt="Quero Armas" className="h-10 w-auto object-contain" draggable={false} />
            <nav className="mt-6 space-y-2">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => goSection(item.key)} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-bold ${activeSection === item.key ? "bg-[#FBF3F4] text-[#7A1F2B]" : "text-slate-700"}`}><Icon className="h-5 w-5" />{item.label}</button>; })}</nav>
          </div>
        </div>
      )}

      {/* ═══ TOP BAR — Premium Light ═══ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="relative max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button type="button" aria-label="Abrir menu de navegação" onClick={() => setMobileNavOpen(true)} className="lg:hidden h-11 w-11 rounded-lg border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1F2B]"><Menu className="h-4 w-4" aria-hidden="true" /></button>
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

      <main className="max-w-[1540px] mx-auto px-4 lg:px-8 py-6 space-y-5 overflow-x-hidden">
        <div className="sticky top-[64px] z-30 mb-5 rounded-xl border border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex gap-4 sm:gap-6 overflow-x-auto -mx-1 px-1 scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Seções da Área do Cliente"
            >
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.key || (item.key === "processos" && activeSection === "contratacoes");
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    onClick={() => goSection(item.key)}
                    className={`relative shrink-0 inline-flex items-center gap-2 px-1 min-h-11 py-2 text-[13px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1F2B] rounded-md ${active ? "text-[#7A1F2B]" : "text-slate-500"}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" /> {item.label}
                    {active && <span className="absolute inset-x-0 -bottom-2 h-0.5 rounded-full bg-[#7A1F2B]" />}
                  </button>
                );
              })}
            </div>
            <button type="button" aria-label="Enviar documento" onClick={() => setShowAddDoc(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7A1F2B] px-4 min-h-11 py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#641722] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1F2B] focus-visible:ring-offset-2">
              <Upload className="h-4 w-4" aria-hidden="true" /> Enviar documento
            </button>
          </div>
        </div>

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

        {/* ═══ HERO — PRÓXIMA AÇÃO ═══ */}
        {(() => {
          const cadastroIncompleto = cadastroEstaIncompleto(cliente);
          const docsHubReprovados = meusDocs.filter((d: any) => d.status === "reprovado").length;
          const vencido = analysis?.expDocs.find((d) => d.days !== null && (d.days as number) < 0);
          const venceHoje = analysis?.expDocs.find((d) => d.days === 0);
          const checklistPend = processoDocs.find((d) => d.obrigatorio && isChecklistPendente(d.status));
          const checklistReproc = processoDocs.find((d) => d.obrigatorio && ["invalido", "reprovado", "divergente", "pendente_reenvio"].includes(String(d.status || "").toLowerCase()));
          const temPendChecklist = !!checklistPend || !!checklistReproc;

          let titulo = "Tudo em dia";
          let descricao = "Sem pendências no momento — você pode acompanhar seus processos a qualquer momento.";
          let onClick: (() => void) | null = null;
          let usaChecklistBotao = false;

          if (vencido) {
            // Renovação de documento expirado pode envolver acervo geral OU
            // um item de processo. Se houver checklistReproc/checklistPend
            // referente, priorizamos o assistente; caso contrário, hub geral.
            titulo = `Renovar ${vencido.label}`;
            descricao = `Vencido há ${Math.abs(vencido.days as number)} dia(s) — regularize com urgência.`;
            onClick = () => setShowAddDoc(true);
          } else if (venceHoje) {
            titulo = `Renovar ${venceHoje.label}`;
            descricao = "Vence hoje — providencie a renovação imediatamente.";
            onClick = () => setShowAddDoc(true);
          } else if (temPendChecklist) {
            const d = (checklistReproc || checklistPend)!;
            const tipo = String(d.tipo_documento || "documento").replace(/_/g, " ").toUpperCase();
            titulo = checklistReproc ? `Reenviar ${tipo}` : `Enviar ${tipo}`;
            descricao = checklistReproc
              ? "Documento do processo precisa ser corrigido e reenviado."
              : "Documento obrigatório do checklist ainda não enviado.";
            usaChecklistBotao = true;
          } else if (docsHubReprovados > 0) {
            titulo = "Reenviar documento reprovado";
            descricao = `${docsHubReprovados} documento(s) precisam ser corrigidos.`;
            onClick = () => setShowAddDoc(true);
          } else if (cadastroIncompleto) {
            titulo = "Completar seu cadastro";
            descricao = resumoFaltantesCadastro(cliente) || "Dados básicos faltando.";
            onClick = () => setShowCadastroModal(true);
          }

          const temAcao = !!onClick || usaChecklistBotao;

          return (
            <div className="bg-white rounded-2xl border border-[#7A1F2B]/40 shadow-sm overflow-hidden">
              <div className="h-1 w-full" style={{ background: temAcao ? "#7A1F2B" : "hsl(152 60% 42%)" }} />
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${temAcao ? "bg-[#FBF3F4]" : "bg-emerald-50"}`}>
                  {temAcao ? <AlertTriangle className="h-6 w-6 text-[#7A1F2B]" /> : <CheckCircle className="h-6 w-6 text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">Próxima ação</div>
                  <div className="text-[15px] md:text-lg font-bold text-slate-900 mt-1">
                    Olá, {cliente.nome_completo.split(" ")[0]} — {titulo}
                  </div>
                  <div className="text-[12px] text-slate-600 mt-0.5">{descricao}</div>
                </div>
                <div className="shrink-0">
                  {usaChecklistBotao ? (
                    (() => {
                      const d = (checklistReproc || checklistPend)!;
                      return (
                        <ChecklistGuiadoBotao
                          processoId={d.processo_id}
                          focusDocId={d.id}
                        />
                      );
                    })()
                  ) : onClick ? (
                    <button
                      type="button"
                      onClick={onClick}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#7A1F2B] hover:bg-[#641722] text-white text-[12px] font-bold uppercase tracking-wider transition shadow-sm"
                    >
                      Resolver agora <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 text-[12px] font-bold uppercase tracking-wider">
                      <CheckCircle className="h-4 w-4" /> Em dia
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ 4 KPIs COMPACTOS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const docsHubReprovados = meusDocs.filter((d: any) => d.status === "reprovado").length;
            const totalPend = processoSnap.aguardandoAcaoCliente + docsHubReprovados;
            const kpis: { label: string; value: React.ReactNode; icon: any; color: string; target: typeof activeSection }[] = [
              { label: "Pendências", value: totalPend, icon: AlertTriangle, color: "#7A1F2B", target: "pendencias" },
              { label: "Processos ativos", value: processoSnap.ativos.length, icon: BriefcaseBusiness, color: "hsl(220 65% 48%)", target: "processos" },
              { label: "Documentos", value: meusDocs.length, icon: FileText, color: "hsl(262 60% 55%)", target: "documentos" },
              { label: "Investido", value: analysis ? formatCurrency(analysis.totalVendas) : "—", icon: DollarSign, color: "hsl(152 60% 42%)", target: "financeiro" },
            ];
            return kpis.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => setActiveSection(k.target)}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left hover:border-[#7A1F2B]/40 hover:shadow transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${k.color}14` }}>
                      <Icon className="h-4 w-4" style={{ color: k.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</div>
                      <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">{k.value}</div>
                      <div className="text-[10px] font-semibold text-[#7A1F2B] mt-1 inline-flex items-center gap-0.5">
                        Ver detalhes <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            });
          })()}
        </div>

        {/* ═══ PROCESSOS EM ANDAMENTO ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-800 inline-flex items-center gap-2">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-[#7A1F2B]" /> Processos em andamento
            </h3>
            <button
              type="button"
              onClick={() => setActiveSection("processos")}
              className="text-[11px] font-semibold text-[#7A1F2B] hover:underline inline-flex items-center gap-0.5"
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-5">
            {processoSnap.ativos.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-[12px] text-slate-500 mb-3">Nenhum processo em andamento.</p>
                <button
                  type="button"
                  onClick={() => navigate("/area-do-cliente/contratar")}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#7A1F2B] hover:bg-[#641722] text-white text-[11px] font-bold uppercase tracking-wider"
                >
                  Contratar serviço
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {processoSnap.ativos.slice(0, 3).map((p: any) => {
                  const meus = processoDocs.filter((d) => d.processo_id === p.id);
                  const metrics = computeChecklistMetrics(meus);
                  const sKey = String(p.status || "").toLowerCase();
                  const done = ["concluido", "deferido", "finalizado"].includes(sKey);
                  const bad = ["indeferido", "cancelado"].includes(sKey);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveSection("processos")}
                      className="w-full text-left rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-[#7A1F2B]/30 transition p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-bold text-slate-900 truncate">{p.servico_nome || "Serviço"}</div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${done ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                          {sKey.replace(/_/g, " ") || "ATIVO"}
                        </span>
                      </div>
                      <div className="mt-2 w-full h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${metrics.progresso}%`, background: done ? "hsl(152 60% 42%)" : bad ? "hsl(0 72% 55%)" : "hsl(38 92% 50%)" }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] mt-1">
                        <span className="text-slate-500">{metrics.cumpridos} de {metrics.total} documentos</span>
                        <span className="font-bold text-slate-700">{metrics.progresso}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RESUMO FINANCEIRO COMPACTO ═══ */}
        {analysis && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-800 inline-flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-[#7A1F2B]" /> Resumo financeiro
              </h3>
              <button
                type="button"
                onClick={() => setActiveSection("financeiro")}
                className="text-[11px] font-semibold text-[#7A1F2B] hover:underline inline-flex items-center gap-0.5"
              >
                Ver financeiro <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total contratado</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">{formatCurrency(analysis.totalVendas)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cobranças</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{vendas.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ EQUIPE QUERO ARMAS ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-800 inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[#7A1F2B]" /> Equipe Quero Armas
            </h3>
          </div>
          <div className="p-5 flex flex-col md:flex-row md:items-center gap-3">
            <p className="text-[12px] text-slate-600 flex-1">
              Precisa falar com a gente? A equipe Quero Armas está disponível pelo WhatsApp para acompanhar seu processo.
            </p>
            <a
              href="https://wa.me/5511973000060"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#7A1F2B] hover:bg-[#641722] text-white text-[12px] font-bold uppercase tracking-wider transition shadow-sm shrink-0"
            >
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-300 tracking-wider">Quero Armas · Área do Cliente · Acesso seguro e auditado</p>
        </div>
        </div>
        )}

        {(activeSection === "contratacoes" || activeSection === "processos") && (
          <div className="space-y-4">
            <PortalScopeSelector hint="Filtra histórico, linha do tempo e cards de processo." />
            <SectionCard icon={BriefcaseBusiness} title="Meus processos" color="hsl(352 60% 30%)">
              <div className="mb-4 flex justify-end"><button type="button" onClick={() => navigate("/area-do-cliente/contratar")} className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-4 py-2 text-[12px] font-bold text-white"><ShoppingBag className="h-4 w-4" /> Contratar novo serviço</button></div>
              {cliente?.id ? (
                <div className="mb-4 rounded-2xl border border-[#7A1F2B]/20 bg-gradient-to-br from-[#7A1F2B]/5 to-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-slate-900">Envie seus documentos com o assistente guiado</div>
                      <p className="mt-0.5 text-[11px] text-slate-600">Um item por vez, com validação automática por IA. Igual à abertura de conta de um banco.</p>
                    </div>
                    <ChecklistGuiadoBotao />
                  </div>
                </div>
              ) : null}
              {cliente?.id ? (
                <div className="mb-4">
                  <ContratoBlock clienteId={cliente.id} />
                </div>
              ) : null}
              {cliente?.id ? (
                <ClienteProcessosSection
                  clienteId={cliente.id}
                  processoIdFiltro={currentScope.type === "processo" ? currentScope.processoId ?? null : null}
                />
              ) : null}
            </SectionCard>

            {(() => {
              const tlFiltered = currentScope.type === "processo"
                ? timeline // timeline events não têm processo_id direto; ver nota abaixo
                : timeline;
              // A linha do tempo combina vendas + itens + eventos de processo.
              // Quando filtrada por processo, mostramos apenas eventos com vínculo
              // direto a esse processo via processo_id (qa_processo_eventos).
              const tlForScope = currentScope.type === "processo"
                ? processoEventos
                    .filter((ev: any) => String(ev.processo_id) === String(currentScope.processoId))
                    .map((ev: any) => ({
                      date: ev.created_at,
                      label: ev.descricao || ev.tipo_evento || "Evento",
                      icon: Activity,
                      color: "hsl(220 60% 48%)",
                      sub: null as string | null,
                    }))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 20)
                : tlFiltered;
              if (tlForScope.length === 0) return null;
              return (
              <SectionCard icon={Activity} title="Linha do Tempo" color="hsl(190 80% 42%)">
                <div className="relative pl-6">
                  <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-200" />
                  <div className="space-y-3">
                    {tlForScope.map((ev, i) => {
                      const Icon = ev.icon;
                      return (
                        <div key={i} className="relative flex items-start gap-3">
                          <div className="absolute -left-3.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center z-10" style={{ background: `${ev.color}18` }}>
                            <Icon className="h-2.5 w-2.5" style={{ color: ev.color }} />
                          </div>
                          <div className="flex-1 pl-4">
                            <div className="text-[11px] font-medium text-slate-700">{ev.label}</div>
                            {ev.sub && <div className="mt-0.5 text-[10px] text-slate-500">{ev.sub}</div>}
                            <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(ev.date)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
              );
            })()}

            {cliente?.id && (
              <SectionCard icon={History} title="Histórico de Atualizações" color="hsl(220 65% 48%)">
                <HistoricoAtualizacoes clienteId={cliente.id} showSnapshot={false} />
              </SectionCard>
            )}
          </div>
        )}

        {activeSection === "documentos" && analysis && (
          <div className="space-y-4">
            <PortalScopeSelector hint="Documentos sem vínculo direto só aparecem em 'Todos os processos'." />
            <SectionCard icon={FileText} title="Documentos com validade" color="hsl(262 60% 55%)">
              <div className="mb-4 flex justify-end"><button type="button" onClick={() => setShowAddDoc(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-4 py-2 text-[12px] font-bold text-white"><Upload className="h-4 w-4" /> Enviar documento</button></div>
              {(() => {
                // Documentos com validade: CR/CRAF/GTE/Exames/Hub não têm
                // processo_id explícito no schema atual. Quando o escopo é um
                // processo, mostramos somente os "serviço" associados àquele
                // processo (via servico_id ↔ scope.processoId via processos[]).
                let docs = analysis.expDocs;
                if (currentScope.type === "processo") {
                  const proc = processos.find((p) => String(p.id) === String(currentScope.processoId));
                  const procServicoNome = proc
                    ? (getQAServiceDisplayName({
                        ...catalogoByServicoId[Number(proc.servico_id)],
                        servico_id: proc.servico_id,
                        servico_nome: proc.servico_nome || SERVICO_MAP[proc.servico_id],
                      }) || proc.servico_nome)
                    : null;
                  docs = analysis.expDocs.filter((d) =>
                    procServicoNome
                      ? d.label.toLowerCase().includes(String(procServicoNome).toLowerCase())
                      : false,
                  );
                }
                return docs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    {currentScope.type === "processo"
                      ? "Nenhum documento com validade vinculado a este processo."
                      : "Nenhum documento com validade cadastrado."}
                  </p>
                ) : (
                  <div className="grid gap-2">{docs.map((doc, i) => <div key={i} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${urgencyBg(doc.days)}`}><div className="min-w-0"><span className="mr-2 rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{doc.category}</span><span className="text-[12px] font-semibold text-slate-800">{doc.label}</span></div><div className="shrink-0 text-right"><div className="text-[10px] font-mono text-slate-500">{formatDate(doc.date)}</div><div className={`text-[9px] font-bold ${urgencyColor(doc.days)}`}>{urgencyLabel(doc.days)}</div></div></div>)}</div>
                );
              })()}
            </SectionCard>

            {(customerId || cliente?.id) && (
              <SectionCard icon={FolderArchive} title="Meu Hub de Documentos" color="hsl(280 60% 50%)">
                {currentScope.type === "processo" && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    O Hub de Documentos do cliente é compartilhado entre processos.
                    Itens sem vínculo direto continuam visíveis apenas em <strong>"Todos os processos"</strong>.
                  </div>
                )}
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

                {(() => {
                  // qa_documentos_cliente não possui processo_id no schema atual.
                  // Por isso, ao filtrar por processo, escondemos o hub completo
                  // (já avisamos no banner acima). Em "Todos" mantemos a lista.
                  if (currentScope.type === "processo") return null;
                  return meusDocs.length === 0 ? (
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
                  );
                })()}
              </SectionCard>
            )}
          </div>
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4"><div className="text-[12px] font-bold text-slate-900">Dados de acesso</div><p className="mt-1 text-[11px] text-slate-500">Seu acesso está vinculado ao cadastro ativo da Área do Cliente.</p></div>
              <button type="button" onClick={handleLogout} className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50"><div className="text-[12px] font-bold text-slate-900">Sair com segurança</div><p className="mt-1 text-[11px] text-slate-500">Encerra a sessão neste dispositivo.</p></button>
            </div>
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
          <div className="space-y-4">
            <PortalScopeSelector hint="Contratos são compartilhados entre processos do mesmo cliente." />
            <SectionCard icon={FileStack} title="Contratos" color="hsl(352 60% 30%)">
              {currentScope.type === "processo" && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  Os contratos abaixo são do cliente como um todo. Quando não houver
                  vínculo direto entre contrato e processo, o documento permanece
                  visível para evitar omissão indevida.
                </div>
              )}
              {cliente?.id ? (
                <>
                  <ContratoBlock clienteId={cliente.id} />
                  {(cliente as any)?.id_legado != null && (
                    <div className="mt-4"><ContratosPosPagamentoCard clienteIdLegado={(cliente as any).id_legado} /></div>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Nenhum contrato disponível.</p>
              )}
            </SectionCard>
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
    </div>
    </PortalFilterProvider>
  );
}
