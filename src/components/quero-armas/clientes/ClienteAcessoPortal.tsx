import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Mail, Hash, Copy, ExternalLink, KeyRound, Loader2,
  CheckCircle, XCircle, Eye, EyeOff, Link2, UserPlus, RefreshCw,
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

export default function ClienteAcessoPortal({ cliente }: Props) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const portalUrl = `${window.location.origin}/area-do-cliente`;
  const resetUrl = `${window.location.origin}/redefinir-senha`;

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      // Look up the WMTi customers table by email or CPF
      const cpfClean = (cliente.cpf || "").replace(/\D/g, "");
      const email = (cliente.email || "").trim().toLowerCase();

      let found: any = null;

      if (email) {
        const { data } = await supabase
          .from("customers")
          .select("id, email, user_id, razao_social, cnpj_ou_cpf, status_cliente")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && cpfClean) {
        const { data } = await supabase
          .from("customers")
          .select("id, email, user_id, razao_social, cnpj_ou_cpf, status_cliente")
          .eq("cnpj_ou_cpf", cpfClean)
          .limit(1)
          .maybeSingle();
        if (data) found = data;
      }

      setCustomer(found);
    } catch (err) {
      console.error("Erro ao buscar customer:", err);
    }
    setLoading(false);
  }, [cliente.cpf, cliente.email]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

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
          customer_id: customerId,
          email: cliente.email,
          user_password: tempPwd,
          name: cliente.nome_completo,
          customer_data: {
            email: cliente.email,
            razao_social: cliente.nome_completo,
            responsavel: cliente.nome_completo,
            cnpj_ou_cpf: (cliente.cpf || "").replace(/\D/g, ""),
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

      setGeneratedPwd(tempPwd);
      setGeneratedEmail(cliente.email);
      toast.success("Acesso ao portal criado com sucesso");
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar acesso");
    }
    setCreateLoading(false);
  };

  const handleResetPassword = async () => {
    if (!customer?.id) return;
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
          customer_id: customer.id,
          email: customer.email,
          user_password: newPwd || undefined,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao redefinir senha");
        setResetLoading(false);
        return;
      }

      setGeneratedPwd(newPwd || data?.temp_password || "");
      setNewPwd("");
      toast.success("Senha redefinida com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
    setResetLoading(false);
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

  const hasAccount = !!customer?.user_id;

  return (
    <div className="space-y-4">
      {/* ── STATUS CARD ── */}
      <div className={`rounded-2xl border p-5 ${hasAccount
        ? "bg-emerald-50/60 border-emerald-200/60"
        : "bg-amber-50/40 border-amber-200/50"
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasAccount
            ? "bg-emerald-100 text-emerald-600"
            : "bg-amber-100 text-amber-600"
          }`}>
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

        {/* Info rows */}
        <div className="space-y-2">
          <InfoRow icon={Mail} label="Login E-mail" value={hasAccount ? customer.email : "—"} copyable={hasAccount} onCopy={() => copyText(customer.email)} />
          <InfoRow icon={Hash} label="Login CPF/CNPJ" value={hasAccount ? "Habilitado" : "—"} />
          {hasAccount && customer.user_id && (
            <InfoRow icon={Hash} label="Auth User ID" value={customer.user_id.slice(0, 12) + "..."} copyable onCopy={() => copyText(customer.user_id, "User ID copiado")} />
          )}
        </div>
      </div>

      {/* ── ACTIONS ── */}
      {hasAccount ? (
        <div className="space-y-4">
          {/* Reset password */}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                className="h-9 shrink-0 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 rounded-xl"
                onClick={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Redefinir</span>
              </Button>
            </div>
          </div>

          {/* Generated password display */}
          {generatedPwd && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Senha gerada</span>
                  <p className="text-sm font-mono font-bold text-emerald-800 mt-0.5">{generatedPwd}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700 h-8 rounded-xl"
                  onClick={() => copyText(generatedPwd, "Senha copiada")}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Create access */
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
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-6 h-10 rounded-xl uppercase tracking-wider"
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

      {/* ── QUICK LINKS ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-slate-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Links do Portal</h4>
        </div>
        <div className="space-y-2.5">
          <LinkRow
            label="URL Login"
            url={portalUrl}
            path="/area-do-cliente"
            onCopy={() => copyText(portalUrl, "URL de login copiada")}
            onOpen={() => window.open(portalUrl, "_blank")}
          />
          <LinkRow
            label="URL Redefinição de Senha"
            url={resetUrl}
            path="/redefinir-senha"
            onCopy={() => copyText(resetUrl, "URL de reset copiada")}
            onOpen={() => window.open(resetUrl, "_blank")}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoRow({ icon: Icon, label, value, copyable, onCopy }: {
  icon: any; label: string; value: string; copyable?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-700">{value}</span>
        {copyable && onCopy && (
          <button onClick={onCopy} className="text-slate-300 hover:text-slate-500 transition-colors">
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
