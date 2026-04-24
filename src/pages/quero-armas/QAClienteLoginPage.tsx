import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck, ArrowRight, KeyRound, Sparkles } from "lucide-react";
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
    <div className="relative min-h-screen flex flex-col px-5 pt-6 pb-8 overflow-hidden bg-[#070707] text-white">
      {/* Background tático: vinheta + grid sutil + scanline */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[380px] w-[380px] rounded-full bg-red-700/15 blur-3xl" />
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Topbar */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <BackButton fallback="/" />
        <div className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-white/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Sistema online
        </div>
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex-1 flex flex-col">
        {/* Logo + título */}
        <div className="text-center mb-6">
          <img
            src={logoQueroArmas}
            alt="Quero Armas"
            className="h-24 w-auto mx-auto object-contain mix-blend-screen drop-shadow-[0_6px_24px_rgba(220,38,38,0.35)]"
            draggable={false}
          />
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/25 bg-red-500/[0.06]">
            <ShieldCheck className="h-3 w-3 text-red-400" />
            <span className="text-[10px] text-red-300/90 tracking-[0.22em] uppercase font-bold">
              Área do Cliente
            </span>
          </div>
        </div>

        {/* CTA PRIMEIRO ACESSO — destaque máximo */}
        <button
          type="button"
          onClick={() => navigate("/ativar-acesso")}
          className="group relative mb-6 w-full overflow-hidden rounded-2xl p-[1.5px] bg-gradient-to-r from-red-500 via-red-600 to-red-800 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] transition-transform active:scale-[0.99]"
        >
          <div className="relative rounded-[14px] bg-gradient-to-br from-[#1a0606] via-[#0d0303] to-[#1a0606] px-4 py-4 flex items-center gap-3">
            {/* shimmer */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="relative shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-inner shadow-red-900/50">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="relative flex-1 text-left">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-400 tracking-[0.2em] uppercase">
                <span className="h-px w-3 bg-red-500/60" />
                Primeiro acesso
              </div>
              <div className="text-[15px] font-bold text-white leading-tight mt-0.5">
                Ativar minha conta
              </div>
              <div className="text-[10px] text-white/50 mt-0.5">
                Já recebeu o convite? Comece aqui.
              </div>
            </div>
            <ArrowRight className="relative h-5 w-5 text-red-400 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        {/* Divisor */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <span className="text-[10px] tracking-[0.25em] uppercase text-white/35 font-semibold">
            Já tenho conta
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Form login (secundário) */}
        <form
          onSubmit={handleLogin}
          className="relative space-y-3.5 rounded-2xl p-5 border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <Input
                id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9 h-11 text-sm rounded-lg bg-black/50 border-white/[0.08] text-white placeholder:text-white/20 focus:border-red-500/50 focus:ring-red-500/15"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/45 text-[10px] uppercase tracking-[0.18em] font-bold">
              Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <Input
                id="password" type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-9 h-11 text-sm rounded-lg bg-black/50 border-white/[0.08] text-white placeholder:text-white/20 focus:border-red-500/50 focus:ring-red-500/15"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="group w-full h-11 text-sm font-bold rounded-lg border border-white/10 text-white/90 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2 tracking-wider uppercase">
                <KeyRound className="h-4 w-4" />
                Entrar
              </span>
            )}
          </Button>

          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[11px] text-white/35 hover:text-red-400 transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-white/25 mt-auto pt-8 tracking-[0.22em] uppercase font-semibold">
          Ambiente seguro · Dados protegidos
        </p>
      </div>
    </div>
  );
}
