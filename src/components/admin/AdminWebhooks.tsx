import { useState, useCallback, useEffect } from "react";
import { adminQuerySingle } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight, Eye, Webhook } from "lucide-react";

const ITEMS = 20;

export default function AdminWebhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminQuerySingle({
        table: "asaas_webhooks",
        select: "*",
        count: true,
        order: { column: "created_at", ascending: false },
        range: { from: page * ITEMS, to: (page + 1) * ITEMS - 1 },
      });
      setWebhooks((result.data as any[]) || []);
      setTotal(result.count || 0);
    } catch (err) {
      console.error("Webhooks fetch error:", err);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pages = Math.ceil(total / ITEMS);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Webhook size={20} className="text-primary" />
        <h2 className="font-heading font-bold text-lg">Webhooks Asaas</h2>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} webhooks</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum webhook recebido</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead className="w-[100px]">Processado</TableHead>
                <TableHead className="w-[120px]">Payment ID</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((w) => (
                <>
                  <TableRow key={w.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{w.event}</Badge></TableCell>
                    <TableCell>
                      {w.processed ? (
                        <span className="text-emerald-400 text-xs font-medium">✓ OK</span>
                      ) : (
                        <span className="text-yellow-400 text-xs font-medium">Pendente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{w.payload?.payment?.id || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === w.id ? null : w.id)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                  {expanded === w.id && (
                    <TableRow key={`${w.id}-d`}>
                      <TableCell colSpan={5}>
                        <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-60">
                          {JSON.stringify(w.payload, null, 2)}
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
