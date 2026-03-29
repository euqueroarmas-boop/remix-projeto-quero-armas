import { useState, useCallback, useEffect } from "react";
import { adminQuerySingle } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Copy, Check, Eye, ChevronLeft, ChevronRight, Search, AlertTriangle, Pause, Play } from "lucide-react";
import LogFullscreenViewer from "@/components/admin/LogFullscreenViewer";

const ITEMS_PER_PAGE = 20;

type LogRow = {
  id: string;
  tipo: string;
  status: string;
  mensagem: string;
  payload: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "success" ? "bg-green-600/20 text-green-400 border-green-600/30"
    : status === "error" ? "bg-red-600/20 text-red-400 border-red-600/30"
    : status === "warning" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
    : "bg-blue-600/20 text-blue-400 border-blue-600/30";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>{status}</span>;
}

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Copiado!" : label}
    </Button>
  );
}

export default function AdminDiagnostics() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState("error");
  const [filterTipo, setFilterTipo] = useState("all");
  const [searchQuoteId, setSearchQuoteId] = useState("");
  const [viewerLog, setViewerLog] = useState<LogRow | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const filters: any[] = [];
    if (filterStatus !== "all") filters.push({ column: "status", op: "eq", value: filterStatus });
    if (filterTipo !== "all") filters.push({ column: "tipo", op: "eq", value: filterTipo });

    try {
      const result = await adminQuerySingle({
        table: "logs_sistema",
        select: "*",
        count: true,
        filters,
        order: { column: "created_at", ascending: false },
        range: { from: page * ITEMS_PER_PAGE, to: (page + 1) * ITEMS_PER_PAGE - 1 },
      });
      let data = (result.data as LogRow[]) || [];
      if (searchQuoteId.trim()) {
        data = data.filter(l => JSON.stringify(l.payload).includes(searchQuoteId.trim()));
      }
      setLogs(data);
      setTotal(result.count || 0);
    } catch (err) {
      console.error("Diagnostics fetch error:", err);
    }
    setLoading(false);
  }, [page, filterStatus, filterTipo, searchQuoteId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 30s, paused when viewer is open or toggle is off
  useEffect(() => {
    if (!autoRefresh || viewerLog) return;
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, viewerLog, fetchLogs]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="font-bold text-foreground text-sm md:text-base">Diagnóstico do Sistema</h2>
        <span className="text-xs text-muted-foreground ml-auto">{total} registros</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="error">Erros</SelectItem>
            <SelectItem value="warning">Warnings</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(0); }}>
          <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas áreas</SelectItem>
            <SelectItem value="erro">Frontend</SelectItem>
            <SelectItem value="contrato">Contrato/PDF</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="checkout">Checkout</SelectItem>
            <SelectItem value="pagamento">Pagamento</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar por quote_id..."
            value={searchQuoteId}
            onChange={(e) => setSearchQuoteId(e.target.value)}
            className="pl-7 w-44 h-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-xs gap-1"
        >
          {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {autoRefresh ? "Auto" : "Pausado"}
        </Button>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum registro encontrado</div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className={log.status === "error" ? "border-destructive/30" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{log.tipo}</Badge>
                    <StatusBadge status={log.status} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="text-sm text-foreground">{log.mensagem}</p>

                {/* IDs from payload */}
                {log.payload && (
                  <div className="flex flex-wrap gap-1">
                    {(log.payload.quote_id as string) && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">Q: {(log.payload.quote_id as string).slice(0, 8)}</span>
                    )}
                    {(log.payload.contract_id as string) && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">C: {(log.payload.contract_id as string).slice(0, 8)}</span>
                    )}
                    {(log.payload.function_name as string) && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">fn: {log.payload.function_name as string}</span>
                    )}
                    {(log.payload.http_status as number) && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">HTTP {log.payload.http_status as number}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 flex-wrap">
                  <CopyBtn text={JSON.stringify(log.payload, null, 2)} label="Copiar payload" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setViewerLog(log)}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Inspeção completa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Fullscreen Viewer */}
      <LogFullscreenViewer log={viewerLog} onClose={() => setViewerLog(null)} />
    </div>
  );
}
