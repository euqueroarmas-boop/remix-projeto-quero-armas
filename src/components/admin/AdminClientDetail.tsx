import { useState, useEffect, useCallback } from "react";
import { adminQuery, adminQuerySingle } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { getValidAdminToken } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Edit, FileText, CreditCard, Copy, Send, Ban, CheckCircle, Loader2,
  Save, X, MessageSquare, ExternalLink, RefreshCw, Phone, Mail, Building2, MapPin, User, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminClientDetailProps {
  customerId: string;
  onBack: () => void;
}

export default function AdminClientDetail({ customerId, onBack }: AdminClientDetailProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgType, setMsgType] = useState<"email" | "whatsapp">("whatsapp");
  const [msgText, setMsgText] = useState("");
  const [suspending, setSuspending] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        { table: "customers", select: "*", filters: [{ column: "id", op: "eq", value: customerId }], single: true },
        { table: "contracts", select: "*", filters: [{ column: "customer_id", op: "eq", value: customerId }], order: { column: "created_at", ascending: false } },
      ]);
      const cust = results[0].data as any;
      setCustomer(cust);
      setEditForm(cust || {});
      const ctrs = (results[1].data as any[]) || [];
      setContracts(ctrs);

      // Fetch payments via quote_ids from contracts
      const quoteIds = ctrs.map((c: any) => c.quote_id).filter(Boolean);
      if (quoteIds.length > 0) {
        const payResult = await adminQuerySingle({
          table: "payments",
          select: "*",
          filters: [{ column: "quote_id", op: "in", value: quoteIds }],
          order: { column: "created_at", ascending: false },
        });
        setPayments((payResult.data as any[]) || []);
      }
    } catch (err) {
      console.error("Client detail fetch error:", err);
      toast.error("Erro ao carregar dados do cliente");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          razao_social: editForm.razao_social,
          nome_fantasia: editForm.nome_fantasia,
          cnpj_ou_cpf: editForm.cnpj_ou_cpf,
          email: editForm.email,
          telefone: editForm.telefone,
          responsavel: editForm.responsavel,
          endereco: editForm.endereco,
          cep: editForm.cep,
          cidade: editForm.cidade,
        })
        .eq("id", customerId);
      if (error) throw error;
      toast.success("Cliente atualizado com sucesso");
      setEditing(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const handleSuspend = async (suspend: boolean) => {
    setSuspending(true);
    try {
      const newStatus = suspend ? "suspended" : "active";
      // Update all contracts for this customer
      for (const c of contracts) {
        await supabase.from("contracts").update({ service_status: suspend ? "suspended" : "active" }).eq("id", c.id);
      }
      toast.success(suspend ? "Cliente suspenso" : "Cliente liberado");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro na operação");
    }
    setSuspending(false);
  };

  const openMessage = () => {
    const name = customer?.responsavel || customer?.razao_social || "Cliente";
    const contractInfo = contracts.length > 0
      ? `Contrato: ${contracts[0].contract_type || "N/A"} — Status: ${contracts[0].service_status}`
      : "Sem contrato vinculado";
    setMsgText(`Olá ${name},\n\nSegue atualização referente ao seu cadastro na WMTi.\n\n${contractInfo}\n\nAtenciosamente,\nEquipe WMTi`);
    setMsgOpen(true);
  };

  const sendMessage = () => {
    if (msgType === "whatsapp") {
      const phone = (customer?.telefone || "").replace(/\D/g, "");
      if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msgText)}`;
      window.open(url, "_blank");
    } else {
      const subject = encodeURIComponent("Atualização WMTi");
      const body = encodeURIComponent(msgText);
      window.open(`mailto:${customer?.email}?subject=${subject}&body=${body}`, "_blank");
    }
    setMsgOpen(false);
    toast.success("Mensagem preparada");
  };

  const copyPaymentLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const resendBilling = async (paymentId: string) => {
    toast.info("Funcionalidade de reenvio será conectada ao Asaas em breve.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">Cliente não encontrado</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-4 gap-1"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Button>
      </div>
    );
  }

  const isAnySuspended = contracts.some(c => c.service_status === "suspended");

  const statusLabel = () => {
    if (!contracts.length) return { text: "Lead", color: "bg-muted/50 text-muted-foreground border-border/60" };
    if (isAnySuspended) return { text: "Suspenso", color: "bg-red-500/15 text-red-400 border-red-500/25" };
    const hasPending = payments.some(p => p.payment_status === "PENDING" || p.payment_status === "OVERDUE");
    if (hasPending) return { text: "Inadimplente", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
    return { text: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  };

  const st = statusLabel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground h-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-foreground truncate">{customer.nome_fantasia || customer.razao_social}</h2>
          <p className="text-xs text-muted-foreground">{customer.cnpj_ou_cpf}</p>
        </div>
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border", st.color)}>{st.text}</span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={editing ? "destructive" : "outline"} onClick={() => { setEditing(!editing); setEditForm(customer); }} className="text-xs gap-1.5 h-8">
          {editing ? <><X className="h-3.5 w-3.5" />Cancelar</> : <><Edit className="h-3.5 w-3.5" />Editar</>}
        </Button>
        <Button size="sm" variant="outline" onClick={openMessage} className="text-xs gap-1.5 h-8">
          <MessageSquare className="h-3.5 w-3.5" /> Mensagem
        </Button>
        {isAnySuspended ? (
          <Button size="sm" variant="outline" onClick={() => handleSuspend(false)} disabled={suspending} className="text-xs gap-1.5 h-8 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
            <CheckCircle className="h-3.5 w-3.5" /> Liberar
          </Button>
        ) : contracts.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => handleSuspend(true)} disabled={suspending} className="text-xs gap-1.5 h-8 text-red-400 border-red-500/30 hover:bg-red-500/10">
            <Ban className="h-3.5 w-3.5" /> Suspender
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={fetchAll} className="text-xs gap-1.5 h-8">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Edit form or Data display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-primary" />Dados Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <Field label="Razão Social" value={editForm.razao_social} onChange={v => setEditForm({...editForm, razao_social: v})} />
                <Field label="Nome Fantasia" value={editForm.nome_fantasia || ""} onChange={v => setEditForm({...editForm, nome_fantasia: v})} />
                <Field label="CPF/CNPJ" value={editForm.cnpj_ou_cpf} onChange={v => setEditForm({...editForm, cnpj_ou_cpf: v})} />
                <Field label="Responsável" value={editForm.responsavel} onChange={v => setEditForm({...editForm, responsavel: v})} />
                <Field label="E-mail" value={editForm.email} onChange={v => setEditForm({...editForm, email: v})} />
                <Field label="Telefone" value={editForm.telefone || ""} onChange={v => setEditForm({...editForm, telefone: v})} />
                <Field label="CEP" value={editForm.cep || ""} onChange={v => setEditForm({...editForm, cep: v})} />
                <Field label="Endereço" value={editForm.endereco || ""} onChange={v => setEditForm({...editForm, endereco: v})} />
                <Field label="Cidade" value={editForm.cidade || ""} onChange={v => setEditForm({...editForm, cidade: v})} />
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 mt-2">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <InfoRow icon={Building2} label="Razão Social" value={customer.razao_social} />
                <InfoRow icon={Building2} label="Nome Fantasia" value={customer.nome_fantasia || "—"} />
                <InfoRow icon={User} label="Responsável" value={customer.responsavel} />
                <InfoRow icon={Mail} label="E-mail" value={customer.email} />
                <InfoRow icon={Phone} label="Telefone" value={customer.telefone || "—"} />
                <InfoRow icon={MapPin} label="Endereço" value={customer.endereco || "—"} />
                <InfoRow icon={MapPin} label="Cidade" value={customer.cidade || "—"} />
                <InfoRow icon={MapPin} label="CEP" value={customer.cep || "—"} />
                <InfoRow icon={Calendar} label="Cadastro" value={new Date(customer.created_at).toLocaleDateString("pt-BR")} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Contratos" value={contracts.length} />
              <MiniStat label="Pagamentos" value={payments.length} />
              <MiniStat label="Pendentes" value={payments.filter(p => p.payment_status === "PENDING" || p.payment_status === "OVERDUE").length} color="text-amber-400" />
              <MiniStat label="Confirmados" value={payments.filter(p => p.payment_status === "RECEIVED" || p.payment_status === "CONFIRMED").length} color="text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum contrato vinculado</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Serviço</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(c => (
                    <TableRow key={c.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[11px] text-foreground">{c.contract_type || "—"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                          c.service_status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                          c.service_status === "suspended" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                          "bg-muted/50 text-muted-foreground border-border/60"
                        )}>{c.service_status}</span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.signed ? "Assinado" : "Pendente"}</TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground">{c.monthly_value ? `R$ ${Number(c.monthly_value).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum pagamento encontrado</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Método</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{p.billing_type || p.payment_method || "—"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                          (p.payment_status === "RECEIVED" || p.payment_status === "CONFIRMED") ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                          p.payment_status === "OVERDUE" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                          "bg-amber-500/15 text-amber-400 border-amber-500/25"
                        )}>{p.payment_status || "pending"}</span>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground">{p.amount ? `R$ ${Number(p.amount).toFixed(2)}` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.asaas_invoice_url && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1" onClick={() => copyPaymentLink(p.asaas_invoice_url)}>
                                <Copy className="h-3 w-3" /> Link
                              </Button>
                              <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1">
                                  <ExternalLink className="h-3 w-3" /> Abrir
                                </Button>
                              </a>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1" onClick={() => resendBilling(p.id)}>
                            <Send className="h-3 w-3" /> Reenviar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
            <DialogDescription>Enviar mensagem para {customer.responsavel || customer.razao_social}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Canal</label>
              <Select value={msgType} onValueChange={(v: "email" | "whatsapp") => setMsgType(v)}>
                <SelectTrigger className="bg-muted/30 border-border/50 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Mensagem</label>
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={6} className="bg-muted/30 border-border/50 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setMsgOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={sendMessage} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="bg-muted/30 border-border/50 text-xs h-8" />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs text-foreground truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
      <p className={cn("text-xl font-bold font-mono", color || "text-foreground")}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
