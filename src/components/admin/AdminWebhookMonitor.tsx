import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { logAdminAudit } from "@/lib/security";

const ITEMS_PER_PAGE = 20;

export default function AdminWebhookMonitor() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("asaas_webhooks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
    setWebhooks((data as any[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleReprocess = async (webhook: any) => {
    setReprocessing(webhook.id);
    try {
      await logAdminAudit({
        action: "reprocess_webhook",
        target_type: "asaas_webhooks",
        target_id: webhook.id,
        before_state: { processed: webhook.processed, event: webhook.event },
      });

      const { error } = await supabase.functions.invoke("asaas-webhook", {
        body: webhook.payload,
      });

      if (error) throw error;

      await logAdminAudit({
        action: "reprocess_webhook_success",
        target_type: "asaas_webhooks",
        target_id: webhook.id,
      });

      fetchWebhooks();
    } catch (err) {
      console.error("[admin] Reprocess failed:", err);
    } finally {
      setReprocessing(null);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchWebhooks}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
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
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[140px]">Payment ID</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh: any) => {
                const paymentId = wh.payload?.payment?.id || "—";
                return (
                  <>
                    <TableRow key={wh.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(wh.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{wh.event}</Badge></TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          wh.processed ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                        }`}>
                          {wh.processed ? "✓ OK" : "Pendente"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{paymentId}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled={reprocessing === wh.id} onClick={() => handleReprocess(wh)}>
                          <RotateCcw className={`h-4 w-4 ${reprocessing === wh.id ? "animate-spin" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === wh.id && (
                      <TableRow key={`${wh.id}-d`}>
                        <TableCell colSpan={5}>
                          <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded overflow-auto max-h-60">
                            {JSON.stringify(wh.payload, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
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
