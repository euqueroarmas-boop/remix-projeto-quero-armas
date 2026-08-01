import { useEffect, useState, useMemo, Fragment, useRef, useCallback } from "react";
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
  ShieldCheck, BellDot, FolderKanban, Files, ScrollText, Headphones, SlidersHorizontal, Loader2,
  Boxes, PackageOpen, Download,
} from "lucide-react";
import { getDataEmissaoDocumentoHub, getValidadeInfo } from "@/lib/quero-armas/validadeDocumento";
import { HistoricoAtualizacoes } from "@/components/quero-armas/clientes/HistoricoAtualizacoes";
import { CentralAjudaCliente } from "@/components/quero-armas/cliente/CentralAjudaCliente";
import { Button } from "@/components/ui/button";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { Camera, Wand2 } from "lucide-react";
import { ArsenalView } from "@/components/quero-armas/arsenal/ArsenalView";
import ClienteAnaliseAlvoSection from "@/components/quero-armas/portal/ClienteAnaliseAlvoSection";
import ClienteRecargaMunicoesSection from "@/components/quero-armas/portal/ClienteRecargaMunicoesSection";
import ClienteArmasMunicoesSection from "@/components/quero-armas/portal/ClienteArmasMunicoesSection";
import { ClienteProcessosSection } from "@/components/quero-armas/processos/ClienteProcessosSection";
import ContratoBlock from "@/components/quero-armas/portal/ContratoBlock";
import PendenciasGuiadasPopup, { type PendenciaItem } from "@/components/quero-armas/portal/PendenciasGuiadasPopup";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";
import { comparePersonNames } from "@/lib/quero-armas/nameMatch";
import ContratosPosPagamentoCard from "@/components/quero-armas/portal/ContratosPosPagamentoCard";
import QAContratosCockpitV1 from "@/components/quero-armas/portal/QAContratosCockpitV1";
import ChecklistGuiadoBotao from "@/components/quero-armas/portal/ChecklistGuiadoBotao";
import { abrirChecklistGuiado, onAbrirChecklistGuiado } from "@/lib/quero-armas/checklistGuiadoBus";
import { openMinutaContratoQueroArmas } from "@/lib/quero-armas/minutaContratoDownload";
import { baixarProcuracaoCanonica } from "@/lib/quero-armas/procuracaoPdfDownload";
import { PortalFilterProvider, type PortalScope } from "@/components/quero-armas/portal/PortalFilterContext";
import PortalScopeSelector from "@/components/quero-armas/portal/PortalScopeSelector";
import { CockpitZ6MeusProcessos, buildCockpitZ6FromReal } from "@/components/quero-armas/cockpit-z6";
import { Crosshair as CrosshairIcon, LayoutDashboard, Upload } from "lucide-react";
import { ForcePasswordChangeModal } from "@/components/quero-armas/clientes/ForcePasswordChangeModal";
import { ensureClienteFromAuthUser } from "@/lib/quero-armas/ensureClienteFromAuthUser";
import ArmaManualForm from "@/components/quero-armas/arsenal/ArmaManualForm";
import { getQAServiceDisplayName } from "@/lib/quero-armas/serviceDisplay";
import {
  getHubCategoriaMeta,
  getNomeDocumentoDisplay,
  getTipoDocumentoMeta,
  inferEscopoDocumental,
  isTipoDocumentoMonitoravelNoHub,
} from "@/lib/quero-armas/documentosHubCatalogo";
import ClienteHealthBadge from "@/components/quero-armas/clientes/ClienteHealthBadge";
import ClienteResumoKanban from "@/components/quero-armas/clientes/ClienteResumoKanban";
import { calcularPrazosProcessuais, corPrazo } from "@/lib/quero-armas/prazosProcessuais";
import { computeChecklistMetrics, isChecklistCumprido, isChecklistPendente } from "@/lib/quero-armas/checklistMetrics";
import ClienteCadastroProgressivoModal from "@/components/quero-armas/portal/ClienteCadastroProgressivoModal";
import ClienteChecklistCadastralModal from "@/components/quero-armas/portal/ClienteChecklistCadastralModal";
import { CAMPOS_CADASTRO } from "@/lib/quero-armas/cadastroCompleteness";
import { cadastroEstaIncompleto, resumoFaltantesCadastro } from "@/lib/quero-armas/cadastroCompleteness";
import EntradaWizard, { type EntradaWizardRespostas } from "@/components/quero-armas/portal/entrada-wizard/EntradaWizard";
import QAClienteFinanceiroCentral from "@/components/quero-armas/portal/QAClienteFinanceiroCentral";
import ArsenalPremiumGate from "@/components/quero-armas/portal/ArsenalPremiumGate";
import { useArsenalPremium } from "@/hooks/useArsenalPremium";

import DocumentosCategoriaZ6V3Panel from "@/components/quero-armas/portal/DocumentosCategoriaZ6V3Panel";
import DadosExtraidosPanel from "@/components/quero-armas/portal/DadosExtraidosPanel";
import logoColor from "@/assets/logo-color.png";
import ClienteFotoUploadModal from "@/components/quero-armas/clientes/ClienteFotoUploadModal";
import NotificacaoEngineOverlay from "@/components/quero-armas/portal/NotificacaoEngineOverlay";
import { grupoDaPendencia as grupoDaPendenciaHelper, ordemGrupo as ordemGrupoHelper } from "@/lib/quero-armas/pendenciasGrupos";
import { useVarreduraSilenciosaPendencias } from "@/hooks/quero-armas/useVarreduraSilenciosaPendencias";
import {
  QA_SIDEBAR_THEMES,
  getPersonalThemeKey,
  setPersonalThemeKey,
  fetchSidebarThemesFromDb,
  mergeThemes,
  resolveEffectiveTheme,
  type QASidebarTheme,
} from "@/components/quero-armas/portal/sidebarThemes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, UserCog } from "lucide-react";

const CHECKLIST_AUTO_REVIEW_INTERVAL_MS = 10 * 60 * 1000;

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try { const p = new Date(d); return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR"); } catch { return d; }
};
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  try { const p = new Date(d); return isNaN(p.getTime()) ? null : Math.ceil((p.getTime() - Date.now()) / 86400000); } catch { return null; }
};
const docDateFromHub = (doc: any): string | null =>
  getDataEmissaoDocumentoHub(doc) || doc?.created_at || null;
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

function deveForcarTrocaSenha(user: any): boolean {
  if (user?.user_metadata?.password_change_required !== true) return false;
  const providers = new Set<string>();
  const primaryProvider = String(user?.app_metadata?.provider || "").toLowerCase();
  if (primaryProvider) providers.add(primaryProvider);
  if (Array.isArray(user?.identities)) {
    for (const identity of user.identities) {
      const provider = String(identity?.provider || "").toLowerCase();
      if (provider) providers.add(provider);
    }
  }
  // Login social não usa a senha temporária do Arsenal.
  if ((primaryProvider === "google" || primaryProvider === "apple") && !providers.has("email")) return false;
  return true;
}

type PendingSignatureDoc = {
  id: string;
  kind: "contract" | "procuration";
  label: string;
  status: string | null;
  contract_number: string | null;
  venda_id: number | null;
  created_at: string | null;
};

const PROCESSO_PREPOSICOES = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
]);

const formatProcessoNome = (nome: string | null | undefined) => {
  const raw = String(nome || "Serviço").replace(/\s+/g, " ").trim();
  if (!raw) return "Serviço";

  return raw
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) => {
      if (index > 0 && PROCESSO_PREPOSICOES.has(word)) return word;
      return word
        .split("/")
        .map((part) => part ? part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1) : part)
        .join("/");
    })
    .join(" ");
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
  const [authKnown, setAuthKnown] = useState(false);
  const [cliente, setCliente] = useState<any>(null);
  const arsenalPremium = useArsenalPremium(cliente?.id ?? null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [catalogoByServicoId, setCatalogoByServicoId] = useState<Record<number, { service_slug: string; nome: string; ordem_no_pacote: number | null }>>({});
  // Mapa (servico_id:tipo_documento) → ordem do catálogo (qa_servicos_documentos.ordem).
  // Usado para ordenar o PendenciasGuiadasPopup respeitando o "Montar Checklist" do admin.
  const [catalogoDocOrdem, setCatalogoDocOrdem] = useState<Map<string, number>>(new Map());
  // Mapa (servico_id:tipo_documento) → instrucoes/link_emissao/observacoes_cliente do catálogo.
  const [catalogoDocInfo, setCatalogoDocInfo] = useState<Map<string, { instrucoes: string | null; link_emissao: string | null; observacoes_cliente: string | null }>>(new Map());
  // Fallback global por tipo_documento: usado quando o servico atual não tem
  // instrucoes/link_emissao populados, mas algum outro serviço já cadastrou
  // no catálogo. Garante que o cliente sempre veja o passo-a-passo com URLs.
  const [catalogoDocInfoByTipo, setCatalogoDocInfoByTipo] = useState<Map<string, { instrucoes: string | null; link_emissao: string | null; observacoes_cliente: string | null }>>(new Map());
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [examesCliente, setExamesCliente] = useState<any[]>([]);
  const [userName, setUserName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [meusDocs, setMeusDocs] = useState<any[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docsSubview, setDocsSubview] = useState<"lista" | "extraidos">("lista");
  const [editDocTipo, setEditDocTipo] = useState<string | undefined>(undefined);
  // Se o cliente clicou em "Renovar" em um documento existente, guardamos o
  // id para que o Hub Documental salve o novo como substituição (marca o
  // antigo como `substituido`).
  const [substituirDocId, setSubstituirDocId] = useState<string | null>(null);
  const [showArmaManual, setShowArmaManual] = useState(false);
  // BLOCO 12 — guarda o destino de navegação pendente enquanto o cliente
  // (que respondeu "sim possuo arma" no wizard) preenche o cadastro mínimo.
  const [pendingTrilhaDestino, setPendingTrilhaDestino] = useState<string | null>(null);
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [pinnedPendenciaId, setPinnedPendenciaId] = useState<string | null>(null);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [pendingContracts, setPendingContracts] = useState<number>(0);
  const [pendingContractsLoaded, setPendingContractsLoaded] = useState(false);
  const [pendingSignatureDocs, setPendingSignatureDocs] = useState<PendingSignatureDoc[]>([]);
  /** Envio do contrato assinado — reusa `qa-upload-signed-contract`, o mesmo
   *  motor do cockpit de contratos. Não passa pelo Hub documental. */
  const contratoAssinadoInputRef = useRef<HTMLInputElement>(null);
  const contratoAssinadoAlvoRef = useRef<string | null>(null);
  const [enviandoContratoAssinado, setEnviandoContratoAssinado] = useState(false);
  const [uploadingPendingSignature, setUploadingPendingSignature] = useState<PendingSignatureDoc["kind"] | null>(null);
  const pendingContractUploadInputRef = useRef<HTMLInputElement>(null);
  const [showContratoPopup, setShowContratoPopup] = useState(false);
  const [showProcuracaoNextPrompt, setShowProcuracaoNextPrompt] = useState(false);
  const [pendenciasGuiadasDismissed, setPendenciasGuiadasDismissed] = useState(false);
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
    | "armas_municoes"
    | "analise_alvo"
    | "recarga_municoes"
    | "mensagens"
    | "configuracoes"
  >("resumo");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false,
  );
  const [themeCatalog, setThemeCatalog] = useState<QASidebarTheme[]>(QA_SIDEBAR_THEMES);
  const [globalDefaultKey, setGlobalDefaultKey] = useState<string | null>(null);
  const [sidebarTheme, setSidebarTheme] = useState<QASidebarTheme>(
    () => QA_SIDEBAR_THEMES.find((t) => t.key === getPersonalThemeKey()) ?? QA_SIDEBAR_THEMES[0],
  );
  const [railIconColor, setRailIconColor] = useState<string>("#9a9a9a");
  const [avatarDropOpen, setAvatarDropOpen] = useState(false);

  // Carrega temas do banco e cor do rail direito
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ themes: dbThemes, globalDefaultKey: gk }, railRow] = await Promise.all([
        fetchSidebarThemesFromDb(),
        supabase.from("qa_sidebar_temas" as any).select("accent").eq("key", "__rail_icon_color__").maybeSingle(),
      ]);
      if (!alive) return;
      const merged = mergeThemes(QA_SIDEBAR_THEMES, dbThemes);
      setThemeCatalog(merged);
      setGlobalDefaultKey(gk);
      setSidebarTheme(resolveEffectiveTheme(merged, getPersonalThemeKey(), gk));
      const railData = railRow.data as { accent?: string } | null;
      if (railData?.accent) setRailIconColor(railData.accent);
    })();
    const onChange = (e: Event) => {
      const key = (e as CustomEvent).detail?.key as string | undefined;
      setSidebarTheme((prev) =>
        resolveEffectiveTheme(themeCatalog, key ?? getPersonalThemeKey(), globalDefaultKey) ?? prev,
      );
    };
    window.addEventListener("qa:sidebar-theme-change", onChange);
    return () => {
      alive = false;
      window.removeEventListener("qa:sidebar-theme-change", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O fechamento do popup vale só para a tela atual. Ao atualizar a página, o
  // checklist roda de novo e, se ainda houver pendência real, o balão nasce
  // novamente. Isso mantém o ciclo solicitado: silencioso quando está tudo ok,
  // insistente apenas quando existe algo para o cliente resolver.
  useEffect(() => {
    setPendenciasGuiadasDismissed(false);
  }, []);

  /**
   * Porta de entrada única do checklist do processo.
   *
   * Antes de liberar, faz a MESMA verificação da entrada no portal: se o
   * cadastro tem campo obrigatório em branco, abre o checklist cadastral e
   * segura o processual. Vale para o "Rodar checklist", para o clique num
   * serviço e para a abertura automática — nenhum caminho pula o cadastro.
   *
   * A exceção é assinatura pendente: contrato e procuração vêm antes de tudo,
   * porque os dados para elaborá-los já vieram do fechamento da venda.
   */
  /**
   * Envia o PDF assinado do contrato.
   *
   * Espelha o `handleUpload` do QAContratosCockpitV1 — mesma edge function,
   * mesmo FormData. Duplicar aqui é de propósito: o cockpit é um componente de
   * outra tela, e importá-lo só para reaproveitar uma função traria junto todo
   * o estado dele.
   */
  const enviarContratoAssinado = async (file: File) => {
    const contractId = contratoAssinadoAlvoRef.current;
    if (!contractId) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas arquivo PDF — o mesmo que você baixou do assinador.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo maior que 25 MB.");
      return;
    }
    setEnviandoContratoAssinado(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("contract_id", contractId);
      fd.append("file", file);
      fd.append("device_meta", JSON.stringify({
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      }));
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-upload-signed-contract`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: fd,
        },
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      toast.info("Contrato enviado. Validando assinatura agora…", { duration: 5000 });
      await validarContratoAssinadoOuFalhar(contractId);
      toast.success("Contrato recebido com sucesso.", { duration: 5000 });
      setShowContratoPopup(false);
      setShowProcuracaoNextPrompt(true);
      setDocsReloadKey((k) => k + 1);
    } catch (e) {
      console.error("[contrato assinado]", e);
      toast.error((e as Error)?.message || "Falha ao enviar o contrato.");
    } finally {
      setEnviandoContratoAssinado(false);
      contratoAssinadoAlvoRef.current = null;
      if (contratoAssinadoInputRef.current) contratoAssinadoInputRef.current.value = "";
    }
  };

  const abrirPendenciasGuiadas = (opts?: { pinnedId?: string | null; pularGateCadastral?: boolean }) => {
    if (mustChangePassword) return;
    // `pularGateCadastral` existe para o retorno do wizard cadastral: ele acabou
    // de gravar os campos pela edge function, mas o `cliente` em memória ainda é
    // o de antes do save. Reavaliar aqui reabriria o cadastral — que, sem
    // pendências, não renderiza nada. O checklist nunca abria.
    const faltaCadastro =
      !opts?.pularGateCadastral &&
      pendingSignatureCount === 0 &&
      CAMPOS_CADASTRO.some(
        (c) =>
          c.crucial &&
          // Campo de equipe não conta: o cliente não tem como resolvê-lo, e o
          // gate ficaria travado abrindo um wizard sem pergunta nenhuma.
          !c.somenteEquipe &&
          String((cliente as Record<string, unknown>)?.[c.key] ?? "").trim() === "",
      );
    if (faltaCadastro) {
      setShowChecklistCadastral(true);
      return;
    }
    sessionStorage.removeItem("qa:pendencias-dismissed");
    setPendenciasGuiadasDismissed(false);
    if (opts?.pinnedId !== undefined) setPinnedPendenciaId(opts.pinnedId);
    setShowContratoPopup(true);
  };
  const dismissPendenciasGuiadas = () => {
    // Contrato/procuração pendentes são obrigações bloqueantes: o popup não
    // pode ser dispensado até a assinatura ser enviada.
    if (pendingContractsLoaded && pendingSignatureDocs.length > 0) return;
    setPendenciasGuiadasDismissed(true);
    setShowContratoPopup(false);
    setPinnedPendenciaId(null);
  };
  // Em telas < lg (1024px) o sidebar inicia colapsado (mini-rail), mas o
  // usuário pode expandir/recolher usando a mesma seta do desktop.
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
  const effectiveCollapsed = sidebarCollapsed;
  // Em tablet/celular (<lg), quando o menu está recolhido, ele some 100%
  // e fica apenas uma seta colada no canto esquerdo da tela.
  const mobileHidden = sidebarCollapsed && isBelowLg;
  // Lock total do viewport no mobile quando drawer está aberto — evita rolagem
  // do body/html e qualquer “bounce” visual em smartphone.
  useEffect(() => {
    if (!isBelowLg) return;
    if (!mobileHidden) {
      const scrollY = window.scrollY;
      const html = document.documentElement;
      const prev = document.body.style.overflow;
      const prevHtmlOverflow = html.style.overflow;
      const prevBodyPosition = document.body.style.position;
      const prevBodyTop = document.body.style.top;
      const prevBodyWidth = document.body.style.width;
      html.classList.add("qa-mobile-drawer-open");
      html.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        html.classList.remove("qa-mobile-drawer-open");
        html.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prev;
        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.width = prevBodyWidth;
        window.scrollTo(0, scrollY);
      };
    }
  }, [mobileHidden, isBelowLg]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [avatarOficial, setAvatarOficial] = useState<ClienteAvatarOficial | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarReloadKey, setAvatarReloadKey] = useState(0);
  const [showFotoModal, setShowFotoModal] = useState(false);

  const validarContratoAssinadoOuFalhar = async (contractId: string) => {
    const { data, error } = await supabase.functions.invoke("qa-validate-customer-signature", {
      body: { contract_id: contractId },
    });
    if (error) throw new Error(error.message || "Falha ao validar o contrato assinado.");
    const status = String((data as any)?.status || "");
    const outcome = String((data as any)?.outcome || "");
    if (status === "validated" && outcome === "valid") return data;
    if (status === "rejected" || outcome === "invalid") {
      const motivo =
        (data as any)?.message ||
        (data as any)?.reason ||
        "O contrato assinado foi recusado pela validação automática. Baixe o contrato original e envie o PDF assinado correto.";
      throw new Error(motivo);
    }
    throw new Error("Contrato recebido, mas ainda não foi aprovado automaticamente. Aguarde a validação antes de avançar para a procuração.");
  };
  const [processos, setProcessos] = useState<any[]>([]);
  const [processoDocs, setProcessoDocs] = useState<any[]>([]);
  // BLOCO 9 — Assistente de Entrada (wizard inicial do portal).
  const [entradaWizardOpen, setEntradaWizardOpen] = useState(false);
  const [entradaAutoChecked, setEntradaAutoChecked] = useState(false);
  // Reconciliação silenciosa na entrada — roda uma vez por carregamento.
  const reconciliouRef = useRef(false);
  const revisaoChecklistInFlightRef = useRef(false);
  // Checklist cadastral — abre sozinho quando há campo obrigatório em branco.
  // Só depois que o cadastro fecha é que o checklist processual entra: nenhum
  // documento é gerado antes de o cadastro estar completo.
  const [showChecklistCadastral, setShowChecklistCadastral] = useState(false);
  const [reconciliouCadastro, setReconciliouCadastro] = useState(false);
  // Abre no máximo uma vez por carregamento — reabrir em laço derrubava a página.
  const checklistCadastralAbertoRef = useRef(false);
  // Estado controlado do dropdown "Atalhos rápidos" da marca (avatar + Arsenal).
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
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
  const activeTab: "arsenal" | "resumo" | null =
    activeSection === "arsenal"
      ? "arsenal"
      : activeSection === "resumo"
        ? "resumo"
        : null;
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
        setAuthKnown(true);

        // Força troca de senha no primeiro acesso
        if (deveForcarTrocaSenha(user)) {
          setMustChangePassword(true);
        }

        const [{ data: profile }, { data: authLink }, { data: clienteDireto }] = await Promise.all([
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
          supabase
            .from("qa_clientes" as any)
            .select("*")
            .eq("user_id", user.id)
            .eq("excluido", false)
            .maybeSingle(),
        ]);

        if (!profile && !authLink && !clienteDireto) { toast.error("Perfil não encontrado."); navigate("/area-do-cliente/login", { replace: true }); return; }

        let customerLink: any = null;
        if ((authLink as any)?.customer_id) {
          const { data } = await supabase
            .from("customers" as any)
            .select("id, email, cnpj_ou_cpf, razao_social, responsavel")
            .eq("id", (authLink as any).customer_id)
            .maybeSingle();
          customerLink = data;
        }

        let clienteData: any = clienteDireto || null;
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
              .select("servico_id, slug, nome, ordem_no_pacote")
              .in("servico_id", servicoIds)
              .eq("ativo", true);
            const catalogMap: Record<number, { service_slug: string; nome: string; ordem_no_pacote: number | null }> = {};
            ((catalogoData as any[]) ?? []).forEach((c: any) => {
              if (Number.isFinite(Number(c.servico_id)) && !catalogMap[Number(c.servico_id)]) {
                catalogMap[Number(c.servico_id)] = {
                  service_slug: c.slug,
                  nome: c.nome,
                  ordem_no_pacote: c.ordem_no_pacote ?? null,
                };
              }
            });
            setCatalogoByServicoId(catalogMap);
            // Carrega ordem por documento do catálogo para ordenar o popup de exigências
            const { data: servicoDocsData } = await supabase
              .from("qa_servicos_documentos" as any)
              .select("servico_id, tipo_documento, ordem, instrucoes, link_emissao, observacoes_cliente")
              .in("servico_id", servicoIds);
            const docOrdemMap = new Map<string, number>();
            const docInfoMap = new Map<string, { instrucoes: string | null; link_emissao: string | null; observacoes_cliente: string | null }>();
            ((servicoDocsData as any[]) ?? []).forEach((sd: any) => {
              const key = `${sd.servico_id}:${String(sd.tipo_documento || "").toLowerCase()}`;
              const ord = Number(sd.ordem);
              if (Number.isFinite(ord)) docOrdemMap.set(key, ord);
              if (sd.instrucoes || sd.link_emissao || sd.observacoes_cliente) {
                docInfoMap.set(key, {
                  instrucoes: sd.instrucoes ?? null,
                  link_emissao: sd.link_emissao ?? null,
                  observacoes_cliente: sd.observacoes_cliente ?? null,
                });
              }
            });
            setCatalogoDocOrdem(docOrdemMap);
            setCatalogoDocInfo(docInfoMap);
            // Fallback global por tipo: pega instrucoes/link_emissao de QUALQUER
            // servico cadastrado. Roda numa query separada porque muitos servicos
            // do cliente atual têm as colunas vazias, mas o mesmo tipo já foi
            // documentado em outro pacote (ex.: renda_cartao_cnpj no servico 2).
            const { data: globalDocsData } = await supabase
              .from("qa_servicos_documentos" as any)
              .select("tipo_documento, instrucoes, link_emissao, observacoes_cliente")
              .or("instrucoes.not.is.null,link_emissao.not.is.null,observacoes_cliente.not.is.null");
            const byTipoMap = new Map<string, { instrucoes: string | null; link_emissao: string | null; observacoes_cliente: string | null }>();
            ((globalDocsData as any[]) ?? []).forEach((sd: any) => {
              const tipo = String(sd.tipo_documento || "").toLowerCase();
              if (!tipo) return;
              const existing = byTipoMap.get(tipo);
              // Preferimos o registro mais completo (com link_emissao) sobre o parcial.
              const scoreNew = (sd.link_emissao ? 2 : 0) + (sd.instrucoes ? 1 : 0);
              const scoreOld = existing ? ((existing.link_emissao ? 2 : 0) + (existing.instrucoes ? 1 : 0)) : -1;
              if (scoreNew > scoreOld) {
                byTipoMap.set(tipo, {
                  instrucoes: sd.instrucoes ?? null,
                  link_emissao: sd.link_emissao ?? null,
                  observacoes_cliente: sd.observacoes_cliente ?? null,
                });
              }
            });
            setCatalogoDocInfoByTipo(byTipoMap);
          } else {
            setCatalogoByServicoId({});
            setCatalogoDocOrdem(new Map());
            setCatalogoDocInfo(new Map());
            setCatalogoDocInfoByTipo(new Map());
          }
        }
        setItens(itensData);
        setCadastro(Array.isArray(crRes.data) ? (crRes.data[0] ?? null) : crRes.data);
        setCrafs((cfRes.data as any[]) ?? []);
        setGtes((gtRes.data as any[]) ?? []);

        // Filiacoes canônicas (qa_filiacoes) + comprovante_clube_tiro aprovados do hub
        // que ainda não têm entrada em qa_filiacoes (histórico via hub documental).
        const filiacoesCanon = (flRes.data as any[]) ?? [];
        const docFiltersEarly = [
          clienteData.id ? `qa_cliente_id.eq.${clienteData.id}` : "",
          customerLink?.id ? `customer_id.eq.${customerLink.id}` : "",
        ].filter(Boolean).join(",");
        if (docFiltersEarly) {
          const { data: clubeDocs } = await supabase
            .from("qa_documentos_cliente" as any)
            .select("id, orgao_emissor, data_emissao, data_validade, validade_filiacao, status")
            .or(docFiltersEarly)
            .eq("tipo_documento", "comprovante_clube_tiro")
            .neq("status", "excluido")
            .order("data_emissao", { ascending: false });
          const hubFil = ((clubeDocs as any[]) ?? []).map((d: any) => ({
            id: `hub_${d.id}`,
            nome_clube: d.orgao_emissor || "Clube",
            nome_filiacao: d.orgao_emissor || "Clube",
            data_emissao: d.data_emissao,
            validade_filiacao: d.validade_filiacao || d.data_validade,
            status: d.status,
            _fromHub: true,
          }));
          setFiliacoes([...filiacoesCanon, ...hubFil]);
        } else {
          setFiliacoes(filiacoesCanon);
        }

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
          setMeusDocs(((docsData as any[]) ?? []).filter((doc: any) =>
            isTipoDocumentoMonitoravelNoHub(doc?.tipo_documento),
          ));
        }

        // Processos canônicos do cliente (fonte real de progresso/etapa/checklist).
        // Dados históricos mistos: admin criava por id real; o pipeline de
        // contrato validado grava id_legado — buscamos pelas duas chaves.
        const { data: procsData } = await supabase
          .from("qa_processos" as any)
          .select("id, cliente_id, venda_id, servico_id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, prazo_critico_data, prazo_critico_doc_id, primeiro_doc_aprovado_em, respostas_questionario_json")
          .in("cliente_id", Array.from(new Set([clienteIdReal, clienteIdVendas])))
          // Processos órfãos (cancelados/arquivados pela reconciliação porque
          // o admin removeu a venda/contrato) NUNCA devem aparecer ao cliente.
          .not("status", "in", "(cancelado,arquivado)")
          .order("data_criacao", { ascending: false });
        const procsList = (procsData as any[]) ?? [];
        // Enriquece cada processo com metadados do catálogo (ordem_no_pacote,
        // pacote_slug, slug do serviço) e marca aqueles bloqueados por pré-requisito
        // — regra-mãe do fluxo operacional (ex.: CRAF/GT só libera depois da
        // Autorização de Compra ser deferida).
        let procsEnriched = procsList;
        try {
          const servicoIds = Array.from(new Set(procsList.map((p: any) => p.servico_id).filter(Boolean)));
          if (servicoIds.length) {
            const { data: catData } = await supabase
              .from("qa_servicos_catalogo" as any)
              .select("servico_id, slug, ordem_no_pacote, pacote_slug")
              .in("servico_id", servicoIds);
            const catBySid = new Map<number, any>();
            (catData as any[] ?? []).forEach((c) => catBySid.set(Number(c.servico_id), c));
            const slugs = Array.from(new Set((catData as any[] ?? []).map((c) => c.slug).filter(Boolean)));
            let prereqs: any[] = [];
            if (slugs.length) {
              const { data: prereqData } = await supabase
                .from("qa_servicos_prerequisitos" as any)
                .select("servico_slug, prerequisito_slug, tipo, ativo")
                .in("servico_slug", slugs)
                .eq("ativo", true);
              prereqs = (prereqData as any[]) ?? [];
            }
            const concluidoStatuses = new Set(["concluido","deferido","finalizado"]);
            procsEnriched = procsList.map((p: any) => {
              const cat = catBySid.get(Number(p.servico_id));
              const slug = cat?.slug ?? null;
              const ordem = Number(cat?.ordem_no_pacote ?? 9999);
              const pacote = cat?.pacote_slug ?? null;
              // bloqueado se existe algum pré-requisito ativo do meu slug que ainda
              // não está concluído em outro processo do mesmo cliente.
              const meusPrereqs = prereqs.filter((r) => r.servico_slug === slug);
              const bloqueadoPrerequisito = meusPrereqs.some((r) => {
                const outroProc = procsList.find((op: any) => {
                  const oc = catBySid.get(Number(op.servico_id));
                  return oc?.slug === r.prerequisito_slug;
                });
                if (!outroProc) return false; // pré-req não contratado → não bloqueia
                return !concluidoStatuses.has(String(outroProc.status || "").toLowerCase());
              });
              return {
                ...p,
                _ordem_no_pacote: ordem,
                _pacote_slug: pacote,
                _servico_slug: slug,
                _bloqueadoPrerequisito: bloqueadoPrerequisito,
              };
            });
            // Ordena: menor ordem_no_pacote primeiro (Autorização antes de CRAF/GT).
            procsEnriched.sort((a: any, b: any) => (a._ordem_no_pacote ?? 9999) - (b._ordem_no_pacote ?? 9999));
          }
        } catch (e) {
          console.warn("[Portal] falha ao enriquecer processos com catálogo/pré-requisitos:", e);
        }
        setProcessos(procsEnriched);
        if (procsList.length > 0) {
          const procIds = procsList.map((p) => p.id);
          const { data: procDocsData } = await supabase
            .from("qa_processo_documentos" as any)
            .select("id, processo_id, status, obrigatorio, tipo_documento, nome_documento, etapa, ordem, data_emissao, data_validade_efetiva, data_validade, updated_at, regra_validacao, titular_comprovante_nome, endereco_em_nome_de_terceiro, dados_extraidos_json")
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
    // Piloto Real: prefere valor_total_pago_cliente (composição) sobre valor_a_pagar.
    const totalVendas = vendas.reduce((a: number, v: any) => {
      const vt = Number(v?.valor_total_pago_cliente);
      const vp = Number(v?.pagamento_valor_total_parcelado);
      const efetivo = Number.isFinite(vt) && vt > 0
        ? vt
        : (Number.isFinite(vp) && vp > 0 ? vp : Number(v?.valor_a_pagar || 0));
      return a + efetivo;
    }, 0);

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
      const tipoRaw = (d.tipo_documento || "outro").toLowerCase();
      // Evita duplicar o CR já presente em qa_cadastro_cr (validade_cr)
      if (tipoRaw === "cr" && cadastro?.validade_cr) return;
      const validade = getValidadeInfo({
        tipo_documento: tipoRaw,
        data_emissao: docDateFromHub(d),
        data_validade_efetiva: d.data_validade_efetiva,
        data_validade: d.data_validade,
        ano_competencia: d.ano_competencia,
        regra_validacao: d.regra_validacao,
      });
      if (!validade.iso) return;
      const tipoLabel = getNomeDocumentoDisplay(d, tipoRaw.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()));
      const tipoMeta = getTipoDocumentoMeta(tipoRaw);
      const catLabel = getHubCategoriaMeta(tipoMeta?.categoria || "outros").label;
      const armaInfo = d.arma_modelo
        ? ` — ${d.arma_modelo}${d.arma_calibre ? ` ${d.arma_calibre}` : ""}`
        : "";
      expDocs.push({
        label: `${tipoLabel}${armaInfo}`,
        date: validade.iso,
        days: validade.dias,
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
    vendas.forEach((v: any) => {
      const vt = Number(v?.valor_total_pago_cliente);
      const vp = Number(v?.pagamento_valor_total_parcelado);
      const efetivo = Number.isFinite(vt) && vt > 0
        ? vt
        : (Number.isFinite(vp) && vp > 0 ? vp : Number(v?.valor_a_pagar || 0));
      events.push({ date: v.data_cadastro || v.created_at, label: `Serviço contratado — ${formatCurrency(efetivo)}`, icon: CreditCard, color: "hsl(352 60% 30%)" });
    });
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
    { key: "armas_municoes" as const, label: "Arsenal Inteligente", icon: Crosshair, path: "/area-do-cliente/arsenal-inteligente", group: "primary" as const },
    { key: "contratos" as const, label: "Contratos", icon: ScrollText, path: "/area-do-cliente/contratos", group: "primary" as const },
    { key: "documentos" as const, label: "Documentos", icon: Files, path: "/area-do-cliente/documentos", group: "primary" as const },
    { key: "processos" as const, label: "Meus Processos", icon: FolderKanban, path: "/area-do-cliente/processos", group: "primary" as const },
    { key: "pendencias" as const, label: "Pendências", icon: BellDot, path: "/area-do-cliente/pendencias", group: "primary" as const },
    { key: "analise_alvo" as const, label: "Análise de Alvo", icon: Target, path: "/area-do-cliente/analise-de-alvo", group: "primary" as const },
    { key: "recarga_municoes" as const, label: "Recarga de Munições", icon: PackageOpen, path: "/area-do-cliente/recarga-de-municoes", group: "primary" as const },
    { key: "financeiro" as const, label: "Financeiro", icon: CreditCard, path: "/area-do-cliente/financeiro", group: "primary" as const },
    { key: "mensagens" as const, label: "Suporte", icon: Headphones, path: "/area-do-cliente/mensagens", group: "primary" as const },
    { key: "configuracoes" as const, label: "Configurações", icon: SlidersHorizontal, path: "/area-do-cliente/configuracoes", group: "primary" as const },
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

  const processosComNomeDisplay = useMemo(() => (
    processos.map((p: any) => ({
      ...p,
      servico_nome: getQAServiceDisplayName({
        ...catalogoByServicoId[Number(p.servico_id)],
        servico_id: p.servico_id,
        servico_nome: p.servico_nome || SERVICO_MAP[p.servico_id],
      }) || p.servico_nome || "Processo",
    }))
  ), [processos, catalogoByServicoId, SERVICO_MAP]);

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
    // No mobile (< lg), fecha o menu automaticamente após escolher uma opção
    if (isBelowLg) {
      setSidebarCollapsed(true);
    }
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

  const activePendingSignature = pendingSignatureDocs[0] ?? null;
  const pendingSignatureCount = pendingSignatureDocs.length;
  const nextPendingProcuracao = pendingSignatureDocs.find((doc) => doc.kind === "procuration") ?? null;

  const abrirProcuracaoDepoisDoContrato = () => {
    setShowProcuracaoNextPrompt(false);
    if (nextPendingProcuracao) {
      abrirPendenciasGuiadas({ pinnedId: `sig:procuration:${nextPendingProcuracao.id}`, pularGateCadastral: true });
      return;
    }
    setDocsReloadKey((k) => k + 1);
    toast.info("Estamos preparando a procuração. Tente novamente em alguns segundos.", { duration: 5000 });
  };

  const pendingProcuracaoPublicUrl = activePendingSignature?.kind === "procuration"
      ? `https://www.euqueroarmas.com.br/area-do-cliente/procuracoes/${activePendingSignature.id}`
    : null;

  const openPendingSignatureLink = async (signature: PendingSignatureDoc | null = activePendingSignature) => {
    if (!signature) {
      goContractsSection();
      return;
    }

    if (signature.kind === "contract") {
      const toastId = toast.loading("Preparando contrato correto…");
      try {
        await openMinutaContratoQueroArmas({
          contractId: signature.id,
          contractNumber: signature.contract_number,
          vendaId: signature.venda_id,
          variant: "company_signed",
        });
        toast.success("Download iniciado.", { id: toastId });
      } catch (e) {
        console.warn("[openPendingSignatureLink] contrato:", e);
        toast.error(e instanceof Error ? e.message : "Não foi possível baixar o contrato.", { id: toastId });
        goContractsSection();
      }
      return;
    }

    // Procuração baixa DIRETO, como o contrato (usuário, 01/08/2026).
    //
    // Antes abria a página pública numa aba nova, e o cliente tinha que achar
    // o botão "Baixar procuração (PDF)" lá dentro — um passo a mais para
    // fazer exatamente a mesma coisa que o contrato faz com um clique.
    //
    // O arquivo vem da `qa-serve-procuracao-pdf`: PDF canônico, com carimbo
    // de servidor e golden record. Se o servidor falhar, aí sim caímos na
    // página pública, que ainda tem o caminho antigo como último recurso.
    const toastId = toast.loading("Preparando procuração…");
    try {
      const nomeCliente = cliente?.nome_completo ? ` - ${cliente.nome_completo}` : "";
      const nome = `${signature.venda_id ? `VENDA ${signature.venda_id}` : "PROCURACAO"} - Procuração Quero Armas${nomeCliente}.pdf`;
      await baixarProcuracaoCanonica(signature.id, nome);
      toast.success("Download iniciado.", { id: toastId });
    } catch (e) {
      console.warn("[openPendingSignatureLink] procuração:", e);
      toast.error(
        e instanceof Error ? e.message : "Não foi possível baixar a procuração.",
        { id: toastId },
      );
      const url = pendingProcuracaoPublicUrl ?? `https://www.euqueroarmas.com.br/area-do-cliente/procuracoes/${signature.id}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const uploadSignedPendingSignatureFromPopup = async (file: File) => {
    if (!activePendingSignature) {
      toast.error("Assinatura pendente não encontrada. Abra a aba Contratos e tente novamente.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas o documento assinado em PDF.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo maior que 25 MB.");
      return;
    }

    setUploadingPendingSignature(activePendingSignature.kind);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append(activePendingSignature.kind === "contract" ? "contract_id" : "procuracao_id", activePendingSignature.id);
      fd.append("file", file);
      fd.append("device_meta", JSON.stringify({
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      }));

      const endpoint = activePendingSignature.kind === "contract"
        ? "qa-upload-signed-contract"
        : "qa-upload-signed-procuracao";
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 409 && String(data.error || "").includes("validated")) {
          toast.info("Este contrato já foi validado. Preparando a próxima etapa…", { duration: 5000 });
          setShowContratoPopup(false);
          setShowProcuracaoNextPrompt(true);
          setDocsReloadKey((k) => k + 1);
          return;
        }
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      if (activePendingSignature.kind === "contract") {
        toast.info("Contrato enviado. Validando assinatura agora…", { duration: 5000 });
        await validarContratoAssinadoOuFalhar(activePendingSignature.id);
        toast.success("Contrato recebido com sucesso.", { duration: 5000 });
        setShowContratoPopup(false);
        setShowProcuracaoNextPrompt(true);
      } else {
        toast.success("Procuração assinada enviada. Validação em andamento.");
        setShowContratoPopup(false);
      }
      if (activePendingSignature.kind === "contract") {
        setPendingContracts((n) => Math.max(0, n - 1));
      }
      setPendingSignatureDocs((docs) => docs.filter((doc) => doc.id !== activePendingSignature.id));
      setDocsReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar documento assinado.");
    } finally {
      setUploadingPendingSignature(null);
      if (pendingContractUploadInputRef.current) pendingContractUploadInputRef.current.value = "";
    }
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

  // ==========================================================================
  // Fase 1 — Unificação do popup: monta a lista de pendências (assinaturas +
  // exigências documentais) para o PendenciasGuiadasPopup. O botão "Entregar"
  // abre o Hub Documental focado no tipo correto. O wizard antigo (Assistente
  // Guiado) continua disponível pelo Speed Dial e pelo bus.
  // ==========================================================================
  const pendenciasGuiadas = useMemo<PendenciaItem[]>(() => {
    const items: PendenciaItem[] = [];

    // 1) Assinaturas pendentes primeiro (mantém prioridade atual do portal).
    for (const sig of pendingSignatureDocs) {
      const kindTipo = sig.kind === "contract" ? "contract" : "procuration";
      items.push({
        id: `sig:${sig.kind}:${sig.id}`,
        kind: "signature",
        label: sig.kind === "contract" ? "Contrato de adesão" : "Procuração",
        tipo: kindTipo,
        contexto: sig.contract_number ? `Protocolo ${sig.contract_number}` : null,
        onPrimary: () => openPendingSignatureLink(sig),
        onEntregar: () => {
          if (sig.kind === "contract") {
            // ANTES: openPendingSignatureLink(), que reabria a página de
            // DOWNLOAD do contrato. O cliente clicava em "Enviar contrato
            // assinado" e o sistema devolvia o contrato em branco para baixar
            // de novo — não havia por onde entregar.
            //
            // Contrato assinado NÃO vai para o Hub: ele é validado e guardado
            // em Contratos, pela edge function `qa-upload-signed-contract`,
            // que é a mesma que o cockpit de contratos já usa.
            contratoAssinadoAlvoRef.current = sig.id;
            contratoAssinadoInputRef.current?.click();
            return;
          }
          setEditDocTipo("procuracao_assinada");
          setShowAddDoc(true);
          setShowContratoPopup(false);
        },
      });
    }

    // 2) Exigências documentais do checklist (obrigatórias) — reprovadas
    // primeiro, pendentes depois. Deduplica por hub_tipo para não repetir o
    // mesmo tipo em processos diferentes.
    // Respeita a ordem configurada em "Serviços":
    //   (a) ordem_no_pacote do serviço (ex.: Autorização antes de CRAF+GT)
    //   (b) data_criacao do processo (fallback quando pacote não define ordem)
    //   (c) doc.ordem / doc.etapa dentro do processo
    const procById = new Map<string, any>(
      (processos || []).map((p: any) => [String(p.id), p]),
    );
    const rankProcesso = (pid: string): [number, number] => {
      const p = procById.get(String(pid));
      const servicoOrdem = Number(
        catalogoByServicoId[Number(p?.servico_id)]?.ordem_no_pacote,
      );
      const ordemNorm = Number.isFinite(servicoOrdem) ? servicoOrdem : 9_999;
      const criacao = p?.data_criacao ? new Date(p.data_criacao).getTime() : Number.MAX_SAFE_INTEGER;
      return [ordemNorm, criacao];
    };
    const rankDoc = (d: any): number => {
      // Prefere a ordem atual do catálogo (qa_servicos_documentos) sobre o snapshot do processo.
      // Assim mudanças em "Montar Checklist" refletem imediatamente no popup.
      const p = procById.get(String(d?.processo_id));
      const servicoId = p?.servico_id;
      const rawTipoDoc = String(d?.tipo_documento || "").toLowerCase();
      if (servicoId != null) {
        const catalogOrd = catalogoDocOrdem.get(`${servicoId}:${rawTipoDoc}`);
        if (catalogOrd !== undefined) return catalogOrd;
      }
      const ord = Number(d?.ordem);
      if (Number.isFinite(ord)) return ord;
      const et = Number(d?.etapa);
      return Number.isFinite(et) ? et * 100 : 9_999;
    };
    const ordenar = (arr: any[]) =>
      [...arr].sort((a, b) => {
        const [ao, ac] = rankProcesso(a.processo_id);
        const [bo, bc] = rankProcesso(b.processo_id);
        if (ao !== bo) return ao - bo;
        if (ac !== bc) return ac - bc;
        return rankDoc(a) - rankDoc(b);
      });
    const jaAdicionados = new Set<string>();
    const empurrar = (doc: any) => {
      const rawTipo = String(doc?.tipo_documento || "").toLowerCase();
      const hubTipo = toHubTipoCompartilhado(rawTipo);
      // Dedup por (processo, rawTipo). O hubTipo NÃO pode ser a chave: várias
      // exigências distintas (ex.: 8 certidões criminais) mapeiam para o mesmo
      // hubTipo/`outro` e desapareciam da fila. Cada exigência do checklist
      // vira um passo próprio no popup.
      const dedupKey = `${doc?.processo_id ?? "_"}::${rawTipo}`;
      if (jaAdicionados.has(dedupKey)) return;
      jaAdicionados.add(dedupKey);
      const nomeFallback = doc?.nome_documento
        ? String(doc.nome_documento)
        : rawTipo.replace(/_/g, " ").toUpperCase();
      const p = procById.get(String(doc?.processo_id));
      const servicoLabel = p
        ? (getQAServiceDisplayName({
            ...catalogoByServicoId[Number(p.servico_id)],
            servico_id: p.servico_id,
            servico_nome: p.servico_nome,
          }) || p.servico_nome || null)
        : null;
      const catKey = p?.servico_id != null ? `${p.servico_id}:${rawTipo}` : null;
      const catInfo = catKey ? catalogoDocInfo.get(catKey) : undefined;
      // Fallback global por tipo_documento (mesmo tipo em outro serviço).
      const catInfoFallback = !catInfo || (!catInfo.instrucoes && !catInfo.link_emissao)
        ? catalogoDocInfoByTipo.get(rawTipo)
        : undefined;
      const catFinal = catInfo && (catInfo.instrucoes || catInfo.link_emissao) ? catInfo : catInfoFallback;
      items.push({
        id: `doc:${doc.id}`,
        kind: "documento",
        servicoId: p?.servico_id ?? null,
        servicoLabel,
        // @ts-expect-error usado apenas para ordenação por processo
        __processoId: doc.processo_id ?? null,
        label: nomeFallback,
        tipo: hubTipo,
        rawTipo,
        fallbackNome: nomeFallback,
        contexto: "Exigência do processo",
        instrucoesCatalogo: catFinal?.instrucoes ?? null,
        linkEmissao: catFinal?.link_emissao ?? null,
        observacoesCatalogo: catFinal?.observacoes_cliente ?? null,
        onPrimary: () => {},
        onEntregar: () => {
          setEditDocTipo(hubTipo);
          setShowAddDoc(true);
          setShowContratoPopup(false);
        },
      });
    };

    // ─── Gating "comprovante em nome de terceiro" ───
    // Regra: NÃO pedir documento do titular / declaração / questionário do
    // titular antes de o cliente confirmar que o comprovante NÃO está em seu
    // nome. Enquanto a pergunta-pivot `comprovante_em_nome_titular` estiver
    // sem resposta OU respondida como "sim", esses itens ficam ocultos.
    const respostaTitularPorProcesso = new Map<string, string | null>();
    for (const p of processos || []) {
      const respostas = (p?.respostas_questionario_json as Record<string, string> | null) ?? {};
      respostaTitularPorProcesso.set(String(p.id), respostas["comprovante_em_nome_titular"] ?? null);
    }
    const ehDocDeTitularTerceiro = (rawTipo: string) => {
      const t = rawTipo.toLowerCase();
      return (
        t === "documento_identificacao_terceiro" ||
        t.startsWith("declaracao_titular") ||
        t.startsWith("titular_comprovante") ||
        t === "declaracao_residencia_titular"
      );
    };
    const bloquearPorTitular = (d: any) => {
      const rawTipo = String(d?.tipo_documento || "").toLowerCase();
      if (!ehDocDeTitularTerceiro(rawTipo)) return false;
      const resp = respostaTitularPorProcesso.get(String(d?.processo_id));
      // Sem resposta ou respondeu "sim" (está no meu nome) → esconder.
      return !resp || String(resp).toLowerCase() === "sim";
    };

    const reprovados = ordenar(
      processoDocs.filter((d) => {
        if (!d?.obrigatorio) return false;
        // Perguntas-pivot têm ciclo próprio (Sim/Não) e são tratadas no bloco
        // dedicado abaixo — não entram na fila de "reprovados/pendentes" comuns.
        const rv = (d as any)?.regra_validacao;
        if (rv && typeof rv === "object" && rv.tipo === "pergunta") return false;
        if (bloquearPorTitular(d)) return false;
        const st = String(d.status || "").toLowerCase();
        return ["invalido", "reprovado", "divergente", "rejeitado", "pendente_reenvio"].includes(st);
      }),
    );
    const pendentes = ordenar(
      processoDocs.filter((d) => {
        if (!d?.obrigatorio) return false;
        const rv = (d as any)?.regra_validacao;
        if (rv && typeof rv === "object" && rv.tipo === "pergunta") return false;
        if (bloquearPorTitular(d)) return false;
        return isChecklistPendente(d.status);
      }),
    );

    // ─── Perguntas-pivot: respondidas INLINE no popup (Sim/Não) ───
    // Regra: quem "emite" as declarações é o sistema — o cliente só responde
    // a pergunta, o backend registra em qa_processos.respostas_questionario_json
    // e libera / oculta os itens dependentes automaticamente.
    const respondidas = (processo: any) =>
      (processo?.respostas_questionario_json as Record<string, string> | null) ?? {};
    const perguntasPendentes = ordenar(
      processoDocs.filter((d) => {
        if (!d?.obrigatorio) return false;
        const rv = (d as any)?.regra_validacao;
        if (!rv || typeof rv !== "object" || rv.tipo !== "pergunta") return false;
        const p = procById.get(String(d.processo_id));
        const chave = String(rv.chave || "");
        const jaRespondida = chave && !!respondidas(p)[chave];
        return !jaRespondida;
      }),
    );
    // Perguntas-pivot vêm ANTES das exigências documentais para gatilhar o
    // fluxo correto (ex.: confirmar titular do comprovante antes de pedir
    // documento de terceiro).
    for (const doc of perguntasPendentes) {
      const rv = (doc as any).regra_validacao as any;
      const chave = String(rv?.chave || "");
      const opcoes = Array.isArray(rv?.opcoes) ? rv.opcoes : [];
      if (!chave || opcoes.length === 0) continue;
      const rawTipo = String(doc.tipo_documento || "").toLowerCase();
      const nomeFallback = doc.nome_documento
        ? String(doc.nome_documento)
        : rawTipo.replace(/_/g, " ").toUpperCase();
      const pProc = procById.get(String(doc.processo_id));
      const servicoLabel = pProc
        ? (getQAServiceDisplayName({
            ...catalogoByServicoId[Number(pProc.servico_id)],
            servico_id: pProc.servico_id,
            servico_nome: pProc.servico_nome,
          }) || pProc.servico_nome || null)
        : null;
      items.push({
        id: `pergunta:${doc.id}`,
        kind: "pergunta",
        servicoId: pProc?.servico_id ?? null,
        servicoLabel,
        // @ts-expect-error usado apenas para ordenação por processo
        __processoId: doc.processo_id ?? null,
        label: nomeFallback,
        tipo: rawTipo,
        rawTipo,
        fallbackNome: nomeFallback,
        contexto: "Pergunta rápida",
        perguntaChave: chave,
        perguntaOpcoes: opcoes.map((op: any) => ({ valor: String(op.valor), label: op.label ? String(op.label) : undefined })),
        respostaAtual: null,
        perguntaAjudaPos:
          "Assim que você responder, o sistema atualiza o checklist automaticamente. Nós geramos as declarações necessárias — você não precisa inventar nenhum documento.",
        // Só nas perguntas sobre o imóvel: mostra QUAL endereço está sendo
        // questionado, senão a pergunta não tem resposta possível.
        detalheContexto:
          /imovel|residencia|endereco|comprovante_em_nome/.test(chave) && enderecoCadastroLegivel
            ? `Endereço no seu cadastro: ${enderecoCadastroLegivel}`
            : null,
        onPrimary: () => {},
        onEntregar: () => {},
        onResponder: async (valor: string) => {
          try {
            const { data: sess } = await supabase.auth.getSession();
            if (!sess?.session) {
              toast.error("Sessão expirada. Faça login novamente.");
              return;
            }
            const { data, error } = await supabase.functions.invoke(
              "qa-processo-responder-pergunta",
              {
                body: {
                  processo_id: doc.processo_id,
                  documento_id: doc.id,
                  chave,
                  valor,
                },
              },
            );
            if (error || (data as any)?.error) {
              toast.error("Não foi possível registrar a resposta. Tente novamente.");
              return;
            }
            toast.success("Resposta registrada. Próximo passo liberado.");
            setDocsReloadKey((k) => k + 1);
          } catch (e) {
            console.error("[portal] responder-pergunta:", e);
            toast.error("Erro ao registrar resposta.");
          }
        },
      });
    }

    // ─── Mini-questionário do titular (só quando comprovante NÃO está no
    // nome do requerente). Roda antes de pedir o documento do titular. ───
    // Usa o mesmo docId da pergunta-pivot como âncora (o responder aceita
    // gravar chaves extras em respostas_questionario_json).
    const perguntasTitularPivotPorProcesso = new Map<string, any>();
    for (const d of processoDocs || []) {
      const rv = (d as any)?.regra_validacao;
      if (rv && typeof rv === "object" && rv.tipo === "pergunta" && String(rv.chave || "") === "comprovante_em_nome_titular") {
        perguntasTitularPivotPorProcesso.set(String(d.processo_id), d);
      }
    }
    const OPCOES_ESTADO_CIVIL = [
      { valor: "solteiro", label: "Solteiro(a)" },
      { valor: "casado", label: "Casado(a)" },
      { valor: "uniao_estavel", label: "União estável" },
      { valor: "divorciado", label: "Divorciado(a)" },
      { valor: "viuvo", label: "Viúvo(a)" },
    ];
    const OPCOES_PROFISSAO = [
      { valor: "clt", label: "CLT (assalariado)" },
      { valor: "servidor_publico", label: "Servidor público" },
      { valor: "autonomo_mei", label: "Autônomo / MEI" },
      { valor: "empresario", label: "Empresário / sócio" },
      { valor: "aposentado", label: "Aposentado(a) / pensionista" },
      { valor: "do_lar", label: "Do lar / sem renda formal" },
      { valor: "outra", label: "Outra" },
    ];
    for (const [pid, pivot] of perguntasTitularPivotPorProcesso.entries()) {
      const p = procById.get(pid);
      const respostas = respondidas(p);
      const respostaTitular = String(respostas["comprovante_em_nome_titular"] || "").toLowerCase();
      if (respostaTitular !== "nao") continue;
      const servicoLabelTit = p
        ? (getQAServiceDisplayName({
            ...catalogoByServicoId[Number(p.servico_id)],
            servico_id: p.servico_id,
            servico_nome: p.servico_nome,
          }) || p.servico_nome || null)
        : null;
      const jaEstadoCivil = respostas["titular_comprovante_estado_civil"];
      const jaProfissao = respostas["titular_comprovante_profissao"];
      const pushSintetica = (opts: {
        chave: string;
        rawTipoLabel: string;
        opcoes: { valor: string; label: string }[];
        label: string;
      }) => {
        items.push({
          id: `pergunta-sintetica:${opts.chave}:${pivot.id}`,
          kind: "pergunta",
          servicoId: p?.servico_id ?? null,
          servicoLabel: servicoLabelTit,
          // @ts-expect-error usado apenas para ordenação por processo
          __processoId: pivot.processo_id ?? null,
          label: opts.label,
          tipo: opts.rawTipoLabel,
          rawTipo: opts.rawTipoLabel,
          fallbackNome: opts.label,
          contexto: "Sobre o titular",
          perguntaChave: opts.chave,
          perguntaOpcoes: opts.opcoes,
          respostaAtual: null,
          perguntaAjudaPos:
            "Usamos essa informação para gerar a declaração de residência que o titular assina — você não precisa redigir nada.",
          onPrimary: () => {},
          onEntregar: () => {},
          onResponder: async (valor: string) => {
            try {
              const { data: sess } = await supabase.auth.getSession();
              if (!sess?.session) {
                toast.error("Sessão expirada. Faça login novamente.");
                return;
              }
              const { data, error } = await supabase.functions.invoke(
                "qa-processo-responder-pergunta",
                {
                  body: {
                    processo_id: pivot.processo_id,
                    documento_id: pivot.id,
                    chave: opts.chave,
                    valor,
                  },
                },
              );
              if (error || (data as any)?.error) {
                toast.error("Não foi possível registrar a resposta. Tente novamente.");
                return;
              }
              toast.success("Resposta registrada.");
              setDocsReloadKey((k) => k + 1);
            } catch (e) {
              console.error("[portal] responder-pergunta sintetica:", e);
              toast.error("Erro ao registrar resposta.");
            }
          },
        });
      };
      if (!jaEstadoCivil) {
        pushSintetica({
          chave: "titular_comprovante_estado_civil",
          rawTipoLabel: "pergunta_titular_estado_civil",
          opcoes: OPCOES_ESTADO_CIVIL,
          label: "Estado civil do titular",
        });
      }
      if (!jaProfissao) {
        pushSintetica({
          chave: "titular_comprovante_profissao",
          rawTipoLabel: "pergunta_titular_profissao",
          opcoes: OPCOES_PROFISSAO,
          label: "Profissão do titular",
        });
      }
    }

    // Depois das perguntas vêm as exigências documentais (reprovados primeiro).
    for (const d of reprovados) empurrar(d);
    for (const d of pendentes) empurrar(d);

    // ─── Ordenar por GRUPO temático ────────────────────────────────────────
    // Anexa grupoId/grupoLabel a cada item e reordena mantendo a ordem
    // relativa original dentro de cada grupo (stable sort). Assinaturas e
    // perguntas mantêm prioridade natural via `ordem` do grupo.
    // Ordenação final:
    //   1) Assinaturas primeiro (sem serviço).
    //   2) Depois, agrupado POR SERVIÇO CONTRATADO (ordem_no_pacote →
    //      data_criacao), para o cliente resolver um serviço por vez.
    //   3) Dentro do serviço, perguntas-pivot antes das exigências.
    //   4) Dentro disso, GRUPO temático (identificação → endereço →
    //      antecedentes → ocupação → habitualidade → saúde → arma →
    //      declarações → outros).
    //   5) Estável no idx original como desempate.
    const decorados = items.map((it, idx) => {
      const g = it.kind === "signature"
        ? { id: "assinaturas" as const, label: "Assinaturas", ordem: 10 }
        : it.kind === "pergunta"
          ? { id: "perguntas" as const, label: "Perguntas rápidas", ordem: 20 }
          : grupoDaPendenciaHelper(it.rawTipo, it.tipo);
      const tier = it.kind === "signature" ? 0 : 1;
      const [servicoOrdem, servicoCriacao] =
        it.kind === "signature"
          ? [-1, -1]
          : rankProcesso(String((it as any).__processoId || ""));
      return {
        it: { ...it, grupoId: g.id, grupoLabel: g.label },
        tier,
        servicoOrdem,
        servicoCriacao,
        grupoOrdem: (g as any).ordem ?? ordemGrupoHelper(g.id),
        subTier: it.kind === "pergunta" ? 0 : 1,
        idx,
      };
    });
    decorados.sort((a, b) =>
      (a.tier - b.tier) ||
      (a.servicoOrdem - b.servicoOrdem) ||
      (a.servicoCriacao - b.servicoCriacao) ||
      (a.subTier - b.subTier) ||
      (a.grupoOrdem - b.grupoOrdem) ||
      (a.idx - b.idx),
    );
    // ─── Regra de negócio: liberar UM GRUPO POR VEZ ───────────────────────
    // O próximo grupo temático só entra na fila quando todos os itens do
    // grupo atual (documentos) forem concluídos/aprovados — ou seja, quando
    // não houver mais nenhum item pendente daquele grupo aparecendo aqui.
    // Sempre mantemos assinaturas (tier 0) e perguntas-pivot (subTier 0),
    // pois elas gate/condicionam os documentos seguintes.
    const docs = decorados.filter((d) => d.tier === 1 && d.subTier === 1);
    const firstDoc = docs[0];
    const chaveGrupoAtivo = firstDoc
      ? `${firstDoc.servicoOrdem}|${firstDoc.grupoOrdem}`
      : null;
    const filtrados = decorados.filter((d) => {
      if (d.tier === 0) return true; // assinaturas sempre
      if (d.subTier === 0) return true; // perguntas-pivot sempre
      return chaveGrupoAtivo === `${d.servicoOrdem}|${d.grupoOrdem}`;
    });
    return filtrados.map((d) => d.it);
  }, [pendingSignatureDocs, processoDocs, processos, catalogoByServicoId, catalogoDocOrdem, catalogoDocInfo, catalogoDocInfoByTipo]);

  const pendenciasGuiadasCount = pendenciasGuiadas.length;

  // ── Varredura silenciosa por baixo do portal ───────────────────────────────
  // Só liga quando o cliente logado TEM pendência aberta (assinatura ou
  // exigência de checklist). Nesse caso o portal se atualiza sozinho quando o
  // servidor muda. Cliente sem pendência nunca é atualizado.
  useVarreduraSilenciosaPendencias({
    clienteId: (cliente as any)?.id ?? null,
    processoIds: (processos ?? []).map((p: any) => String(p.id)),
    ativo:
      !loading &&
      pendingContractsLoaded &&
      (pendingSignatureCount > 0 || pendenciasGuiadasCount > 0),
    onMudanca: () => setDocsReloadKey((k) => k + 1),
  });

  /**
   * Números REAIS do processo, contados sobre `processoDocs` e não sobre a
   * fila do popup.
   *
   * A fila mostra só o que está liberado agora — deduplicada, filtrada por
   * titular e por obrigatoriedade. Por isso ela dizia "5 de 5" enquanto o
   * processo ainda tinha laudos, requerimento e perguntas em aberto. Contar
   * aqui é o que permite dizer ao cliente o tamanho do caminho, não só onde
   * ele está.
   */
  /**
   * Endereço do cadastro, formatado para leitura.
   *
   * Serve para as perguntas sobre o imóvel: "Você ainda reside neste imóvel?"
   * é impossível de responder sem dizer QUAL. O cliente não adivinha a que
   * endereço o sistema se refere.
   */
  const enderecoCadastroLegivel = useMemo(() => {
    const c = cliente as any;
    if (!c) return null;
    const linha = [c.endereco, c.numero].filter(Boolean).join(", ");
    const local = [c.bairro, [c.cidade, c.estado].filter(Boolean).join("/")]
      .filter(Boolean)
      .join(" — ");
    const cep = c.cep ? `CEP ${c.cep}` : "";
    const partes = [linha, local, cep].filter((x) => String(x || "").trim());
    return partes.length ? partes.join(" · ") : null;
  }, [cliente]);

  const resumoProcesso = useMemo(() => {
    const obrigatorios = (processoDocs ?? []).filter((d: any) => d?.obrigatorio);
    const ehPergunta = (d: any) => {
      const rv = d?.regra_validacao;
      return !!rv && typeof rv === "object" && rv.tipo === "pergunta";
    };
    const concluido = (d: any) => {
      const st = String(d?.status ?? "").toLowerCase();
      return st === "aprovado"
        || st === "dispensado_grupo"
        || st === "dispensado_por_reaproveitamento";
    };
    const abertos = obrigatorios.filter((d: any) => !concluido(d));

    // ── Grupos do PROCESSO INTEIRO, não só da fila liberada ───────────────
    //
    // O popup só recebia a fila do momento, então dizia "Passo 1 de 6" sem o
    // cliente saber quantas frentes ainda existem. Aqui os grupos são
    // calculados sobre TODAS as exigências obrigatórias do processo — as
    // liberadas e as que ainda vão abrir.
    //
    // A ordem é a mesma da fila (`ordem` de pendenciasGrupos), para o número
    // do grupo bater com a sequência em que o cliente vai encontrá-los.
    const mapaGrupos = new Map<string, { label: string; ordem: number; total: number; concluidos: number }>();
    for (const d of obrigatorios) {
      const g = grupoDaPendenciaHelper(
        String(d?.tipo_documento || ""),
        toHubTipoCompartilhado(String(d?.tipo_documento || "")),
      );
      const cur = mapaGrupos.get(g.id) ?? { label: g.label, ordem: g.ordem, total: 0, concluidos: 0 };
      cur.total += 1;
      if (concluido(d)) cur.concluidos += 1;
      mapaGrupos.set(g.id, cur);
    }
    const grupos = [...mapaGrupos.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.ordem - b.ordem);

    return {
      documentosPendentes: abertos.filter((d: any) => !ehPergunta(d)).length,
      perguntasPendentes: abertos.filter(ehPergunta).length,
      totalObrigatorios: obrigatorios.length,
      concluidos: obrigatorios.length - abertos.length,
      grupos,
    };
  }, [processoDocs]);

  // ==========================================================================
  // Auto-resposta de perguntas-pivot com base em dados já extraídos pela IA.
  // ---------------------------------------------------------------------------
  // Regra do usuário: "não faça a pergunta se o comprovante já foi enviado e
  // dá pra cruzar com o cadastro do cliente". Quando existe um comprovante
  // de residência com `titular_comprovante_nome` extraído (ou o boolean
  // `endereco_em_nome_de_terceiro`), comparamos com `cliente.nome_completo`
  // e respondemos automaticamente via `qa-processo-responder-pergunta`,
  // sem incomodar o cliente. Só perguntamos quando não há sinal ou o match
  // é ambíguo (`"unknown"`).
  // ==========================================================================
  const autoRespondidasRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!cliente?.nome_completo || !processoDocs?.length) return;
    const nomeCliente = String(cliente.nome_completo);

    const perguntasTitular = processoDocs.filter((d: any) => {
      const rv = d?.regra_validacao;
      if (!rv || typeof rv !== "object" || rv.tipo !== "pergunta") return false;
      if (String(rv.chave || "") !== "comprovante_em_nome_titular") return false;
      const p = (processos || []).find((x: any) => String(x.id) === String(d.processo_id));
      const resp = (p?.respostas_questionario_json ?? {}) as Record<string, string>;
      if (resp["comprovante_em_nome_titular"]) return false;
      return !autoRespondidasRef.current.has(String(d.id));
    });
    if (perguntasTitular.length === 0) return;

    const comprovantesPorProcesso = new Map<string, any>();
    for (const d of processoDocs as any[]) {
      const tipo = String(d?.tipo_documento || "").toLowerCase();
      if (!tipo.startsWith("comprovante_endereco") && tipo !== "comprovante_residencia") continue;
      const nomeExtraido =
        d?.titular_comprovante_nome ||
        (d?.dados_extraidos_json && (d.dados_extraidos_json.nome_titular || d.dados_extraidos_json.titular_comprovante_nome)) ||
        null;
      const flagTerceiro = d?.endereco_em_nome_de_terceiro;
      if (!nomeExtraido && flagTerceiro == null) continue;
      const atual = comprovantesPorProcesso.get(String(d.processo_id));
      const atualTs = atual?.updated_at ? new Date(atual.updated_at).getTime() : 0;
      const novoTs = d?.updated_at ? new Date(d.updated_at).getTime() : 0;
      if (!atual || novoTs >= atualTs) comprovantesPorProcesso.set(String(d.processo_id), d);
    }
    if (comprovantesPorProcesso.size === 0) return;

    (async () => {
      for (const pivot of perguntasTitular) {
        const comp = comprovantesPorProcesso.get(String(pivot.processo_id));
        if (!comp) continue;
        const nomeDoc =
          comp.titular_comprovante_nome ||
          comp.dados_extraidos_json?.nome_titular ||
          comp.dados_extraidos_json?.titular_comprovante_nome ||
          null;
        let valor: "sim" | "nao" | null = null;
        if (nomeDoc) {
          const veredito = comparePersonNames(nomeDoc, nomeCliente);
          if (veredito === "match") valor = "sim";
          else if (veredito === "mismatch") valor = "nao";
        } else if (typeof comp.endereco_em_nome_de_terceiro === "boolean") {
          valor = comp.endereco_em_nome_de_terceiro ? "nao" : "sim";
        }
        if (!valor) continue;
        autoRespondidasRef.current.add(String(pivot.id));
        try {
          const { error } = await supabase.functions.invoke("qa-processo-responder-pergunta", {
            body: {
              processo_id: pivot.processo_id,
              documento_id: pivot.id,
              chave: "comprovante_em_nome_titular",
              valor,
            },
          });
          if (error) throw error;
          setDocsReloadKey((k) => k + 1);
        } catch (e) {
          // Silencioso: se falhar, o UI segue exibindo a pergunta para o cliente.
          console.warn("[portal] auto-responder pergunta comprovante:", e);
          autoRespondidasRef.current.delete(String(pivot.id));
        }
      }
    })();
  }, [cliente?.nome_completo, processoDocs, processos]);

  const portalStartupAction = useMemo(() => {
    if (loading || !cliente || !pendingContractsLoaded) return null;

    if (pendingSignatureCount > 0) return { type: "contrato" as const };
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
  }, [cliente, loading, pendingSignatureCount, pendingContractsLoaded, processos, resumoState]);

  // BLOCO 9 — Orquestrador de entrada do portal.
  // Obrigações do cliente sempre aparecem antes do assistente de compra.
  useEffect(() => {
    if (entradaAutoChecked) return;
    if (!portalStartupAction) return;

    const idLegado = (cliente as any)?.id_legado ?? (cliente as any)?.id ?? "anon";
    const key = `qa-portal-startup-${idLegado}-${portalStartupAction.type}`;
    // Cadastro incompleto reabre em todo refresh até ser preenchido — bloqueante.
    // Contrato/procuração: reabre a cada sessão até ser assinado.
    // Checklist pendente/reprovado: reabre em todo refresh se a pendência ainda
    // existir. Se não houver pendência real, portalStartupAction fica null e
    // nada aparece.
    const ignorarTrava =
      portalStartupAction.type === "cadastro" ||
      portalStartupAction.type === "contrato" ||
      portalStartupAction.type === "checklist_pendente" ||
      portalStartupAction.type === "checklist_reprovado";
    if (!ignorarTrava && sessionStorage.getItem(key)) {
      setEntradaAutoChecked(true);
      return;
    }
    if (!ignorarTrava) sessionStorage.setItem(key, "1");
    setEntradaAutoChecked(true);

    if (portalStartupAction.type === "contrato") {
      abrirPendenciasGuiadas();
      return;
    }

    if (portalStartupAction.type === "checklist_reprovado" && resumoState.checklistReproc) {
      abrirPendenciasGuiadas();
      return;
    }

    if (portalStartupAction.type === "checklist_pendente" && resumoState.checklistPend) {
      abrirPendenciasGuiadas();
      return;
    }

    if (portalStartupAction.type === "doc_hub_reprovado") {
      setShowAddDoc(true);
      return;
    }

    if (portalStartupAction.type === "cadastro") {
      // O checklist cadastral (uma pergunta por vez) substitui o modal
      // progressivo na abertura automática — os dois abertos ao mesmo tempo
      // empilhavam popup sobre popup. O modal antigo segue disponível pelo
      // botão "Atualizar agora", para quem prefere o formulário completo.
      return;
    }

    if (portalStartupAction.type === "prazo") {
      return;
    }

    if (portalStartupAction.type === "entrada_wizard") {
      setEntradaWizardOpen(true);
    }
  }, [cliente, entradaAutoChecked, portalStartupAction, resumoState]);

  const revisarChecklistsSilenciosamente = useCallback(async (opts?: { permitirReabrir?: boolean }) => {
    const clienteId = Number((cliente as any)?.id) || null;
    if (!clienteId || revisaoChecklistInFlightRef.current) return;
    revisaoChecklistInFlightRef.current = true;

    try {
      // 1) Cadastro — DESLIGADO de propósito.
      //
      // qa-cliente-auto-prefill escreve cpf e nome_completo, e sua regra
      // sobrescreve valor digitado quando um documento traz outro. Rodá-lo a
      // cada entrada no portal — como eu havia feito — expõe o cadastro a ser
      // reescrito com dado de terceiro: no acervo do cliente há cartão CNPJ da
      // esposa e comprovante de pagamento do filho. Se o CPF for trocado, o
      // login deixa de localizar o cadastro.
      //
      // O prefill continua disponível sob demanda, pelo modal progressivo, onde
      // a pessoa vê e confirma o que será aplicado. Automático, não.
      // 2) Checklist — reavalia exigências contra o Hub Documental.
      try {
        await supabase.rpc("qa_processo_rever_exigencias" as any, { p_cliente_id: clienteId });
      } catch (e) {
        console.warn("[portal] revisão de exigências falhou", e);
      }

      if (opts?.permitirReabrir) {
        const idLegado = (cliente as any)?.id_legado ?? (cliente as any)?.id ?? "anon";
        sessionStorage.removeItem("qa:pendencias-dismissed");
        localStorage.removeItem(`qa-portal-startup-${idLegado}-checklist_pendente-dia`);
        localStorage.removeItem(`qa-portal-startup-${idLegado}-checklist_reprovado-dia`);
        checklistCadastralAbertoRef.current = false;
        setPendenciasGuiadasDismissed(false);
        setEntradaAutoChecked(false);
      }

      // Recarrega a tela com o estado já reconciliado.
      setDocsReloadKey((k) => k + 1);
      setReconciliouCadastro(true);
    } finally {
      revisaoChecklistInFlightRef.current = false;
    }
  }, [cliente]);

  // ── Reconciliação automática na entrada do cliente ────────────────────────
  // Antes, nada rodava ao abrir/atualizar o portal: o cadastro só era
  // completado quando o modal progressivo abria, e as exigências do checklist
  // só eram reavaliadas em pontos específicos. Resultado: documento já enviado
  // e classificado no Hub continuava sendo pedido no checklist.
  //
  // Roda apenas qa_processo_rever_exigencias, que casa os documentos válidos
  // do Hub com os slots pendentes do processo. Só lê documento e escreve em
  // qa_processo_documentos — não encosta no cadastro do cliente.
  //
  // O auto-prefill do cadastro foi retirado daqui: ele reescreve cpf e
  // nome_completo a partir dos documentos, e rodar isso sem supervisão a cada
  // acesso pode trocar a identidade do cadastro por dado de terceiro.
  useEffect(() => {
    const clienteId = Number((cliente as any)?.id) || null;
    if (!clienteId || reconciliouRef.current) return;
    reconciliouRef.current = true;
    void revisarChecklistsSilenciosamente();
  }, [cliente, revisarChecklistsSilenciosamente]);

  // ── Varredura invisível do checklist ─────────────────────────────────────
  // A cada 10 minutos, quando não há fluxo bloqueante na frente, roda o mesmo
  // reconciliador por baixo. Se não sobrar pendência, nada aparece. Se sobrar
  // pendência cadastral ou processual, limpamos só a trava de "já mostrei" para
  // que os modais existentes possam nascer novamente na tela do cliente.
  useEffect(() => {
    if (!cliente?.id) return;
    const timer = window.setInterval(() => {
      if (mustChangePassword) return;
      if (!pendingContractsLoaded) return;
      if (pendingSignatureCount > 0) return;
      if (showContratoPopup || showAddDoc || showCadastroModal || showChecklistCadastral) return;
      void revisarChecklistsSilenciosamente({ permitirReabrir: true });
    }, CHECKLIST_AUTO_REVIEW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [
    cliente?.id,
    mustChangePassword,
    pendingContractsLoaded,
    pendingSignatureCount,
    showContratoPopup,
    showAddDoc,
    showCadastroModal,
    showChecklistCadastral,
    revisarChecklistsSilenciosamente,
  ]);

  // ── Ordem do portal: assinaturas → cadastro → checklist do processo ───────
  // Contrato e procuração aparecem juntos na fila e o cliente resolve um a um.
  // O cadastro só entra depois das duas: os dados para elaborar contrato e
  // procuração já vieram do fechamento da venda, então não há por que travar
  // a assinatura esperando cadastro completo.
  // Fonte única da verdade da 2ª prioridade: cadastro crucial incompleto.
  const cadastroCrucialIncompleto = useMemo(() => {
    if (!cliente) return false;
    return CAMPOS_CADASTRO.some(
      (c) =>
        c.crucial &&
        !c.somenteEquipe &&
        String((cliente as Record<string, unknown>)?.[c.key] ?? "").trim() === "",
    );
  }, [cliente]);

  useEffect(() => {
    if (mustChangePassword) return;
    if (!reconciliouCadastro) return;
    if (!pendingContractsLoaded) return;
    if (pendingSignatureCount > 0) return;   // assinaturas primeiro
    if (showContratoPopup || showAddDoc || showCadastroModal) return;
    if (showChecklistCadastral || checklistCadastralAbertoRef.current) return;
    if (cadastroCrucialIncompleto) {
      checklistCadastralAbertoRef.current = true;
      setShowChecklistCadastral(true);
    }
  }, [mustChangePassword, reconciliouCadastro, pendingContractsLoaded, pendingSignatureCount, showContratoPopup, showAddDoc, showCadastroModal, showChecklistCadastral, cadastroCrucialIncompleto]);

  // Reabre o popup de assinaturas pendentes sempre que ainda houver contrato
  // ou procuração aguardando envio. O usuário pediu explicitamente: "se houver
  // pendências, deve rodar o tempo todo até a pendência ser sanada".
  // Só reabre quando nenhum outro fluxo bloqueante está ativo (Hub Documental,
  // Checklist Guiado, modal de cadastro) e quando o usuário não dispensou o
  // popup na sessão atual (clicou no X ou fora da janela).
  useEffect(() => {
    if (mustChangePassword) return;
    if (!pendingContractsLoaded) return;
    if (pendenciasGuiadasCount <= 0) return;
    if (showContratoPopup) return;
    if (showAddDoc) return;
    if (showCadastroModal) return;
    // Assinatura pendente é obrigação bloqueante: reabre sempre, ignorando
    // qualquer dispensa anterior do cliente.
    if (pendingSignatureCount > 0) {
      sessionStorage.removeItem("qa:pendencias-dismissed");
      setPendenciasGuiadasDismissed(false);
      setShowContratoPopup(true);
      return;
    }
    // Ordem obrigatória: 1) assinaturas (contrato/procuração), 2) cadastro
    // completo, 3) checklist do processo. Sem assinatura pendente, o checklist
    // NUNCA nasce enquanto houver campo crucial do cadastro em branco — mesmo
    // que o modal cadastral ainda não tenha sido aberto ou tenha sido fechado.
    if (showChecklistCadastral || cadastroCrucialIncompleto) return;
    if (pendenciasGuiadasDismissed) return;
    abrirPendenciasGuiadas();
  }, [mustChangePassword, pendenciasGuiadasCount, pendingContractsLoaded, pendingSignatureCount, showContratoPopup, showAddDoc, showCadastroModal, showChecklistCadastral, cadastroCrucialIncompleto, pendenciasGuiadasDismissed]);

  // Handler para o overlay de notificações: ao clicar "Ver detalhes" em
  // "Assinatura de contrato pendente", reabre o popup de assinaturas.
  useEffect(() => {
    const handler = () => {
      if (mustChangePassword) return;
      if (pendenciasGuiadasCount > 0) {
        abrirPendenciasGuiadas();
      } else {
        setActiveSection("documentos");
      }
    };
    window.addEventListener("qa:abrir-assinaturas-pendentes", handler);
    return () => window.removeEventListener("qa:abrir-assinaturas-pendentes", handler);
  }, [mustChangePassword, pendenciasGuiadasCount]);

  // Fase 2 — o wizard antigo (ChecklistGuiadoModal) foi aposentado. Todos os
  // gatilhos (Speed Dial, kanban, botão "Enviar X", auto-open pós assinatura)
  // agora abrem o PendenciasGuiadasPopup unificado. Ao receber um `focusDocId`,
  // marcamos a pendência correspondente (`doc:<id>`) como pinada para o popup
  // saltar direto para ela. Reabrir por ação manual limpa o status de dispensado.
  useEffect(() => {
    const off = onAbrirChecklistGuiado((payload) => {
      const focus = payload?.focusDocId ? `doc:${payload.focusDocId}` : null;
      abrirPendenciasGuiadas({ pinnedId: focus });
    });
    return off;
  }, []);

  // Carrega assinaturas pós-pagamento pendentes: contrato primeiro, procuração depois.
  // A abertura do popup é feita pelo orquestrador de entrada, para não concorrer
  // com o assistente de compra/documentação.
  useEffect(() => {
    const idLegado = (cliente as any)?.id_legado as number | null | undefined;
    if (!idLegado) {
      setPendingContracts(0);
      setPendingSignatureDocs([]);
      setPendingContractsLoaded(true);
      return;
    }
    let alive = true;
    setPendingContractsLoaded(false);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("qa_contracts" as any)
          .select("id, status, contract_number, venda_id, created_at")
          .eq("cliente_id", idLegado)
          .in("status", [
            "generated_pending_company_signature",
            "pending_customer_signature",
            "rejected",
          ])
          .order("created_at", { ascending: false });
        if (!alive) return;
        if (error) {
          setPendingContracts(0);
          setPendingSignatureDocs([]);
          setPendingContractsLoaded(true);
          return;
        }
        const contracts = Array.isArray(data) ? (data as any[]) : [];
        await Promise.all(
          contracts
            .filter((contract) => contract?.venda_id)
            .map((contract) =>
              supabase.functions.invoke("qa-gerar-procuracao", {
                body: {
                  cliente_id: idLegado,
                  venda_id: contract.venda_id,
                  contract_id: contract.id,
                },
              }).catch(() => null),
            ),
        );

        const { data: procuracoes } = await supabase
          .from("qa_procuracoes" as any)
          .select("id, status, venda_id, created_at")
          .eq("cliente_id", idLegado)
          .in("status", [
            "generated_pending_customer_signature",
            "rejected",
          ])
          .order("created_at", { ascending: false });

        // Exigência cumprida não pode ser pedida novamente: se o cliente já
        // enviou o contrato/procuração pelo Hub Documental, o registro fica
        // em qa_documentos_cliente (status pendente_aprovacao ou aprovado),
        // mesmo que qa_contracts/qa_procuracoes ainda não tenham sido
        // sincronizados. Filtramos aqui para não pedir de novo.
        const qaClienteUuid = (cliente as any)?.id as string | undefined;
        let hubContracts: any[] = [];
        let hubProcuracoes: any[] = [];
        if (qaClienteUuid) {
          const { data: hubDocs } = await supabase
            .from("qa_documentos_cliente" as any)
            .select("id, tipo_documento, numero_documento, status, metadados_documento_json, data_emissao, data_validade_efetiva, data_validade")
            .eq("qa_cliente_id", qaClienteUuid)
            .in("tipo_documento", ["contrato_assinado", "procuracao_assinada"])
            .in("status", ["pendente_aprovacao", "aprovado"]);
          const docs = Array.isArray(hubDocs) ? (hubDocs as any[]) : [];
          hubContracts = docs.filter((d) => d.tipo_documento === "contrato_assinado");
          hubProcuracoes = docs.filter((d) => d.tipo_documento === "procuracao_assinada");
        }

        const contractFulfilled = (c: any) => {
          return hubContracts.some((h) => {
            const meta = h.metadados_documento_json ?? {};
            if (meta.contract_id && String(meta.contract_id) === String(c.id)) return true;
            const numero = String(h.numero_documento ?? "").trim().toUpperCase();
            const cnum = String(c.contract_number ?? "").trim().toUpperCase();
            if (numero && cnum && numero === cnum) return true;
            return false;
          });
        };

        const procuracoesArr = ((procuracoes ?? []) as any[]);
        // Reaproveitamento: procuração aprovada e VIGENTE no Hub cobre
        // novas exigências de procuração de qualquer processo do cliente.
        // Regra oficial: procuração vale 12 meses a partir da emissão
        // (ver src/lib/quero-armas/validadeDocumento.ts → isProcuracao).
        const temProcuracaoVigenteNoHub = hubProcuracoes.some((h) => {
          try {
            const info = getValidadeInfo({
              tipo_documento: "procuracao_assinada",
              data_emissao: h.data_emissao ?? null,
              data_validade_efetiva: h.data_validade_efetiva ?? null,
              data_validade: h.data_validade ?? null,
            });
            // Aprovada + vigente OU aprovada sem data (fallback conservador).
            if (h.status !== "aprovado") return false;
            if (info.status === "vencido") return false;
            return true;
          } catch { return false; }
        });
        const procFulfilled = (p: any) => {
          // 1) match direto por procuracao_id no metadata
          if (hubProcuracoes.some((h) => String(h.metadados_documento_json?.procuracao_id ?? "") === String(p.id))) return true;
          // 2) match por venda_id no metadata
          if (p.venda_id && hubProcuracoes.some((h) => String(h.metadados_documento_json?.venda_id ?? "") === String(p.venda_id))) return true;
          // 3) Reaproveitamento: procuração aprovada e vigente no Hub cobre
          //    novas exigências, mesmo entre processos distintos.
          if (temProcuracaoVigenteNoHub) return true;
          // 4) ENTREGUE, mesmo que ainda não aprovada.
          //
          // Esta fila se chama "aguardando SUA assinatura". Depois que o
          // cliente sobe o PDF assinado, a bola está com a equipe — continuar
          // mostrando a mesma tela faz ele achar que o envio falhou e mandar
          // de novo.
          //
          // A consulta acima já traz status "pendente_aprovacao" e "aprovado";
          // qualquer um dos dois significa entregue. A aprovação em si é
          // acompanhada em Contratos, não aqui.
          if (hubProcuracoes.length > 0) return true;
          return false;
        };

        const contractsPendentes = contracts.filter((c) => !contractFulfilled(c));
        const procuracoesPendentes = procuracoesArr.filter((p) => !procFulfilled(p));

        setPendingContracts(contractsPendentes.length);

        // DEDUP das procurações por venda.
        //
        // O cliente assina UMA procuração por venda. Três linhas pendentes da
        // mesma venda são geração duplicada, e mostrá-las vira três passos
        // idênticos no popup — foi o que apareceu no portal em 31/07/2026.
        // Fica a mais recente; as outras somem da fila (não são apagadas do
        // banco: isso é decisão da equipe, não do portal).
        const procuracoesUnicas: any[] = Array.from(
          procuracoesPendentes
            .slice()
            .sort((a, b) =>
              String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")),
            )
            .reduce((mapa, proc) => {
              const chave = String(proc?.venda_id ?? proc?.id);
              if (!mapa.has(chave)) mapa.set(chave, proc);
              return mapa;
            }, new Map<string, any>())
            .values(),
        );

        // ORDEM: contrato ANTES da procuração (regra do usuário, 31/07/2026).
        //
        // Enquanto houver contrato pendente, a procuração nem entra na fila —
        // não basta ordenar, porque o cliente conseguia pular para ela. A
        // procuração é outorgada com base no contrato: assinar a segunda antes
        // do primeiro inverte a relação.
        const assinaturaDocs: PendingSignatureDoc[] = [
          ...contractsPendentes.map((contract) => ({
            id: String(contract.id),
            kind: "contract" as const,
            label: "Contrato de adesão",
            status: contract.status ?? null,
            contract_number: contract.contract_number ?? null,
            venda_id: contract.venda_id ?? null,
            created_at: contract.created_at ?? null,
          })),
          ...(contractsPendentes.length > 0
            ? []
            : procuracoesUnicas.map((procuracao) => ({
                id: String(procuracao.id),
                kind: "procuration" as const,
                label: "Procuração",
                status: procuracao.status ?? null,
                contract_number: null,
                venda_id: procuracao.venda_id ?? null,
                created_at: procuracao.created_at ?? null,
              }))),
        ];
        setPendingSignatureDocs(assinaturaDocs);
        setPendingContractsLoaded(true);
      } catch {
        if (alive) {
          setPendingContracts(0);
          setPendingSignatureDocs([]);
          setPendingContractsLoaded(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [cliente, docsReloadKey]);

  if (loading) {
    // Enquanto não sabemos se há sessão, renderiza fundo escuro invisível
    // para não “piscar” um spinner claro antes do redirect para /login.
    if (!authKnown) {
      return <div className="min-h-dvh bg-[#050505]" aria-hidden />;
    }
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
    <div className={`min-h-dvh bg-[#F2F2F2] text-slate-900 overflow-x-hidden transition-[padding-left] duration-200 pt-14 lg:pt-0 ${effectiveCollapsed ? "pl-0 lg:pl-[68px]" : "pl-0 lg:pl-[190px]"}`}>
      {/* Botão hambúrguer — visível apenas <lg quando o menu está escondido */}
      {mobileHidden && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Abrir menu"
          className="lg:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-full bg-[#141414] text-white border border-[#2a2a2a] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {/* Avatar global — fixo no topo direito em todas as seções */}
      <div style={{ position: 'fixed', top: 16, right: 72, zIndex: 55 }}>
        <button
          type="button"
          onClick={() => setAvatarDropOpen((v) => !v)}
          className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#e0e0e0] bg-white focus:outline-none"
          title="Opções de conta"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center bg-[#7A1F2B] text-white font-bold text-[18px]" style={{ fontFamily: "Oswald, sans-serif" }}>
                {userName ? userName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "QA"}
              </span>
          }
        </button>
        {avatarDropOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setAvatarDropOpen(false)} />
            <div role="menu" style={{ position: 'absolute', top: 60, right: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setAvatarDropOpen(false); handleLogout(); }}
                style={{ border: 0, background: 'transparent', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: '#1c1c1c', lineHeight: 1.3, textAlign: 'right', transition: 'color 0.2s ease', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#7A1F2B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#1c1c1c'; }}
              >
                Sair
              </button>
            </div>
          </>
        )}
      </div>

      {/* Backdrop — visível apenas <lg quando o drawer está aberto */}
      {!mobileHidden && isBelowLg && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden
        />
      )}
      <ForcePasswordChangeModal
        open={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />
      <EntradaWizard
        open={!mustChangePassword && entradaWizardOpen}
        onOpenChange={setEntradaWizardOpen}
        clienteId={(cliente as any)?.id ?? null}
        onConcluido={handleEntradaConcluido}
      />
      
      <ClienteFotoUploadModal
        open={!mustChangePassword && showFotoModal}
        onOpenChange={setShowFotoModal}
        onUploaded={() => {
          setAvatarReloadKey((k) => k + 1);
          setDocsReloadKey((k) => k + 1);
        }}
      />
      {/* ═══ SIDEBAR ESQUERDO — branding apenas em desktop; nav completo em mobile ═══ */}
      <aside
        className={`qa-client-mobile-drawer flex fixed inset-0 lg:inset-y-0 lg:right-auto left-0 z-50 flex-col text-[#E8E8E8] transition-[width,transform] duration-200 overflow-hidden ${effectiveCollapsed ? "w-screen max-w-full lg:w-[68px] lg:max-w-[68px]" : "w-screen max-w-full lg:w-[190px] lg:max-w-[190px]"} ${mobileHidden ? "-translate-x-full lg:translate-x-0" : "translate-x-0"}`}
        style={{ background: sidebarTheme.bg, overscrollBehavior: "none", touchAction: isBelowLg ? "none" : undefined }}
        data-qa-sb-theme={sidebarTheme.key}
      >
        {/* stripe removida conforme solicitado */}
        {/* ── BLOCO DE TOPO (hero) — apenas temas com topMode "hero" expandidos ── */}
        {sidebarTheme.topMode === "hero" && !effectiveCollapsed && (
          <div
            aria-hidden
            className="relative w-full h-[36px] lg:h-[100px] overflow-hidden shrink-0"
            style={
              sidebarTheme.heroEmpty
                ? { background: "transparent" }
                : sidebarTheme.heroImage
                ? {
                    backgroundImage: `url("${sidebarTheme.heroImage}")`,
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

        {/* Brand removido da sidebar conforme solicitado */}

        {/* Nav mobile — só aparece abaixo de lg; em desktop a nav vai para o rail direito */}
        <nav className="qa-client-mobile-nav lg:hidden flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-1 mt-14" style={{ overscrollBehavior: "none", touchAction: "none" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key || (item.key === "processos" && activeSection === "contratacoes");
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { goSection(item.key); setSidebarCollapsed(true); }}
                className={`flex items-center justify-between w-full gap-3 px-4 py-2.5 text-[14px] font-bold border-l-2 ${active ? "text-white" : "text-[#c9c2b3] border-transparent hover:text-white hover:bg-white/5"}`}
                style={active ? { background: `linear-gradient(90deg, ${sidebarTheme.accent}47 0%, transparent 100%)`, borderLeftColor: sidebarTheme.accent } : undefined}
              >
                <span className="text-left">{item.label}</span>
                <Icon className="h-5 w-5 shrink-0" style={active ? { color: sidebarTheme.accent } : undefined} />
              </button>
            );
          })}
        </nav>

        {/* Espaçador desktop — empurra rodapé para baixo */}
        <div className="hidden lg:flex flex-1" />

      </aside>

      {/* ═══ RAIL DIREITO — nav icon-only, visível apenas em desktop (lg+) ═══ */}
      <aside
        className="hidden lg:flex fixed top-0 right-0 bottom-0 z-40 w-[56px] flex-col items-center pt-6 overflow-y-auto no-scrollbar"
        style={{ background: sidebarTheme.bg.includes("url(") ? "#0A0A0A" : sidebarTheme.bg }}
        data-qa-sb-theme={sidebarTheme.key}
      >
        {/* Ícones principais — topo */}
        <div className="flex flex-col items-center gap-1">
          {navItems.filter((i) => i.key !== "mensagens" && i.key !== "configuracoes").map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key || (item.key === "processos" && activeSection === "contratacoes");
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goSection(item.key)}
                title={item.label}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                style={active ? { background: `${railIconColor}33`, color: railIconColor } : { color: `${railIconColor}88` }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = railIconColor; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = `${railIconColor}88`; }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Espaçador */}
        <div className="flex-1" />

        {/* Suporte e Configurações — fundo, acima do balão flutuante */}
        <div className="flex flex-col items-center gap-1 pb-[88px]">
          {navItems.filter((i) => i.key === "mensagens" || i.key === "configuracoes").map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goSection(item.key)}
                title={item.label}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                style={active ? { background: `${railIconColor}33`, color: railIconColor } : { color: `${railIconColor}88` }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = railIconColor; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = `${railIconColor}88`; }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
              </button>
            );
          })}
        </div>
      </aside>

      {/* TOP BAR mobile removida — sidebar dark é a navegação única em todas as larguras. */}

      <main className="max-w-[1540px] mx-auto px-4 lg:px-8 py-6 space-y-5 overflow-x-hidden lg:mr-[56px]">
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
              setMeusDocs(((dRes.data as any[]) ?? []).filter((doc: any) =>
                isTipoDocumentoMonitoravelNoHub(doc?.tipo_documento),
              ));
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
            open={!mustChangePassword && showArmaManual}
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

        {activeSection === "armas_municoes" && cliente && (
          <ArsenalPremiumGate arsenal={arsenalPremium} recurso="Gestão de Armas e Munições">
            <ClienteArmasMunicoesSection
              clienteId={cliente.id}
              meusDocs={meusDocs}
              crafs={crafs}
              onOpenDocumentos={() => goSection("documentos")}
            />
          </ArsenalPremiumGate>
        )}

        {activeSection === "analise_alvo" && (
          <ArsenalPremiumGate arsenal={arsenalPremium} recurso="Análise de Alvo">
            <ClienteAnaliseAlvoSection />
          </ArsenalPremiumGate>
        )}

        {activeSection === "recarga_municoes" && (
          <ArsenalPremiumGate arsenal={arsenalPremium} recurso="Recarga de Munições">
            <ClienteRecargaMunicoesSection />
          </ArsenalPremiumGate>
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
          processos={processos}
          processoDocs={processoDocs}
          pendingContracts={pendingContracts}
          onNavigate={(tab) => setActiveSection(tab as any)}
          onOpenCadastro={() => setShowCadastroModal(true)}
          onOpenComprar={() => { setShowCadastroModal(false); setTimeout(() => setEntradaWizardOpen(true), 30); }}
          onOpenChecklist={() => abrirChecklistGuiado()}
          onOpenDocsHub={() => setShowAddDoc(true)}
          onLogout={handleLogout}
          onOpenKlal={() => setActiveSection("mensagens" as any)}
          avatarUrl={avatarUrl}
          avatarInitials={userName ? userName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "QA"}
          lockPageScroll
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
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-red-50 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Ação necessária
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-emerald-50 text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Nenhuma ação necessária agora
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner de ação (só quando tem) */}
                {temAcao && (
                  <div className="border-t border-slate-100 bg-[#7A1F2B]/5 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-[12px] font-bold text-[#7A1F2B] truncate whitespace-nowrap overflow-hidden">{acaoTitulo}</div>
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
                        const nomeProcesso = formatProcessoNome(
                          getQAServiceDisplayName({
                            ...catalogoByServicoId[Number(p.servico_id)],
                            servico_id: p.servico_id,
                            servico_nome: p.servico_nome || SERVICO_MAP[p.servico_id],
                          }) || p.servico_nome,
                        );
                        const statusLabel = sKey.replace(/_/g, " ") || "ativo";
                        return (
                          <button key={p.id} type="button" onClick={() => setActiveSection("processos")}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition">
                            <div className="mb-2 space-y-1.5">
                              <div className="text-[12px] font-bold leading-snug text-slate-900 line-clamp-2">
                                {nomeProcesso}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-[0.08em]
                                  ${done ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                                  {statusLabel}
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                                  Checklist documental
                                </span>
                              </div>
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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap
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
            processos: processosComNomeDisplay,
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
          <div>
            <div className="no-print mb-3 flex items-center gap-1 border border-[#E5E5E5] bg-white p-1 rounded w-fit" style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", letterSpacing: ".18em" }}>
              {(["lista", "extraidos"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDocsSubview(k)}
                  className="px-3 py-1.5 text-[10px] font-black uppercase rounded-sm transition-colors"
                  style={{
                    background: docsSubview === k ? "#7A1F2B" : "transparent",
                    color: docsSubview === k ? "#fff" : "#7A7A7A",
                  }}
                >
                  {k === "lista" ? "Lista" : "Dados extraídos"}
                </button>
              ))}
            </div>
            {docsSubview === "lista" ? (
              <DocumentosCategoriaZ6V3Panel
                cliente={cliente}
                meusDocs={meusDocs}
                customerId={customerId}
                onReload={() => setDocsReloadKey((k) => k + 1)}
                onOpenAdd={(tipo, substituirId) => {
                  if (tipo) setEditDocTipo(tipo);
                  setSubstituirDocId(substituirId ?? null);
                  setShowAddDoc(true);
                }}
              />
            ) : (
              <DadosExtraidosPanel
                cliente={cliente}
                meusDocs={meusDocs}
                onEditDoc={(d) => {
                  setEditDocTipo(d?.tipo_documento || undefined);
                  setShowAddDoc(true);
                }}
              />
            )}
          </div>
        )}

        {activeSection === "mensagens" && (
          <ArsenalPremiumGate arsenal={arsenalPremium} recurso="Klal — Assistente Jurídico">
            <div className="-mx-4 lg:-mx-8 -mt-5">
              <CentralAjudaCliente cliente={cliente as any} />
            </div>
          </ArsenalPremiumGate>
        )}

        {activeSection === "financeiro" && analysis && (
          <div className="space-y-4">
            {(() => {
              const servicoNomePorId: Record<number, string> = {};
              for (const [id, meta] of Object.entries(SERVICO_MAP || {})) {
                const n = (meta as any)?.nome_servico || (meta as any)?.nome;
                if (n) servicoNomePorId[Number(id)] = String(n);
              }
              // Mescla nomes vindos do qa_servicos_catalogo (cobre IDs novos como CONCESSÃO DE CR = 44).
              for (const [id, meta] of Object.entries(catalogoByServicoId || {})) {
                const n = (meta as any)?.nome;
                if (n) servicoNomePorId[Number(id)] = String(n);
              }
              const ass = arsenalPremium.assinatura;
              const premium = ass && ["gratuidade", "ativa", "aguardando_pagamento"].includes(ass.status)
                ? {
                    ativa: arsenalPremium.liberado,
                    status: ass.status,
                    forma_pagamento: ass.forma_pagamento ?? null,
                    valor_mensal: Number(ass.valor_anual || 297) / 12,
                    dia_cobranca: Number(String(ass.periodo_inicio || "").slice(8, 10)) || 1,
                    proxima_em: ass.periodo_fim,
                    cartao: ass.asaas_credit_card_last4
                      ? {
                          bandeira: ass.asaas_credit_card_brand || "CARTÃO",
                          ultimos4: ass.asaas_credit_card_last4,
                          titular: ass.asaas_credit_card_holder || "",
                          validade: ass.asaas_credit_card_expiry || "",
                        }
                      : null,
                    descricao:
                      ass.status === "gratuidade"
                        ? `Período gratuito ativo até ${String(ass.periodo_fim).split("-").reverse().join("/")}. Depois, R$ 297/ano (12x de R$ 24,75 no cartão).`
                        : ass.status === "aguardando_pagamento"
                          ? "Adesão aguardando confirmação do pagamento."
                          : `Plano anual de R$ 297 (12x de R$ 24,75). Renovação em ${String(ass.periodo_fim).split("-").reverse().join("/")}.`,
                  }
                : null;
              return (
                <QAClienteFinanceiroCentral
                  vendas={vendas as any}
                  itens={itens as any}
                  servicoNomePorId={servicoNomePorId}
                  premium={premium}
                  onPremiumRefresh={arsenalPremium.refresh}
                  onNavigateContratos={() => setActiveSection("contratos" as any)}
                  clienteNome={String(userName || cliente?.nome || cliente?.nome_completo || "").trim()}
                />
              );
            })()}
          </div>
        )}

        {activeSection === "configuracoes" && (
          <SectionCard icon={Settings} title="Configurações" color="hsl(220 65% 48%)">
            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <button
                type="button"
                onClick={() => setShowFotoModal(true)}
                className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50 flex items-center gap-3"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-200 bg-[#7A1F2B] flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName || "Foto"} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-[13px]" style={{ fontFamily: "Oswald, sans-serif" }}>QA</span>
                  )}
                  <span className="absolute -bottom-0 -right-0 bg-slate-900 text-white rounded-full p-1">
                    <Camera className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-slate-900">Minha foto</div>
                  <p className="mt-1 text-[11px] text-slate-500">{avatarUrl ? "Trocar a foto exibida no menu." : "Adicione uma foto para o menu."}</p>
                </div>
              </button>
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
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wider shrink-0 ${reprov ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
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
          open={!mustChangePassword && showAddDoc}
          onClose={() => { setShowAddDoc(false); setEditDocTipo(undefined); setSubstituirDocId(null); }}
          customerId={customerId}
          qaClienteId={cliente?.id ?? null}
          mode="portal"
          defaultTipo={editDocTipo}
          substituirDocumentoId={substituirDocId}
          clienteCpf={String(cliente?.cpf || "").replace(/\D/g, "") || null}
          clienteNome={cliente?.nome_completo || null}
          clienteDataNascimento={cliente?.data_nascimento || null}
          clienteNomeMae={cliente?.nome_mae || null}
          docsAprovados={meusDocs.filter((d: any) => d.status === "aprovado")}
          onSaved={() => setDocsReloadKey((k) => k + 1)}
        />
      )}

      {cliente?.id ? (
        <ClienteChecklistCadastralModal
          open={!mustChangePassword && showChecklistCadastral}
          cliente={cliente as Record<string, unknown>}
          onClose={() => setShowChecklistCadastral(false)}
          onConcluido={() => {
            // Só fecha. NÃO recarrega o portal aqui: era o setDocsReloadKey
            // deste ponto que realimentava o efeito de abertura e derrubava a
            // página. O checklist do processo abre pelo efeito próprio dele.
            setShowChecklistCadastral(false);
            // Cadastro completo: emenda direto no checklist do processo.
            abrirPendenciasGuiadas({ pularGateCadastral: true });
          }}
        />
      ) : null}

      {cliente?.id ? (
        <ClienteCadastroProgressivoModal
          open={!mustChangePassword && showCadastroModal}
          onClose={() => setShowCadastroModal(false)}
          cliente={cliente}
          onUpdated={() => setDocsReloadKey((k) => k + 1)}
        />
      ) : null}

      <NotificacaoEngineOverlay
        clienteId={(cliente as any)?.id ?? null}
        bloqueado={mustChangePassword || showContratoPopup || showProcuracaoNextPrompt || showAddDoc || showCadastroModal}
      />

      {/* Seletor do PDF assinado. Fica fora do popup para sobreviver ao
          fechamento dele durante o envio. */}
      <input
        ref={contratoAssinadoInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviarContratoAssinado(f);
        }}
      />
      {!mustChangePassword && showProcuracaoNextPrompt ? (
        <div className="fixed inset-0 z-[125] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-procuracao-next-title"
            className="w-full max-w-[620px] overflow-hidden rounded-t-3xl border border-[#F1D6DA] bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#F4E5E7] px-6 py-5 md:px-8">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A1224]">
                    Próxima etapa
                  </p>
                  <h2
                    id="qa-procuracao-next-title"
                    className="mt-1 text-2xl font-semibold leading-tight text-[#0A0A0A]"
                  >
                    Contrato recebido com sucesso
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProcuracaoNextPrompt(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E4E4E4] text-[#6A6A6A] transition-colors hover:bg-[#FAFAFA] hover:text-[#0A0A0A]"
                aria-label="Fechar aviso"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6 md:px-8">
              <p className="text-sm leading-relaxed text-[#4B4B4B]">
                Recebemos o contrato assinado. Agora falta enviar a procuração para a equipe
                continuar o atendimento do seu processo sem travar a próxima etapa.
              </p>
              <div className="rounded-sm border border-[#F1D6DA] bg-[#FFF8F9] px-4 py-3 text-sm text-[#8A1224]">
                A procuração é outro documento. Ela precisa ser baixada, assinada e enviada
                separadamente, mesmo que o passo a passo seja parecido com o do contrato.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-[#F4E5E7] bg-white px-6 py-5 md:grid-cols-[1fr_auto] md:px-8">
              <button
                type="button"
                onClick={() => setShowProcuracaoNextPrompt(false)}
                className="inline-flex h-12 items-center justify-center rounded-sm border border-[#E4E4E4] bg-white px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4B4B4B] transition-colors hover:bg-[#FAFAFA]"
              >
                Ver depois
              </button>
              <button
                type="button"
                onClick={abrirProcuracaoDepoisDoContrato}
                className="inline-flex h-12 items-center justify-center rounded-sm bg-[#8A1224] px-6 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#6f0f1d]"
              >
                {nextPendingProcuracao ? "Enviar procuração agora" : "Preparar procuração"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PendenciasGuiadasPopup
        open={
          !mustChangePassword &&
          (showContratoPopup ||
            (pendingContractsLoaded &&
              pendingSignatureCount > 0 &&
              !showAddDoc &&
              !showCadastroModal &&
              !showChecklistCadastral)) &&
          pendenciasGuiadasCount > 0
        }
        bloqueante={pendingContractsLoaded && pendingSignatureCount > 0}
        pendencias={pendenciasGuiadas}
        pinnedId={pinnedPendenciaId}
        ufCliente={(cliente as any)?.estado ?? null}
        onDismiss={dismissPendenciasGuiadas}
                resumoProcesso={resumoProcesso}
        />
    </div>
    </PortalFilterProvider>
  );
}
