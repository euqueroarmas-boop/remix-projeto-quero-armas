import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2, Mail, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logSistema } from "@/lib/logSistema";
import { checkRateLimit, logSecurityEvent } from "@/lib/security";

interface Props {
  onLogin: () => void;
}

export default function ClientLogin({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Preencha e-mail e senha."); return; }

    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (err) {
      setError("E-mail ou senha incorretos.");
      logSistema({ tipo: "admin", status: "error", mensagem: "Login falho na Área do Cliente", payload: { email, error: err.message } });
      return;
    }

    logSistema({ tipo: "admin", status: "success", mensagem: "Login realizado na Área do Cliente", payload: { email } });
    onLogin();
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Informe o e-mail cadastrado."); return; }

    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setLoading(false);

    if (err) {
      setError("Erro ao enviar e-mail de recuperação.");
      return;
    }

    setResetSent(true);
    logSistema({ tipo: "admin", status: "info", mensagem: "Recuperação de senha solicitada", payload: { email } });
  };

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
          Área do <span className="text-primary">Cliente</span>
        </h1>

        {mode === "login" ? (
          <>
            <p className="text-muted-foreground mb-8">Acesse com seu e-mail e senha</p>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="bg-card border-border text-foreground pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Senha</label>
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
                Entrar
              </Button>

              <button
                type="button"
                onClick={() => { setMode("reset"); setError(""); }}
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-8">
              {resetSent
                ? "Enviamos um link de recuperação para seu e-mail."
                : "Informe seu e-mail para recuperar a senha"}
            </p>

            {!resetSent ? (
              <form onSubmit={handleReset} className="space-y-4 text-left">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      className="bg-card border-border text-foreground pl-10"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  Enviar Link de Recuperação
                </Button>
              </form>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-sm text-emerald-400">
                Verifique sua caixa de entrada e spam. O link expira em 1 hora.
              </div>
            )}

            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
              className="w-full text-sm text-primary hover:underline mt-4"
            >
              Voltar para o login
            </button>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Acesso exclusivo para clientes WMTi com cadastro ativo.
        </p>
      </motion.div>
    </section>
  );
}
