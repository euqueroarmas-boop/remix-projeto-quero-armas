import { ReactNode, useEffect, useMemo, useState, useCallback } from "react";
import {
  Crosshair,
  Layers,
  ShieldCheck,
  AlertTriangle,
  FileBadge,
  Boxes,
  ClipboardList,
  ChevronRight,
  GripVertical,
  Settings2,
  RotateCcw,
  Check,
  Files,
  Workflow,
  ShoppingCart,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TACTICAL } from "./utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StatusUnificado, CorStatus } from "@/lib/quero-armas/statusUnificado";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ArsenalSummaryTarget =
  | "armas"
  | "municoes"
  | "crafs"
  | "cr"
  | "calibres"
  | "alertas"
  | "gte"
  | "documentos"
  | "processos"
  | "autorizacoes"
  | "exames";

// Identificadores fixos exigidos
type KpiId = "armas" | "municoes" | "craf" | "status_cr" | "calibres" | "alertas" | "gte";
// KPIs da Linha 2 (recolhível). Não entram no DEFAULT_ORDER persistido para
// manter Zero Regression do layout existente — são renderizados separadamente.
type KpiSecondaryId = "documentos" | "processos" | "autorizacoes" | "exames";

const DEFAULT_ORDER: KpiId[] = ["armas", "municoes", "craf", "status_cr", "calibres", "alertas", "gte"];
const SECONDARY_ORDER: KpiSecondaryId[] = ["documentos", "processos", "autorizacoes", "exames"];

const TARGET_MAP: Record<KpiId, ArsenalSummaryTarget> = {
  armas: "armas",
  municoes: "municoes",
  craf: "crafs",
  status_cr: "cr",
  calibres: "calibres",
  alertas: "alertas",
  gte: "gte",
};

interface Props {
  totalArmas: number;
  totalMunicoes: number;
  totalCalibres: number;
  crStatus: "ok" | "warn" | "danger" | "muted";
  crLabel: string;
  totalCrafs: number;
  alerts: number;
  /** Breakdown opcional do total de alertas para subtítulo coerente. */
  alertasCriticos?: number;
  alertasPreventivos?: number;
  /** Total de GTEs do cliente (concluídas, com leitura ok). */
  totalGtes?: number;
  /** Status visual agregado da GTE: ok/warn/danger/muted. */
  gteStatus?: "ok" | "warn" | "danger" | "muted";
  /** Subtexto dinâmico: "Tudo em dia" / "Próxima do vencimento" / "Vencida" / "Sem GTE cadastrada". */
  gteHint?: string;
  /**
   * Documentos do tipo CRAF aguardando aprovação da equipe.
   * Quando > 0 e ainda não há CRAF canônico, o KPI mostra "EM ANÁLISE" (âmbar).
   */
  crafPending?: number;
  /**
   * Documentos do tipo GTE/GT aguardando aprovação da equipe.
   * Quando > 0 e ainda não há GTE canônica, o KPI mostra "EM ANÁLISE" (âmbar).
   */
  gtePending?: number;
  /**
   * BLOCO 1 — Leitura unificada (Regra-Mãe) opcional para CR/CRAF/GTE.
   * Quando preenchidos, sobrepõem label/hint/tone do KPI correspondente.
   * Quando ausentes/null, mantém-se a leitura legacy (Zero Regression).
   */
  crUnified?: StatusUnificado | null;
  crafUnified?: StatusUnificado | null;
  gteUnified?: StatusUnificado | null;
  /**
   * BLOCO 3 — Status agregado dos alertas globais de vencimento (engine).
   * Quando preenchido, dirige label/hint/cor do KPI "Alertas".
   * Quando null, mantém o comportamento legacy (contagem genérica).
   */
  alertasUnified?: StatusUnificado | null;
  /** BLOCO 2 — KPIs adicionais (Linha 2 recolhível). */
  documentosUnified?: StatusUnificado | null;
  processosUnified?: StatusUnificado | null;
  autorizacoesUnified?: StatusUnificado | null;
  examesUnified?: StatusUnificado | null;
  /** Validade de munições (fab + 60m). Quando preenchido, dirige cor/hint do KPI. */
  municoesUnified?: StatusUnificado | null;
  documentosCount?: number;
  processosCount?: number;
  autorizacoesCount?: number;
  examesCount?: number;
  /**
   * Lista detalhada de exames (psicológico/tiro) para o painel inteligente
   * de exames/laudos. Quando preenchido, ativa exibição de status por exame,
   * próximo vencimento, contagem de dias e drill-down via popover.
   */
  examesDetalhados?: Array<{
    id: string;
    tipo: string | null;
    data_realizacao?: string | null;
    data_vencimento: string | null;
  }>;
  onNavigate?: (target: ArsenalSummaryTarget) => void;
  /** Cliente atual em foco (admin). Permite layouts independentes por cliente, se desejado. */
  clienteId?: number | null;
  /** Tipo da dashboard. Default 'arsenal'. */
  dashboardType?: string;
}

interface KpiDefinition {
  id: KpiId;
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone: "cyan" | "ok" | "warn" | "danger" | "steel";
  target: ArsenalSummaryTarget;
}

/**
 * Definição dos cards da Linha 2 (recolhível).
 * Não compartilha `KpiId` com a Linha 1 — Linha 2 não entra no DnD nem no
 * layout persistido, então usa seu próprio identificador `KpiSecondaryId`.
 */
interface KpiSecondaryDefinition {
  id: KpiSecondaryId;
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone: "cyan" | "ok" | "warn" | "danger" | "steel";
  target: ArsenalSummaryTarget;
}

function toneColor(tone: KpiDefinition["tone"]): string {
  if (tone === "ok") return TACTICAL.ok;
  if (tone === "warn") return TACTICAL.warn;
  if (tone === "danger") return TACTICAL.danger;
  if (tone === "steel") return TACTICAL.steel;
  return TACTICAL.cyan;
}

function KpiCard({
  def,
  editing,
  onClick,
}: {
  def: KpiDefinition;
  editing: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id });
  const color = toneColor(def.tone);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: `inset 0 0 0 1px ${color}10`,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all ${
        editing
          ? "border-dashed border-amber-300 select-none"
          : "border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md"
      } ${isDragging ? "ring-2 ring-amber-400 shadow-lg" : ""}`}
      style={style}
    >
      {/* Drag handle: arrasta direto sem precisar entrar em modo edição */}
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        title="Arraste para reordenar"
        className={`absolute left-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-400 shadow-sm cursor-grab active:cursor-grabbing touch-none ${
          editing ? "opacity-100 border-amber-300 text-amber-700" : "opacity-0 group-hover:opacity-100"
        } transition-opacity`}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Conteúdo clicável (navegação) */}
      <button
        type="button"
        onClick={onClick}
        disabled={editing}
        className="flex h-full w-full flex-col text-left focus:outline-none focus:ring-2 focus:ring-amber-300/50 rounded-xl"
      >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}14`, color }}
        >
          {def.icon}
        </div>
        <div
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em]"
          style={{ background: `${color}10`, color }}
        >
          KPI <ChevronRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div
        className={`mt-3 flex h-7 items-end font-bold text-slate-800 leading-none font-mono w-full truncate whitespace-nowrap ${
          typeof def.value === "string" && def.value.length > 3 ? "text-lg" : "text-2xl"
        }`}
        title={String(def.value)}
      >
        {def.value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {def.label}
      </div>
      <div className="mt-2 min-h-[14px] text-[10px] text-slate-400">{def.hint || ""}</div>
      </button>
    </div>
  );
}

function sanitizeOrder(value: unknown): KpiId[] {
  if (!Array.isArray(value)) return DEFAULT_ORDER;
  const filtered = value.filter((id): id is KpiId =>
    DEFAULT_ORDER.includes(id as KpiId),
  );
  // garante que todos os ids estejam presentes (mesmo que faltem novos)
  for (const id of DEFAULT_ORDER) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  return filtered;
}

export function ArsenalSummary({
  totalArmas,
  totalMunicoes,
  totalCalibres,
  crStatus,
  crLabel,
  totalCrafs,
  alerts,
  alertasCriticos = 0,
  alertasPreventivos = 0,
  totalGtes = 0,
  gteStatus = "muted",
  gteHint = "Sem GTE cadastrada",
  crafPending = 0,
  gtePending = 0,
  crUnified = null,
  crafUnified = null,
  gteUnified = null,
  alertasUnified = null,
  documentosUnified = null,
  processosUnified = null,
  autorizacoesUnified = null,
  examesUnified = null,
  municoesUnified = null,
  documentosCount = 0,
  processosCount = 0,
  autorizacoesCount = 0,
  examesCount = 0,
  examesDetalhados = [],
  onNavigate,
  clienteId = null,
  dashboardType = "arsenal",
}: Props) {
  const [order, setOrder] = useState<KpiId[]>(DEFAULT_ORDER);
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // Toggle local seguro — não persiste (regra do BLOCO 2).
  // KPIs secundárias sempre visíveis — sem recolhimento (decisão UX: nada
  // recolhido no Arsenal do cliente; tudo à mostra para leitura imediata).

  // Estado: existe layout salvo por cliente?
  // Quando true → respeita estritamente a ordem do banco (não força CR primeiro).
  // Quando false → aplica a ordem inteligente padrão (CR primeiro se houver CR).
  const [hasSavedLayout, setHasSavedLayout] = useState(false);

  // Carrega user e preferência salva
  // FONTE DE VERDADE: qa_cliente_kpi_layouts (por cliente_id, compartilhada
  // entre portal do cliente e equipe Quero Armas).
  // FALLBACK: qa_dashboard_kpi_layout (preferência por usuário) — preservada
  // para Zero Regression quando não há cliente_id em foco.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      // 1) Layout COMPARTILHADO por cliente_id (fonte oficial)
      if (clienteId) {
        const { data: shared } = await supabase
          .from("qa_cliente_kpi_layouts")
          .select("ordem_kpis")
          .eq("cliente_id", clienteId)
          .eq("contexto", dashboardType)
          .maybeSingle();
        if (cancelled) return;
        if (shared?.ordem_kpis) {
          setOrder(sanitizeOrder(shared.ordem_kpis));
          setHasSavedLayout(true);
          setLoaded(true);
          return;
        }
      }

      // 2) Sem layout compartilhado → cai para preferência por usuário (legacy)
      if (uid) {
        const query = supabase
          .from("qa_dashboard_kpi_layout")
          .select("kpi_order")
          .eq("user_id", uid)
          .eq("dashboard_type", dashboardType);
        const { data: rows } = clienteId
          ? await query.eq("cliente_id", clienteId).maybeSingle()
          : await query.is("cliente_id", null).maybeSingle();
        if (cancelled) return;
        if (rows?.kpi_order) {
          setOrder(sanitizeOrder(rows.kpi_order));
          setHasSavedLayout(true);
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clienteId, dashboardType]);

  // Realtime: se a equipe alterar no admin, o cliente vê na hora (e vice-versa)
  useEffect(() => {
    if (!clienteId) return;
    const channel = supabase
      .channel(`arsenal_kpi_layout_${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "qa_cliente_kpi_layouts",
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload: any) => {
          const next = (payload.new?.ordem_kpis ?? payload.old?.ordem_kpis) as unknown;
          if (Array.isArray(next)) {
            setOrder(sanitizeOrder(next));
            setHasSavedLayout(true);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId]);

  const persist = useCallback(
    async (next: KpiId[]) => {
      // Persistência primária: por cliente_id (compartilhada cliente↔equipe)
      if (clienteId) {
        setSaving(true);
        try {
          const { error } = await supabase.from("qa_cliente_kpi_layouts").upsert(
            {
              cliente_id: clienteId,
              contexto: dashboardType,
              ordem_kpis: next as unknown as any,
              updated_by: userId,
            },
            { onConflict: "cliente_id,contexto" },
          );
          if (error) {
            console.error("[ArsenalSummary] falha ao salvar ordem KPIs", error);
            toast.error(`Não foi possível salvar a ordem dos KPIs: ${error.message}`);
            return;
          }
          // Só marca como salvo APÓS confirmação do banco — assim a "ordem
          // inteligente padrão" nunca sobrescreve a escolha do usuário.
          setHasSavedLayout(true);
        } finally {
          setSaving(false);
        }
        return;
      }
      // Fallback legacy: preferência por usuário quando não há cliente em foco
      if (!userId) return;
      setSaving(true);
      try {
        const { error } = await supabase.from("qa_dashboard_kpi_layout").upsert(
          {
            user_id: userId,
            cliente_id: null,
            dashboard_type: dashboardType,
            kpi_order: next as unknown as any,
          },
          { onConflict: "user_id,dashboard_type,cliente_id" },
        );
        if (error) {
          console.error("[ArsenalSummary] falha ao salvar ordem KPIs (legacy)", error);
          toast.error(`Não foi possível salvar a ordem dos KPIs: ${error.message}`);
          return;
        }
        setHasSavedLayout(true);
      } finally {
        setSaving(false);
      }
    },
    [userId, clienteId, dashboardType],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const definitions: Record<KpiId, KpiDefinition> = useMemo(
    () => {
      // Mapeia cor canônica da Regra-Mãe → tone do card. Pure helper.
      const corToTone = (cor: CorStatus): KpiDefinition["tone"] => {
        if (cor === "verde") return "ok";
        if (cor === "azul") return "cyan";
        if (cor === "amarelo" || cor === "laranja") return "warn";
        if (cor === "vermelho") return "danger";
        return "steel";
      };
      return ({
      armas: {
        id: "armas",
        icon: <Crosshair className="h-4 w-4" />,
        label: "Armas",
        value: totalArmas,
        hint: totalArmas === 0 ? "Sem armas cadastradas" : "Cadastradas",
        tone: totalArmas === 0 ? "steel" : "cyan",
        target: "armas",
      },
      municoes: {
        id: "municoes",
        icon: <Boxes className="h-4 w-4" />,
        label: "Munições",
        value: totalMunicoes.toLocaleString("pt-BR"),
        hint: municoesUnified
          ? municoesUnified.sub ?? municoesUnified.label
          : totalCalibres > 0 ? `${totalCalibres} calibres` : "Sem estoque",
        tone: municoesUnified ? corToTone(municoesUnified.cor) : "steel",
        target: "municoes",
      },
      craf: {
        id: "craf",
        icon: <FileBadge className="h-4 w-4" />,
        label: "CRAFs",
        value: totalCrafs,
        hint: crafUnified
          ? crafUnified.sub ?? crafUnified.label
          :
          totalCrafs === 0 && crafPending > 0
            ? crafPending === 1
              ? "1 em análise"
              : `${crafPending} em análise`
            : totalCrafs === 0
              ? "Sem CRAFs cadastrados"
              : "Vinculados ao acervo",
        tone: crafUnified
          ? corToTone(crafUnified.cor)
          :
          totalCrafs === 0 && crafPending > 0
            ? "warn"
            : totalCrafs === 0
              ? "steel"
              : "cyan",
        target: "crafs",
      },
      status_cr: {
        id: "status_cr",
        icon: <ShieldCheck className="h-4 w-4" />,
        label: "Status CR",
        value: crUnified ? crUnified.label : crLabel,
        hint: crUnified ? crUnified.sub : undefined,
        tone: crUnified
          ? corToTone(crUnified.cor)
          : (crStatus === "muted" ? "steel" : crStatus),
        target: "cr",
      },
      calibres: {
        id: "calibres",
        icon: <Layers className="h-4 w-4" />,
        label: "Calibres",
        value: totalCalibres,
        hint: totalCalibres === 0 ? "Sem calibres em estoque" : "Diferentes em estoque",
        tone: totalCalibres === 0 ? "steel" : "ok",
        target: "calibres",
      },
      alertas: {
        id: "alertas",
        icon: <AlertTriangle className="h-4 w-4" />,
        label: "Alertas",
        value: alerts,
        hint: (() => {
          if (alerts === 0) return "Tudo em dia";
          const partes: string[] = [];
          if (alertasCriticos > 0) partes.push(`${alertasCriticos} crítico${alertasCriticos > 1 ? "s" : ""}`);
          if (alertasPreventivos > 0) partes.push(`${alertasPreventivos} preventivo${alertasPreventivos > 1 ? "s" : ""}`);
          if (partes.length > 0) return partes.join(" · ");
          return alertasUnified ? alertasUnified.sub ?? alertasUnified.label : "Vencimentos próximos";
        })(),
        // Cor agora dirigida pela engine (vencido→vermelho, vencendo→laranja/amarelo,
        // em dia→verde, sem dado→cinza). Fallback legacy preservado.
        tone: alerts === 0
          ? "steel"
          : alertasCriticos > 0
            ? "danger"
            : alertasPreventivos > 0
              ? "warn"
              : (alertasUnified ? corToTone(alertasUnified.cor) : "warn"),
        target: "alertas",
      },
      gte: {
        id: "gte",
        icon: <ClipboardList className="h-4 w-4" />,
        label: "GTEs",
        value: totalGtes,
        hint: gteUnified
          ? gteUnified.sub ?? gteUnified.label
          :
          totalGtes === 0 && gtePending > 0
            ? gtePending === 1
              ? "1 em análise"
              : `${gtePending} em análise`
            : gteHint,
        // Sem GTE cadastrada → cinza, mesmo se status vier como "ok".
        // Exceção: há GTE/GT enviada pelo cliente aguardando aprovação → âmbar.
        tone: gteUnified
          ? corToTone(gteUnified.cor)
          :
          totalGtes === 0 && gtePending > 0
            ? "warn"
            : totalGtes === 0 || gteStatus === "muted"
              ? "steel"
              : gteStatus,
        target: "gte",
      },
      });
    },
    [totalArmas, totalMunicoes, totalCalibres, crStatus, crLabel, totalCrafs, alerts, alertasCriticos, alertasPreventivos, totalGtes, gteStatus, gteHint, crafPending, gtePending, crUnified, crafUnified, gteUnified, alertasUnified, municoesUnified],
  );

  // Ordem efetiva:
  // - Se já há layout salvo, respeitar EXATAMENTE a ordem persistida
  //   (cliente/equipe pode ter colocado outra KPI antes).
  // - Se não há layout salvo e o cliente possui CR, CR vai para o início
  //   automaticamente (regra inteligente padrão).
  const effectiveOrder = useMemo<KpiId[]>(() => {
    if (hasSavedLayout) return order;
    const hasCr = crStatus !== "muted" && !!crLabel && crLabel.trim().length > 0;
    if (!hasCr) return order;
    if (order[0] === "status_cr") return order;
    return ["status_cr", ...order.filter((id) => id !== "status_cr")];
  }, [order, crStatus, crLabel, hasSavedLayout]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as KpiId);
        const newIndex = prev.indexOf(over.id as KpiId);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        // salvar imediatamente
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleRestore = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    void persist(DEFAULT_ORDER);
  }, [persist]);

  // ── Linha 2 — KPIs adicionais (não sortable, não persistidos) ──────────────
  const corToToneSecondary = (cor: CorStatus): KpiSecondaryDefinition["tone"] => {
    if (cor === "verde") return "ok";
    if (cor === "azul") return "cyan";
    if (cor === "amarelo" || cor === "laranja") return "warn";
    if (cor === "vermelho") return "danger";
    return "steel";
  };

  // ── Analítico inteligente de Exames/Laudos ───────────────────────────────
  // Calcula vigentes / a vencer / vencidos, identifica próximo crítico,
  // dias restantes individuais e tone visual do KPI.
  const examesAnalytics = useMemo(() => {
    const parseDate = (s?: string | null): Date | null => {
      if (!s) return null;
      // ISO ou DD/MM/YYYY
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      }
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
      if (m) {
        const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    type Row = {
      id: string;
      tipo: string;
      tipoLabel: string;
      dataRealizacao: Date | null;
      dataVencimento: Date | null;
      diasRestantes: number | null;
      status: "vigente" | "atencao" | "critico" | "vencido" | "sem_data";
    };
    const rows: Row[] = (examesDetalhados || []).map((e) => {
      const tipo = String(e.tipo || "").toLowerCase();
      const tipoLabel =
        tipo === "psicologico" ? "Psicológico" :
        tipo === "tiro" ? "Exame de Tiro" :
        (e.tipo || "Exame").toString();
      const dv = parseDate(e.data_vencimento);
      const dr = parseDate(e.data_realizacao);
      let diff: number | null = null;
      let status: Row["status"] = "sem_data";
      if (dv) {
        diff = Math.ceil((dv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) status = "vencido";
        else if (diff <= 15) status = "critico";
        else if (diff <= 60) status = "atencao";
        else status = "vigente";
      }
      return { id: e.id, tipo, tipoLabel, dataRealizacao: dr, dataVencimento: dv, diasRestantes: diff, status };
    });
    rows.sort((a, b) => {
      // vencidos primeiro, depois mais próximos do vencimento
      if (a.diasRestantes === null && b.diasRestantes === null) return 0;
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });
    const vigentes = rows.filter((r) => r.status === "vigente").length;
    const aVencer = rows.filter((r) => r.status === "atencao" || r.status === "critico").length;
    const vencidos = rows.filter((r) => r.status === "vencido").length;
    const proximo = rows[0] || null;
    const tone: KpiSecondaryDefinition["tone"] =
      vencidos > 0 ? "danger" :
      rows.some((r) => r.status === "critico") ? "danger" :
      rows.some((r) => r.status === "atencao") ? "warn" :
      rows.length > 0 ? "ok" : "steel";
    return { rows, vigentes, aVencer, vencidos, proximo, tone, total: rows.length };
  }, [examesDetalhados]);

  const examesHint = useMemo(() => {
    const a = examesAnalytics;
    if (a.total === 0) return "Sem exames";
    const partes: string[] = [];
    if (a.vencidos) partes.push(`${a.vencidos} vencido${a.vencidos > 1 ? "s" : ""}`);
    if (a.aVencer) partes.push(`${a.aVencer} a vencer`);
    if (!partes.length && a.vigentes) partes.push(`${a.vigentes} vigente${a.vigentes > 1 ? "s" : ""}`);
    if (a.proximo && a.proximo.diasRestantes !== null) {
      const d = a.proximo.diasRestantes;
      const tipoCurto = a.proximo.tipoLabel.replace("Exame de ", "");
      const cd =
        d < 0 ? `${tipoCurto} VENCIDO há ${Math.abs(d)}d` :
        d === 0 ? `${tipoCurto} vence HOJE` :
        `Próximo: ${tipoCurto} em ${d}d`;
      partes.push(cd);
    }
    return partes.join(" · ");
  }, [examesAnalytics]);

  const secondaryDefs: Record<KpiSecondaryId, KpiSecondaryDefinition> = useMemo(() => ({
    documentos: {
      id: "documentos",
      icon: <Files className="h-4 w-4" />,
      label: "Documentos",
      value: documentosCount,
      hint: documentosUnified
        ? documentosUnified.sub ?? documentosUnified.label
        : documentosCount === 0
          ? "Sem documentos"
          : "No acervo",
      tone: documentosUnified ? corToToneSecondary(documentosUnified.cor) : "steel",
      target: "documentos",
    },
    processos: {
      id: "processos",
      icon: <Workflow className="h-4 w-4" />,
      label: "Processos",
      value: processosCount,
      hint: processosUnified
        ? processosUnified.sub ?? processosUnified.label
        : processosCount === 0
          ? "Sem processos"
          : "Em andamento",
      tone: processosUnified ? corToToneSecondary(processosUnified.cor) : "steel",
      target: "processos",
    },
    autorizacoes: {
      id: "autorizacoes",
      icon: <ShoppingCart className="h-4 w-4" />,
      label: "Autorizações",
      value: autorizacoesCount,
      hint: autorizacoesUnified
        ? autorizacoesUnified.sub ?? autorizacoesUnified.label
        : autorizacoesCount === 0
          ? "Nenhuma solicitada"
          : "De compra",
      tone: autorizacoesUnified ? corToToneSecondary(autorizacoesUnified.cor) : "steel",
      target: "autorizacoes",
    },
    exames: {
      id: "exames",
      icon: <Stethoscope className="h-4 w-4" />,
      label: "Exames/Laudos",
      value: examesCount,
      hint: examesAnalytics.total > 0
        ? examesHint
        : examesUnified
          ? examesUnified.sub ?? examesUnified.label
          : "Sem exames",
      tone: examesAnalytics.total > 0
        ? examesAnalytics.tone
        : (examesUnified ? corToToneSecondary(examesUnified.cor) : "steel"),
      target: "exames",
    },
  }), [
    documentosCount, processosCount, autorizacoesCount, examesCount,
    documentosUnified, processosUnified, autorizacoesUnified, examesUnified,
    examesAnalytics, examesHint,
  ]);

  const hasSecondaryData =
    documentosCount > 0 || processosCount > 0 || autorizacoesCount > 0 || examesCount > 0;

  if (!loaded) {
    // Render padrão sem flicker enquanto carrega
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={handleRestore}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50"
            title="Restaurar ordem padrão"
          >
            <RotateCcw className="h-3 w-3" /> Restaurar padrão
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
            editing
              ? "border-amber-400 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          title={editing ? "Concluir organização" : "Organizar KPIs"}
        >
          {editing ? (
            <>
              <Check className="h-3 w-3" /> {saving ? "Salvando…" : "Concluir"}
            </>
          ) : (
            <>
              <Settings2 className="h-3 w-3" /> Organizar KPIs
            </>
          )}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={effectiveOrder} strategy={rectSortingStrategy}>
          {/*
            Layout responsivo inteligente:
            - Mobile: 2 colunas
            - Tablet (sm): 3 colunas
            - Tablet grande (md): 4 colunas
            - Desktop (lg+): TODAS as KPIs na MESMA LINHA — usa flex com shrink
              para que os cards reduzam de largura proporcionalmente conforme
              entram novas KPIs (ex.: GTE), sem nunca quebrar para a próxima linha.
          */}
          <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:hidden">
            {effectiveOrder.map((id) => {
              const def = definitions[id];
              if (!def) return null;
              return (
                <KpiCard
                  key={id}
                  def={def}
                  editing={editing}
                  onClick={() => onNavigate?.(def.target)}
                />
              );
            })}
          </div>
          <div className="hidden lg:flex lg:flex-nowrap lg:gap-3 lg:items-stretch">
            {effectiveOrder.map((id) => {
              const def = definitions[id];
              if (!def) return null;
              return (
                <div
                  key={id}
                  className="flex-1 min-w-0 basis-0"
                  style={{ minWidth: 0 }}
                >
                  <KpiCard
                    def={def}
                    editing={editing}
                    onClick={() => onNavigate?.(def.target)}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── BLOCO 2 — KPIs adicionais (sempre visíveis) ─────────────────── */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SECONDARY_ORDER.map((sid) => {
            const def = secondaryDefs[sid];
            const color = toneColor(def.tone);
            const cardEl = (
              <div
                key={sid}
                className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ boxShadow: `inset 0 0 0 1px ${color}10` }}
              >
                <button
                  type="button"
                  onClick={() => onNavigate?.(def.target)}
                  className="flex h-full w-full flex-col text-left focus:outline-none focus:ring-2 focus:ring-amber-300/50 rounded-xl"
                >
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
                    style={{ background: color }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: `${color}14`, color }}
                    >
                      {def.icon}
                    </div>
                    {sid === "exames" && examesAnalytics.total > 0 ? (
                      <div
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em]"
                        style={{ background: `${color}10`, color }}
                      >
                        {examesAnalytics.vencidos > 0 ? (
                          <XCircle className="h-3 w-3" />
                        ) : examesAnalytics.aVencer > 0 ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {examesAnalytics.vencidos > 0 ? "Vencido"
                          : examesAnalytics.aVencer > 0 ? "Atenção"
                          : "Em dia"}
                      </div>
                    ) : (
                      <div
                        className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em]"
                        style={{ background: `${color}10`, color }}
                      >
                        KPI
                      </div>
                    )}
                  </div>
                  <div
                    className={`mt-3 flex h-7 items-end font-bold text-slate-800 leading-none font-mono w-full truncate whitespace-nowrap ${
                      typeof def.value === "string" && def.value.length > 3 ? "text-lg" : "text-2xl"
                    }`}
                    title={String(def.value)}
                  >
                    {def.value}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {def.label}
                  </div>
                  <div
                    className="mt-2 min-h-[14px] text-[10px] font-medium leading-tight"
                    style={{ color: sid === "exames" && examesAnalytics.total > 0 ? color : "rgb(148 163 184)" }}
                  >
                    {def.hint || ""}
                  </div>
                </button>
              </div>
            );
            if (sid === "exames" && examesAnalytics.total > 0) {
              return (
                <Popover key={sid}>
                  <PopoverTrigger asChild>
                    <div className="cursor-pointer">{cardEl}</div>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 bg-white border-slate-200" align="end">
                    <div className="p-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-slate-700" />
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
                          Exames / Laudos
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          {examesAnalytics.vigentes} vigente{examesAnalytics.vigentes !== 1 ? "s" : ""}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          {examesAnalytics.aVencer} a vencer
                        </span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                          {examesAnalytics.vencidos} vencido{examesAnalytics.vencidos !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {examesAnalytics.rows.map((r) => {
                        const statusCfg =
                          r.status === "vencido" ? { c: "text-red-700", bg: "bg-red-50", lbl: "VENCIDO", Icon: XCircle } :
                          r.status === "critico" ? { c: "text-red-600", bg: "bg-red-50", lbl: "CRÍTICO", Icon: AlertTriangle } :
                          r.status === "atencao" ? { c: "text-amber-700", bg: "bg-amber-50", lbl: "ATENÇÃO", Icon: AlertTriangle } :
                          r.status === "vigente" ? { c: "text-emerald-700", bg: "bg-emerald-50", lbl: "VIGENTE", Icon: CheckCircle2 } :
                          { c: "text-slate-500", bg: "bg-slate-50", lbl: "SEM DATA", Icon: Clock };
                        const StatusIcon = statusCfg.Icon;
                        const fmt = (d: Date | null) => d ? d.toLocaleDateString("pt-BR") : "—";
                        const diasTxt =
                          r.diasRestantes === null ? "—" :
                          r.diasRestantes < 0 ? `vencido há ${Math.abs(r.diasRestantes)}d` :
                          r.diasRestantes === 0 ? "vence hoje" :
                          `${r.diasRestantes} dias restantes`;
                        return (
                          <div key={r.id} className="px-3 py-2 border-b border-slate-50 last:border-b-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[12px] font-semibold text-slate-800">{r.tipoLabel}</div>
                              <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusCfg.bg} ${statusCfg.c}`}>
                                <StatusIcon className="h-2.5 w-2.5" /> {statusCfg.lbl}
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                              <div>Realização: <span className="font-mono text-slate-700">{fmt(r.dataRealizacao)}</span></div>
                              <div>Vencimento: <span className="font-mono text-slate-700">{fmt(r.dataVencimento)}</span></div>
                            </div>
                            <div className={`mt-0.5 text-[10px] font-bold ${statusCfg.c}`}>{diasTxt}</div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate?.("exames")}
                      className="w-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-50 border-t border-slate-100 inline-flex items-center justify-center gap-1"
                    >
                      Ver aba Exames <ChevronRight className="h-3 w-3" />
                    </button>
                  </PopoverContent>
                </Popover>
              );
            }
            return cardEl;
          })}
        </div>
    </div>
  );
}
