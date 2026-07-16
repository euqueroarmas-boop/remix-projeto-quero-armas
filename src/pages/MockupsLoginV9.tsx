import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Crosshair,
  Shield,
  Lock as LockIcon,
  Star,
  Briefcase,
  Loader2,
} from "lucide-react";
import bgAsset from "@/assets/quero-armas-tactical-bench.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { requestQAPasswordReset } from "@/shared/quero-armas/passwordReset";
import { ArsenalLogo } from "@/components/quero-armas/arsenal/ArsenalLogo";

const BG_URL = bgAsset.url;

const CATEGORIAS = [
  { label: "CAC", Icon: Crosshair },
  { label: "DEFESA PESSOAL", Icon: Shield },
  { label: "SEGURANÇA", Icon: LockIcon },
  { label: "COLECIONADOR", Icon: Star },
  { label: "EMPRESA", Icon: Briefcase },
];

/**
 * Login da Área do Cliente — Quero Armas (visual v9 + auth real).
 * Métodos: Google, Apple (OAuth), E-mail/Senha. Vínculo automático a
 * qa_clientes via trigger; fallback por CPF via RPC qa_vincular_por_cpf.
 */
export default function MockupsLoginV9() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customHero, setCustomHero] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("qa_branding" as any)
      .select("data_url")
      .eq("chave", "cliente_login_hero")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setCustomHero(((data as any)?.data_url as string) || null);
      }, () => {});
    return () => { alive = false; };
  }, []);

  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);

  const [needCpf, setNeedCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [loadingCpf, setLoadingCpf] = useState(false);

  const nextPath = (() => {
    const n = searchParams.get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/area-do-cliente";
  })();

  async function ensureLinkedOrPromptCpf(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: link } = await supabase
      .from("cliente_auth_links" as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (link) return true;
    setNeedCpf(true);
    toast.info("Para finalizar, informe seu CPF para localizarmos seu cadastro.");
    return false;
  }

  // Retorno do OAuth (Google/Apple): se já há sessão ao montar, segue o fluxo.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) return;
      const ok = await ensureLinkedOrPromptCpf();
      if (ok && mounted) navigate(nextPath, { replace: true });
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSocial(provider: "google" | "apple") {
    setLoadingProvider(provider);
    try {
      try { localStorage.setItem("qa_oauth_next", nextPath); } catch { /* storage indisponível */ }
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth/callback",
      });
      if (result.error) {
        toast.error(`Não foi possível entrar com ${provider === "google" ? "Google" : "Apple"}. Tente novamente.`);
        return;
      }
      if (result.redirected) return;
      const ok = await ensureLinkedOrPromptCpf();
      if (ok) { toast.success("Bem-vindo!"); navigate(nextPath, { replace: true }); }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao autenticar");
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingEmail(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
      if (error) { toast.error("E-mail ou senha incorretos."); return; }
      const ok = await ensureLinkedOrPromptCpf();
      if (ok) { toast.success("Bem-vindo!"); navigate(nextPath, { replace: true }); }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao autenticar");
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    setResetLoading(true);
    try {
      const r = await requestQAPasswordReset(email.trim().toLowerCase());
      if (r.success) toast.success("Se existir conta com este e-mail, enviaremos as instruções.");
      else toast.error(r.errorMessage || "Não foi possível enviar o e-mail.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleLinkByCpf(e: React.FormEvent) {
    e.preventDefault();
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) { toast.error("Informe um CPF válido (11 dígitos)."); return; }
    setLoadingCpf(true);
    try {
      const { data, error } = await supabase.rpc("qa_vincular_por_cpf" as any, { _cpf: digits });
      if (error) { toast.error("Erro ao vincular cadastro."); return; }
      const res = data as any;
      if (res?.ok) { toast.success("Cadastro vinculado!"); navigate(nextPath, { replace: true }); return; }
      const reason = res?.reason as string | undefined;
      if (reason === "cliente_nao_encontrado") toast.error("Nenhum cadastro encontrado com este CPF. Verifique ou faça novo cadastro.");
      else if (reason === "contato_divergente") toast.error("Para sua segurança, o e-mail/telefone do cadastro deve coincidir com o usado no login. Procure a equipe Quero Armas.");
      else toast.error("Não foi possível vincular. Tente novamente.");
    } finally {
      setLoadingCpf(false);
    }
  }

  async function handleCancelCpf() {
    await supabase.auth.signOut();
    setNeedCpf(false);
    setCpf("");
  }

  const inputCls =
    "h-[48px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#B41E2D] focus:shadow-[0_0_0_3px_rgba(180,30,45,0.18)]";

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-black font-sans text-white"
      style={{
        backgroundImage: `url(${customHero || BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlays LEVES — a foto aparece; escurece só atrás do card (direita) e nas bordas */}
      {!customHero && (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.04) 32%, rgba(0,0,0,0.10) 58%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,0.80) 100%)" }} />
          <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 150px 26px rgba(0,0,0,0.48)" }} />
          <div className="pointer-events-none absolute right-[3vw] top-1/2 hidden h-[560px] w-[560px] -translate-y-1/2 rounded-full opacity-40 blur-3xl lg:block" style={{ background: "radial-gradient(circle, rgba(180,30,45,0.35) 0%, transparent 70%)" }} />
        </>
      )}

      {/* Overlay leve à direita quando há imagem custom, para o card manter contraste. */}
      {customHero && (
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,0.80) 100%)" }} />
      )}

      {/* Patrocínio + textos do hero — ocultos quando há imagem custom (usuário quer só a imagem) */}
      {!customHero && (
      <div className="absolute left-6 top-6 z-20 flex items-center gap-3 lg:left-12 lg:top-10">
        <div className="leading-tight">
          <div className="mb-1 text-[10px] font-semibold tracking-[0.28em] text-white/65" style={{ fontFamily: "Rajdhani, sans-serif" }}>PATROCINADO POR</div>
          <div className="flex items-center gap-2.5">
            <TaurusBull />
            <span className="text-[26px] font-bold leading-none tracking-[0.18em] text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
              TAURUS<span className="align-top text-[10px] text-white/70">™</span>
            </span>
          </div>
        </div>
      </div>
      )}

      {/* ESQUERDA */}
      {!customHero && (
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col justify-center px-6 pt-28 pb-10 lg:px-12 lg:pt-0 lg:pb-0">
        <div className="w-full max-w-[560px] lg:max-w-[600px] lg:pr-8">
          <h1 className="text-[44px] font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-[56px] lg:text-[64px]" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "-0.01em", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>CONTROLE TOTAL</h1>
          <h2 className="mt-2 text-2xl font-bold uppercase leading-tight text-white/80 sm:text-3xl lg:text-[34px]" style={{ fontFamily: "Oswald, sans-serif" }}>DOS SEUS DOCUMENTOS</h2>
          <div className="mt-6 flex max-w-lg items-start gap-3">
            <div className="mt-1 h-12 w-[3px] bg-[#B41E2D]" />
            <p className="text-sm uppercase tracking-[0.12em] text-white/80 sm:text-base" style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 500 }}>
              CR, CRAF, PORTE, POSSE, GUIAS DE TRÁFEGO,<br />VENCIMENTOS E PROCESSOS.
            </p>
          </div>
          <div className="mt-8 flex max-w-[520px] flex-wrap gap-2.5">
            {CATEGORIAS.map(({ label, Icon }) => (
              <div key={label} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/[0.16] bg-black/55 px-3.5 backdrop-blur-md transition-colors hover:border-[#B41E2D]/60">
                <Icon className="h-3.5 w-3.5 text-[#B41E2D]" strokeWidth={2} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90" style={{ fontFamily: "Rajdhani, sans-serif" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* DIREITA — CARD */}
      <div className="relative z-20 mx-auto w-full max-w-[340px] px-6 pb-10 lg:absolute lg:right-[5vw] lg:top-1/2 lg:mx-0 lg:-translate-y-1/2 lg:px-0 lg:pb-0">
        <div className="relative rounded-2xl p-5 sm:p-6" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(18px) saturate(1.1)", WebkitBackdropFilter: "blur(18px) saturate(1.1)", border: "1px solid rgba(180,30,45,0.75)", boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 0 28px rgba(180,30,45,0.22)" }}>
          <div className="mb-4 flex justify-center">
            <ArsenalLogo height={34} />
          </div>
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B41E2D]/70" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600" style={{ fontFamily: "Rajdhani, sans-serif" }}>Área Restrita</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B41E2D]/70" />
          </div>

          {needCpf ? (
            <form className="space-y-4" onSubmit={handleLinkByCpf}>
              <p className="text-xs leading-relaxed text-slate-600">Não localizamos seu cadastro automaticamente. Informe seu <strong className="text-slate-900">CPF</strong> para vincular.</p>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700" style={{ fontFamily: "Rajdhani, sans-serif" }}>CPF</label>
                <input type="text" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} autoFocus className="h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#B41E2D] focus:shadow-[0_0_0_3px_rgba(180,30,45,0.18)]" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCancelCpf} className="h-[48px] flex-1 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={loadingCpf} className="flex h-[48px] flex-[1.4] items-center justify-center gap-2 rounded-lg bg-[#B41E2D] text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#7A1F2B] disabled:opacity-60" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {loadingCpf && <Loader2 className="h-4 w-4 animate-spin" />}Vincular
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700" style={{ fontFamily: "Rajdhani, sans-serif" }}>E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700" style={{ fontFamily: "Rajdhani, sans-serif" }}>Senha</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type={showPwd ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-[48px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#B41E2D] focus:shadow-[0_0_0_3px_rgba(180,30,45,0.18)]" />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-700" aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loadingEmail} className="mt-2 flex h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#B41E2D] text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_24px_rgba(180,30,45,0.35)] transition-all hover:bg-[#7A1F2B] active:scale-[0.99] disabled:opacity-60" style={{ fontFamily: "Oswald, sans-serif" }}>
                {loadingEmail && <Loader2 className="h-4 w-4 animate-spin" />}Entrar
              </button>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500" style={{ fontFamily: "Rajdhani, sans-serif" }}>Ou continue com</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-2.5">
                <button type="button" onClick={() => handleSocial("google")} disabled={loadingProvider !== null} className="flex h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-all hover:border-[#B41E2D]/40 hover:bg-slate-50 disabled:opacity-60">
                  {loadingProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}Continuar com Google
                </button>
                <button type="button" onClick={() => handleSocial("apple")} disabled={loadingProvider !== null} className="flex h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-all hover:border-[#B41E2D]/40 hover:bg-slate-50 disabled:opacity-60">
                  {loadingProvider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}Continuar com Apple
                </button>
              </div>
              <div className="flex items-center justify-between pt-3 text-xs">
                <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-60">{resetLoading ? "Enviando..." : "Esqueceu a senha?"}</button>
                <Link to="/cadastro" className="font-semibold text-[#B41E2D] transition-colors hover:text-[#E03546]">Criar conta →</Link>
              </div>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.22em] text-slate-400">Ambiente Seguro · Acesso Auditado</p>
      </div>
    </div>
  );
}

function TaurusBull() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true" fill="none">
      <path d="M20 10c-4 0-7 2-9 5-2-1-4-1-5 0-1 1 0 4 2 5 1 1 2 1 3 1 1 4 5 7 9 7s8-3 9-7c1 0 2 0 3-1 2-1 3-4 2-5-1-1-3-1-5 0-2-3-5-5-9-5z" fill="#B41E2D" />
      <circle cx="16" cy="22" r="1.4" fill="#0a0a0a" />
      <circle cx="24" cy="22" r="1.4" fill="#0a0a0a" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.4 12.6c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.5 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.2 3.1-2.4.6-.9 1.1-1.9 1.4-2.9-2.3-.9-3.1-2.6-3.1-4zM14 4.7c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.2.1 2.3-.6 3-1.4z" />
    </svg>
  );
}
