import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight, Eye, Shield, Search } from "lucide-react";

const ITEMS = 20;

const severityColors: Record<string, string> = {
  info: "bg-slate-600/20 text-slate-400 border-slate-600/30",
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
  const [filterSev, setFilterSev] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("security_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS, (page + 1) * ITEMS - 1);

    if (filterType !== "all") q = q.eq("event_type", filterType);
    if (filterSev !== "all") q = q.eq("severity", filterSev);
    if (search) q = q.ilike("description", `%${search}%`);

    const { data, count } = await q;
    setEvents(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, filterType, filterSev, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const pages = Math.ceil(total / ITEMS);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={20} className="text-primary" />
        <h2 className="font-heading font-bold text-lg">Eventos de Segurança</h2>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="login_success">Login sucesso</SelectItem>
            <SelectItem value="login_failed">Login falho</SelectItem>
            <SelectItem value="brute_force_block">Brute force</SelectItem>
            <SelectItem value="invalid_token">Token inválido</SelectItem>
            <SelectItem value="unauthorized_access">Acesso negado</SelectItem>
            <SelectItem value="webhook_error">Erro webhook</SelectItem>
            <SelectItem value="duplicate_request_blocked">Duplicado</SelectItem>
            <SelectItem value="suspicious_activity">Suspeito</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSev} onValueChange={(v) => { setFilterSev(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 bg-card" />
        </div>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} eventos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum evento</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead className="w-[90px]">Severidade</TableHead>
                <TableHead className="w-[150px]">Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">IP</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <>
                  <TableRow key={ev.id} className={ev.severity === "critical" ? "bg-red-950/20" : ev.severity === "high" ? "bg-orange-950/10" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(ev.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityColors[ev.severity] || severityColors.info}`}>{ev.severity}</span>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{ev.event_type}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{ev.description}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{ev.ip_address || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                  {expanded === ev.id && (
                    <TableRow key={`${ev.id}-d`}>
                      <TableCell colSpan={6}>
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-60">
                          {JSON.stringify({ user_id: ev.user_id, user_agent: ev.user_agent, route: ev.route, request_id: ev.request_id, payload: ev.payload }, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
