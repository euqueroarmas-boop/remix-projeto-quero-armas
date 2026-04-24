import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Crosshair, Sparkles } from "lucide-react";

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
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#030303] text-[#e0e0e0] uppercase"
      style={{ fontFamily: "'Rajdhani', sans-serif" }}
    >
      {/* Tactical grid */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,42,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,42,42,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, transparent 0%, #030303 80%)",
        }}
      />
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* Terminal */}
      <div className="relative z-10 w-full max-w-[400px] bg-[#0a0a0a]/90 border border-[#1f1f1f] backdrop-blur-md p-6 flex flex-col gap-7 shadow-[0_0_60px_rgba(255,42,42,0.05)]">
        {/* HUD bar */}
        <div
          className="flex items-center justify-between text-[11px] tracking-[0.2em] text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 hover:text-[#ff2a2a] transition-colors group"
          >
            <ChevronLeft className="h-3 w-3 text-[#ff2a2a] group-hover:-translate-x-0.5 transition-transform" />
            VOLTAR
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-none bg-[#ff2a2a] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-[#ff2a2a]" />
            </span>
            <span>NODE_SECURE</span>
          </div>
        </div>

        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-[#ff2a2a] flex items-center gap-2.5 tracking-[0.15em] font-bold">
            <span
              className="text-sm opacity-50"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              [
            </span>
            <Crosshair className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-xl">QUERO ARMAS</span>
            <span
              className="text-sm opacity-50"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ]
            </span>
          </div>
          <div
            className="text-[9px] tracking-[0.3em] text-zinc-500 px-3 py-1 border border-zinc-800"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            PROTOCOLO_LEGAL_ARMAMENTO
          </div>
        </div>

        {/* PRIMEIRO ACESSO — destaque máximo */}
        <div className="flex flex-col gap-2">
          <div
            className="text-[10px] tracking-[0.2em] text-zinc-500 pl-2 border-l-2 border-[#ff2a2a]/50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            &gt; Inicializar Registro
          </div>
          <button
            type="button"
            onClick={() => navigate("/ativar-acesso")}
            className="w-full relative bg-[#ff2a2a]/5 hover:bg-[#ff2a2a]/10 border border-[#ff2a2a]/40 hover:border-[#ff2a2a] p-6 flex flex-col items-center gap-3 transition-all shadow-[0_0_25px_rgba(255,42,42,0.15)] hover:shadow-[0_0_45px_rgba(255,42,42,0.35)] group"
          >
            {/* targeting brackets */}
            <div className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-[#ff2a2a]" />
            <div className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-[#ff2a2a]" />
            <div className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-[#ff2a2a]" />
            <div className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-[#ff2a2a]" />

            <Sparkles className="h-6 w-6 text-[#ff2a2a] group-hover:scale-110 transition-transform" />
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-2xl font-bold tracking-widest text-white">
                PRIMEIRO ACESSO
              </span>
              <span
                className="text-[11px] tracking-[0.25em] text-[#ff2a2a]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ATIVAR_MINHA_CONTA // 0X1
              </span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 opacity-60">
          <div className="h-px bg-[#1f1f1f] flex-1" />
          <div
            className="text-[9px] tracking-[0.3em] text-zinc-500"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            AUTENTICAR_OPERADOR
          </div>
          <div className="h-px bg-[#1f1f1f] flex-1" />
        </div>

        {/* Login form (secundário) */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              className="text-[10px] tracking-[0.2em] text-zinc-500"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ID CREDENCIAL
            </label>
            <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#ff2a2a]/60 bg-black/40 transition-colors">
              <span
                className="text-[#ff2a2a]/60 text-sm pl-3"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                &gt;
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-transparent p-3 text-sm text-white outline-none lowercase placeholder:text-zinc-700 placeholder:tracking-wider"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-[10px] tracking-[0.2em] text-zinc-500"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              CHAVE DE ACESSO
            </label>
            <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#ff2a2a]/60 bg-black/40 transition-colors">
              <span
                className="text-[#ff2a2a]/60 text-sm pl-3"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                &gt;
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent p-3 text-sm tracking-widest text-white outline-none placeholder:text-zinc-700"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] text-zinc-500 hover:text-[#ff2a2a] tracking-[0.2em] transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              [ RECUPERAR ]
            </button>
            <button
              type="submit"
              disabled={loading}
              className="border border-[#1f1f1f] hover:border-zinc-400 px-6 py-2.5 text-[13px] tracking-[0.15em] text-zinc-300 hover:text-white font-bold bg-[#030303] transition-all active:scale-[0.98] inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "LOGIN"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Webfont loader */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap"
      />
    </div>
  );
}
