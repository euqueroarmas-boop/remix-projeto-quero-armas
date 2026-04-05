import { useState, useEffect, useCallback } from "react";
import { adminQuery } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { getValidAdminToken } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RefreshCw, Loader2, ChevronLeft, ChevronRight, Copy, ExternalLink,
  FileText, Download, Search, FileCode, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PER_PAGE = 20;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  emitido: { label: "Emitida", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  autorizado: { label: "Autorizada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  sincronizada: { label: "Sincronizada", cls: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
  atualizada: { label: "Atualizada", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  aguardando: { label: "Aguardando", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  criada: { label: "Criada", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  cancelamento_processando: { label: "Cancelando", cls: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  cancelamento_negado: { label: "Cancel. Negado", cls: "bg-rose-500/15 text-rose-400 border-rose-500/25" },
  erro: { label: "Erro", cls: "bg-red-500/15 text-red-400 border-red-500/25" },
  cancelada: { label: "Cancelada", cls: "bg-muted/50 text-muted-foreground border-border/60" },
};

const SOURCE_MAP: Record<string, string> = {
  invoice_event: "Invoice",
  payment_event: "Payment",
  fiscal_info: "FiscalInfo",
  reconcile: "Reconciliação",
  manual: "Manual",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-muted/50 text-muted-foreground border-border/60" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap", s.cls)}>{s.label}</span>;
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

export default function AdminInvoices() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any[] = [];
      if (filterStatus !== "all") filters.push({ column: "status", op: "eq", value: filterStatus });

      const results = await adminQuery([
        {
          table: "fiscal_documents",
          select: "*",
          count: true,
          filters,
          order: { column: "issue_date", ascending: false },
          range: { from: page * PER_PAGE, to: (page + 1) * PER_PAGE - 1 },
        },
        { table: "customers", select: "id, razao_social, nome_fantasia, cnpj_ou_cpf, status_cliente" },
      ]);

      setDocs((results[0].data as any[]) || []);
      setTotal(results[0].count || 0);
      setCustomers((results[1].data as any[]) || []);
    } catch (err) {
      console.error("Invoice fetch error:", err);
    }
    setLoading(false);
  }, [page, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getCustomer = (custId: string) => customers.find(c => c.id === custId);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const token = getValidAdminToken();
      const res = await supabase.functions.invoke("invoice-reconcile", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      toast.success(`Reconciliação concluída: ${data.synced} NFs sincronizadas de ${data.total_checked} pagamentos verificados`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro na reconciliação");
    }
    setReconciling(false);
  };

  // Build LGPD exclusion set
  const lgpdCustomerIds = useMemo(() =>
    new Set(customers.filter((c: any) => c.status_cliente === "excluido_lgpd").map((c: any) => c.id)),
    [customers]
  );

  const filtered = useMemo(() => {
    // First exclude LGPD documents
    let result = docs.filter((d: any) => !lgpdCustomerIds.has(d.customer_id));
    // Then apply status filter
    if (filter !== "todos") {
      result = result.filter((d: any) => (d.status || "").toLowerCase() === filter.toLowerCase());
    }
    // Then apply search filter
    if (filterSearch) {
      result = result.filter((d: any) => {
        const cust = getCustomer(d.customer_id);
        const search = filterSearch.toLowerCase();
        return (
          d.document_number?.toLowerCase().includes(search) ||
          d.asaas_invoice_id?.toLowerCase().includes(search) ||
          cust?.razao_social?.toLowerCase().includes(search) ||
          cust?.cnpj_ou_cpf?.includes(search)
        );
      });
    }
    return result;
  }, [docs, lgpdCustomerIds, filter, filterSearch, customers]);

  const totalPages = Math.ceil(total / PER_PAGE);

  // Stats
  const totalEmitidas = docs.filter(d => d.status === "emitido" || d.status === "autorizado").length;
  const totalPendentes = docs.filter(d => d.status === "aguardando" || d.status === "criada").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Notas Fiscais
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Gestão global de notas fiscais e XMLs emitidos via Asaas</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleReconcile} disabled={reconciling} className="text-xs gap-1.5 h-7">
            {reconciling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reconciliar
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchAll} className="text-xs gap-1.5 h-7">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-lg font-bold font-mono text-foreground">{total}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total NFs</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <p className="text-lg font-bold font-mono text-emerald-400">{totalEmitidas}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Emitidas</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-lg font-bold font-mono text-amber-400">{totalPendentes}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Buscar por cliente, NF, CNPJ..."
            className="pl-8 bg-muted/30 border-border/50 text-xs h-8 text-foreground"
          />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] bg-muted/30 border-border/50 text-xs h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="emitido">Emitidas</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma nota fiscal encontrada</div>
      ) : (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent bg-muted/10">
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Nº NF</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">CNPJ/CPF</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Serviço</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Emissão</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Fonte</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Asaas ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Arquivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => {
                  const cust = getCustomer(doc.customer_id);
                  return (
                    <TableRow key={doc.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[11px] font-mono text-foreground">{doc.document_number || "—"}</TableCell>
                      <TableCell className="text-[11px] text-foreground max-w-[160px] truncate">{cust?.nome_fantasia || cust?.razao_social || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{cust?.cnpj_ou_cpf || "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{doc.service_reference || "—"}</TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground">{doc.amount ? fmt(Number(doc.amount)) : "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{fmtDate(doc.issue_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={doc.status} />
                          {doc.is_active === false && <span className="text-[9px] text-muted-foreground italic">(inativa)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{SOURCE_MAP[doc.last_event_source] || doc.last_event_source || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{doc.asaas_invoice_id?.slice(0, 12) || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1">
                                <Download className="h-3 w-3" /> PDF
                              </Button>
                            </a>
                          )}
                          {doc.xml_url && (
                            <a href={doc.xml_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1">
                                <FileCode className="h-3 w-3" /> XML
                              </Button>
                            </a>
                          )}
                          {!doc.file_url && !doc.xml_url && (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{total} notas fiscais</span>
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
