import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck, RefreshCw, CheckCircle2, XCircle, Mail, Search,
  Trash2, Send, AlertTriangle, History, Loader2, User,
  Users, Clock, ShieldAlert, ShieldOff,
} from "lucide-react";
import { toast } from "sonner";

type LinkRow = {
  id: string;
  qa_cliente_id: number | null;
  customer_id: string | null;
  user_id: string | null;
  email: string | null;
  documento_normalizado: string | null;
  status: "pending" | "active" | "blocked" | "awaiting_admin";
  email_pendente: string | null;
  motivo: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  qa_clientes?: { id: number; nome_completo: string | null; cpf: string | null; email: string | null } | null;
  customers?: { id: string; nome_fantasia: string | null; cnpj_ou_cpf: string | null; email: string | null } | null;
};

type LogRow = {
  id: string;
  evento: string;
  identificador_mascarado: string | null;
  email: string | null;
  status: string | null;
  detalhes: any;
  created_at: string;
  ip: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  awaiting_admin: { label: "Aguardando Admin", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  blocked: { label: "Bloqueado", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export default function QAAcessosPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tab, setTab] = useState<"acessos" | "logs">("acessos");

  const invoke = useCallback(async (action: string, payload: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-cliente-acessos", {
      body: { action, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([invoke("list"), invoke("logs")]);
      setLinks((a?.items || []) as LinkRow[]);
      setLogs((b?.items || []) as LogRow[]);
    } catch (e: any) {
      toast.error("Falha ao carregar acessos: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      const blob = [
        l.email, l.email_pendente, l.documento_normalizado,
        l.qa_clientes?.nome_completo, l.qa_clientes?.cpf, l.qa_clientes?.email,
        l.customers?.nome_fantasia, l.customers?.cnpj_ou_cpf, l.customers?.email,
      ].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [links, search, statusFilter]);

  const counts = useMemo(() => ({
    all: links.length,
    active: links.filter(l => l.status === "active").length,
    pending: links.filter(l => l.status === "pending").length,
    awaiting_admin: links.filter(l => l.status === "awaiting_admin").length,
    blocked: links.filter(l => l.status === "blocked").length,
  }), [links]);

  const doAction = async (id: string, action: string, extra: Record<string, any> = {}) => {
    setActing(id + ":" + action);
    try {
      await invoke(action, { id, ...extra });
      toast.success("Ação realizada");
      await load();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || ""));
    } finally {
      setActing(null);
    }
  };

  const onApprove = (l: LinkRow) => {
    if (!confirm(`Aprovar acesso para ${l.email_pendente || l.email}?`)) return;
    doAction(l.id, "approve");
  };
  const onBlock = (l: LinkRow) => {
    const motivo = prompt("Motivo do bloqueio (opcional):", "") || "Bloqueado pelo administrador";
    doAction(l.id, "block", { motivo });
  };
  const onUnblock = (l: LinkRow) => doAction(l.id, "unblock");
  const onResend = (l: LinkRow) => doAction(l.id, "resend_otp");
  const onDelete = (l: LinkRow) => {
    if (!confirm("Remover este vínculo? O cliente precisará ativar acesso novamente.")) return;
    doAction(l.id, "delete");
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {/* Page title */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Acessos de Clientes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Vínculos, ativações pendentes e auditoria do portal.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md transition-all hover:opacity-90 shadow-sm no-glow disabled:opacity-60"
          style={{ background: "hsl(230 80% 56%)", color: "#ffffff" }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {([
          { key: "all", label: "Total", value: counts.all, icon: Users, color: "hsl(230 80% 56%)" },
          { key: "active", label: "Ativos", value: counts.active, icon: CheckCircle2, color: "hsl(152 60% 42%)" },
          { key: "pending", label: "Pendentes", value: counts.pending, icon: Clock, color: "hsl(38 92% 50%)" },
          { key: "awaiting_admin", label: "Aguard. Admin", value: counts.awaiting_admin, icon: ShieldAlert, color: "hsl(24 90% 54%)" },
          { key: "blocked", label: "Bloqueados", value: counts.blocked, icon: ShieldOff, color: "hsl(0 72% 55%)" },
        ] as const).map((k) => {
          const active = statusFilter === k.key;
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              onClick={() => setStatusFilter(k.key)}
              className={`qa-card qa-hover-lift p-4 md:p-5 text-left transition-all ${active ? "ring-2" : ""}`}
              style={active ? { boxShadow: `inset 0 0 0 2px ${k.color}` } : undefined}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: k.color + "14" }}
                >
                  <Icon className="h-4 w-4" style={{ color: k.color }} />
                </div>
              </div>
              <div className="qa-kpi text-2xl md:text-3xl mb-1" style={{ color: "hsl(220 20% 14%)" }}>
                {k.value.toLocaleString("pt-BR")}
              </div>
              <div className="text-xs font-medium" style={{ color: "hsl(220 10% 55%)" }}>{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="qa-card p-1.5 inline-flex items-center gap-1">
        {[
          { k: "acessos", label: "Vínculos", icon: ShieldCheck },
          { k: "logs", label: "Auditoria", icon: History },
        ].map(({ k, label, icon: Icon }) => {
          const isActive = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k as any)}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-md transition-all"
              style={
                isActive
                  ? { background: "hsl(230 80% 56%)", color: "#ffffff" }
                  : { color: "hsl(220 10% 45%)" }
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {tab === "acessos" && (
        <div className="qa-card p-4 md:p-5">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar por nome, e-mail, CPF/CNPJ..." className="pl-9 bg-white"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "hsl(220 13% 91%)" }}>
            {loading ? (
              <div className="p-12 flex justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Nenhum vínculo encontrado.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((l) => {
                  const meta = STATUS_META[l.status] || STATUS_META.pending;
                  const nome = l.qa_clientes?.nome_completo || l.customers?.nome_fantasia || "—";
                  const doc = l.qa_clientes?.cpf || l.customers?.cnpj_ou_cpf || l.documento_normalizado || "—";
                  const isActing = (a: string) => acting === l.id + ":" + a;
                  return (
                    <div key={l.id} className="p-4 hover:bg-slate-50/50 transition">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="font-semibold text-sm text-slate-900 truncate">{nome}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                            {l.email_pendente && l.email_pendente !== l.email && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Novo e-mail
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-1 text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {l.email || "—"}</div>
                            <div>Doc: <span className="font-mono">{doc}</span></div>
                            <div>Criado: {fmtDate(l.created_at)}</div>
                            {l.email_pendente && l.email_pendente !== l.email && (
                              <div className="md:col-span-3 text-orange-700">
                                Pendente: <strong>{l.email_pendente}</strong>
                              </div>
                            )}
                            {l.motivo && (
                              <div className="md:col-span-3 text-rose-700">Motivo: {l.motivo}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {(l.status === "awaiting_admin" || l.status === "pending") && (
                            <Button size="sm" variant="default" disabled={!!acting}
                              onClick={() => onApprove(l)}>
                              {isActing("approve") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                              Aprovar
                            </Button>
                          )}
                          {l.status !== "blocked" && (
                            <Button size="sm" variant="outline" disabled={!!acting}
                              onClick={() => onBlock(l)}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Bloquear
                            </Button>
                          )}
                          {l.status === "blocked" && (
                            <Button size="sm" variant="outline" disabled={!!acting}
                              onClick={() => onUnblock(l)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Desbloquear
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={!!acting}
                            onClick={() => onResend(l)}>
                            {isActing("resend_otp") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                            Reenviar OTP
                          </Button>
                          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" disabled={!!acting}
                            onClick={() => onDelete(l)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="qa-card p-4 md:p-5">
          <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "hsl(220 13% 91%)" }}>
          {loading ? (
            <div className="p-12 flex justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Sem registros de auditoria.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{log.evento}</span>
                      {log.status && <span className="text-[10px] text-slate-500">[{log.status}]</span>}
                      <span className="text-slate-700">{log.email || log.identificador_mascarado || "—"}</span>
                    </div>
                    <span className="text-slate-400">{fmtDate(log.created_at)}</span>
                  </div>
                  {log.detalhes && Object.keys(log.detalhes || {}).length > 0 && (
                    <pre className="mt-1 text-[10px] text-slate-500 whitespace-pre-wrap break-all">
                      {JSON.stringify(log.detalhes, null, 0)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}