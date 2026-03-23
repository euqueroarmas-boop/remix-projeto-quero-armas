import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight, Search } from "lucide-react";

const ITEMS_PER_PAGE = 20;

const severityColors: Record<string, string> = {
  info: "bg-muted text-muted-foreground border-border",
  warning: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  high: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  critical: "bg-red-600/20 text-red-400 border-red-600/30",
};

export default function AdminSecurityEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [search, setSearch] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("security_events" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (filterType !== "all") query = query.eq("event_type", filterType);
    if (filterSeverity !== "all") query = query.eq("severity", filterSeverity);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data, count } = await query;
    setEvents((data as any[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, filterType, filterSeverity, search]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="login_success">Login sucesso</SelectItem>
            <SelectItem value="login_failed">Login falho</SelectItem>
            <SelectItem value="brute_force_block">Brute force</SelectItem>
            <SelectItem value="unauthorized_access">Acesso negado</SelectItem>
            <SelectItem value="webhook_error">Webhook erro</SelectItem>
            <SelectItem value="suspicious_activity">Suspeito</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSeverity} onValueChange={v => { setFilterSeverity(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 w-48" />
        </div>

        <Button variant="outline" size="sm" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} eventos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum evento encontrado</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead className="w-[80px]">Severidade</TableHead>
                <TableHead className="w-[160px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">IP</TableHead>
                <TableHead className="w-[100px]">Rota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev: any) => (
                <TableRow key={ev.id} className={ev.severity === "critical" ? "bg-red-950/20" : ev.severity === "high" ? "bg-orange-950/10" : ""}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityColors[ev.severity] || severityColors.info}`}>
                      {ev.severity}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{ev.event_type}</Badge></TableCell>
                  <TableCell className="text-sm text-foreground max-w-[300px] truncate">{ev.description}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{ev.ip_address || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{ev.route || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
