import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Mail, Hash, Copy, ExternalLink, KeyRound, Loader2,
  CheckCircle, XCircle, Eye, EyeOff, Link2, UserPlus, RefreshCw,
  Send, AlertTriangle, Clock, History, Wrench,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  cliente: {
    id: number;
    nome_completo: string;
    cpf: string;
    email: string;
  };
}

const EVENTOS_PORTAL = [
  "portal_provisionado",
  "credenciais_enviadas",
  "senha_resetada",
  "falha_envio_email",
] as const;

type PortalStatus = {
  portal_provisionado_em: string | null;
  portal_credenciais_enviadas_em: string | null;
  portal_ultimo_envio_status: string | null;
  portal_ultimo_envio_erro: string | null;
};

type TimelineEvent = {
  id: string;
  evento: string;
  descricao: string | null;
  ator: string | null;
  created_at: string;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const eventoLabel: Record<string, { label: string; color: string; icon: any }> = {
  portal_provisionado: { label: "Portal provisionado", color: "text-emerald-700 bg-emerald-100", icon: CheckCircle },
  credenciais_enviadas: { label: "Credenciais enviadas", color: "text-[#7A1F2B] bg-[#FBF3F4]", icon: Send },
  senha_resetada: { label: "Senha redefinida", color: "text-amber-700 bg-amber-100", icon: KeyRound },
  falha_envio_email: { label: "Falha no envio", color: "text-red-700 bg-red-100", icon: AlertTriangle },
};

export default function ClienteAcessoPortal({ cliente }: Props) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [qaCustomer, setQaCustomer] = useState<any>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [persistedPwd, setPersistedPwd] = useState("");
  const [persistedEmail, setPersistedEmail] = useState("");
  const [persistedHasAccount, setPersistedHasAccount] = useState(false);
  const [persistedUserId, setPersistedUserId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [diag, setDiag] = useState<any | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);

  const portalUrl = `${window.location.origin}/area-do-cliente/login`;
  const resetUrl = `${window.location.origin}/redefinir-senha`;

  const runDiagnose = useCallback(async () => {
    setDiagLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return;
      const { data, error } = await supabase.functions.invoke("admin-cliente-acessos", {
        body: { action: "diagnose", qa_cliente_id: cliente.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        console.error("[ClienteAcessoPortal] diagnose error:", error);
        setDiag(null);
        return;
      }
      setDiag(data || null);
    } finally {
      setDiagLoading(false);
    }
  }, [cliente.id]);

  const repairLink = useCallback(async (force = false) => {
    setRepairLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("admin-cliente-acessos", {
        body: { action: "repair_link", qa_cliente_id: cliente.id, force_reassign: force },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || data?.error) {
        const msg = data?.message || data?.error || "Falha ao reparar vínculo";
        if (data?.error === "auth_user_nao_encontrado") {
          toast.error("Usuário Auth não encontrado. Gere nova credencial.");
        } else if (data?.error === "vinculo_aponta_outro_cliente") {
          toast.error(`Vínculo aponta para outro cliente (id=${data?.conflito_qa_cliente_id}). Revisão manual necessária.`);
        } else {
          toast.error(String(msg));
        }
        return;
      }
      toast.success(
        data?.acao === "vinculo_criado" ? "Vínculo criado com sucesso." :
        data?.acao === "vinculo_reativado" ? "Vínculo reativado com sucesso." :
        "Vínculo revalidado.",
      );
      await runDiagnose();
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao reparar vínculo");
    } finally {
      setRepairLoading(false);
    }
  }, [cliente.id, runDiagnose]);

  const fetchPortalStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("qa_clientes" as any)
        .select("portal_provisionado_em, portal_credenciais_enviadas_em, portal_ultimo_envio_status, portal_ultimo_envio_erro")
        .eq("id", cliente.id)
        .maybeSingle();
      setPortalStatus((data as any) || null);
    } catch (err) {
      console.error("Erro ao buscar status portal:", err);
    }
  }, [cliente.id]);

  const fetchTimeline = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("qa_solicitacao_eventos" as any)
        .select("id, evento, descricao, ator, created_at")
        .eq("cliente_id", cliente.id)
        .in("evento", EVENTOS_PORTAL as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(15);
      setTimeline(((data as any) || []) as TimelineEvent[]);
    } catch (err) {
      console.error("Erro ao buscar timeline portal:", err);
    }
  }, [cliente.id]);

  const fetchStoredCredentials = useCallback(async (customerRecord?: any, qaCustomerRecord?: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return null;

      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: {
          action: "get_credentials",
          qa_client_id: qaCustomerRecord?.id || cliente.id,
          customer_id: customerRecord?.id,
          email: customerRecord?.email || qaCustomerRecord?.email || cliente.email,
          document: qaCustomerRecord?.cpf || cliente.cpf,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.error) {
        setPersistedPwd("");
        setPersistedEmail("");
        setPersistedHasAccount(false);
        setPersistedUserId(null);
        return null;
      }

      setPersistedPwd(data?.temp_password || "");
      setPersistedEmail(data?.email || customerRecord?.email || qaCustomerRecord?.email || cliente.email || "");
      setPersistedHasAccount(!!data?.has_account);
      setPersistedUserId(data?.user_id || null);
      return data;
    } catch {
      return null;
    }
  }, [cliente.cpf, cliente.email, cliente.id]);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const cpfClean = (cliente.cpf || "").replace(/\D/g, "");
      const email = (cliente.email || "").trim().toLowerCase();

      const { data: qaFoundRaw } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, email, cpf, user_id, customer_id, status, updated_at")
        .eq("id", cliente.id)
        .maybeSingle();

      const qaFound = (qaFoundRaw as any) || null;
      setQaCustomer(qaFound);

      let found: any = null;

      if (qaFound?.customer_id) {
        const { data } = await supabase
          .from("customers")
          .select("id, email, user_id, razao_social, cnpj_ou_cpf, status_cliente")
          .eq("id", qaFound.customer_id)
          .limit(1);
        if (data && data.length) found = data[0];
      }

      if (!found && email) {
        const { data } = await supabase
          .from("customers")
          .select("id, email, user_id, razao_social, cnpj_ou_cpf, status_cliente")
          .ilike("email", email)
          .order("user_id", { ascending: false, nullsFirst: false })
          .limit(1);
        if (data && data.length) found = data[0];
      }

      if (!found && cpfClean) {
        const { data } = await supabase
          .from("customers")
          .select("id, email, user_id, razao_social, cnpj_ou_cpf, status_cliente")
          .eq("cnpj_ou_cpf", cpfClean)
          .order("user_id", { ascending: false, nullsFirst: false })
          .limit(1);
        if (data && data.length) found = data[0];
      }

      const credentials = await fetchStoredCredentials(found, qaFound);

      if (found || credentials?.customer_id) {
        setCustomer({
          ...(found || {}),
          id: found?.id || credentials?.customer_id,
          user_id: credentials?.user_id || found?.user_id || null,
          email: credentials?.email || found?.email || qaFound?.email || cliente.email,
        });
      } else {
        setCustomer(null);
      }

      // Carrega status persistido + timeline em paralelo
      await Promise.all([fetchPortalStatus(), fetchTimeline()]);
    } catch (err) {
      console.error("Erro ao buscar customer:", err);
    }
    setLoading(false);
  }, [cliente.cpf, cliente.email, cliente.id, fetchStoredCredentials, fetchPortalStatus, fetchTimeline]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    void runDiagnose();
  }, [runDiagnose]);

  const handleCreateAccess = async () => {
    if (!cliente.email) {
      toast.error("Cliente sem e-mail cadastrado");
      return;
    }
    setCreateLoading(true);
    try {
      const customerId = customer?.id;
      const tempPwd = generateTempPassword();

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente para criar acessos.");
        setCreateLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: {
          qa_client_id: qaCustomer?.id || cliente.id,
          customer_id: customerId,
          email: cliente.email,
          document: qaCustomer?.cpf || cliente.cpf,
          user_password: tempPwd,
          name: cliente.nome_completo,
          customer_data: {
            email: cliente.email,
            razao_social: cliente.nome_completo,
            responsavel: cliente.nome_completo,
            cnpj_ou_cpf: (qaCustomer?.cpf || cliente.cpf || "").replace(/\D/g, ""),
            status_cliente: "ativo",
          },
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao criar acesso");
        setCreateLoading(false);
        return;
      }

      const savedPassword = data?.temp_password || tempPwd;
      const savedEmail = data?.email || cliente.email;
      setGeneratedPwd(savedPassword);
      setGeneratedEmail(savedEmail);
      setPersistedPwd(savedPassword);
      setPersistedEmail(savedEmail);
      setPersistedHasAccount(true);
      setPersistedUserId(data?.user_id || null);
      toast.success("Acesso ao portal criado com sucesso");
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar acesso");
    }
    setCreateLoading(false);
  };

  const handleResetPassword = async () => {
    const targetCustomerId = customer?.id;
    if (!targetCustomerId && !qaCustomer?.id) return;
    setResetLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente para redefinir senhas.");
        setResetLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: {
          action: "reset_password",
          qa_client_id: qaCustomer?.id || cliente.id,
          customer_id: targetCustomerId,
          email: customer?.email || qaCustomer?.email || cliente.email,
          document: qaCustomer?.cpf || cliente.cpf,
          user_password: newPwd || undefined,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao redefinir senha");
        setResetLoading(false);
        return;
      }

      const savedPassword = newPwd || data?.temp_password || "";
      const savedEmail = data?.email || customer?.email || qaCustomer?.email || cliente.email;
      setGeneratedPwd(savedPassword);
      setGeneratedEmail(savedEmail);
      setPersistedPwd(savedPassword);
      setPersistedEmail(savedEmail);
      setPersistedHasAccount(true);
      setPersistedUserId(data?.user_id || null);
      setNewPwd("");
      toast.success("Senha redefinida com sucesso");
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
    setResetLoading(false);
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente para reenviar.");
        setResendLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-client-user", {
        body: {
          action: "resend_credentials",
          qa_client_id: qaCustomer?.id || cliente.id,
          customer_id: customer?.id,
          email: customer?.email || qaCustomer?.email || cliente.email,
          document: qaCustomer?.cpf || cliente.cpf,
          name: cliente.nome_completo,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao reenviar credenciais");
        setResendLoading(false);
        return;
      }

      toast.success(
        data?.regenerated_password
          ? "Nova senha temporária gerada e enviada por e-mail"
          : "Credenciais reenviadas por e-mail",
      );
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar credenciais");
    }
    setResendLoading(false);
  };

  const copyText = (text: string, label = "Copiado!") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Verificando acesso...</span>
      </div>
    );
  }

  const hasAccount = !!(customer?.user_id || qaCustomer?.user_id || persistedUserId || persistedHasAccount);
  const visiblePassword = generatedPwd || persistedPwd;
  const rawEmail = generatedEmail || persistedEmail || (hasAccount ? (customer?.email || qaCustomer?.email || cliente.email) : "");
  const visibleEmail = rawEmail ? rawEmail.toLowerCase().trim() : "";
  const displayEmail = visibleEmail || (customer?.email || qaCustomer?.email || cliente.email || "").toLowerCase().trim();
  const displayUserId = customer?.user_id || qaCustomer?.user_id || persistedUserId || "";

  return (
    <div className="space-y-4">
      {visiblePassword && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Credenciais Geradas</h3>
          </div>
          <p className="text-[11px] text-emerald-700 mb-3">
            Anote ou envie ao cliente. Esta senha não será exibida novamente.
          </p>
          <div className="space-y-2">
            {visibleEmail && (
              <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-emerald-200">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">E-mail / Login</span>
                  <p className="text-sm font-mono font-semibold text-slate-800 truncate">{visibleEmail}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 shrink-0 text-emerald-600" onClick={() => copyText(visibleEmail, "E-mail copiado")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-emerald-200">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Senha</span>
                <p className="text-sm font-mono font-bold text-emerald-800">{visiblePassword}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 text-emerald-600" onClick={() => copyText(visiblePassword, "Senha copiada")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-3 h-9 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-xl"
            onClick={() => copyText([
              `Portal: ${portalUrl}`,
              `E-mail: ${visibleEmail}`,
              `Senha: ${visiblePassword}`,
            ].join("\r\n"), "Credenciais completas copiadas")}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar Tudo (URL + Login + Senha)
          </Button>
        </div>
      )}

      <div className={`rounded-2xl border p-5 ${hasAccount ? "bg-emerald-50/60 border-emerald-200/60" : "bg-amber-50/40 border-amber-200/50"}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasAccount ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Acesso ao Portal</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {hasAccount ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle className="h-3 w-3" /> Conta Ativa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <XCircle className="h-3 w-3" /> Sem Conta
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <InfoRow icon={Mail} label="Login E-mail" value={hasAccount ? displayEmail : "—"} copyable={hasAccount && !!displayEmail} onCopy={() => copyText(displayEmail)} />
          <InfoRow icon={Hash} label="Login CPF/CNPJ" value={hasAccount ? "Habilitado" : "—"} />
          {hasAccount && displayUserId && (
            <InfoRow icon={Hash} label="Auth User ID" value={displayUserId.slice(0, 12) + "..."} copyable onCopy={() => copyText(displayUserId, "User ID copiado")} />
          )}
          <InfoRow icon={Clock} label="Provisionado em" value={formatDateTime(portalStatus?.portal_provisionado_em)} />
          <InfoRow icon={Send} label="Último envio em" value={formatDateTime(portalStatus?.portal_credenciais_enviadas_em)} />
        </div>
      </div>

      {/* ── Diagnóstico real do vínculo Auth ↔ Cliente ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Diagnóstico do vínculo Portal</h4>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={runDiagnose} disabled={diagLoading}>
            {diagLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {!diag ? (
          <p className="text-[11px] text-slate-500">Carregando diagnóstico…</p>
        ) : (
          <div className="space-y-1.5 text-[12px]">
            <DiagRow label="Cliente ativo" ok={!!diag.cliente_ativo} />
            <DiagRow label="E-mail normalizado" value={diag.email_normalizado || "—"} ok={!!diag.email_normalizado} />
            <DiagRow label="Auth user encontrado" ok={!!diag.auth_user_encontrado} />
            {diag.auth_user_id && <DiagRow label="Auth user id" value={String(diag.auth_user_id).slice(0, 12) + "…"} ok />}
            <DiagRow label="Vínculo Auth → Cliente" ok={!!diag.vinculo_existe} />
            <DiagRow label="Vínculo ativo" ok={!!diag.vinculo_ativo} />
            <DiagRow label="Vínculo aponta para o cliente certo" ok={!diag.vinculo_aponta_outro_cliente} />
            <DiagRow label="Último login" value={formatDateTime(diag.last_login_at)} ok={!!diag.last_login_at} />
            <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-semibold ${diag.acesso_liberado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {diag.acesso_liberado
                ? "Acesso liberado ao portal"
                : (diag.motivos?.length ? `Bloqueado: ${diag.motivos.join(", ")}` : "Credencial criada, vínculo pendente")}
            </div>
          </div>
        )}

        {!!diag && !diag.acesso_liberado && (
          <Button
            size="sm"
            className="w-full mt-3 h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
            onClick={() => repairLink(false)}
            disabled={repairLoading}
          >
            {repairLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Wrench className="h-3.5 w-3.5 mr-2" />}
            Reparar vínculo do portal
          </Button>
        )}
      </div>

      {portalStatus?.portal_ultimo_envio_status === "failed" && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Último envio falhou</h4>
              <p className="text-[11px] text-red-700 mt-1">
                {portalStatus.portal_ultimo_envio_erro || "Não foi possível entregar o e-mail de credenciais."}
              </p>
              <Button
                size="sm"
                className="mt-3 h-8 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl px-3"
                onClick={handleResend}
                disabled={resendLoading}
              >
                {resendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Tentar reenviar agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasAccount ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5C2C6] bg-[#FBF3F4] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Send className="h-4 w-4 text-[#7A1F2B]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A1F2B]">Reenviar credenciais</h4>
            </div>
            <p className="text-[11px] text-[#7A1F2B] mb-3">
              Reenvia o e-mail com a senha temporária atual. Se a senha não estiver mais disponível,
              uma nova será gerada automaticamente.
            </p>
            <Button
              size="sm"
              className="w-full h-9 bg-[#7A1F2B] hover:bg-[#641722] text-white text-xs font-bold rounded-xl"
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Send className="h-3.5 w-3.5 mr-2" />}
              Reenviar e-mail de credenciais
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Redefinir Senha</h4>
            </div>
            <div className="flex gap-2">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="Nova senha (vazio = gerar automática)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="text-sm h-9 bg-slate-50 border-slate-200"
              />
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                className="h-9 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold px-4 rounded-xl"
                onClick={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Redefinir</span>
              </Button>
            </div>
          </div>

          {visiblePassword && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Senha gerada</span>
                  <p className="text-sm font-mono font-bold text-emerald-800 mt-0.5">{visiblePassword}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 h-8 rounded-xl" onClick={() => copyText(visiblePassword, "Senha copiada")}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <UserPlus className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Este cliente ainda não possui acesso ao portal</p>
              <p className="text-xs text-slate-400 mt-1">Crie as credenciais para permitir o acesso à Área do Cliente</p>
            </div>
            <Button
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold px-6 h-10 rounded-xl uppercase tracking-wider"
              onClick={handleCreateAccess}
              disabled={createLoading || !cliente.email}
            >
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar Acesso ao Portal
            </Button>
            {!cliente.email && (
              <p className="text-[10px] text-red-500">⚠ Cliente sem e-mail cadastrado. Cadastre o e-mail primeiro.</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-slate-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Links do Portal</h4>
        </div>
        <div className="space-y-2.5">
          <LinkRow label="URL Login" url={portalUrl} path="/area-do-cliente/login" onCopy={() => copyText(portalUrl, "URL de login copiada")} onOpen={() => window.open(portalUrl, "_blank")} />
          <LinkRow label="URL Redefinição de Senha" url={resetUrl} path="/redefinir-senha" onCopy={() => copyText(resetUrl, "URL de reset copiada")} onOpen={() => window.open(resetUrl, "_blank")} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-slate-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Histórico de Acesso</h4>
        </div>
        {timeline.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((ev) => {
              const meta = eventoLabel[ev.evento] || { label: ev.evento, color: "text-slate-700 bg-slate-100", icon: History };
              const Icon = meta.icon;
              return (
                <li key={ev.id} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 truncate">{meta.label}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(ev.created_at)}</span>
                    </div>
                    {ev.descricao && (
                      <p className="text-[10px] text-slate-500 truncate">{ev.descricao}</p>
                    )}
                    {ev.ator && (
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">por {ev.ator}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, copyable, onCopy }: {
  icon: any; label: string; value: string; copyable?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-[11px] text-slate-500 font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-semibold text-slate-700 truncate">{value}</span>
        {copyable && onCopy && (
          <button onClick={onCopy} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function LinkRow({ label, path, onCopy, onOpen }: {
  label: string; url: string; path: string; onCopy: () => void; onOpen: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-medium text-slate-600">{label}</p>
        <p className="text-[10px] font-mono text-slate-400">{path}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg" onClick={onOpen}>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 10; i++) {
    pwd += chars[arr[i] % chars.length];
  }
  return pwd + "!1";
}

function DiagRow({ label, ok, value }: { label: string; ok?: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-slate-600">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-[11px]">
        {value && <span className="text-slate-700 truncate max-w-[200px]">{value}</span>}
        {ok === true && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
        {ok === false && <XCircle className="h-3.5 w-3.5 text-red-500" />}
      </span>
    </div>
  );
}
