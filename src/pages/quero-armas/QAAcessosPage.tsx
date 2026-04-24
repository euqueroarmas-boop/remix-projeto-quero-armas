import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck, RefreshCw, CheckCircle2, XCircle, Mail, Search,
  Trash2, Send, AlertTriangle, History, Loader2, User, Filter,
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
  qa_clientes?: { id: number; nome: string | null; cpf: string | null; email: string | null } | null;
  customers?: { id: string; nome: string | null; cnpj_ou_cpf: string | null; email: string | null } | null;
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
        l.qa_clientes?.nome, l.qa_clientes?.cpf, l.qa_clientes?.email,
        l.customers?.nome, l.customers?.cnpj_ou_cpf, l.customers?.email,
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
    <div className="p-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Acessos de Clientes</h1>
            <p className="text-xs text-slate-500">Gerencie vínculos, ativações pendentes e auditoria de portal.</p>
          </div>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Atualizar
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {([
          ["all", "Total", counts.all, "bg-slate-50 text-slate-700"],
          ["active", "Ativos", counts.active, "bg-emerald-50 text-emerald-700"],
          ["pending", "Pendentes", counts.pending, "bg-amber-50 text-amber-700"],
          ["awaiting_admin", "Aguard. Admin", counts.awaiting_admin, "bg-orange-50 text-orange-700"],
          ["blocked", "Bloqueados", counts.blocked, "bg-rose-50 text-rose-700"],
        ] as const).map(([key, label, n, cls]) => (
          <button key={key}
            onClick={() => setStatusFilter(key as string)}
            className={`text-left rounded-lg border p-3 transition ${statusFilter === key ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"} ${cls}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
            <div className="text-2xl font-semibold">{n}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
        {[
          { k: "acessos", label: "Vínculos", icon: ShieldCheck },
          { k: "logs", label: "Auditoria", icon: History },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k}
            onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              tab === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "acessos" && (
        <>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar por nome, e-mail, CPF/CNPJ..." className="pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
                  const nome = l.qa_clientes?.nome || l.customers?.nome || "—";
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
        </>
      )}

      {tab === "logs" && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
      )}
    </div>
  );
}