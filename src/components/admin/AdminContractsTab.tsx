import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 20;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ATIVO: "bg-green-600/20 text-green-400 border-green-600/30",
  INADIMPLENTE: "bg-red-600/20 text-red-400 border-red-600/30",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

export default function AdminContractsTab() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from("contracts")
      .select("*, customers!contracts_customer_id_fkey(razao_social, email, cnpj_ou_cpf)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
    setContracts((data as any[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchContracts}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} contratos</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Assinado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-sm text-foreground">{(c as any).customers?.razao_social || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.contract_type || "—"}</Badge></TableCell>
                  <TableCell className="text-sm text-primary font-medium">R$ {c.monthly_value || "—"}</TableCell>
                  <TableCell>{c.signed ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-muted-foreground text-xs">Não</span>}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusColors[c.status] || statusColors.draft}`}>
                      {c.status || "draft"}
                    </span>
                  </TableCell>
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
