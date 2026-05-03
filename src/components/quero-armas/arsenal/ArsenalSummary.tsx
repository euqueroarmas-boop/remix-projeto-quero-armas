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

export type ArsenalSummaryTarget = "armas" | "municoes" | "crafs" | "cr" | "calibres" | "alertas" | "gte";

// Identificadores fixos exigidos
type KpiId = "armas" | "municoes" | "craf" | "status_cr" | "calibres" | "alertas" | "gte";

const DEFAULT_ORDER: KpiId[] = ["armas", "municoes", "craf", "status_cr", "calibres", "alertas", "gte"];

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
  totalGtes = 0,
  gteStatus = "muted",
  gteHint = "Sem GTE cadastrada",
  crafPending = 0,
  gtePending = 0,
  crUnified = null,
  crafUnified = null,
  gteUnified = null,
  onNavigate,
  clienteId = null,
  dashboardType = "arsenal",
}: Props) {
  const [order, setOrder] = useState<KpiId[]>(DEFAULT_ORDER);
  const [editing, setEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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
    () => ({
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
        hint: totalCalibres > 0 ? `${totalCalibres} calibres` : "Sem estoque",
        tone: "steel",
        target: "municoes",
      },
      craf: {
        id: "craf",
        icon: <FileBadge className="h-4 w-4" />,
        label: "CRAFs",
        value: totalCrafs,
        hint:
          totalCrafs === 0 && crafPending > 0
            ? crafPending === 1
              ? "1 em análise"
              : `${crafPending} em análise`
            : totalCrafs === 0
              ? "Sem CRAFs cadastrados"
              : "Vinculados ao acervo",
        tone:
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
        value: crLabel,
        tone: crStatus === "muted" ? "steel" : crStatus,
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
        hint: alerts === 0 ? "Tudo em dia" : "Vencimentos próximos",
        // Zerado é cinza/neutro (regra global). Com alertas: amarelo/vermelho.
        tone: alerts === 0 ? "steel" : alerts > 2 ? "danger" : "warn",
        target: "alertas",
      },
      gte: {
        id: "gte",
        icon: <ClipboardList className="h-4 w-4" />,
        label: "GTEs",
        value: totalGtes,
        hint:
          totalGtes === 0 && gtePending > 0
            ? gtePending === 1
              ? "1 em análise"
              : `${gtePending} em análise`
            : gteHint,
        // Sem GTE cadastrada → cinza, mesmo se status vier como "ok".
        // Exceção: há GTE/GT enviada pelo cliente aguardando aprovação → âmbar.
        tone:
          totalGtes === 0 && gtePending > 0
            ? "warn"
            : totalGtes === 0 || gteStatus === "muted"
              ? "steel"
              : gteStatus,
        target: "gte",
      },
    }),
    [totalArmas, totalMunicoes, totalCalibres, crStatus, crLabel, totalCrafs, alerts, totalGtes, gteStatus, gteHint, crafPending, gtePending],
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
    </div>
  );
}
