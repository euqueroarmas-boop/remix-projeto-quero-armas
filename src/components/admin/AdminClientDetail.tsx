import { useState, useEffect, useCallback } from "react";
import { adminQuery, adminQuerySingle } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { getValidAdminToken } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  KeyRound, Shield, Globe, Clock, Hash, Briefcase, Award, Activity, Eye, Link2, AlertTriangle,
  Trash2, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──
interface AdminClientDetailProps {
  customerId: string;
  onBack: () => void;
}

// ── Helpers ──
const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDateShort = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const copyText = (text: string, label = "Copiado!") => { navigator.clipboard.writeText(text); toast.success(label); };

const SERVICE_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  paid: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  payment_pending: { label: "Pgto Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  payment_under_review: { label: "Em Análise", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  contract_generated: { label: "Contrato Gerado", cls: "bg-muted/50 text-muted-foreground border-border/60" },
  suspended: { label: "Suspenso", cls: "bg-red-500/15 text-red-400 border-red-500/25" },
  overdue: { label: "Inadimplente", cls: "bg-red-500/15 text-red-400 border-red-500/25" },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  RECEIVED: { label: "Recebido", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  CONFIRMED: { label: "Confirmado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  PENDING: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  OVERDUE: { label: "Vencido", cls: "bg-red-500/15 text-red-400 border-red-500/25" },
  REFUNDED: { label: "Estornado", cls: "bg-muted/50 text-muted-foreground border-border/60" },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const s = map[status] || { label: status, cls: "bg-muted/50 text-muted-foreground border-border/60" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap", s.cls)}>{s.label}</span>;
}

// ── Main Component ──
export default function AdminClientDetail({ customerId, onBack }: AdminClientDetailProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [fiscalDocs, setFiscalDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgType, setMsgType] = useState<"email" | "whatsapp">("whatsapp");
  const [msgText, setMsgText] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [lgpdOpen, setLgpdOpen] = useState(false);
  const [lgpdReason, setLgpdReason] = useState("");
  const [lgpdConfirm, setLgpdConfirm] = useState("");
  const [lgpdLoading, setLgpdLoading] = useState(false);
  const [lgpdResult, setLgpdResult] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        { table: "customers", select: "*", filters: [{ column: "id", op: "eq", value: customerId }], single: true },
        { table: "contracts", select: "*", filters: [{ column: "customer_id", op: "eq", value: customerId }], order: { column: "created_at", ascending: false } },
        { table: "proposals", select: "*", filters: [{ column: "customer_id", op: "eq", value: customerId }], order: { column: "created_at", ascending: false } },
        { table: "client_events", select: "*", filters: [{ column: "customer_id", op: "eq", value: customerId }], order: { column: "created_at", ascending: false }, limit: 50 },
        { table: "admin_audit_logs", select: "*", filters: [{ column: "target_id", op: "eq", value: customerId }], order: { column: "created_at", ascending: false }, limit: 20 },
        { table: "fiscal_documents", select: "*", filters: [{ column: "customer_id", op: "eq", value: customerId }], order: { column: "issue_date", ascending: false } },
      ]);
      const cust = results[0].data as any;
      setCustomer(cust);
      setEditForm(cust || {});
      const ctrs = (results[1].data as any[]) || [];
      setContracts(ctrs);
      setProposals((results[2].data as any[]) || []);
      setEvents((results[3].data as any[]) || []);
      setAuditLogs((results[4].data as any[]) || []);
      setFiscalDocs((results[5].data as any[]) || []);

      // Fetch payments via quote_ids
      const quoteIds = ctrs.map((c: any) => c.quote_id).filter(Boolean);
      if (quoteIds.length > 0) {
        const [payResult, quoteResult] = await Promise.all([
          adminQuerySingle({ table: "payments", select: "*", filters: [{ column: "quote_id", op: "in", value: quoteIds }], order: { column: "created_at", ascending: false } }),
          adminQuerySingle({ table: "quotes", select: "*, leads(*)", filters: [{ column: "id", op: "in", value: quoteIds }], order: { column: "created_at", ascending: false } }),
        ]);
        setPayments((payResult.data as any[]) || []);
        const qs = (quoteResult.data as any[]) || [];
        setQuotes(qs);
        // Extract leads
        const linkedLeads = qs.map((q: any) => q.leads).filter(Boolean);
        setLeads(linkedLeads);
      }
    } catch (err) {
      console.error("Client detail fetch error:", err);
      toast.error("Erro ao carregar dados do cliente");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Actions ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("customers").update({
        razao_social: editForm.razao_social,
        nome_fantasia: editForm.nome_fantasia,
        cnpj_ou_cpf: editForm.cnpj_ou_cpf,
        email: editForm.email,
        telefone: editForm.telefone,
        responsavel: editForm.responsavel,
        endereco: editForm.endereco,
        cep: editForm.cep,
        cidade: editForm.cidade,
      }).eq("id", customerId);
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
      const newStatus = suspend ? "suspenso" : "ativo";
      // Update customer status_cliente
      await supabase.from("customers").update({
        status_cliente: newStatus,
        ...(suspend ? { suspended_at: new Date().toISOString() } : { suspended_at: null }),
      }).eq("id", customerId);
      // Also update contracts
      for (const c of contracts) {
        await supabase.from("contracts").update({ service_status: suspend ? "suspended" : "active" }).eq("id", c.id);
      }
      // Log
      await supabase.from("client_events").insert({
        customer_id: customerId,
        event_type: suspend ? "suspensao" : "reativacao",
        title: suspend ? "Cliente suspenso" : "Cliente reativado",
        description: `Status alterado para ${newStatus} via admin`,
      });
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
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msgText)}`, "_blank");
    } else {
      window.open(`mailto:${customer?.email}?subject=${encodeURIComponent("Atualização WMTi")}&body=${encodeURIComponent(msgText)}`, "_blank");
    }
    setMsgOpen(false);
    toast.success("Mensagem preparada");
  };

  const handleResetPassword = async () => {
    setResetPwdLoading(true);
    try {
      const token = getValidAdminToken();
      const res = await supabase.functions.invoke("create-client-user", {
        body: { action: "reset_password", customer_id: customerId, email: customer?.email, user_password: newPwd || undefined },
        headers: token ? { "x-admin-token": token } : {},
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao redefinir senha");
        setResetPwdLoading(false);
        return;
      }
      setGeneratedPwd(newPwd || res.data?.temp_password || "");
      toast.success("Senha redefinida com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
    setResetPwdLoading(false);
  };

  const handleLgpdDelete = async () => {
    if (lgpdConfirm !== "EXCLUIR LGPD") return;
    setLgpdLoading(true);
    try {
      const token = getValidAdminToken();
      const res = await supabase.functions.invoke("lgpd-delete", {
        body: { customer_id: customerId, reason: lgpdReason || "Solicitação do titular" },
        headers: token ? { "x-admin-token": token } : {},
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro na exclusão LGPD");
        setLgpdLoading(false);
        return;
      }
      setLgpdResult(res.data);
      toast.success("Exclusão LGPD concluída com sucesso");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro na exclusão LGPD");
    }
    setLgpdLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">Cliente não encontrado</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-4 gap-1"><ArrowLeft className="h-3.5 w-3.5" />Voltar</Button>
      </div>
    );
  }

  // ── LGPD-deleted client: show minimal view ──
  if (customer.status_cliente === "excluido_lgpd") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground h-8 shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <ShieldAlert className="h-6 w-6 text-red-400" />
                <h1 className="text-xl font-bold text-foreground">Cliente Excluído — LGPD</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-red-500/25 bg-red-500/15 text-red-400">
                  <Trash2 className="h-3 w-3" /> Excluído LGPD
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Os dados pessoais deste cliente foram permanentemente excluídos/anonimizados em conformidade com a LGPD. 
                Apenas o lastro mínimo necessário para rastreabilidade contratual e financeira foi preservado.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">ID Interno</span>
                  <span className="font-mono text-foreground">{customer.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Data de Cadastro</span>
                  <span className="text-foreground">{fmtDate(customer.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Contratos Vinculados</span>
                  <span className="text-foreground">{contracts.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Data da Exclusão</span>
                  <span className="text-foreground">{customer.suspended_at ? fmtDate(customer.suspended_at) : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Minimal financial traceability */}
        {contracts.length > 0 && (
          <SectionCard icon={FileText} title="Lastro Contratual Mínimo">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">ID</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Criação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(c => (
                    <TableRow key={c.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="text-[10px] font-mono text-muted-foreground">{c.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.contract_type || "—"}</TableCell>
                      <TableCell className="text-[11px] font-mono text-foreground">{c.monthly_value ? fmt(Number(c.monthly_value)) : "—"}</TableCell>
                      <TableCell><StatusBadge status={c.service_status} map={SERVICE_STATUS_MAP} /></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono">{fmtDate(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
        {/* Timeline */}
        <SectionCard icon={Activity} title="Histórico de Auditoria">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
          ) : (
            <div className="relative pl-4 border-l border-border/30 space-y-3 max-h-[300px] overflow-y-auto">
              {events.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20).map((e: any, i: number) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-border bg-card" />
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground font-medium">{e.title}</p>
                      {e.description && <p className="text-[10px] text-muted-foreground truncate">{e.description}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap shrink-0">{fmtDate(e.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  const isAnySuspended = customer?.status_cliente === "suspenso" || contracts.some(c => c.service_status === "suspended");
  const bestContract = contracts[0];
  const bestProposal = proposals[0];
  const bestQuote = quotes[0];
  const bestLead = leads[0];
  const pendingPayments = payments.filter(p => p.payment_status === "PENDING" || p.payment_status === "pending" || p.payment_status === "OVERDUE");
  const confirmedPayments = payments.filter(p => p.payment_status === "RECEIVED" || p.payment_status === "CONFIRMED");
  const totalContracted = contracts.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);
  const lastPayment = confirmedPayments[0];
  const nextDue = pendingPayments.find(p => p.due_date);

  const globalStatus = (() => {
    const cs = customer?.status_cliente;
    if (cs === "suspenso") return { text: "Suspenso", cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: Ban };
    if (cs === "cancelado") return { text: "Cancelado", cls: "bg-muted/50 text-muted-foreground border-border/60", icon: Ban };
    if (cs === "inadimplente") return { text: "Inadimplente", cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: AlertTriangle };
    if (cs === "aguardando_ativacao") return { text: "Aguardando", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: Clock };
    if (!contracts.length) return { text: "Lead", cls: "bg-muted/50 text-muted-foreground border-border/60", icon: Globe };
    if (isAnySuspended) return { text: "Suspenso", cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: Ban };
    if (pendingPayments.some(p => p.payment_status === "OVERDUE")) return { text: "Inadimplente", cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: AlertTriangle };
    if (pendingPayments.length > 0) return { text: "Pgto Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: Clock };
    if (contracts.some(c => c.service_status === "active" || c.service_status === "paid")) return { text: "Ativo", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: CheckCircle };
    return { text: "Aguardando", cls: "bg-muted/50 text-muted-foreground border-border/60", icon: Clock };
  })();

  return (
    <div className="space-y-5">
      {/* ═══════════════════ EXECUTIVE HEADER ═══════════════════ */}
      <div className="rounded-xl border border-border/40 bg-card/80 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground h-8 shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-foreground truncate">{customer.razao_social}</h1>
              <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border", globalStatus.cls)}>
                <globalStatus.icon className="h-3 w-3" /> {globalStatus.text}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{customer.cnpj_ou_cpf}</span>
              <span>•</span>
              <span>{customer.email}</span>
              {customer.telefone && <><span>•</span><span>{customer.telefone}</span></>}
              <span>•</span>
              <span>Cadastro: {fmtDate(customer.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/30">
          <Button size="sm" variant={editing ? "destructive" : "outline"} onClick={() => { setEditing(!editing); setEditForm(customer); }} className="text-xs gap-1.5 h-7">
            {editing ? <><X className="h-3 w-3" />Cancelar</> : <><Edit className="h-3 w-3" />Editar</>}
          </Button>
          <Button size="sm" variant="outline" onClick={openMessage} className="text-xs gap-1.5 h-7"><MessageSquare className="h-3 w-3" />Mensagem</Button>
          {isAnySuspended ? (
            <Button size="sm" variant="outline" onClick={() => handleSuspend(false)} disabled={suspending} className="text-xs gap-1.5 h-7 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              <CheckCircle className="h-3 w-3" />Liberar
            </Button>
          ) : contracts.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => handleSuspend(true)} disabled={suspending} className="text-xs gap-1.5 h-7 text-red-400 border-red-500/30 hover:bg-red-500/10">
              <Ban className="h-3 w-3" />Suspender
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => { setResetPwdOpen(true); setNewPwd(""); setGeneratedPwd(""); }} className="text-xs gap-1.5 h-7 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
            <KeyRound className="h-3 w-3" />Resetar Senha
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchAll} className="text-xs gap-1.5 h-7"><RefreshCw className="h-3 w-3" />Atualizar</Button>
          <Button size="sm" variant="ghost" onClick={() => copyText(`${customer.razao_social}\n${customer.cnpj_ou_cpf}\n${customer.email}\n${customer.telefone || ""}`, "Dados copiados!")} className="text-xs gap-1.5 h-7"><Copy className="h-3 w-3" />Copiar Dados</Button>
          <Button size="sm" variant="outline" onClick={() => { setLgpdOpen(true); setLgpdConfirm(""); setLgpdReason(""); setLgpdResult(null); }} className="text-xs gap-1.5 h-7 text-red-400 border-red-500/30 hover:bg-red-500/10 ml-auto">
            <Trash2 className="h-3 w-3" />Exclusão LGPD
          </Button>
        </div>
      </div>

      {/* ═══════════════════ MAIN GRID ═══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ─── CARD: IDENTIFICAÇÃO DA EMPRESA ─── */}
        <SectionCard icon={Building2} title="Identificação da Empresa">
          {editing ? (
            <div className="space-y-3">
              <Field label="Razão Social" value={editForm.razao_social} onChange={v => setEditForm({ ...editForm, razao_social: v })} />
              <Field label="Nome Fantasia" value={editForm.nome_fantasia || ""} onChange={v => setEditForm({ ...editForm, nome_fantasia: v })} />
              <Field label="CPF/CNPJ" value={editForm.cnpj_ou_cpf} onChange={v => setEditForm({ ...editForm, cnpj_ou_cpf: v })} />
              <Field label="CEP" value={editForm.cep || ""} onChange={v => setEditForm({ ...editForm, cep: v })} />
              <Field label="Endereço" value={editForm.endereco || ""} onChange={v => setEditForm({ ...editForm, endereco: v })} />
              <Field label="Cidade" value={editForm.cidade || ""} onChange={v => setEditForm({ ...editForm, cidade: v })} />
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 mt-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <InfoRow icon={Building2} label="Razão Social" value={customer.razao_social} />
              <InfoRow icon={Building2} label="Nome Fantasia" value={customer.nome_fantasia || "—"} />
              <InfoRow icon={Hash} label="CNPJ/CPF" value={customer.cnpj_ou_cpf} copyable />
              <InfoRow icon={MapPin} label="Endereço" value={customer.endereco || "—"} />
              <InfoRow icon={MapPin} label="Cidade" value={customer.cidade || "—"} />
              <InfoRow icon={MapPin} label="CEP" value={customer.cep || "—"} />
              <InfoRow icon={Calendar} label="Cadastro" value={fmtDate(customer.created_at)} />
              <InfoRow icon={Globe} label="Origem" value={bestLead?.source_page || "Manual"} />
            </div>
          )}
        </SectionCard>

        {/* ─── CARD: RESPONSÁVEL / CONTATO ─── */}
        <SectionCard icon={User} title="Responsável / Contato Principal">
          {editing ? (
            <div className="space-y-3">
              <Field label="Responsável" value={editForm.responsavel} onChange={v => setEditForm({ ...editForm, responsavel: v })} />
              <Field label="E-mail" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} />
              <Field label="Telefone / WhatsApp" value={editForm.telefone || ""} onChange={v => setEditForm({ ...editForm, telefone: v })} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <InfoRow icon={User} label="Responsável" value={customer.responsavel} />
              <InfoRow icon={Mail} label="E-mail" value={customer.email} copyable />
              <InfoRow icon={Phone} label="WhatsApp / Telefone" value={customer.telefone || "—"} copyable />
              {customer.telefone && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => {
                    const phone = (customer.telefone || "").replace(/\D/g, "");
                    window.open(`https://wa.me/55${phone}`, "_blank");
                  }}>
                    <MessageSquare className="h-3 w-3" /> Abrir WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => copyText(customer.telefone)}>
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
              )}
              <div className="border-t border-border/20 mt-3 pt-3 space-y-1.5">
                <InfoRow icon={Shield} label="Acesso Portal" value={customer.user_id ? "✓ Ativo" : "Sem acesso"} />
                {customer.user_id && <InfoRow icon={Hash} label="User ID" value={customer.user_id} copyable />}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ─── CARD: CONTRATAÇÃO / PLANO ─── */}
        <SectionCard icon={Briefcase} title="Contratação / Plano">
          {bestContract ? (
            <div className="space-y-1.5">
              <InfoRow icon={FileText} label="Tipo" value={bestContract.contract_type || "—"} />
              <InfoRow icon={Activity} label="Status" value="" custom={<StatusBadge status={bestContract.service_status} map={SERVICE_STATUS_MAP} />} />
              <InfoRow icon={Award} label="Plano" value={bestQuote?.selected_plan || bestProposal?.plan || "—"} />
              <InfoRow icon={Calendar} label="Prazo" value={bestProposal?.contract_months ? `${bestProposal.contract_months} meses` : "—"} />
              <InfoRow icon={CreditCard} label="Valor Mensal" value={bestContract.monthly_value ? fmt(Number(bestContract.monthly_value)) : "—"} />
              {bestProposal?.total_value && <InfoRow icon={CreditCard} label="Valor Total" value={fmt(Number(bestProposal.total_value))} />}
              <InfoRow icon={CheckCircle} label="Assinatura" value={bestContract.signed ? `Assinado em ${bestContract.signed_at ? fmtDate(bestContract.signed_at) : "—"}` : "Pendente"} />
              {bestContract.activated_at && <InfoRow icon={Activity} label="Ativação" value={fmtDate(bestContract.activated_at)} />}
              {bestContract.contract_pdf_path && (
                <div className="pt-2">
                  <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => window.open(bestContract.contract_pdf_path, "_blank")}>
                    <Eye className="h-3 w-3" /> Ver Contrato PDF
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum contrato vinculado</p>
          )}
        </SectionCard>

        {/* ─── CARD: FINANCEIRO ─── */}
        <SectionCard icon={CreditCard} title="Financeiro">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <MiniStat label="Contratos" value={contracts.length} />
            <MiniStat label="Cobranças" value={payments.length} />
            <MiniStat label="Pendentes" value={pendingPayments.length} color="text-amber-400" />
            <MiniStat label="Confirmados" value={confirmedPayments.length} color="text-emerald-400" />
          </div>
          <div className="space-y-1.5">
            <InfoRow icon={CreditCard} label="MRR" value={totalContracted ? fmt(totalContracted) : "—"} />
            <InfoRow icon={Calendar} label="Último Pgto" value={lastPayment ? `${fmtDateShort(lastPayment.created_at)} — ${fmt(Number(lastPayment.amount || 0))}` : "—"} />
            <InfoRow icon={Clock} label="Próx. Venc." value={nextDue?.due_date ? fmtDateShort(nextDue.due_date) : "—"} />
            <InfoRow icon={CreditCard} label="Método" value={payments[0]?.billing_type || payments[0]?.payment_method || "—"} />
            {payments[0]?.asaas_payment_id && <InfoRow icon={Link2} label="Asaas Payment" value={payments[0].asaas_payment_id} copyable />}
          </div>
        </SectionCard>

        {/* ─── CARD: DADOS DO CHECKOUT ─── */}
        <SectionCard icon={Globe} title="Dados Capturados no Checkout">
          {bestLead ? (
            <div className="space-y-1.5">
              <InfoRow icon={User} label="Nome" value={bestLead.name} />
              <InfoRow icon={Building2} label="Empresa" value={bestLead.company || "—"} />
              <InfoRow icon={Mail} label="E-mail" value={bestLead.email} />
              <InfoRow icon={Phone} label="WhatsApp" value={bestLead.whatsapp || bestLead.phone || "—"} />
              <InfoRow icon={Briefcase} label="Interesse" value={bestLead.service_interest || "—"} />
              <InfoRow icon={Globe} label="Página" value={bestLead.source_page || "—"} />
              <InfoRow icon={Activity} label="UTM Source" value={bestLead.utm_source || "—"} />
              <InfoRow icon={Activity} label="UTM Medium" value={bestLead.utm_medium || "—"} />
              <InfoRow icon={Activity} label="UTM Campaign" value={bestLead.utm_campaign || "—"} />
              {bestLead.message && <InfoRow icon={MessageSquare} label="Mensagem" value={bestLead.message} />}
              <InfoRow icon={Calendar} label="Data Lead" value={fmtDate(bestLead.created_at)} />
            </div>
          ) : bestQuote ? (
            <div className="space-y-1.5">
              <InfoRow icon={Award} label="Plano" value={bestQuote.selected_plan || "—"} />
              <InfoRow icon={CreditCard} label="Valor Orçado" value={bestQuote.monthly_value ? fmt(Number(bestQuote.monthly_value)) : "—"} />
              <InfoRow icon={Calendar} label="Data" value={fmtDate(bestQuote.created_at)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum dado de checkout encontrado</p>
          )}
          {bestContract?.client_ip && <InfoRow icon={Globe} label="IP" value={bestContract.client_ip} />}
        </SectionCard>

        {/* ─── CARD: ACESSO AO PORTAL ─── */}
        <SectionCard icon={Shield} title="Acesso ao Portal">
          <div className="space-y-1.5">
            <InfoRow icon={Shield} label="Status" value={customer.user_id ? "✓ Conta ativa" : "✗ Sem conta"} />
            <InfoRow icon={Mail} label="Login E-mail" value={customer.user_id ? customer.email : "—"} />
            <InfoRow icon={Hash} label="Login CNPJ/CPF" value={customer.user_id ? "Habilitado" : "—"} />
            {customer.user_id && <InfoRow icon={Hash} label="Auth User ID" value={customer.user_id} copyable />}
            <InfoRow icon={Building2} label="Empresa Vinculada" value={customer.user_id ? "✓ Sim" : "✗ Não"} />
          </div>
        </SectionCard>
      </div>

      {/* ═══════════════════ CONTRACTS TABLE ═══════════════════ */}
      {contracts.length > 0 && (
        <SectionCard icon={FileText} title={`Contratos (${contracts.length})`}>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Assinatura</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Quote ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Criação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(c => (
                  <TableRow key={c.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="text-[11px] text-foreground">{c.contract_type || "—"}</TableCell>
                    <TableCell><StatusBadge status={c.service_status} map={SERVICE_STATUS_MAP} /></TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{c.signed ? `✓ ${c.signed_at ? fmtDateShort(c.signed_at) : "Sim"}` : "Pendente"}</TableCell>
                    <TableCell className="text-[11px] font-mono text-foreground">{c.monthly_value ? fmt(Number(c.monthly_value)) : "—"}</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">{c.quote_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono">{fmtDate(c.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {/* ═══════════════════ PAYMENTS TABLE ═══════════════════ */}
      {payments.length > 0 && (
        <SectionCard icon={CreditCard} title={`Pagamentos (${payments.length})`}>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Data</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Método</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Vencimento</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Asaas ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="text-[11px] text-muted-foreground font-mono">{fmtDate(p.created_at)}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{p.billing_type || p.payment_method || "—"}</TableCell>
                    <TableCell><StatusBadge status={p.payment_status || "pending"} map={PAYMENT_STATUS_MAP} /></TableCell>
                    <TableCell className="text-[11px] font-mono text-foreground">{p.amount ? fmt(Number(p.amount)) : "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono">{p.due_date ? fmtDateShort(p.due_date) : "—"}</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">{p.asaas_payment_id?.slice(0, 12) || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.asaas_invoice_url && (
                          <>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1" onClick={() => copyText(p.asaas_invoice_url, "Link copiado!")}>
                              <Copy className="h-3 w-3" /> Link
                            </Button>
                            <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1"><ExternalLink className="h-3 w-3" /> Abrir</Button>
                            </a>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {/* ═══════════════════ FISCAL DOCUMENTS ═══════════════════ */}
      {fiscalDocs.length > 0 && (
        <SectionCard icon={FileText} title={`Notas Fiscais (${fiscalDocs.length})`}>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Nº NF</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Emissão</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Serviço</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Arquivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiscalDocs.map((d: any) => (
                  <TableRow key={d.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="text-[11px] font-mono text-foreground">{d.document_number || "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono">{fmtDateShort(d.issue_date)}</TableCell>
                    <TableCell className="text-[11px] font-mono text-foreground">{d.amount ? fmt(Number(d.amount)) : "—"}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap",
                        d.status === "emitido" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                        d.status === "aguardando" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                        "bg-muted/50 text-muted-foreground border-border/60"
                      )}>{d.status || "—"}</span>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{d.service_reference || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.file_url && (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1"><ExternalLink className="h-3 w-3" /> PDF</Button>
                          </a>
                        )}
                        {d.xml_url && (
                          <a href={d.xml_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1"><ExternalLink className="h-3 w-3" /> XML</Button>
                          </a>
                        )}
                        {!d.file_url && !d.xml_url && <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {/* ═══════════════════ TIMELINE ═══════════════════ */}
      <SectionCard icon={Activity} title="Timeline do Cliente">
        {events.length === 0 && auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
        ) : (
          <div className="relative pl-4 border-l border-border/30 space-y-3 max-h-[400px] overflow-y-auto">
            {[
              ...events.map((e: any) => ({ type: "event", at: e.created_at, title: e.title, desc: e.description, kind: e.event_type })),
              ...auditLogs.map((a: any) => ({ type: "audit", at: a.created_at, title: a.action, desc: JSON.stringify(a.after_state || {}).slice(0, 120), kind: "audit" })),
            ]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .slice(0, 30)
              .map((item, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-border bg-card" />
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground font-medium">{item.title}</p>
                      {item.desc && <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap shrink-0">{fmtDate(item.at)}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </SectionCard>

      {/* ═══════════════════ DIALOGS ═══════════════════ */}
      {/* Reset Password */}
      <Dialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha do Cliente</DialogTitle>
            <DialogDescription>Redefinir ou criar senha para {customer.email}</DialogDescription>
          </DialogHeader>
          {generatedPwd ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Nova senha gerada:</p>
                <p className="text-lg font-mono font-bold text-emerald-400 select-all">{generatedPwd}</p>
              </div>
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => copyText(generatedPwd, "Senha copiada!")}>
                <Copy className="h-3.5 w-3.5" /> Copiar Senha
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">O cliente será obrigado a trocar a senha no primeiro acesso.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Nova senha (deixe vazio para gerar automaticamente)</label>
                <Input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Gerar senha automática..." className="bg-muted/30 border-border/50 text-xs h-8 text-foreground" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setResetPwdOpen(false)}>Fechar</Button>
            {!generatedPwd && (
              <Button size="sm" onClick={handleResetPassword} disabled={resetPwdLoading} className="gap-1.5">
                {resetPwdLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Redefinir Senha
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message */}
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
              <Textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={6} className="bg-muted/30 border-border/50 text-xs text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setMsgOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={sendMessage} className="gap-1.5"><Send className="h-3.5 w-3.5" />Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LGPD Deletion Dialog */}
      <Dialog open={lgpdOpen} onOpenChange={setLgpdOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><ShieldAlert className="h-5 w-5" /> Exclusão de Dados — LGPD</DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Os dados pessoais do cliente serão permanentemente excluídos ou anonimizados. 
              Apenas o lastro mínimo necessário para rastreabilidade contratual e financeira será preservado.
            </DialogDescription>
          </DialogHeader>
          {lgpdResult ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-emerald-400 mb-2">✓ Exclusão LGPD concluída</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Tabelas afetadas:</strong> {lgpdResult.affected_tables?.join(", ")}</p>
                  <p><strong className="text-foreground">Campos excluídos:</strong> {lgpdResult.deleted_fields?.join(", ")}</p>
                  <p><strong className="text-foreground">Campos anonimizados:</strong> {lgpdResult.anonymized_fields?.join(", ")}</p>
                  <p><strong className="text-foreground">Lastro retido:</strong> {lgpdResult.retained_fields?.join(", ")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
                <p className="font-semibold mb-1">⚠️ O que será excluído/anonimizado:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Nome, CPF/CNPJ, e-mail, telefone, WhatsApp, endereço</li>
                  <li>Credenciais de acesso ao portal (conta deletada)</li>
                  <li>Texto do contrato, IP, assinatura, user agent</li>
                  <li>Dados de leads vinculados</li>
                  <li>PII em logs do sistema</li>
                </ul>
                <p className="font-semibold mt-2 mb-1">O que será preservado (lastro mínimo):</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>IDs internos, tipo de contrato, valores, datas, status</li>
                  <li>Registro de auditoria da exclusão</li>
                </ul>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Motivo / Fundamento da Exclusão</label>
                <Input value={lgpdReason} onChange={e => setLgpdReason(e.target.value)} placeholder="Solicitação do titular" className="bg-muted/30 border-border/50 text-xs h-8 text-foreground" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Digite <span className="text-red-400 font-bold">EXCLUIR LGPD</span> para confirmar
                </label>
                <Input value={lgpdConfirm} onChange={e => setLgpdConfirm(e.target.value)} placeholder="EXCLUIR LGPD" className="bg-muted/30 border-red-500/30 text-xs h-8 text-foreground" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setLgpdOpen(false)}>Fechar</Button>
            {!lgpdResult && (
              <Button size="sm" variant="destructive" onClick={handleLgpdDelete} disabled={lgpdLoading || lgpdConfirm !== "EXCLUIR LGPD"} className="gap-1.5">
                {lgpdLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir Dados Pessoais
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── UI Primitives ──
function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/10">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="bg-muted/30 border-border/50 text-xs h-8 text-foreground" />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, copyable, custom }: { icon: any; label: string; value: string; copyable?: boolean; custom?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label}</span>
      {custom || <span className="text-xs text-foreground truncate flex-1">{value}</span>}
      {copyable && value && value !== "—" && (
        <button onClick={() => copyText(value)} className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5 text-center">
      <p className={cn("text-lg font-bold font-mono leading-none", color || "text-foreground")}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
