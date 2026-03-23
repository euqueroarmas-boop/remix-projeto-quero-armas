import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const ITEMS_PER_PAGE = 20;

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("admin_audit_logs" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
    setLogs((data as any[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} registros</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma ação registrada</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead className="w-[60px]">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <>
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{log.action}</Badge></TableCell>
                    <TableCell className="text-sm text-foreground">{log.target_type ? `${log.target_type}: ${log.target_id?.slice(0, 8) || "—"}` : "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-d`}>
                      <TableCell colSpan={4}>
                        <div className="grid grid-cols-2 gap-4">
                          {log.before_state && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Antes:</p>
                              <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(log.before_state, null, 2)}</pre>
                            </div>
                          )}
                          {log.after_state && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Depois:</p>
                              <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(log.after_state, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
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
