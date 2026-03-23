import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search, ChevronLeft, ChevronRight, Eye, User, Building2, Phone, Mail } from "lucide-react";

const ITEMS_PER_PAGE = 20;

export default function AdminLeadsProposals() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    const { data, count } = await query;
    setLeads((data as any[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSelectLead = async (lead: any) => {
    setSelectedLead(lead);
    // Fetch related data: proposals, quotes, contracts, payments
    const events: any[] = [];

    events.push({ type: "lead", title: "Lead capturado", date: lead.created_at, details: `${lead.name} - ${lead.email}` });

    // Proposals
    const { data: proposals } = await supabase.from("proposals" as any).select("*").eq("lead_id", lead.id).order("created_at", { ascending: true });
    (proposals || []).forEach((p: any) => {
      events.push({ type: "proposta", title: `Proposta ${p.plan} - ${p.computers_qty}x R$${p.unit_price}`, date: p.created_at, details: `Total: R$ ${p.total_value}/mês - Status: ${p.status}` });
    });

    // Budget leads with same email
    const { data: budgetLeads } = await supabase.from("budget_leads").select("id").eq("email", lead.email);
    const budgetLeadIds = (budgetLeads || []).map((bl: any) => bl.id);

    if (budgetLeadIds.length > 0) {
      // Quotes
      const { data: quotes } = await supabase.from("quotes").select("*").in("lead_id", budgetLeadIds).order("created_at", { ascending: true });
      (quotes || []).forEach((q: any) => {
        events.push({ type: "orcamento", title: `Orçamento ${q.selected_plan} - R$ ${q.monthly_value}/mês`, date: q.created_at, details: `Status: ${q.status}` });
      });

      const quoteIds = (quotes || []).map((q: any) => q.id);
      if (quoteIds.length > 0) {
        // Contracts
        const { data: contracts } = await supabase.from("contracts").select("*").in("quote_id", quoteIds).order("created_at", { ascending: true });
        (contracts || []).forEach((c: any) => {
          events.push({ type: "contrato", title: `Contrato ${c.contract_type} - ${c.signed ? "Assinado ✓" : "Pendente"}`, date: c.created_at, details: `Status: ${c.status}` });
        });

        // Payments
        const { data: payments } = await supabase.from("payments").select("*").in("quote_id", quoteIds).order("created_at", { ascending: true });
        (payments || []).forEach((p: any) => {
          events.push({ type: "pagamento", title: `Pagamento ${p.billing_type || "—"}`, date: p.created_at, details: `Status: ${p.payment_status} - ID: ${p.asaas_payment_id || "—"}` });
        });
      }
    }

    // Customers with same email
    const { data: customers } = await supabase.from("customers").select("*").eq("email", lead.email);
    (customers || []).forEach((c: any) => {
      events.push({ type: "cliente", title: `Cliente criado: ${c.razao_social}`, date: c.created_at, details: `Portal: ${c.user_id ? "Ativo ✓" : "Sem acesso"}` });
    });

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTimeline(events);
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const typeIcons: Record<string, string> = {
    lead: "👤", proposta: "📋", orcamento: "📊", contrato: "📄", pagamento: "💳", cliente: "🏢",
  };

  if (selectedLead) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedLead(null)}>← Voltar</Button>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-lg text-foreground">{selectedLead.name}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                  {selectedLead.email && <span className="flex items-center gap-1"><Mail size={14} />{selectedLead.email}</span>}
                  {selectedLead.phone && <span className="flex items-center gap-1"><Phone size={14} />{selectedLead.phone}</span>}
                  {selectedLead.company && <span className="flex items-center gap-1"><Building2 size={14} />{selectedLead.company}</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h3 className="font-heading font-bold text-sm text-foreground">Timeline do Cliente</h3>
        <div className="space-y-2">
          {timeline.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
              <span className="text-lg">{typeIcons[ev.type] || "📌"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">{ev.details}</p>
              </div>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(ev.date).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail, empresa, telefone..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 w-80" />
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} leads</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-md border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-[60px]">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-sm text-foreground font-medium">{l.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.phone || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.company || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.source_page || l.service_interest || "—"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleSelectLead(l)}><Eye className="h-4 w-4" /></Button>
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
