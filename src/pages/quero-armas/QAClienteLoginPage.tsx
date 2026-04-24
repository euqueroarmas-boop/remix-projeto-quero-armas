import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { BackButton } from "@/shared/components/BackButton";
import logoQueroArmas from "@/assets/quero-armas-logo.png";

export default function QAClienteLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("E-mail de redefinição enviado.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Falha ao obter usuário");

      // Aceita: (a) admin QA com perfil ativo OU (b) cliente vinculado em customers
      const [{ data: qaProfile }, { data: customer }] = await Promise.all([
        supabase
          .from("qa_usuarios_perfis" as any)
          .select("id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("customers")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (!qaProfile && !customer) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Conta sem vínculo de cliente.");
        return;
      }

      toast.success("Bem-vindo!");
      navigate("/area-do-cliente", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden bg-[#0a0a0a]">
      {/* Glow tático de fundo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-red-900/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-5 flex justify-start">
          <BackButton fallback="/" />
        </div>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center mb-5">
            <img
              src={logoQueroArmas}
              alt="Quero Armas"
              className="h-28 w-auto object-contain drop-shadow-[0_8px_32px_rgba(220,38,38,0.25)]"
              draggable={false}
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
            <ShieldCheck className="h-3 w-3 text-red-500" />
            <span className="text-[10px] text-white/70 tracking-[0.18em] uppercase font-semibold">
              Área do Cliente
            </span>
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleLogin}
          className="relative space-y-4 rounded-2xl p-6 border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/50 text-[10px] uppercase tracking-[0.15em] font-semibold">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9 h-11 text-sm rounded-lg bg-black/40 border-white/10 text-white placeholder:text-white/25 focus:border-red-500/60 focus:ring-red-500/20"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/50 text-[10px] uppercase tracking-[0.15em] font-semibold">
              Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="password" type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-9 h-11 text-sm rounded-lg bg-black/40 border-white/10 text-white placeholder:text-white/25 focus:border-red-500/60 focus:ring-red-500/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="group w-full h-11 text-sm font-semibold rounded-lg border-0 text-white shadow-lg shadow-red-900/30 transition-all active:scale-[0.98] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2">
                Entrar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
          </Button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[11px] text-white/40 hover:text-red-400 transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>

        {/* Ativar conta */}
        <button
          type="button"
          onClick={() => navigate("/ativar-acesso")}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-red-500/30 transition-all px-4 py-3 text-center"
        >
          <span className="text-[11px] text-white/50 tracking-wider uppercase">Primeiro acesso?</span>
          <span className="block mt-0.5 text-sm text-white font-semibold">
            Ativar minha conta <ArrowRight className="inline h-3.5 w-3.5 ml-0.5 -mt-0.5" />
          </span>
        </button>

        <p className="text-center text-[10px] text-white/25 mt-6 tracking-[0.2em] uppercase">
          Ambiente seguro · Dados protegidos
        </p>
      </div>
    </div>
  );
}
