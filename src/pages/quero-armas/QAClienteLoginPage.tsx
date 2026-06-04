import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Sparkles } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

export default function QAClienteLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { prefillEmail?: string; prefillPassword?: string } | null;
    if (state?.prefillEmail) setEmail(state.prefillEmail);
    if (state?.prefillPassword) {
      setPassword(state.prefillPassword);
      toast.success("Credenciais preenchidas. Clique em entrar.");
    }
    if (state?.prefillEmail || state?.prefillPassword) {
      // Limpa o state para não repetir ao recarregar
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
      className="qa-login-shell relative w-full flex items-center justify-center p-4 md:p-0 bg-[#030303] text-[#e0e0e0] uppercase"
      style={{ fontFamily: "'Rajdhani', sans-serif" }}
    >
      {/* Tactical grid */}
      <div
        className="absolute inset-0 opacity-60 md:opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(201,169,97,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,97,0.04) 1px, transparent 1px)",
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
        className="absolute inset-0 pointer-events-none opacity-20 md:opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* ===================== MOBILE / TABLET (até md) — mantém o terminal centralizado ===================== */}
      <div className="md:hidden relative z-10 w-full max-w-[420px] bg-[#0a0a0a]/90 border border-[#1f1f1f] backdrop-blur-md p-5 sm:p-6 flex flex-col gap-6 shadow-[0_0_60px_rgba(201,169,97,0.05)]">
        {/* HUD bar */}
        <div
          className="flex items-center justify-between text-[11px] tracking-[0.2em] text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 hover:text-[#c9a961] transition-colors group"
          >
            <ChevronLeft className="h-3 w-3 text-[#c9a961] group-hover:-translate-x-0.5 transition-transform" />
            VOLTAR
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-none bg-[#c9a961] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-[#c9a961]" />
            </span>
            <span>NODE_SECURE</span>
          </div>
        </div>

        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={logoWhite}
            alt="Eu Quero Armas"
            className="h-12 w-auto object-contain drop-shadow-[0_4px_20px_rgba(201,169,97,0.25)]"
            draggable={false}
          />
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
            className="text-[10px] tracking-[0.2em] text-zinc-500 pl-2 border-l-2 border-[#c9a961]/50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            &gt; Inicializar Registro
          </div>
          <button
            type="button"
            onClick={() => navigate("/ativar-acesso")}
            className="w-full relative bg-[#c9a961]/5 hover:bg-[#c9a961]/10 border border-[#c9a961]/40 hover:border-[#c9a961] p-6 flex flex-col items-center gap-3 transition-all shadow-[0_0_25px_rgba(201,169,97,0.15)] hover:shadow-[0_0_45px_rgba(201,169,97,0.35)] group"
          >
            {/* targeting brackets */}
            <div className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-[#c9a961]" />
            <div className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-[#c9a961]" />
            <div className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-[#c9a961]" />
            <div className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-[#c9a961]" />

            <Sparkles className="h-6 w-6 text-[#c9a961] group-hover:scale-110 transition-transform" />
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-widest text-white">
                PRIMEIRO ACESSO
              </span>
              <span
                className="text-[11px] tracking-[0.25em] text-[#c9a961]"
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
            <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#c9a961]/60 bg-black/40 transition-colors">
              <span
                className="text-[#c9a961]/60 text-sm pl-3"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                &gt;
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="seu@email.com"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                name="email"
                className="w-full bg-transparent p-3 text-sm text-white outline-none placeholder:text-zinc-700 placeholder:tracking-wider"
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
            <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#c9a961]/60 bg-black/40 transition-colors">
              <span
                className="text-[#c9a961]/60 text-sm pl-3"
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
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                name="password"
                className="w-full bg-transparent p-3 text-sm text-white outline-none placeholder:text-zinc-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] text-zinc-500 hover:text-[#c9a961] tracking-[0.2em] transition-colors"
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

      {/* ===================== DESKTOP / NOTEBOOK (md+) — split full-screen ===================== */}
      <div className="hidden md:grid relative z-10 w-full h-screen grid-cols-2">
        {/* Coluna esquerda — branding/hero */}
        <div className="relative flex flex-col items-center justify-center p-10 lg:p-14 xl:p-20 border-r border-[#1f1f1f] bg-gradient-to-br from-[#0a0a0a] via-[#080808] to-[#030303] overflow-hidden">
          {/* glow */}
          <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#c9a961]/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-[#c9a961]/5 blur-[100px] pointer-events-none" />

          {/* Top: voltar + status (absoluto) */}
          <div
            className="absolute top-8 left-10 lg:left-14 xl:left-20 right-10 lg:right-14 xl:right-20 flex items-center justify-between text-[11px] tracking-[0.2em] text-zinc-500"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:text-[#c9a961] transition-colors group"
            >
              <ChevronLeft className="h-3 w-3 text-[#c9a961] group-hover:-translate-x-0.5 transition-transform" />
              VOLTAR
            </button>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full bg-[#c9a961] opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 bg-[#c9a961]" />
              </span>
              <span>NODE_SECURE</span>
            </div>
          </div>

          {/* Centro: logo + manifesto */}
          <div className="relative flex flex-col gap-7 max-w-[520px] w-full">
            <img
              src={logoWhite}
              alt="Eu Quero Armas"
              className="h-20 lg:h-24 w-auto object-contain drop-shadow-[0_8px_40px_rgba(201,169,97,0.35)]"
              draggable={false}
            />
            <div
              className="inline-flex w-fit text-[10px] tracking-[0.3em] text-zinc-500 px-3 py-1 border border-zinc-800"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              PROTOCOLO_LEGAL_ARMAMENTO
            </div>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-widest text-white leading-tight">
              ÁREA DO <span className="text-[#c9a961]">OPERADOR</span>
            </h1>
            <p
              className="text-sm lg:text-base tracking-[0.15em] text-zinc-400 normal-case"
              style={{ fontFamily: "'Rajdhani', sans-serif" }}
            >
              Acompanhe seus processos, documentos e protocolos jurídicos em tempo real. Acesso restrito a clientes ativos.
            </p>

            {/* Stats / HUD */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { k: "ICP", v: "BRASIL" },
                { k: "AES", v: "256-GCM" },
                { k: "UPTIME", v: "99.9%" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="border border-[#1f1f1f] p-3 bg-black/40 flex flex-col gap-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span className="text-[9px] tracking-[0.25em] text-zinc-600">{s.k}</span>
                  <span className="text-xs tracking-[0.2em] text-[#c9a961]">{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé (absoluto) */}
          <div
            className="absolute bottom-8 left-10 lg:left-14 xl:left-20 text-[10px] tracking-[0.25em] text-zinc-600"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            © {new Date().getFullYear()} EU QUERO ARMAS // SECURE_TERMINAL
          </div>
        </div>

        {/* Coluna direita — autenticação */}
        <div className="relative flex items-center justify-center p-10 lg:p-14 xl:p-20 bg-[#030303]">
          <div className="w-full max-w-[460px] flex flex-col gap-8">
            {/* PRIMEIRO ACESSO */}
            <div className="flex flex-col gap-2">
              <div
                className="text-[10px] tracking-[0.2em] text-zinc-500 pl-2 border-l-2 border-[#c9a961]/50"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                &gt; Inicializar Registro
              </div>
              <button
                type="button"
                onClick={() => navigate("/ativar-acesso")}
                className="w-full relative bg-[#c9a961]/5 hover:bg-[#c9a961]/10 border border-[#c9a961]/40 hover:border-[#c9a961] p-6 lg:p-7 flex items-center gap-5 transition-all shadow-[0_0_25px_rgba(201,169,97,0.15)] hover:shadow-[0_0_45px_rgba(201,169,97,0.35)] group"
              >
                <div className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-[#c9a961]" />
                <div className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-[#c9a961]" />
                <div className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-[#c9a961]" />
                <div className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-[#c9a961]" />

                <Sparkles className="h-7 w-7 text-[#c9a961] group-hover:scale-110 transition-transform shrink-0" />
                <div className="flex flex-col items-start text-left gap-1">
                  <span className="text-xl lg:text-2xl font-bold tracking-widest text-white">
                    PRIMEIRO ACESSO
                  </span>
                  <span
                    className="text-[11px] tracking-[0.25em] text-[#c9a961]"
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

            {/* Form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label
                  className="text-[10px] tracking-[0.2em] text-zinc-500"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  ID CREDENCIAL
                </label>
                <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#c9a961]/60 bg-black/40 transition-colors">
                  <span
                    className="text-[#c9a961]/60 text-sm pl-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    &gt;
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="seu@email.com"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    name="email"
                    className="w-full bg-transparent p-3.5 text-sm text-white outline-none placeholder:text-zinc-700 placeholder:tracking-wider"
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
                <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#c9a961]/60 bg-black/40 transition-colors">
                  <span
                    className="text-[#c9a961]/60 text-sm pl-3"
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
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    name="password"
                    className="w-full bg-transparent p-3.5 text-sm text-white outline-none placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-zinc-500 hover:text-[#c9a961] tracking-[0.2em] transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  [ RECUPERAR ]
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-[#1f1f1f] hover:border-[#c9a961] hover:bg-[#c9a961]/5 px-8 py-3 text-[13px] tracking-[0.2em] text-zinc-200 hover:text-white font-bold bg-[#030303] transition-all active:scale-[0.98] inline-flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "EXECUTAR LOGIN >"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Webfont loader */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap"
      />
      <style>{`
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .qa-login-shell { min-height: 100svh; height: 100svh; overflow: hidden; }
        @media (max-height: 820px), (max-width: 480px) {
          .qa-login-shell { height: auto; min-height: 100svh; overflow-y: auto; align-items: flex-start; padding-top: 1rem; padding-bottom: 1rem; }
        }
        @media (min-width: 768px) {
          .qa-login-shell { padding: 0; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}
