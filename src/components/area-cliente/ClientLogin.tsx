import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2, Mail, Lock, KeyRound, AlertTriangle, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logSistema } from "@/lib/logSistema";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props {
  onLogin: () => void;
}

export default function ClientLogin({ onLogin }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "reset" | "change_password">("login");
  const [resetSent, setResetSent] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const isCnpjOrCpf = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 11 && digits.length <= 14;
  };

  const resolveEmail = async (input: string): Promise<string | null> => {
    // If it looks like an email, use directly
    if (input.includes("@")) return input;

    // Try to resolve CNPJ/CPF to email
    const digits = input.replace(/\D/g, "");
    if (digits.length < 11) return null;

    // Try exact match first
    const { data } = await supabase
      .from("customers")
      .select("email, cnpj_ou_cpf")
      .eq("cnpj_ou_cpf", input)
      .maybeSingle();

    if (data?.email) return data.email;

    // Build all common formatted variants for the digits
    const variants: string[] = [digits];
    if (digits.length === 14) {
      // CNPJ: XX.XXX.XXX/XXXX-XX
      variants.push(`${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`);
    } else if (digits.length === 11) {
      // CPF: XXX.XXX.XXX-XX
      variants.push(`${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`);
    }

    // Try each formatted variant
    for (const variant of variants) {
      const { data: match } = await supabase
        .from("customers")
        .select("email")
        .eq("cnpj_ou_cpf", variant)
        .maybeSingle();
      if (match?.email) return match.email;
    }

    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { setError(t("clientPortal.login.errors.fillEmailPassword")); return; }

    setLoading(true);
    setError("");

    const email = await resolveEmail(identifier);
    if (!email) {
      setError("Não foi possível encontrar uma conta com este identificador.");
      setLoading(false);
      return;
    }

    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (err) {
      setError(t("clientPortal.login.errors.invalidCredentials"));
      logSistema({ tipo: "admin", status: "error", mensagem: "Login falho na Área do Cliente", payload: { email_hash: email ? email.substring(0, 3) + "***" : "unknown" } });
      return;
    }

    // Check if password change is required
    const userMeta = signInData?.user?.user_metadata;
    if (userMeta?.password_change_required) {
      setMode("change_password");
      logSistema({ tipo: "admin", status: "info", mensagem: "Troca de senha obrigatória no primeiro acesso", payload: { email } });
      return;
    }

    logSistema({ tipo: "admin", status: "success", mensagem: "Login realizado na Área do Cliente", payload: { email } });
    onLogin();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) { setError(t("clientPortal.login.errors.fillAllFields")); return; }
    if (newPassword.length < 6) { setError(t("clientPortal.login.errors.passwordLength")); return; }
    if (newPassword !== confirmPassword) { setError(t("clientPortal.login.errors.passwordMismatch")); return; }

    setChangingPassword(true);
    setError("");

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          password_change_required: false,
          temp_password: null,
        },
      });

      if (updateErr) {
        setError(`${t("clientPortal.login.errors.changePassword")}: ${updateErr.message}`);
        setChangingPassword(false);
        return;
      }

      logSistema({
        tipo: "admin",
        status: "success",
        mensagem: "Senha alterada com sucesso no primeiro acesso",
        payload: { email: identifier },
      });

      onLogin();
    } catch {
      setError(t("clientPortal.login.errors.unexpectedPasswordChange"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) { setError(t("clientPortal.login.errors.informEmail")); return; }

    setLoading(true);
    setError("");

    const email = await resolveEmail(identifier);
    if (!email) {
      setError("Não foi possível encontrar uma conta com este identificador.");
      setLoading(false);
      return;
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setLoading(false);

    if (err) {
      setError(t("clientPortal.login.errors.resetEmail"));
      return;
    }

    setResetSent(true);
    logSistema({ tipo: "admin", status: "info", mensagem: "Recuperação de senha solicitada", payload: { email } });
  };

  const identifierPlaceholder = isCnpjOrCpf(identifier)
    ? "CNPJ/CPF detectado"
    : t("clientPortal.login.emailPlaceholder");

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen py-24 px-4 text-center">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-auto"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Building2 size={32} className="text-primary" />
        </div>

        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
          {t("clientPortal.login.titlePrefix")} <span className="text-primary">{t("clientPortal.login.titleHighlight")}</span>
        </h1>

        {mode === "change_password" ? (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-6 flex items-start gap-2 text-left">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                 <p className="text-sm font-semibold text-amber-300">{t("clientPortal.login.changePasswordRequired")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                   {t("clientPortal.login.changePasswordDescription")}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 text-left">
              <div>
                 <label className="text-sm text-muted-foreground mb-1 block">{t("clientPortal.login.newPassword")}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                     placeholder={t("clientPortal.login.newPasswordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    className="bg-card border-border text-foreground pl-10"
                  />
                </div>
              </div>

              <div>
                 <label className="text-sm text-muted-foreground mb-1 block">{t("clientPortal.login.confirmNewPassword")}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                     placeholder={t("clientPortal.login.confirmNewPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    className="bg-card border-border text-foreground pl-10"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                 {t("clientPortal.login.changePasswordAndContinue")}
              </Button>
            </form>
          </>
        ) : mode === "login" ? (
          <>
             <p className="text-muted-foreground mb-8">{t("clientPortal.login.description")}</p>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                 <label className="text-sm text-muted-foreground mb-1 block">E-mail ou CNPJ/CPF</label>
                <div className="relative">
                  {isCnpjOrCpf(identifier)
                    ? <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    : <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  }
                  <Input
                    type="text"
                    placeholder="seu@email.com ou 00.000.000/0000-00"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                    className="bg-card border-border text-foreground pl-10"
                  />
                </div>
                {isCnpjOrCpf(identifier) && (
                  <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> CNPJ/CPF detectado — o e-mail será localizado automaticamente
                  </p>
                )}
              </div>

              <div>
                 <label className="text-sm text-muted-foreground mb-1 block">{t("clientPortal.login.password")}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="bg-card border-border text-foreground pl-10"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                 {t("clientPortal.login.enter")}
              </Button>

              <button
                type="button"
                onClick={() => { setMode("reset"); setError(""); }}
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                 {t("clientPortal.login.forgotPassword")}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-8">
              {resetSent
                 ? t("clientPortal.login.resetSent")
                 : t("clientPortal.login.resetDescription")}
            </p>

            {!resetSent ? (
              <form onSubmit={handleReset} className="space-y-4 text-left">
                <div>
                   <label className="text-sm text-muted-foreground mb-1 block">E-mail ou CNPJ/CPF</label>
                  <div className="relative">
                    {isCnpjOrCpf(identifier)
                      ? <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      : <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    }
                    <Input
                      type="text"
                      placeholder="seu@email.com ou 00.000.000/0000-00"
                      value={identifier}
                      onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                      className="bg-card border-border text-foreground pl-10"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  {t("clientPortal.login.sendRecoveryLink")}
                </Button>
              </form>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-sm text-emerald-400">
                 {t("clientPortal.login.checkInbox")}
              </div>
            )}

            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
              className="w-full text-sm text-primary hover:underline mt-4"
            >
               {t("clientPortal.login.backToLogin")}
            </button>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          {t("clientPortal.login.footer")}
        </p>
      </motion.div>
    </section>
  );
}
