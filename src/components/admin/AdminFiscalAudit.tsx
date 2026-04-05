import { useState, useEffect, useCallback } from "react";
import { adminQuery } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RefreshCw, Loader2, ChevronLeft, ChevronRight, Search,
  Shield, Clock, AlertTriangle, CheckCircle2, XCircle, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PER_PAGE = 25;

const DECISION_MAP: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  accepted: { label: "Aceito", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: CheckCircle2 },
  enriched: { label: "Enriquecido", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: XCircle },
  discarded_temporal: { label: "Descartado (temporal)", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: AlertTriangle },
  blocked_priority: { label: "Bloqueado (prioridade)", cls: "bg-orange-500/15 text-orange-400 border-orange-500/25", icon: Shield },
};

function DecisionBadge({ decision }: { decision: string }) {
  const d = DECISION_MAP[decision] || { label: decision, cls: "bg-muted/50 text-muted-foreground border-border/60", icon: Clock };
  const Icon = d.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap", d.cls)}>
      <Icon className="h-2.5 w-2.5" />{d.label}
    </span>
  );
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return d; }
};

export default function AdminFiscalAudit() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<"events" | "changes">("events");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDecision, setFilterDecision] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "events") {
        const filters: any[] = [];
        if (filterDecision !== "all") filters.push({ column: "overwrite_decision", op: "eq", value: filterDecision });
        if (filterSource !== "all") filters.push({ column: "event_source", op: "eq", value: filterSource });

        const results = await adminQuery([{
          table: "fiscal_event_history",
          select: "*",
          count: true,
          filters,
          order: { column: "created_at", ascending: false },
          range: { from: page * PER_PAGE, to: (page + 1) * PER_PAGE - 1 },
        }]);
        setEvents((results[0].data as any[]) || []);
        setTotal(results[0].count || 0);
      } else {
        const results = await adminQuery([{
          table: "fiscal_change_log",
          select: "*",
          count: true,
          order: { column: "changed_at", ascending: false },
          range: { from: page * PER_PAGE, to: (page + 1) * PER_PAGE - 1 },
        }]);
        setChanges((results[0].data as any[]) || []);
        setTotal(results[0].count || 0);
      }
    } catch (err) {
      console.error("Fiscal audit fetch error:", err);
    }
    setLoading(false);
  }, [page, tab, filterDecision, filterSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PER_PAGE);

  const filteredEvents = filterSearch
    ? events.filter(e => {
        const s = filterSearch.toLowerCase();
        return e.asaas_invoice_id?.toLowerCase().includes(s) ||
          e.event_type?.toLowerCase().includes(s) ||
          e.decision_reason?.toLowerCase().includes(s) ||
          e.customer_id?.toLowerCase().includes(s);
      })
    : events;

  const filteredChanges = filterSearch
    ? changes.filter(c => {
        const s = filterSearch.toLowerCase();
        return c.field_name?.toLowerCase().includes(s) ||
          c.old_value?.toLowerCase().includes(s) ||
          c.new_value?.toLowerCase().includes(s);
      })
    : changes;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Auditoria Fiscal
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Trilha imutável de eventos e alterações em documentos fiscais</p>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData} className="text-xs gap-1.5 h-7">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setTab("events"); setPage(0); }}
          className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", tab === "events" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Eventos ({tab === "events" ? total : "..."})
        </button>
        <button
          onClick={() => { setTab("changes"); setPage(0); }}
          className={cn("px-3 py-1.5 rounded text-xs font-medium transition-colors", tab === "changes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Alterações Sensíveis ({tab === "changes" ? total : "..."})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Buscar por invoice ID, evento, campo..."
            className="pl-8 bg-muted/30 border-border/50 text-xs h-8 text-foreground"
          />
        </div>
        {tab === "events" && (
          <>
            <Select value={filterDecision} onValueChange={v => { setFilterDecision(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] bg-muted/30 border-border/50 text-xs h-8">
                <SelectValue placeholder="Decisão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="accepted">Aceito</SelectItem>
                <SelectItem value="enriched">Enriquecido</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="discarded_temporal">Descartado</SelectItem>
                <SelectItem value="blocked_priority">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] bg-muted/30 border-border/50 text-xs h-8">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="invoice_event">Invoice Event</SelectItem>
                <SelectItem value="payment_event">Payment Event</SelectItem>
                <SelectItem value="reconcile">Reconciliação</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : tab === "events" ? (
        filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum evento fiscal registrado</div>
        ) : (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent bg-muted/10">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Evento</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Origem</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Decisão</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Razão</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Processo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Invoice ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map(ev => (
                    <TableRow key={ev.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{fmtDate(ev.created_at)}</TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground">{ev.event_type}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{ev.event_source}</TableCell>
                      <TableCell className="text-[10px] font-mono text-foreground">{ev.normalized_status || "—"}</TableCell>
                      <TableCell><DecisionBadge decision={ev.overwrite_decision || "unknown"} /></TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">{ev.decision_reason || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{ev.created_by_process || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{ev.asaas_invoice_id?.slice(0, 12) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      ) : (
        filteredChanges.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma alteração sensível registrada</div>
        ) : (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent bg-muted/10">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Campo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor Anterior</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Novo Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Origem</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Processo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Doc ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChanges.map(ch => (
                    <TableRow key={ch.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{fmtDate(ch.changed_at)}</TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground font-medium">{ch.field_name}</TableCell>
                      <TableCell className="text-[10px] font-mono text-red-400 max-w-[120px] truncate">{ch.old_value || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-emerald-400 max-w-[120px] truncate">{ch.new_value || "—"}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{ch.change_source}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{ch.changed_by_process || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{ch.fiscal_document_id?.slice(0, 8) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{total} registros</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 px-2">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
