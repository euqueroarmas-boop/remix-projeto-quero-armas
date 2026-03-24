import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Search, Users, FileText, ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS = 20;

function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminLeadsProposals() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="leads">
        <TabsList className="mb-4">
          <TabsTrigger value="leads"><Users size={14} className="mr-1" /> Leads</TabsTrigger>
          <TabsTrigger value="proposals"><FileText size={14} className="mr-1" /> Propostas</TabsTrigger>
          <TabsTrigger value="contracts"><FileText size={14} className="mr-1" /> Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="leads"><LeadsList /></TabsContent>
        <TabsContent value="proposals"><ProposalsList /></TabsContent>
        <TabsContent value="contracts"><ContractsList /></TabsContent>
      </Tabs>
    </div>
  );
}

function LeadsList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(page * ITEMS, (page + 1) * ITEMS - 1);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,whatsapp.ilike.%${search}%`);
    const { data: d, count } = await q;
    setData(d || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetch(); }, [fetch]);
  const pages = Math.ceil(total / ITEMS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email, empresa, WhatsApp..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 bg-card" />
        </div>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        <span className="text-sm text-muted-foreground">{total} leads</span>
      </div>

      {loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : data.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhum lead</div> : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Nome</TableHead><TableHead>Empresa</TableHead><TableHead>WhatsApp</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Interesse</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium">{l.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.company || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{l.whatsapp || l.phone || "—"}</TableCell>
                  <TableCell className="text-xs">{l.email}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.lead_status || "—"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{l.service_interest || "—"}</TableCell>
                </TableRow>
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

function ProposalsList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("proposals").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, []);

  return loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : data.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhuma proposta</div> : (
    <div className="rounded-md border border-border overflow-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Data</TableHead><TableHead>Plano</TableHead><TableHead>Qtd</TableHead><TableHead>Unit.</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Validade</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(p.created_at)}</TableCell>
              <TableCell className="text-sm font-medium capitalize">{p.plan}</TableCell>
              <TableCell>{p.computers_qty}</TableCell>
              <TableCell>R$ {p.unit_price}</TableCell>
              <TableCell className="font-bold text-primary">R$ {p.total_value}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{p.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.valid_until}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ContractsList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("contracts").select("*, customers(razao_social, cnpj_ou_cpf, email)").order("created_at", { ascending: false }).limit(50)
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, []);

  return loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : data.length === 0 ? <div className="text-center py-12 text-muted-foreground">Nenhum contrato</div> : (
    <div className="rounded-md border border-border overflow-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Data</TableHead><TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Assinado</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
              <TableCell className="text-sm font-medium">{(c.customers as any)?.razao_social || "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{c.contract_type || "—"}</Badge></TableCell>
              <TableCell className="text-primary font-bold">R$ {c.monthly_value || "—"}</TableCell>
              <TableCell>{c.signed ? <span className="text-emerald-400 text-xs">✓ Sim</span> : <span className="text-muted-foreground text-xs">Não</span>}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{c.status || "—"}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
