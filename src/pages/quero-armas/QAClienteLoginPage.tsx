import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Sparkles, Eye, EyeOff, ShieldCheck } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { requestQAPasswordReset } from "@/shared/quero-armas/passwordReset";
import { GoogleSignInButton } from "@/shared/auth/GoogleSignInButton";

const RESET_COOLDOWN_MS = 60_000;

export default function QAClienteLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [diag, setDiag] = useState<{ reason: string; hint: string } | null>(null);
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
    if (resetLoading) return;
    const now = Date.now();
    if (resetCooldownUntil > now) {
      toast.info("Aguarde alguns instantes antes de solicitar outro link. Use o e-mail mais recente recebido.");
      return;
    }
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      try { localStorage.setItem("qa_password_reset_next", next); } catch { /* storage indisponível */ }
    }
    setResetLoading(true);
    try {
      const result = await requestQAPasswordReset(email);
      if (result.success) {
        setResetCooldownUntil(Date.now() + RESET_COOLDOWN_MS);
        toast.success("Se existir uma conta com este e-mail, enviaremos as instruções de redefinição.");
      } else {
        toast.error(result.errorMessage || "Não foi possível enviar o e-mail de redefinição. Tente novamente em instantes.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDiag(null);
    try {
      // Normalização defensiva — o input já força lowercase, mas garante trim e lower aqui.
      const emailNorm = (email || "").trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
      if (error) {
        // Diagnóstico seguro server-side antes de mostrar a mensagem genérica.
        const msg = String(error.message || "").toLowerCase();
        const isInvalid = msg.includes("invalid login credentials") || msg.includes("invalid_credentials");
        if (isInvalid) {
          try {
            const { data } = await supabase.functions.invoke("qa-login-diagnostico", {
              body: { email: emailNorm },
            });
            const reason = (data as any)?.reason as string | undefined;
            const hint = (data as any)?.hint as string | undefined;
            if (reason && hint) {
              setDiag({ reason, hint });
              toast.error(hint);
              return;
            }
          } catch { /* fallback genérico abaixo */ }
          toast.error("Não foi possível autenticar. Verifique e-mail/senha ou use 'Primeiro acesso'.");
          return;
        }
        throw error;
      }
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

      let efectiveLink = clienteLink as any;

      // FALLBACK 0: vínculo direto via qa_clientes.user_id (provisionamento legado
      // que não criou cliente_auth_links). Repara silenciosamente.
      if (!qaProfile && !efectiveLink) {
        const { data: clienteDireto } = await supabase
          .from("qa_clientes" as any)
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (clienteDireto && (clienteDireto as any).status !== "excluido_lgpd") {
          const { data: novoLink } = await supabase
            .from("cliente_auth_links" as any)
            .insert({
              qa_cliente_id: (clienteDireto as any).id,
              user_id: user.id,
              email: emailNorm,
              status: "active",
              activated_at: new Date().toISOString(),
            })
            .select("id, status, qa_cliente_id, customer_id")
            .maybeSingle();
          if (novoLink) {
            efectiveLink = novoLink;
            console.warn("[QAClienteLogin] Link criado a partir de qa_clientes.user_id para cliente", (clienteDireto as any).id);
          }
        }
      }

      // FALLBACK SEGURO: vínculo ausente para esse user_id, mas existe link
      // ativo localizável pelo e-mail normalizado e cliente correspondente ativo
      // e único. Repara o vínculo sem expor outros clientes.
      if (!qaProfile && !efectiveLink && emailNorm) {
        const { data: linksByEmail } = await supabase
          .from("cliente_auth_links" as any)
          .select("id, status, qa_cliente_id, customer_id, user_id, email")
          .ilike("email", emailNorm);

        const candidates = (linksByEmail || []) as any[];
        const semConflito =
          candidates.length > 0 &&
          candidates.every((l) => !l.user_id || l.user_id === user.id);
        const apontandoEsteCliente = candidates.filter(
          (l) => l.status === "active" && l.qa_cliente_id,
        );
        // Único candidato ativo + sem conflito => repara silenciosamente.
        if (semConflito && apontandoEsteCliente.length === 1) {
          const repair = apontandoEsteCliente[0];
          await supabase
            .from("cliente_auth_links" as any)
            .update({
              user_id: user.id,
              email: emailNorm,
              status: "active",
              activated_at: new Date().toISOString(),
              motivo: null,
              email_pendente: null,
            })
            .eq("id", repair.id);
          efectiveLink = { ...repair, user_id: user.id };
          console.warn("[QAClienteLogin] Vínculo reparado automaticamente para user", user.id, "cliente", repair.qa_cliente_id);
        }
      }

      if (!qaProfile && !efectiveLink) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Conta sem vínculo de cliente ativo. Solicite ao admin: Reparar vínculo do portal.");
        return;
      }

      // Atualiza last_login_at para diagnóstico
      if (efectiveLink?.id) {
        supabase
          .from("cliente_auth_links" as any)
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", efectiveLink.id)
          .then(() => {}, () => {});
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
            <img src={logoColor} alt="Quero Armas" className="h-16 w-auto object-contain" draggable={false} />
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
              © {new Date().getFullYear()} Quero Armas
            </div>
          </div>
        </div>

        {/* Coluna direita — autenticação */}
        <div className="flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-14">
          <div className="w-full max-w-md flex flex-col gap-6">
            <div className="md:hidden flex flex-col items-center gap-3 mb-2">
              <img src={logoColor} alt="Quero Armas" className="h-12 w-auto object-contain" draggable={false} />
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
                  disabled={resetLoading}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resetLoading ? "Enviando..." : "Esqueci minha senha"}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-[#7A1F2B] hover:bg-[#641722] text-white text-sm font-semibold tracking-wide transition disabled:opacity-60 shadow-sm"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400">ou continue com</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
            <GoogleSignInButton
              mode="cliente"
              next={searchParams.get("next") || undefined}
            />

            {diag && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left flex flex-col gap-3"
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-amber-700">
                  Diagnóstico do acesso
                </span>
                <p className="text-sm text-slate-800 leading-relaxed">{diag.hint}</p>
                <div className="flex flex-wrap gap-2">
                  {(diag.reason === "auth_user_nao_existe" ||
                    diag.reason === "cliente_sem_acesso_ativado" ||
                    diag.reason === "vinculo_cliente_auth_quebrado") && (
                    <button
                      type="button"
                      onClick={() => navigate("/ativar-acesso")}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold tracking-wide"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Primeiro acesso
                    </button>
                  )}
                  {(diag.reason === "senha_incorreta" ||
                    diag.reason === "vinculo_cliente_auth_quebrado") && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {resetLoading ? "Enviando..." : "Redefinir senha"}
                    </button>
                  )}
                </div>
              </div>
            )}

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
