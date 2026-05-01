import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Sparkles, Eye, EyeOff, ShieldCheck } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { requestQAPasswordReset } from "@/shared/quero-armas/passwordReset";

export default function QAClienteLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
    const result = await requestQAPasswordReset(email);
    if (result.success) {
      toast.success("Se existir uma conta com este e-mail, enviaremos as instruções de redefinição.");
    } else {
      toast.error(result.errorMessage || "Não foi possível enviar o e-mail de redefinição. Tente novamente em instantes.");
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

      // Aceita: (a) admin QA com perfil ativo OU (b) cliente vinculado no portal Quero Armas
      const [{ data: qaProfile }, { data: clienteLink }] = await Promise.all([
        supabase
          .from("qa_usuarios_perfis" as any)
          .select("id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("cliente_auth_links" as any)
          .select("id, status, qa_cliente_id, customer_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

      if (!qaProfile && !clienteLink) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Conta sem vínculo de cliente ativo.");
        return;
      }

      toast.success("Bem-vindo!");
      const next = searchParams.get("next");
      navigate(next && next.startsWith("/") ? next : "/area-do-cliente", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Acesso seguro
        </span>
      </div>

      <div className="flex-1 grid md:grid-cols-2">
        {/* Coluna esquerda — branding premium light */}
        <div className="hidden md:flex relative flex-col items-center justify-center p-10 lg:p-14 bg-white border-r border-slate-200">
          <div className="max-w-[480px] w-full flex flex-col gap-6">
            <img src={logoColor} alt="Eu Quero Armas" className="h-16 w-auto object-contain" draggable={false} />
            <span className="inline-flex w-fit items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-slate-500 px-2.5 py-1 border border-slate-200 rounded-md bg-slate-50">
              Protocolo Legal · Armamento
            </span>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              Área do <span className="text-amber-600">Operador</span>
            </h1>
            <p className="text-sm lg:text-base text-slate-600">
              Acompanhe seus processos, documentos e protocolos em tempo real. Acesso restrito a clientes ativos.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { k: "ICP", v: "BRASIL" },
                { k: "AES", v: "256-GCM" },
                { k: "UPTIME", v: "99.9%" },
              ].map((s) => (
                <div key={s.k} className="border border-slate-200 bg-white p-3 rounded-md shadow-sm flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-slate-500">{s.k}</span>
                  <span className="text-[12px] font-bold tracking-wider text-slate-900">{s.v}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-slate-400 mt-4">
              © {new Date().getFullYear()} Eu Quero Armas
            </div>
          </div>
        </div>

        {/* Coluna direita — autenticação */}
        <div className="flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-14">
          <div className="w-full max-w-md flex flex-col gap-6">
            <div className="md:hidden flex flex-col items-center gap-3 mb-2">
              <img src={logoColor} alt="Eu Quero Armas" className="h-12 w-auto object-contain" draggable={false} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Protocolo Legal · Armamento
              </span>
            </div>

            {/* PRIMEIRO ACESSO — destaque */}
            <button
              type="button"
              onClick={() => navigate("/ativar-acesso")}
              className="group w-full rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 p-5 flex items-center gap-4 transition-all shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex flex-col items-start text-left gap-0.5">
                <span className="text-base font-bold uppercase tracking-wide text-slate-900">
                  Primeiro acesso
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-amber-700">
                  Ativar minha conta
                </span>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                Já tenho conta
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-slate-500">
                  E-mail
                </label>
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
                  className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wider text-slate-500">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    name="password"
                    className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors"
                >
                  Esqueci minha senha
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold tracking-wide transition disabled:opacity-60 shadow-sm"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </form>

            <div className="text-center text-xs text-slate-500">
              Não tem conta?{" "}
              <Link to="/area-do-cliente/criar-conta" className="text-slate-900 font-semibold hover:underline">
                Criar conta gratuita
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
