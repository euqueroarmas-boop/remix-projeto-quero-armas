/**
 * Monitor Operacional de Processos
 * Reflete TODOS os status reais de qa_itens_venda.status (estado atual do serviço).
 *
 * Tempo na etapa = dias desde data_ultima_atualizacao
 *   (fallback: data_protocolo → venda.data_cadastro → venda.created_at)
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock, ArrowUpRight, Search, ChevronRight, Loader2,
  AlertTriangle, CheckCircle2, XCircle, FileWarning, FolderKanban,
  PlayCircle, ListChecks, Hourglass, Archive, Undo2, Ban, Sparkles,
  Pencil, Check, X, Circle, Gavel,
} from "lucide-react";
import { toast } from "sonner";

/* ================================================================
 * Catálogo BASE de status conhecidos (ícone, cor, grupo, ordem).
 * Status novos descobertos em runtime são adicionados automaticamente
 * usando defaults neutros. Ordem aqui define posição dos cards.
 * ================================================================ */

type StatusKey = string; // dinâmico: aceita qualquer status presente no banco

interface StatusMeta {
  key: StatusKey;
  label: string;
  short: string;
  icon: any;
  tone: "amber" | "blue" | "violet" | "slate" | "emerald" | "rose" | "zinc" | "indigo";
  group: "ativo" | "encerrado";
}

/** Normaliza chave canônica: UPPER + trim + colapsa espaços +
 * unifica hífen/en-dash/em-dash em "-" para comparação resiliente. */
function canonical(raw: string): string {
  return (raw || "")
    .toString()
    .normalize("NFC")
    .toUpperCase()
    .replace(/[–—−]/g, "-")        // en-dash, em-dash, minus → hyphen
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS_CATALOG_BASE: StatusMeta[] = [
  { key: "EM ANÁLISE",                          label: "Em Análise",                       short: "Em Análise",          icon: Sparkles,     tone: "indigo",  group: "ativo" },
  { key: "PRONTO PARA ANÁLISE",                 label: "Pronto para Análise",              short: "Pronto p/ Análise",   icon: ListChecks,   tone: "violet",  group: "ativo" },
  { key: "À INICIAR",                           label: "À Iniciar",                        short: "À Iniciar",           icon: PlayCircle,   tone: "blue",    group: "ativo" },
  { key: "À FAZER",                             label: "À Fazer",                          short: "À Fazer",             icon: ListChecks,   tone: "blue",    group: "ativo" },
  { key: "AGUARDANDO DOCUMENTAÇÃO",             label: "Aguardando Documentação",          short: "Aguard. Documentação",icon: FileWarning,  tone: "amber",   group: "ativo" },
  { key: "AGUARDANDO DOCUMENTOS DO CLIENTE",    label: "Aguardando Docs do Cliente",       short: "Aguard. Docs Cliente",icon: FileWarning,  tone: "amber",   group: "ativo" },
  { key: "PASTA FÍSICA - AGUARDANDO LIBERAÇÃO", label: "Pasta Física — Aguard. Liberação", short: "Pasta Física",        icon: FolderKanban, tone: "amber",   group: "ativo" },
  { key: "RECURSO ADMINISTRATIVO",              label: "Recurso Administrativo",           short: "Recurso Adm.",        icon: Gavel,        tone: "violet",  group: "ativo" },
  { key: "DEFERIDO",                            label: "Deferido",                         short: "Deferido",            icon: CheckCircle2, tone: "emerald", group: "encerrado" },
  { key: "CONCLUÍDO",                           label: "Concluído",                        short: "Concluído",           icon: CheckCircle2, tone: "emerald", group: "encerrado" },
  { key: "INDEFERIDO",                          label: "Indeferido",                       short: "Indeferido",          icon: XCircle,      tone: "rose",    group: "encerrado" },
  { key: "DESISTIU",                            label: "Desistiu",                         short: "Desistiu",            icon: Ban,          tone: "zinc",    group: "encerrado" },
  { key: "RESTITUÍDO",                          label: "Restituído",                       short: "Restituído",          icon: Undo2,        tone: "slate",   group: "ativo" },
];

/** Heurística para classificar status DESCONHECIDOS automaticamente.
 *  Palavras-chave de encerramento → grupo "encerrado". Caso contrário "ativo". */
const ENCERRADO_HINTS = ["DEFERIDO", "INDEFERIDO", "CONCLU", "DESIST", "RESTITU", "ENCERR", "ARQUIV", "CANCEL", "FINALIZ"];

function buildAutoMeta(rawKey: string): StatusMeta {
  const key = canonical(rawKey);
  const isEncerrado = ENCERRADO_HINTS.some(h => key.includes(h));
  // Capitaliza para label legível
  const label = key
    .toLowerCase()
    .replace(/(^|\s|-)([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase());
  return {
    key,
    label,
    short: label.length > 22 ? label.slice(0, 20) + "…" : label,
    icon: isEncerrado ? Archive : Circle,
    tone: isEncerrado ? "slate" : "zinc",
    group: isEncerrado ? "encerrado" : "ativo",
  };
}

const TONE_CLASSES: Record<StatusMeta["tone"], { bg: string; border: string; text: string; ring: string; dot: string }> = {
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   ring: "ring-amber-300",   dot: "bg-amber-500" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    ring: "ring-blue-300",    dot: "bg-blue-500" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  ring: "ring-violet-300",  dot: "bg-violet-500" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  ring: "ring-indigo-300",  dot: "bg-indigo-500" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   ring: "ring-slate-300",   dot: "bg-slate-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", ring: "ring-emerald-300", dot: "bg-emerald-500" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    ring: "ring-rose-300",    dot: "bg-rose-500" },
  zinc:    { bg: "bg-zinc-50",    border: "border-zinc-200",    text: "text-zinc-700",    ring: "ring-zinc-300",    dot: "bg-zinc-500" },
};

/** Mapa por chave canônica (resiliente a variações de hífen/espaços). */
const BASE_BY_CANONICAL = new Map<string, StatusMeta>(
  STATUS_CATALOG_BASE.map(s => [canonical(s.key), s])
);

type FilterKey = "todos" | "ativos" | "encerrados" | string;
type SortKey = "tempo_parado" | "recente" | "cliente" | "status" | "servico";

/* ================================================================
 * Tipos
 * ================================================================ */

interface ItemRow {
  id: number;
  venda_id: number;
  servico_id: number | null;
  status: string;
  data_protocolo: string | null;
  data_ultima_atualizacao: string | null;
}
interface VendaRow { id: number; id_legado: number | null; cliente_id: number | null; data_cadastro: string | null; created_at: string | null; }
interface ClienteRow { id: number; id_legado: number | null; nome_completo: string | null; }
interface ServicoRow { id: number; nome_servico: string | null; is_combo?: boolean | null; }

type Entidade = "PF" | "EB";

/** Classifica o serviço pela entidade responsável.
 *  Regra: Posse ou Porte → Polícia Federal. Demais → Exército Brasileiro. */
function classifyEntidade(servicoNome: string): Entidade {
  const n = (servicoNome || "").toLowerCase();
  if (n.includes("posse") || n.includes("porte")) return "PF";
  return "EB";
}

const ENTIDADE_META: Record<Entidade, { label: string; sigla: string; ref: string }> = {
  PF: { label: "Polícia Federal",   sigla: "PF", ref: "ID_ENT: PF-01" },
  EB: { label: "Exército Brasileiro", sigla: "EB", ref: "ID_ENT: EB-04" },
};

interface MonitorRow {
  itemId: number;
  vendaId: number;
  clienteId: number | null;
  clienteNome: string;
  servicoNome: string;
  isCombo: boolean;
  status: StatusKey;
  meta: StatusMeta;
  vendaDate: string | null;
  diasParado: number;
  entidade: Entidade;
}

/** Linha agrupada para exibição: um COMBO por (cliente, status) lista todos os serviços COMBO. */
interface DisplayRow {
  key: string;
  itemIds: number[];
  clienteId: number | null;
  clienteNome: string;
  vendaId: number;
  status: StatusKey;
  meta: StatusMeta;
  vendaDate: string | null;
  diasParado: number;
  isComboGroup: boolean;
  servicoNome: string;
  servicosList: string[];
}

/* ================================================================
 * Helpers
 * ================================================================ */

const todayISO = () => new Date().toISOString().slice(0, 10);

function diffDays(fromISO: string | null): number {
  if (!fromISO) return 0;
  const a = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00" : ""));
  const b = new Date(todayISO() + "T00:00:00");
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

function fmtBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

function urgencyClass(dias: number, encerrado: boolean): string {
  if (encerrado) return "bg-slate-50 text-slate-600 border-slate-200";
  if (dias >= 15) return "bg-rose-50 text-rose-700 border-rose-200";
  if (dias >= 7) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

/* ================================================================
 * Componente
 * ================================================================ */

export default function DashboardProcessosMonitor() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ativos");
  const [sortBy, setSortBy] = useState<SortKey>("tempo_parado");
  const [search, setSearch] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Aplica novo status + data de protocolo nos itens (1 ou N para combo).
   *  Zera o "tempo no status" setando data_ultima_atualizacao = data informada. */
  async function applyStatusChange(itemIds: number[], newStatus: StatusKey, dataProtocolo: string) {
    if (!itemIds.length) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qa_itens_venda" as any)
        .update({
          status: newStatus,
          data_protocolo: dataProtocolo,
          data_ultima_atualizacao: dataProtocolo,
        })
        .in("id", itemIds);
      if (error) throw error;

      setRows(prev => prev.map(r => {
        if (!itemIds.includes(r.itemId)) return r;
        const canon = canonical(newStatus);
        const meta = BASE_BY_CANONICAL.get(canon) || buildAutoMeta(newStatus);
        return {
          ...r,
          status: canon,
          meta,
          diasParado: diffDays(dataProtocolo),
        };
      }));
      setEditingKey(null);
      toast.success(`Status atualizado · ${itemIds.length > 1 ? `${itemIds.length} serviços` : "1 serviço"}`);
    } catch (err: any) {
      console.error("[applyStatusChange] error:", err);
      toast.error("Falha ao atualizar status: " + (err?.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // CARREGA TODOS os itens com status não-nulo — descoberta dinâmica de status novos.
        const { data: itens, error: e1 } = await supabase
          .from("qa_itens_venda" as any)
          .select("id, venda_id, servico_id, status, data_protocolo, data_ultima_atualizacao")
          .not("status", "is", null);
        if (e1) throw e1;

        const itensList = (itens as any[] as ItemRow[]) || [];
        if (!itensList.length) {
          if (mounted) { setRows([]); setLoading(false); }
          return;
        }

        const vendaIds = Array.from(new Set(itensList.map(i => i.venda_id).filter(Boolean)));
        const servicoIds = Array.from(new Set(itensList.map(i => i.servico_id).filter(Boolean) as number[]));

        const [vRes, sRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("id, id_legado, cliente_id, data_cadastro, created_at").in("id_legado", vendaIds),
          servicoIds.length
            ? supabase.from("qa_servicos" as any).select("id, nome_servico, is_combo").in("id", servicoIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const vendas = (vRes.data as any[] as VendaRow[]) || [];
        const clienteFKs = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean) as number[]));
        const cRes = clienteFKs.length
          ? await supabase.from("qa_clientes" as any).select("id, id_legado, nome_completo").or(
              `id_legado.in.(${clienteFKs.join(",")}),id.in.(${clienteFKs.join(",")})`
            )
          : { data: [] as any[] };

        const vendasMap = new Map<number, VendaRow>(
          vendas.map((v) => [typeof v.id_legado === "number" ? v.id_legado : v.id, v])
        );
        const clientesMap = new Map<number, ClienteRow>();
        for (const c of (((cRes.data as any[]) || []) as ClienteRow[])) {
          const fk = (typeof c.id_legado === "number" && Number.isFinite(c.id_legado)) ? c.id_legado : c.id;
          clientesMap.set(fk, c);
        }
        const servicosMap = new Map<number, ServicoRow>(((sRes.data as any[]) || []).map((s: any) => [s.id, s]));

        const built: MonitorRow[] = itensList
          .map((it) => {
            const raw = (it.status || "").trim();
            if (!raw) return null;
            const canon = canonical(raw);
            const meta = BASE_BY_CANONICAL.get(canon) || buildAutoMeta(raw);
            const venda = vendasMap.get(it.venda_id);
            const cliente = venda?.cliente_id ? clientesMap.get(venda.cliente_id) : undefined;
            const servico = it.servico_id ? servicosMap.get(it.servico_id) : undefined;
            const vendaDate = venda?.data_cadastro || (venda?.created_at ? venda.created_at.slice(0, 10) : null);
            const stopRef = it.data_ultima_atualizacao || it.data_protocolo || vendaDate;
            return {
              itemId: it.id,
              vendaId: it.venda_id,
              clienteId: venda?.cliente_id ?? null,
              clienteNome: cliente?.nome_completo || "—",
              servicoNome: servico?.nome_servico || `Serviço #${it.servico_id ?? "?"}`,
              isCombo: !!servico?.is_combo,
              status: canon,
              meta,
              vendaDate,
              diasParado: diffDays(stopRef),
            } as MonitorRow;
          })
          .filter(Boolean) as MonitorRow[];

        if (mounted) setRows(built);
      } catch (err) {
        console.error("[DashboardProcessosMonitor] load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ── Catálogo DINÂMICO: base + qualquer status descoberto nos dados ── */
  const dynamicCatalog = useMemo<StatusMeta[]>(() => {
    const seen = new Map<string, StatusMeta>();
    STATUS_CATALOG_BASE.forEach(s => seen.set(canonical(s.key), s));
    rows.forEach(r => {
      if (!seen.has(r.status)) seen.set(r.status, r.meta);
    });
    return Array.from(seen.values());
  }, [rows]);

  const catalogByKey = useMemo(
    () => new Map<string, StatusMeta>(dynamicCatalog.map(s => [s.key, s])),
    [dynamicCatalog]
  );

  /* ── Contagens por status ── */
  const counts = useMemo(() => {
    const map = new Map<StatusKey, number>();
    dynamicCatalog.forEach(s => map.set(s.key, 0));
    rows.forEach(r => map.set(r.status, (map.get(r.status) || 0) + 1));
    const ativos = dynamicCatalog.filter(s => s.group === "ativo").reduce((sum, s) => sum + (map.get(s.key) || 0), 0);
    const encerrados = dynamicCatalog.filter(s => s.group === "encerrado").reduce((sum, s) => sum + (map.get(s.key) || 0), 0);
    return { byStatus: map, ativos, encerrados, total: rows.length };
  }, [rows, dynamicCatalog]);

  /* ── Lista filtrada + ordenada ── */
  const visible = useMemo(() => {
    let list = rows;
    if (filter === "ativos") list = list.filter(r => r.meta.group === "ativo");
    else if (filter === "encerrados") list = list.filter(r => r.meta.group === "encerrado");
    else if (filter !== "todos") list = list.filter(r => r.status === filter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.clienteNome.toLowerCase().includes(q) ||
        r.servicoNome.toLowerCase().includes(q) ||
        String(r.vendaId).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "recente": return (b.vendaDate || "").localeCompare(a.vendaDate || "");
        case "cliente": return a.clienteNome.localeCompare(b.clienteNome);
        case "status": return a.status.localeCompare(b.status);
        case "servico": return a.servicoNome.localeCompare(b.servicoNome);
        case "tempo_parado":
        default: return b.diasParado - a.diasParado;
      }
    });

    /* ── AGRUPAMENTO COMBO ──
     * Mantém a lógica do card ativo (filtro/status). Para cada chave (cliente+status),
     * se houver múltiplos serviços marcados como COMBO, eles são unificados em uma
     * única linha listando todos os serviços abaixo do nome do cliente.
     * Serviços não-COMBO continuam como linhas individuais (preserva função do card). */
    const groups = new Map<string, MonitorRow[]>();
    const singles: MonitorRow[] = [];
    for (const r of list) {
      if (!r.isCombo) { singles.push(r); continue; }
      const k = `${r.clienteId ?? "x"}|${r.status}`;
      const arr = groups.get(k) || [];
      arr.push(r);
      groups.set(k, arr);
    }
    const display: DisplayRow[] = [];
    for (const r of singles) {
      display.push({
        key: `s-${r.itemId}`,
        itemIds: [r.itemId],
        clienteId: r.clienteId, clienteNome: r.clienteNome,
        vendaId: r.vendaId, status: r.status, meta: r.meta,
        vendaDate: r.vendaDate, diasParado: r.diasParado,
        isComboGroup: false, servicoNome: r.servicoNome, servicosList: [],
      });
    }
    for (const [k, arr] of groups) {
      if (arr.length === 1) {
        const r = arr[0];
        display.push({
          key: `c1-${r.itemId}`,
          itemIds: [r.itemId],
          clienteId: r.clienteId, clienteNome: r.clienteNome,
          vendaId: r.vendaId, status: r.status, meta: r.meta,
          vendaDate: r.vendaDate, diasParado: r.diasParado,
          isComboGroup: false, servicoNome: r.servicoNome, servicosList: [],
        });
      } else {
        const ref = [...arr].sort((a, b) => b.diasParado - a.diasParado)[0];
        display.push({
          key: `cg-${k}`,
          itemIds: arr.map(x => x.itemId),
          clienteId: ref.clienteId, clienteNome: ref.clienteNome,
          vendaId: ref.vendaId, status: ref.status, meta: ref.meta,
          vendaDate: ref.vendaDate, diasParado: ref.diasParado,
          isComboGroup: true,
          servicoNome: `COMBO • ${arr.length} serviços`,
          servicosList: arr.map(x => x.servicoNome),
        });
      }
    }
    return display;
  }, [rows, filter, sortBy, search]);

  if (loading) {
    return (
      <div className="qa-card p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const ativosCatalog = dynamicCatalog.filter(s => s.group === "ativo");
  const encerradosCatalog = dynamicCatalog.filter(s => s.group === "encerrado");

  return (
    <div className="space-y-4">
      {/* Header — mesmo padrão do Monitoramento de Exames */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">MONITOR OPERACIONAL DE PROCESSOS</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Estado atual de cada serviço — clique em um status para filtrar
          </p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[11px] shrink-0">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Ativos: <b className="text-slate-700">{counts.ativos}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Encerrados: <b className="text-slate-700">{counts.encerrados}</b>
          </span>
        </div>
      </div>

      {/* KPIs — Ativos (mesmo visual dos cards de Exames) */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-0.5">Em andamento</div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-slate-100">
            {ativosCatalog.map(s => (
              <StatusKPI
                key={s.key}
                meta={s}
                total={counts.byStatus.get(s.key) || 0}
                active={filter === s.key}
                onClick={() => setFilter(filter === s.key ? "ativos" : s.key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* KPIs — Encerrados (mesmo visual dos cards de Exames) */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-0.5">Encerrados</div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
            {encerradosCatalog.map(s => (
              <StatusKPI
                key={s.key}
                meta={s}
                total={counts.byStatus.get(s.key) || 0}
                active={filter === s.key}
                onClick={() => setFilter(filter === s.key ? "encerrados" : s.key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="qa-card p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")}>Todos ({counts.total})</FilterChip>
            <FilterChip active={filter === "ativos"} onClick={() => setFilter("ativos")}>Ativos ({counts.ativos})</FilterChip>
            <FilterChip active={filter === "encerrados"} onClick={() => setFilter("encerrados")}>Encerrados ({counts.encerrados})</FilterChip>
            {catalogByKey.has(filter as string) && (
              <FilterChip active onClick={() => setFilter("ativos")}>
                {catalogByKey.get(filter as string)!.label} ✕
              </FilterChip>
            )}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, serviço ou nº venda..."
              className="pl-7 pr-3 h-8 w-full md:w-56 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="tempo_parado">Mais tempo no status</option>
            <option value="recente">Mais recente</option>
            <option value="cliente">Cliente (A→Z)</option>
            <option value="status">Status</option>
            <option value="servico">Serviço</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="qa-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-400">
            Nenhum serviço para o filtro selecionado.
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="text-left font-medium px-3 py-2">Cliente</th>
                    <th className="text-left font-medium px-3 py-2">Serviço</th>
                    <th className="text-left font-medium px-3 py-2">Venda</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-left font-medium px-3 py-2">Data venda</th>
                    <th className="text-left font-medium px-3 py-2">Tempo no status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const tone = TONE_CLASSES[r.meta.tone];
                    const encerrado = r.meta.group === "encerrado";
                    return (
                      <tr key={r.key} className={`border-t border-slate-100 hover:bg-slate-50/60 align-top ${r.isComboGroup ? "bg-indigo-50/20" : ""}`}>
                        <td className="px-3 py-2.5 font-medium text-slate-700 align-top">
                          <div className="flex items-center gap-1.5">
                            {r.isComboGroup && <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                            <span className="truncate">{r.clienteNome}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 align-top">
                          {r.isComboGroup ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-100 border border-indigo-200 rounded px-1.5 py-0.5">
                                COMBO · {r.servicosList.length} serviços
                              </span>
                              <ul className="text-[11.5px] text-slate-700 space-y-0.5">
                                {r.servicosList.map((s, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-indigo-400">›</span>
                                    <span>{s.replace(/^COMBO\s*[-–·•]?\s*/i, "")}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <span className="text-[12.5px]">{r.servicoNome}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">#{r.vendaId}</td>
                        <td className="px-3 py-2">
                          {editingKey === r.key ? (
                            <StatusEditor
                              currentStatus={r.status}
                              currentDate={todayISO()}
                              saving={saving}
                              catalog={dynamicCatalog}
                              onCancel={() => setEditingKey(null)}
                              onSave={(s, d) => applyStatusChange(r.itemIds, s, d)}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingKey(r.key)}
                              className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tone.bg} ${tone.text} ${tone.border} hover:ring-2 hover:ring-offset-1 hover:${tone.ring} transition`}
                              title="Clique para alterar o status"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                              {r.meta.label}
                              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 ml-0.5" />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{fmtBR(r.vendaDate)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${urgencyClass(r.diasParado, encerrado)}`}>
                            <Clock className="w-3 h-3" />
                            {r.diasParado}d
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.clienteId && (
                            <Link
                              to={`/quero-armas/clientes?cliente=${r.clienteId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                            >
                              Abrir <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {visible.map((r) => {
                const tone = TONE_CLASSES[r.meta.tone];
                const encerrado = r.meta.group === "encerrado";
                return (
                  <div key={r.key} className={`p-3 ${r.isComboGroup ? "bg-indigo-50/30" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {r.isComboGroup && <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                          <div className="text-[13px] font-semibold text-slate-700 truncate">{r.clienteNome}</div>
                        </div>
                        {r.isComboGroup ? (
                          <div className="mt-1.5 space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-100 border border-indigo-200 rounded px-1.5 py-0.5">
                              COMBO · {r.servicosList.length} serviços
                            </span>
                            <ul className="text-[11px] text-slate-700 space-y-0.5">
                              {r.servicosList.map((s, i) => (
                                <li key={i} className="flex gap-1.5">
                                  <span className="text-indigo-400">›</span>
                                  <span>{s.replace(/^COMBO\s*[-–·•]?\s*/i, "")}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-[11.5px] text-slate-500 truncate mt-0.5">{r.servicoNome}</div>
                        )}
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${urgencyClass(r.diasParado, encerrado)}`}>
                        <Clock className="w-3 h-3" />
                        {r.diasParado}d
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {editingKey === r.key ? (
                        <StatusEditor
                          currentStatus={r.status}
                          currentDate={todayISO()}
                          saving={saving}
                          catalog={dynamicCatalog}
                          onCancel={() => setEditingKey(null)}
                          onSave={(s, d) => applyStatusChange(r.itemIds, s, d)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingKey(r.key)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tone.bg} ${tone.text} ${tone.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                          {r.meta.label}
                          <Pencil className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">#{r.vendaId}</span>
                      <span className="text-[10px] text-slate-400">• {fmtBR(r.vendaDate)}</span>
                    </div>
                    {r.clienteId && (
                      <div className="mt-1.5 flex justify-end">
                        <Link
                          to={`/quero-armas/clientes?cliente=${r.clienteId}`}
                          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600"
                        >
                          Abrir cliente <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
 * UI helpers
 * ================================================================ */

function StatusKPI({
  meta, total, active, onClick,
}: { meta: StatusMeta; total: number; active: boolean; onClick: () => void }) {
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative px-3 py-3 text-left transition-all hover:bg-slate-50 cursor-pointer ${
        active ? `ring-2 ${tone.ring} ring-inset bg-slate-50` : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 line-clamp-1">{meta.short}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`text-2xl font-black ${tone.text}`}>{total}</span>
        <Icon className={`h-3.5 w-3.5 ${tone.text} opacity-60`} />
      </div>
    </button>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ================================================================
 * Editor inline de status + data de protocolo
 * Ao salvar: atualiza status, data_protocolo e zera o "tempo no status"
 * (data_ultima_atualizacao = data informada).
 * ================================================================ */
function StatusEditor({
  currentStatus, currentDate, saving, onCancel, onSave, catalog,
}: {
  currentStatus: StatusKey;
  currentDate: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (newStatus: StatusKey, dataProtocolo: string) => void;
  catalog: StatusMeta[];
}) {
  const [status, setStatus] = useState<StatusKey>(currentStatus);
  const [date, setDate] = useState<string>(currentDate);

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-slate-300 bg-white shadow-sm">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as StatusKey)}
        disabled={saving}
        className="h-7 text-[11px] rounded-md border border-slate-200 bg-white px-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 max-w-[180px]"
      >
        <optgroup label="Em andamento">
          {catalog.filter(s => s.group === "ativo").map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </optgroup>
        <optgroup label="Encerrados">
          {catalog.filter(s => s.group === "encerrado").map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </optgroup>
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={saving}
        title="Data do protocolo (zera o tempo no status)"
        className="h-7 text-[11px] rounded-md border border-slate-200 bg-white px-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <button
        onClick={() => onSave(status, date)}
        disabled={saving || !date}
        className="h-7 inline-flex items-center gap-1 px-2 rounded-md bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Salvar
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="h-7 inline-flex items-center justify-center w-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
        title="Cancelar"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
