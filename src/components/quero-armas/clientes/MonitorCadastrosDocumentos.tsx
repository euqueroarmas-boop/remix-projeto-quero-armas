/**
 * Monitor de Cadastros e Documentos — Fase 1 (fechamento)
 * ----------------------------------------------------------------------
 * Aba dentro de /clientes (não cria rota paralela).
 * Apenas Equipe Quero Armas (área já protegida pelo layout autenticado).
 *
 * Regras de cor:
 *  - cinza/neutro = zero/sem dados
 *  - verde        = aprovado / regular
 *  - amarelo      = análise humana / dúvida
 *  - vermelho     = rejeitado / crítico
 *
 * Fontes reais (auditadas no banco):
 *  - Cadastros públicos    → `qa_cadastro_publico.status` (pendente/aprovado)
 *  - Documentos de processo → `qa_processo_documentos`
 *      • status (operacional): pendente | em_analise | revisao_humana | aprovado | invalido | divergente
 *      • decisao_ia (decisão pura da IA, NUNCA escrita por ação manual):
 *          aprovado_auto | rejeitado_auto | revisao_humana | divergente | erro
 *  - Aprovação manual = status='aprovado' AND decisao_ia <> 'aprovado_auto'.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Bot, BookOpen,
  Users, FileText, Brain, AlertTriangle, Settings as SettingsIcon, Loader2,
  CheckCircle2, XCircle, RotateCcw, Star, ExternalLink, Eye, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type DocRow = {
  id: string;
  cliente_id: number | null;
  processo_id: string | null;
  tipo_documento: string;
  nome_documento: string | null;
  status: string;
  validacao_ia_status: string | null;
  validacao_ia_confianca: number | null;
  motivo_rejeicao: string | null;
  score_modelo_aprovado: number | null;
  modelo_aprovado_id: string | null;
  data_envio: string | null;
  updated_at: string | null;
  arquivo_storage_key: string | null;
  usado_como_modelo?: boolean | null;
  decisao_ia?: string | null;
  cliente_nome?: string | null;
  cliente_doc?: string | null;
  servico_nome?: string | null;
};
type ModeloRow = {
  id: string;
  tipo_documento: string;
  ativo: boolean;
  updated_at: string;
  aprovado_em: string;
};
type ConfigRow = {
  tipo_documento: string;
  limite_aprovacao_auto: number;
  limite_analise_humana: number;
  permite_aprovacao_auto: boolean;
  alimenta_aprendizado: boolean;
  ativo: boolean;
  observacoes: string | null;
  campos_obrigatorios_json: string[] | null;
  palavras_chave_esperadas_json: string[] | null;
};

type CadastroRow = {
  id: string;
  nome_completo: string | null;
  cpf: string | null;
  emp_cnpj: string | null;
  email: string | null;
  telefone_principal: string | null;
  servico_fechado_final: string | null;
  servico_principal: string | null;
  servico_interesse: string | null;
  origem_cadastro: string | null;
  status: string | null;
  created_at: string | null;
  processado_em: string | null;
  cliente_id_vinculado: number | null;
};

type ModeloDetalheRow = {
  id: string;
  tipo_documento: string;
  nome_modelo: string | null;
  documento_origem_id: string | null;
  ativo: boolean;
  observacoes: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  updated_at: string | null;
};

// Helpers visuais ---------------------------------------------------------
const tone = {
  neutral: "bg-slate-50 border-slate-200 text-slate-600",
  green:   "bg-emerald-50 border-emerald-200 text-emerald-700",
  yellow:  "bg-amber-50  border-amber-200  text-amber-800",
  red:     "bg-rose-50   border-rose-200   text-rose-700",
  blue:    "bg-sky-50    border-sky-200    text-sky-700",
} as const;

function KpiCard({
  icon, label, value, t = "neutral", active, onClick,
}: {
  icon: any; label: string; value: number | string; t?: keyof typeof tone;
  active?: boolean; onClick?: () => void;
}) {
  const Icon = icon;
  const isZero = value === 0 || value === "0";
  const cls = isZero ? tone.neutral : tone[t];
  const ring = active
    ? "ring-2 ring-slate-900 ring-offset-1 shadow-sm"
    : onClick ? "hover:shadow-sm hover:-translate-y-[1px]" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-xl border px-4 py-3 transition-all ${cls} ${ring} ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold">{label}</span>
        {active && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-700">ATIVO</span>}
      </div>
      <div className="mt-1 text-2xl font-mono font-bold tabular-nums">{value}</div>
    </button>
  );
}

// Mapeamento status real do banco → label padronizado para exibição.
// Mantemos compatibilidade com valores antigos (`aprovado`, `invalido`, `em_analise`).
const LABEL_STATUS: Record<string, { label: string; tone: keyof typeof tone }> = {
  pendente:       { label: "RECEBIDO",                 tone: "neutral" },
  em_analise:     { label: "PROCESSANDO IA",           tone: "blue"    },
  revisao_humana: { label: "REVISÃO HUMANA",           tone: "yellow"  },
  divergente:     { label: "DIVERGENTE",               tone: "yellow"  },
  aprovado:       { label: "APROVADO",                 tone: "green"   },
  invalido:       { label: "REJEITADO",                tone: "red"     },
};
function StatusBadge({ status, decisaoIA }: { status: string; decisaoIA?: string | null }) {
  const m = LABEL_STATUS[status] ?? { label: status.replace(/_/g, " ").toUpperCase(), tone: "neutral" as const };
  const sufixo = status === "aprovado"
    ? (decisaoIA === "aprovado_auto" ? " (AUTO)" : " (MANUAL)")
    : status === "invalido"
      ? (decisaoIA === "rejeitado_auto" ? " (AUTO)" : " (MANUAL)")
      : "";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold border ${tone[m.tone]}`}>
      {m.label}{sufixo}
    </span>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

// ---------------------------------------------------------------------------
export default function MonitorCadastrosDocumentos() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs]       = useState<DocRow[]>([]);
  const [modelos, setModelos] = useState<ModeloRow[]>([]);
  const [modelosDetalhe, setModelosDetalhe] = useState<ModeloDetalheRow[]>([]);
  const [cadastrosAguardando, setCadastrosAguardando] = useState<CadastroRow[]>([]);
  const [cadastrosAprovHoje, setCadastrosAprovHoje]   = useState<CadastroRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [kpiCadastros, setKpiCadastros] = useState({ aguardando: 0, aprovadosHoje: 0 });
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const [openConfig, setOpenConfig] = useState(false);
  const [aprovandoCadId, setAprovandoCadId] = useState<string | null>(null);

  // KPI ativa (drill-down). Cada KPI funciona como filtro principal.
  // null = padrão (lista de pendentes de ação).
  type KpiId =
    | "cadastros_aguardando"
    | "cadastros_aprov_hoje"
    | "docs_analise_humana"
    | "docs_aprovados_ia"
    | "docs_rejeitados_ia"
    | "docs_aprovados_equipe"
    | "docs_rejeitados_equipe"
    | "modelos_ativos"
    | "tipos_monitorados"
    | "pendencias_criticas"
    | "confianca_media";
  const [kpiAtiva, setKpiAtiva] = useState<KpiId | null>(null);

  // Filtros
  const [fTipo, setFTipo]     = useState<string>("todos");
  const [fCliente, setFCliente] = useState<string>("");
  const [fScoreBaixo, setFScoreBaixo] = useState(false);

  // Ações operacionais
  const [acaoLoadingId, setAcaoLoadingId] = useState<string | null>(null);
  const [modalAcao, setModalAcao] = useState<{ doc: DocRow; tipo: "rejeitar" | "novo_envio" | "modelo" } | null>(null);
  const viewer = useDocumentoViewer();
  // Documento atualmente aberto no viewer (para ação "Aprovar como Modelo IA")
  const [docNoViewer, setDocNoViewer] = useState<DocRow | null>(null);
  const [aprovandoModeloViewer, setAprovandoModeloViewer] = useState(false);

  // -------------------------------------------------------------------------
  const carregar = async () => {
    setLoading(true);
    try {
      // 1) Documentos relevantes (operacional + IA)
      const { data: docsData, error: docsErr } = await supabase
        .from("qa_processo_documentos")
        .select("id, cliente_id, processo_id, tipo_documento, nome_documento, status, validacao_ia_status, validacao_ia_confianca, motivo_rejeicao, score_modelo_aprovado, modelo_aprovado_id, data_envio, updated_at, arquivo_storage_key, usado_como_modelo, decisao_ia")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (docsErr) throw docsErr;

      // Hidratação opcional de cliente/serviço
      const clienteIds = Array.from(new Set((docsData ?? []).map(d => d.cliente_id).filter((v): v is number => v != null)));
      const procIds    = Array.from(new Set((docsData ?? []).map(d => d.processo_id).filter(Boolean))) as string[];
      const [{ data: clientes }, { data: processos }] = await Promise.all([
        clienteIds.length
          ? supabase.from("qa_clientes").select("id, nome_completo, cpf, cnpj").in("id", clienteIds)
          : Promise.resolve({ data: [] as any[] }) as any,
        procIds.length
          ? supabase.from("qa_processos").select("id, servico_nome").in("id", procIds)
          : Promise.resolve({ data: [] as any[] }) as any,
      ]);
      const cliMap = new Map<number, any>((clientes ?? []).map((c: any) => [c.id as number, c]));
      const procMap = new Map<string, any>((processos ?? []).map((p: any) => [p.id as string, p]));
      const docsHidratados: DocRow[] = (docsData ?? []).map((d: any) => {
        const c = d.cliente_id ? cliMap.get(d.cliente_id) : null;
        const p = d.processo_id ? procMap.get(d.processo_id) : null;
        return {
          ...d,
          cliente_nome: c?.nome_completo ?? null,
          cliente_doc:  c?.cpf ?? c?.cnpj ?? null,
          servico_nome: p?.servico_nome ?? null,
        };
      });
      setDocs(docsHidratados);

      // 2) Modelos aprovados
      const { data: mods } = await supabase
        .from("qa_documentos_modelos_aprovados")
        .select("id, tipo_documento, ativo, updated_at, aprovado_em")
        .order("updated_at", { ascending: false });
      setModelos((mods ?? []) as ModeloRow[]);

      // 2.b) Modelos detalhados (para drill-down quando KPI "Modelos ativos" estiver ativa)
      const { data: modsDet } = await supabase
        .from("qa_documentos_modelos_aprovados")
        .select("id, tipo_documento, nome_modelo, documento_origem_id, ativo, observacoes, aprovado_por, aprovado_em, updated_at")
        .order("aprovado_em", { ascending: false });
      setModelosDetalhe((modsDet ?? []) as ModeloDetalheRow[]);

      // 3) Configurações por tipo
      const { data: cfg } = await supabase
        .from("qa_validacao_config")
        .select("*")
        .order("tipo_documento", { ascending: true });
      setConfigs((cfg ?? []) as ConfigRow[]);

      // 4) KPIs de cadastros (fonte real: qa_cadastro_publico)
      // Status reais auditados: 'pendente' | 'aprovado' (NÃO usar qa_clientes.status,
      // que é operacional e tem 'ATIVO'/'aguardando_analise'/'DESISTENTE'/'conta_gratuita_arsenal').
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      const [aguardando, aprovHoje] = await Promise.all([
        supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }).eq("status", "aprovado").gte("updated_at", inicio),
      ]);
      setKpiCadastros({
        aguardando:    aguardando.count ?? 0,
        aprovadosHoje: aprovHoje.count   ?? 0,
      });

      // 4.b) Listas detalhadas dos cadastros (para drill-down)
      const cadCols = "id, nome_completo, cpf, emp_cnpj, email, telefone_principal, servico_fechado_final, servico_principal, servico_interesse, origem_cadastro, status, created_at, processado_em, cliente_id_vinculado";
      const [{ data: cadAguard }, { data: cadAprov }] = await Promise.all([
        supabase.from("qa_cadastro_publico" as any).select(cadCols).eq("status", "pendente").order("created_at", { ascending: false }).limit(500),
        supabase.from("qa_cadastro_publico" as any).select(cadCols).eq("status", "aprovado").gte("updated_at", inicio).order("processado_em", { ascending: false }).limit(500),
      ]);
      setCadastrosAguardando((cadAguard ?? []) as unknown as CadastroRow[]);
      setCadastrosAprovHoje((cadAprov ?? []) as unknown as CadastroRow[]);
    } catch (e: any) {
      toast.error("Erro ao carregar monitor: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-line */ }, []);

  // -------------------------------------------------------------------------
  // Agregações
  // -------------------------------------------------------------------------
  const counters = useMemo(() => {
    const c = {
      analiseHumana: 0,
      aprovadosIA:   0,
      rejeitadosIA:  0,
      aprovadosEquipe: 0,
      rejeitadosEquipe: 0,
      criticos: 0,
      somaScore: 0,
      comScore:  0,
    };
    for (const d of docs) {
      if (d.status === "revisao_humana" || d.validacao_ia_status === "revisao_humana") c.analiseHumana++;
      // Aprovação automática SOMENTE via decisao_ia='aprovado_auto'.
      if (d.decisao_ia === "aprovado_auto") c.aprovadosIA++;
      if (d.decisao_ia === "rejeitado_auto") c.rejeitadosIA++;
      // Aprovação manual = aprovado E NÃO foi a IA quem aprovou.
      if (d.status === "aprovado" && d.decisao_ia !== "aprovado_auto") c.aprovadosEquipe++;
      if (d.status === "invalido" && d.decisao_ia !== "rejeitado_auto") c.rejeitadosEquipe++;
      if (d.status === "invalido" && (d.tipo_documento === "cr" || d.tipo_documento === "craf" || d.tipo_documento === "antecedentes_criminais")) c.criticos++;
      if (typeof d.validacao_ia_confianca === "number") {
        c.somaScore += Number(d.validacao_ia_confianca);
        c.comScore++;
      }
    }
    return {
      ...c,
      confiancaMedia: c.comScore ? c.somaScore / c.comScore : 0,
      tiposMonitorados: configs.filter(x => x.ativo !== false).length,
      modelosAtivos: modelos.filter(m => m.ativo).length,
    };
  }, [docs, configs, modelos]);

  const baseAprendizado = useMemo(() => {
    const acc = new Map<string, {
      tipo: string; modelos: number; ultima: string | null;
      auto: number; humana: number; rejeit: number; somaScore: number; comScore: number;
    }>();
    for (const m of modelos) {
      if (!m.ativo) continue;
      const a = acc.get(m.tipo_documento) ?? { tipo: m.tipo_documento, modelos: 0, ultima: null, auto: 0, humana: 0, rejeit: 0, somaScore: 0, comScore: 0 };
      a.modelos++;
      if (!a.ultima || (m.updated_at && m.updated_at > a.ultima)) a.ultima = m.updated_at;
      acc.set(m.tipo_documento, a);
    }
    for (const d of docs) {
      const a = acc.get(d.tipo_documento) ?? { tipo: d.tipo_documento, modelos: 0, ultima: null, auto: 0, humana: 0, rejeit: 0, somaScore: 0, comScore: 0 };
      if (d.decisao_ia === "aprovado_auto") a.auto++;
      if (d.status === "revisao_humana" || d.validacao_ia_status === "revisao_humana") a.humana++;
      if (d.decisao_ia === "rejeitado_auto") a.rejeit++;
      if (typeof d.validacao_ia_confianca === "number") { a.somaScore += d.validacao_ia_confianca; a.comScore++; }
      acc.set(d.tipo_documento, a);
    }
    return Array.from(acc.values()).sort((a,b) => b.modelos - a.modelos || a.tipo.localeCompare(b.tipo));
  }, [docs, modelos]);

  // Lista operacional + filtros
  const tiposUnicos = useMemo(() => {
    return Array.from(new Set(docs.map(d => d.tipo_documento))).sort();
  }, [docs]);

  // -------------------------------------------------------------------------
  // Drill-down por KPI: cada KPI tem UM seletor de documentos, reutilizado
  // tanto pelo contador quanto pela lista. Sem divergência possível.
  // -------------------------------------------------------------------------
  const SELECTORS: Record<string, (d: DocRow) => boolean> = {
    docs_analise_humana: (d) =>
      d.status === "revisao_humana" || d.validacao_ia_status === "revisao_humana",
    docs_aprovados_ia:   (d) => d.decisao_ia === "aprovado_auto",
    docs_rejeitados_ia:  (d) => d.decisao_ia === "rejeitado_auto",
    docs_aprovados_equipe: (d) => d.status === "aprovado" && d.decisao_ia !== "aprovado_auto",
    docs_rejeitados_equipe: (d) => d.status === "invalido" && d.decisao_ia !== "rejeitado_auto",
    pendencias_criticas: (d) =>
      (d.status === "invalido" && (d.tipo_documento === "cr" || d.tipo_documento === "craf" || d.tipo_documento === "antecedentes_criminais"))
      || d.status === "revisao_humana"
      || d.validacao_ia_status === "erro"
      || d.decisao_ia === "erro",
    confianca_media:     (d) => typeof d.validacao_ia_confianca === "number",
  };
  // Lista padrão (sem KPI ativa): pendentes de ação operacional.
  const SELECTOR_DEFAULT = (d: DocRow) =>
    d.status === "revisao_humana" || d.status === "invalido"
    || d.validacao_ia_status === "revisao_humana" || d.validacao_ia_status === "erro"
    || d.decisao_ia === "erro";

  const docsFiltrados = useMemo(() => {
    const sel = (kpiAtiva && SELECTORS[kpiAtiva]) || SELECTOR_DEFAULT;
    let arr = docs.filter(sel);
    // Ordenação especial para "confiança média": menor score primeiro
    if (kpiAtiva === "confianca_media") {
      arr = [...arr].sort((a, b) =>
        (a.validacao_ia_confianca ?? 1) - (b.validacao_ia_confianca ?? 1));
    }
    // Filtros refinados (aplicáveis a qualquer lista de docs)
    const term = fCliente.trim().toUpperCase();
    return arr.filter(d => {
      if (fTipo !== "todos" && d.tipo_documento !== fTipo) return false;
      if (fScoreBaixo && (typeof d.validacao_ia_confianca !== "number" || d.validacao_ia_confianca >= 0.70)) return false;
      if (term) {
        const hay = `${d.cliente_nome ?? ""} ${d.cliente_doc ?? ""}`.toUpperCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [docs, kpiAtiva, fTipo, fCliente, fScoreBaixo]);

  // Modo de exibição da seção principal — define COLUNAS e DATASET.
  const modo: "docs" | "cadastros_aguardando" | "cadastros_aprov_hoje"
    | "modelos" | "tipos" =
    kpiAtiva === "cadastros_aguardando" ? "cadastros_aguardando"
    : kpiAtiva === "cadastros_aprov_hoje" ? "cadastros_aprov_hoje"
    : kpiAtiva === "modelos_ativos" ? "modelos"
    : kpiAtiva === "tipos_monitorados" ? "tipos"
    : "docs";

  // Mapeamento KPI → título exibido no header da lista
  const KPI_LABEL: Record<string, string> = {
    cadastros_aguardando:    "Cadastros aguardando aprovação",
    cadastros_aprov_hoje:    "Cadastros aprovados hoje",
    docs_analise_humana:     "Documentos em análise humana",
    docs_aprovados_ia:       "Documentos aprovados pela IA",
    docs_rejeitados_ia:      "Documentos rejeitados pela IA",
    docs_aprovados_equipe:   "Documentos aprovados pela Equipe",
    docs_rejeitados_equipe:  "Documentos rejeitados pela Equipe",
    modelos_ativos:          "Modelos de aprendizado ativos",
    tipos_monitorados:       "Tipos documentais monitorados",
    pendencias_criticas:     "Pendências críticas",
    confianca_media:         "Documentos por menor confiança da IA",
  };

  // Tamanho exato da lista exibida (para o título). Cada modo conta o seu.
  const totalLista =
    modo === "cadastros_aguardando" ? cadastrosAguardando.length
    : modo === "cadastros_aprov_hoje" ? cadastrosAprovHoje.length
    : modo === "modelos" ? modelosDetalhe.filter(m => m.ativo).length
    : modo === "tipos" ? configs.length
    : docsFiltrados.length;

  // -------------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------------
  const reprocessar = async (doc: DocRow) => {
    if (!doc.processo_id || !doc.arquivo_storage_key) {
      toast.error("Documento sem processo ou arquivo associado.");
      return;
    }
    setReprocessandoId(doc.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      await supabase.from("qa_processo_documentos").update({
        status: "em_analise", validacao_ia_status: "fila",
        validacao_ia_erro: null, motivo_rejeicao: null,
      }).eq("id", doc.id);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-doc-validar-ia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            processo_id: doc.processo_id,
            documento_id: doc.id,
            storage_path: doc.arquivo_storage_key,
          }),
        },
      );
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Documento reprocessado pela IA.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao reprocessar: " + (e?.message ?? "desconhecido"));
    } finally {
      setReprocessandoId(null);
    }
  };

  const abrirCliente = (clienteId: number | null) => {
    if (!clienteId) return;
    window.open(`/quero-armas/clientes?cliente=${clienteId}`, "_self");
  };
  const abrirProcesso = (processoId: string | null) => {
    if (!processoId) return;
    window.open(`/quero-armas/processos?processo=${processoId}`, "_self");
  };

  // ---------- Ações operacionais (chamam qa-doc-acao-equipe) ----------
  const callAcao = async (doc: DocRow, payload: Record<string, unknown>) => {
    setAcaoLoadingId(doc.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-doc-acao-equipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ documento_id: doc.id, ...payload }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out?.error || `Falha (${r.status})`);
      return out;
    } finally {
      setAcaoLoadingId(null);
    }
  };

  const aprovar = async (doc: DocRow) => {
    try {
      await callAcao(doc, { acao: "aprovar" });
      toast.success("Documento aprovado.");
      await carregar();
    } catch (e: any) { toast.error(e.message || "Falha ao aprovar."); }
  };

  const abrirDocumento = async (doc: DocRow) => {
    try {
      // Preferimos abrir direto pelo storage (download autenticado) — sem
      // expor a URL do Supabase ao usuário. Se não houver storage_key,
      // caímos no signed_url emitido pela edge function e baixamos via fetch.
      const fileName = (doc.arquivo_storage_key || doc.nome_documento || "documento")
        .split("/").pop() || "documento";
      if (doc.arquivo_storage_key) {
        viewer.abrirStorage("qa-processo-docs", doc.arquivo_storage_key, {
          fileName,
          title: doc.nome_documento || fileName,
        });
        return;
      }
      const out = await callAcao(doc, { acao: "signed_url" });
      if (out?.url) {
        viewer.abrirUrl(out.url, { fileName, title: doc.nome_documento || fileName });
      }
    } catch (e: any) { toast.error(e.message || "Falha ao abrir."); }
  };

  const submitModal = async (motivo: string, nomeModelo?: string) => {
    if (!modalAcao) return;
    const { doc, tipo } = modalAcao;
    try {
      if (tipo === "rejeitar") {
        await callAcao(doc, { acao: "rejeitar", motivo });
        toast.success("Documento rejeitado.");
      } else if (tipo === "novo_envio") {
        await callAcao(doc, { acao: "solicitar_novo_envio", motivo });
        toast.success("Novo envio solicitado ao cliente.");
      } else if (tipo === "modelo") {
        await callAcao(doc, { acao: "aprovar_e_modelar", nome_modelo: nomeModelo, observacoes: motivo });
        toast.success("Documento aprovado e usado como modelo.");
      }
      setModalAcao(null);
      await carregar();
    } catch (e: any) { toast.error(e.message || "Falha na ação."); }
  };

  // Aprovação rápida de cadastro público (atalho operacional dentro do drill-down)
  const aprovarCadastro = async (cad: CadastroRow) => {
    setAprovandoCadId(cad.id);
    try {
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({ status: "aprovado", processado_em: new Date().toISOString() })
        .eq("id", cad.id);
      if (error) throw error;
      toast.success("Cadastro aprovado.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao aprovar cadastro: " + (e?.message ?? "desconhecido"));
    } finally {
      setAprovandoCadId(null);
    }
  };

  const abrirCadastro = (cad: CadastroRow) => {
    if (cad.cliente_id_vinculado) {
      abrirCliente(cad.cliente_id_vinculado);
      return;
    }
    // Fallback: abre a aba de homologação se ainda não tem cliente vinculado
    window.open(`/quero-armas/homologacao-clientes?cadastro=${cad.id}`, "_self");
  };

  const abrirDocOrigem = async (modelo: ModeloDetalheRow) => {
    if (!modelo.documento_origem_id) {
      toast.error("Modelo sem documento de origem registrado.");
      return;
    }
    const { data, error } = await supabase
      .from("qa_processo_documentos")
      .select("id, arquivo_storage_key, nome_documento, processo_id, cliente_id")
      .eq("id", modelo.documento_origem_id)
      .maybeSingle();
    if (error || !data?.arquivo_storage_key) {
      toast.error("Documento de origem não encontrado.");
      return;
    }
    const fileName = (data.arquivo_storage_key.split("/").pop()) || "documento";
    viewer.abrirStorage("qa-processo-docs", data.arquivo_storage_key, {
      fileName, title: data.nome_documento || fileName,
    });
  };

  const desativarModelo = async (modelo: ModeloDetalheRow) => {
    if (!confirm("DESATIVAR ESTE MODELO? A IA DEIXARÁ DE USÁ-LO COMO REFERÊNCIA.")) return;
    try {
      const { error } = await supabase
        .from("qa_documentos_modelos_aprovados")
        .update({ ativo: false })
        .eq("id", modelo.id);
      if (error) throw error;
      toast.success("Modelo desativado.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao desativar: " + (e?.message ?? "desconhecido"));
    }
  };

  // -------------------------------------------------------------------------
  return (
    <div className="px-5 md:px-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-900">
            Monitor de Cadastros e Documentos
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Visão da Equipe Quero Armas: validação inteligente, fila de análise humana e base de aprendizado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenConfig(true)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50"
          >
            <SettingsIcon className="h-3 w-3" /> Validação Inteligente
          </button>
          <button
            onClick={carregar}
            disabled={loading}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users}         label="Cadastros aguardando"     value={kpiCadastros.aguardando}    t="yellow"
          active={kpiAtiva === "cadastros_aguardando"} onClick={() => setKpiAtiva(kpiAtiva === "cadastros_aguardando" ? null : "cadastros_aguardando")} />
        <KpiCard icon={ShieldCheck}   label="Cadastros aprovados hoje" value={kpiCadastros.aprovadosHoje} t="green"
          active={kpiAtiva === "cadastros_aprov_hoje"}  onClick={() => setKpiAtiva(kpiAtiva === "cadastros_aprov_hoje"  ? null : "cadastros_aprov_hoje")} />
        <KpiCard icon={ShieldAlert}   label="Docs em análise humana"   value={counters.analiseHumana}     t="yellow"
          active={kpiAtiva === "docs_analise_humana"}   onClick={() => setKpiAtiva(kpiAtiva === "docs_analise_humana"   ? null : "docs_analise_humana")} />
        <KpiCard icon={Bot}           label="Docs aprovados pela IA"   value={counters.aprovadosIA}       t="green"
          active={kpiAtiva === "docs_aprovados_ia"}     onClick={() => setKpiAtiva(kpiAtiva === "docs_aprovados_ia"     ? null : "docs_aprovados_ia")} />
        <KpiCard icon={ShieldX}       label="Docs rejeitados pela IA"  value={counters.rejeitadosIA}      t="red"
          active={kpiAtiva === "docs_rejeitados_ia"}    onClick={() => setKpiAtiva(kpiAtiva === "docs_rejeitados_ia"    ? null : "docs_rejeitados_ia")} />
        <KpiCard icon={ShieldCheck}   label="Aprovados pela Equipe"    value={counters.aprovadosEquipe}   t="green"
          active={kpiAtiva === "docs_aprovados_equipe"} onClick={() => setKpiAtiva(kpiAtiva === "docs_aprovados_equipe" ? null : "docs_aprovados_equipe")} />
        <KpiCard icon={ShieldX}       label="Rejeitados pela Equipe"   value={counters.rejeitadosEquipe}  t="red"
          active={kpiAtiva === "docs_rejeitados_equipe"} onClick={() => setKpiAtiva(kpiAtiva === "docs_rejeitados_equipe" ? null : "docs_rejeitados_equipe")} />
        <KpiCard icon={BookOpen}      label="Modelos de aprendizado"   value={counters.modelosAtivos}     t="blue"
          active={kpiAtiva === "modelos_ativos"}        onClick={() => setKpiAtiva(kpiAtiva === "modelos_ativos"        ? null : "modelos_ativos")} />
        <KpiCard icon={FileText}      label="Tipos monitorados"        value={counters.tiposMonitorados}  t="blue"
          active={kpiAtiva === "tipos_monitorados"}     onClick={() => setKpiAtiva(kpiAtiva === "tipos_monitorados"     ? null : "tipos_monitorados")} />
        <KpiCard icon={AlertTriangle} label="Pendências críticas"      value={counters.criticos}          t="red"
          active={kpiAtiva === "pendencias_criticas"}   onClick={() => setKpiAtiva(kpiAtiva === "pendencias_criticas"   ? null : "pendencias_criticas")} />
        <KpiCard icon={Brain}         label="Confiança média da IA"
          value={counters.comScore ? `${Math.round(counters.confiancaMedia * 100)}%` : 0}
          t={counters.confiancaMedia >= 0.85 ? "green" : counters.confiancaMedia >= 0.6 ? "yellow" : "red"}
          active={kpiAtiva === "confianca_media"}       onClick={() => setKpiAtiva(kpiAtiva === "confianca_media"       ? null : "confianca_media")} />
      </div>

      {/* Lista operacional */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
              {kpiAtiva
                ? <>Exibindo: <span className="text-slate-900">{KPI_LABEL[kpiAtiva]}</span> — <span className="text-slate-500">{totalLista} registro(s)</span></>
                : <>Pendentes de ação <span className="text-slate-400">({totalLista})</span></>
              }
            </h3>
            {kpiAtiva && (
              <button
                onClick={() => setKpiAtiva(null)}
                className="h-7 px-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50"
              >
                <XIcon className="h-3 w-3" /> Limpar filtro
              </button>
            )}
          </div>
          {modo === "docs" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={fTipo} onChange={(e) => setFTipo(e.target.value)}
                className="h-8 px-2 rounded border border-slate-300 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700"
              >
                <option value="todos">Todos os tipos</option>
                {tiposUnicos.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input
                value={fCliente} onChange={(e) => setFCliente(e.target.value)}
                placeholder="CLIENTE / CPF"
                className="h-8 px-2 rounded border border-slate-300 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 w-[180px]"
              />
              <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600">
                <Switch checked={fScoreBaixo} onCheckedChange={setFScoreBaixo} />
                Score baixo
              </label>
            </div>
          )}
        </header>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : totalLista === 0 ? (
          <div className="p-8 text-center text-[11px] uppercase tracking-wider text-slate-400">
            Nenhum registro para o filtro atual.
          </div>
        ) : modo === "cadastros_aguardando" || modo === "cadastros_aprov_hoje" ? (
          <CadastrosTable
            rows={modo === "cadastros_aguardando" ? cadastrosAguardando : cadastrosAprovHoje}
            modo={modo}
            aprovandoId={aprovandoCadId}
            onAprovar={aprovarCadastro}
            onAbrir={abrirCadastro}
          />
        ) : modo === "modelos" ? (
          <ModelosTable
            rows={modelosDetalhe.filter(m => m.ativo)}
            onAbrirOrigem={abrirDocOrigem}
            onDesativar={desativarModelo}
          />
        ) : modo === "tipos" ? (
          <TiposTable rows={configs} onConfigurar={() => setOpenConfig(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Serviço</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Score IA</th>
                  <th className="text-left px-3 py-2">Score Modelo</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Atualizado</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docsFiltrados.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 align-top">
                      <div className="font-bold text-slate-900 uppercase">{d.cliente_nome ?? "—"}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{d.cliente_doc ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 uppercase text-slate-700">{d.servico_nome ?? "—"}</td>
                    <td className="px-3 py-2 uppercase text-slate-700">{d.tipo_documento}</td>
                    <td className="px-3 py-2 space-y-1">
                      <StatusBadge status={d.status} decisaoIA={d.decisao_ia} />
                      {d.usado_como_modelo && (
                        <div><span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold border border-amber-200 bg-amber-50 text-amber-800">
                          <Star className="h-2.5 w-2.5" /> Modelo
                        </span></div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {typeof d.validacao_ia_confianca === "number" ? `${Math.round(d.validacao_ia_confianca * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {typeof d.score_modelo_aprovado === "number" ? `${Math.round(Number(d.score_modelo_aprovado) * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[260px] truncate" title={d.motivo_rejeicao ?? ""}>
                      {d.motivo_rejeicao ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(d.updated_at)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        <button
                          onClick={() => abrirDocumento(d)}
                          disabled={!d.arquivo_storage_key || acaoLoadingId === d.id}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
                          title="Abrir documento (preview)"
                        ><Eye className="h-3 w-3" /> Doc</button>
                        <button
                          onClick={() => abrirProcesso(d.processo_id)}
                          disabled={!d.processo_id}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
                          title="Abrir processo"
                        ><ExternalLink className="h-3 w-3" /> Processo</button>
                        <button
                          onClick={() => abrirCliente(d.cliente_id)}
                          disabled={!d.cliente_id}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          title="Abrir cliente"
                        >Cliente</button>
                        <button
                          onClick={() => reprocessar(d)}
                          disabled={reprocessandoId === d.id || !d.arquivo_storage_key || !d.processo_id}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
                          title="Reprocessar IA"
                        ><RefreshCw className={`h-3 w-3 ${reprocessandoId === d.id ? "animate-spin" : ""}`} /> IA</button>
                        {d.status !== "aprovado" && (
                          <button
                            onClick={() => aprovar(d)}
                            disabled={acaoLoadingId === d.id}
                            className="h-7 px-2 rounded bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1"
                            title="Aprovar manualmente"
                          ><CheckCircle2 className="h-3 w-3" /> Aprovar</button>
                        )}
                        {d.status !== "invalido" && (
                          <button
                            onClick={() => setModalAcao({ doc: d, tipo: "rejeitar" })}
                            disabled={acaoLoadingId === d.id}
                            className="h-7 px-2 rounded bg-rose-600 text-white text-[10px] uppercase font-bold tracking-wider hover:bg-rose-700 disabled:opacity-40 inline-flex items-center gap-1"
                            title="Rejeitar (motivo obrigatório)"
                          ><XCircle className="h-3 w-3" /> Rejeitar</button>
                        )}
                        <button
                          onClick={() => setModalAcao({ doc: d, tipo: "novo_envio" })}
                          disabled={acaoLoadingId === d.id}
                          className="h-7 px-2 rounded bg-amber-600 text-white text-[10px] uppercase font-bold tracking-wider hover:bg-amber-700 disabled:opacity-40 inline-flex items-center gap-1"
                          title="Solicitar novo envio"
                        ><RotateCcw className="h-3 w-3" /> Novo envio</button>
                        {d.status === "aprovado" && !d.usado_como_modelo && (
                          <button
                            onClick={() => setModalAcao({ doc: d, tipo: "modelo" })}
                            disabled={acaoLoadingId === d.id}
                            className="h-7 px-2 rounded bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1"
                            title="Aprovar e usar como modelo"
                          ><Star className="h-3 w-3" /> Modelo</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Base de Documentos Aprovados */}
      <section className="bg-white border border-slate-200 rounded-xl">
        <header className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
            Base de Documentos Aprovados (aprendizado)
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            A IA compara cada novo upload contra estes modelos. Apenas documentos aprovados pela Equipe podem virar modelo.
          </p>
        </header>
        {baseAprendizado.length === 0 ? (
          <div className="p-8 text-center text-[11px] uppercase tracking-wider text-slate-400">
            Nenhum modelo aprovado ainda. Aprove um documento e use o botão "APROVAR COMO MODELO" para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Modelos</th>
                  <th className="text-left px-3 py-2">Última atualização</th>
                  <th className="text-left px-3 py-2">Aprov. auto</th>
                  <th className="text-left px-3 py-2">Análise humana</th>
                  <th className="text-left px-3 py-2">Rejeições</th>
                  <th className="text-left px-3 py-2">Confiança média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baseAprendizado.map(b => {
                  const conf = b.comScore ? b.somaScore / b.comScore : 0;
                  const baixa = b.modelos < 2;
                  return (
                    <tr key={b.tipo} className={baixa ? "bg-amber-50/40" : ""}>
                      <td className="px-3 py-2 uppercase text-slate-800 font-bold">
                        {b.tipo}
                        {baixa && <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">base baixa</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">{b.modelos}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtDate(b.ultima)}</td>
                      <td className="px-3 py-2 font-mono text-emerald-700">{b.auto}</td>
                      <td className="px-3 py-2 font-mono text-amber-700">{b.humana}</td>
                      <td className="px-3 py-2 font-mono text-rose-700">{b.rejeit}</td>
                      <td className="px-3 py-2 font-mono">{b.comScore ? `${Math.round(conf * 100)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de Configuração por tipo */}
      <ConfigDialog
        open={openConfig}
        configs={configs}
        onClose={() => setOpenConfig(false)}
        onSaved={async () => { setOpenConfig(false); await carregar(); }}
      />

      {/* Modal de motivo / nome de modelo */}
      <MotivoDialog
        modal={modalAcao}
        onClose={() => setModalAcao(null)}
        onSubmit={submitModal}
        loading={!!acaoLoadingId}
      />
      <DocumentoViewerModal
        open={viewer.open}
        onClose={viewer.fechar}
        source={viewer.source}
        title={viewer.title}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: motivo da ação manual
// ---------------------------------------------------------------------------
function MotivoDialog({
  modal, onClose, onSubmit, loading,
}: {
  modal: { doc: DocRow; tipo: "rejeitar" | "novo_envio" | "modelo" } | null;
  onClose: () => void;
  onSubmit: (motivo: string, nomeModelo?: string) => Promise<void>;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [nomeModelo, setNomeModelo] = useState("");
  useEffect(() => { if (modal) { setMotivo(""); setNomeModelo(modal.doc.nome_documento ?? modal.doc.tipo_documento); } }, [modal]);
  if (!modal) return null;
  const titulos: Record<string, string> = {
    rejeitar: "REJEITAR DOCUMENTO",
    novo_envio: "SOLICITAR NOVO ENVIO",
    modelo: "APROVAR E USAR COMO MODELO",
  };
  const placeholders: Record<string, string> = {
    rejeitar: "DESCREVA O MOTIVO DA REJEIÇÃO (MÍN. 5 CARACTERES). O CLIENTE VERÁ UMA MENSAGEM SIMPLES NO PORTAL.",
    novo_envio: "DESCREVA O QUE O CLIENTE PRECISA REENVIAR (MÍN. 5 CARACTERES). MENSAGEM SIMPLES SERÁ EXIBIDA NO PORTAL.",
    modelo: "OBSERVAÇÕES OPCIONAIS PARA A BASE DE APRENDIZADO.",
  };
  const exigeMotivo = modal.tipo !== "modelo";
  const valido = exigeMotivo ? motivo.trim().length >= 5 : true;
  return (
    <Dialog open={!!modal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-[13px] uppercase tracking-[0.14em] font-bold text-slate-900">
            {titulos[modal.tipo]}
          </DialogTitle>
        </DialogHeader>
        <div className="text-[11px] text-slate-500 mb-3">
          {modal.doc.cliente_nome ? <><b className="uppercase">{modal.doc.cliente_nome}</b> · </> : null}
          <span className="uppercase">{modal.doc.tipo_documento}</span>
        </div>
        {modal.tipo === "modelo" && (
          <div className="mb-3">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">Nome do modelo</label>
            <Input
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value.toUpperCase())}
              className="h-9 uppercase bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
            />
          </div>
        )}
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={placeholders[modal.tipo]}
          className="min-h-[120px] text-[12px] bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
        />
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={() => onSubmit(motivo.trim(), nomeModelo.trim() || undefined)}
            disabled={loading || !valido}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Aplicando…</> : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Tabelas auxiliares para o drill-down de KPIs
// ---------------------------------------------------------------------------

function fmtServico(c: CadastroRow) {
  return c.servico_fechado_final || c.servico_principal || c.servico_interesse || "—";
}

function CadastrosTable({
  rows, modo, aprovandoId, onAprovar, onAbrir,
}: {
  rows: CadastroRow[];
  modo: "cadastros_aguardando" | "cadastros_aprov_hoje";
  aprovandoId: string | null;
  onAprovar: (c: CadastroRow) => void;
  onAbrir: (c: CadastroRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Nome</th>
            <th className="text-left px-3 py-2">CPF/CNPJ</th>
            <th className="text-left px-3 py-2">Serviço</th>
            <th className="text-left px-3 py-2">Origem</th>
            <th className="text-left px-3 py-2">{modo === "cadastros_aguardando" ? "Recebido em" : "Aprovado em"}</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(c => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-bold text-slate-900 uppercase">{c.nome_completo ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-slate-700">{c.cpf || c.emp_cnpj || "—"}</td>
              <td className="px-3 py-2 uppercase text-slate-700">{fmtServico(c)}</td>
              <td className="px-3 py-2 uppercase text-slate-500">{c.origem_cadastro || "—"}</td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                {fmtDate(modo === "cadastros_aguardando" ? c.created_at : (c.processado_em || c.created_at))}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="inline-flex flex-wrap gap-1 justify-end">
                  <button
                    onClick={() => onAbrir(c)}
                    className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    title={c.cliente_id_vinculado ? "Abrir cliente" : "Abrir homologação"}
                  >
                    <ExternalLink className="h-3 w-3" /> {c.cliente_id_vinculado ? "Cliente" : "Homologar"}
                  </button>
                  {modo === "cadastros_aguardando" && (
                    <button
                      onClick={() => onAprovar(c)}
                      disabled={aprovandoId === c.id}
                      className="h-7 px-2 rounded bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1"
                      title="Aprovar cadastro"
                    >
                      {aprovandoId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Aprovar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelosTable({
  rows, onAbrirOrigem, onDesativar,
}: {
  rows: ModeloDetalheRow[];
  onAbrirOrigem: (m: ModeloDetalheRow) => void;
  onDesativar: (m: ModeloDetalheRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-left px-3 py-2">Nome do modelo</th>
            <th className="text-left px-3 py-2">Doc. de origem</th>
            <th className="text-left px-3 py-2">Aprovado em</th>
            <th className="text-left px-3 py-2">Aprovado por</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(m => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 uppercase text-slate-800 font-bold">{m.tipo_documento}</td>
              <td className="px-3 py-2 uppercase text-slate-700">{m.nome_modelo || "—"}</td>
              <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{m.documento_origem_id ? m.documento_origem_id.slice(0, 8) : "—"}</td>
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(m.aprovado_em)}</td>
              <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{m.aprovado_por ? m.aprovado_por.slice(0, 8) : "—"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="inline-flex flex-wrap gap-1 justify-end">
                  <button
                    onClick={() => onAbrirOrigem(m)}
                    disabled={!m.documento_origem_id}
                    className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
                    title="Abrir documento de origem"
                  ><Eye className="h-3 w-3" /> Doc origem</button>
                  <button
                    onClick={() => onDesativar(m)}
                    className="h-7 px-2 rounded border border-rose-300 bg-white text-[10px] uppercase font-bold tracking-wider text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
                    title="Desativar modelo"
                  ><XIcon className="h-3 w-3" /> Desativar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TiposTable({ rows, onConfigurar }: { rows: ConfigRow[]; onConfigurar: () => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Tipo documental</th>
            <th className="text-left px-3 py-2">Lim. aprov. auto</th>
            <th className="text-left px-3 py-2">Lim. análise humana</th>
            <th className="text-left px-3 py-2">Aprov. auto</th>
            <th className="text-left px-3 py-2">Aprende</th>
            <th className="text-left px-3 py-2">Ativo</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(c => (
            <tr key={c.tipo_documento} className="hover:bg-slate-50">
              <td className="px-3 py-2 uppercase text-slate-800 font-bold">{c.tipo_documento}</td>
              <td className="px-3 py-2 font-mono">{Math.round((c.limite_aprovacao_auto ?? 0) * 100)}%</td>
              <td className="px-3 py-2 font-mono">{Math.round((c.limite_analise_humana ?? 0) * 100)}%</td>
              <td className="px-3 py-2 uppercase text-[10px]">{c.permite_aprovacao_auto ? "SIM" : "NÃO"}</td>
              <td className="px-3 py-2 uppercase text-[10px]">{c.alimenta_aprendizado ? "SIM" : "NÃO"}</td>
              <td className="px-3 py-2 uppercase text-[10px]">{c.ativo === false ? "NÃO" : "SIM"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button
                  onClick={onConfigurar}
                  className="h-7 px-2 rounded border border-slate-300 bg-white text-[10px] uppercase font-bold tracking-wider text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                  title="Abrir configurações"
                ><SettingsIcon className="h-3 w-3" /> Configurar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Configurações por tipo documental
// ---------------------------------------------------------------------------
function ConfigDialog({
  open, onClose, configs, onSaved,
}: { open: boolean; onClose: () => void; configs: ConfigRow[]; onSaved: () => void }) {
  const [local, setLocal] = useState<ConfigRow[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) setLocal(configs.map(c => ({
      ...c,
      campos_obrigatorios_json: Array.isArray(c.campos_obrigatorios_json) ? c.campos_obrigatorios_json : [],
      palavras_chave_esperadas_json: Array.isArray(c.palavras_chave_esperadas_json) ? c.palavras_chave_esperadas_json : [],
    })));
  }, [open, configs]);

  const update = (idx: number, patch: Partial<ConfigRow>) => {
    setLocal(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const c of local) {
        await supabase.from("qa_validacao_config").update({
          limite_aprovacao_auto: Number(c.limite_aprovacao_auto),
          limite_analise_humana: Number(c.limite_analise_humana),
          permite_aprovacao_auto: !!c.permite_aprovacao_auto,
          alimenta_aprendizado: !!c.alimenta_aprendizado,
          ativo: c.ativo !== false,
          campos_obrigatorios_json: c.campos_obrigatorios_json ?? [],
          palavras_chave_esperadas_json: c.palavras_chave_esperadas_json ?? [],
        }).eq("tipo_documento", c.tipo_documento);
      }
      toast.success("Configurações salvas.");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-[13px] uppercase tracking-[0.14em] font-bold text-slate-900">
            Validação Inteligente de Documentos
          </DialogTitle>
        </DialogHeader>
        <div className="text-[11px] text-slate-500 mb-3">
          Defina por tipo documental os limites de aprovação automática, análise humana e se a Equipe Quero Armas precisa revisar sempre.
        </div>

        <div className="space-y-3">
          {local.map((c, idx) => (
            <div key={c.tipo_documento} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-800">
                  {c.tipo_documento}
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600">
                    <Switch checked={c.ativo !== false} onCheckedChange={(v) => update(idx, { ativo: v })} />
                    Ativo
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600">
                    <Switch checked={!!c.permite_aprovacao_auto} onCheckedChange={(v) => update(idx, { permite_aprovacao_auto: v })} />
                    Aprov. auto
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600">
                    <Switch checked={!!c.alimenta_aprendizado} onCheckedChange={(v) => update(idx, { alimenta_aprendizado: v })} />
                    Aprende
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500">Limite aprovação auto</label>
                  <Input type="number" step="0.01" min={0} max={1}
                    value={c.limite_aprovacao_auto}
                    onChange={(e) => update(idx, { limite_aprovacao_auto: Number(e.target.value) })}
                    className="h-8 text-[12px] font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500">Limite análise humana</label>
                  <Input type="number" step="0.01" min={0} max={1}
                    value={c.limite_analise_humana}
                    onChange={(e) => update(idx, { limite_analise_humana: Number(e.target.value) })}
                    className="h-8 text-[12px] font-mono" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500">Palavras-chave esperadas (vírgula)</label>
                  <Input
                    value={(c.palavras_chave_esperadas_json ?? []).join(", ")}
                    onChange={(e) => update(idx, {
                      palavras_chave_esperadas_json: e.target.value.split(",").map(x => x.trim().toUpperCase()).filter(Boolean),
                    })}
                    className="h-8 text-[12px] font-mono uppercase" />
                </div>
              </div>
              {c.observacoes && (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
                  {c.observacoes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="bg-slate-900 hover:bg-slate-800 text-white">
            {salvando ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando…</> : "Salvar configurações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}