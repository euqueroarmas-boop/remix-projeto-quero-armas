import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Phone, Mail, ShieldCheck, ChevronLeft, Loader2, Sparkles, ChevronRight, Pause, Play, Star } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { requestQAPasswordReset } from "@/shared/quero-armas/passwordReset";

type Tab = "email" | "telefone";
type PhoneStep = "input" | "code";

// Enquanto não houver provedor SMS configurado no backend, a aba Telefone
// fica visível porém desabilitada com selo "Em breve".
const PHONE_LOGIN_ENABLED = false;

/**
 * Login da Área do Cliente — Quero Armas
 * Métodos: Google, Apple, E-mail/Senha, Telefone (SMS OTP)
 * Vinculação automática a qa_clientes via trigger qa_auto_link_auth_user (e-mail/celular)
 * Fallback por CPF via RPC qa_vincular_por_cpf
 */
export default function QAClienteLoginV2Page() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("email");
  const [showPwd, setShowPwd] = useState(false);

  // Email/senha
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Telefone
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("input");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [otp, setOtp] = useState("");
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [phoneE164, setPhoneE164] = useState("");

  // Social
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);

  // Fallback CPF
  const [needCpf, setNeedCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [loadingCpf, setLoadingCpf] = useState(false);

  const nextPath = (() => {
    const n = searchParams.get("next");
    return n && n.startsWith("/") ? n : "/area-do-cliente";
  })();

  /** Garante que o usuário autenticado tem vínculo com qa_cliente.
   *  Se não tiver, ativa o modo CPF. Retorna true se pôde prosseguir. */
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

    // Trigger não conseguiu vincular automaticamente → pede CPF
    setNeedCpf(true);
    toast.info("Para finalizar, informe seu CPF para localizarmos seu cadastro.");
    return false;
  }

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
      if (result.redirected) return; // browser redireciona

      const ok = await ensureLinkedOrPromptCpf();
      if (ok) {
        toast.success("Bem-vindo!");
        navigate(nextPath, { replace: true });
      }
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
      if (error) {
        toast.error("E-mail ou senha incorretos.");
        return;
      }
      const ok = await ensureLinkedOrPromptCpf();
      if (ok) {
        toast.success("Bem-vindo!");
        navigate(nextPath, { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao autenticar");
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    setResetLoading(true);
    try {
      const r = await requestQAPasswordReset(email.trim().toLowerCase());
      if (r.success) {
        toast.success("Se existir conta com este e-mail, enviaremos as instruções.");
      } else {
        toast.error(r.errorMessage || "Não foi possível enviar o e-mail.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  function normalizePhone(input: string): string | null {
    const digits = input.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return null;
    // Se já vier com 55, mantém; senão prefixa
    const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : "55" + digits;
    return "+" + withCountry;
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const e164 = normalizePhone(phoneRaw);
    if (!e164) {
      toast.error("Informe um celular válido com DDD.");
      return;
    }
    setLoadingPhone(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) {
        toast.error(error.message || "Não foi possível enviar o código.");
        return;
      }
      setPhoneE164(e164);
      setPhoneStep("code");
      toast.success("Código SMS enviado.");
    } finally {
      setLoadingPhone(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Informe os 6 dígitos do código.");
      return;
    }
    setLoadingPhone(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: otp,
        type: "sms",
      });
      if (error) {
        toast.error("Código inválido ou expirado.");
        return;
      }
      const ok = await ensureLinkedOrPromptCpf();
      if (ok) {
        toast.success("Bem-vindo!");
        navigate(nextPath, { replace: true });
      }
    } finally {
      setLoadingPhone(false);
    }
  }

  async function handleLinkByCpf(e: React.FormEvent) {
    e.preventDefault();
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Informe um CPF válido (11 dígitos).");
      return;
    }
    setLoadingCpf(true);
    try {
      const { data, error } = await supabase.rpc("qa_vincular_por_cpf" as any, { _cpf: digits });
      if (error) {
        toast.error("Erro ao vincular cadastro.");
        return;
      }
      const res = data as any;
      if (res?.ok) {
        toast.success("Cadastro vinculado!");
        navigate(nextPath, { replace: true });
        return;
      }
      const reason = res?.reason as string | undefined;
      if (reason === "cliente_nao_encontrado") {
        toast.error("Nenhum cadastro encontrado com este CPF. Verifique ou faça novo cadastro.");
      } else if (reason === "contato_divergente") {
        toast.error("Para sua segurança, o e-mail/telefone do cadastro deve coincidir com o usado no login. Procure a equipe Quero Armas.");
      } else {
        toast.error("Não foi possível vincular. Tente novamente.");
      }
    } finally {
      setLoadingCpf(false);
    }
  }

  async function handleCancelCpf() {
    await supabase.auth.signOut();
    setNeedCpf(false);
    setCpf("");
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-white" style={{ background: "#050505" }}>
      {/* Ambient backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(122,31,43,0.55) 0%, rgba(122,31,43,0) 70%)", filter: "blur(40px)" }} />
        <div className="absolute -bottom-40 -right-32 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(214,166,75,0.18) 0%, rgba(214,166,75,0) 70%)", filter: "blur(40px)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/60 hover:text-white transition"
        >
          <ChevronLeft size={14} /> Voltar
        </button>
        <img src={logoColor} alt="Quero Armas" className="h-7 w-auto opacity-90" />
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/40">
          <ShieldCheck size={12} /> LGPD
        </span>
      </header>

      <main className="relative z-10 px-6 lg:px-12 pb-10">
        <div className="mx-auto w-full max-w-[420px] flex items-center justify-center min-h-[calc(100vh-140px)]">
          {/* Login card */}
          <div className="w-full max-w-[420px] mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] p-6 lg:p-7">
            <div className="mb-5">
              <span className="text-[9px] font-bold uppercase tracking-[0.32em]" style={{ color: "#D6A64B" }}>Área do Cliente</span>
              <h1 className="text-2xl font-bold text-white mt-1.5" style={{ fontFamily: "Oswald,'Arial Narrow',Arial,sans-serif", letterSpacing: ".01em" }}>
                Acesse sua conta
              </h1>
              <p className="text-[12.5px] text-white/55 mt-1">
                Seu arsenal, processos e prazos num só lugar.
              </p>
            </div>
            {needCpf ? (
              <form onSubmit={handleLinkByCpf} className="space-y-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white mb-1">
                    Localizar seu cadastro
                  </h2>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Não localizamos seu cadastro automaticamente pelo e-mail/telefone do login. Informe seu <strong>CPF</strong> para vincular.
                  </p>
                </div>
                <Field label="CPF">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="qa-input"
                    autoFocus
                  />
                </Field>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelCpf}
                    className="h-11 px-4 rounded-lg border border-white/15 text-sm font-semibold text-white/70 hover:bg-white/[0.05]"
                  >
                    Cancelar
                  </button>
                  <SubmitBtn loading={loadingCpf}>Vincular cadastro</SubmitBtn>
                </div>
              </form>
            ) : (
              <>
                {/* Social */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocial("google")}
                    disabled={loadingProvider !== null}
                    className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg border border-white/15 bg-white hover:bg-white/90 transition text-sm font-medium text-black disabled:opacity-60"
                  >
                    {loadingProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continuar com Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocial("apple")}
                    disabled={loadingProvider !== null}
                    className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg bg-white/[0.06] border border-white/15 hover:bg-white/[0.1] transition text-sm font-medium text-white disabled:opacity-60"
                  >
                    {loadingProvider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
                    Continuar com Apple
                  </button>
                </div>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">ou</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="flex rounded-lg bg-white/[0.05] p-1 mb-4">
                  <TabButton active={tab === "email"} onClick={() => setTab("email")}>
                    <Mail size={14} /> E-mail
                  </TabButton>
                  <TabButton
                    active={tab === "telefone"}
                    onClick={() => {
                      if (!PHONE_LOGIN_ENABLED) {
                        toast.info("Login por telefone (SMS) chega em breve. Por enquanto, use Google, Apple ou e-mail.");
                        return;
                      }
                      setTab("telefone");
                      setPhoneStep("input");
                    }}
                    disabled={!PHONE_LOGIN_ENABLED}
                  >
                    <Phone size={14} /> Telefone
                    {!PHONE_LOGIN_ENABLED && (
                      <span className="ml-1 text-[8px] uppercase tracking-[0.18em] bg-amber-300/20 text-amber-300 px-1.5 py-0.5 rounded">
                        em breve
                      </span>
                    )}
                  </TabButton>
                </div>

                {tab === "email" || !PHONE_LOGIN_ENABLED ? (
                  <form className="space-y-3" onSubmit={handleEmailLogin}>
                    <Field label="E-mail">
                      <input
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        placeholder="seu@email.com"
                        className="qa-input"
                      />
                    </Field>
                    <Field label="Senha">
                      <div className="relative">
                        <input
                          type={showPwd ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="qa-input pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white"
                          tabIndex={-1}
                        >
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetLoading}
                        className="text-xs uppercase tracking-wider text-[#D6A64B] hover:underline disabled:opacity-60"
                      >
                        {resetLoading ? "Enviando..." : "Esqueci minha senha"}
                      </button>
                    </div>
                    <SubmitBtn loading={loadingEmail}>Entrar</SubmitBtn>
                  </form>
                ) : phoneStep === "input" ? (
                  <form className="space-y-3" onSubmit={handleSendOtp}>
                    <Field label="Celular com DDD">
                      <div className="flex gap-2">
                        <select className="qa-input w-24 shrink-0" disabled>
                          <option>+55</option>
                        </select>
                        <input
                          type="tel"
                          required
                          inputMode="numeric"
                          placeholder="(11) 99999-9999"
                          value={phoneRaw}
                          onChange={(e) => setPhoneRaw(e.target.value)}
                          className="qa-input flex-1"
                        />
                      </div>
                    </Field>
                    <p className="text-xs text-white/55 leading-relaxed">
                      Enviaremos um <strong>código SMS de 6 dígitos</strong> para confirmar seu acesso.
                    </p>
                    <SubmitBtn loading={loadingPhone}>Receber código</SubmitBtn>
                  </form>
                ) : (
                  <form className="space-y-3" onSubmit={handleVerifyOtp}>
                    <Field label={`Código enviado para ${phoneE164}`}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="qa-input tracking-[0.5em] text-center font-mono text-lg"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setPhoneStep("input"); setOtp(""); }}
                        className="h-11 px-4 rounded-lg border border-white/15 text-xs font-semibold uppercase tracking-wider text-white/70 hover:bg-white/[0.05]"
                      >
                        Trocar nº
                      </button>
                      <SubmitBtn loading={loadingPhone}>Confirmar código</SubmitBtn>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {!needCpf && (
            <>
              <button
                type="button"
                onClick={() => navigate("/ativar-acesso")}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-[#D6A64B]/40 bg-[#D6A64B]/10 hover:bg-[#D6A64B]/15 text-[#D6A64B] text-xs font-semibold uppercase tracking-wider transition"
              >
                <Sparkles size={14} /> Primeiro acesso · Ativar conta
              </button>

              <p className="text-center text-sm text-white/60 mt-6">
                Ainda não tem cadastro?{" "}
                <Link
                  to="/cadastro"
                  className="text-[#D6A64B] font-semibold uppercase tracking-wider text-xs hover:underline"
                >
                  Criar cadastro
                </Link>
              </p>
            </>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] uppercase tracking-wider text-white/40">
            <ShieldCheck size={14} />
            Conexão protegida · LGPD
          </div>
          </div>
        </div>
      </main>

      <style>{`
        .qa-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .qa-input::placeholder { color: rgba(255,255,255,0.35); }
        .qa-input:focus {
          border-color: #D6A64B;
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(214,166,75,0.18);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-black/70 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function TabButton({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-xs uppercase tracking-wider font-semibold transition ${
        active ? "bg-white text-black shadow-sm" : "text-white/55 hover:text-white"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function SubmitBtn({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex-1 w-full h-11 rounded-lg bg-[#7A1F2B] hover:bg-[#8a2532] transition text-white text-sm font-semibold uppercase tracking-[0.18em] inline-flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_8px_24px_-8px_rgba(122,31,43,0.6)]"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.02-.81.87-2.13 1.55-3.22 1.46-.13-1.1.42-2.25 1.16-3.05.83-.9 2.24-1.55 3.24-1.43zM20.5 17.2c-.55 1.27-.81 1.83-1.51 2.94-.97 1.55-2.34 3.49-4.05 3.5-1.51.01-1.9-.99-3.95-.98-2.05.01-2.48 1-3.99.98-1.71-.01-3.01-1.77-3.98-3.32-2.71-4.34-3-9.43-1.32-12.14 1.19-1.93 3.07-3.06 4.85-3.06 1.81 0 2.94 1 4.43 1 1.45 0 2.34-1 4.42-1 1.58 0 3.25.86 4.45 2.34-3.91 2.14-3.28 7.74.65 9.74z"/>
    </svg>
  );
}

/* ============================================================
 * AdCarousel — área publicitária ao lado do formulário de login.
 * Permite habilitar/desabilitar a auto-rotação (botão play/pause),
 * navegação por setas e pontos. Slides são definidos localmente
 * para que a equipe possa editar copy/imagens sem mexer no auth.
 * ============================================================ */
/* ============================================================
 * SponsorShowcase — vitrine de LANÇAMENTOS dos patrocinadores.
 * Espaço pago: marcas exibem novos produtos direto na tela de
 * login. Editável pelo painel admin (config futura).
 * ============================================================ */
type SponsorSlide = {
  brand: string;            // marca do patrocinador
  category: string;         // categoria/linha
  product: string;          // nome do lançamento
  tagline: string;          // chamada curta
  accent: string;           // cor de destaque
  cta?: { label: string; href: string };
};

const SPONSOR_SLIDES: SponsorSlide[] = [
  {
    brand: "TAURUS",
    category: "Pistola · Linha Defesa",
    product: "TH9 PRO Compact",
    tagline: "Nova geração da TH9 chega com gatilho refinado e ergonomia premium.",
    accent: "#D6A64B",
    cta: { label: "Ver lançamento", href: "/" },
  },
  {
    brand: "CBC",
    category: "Munição · Calibre .40",
    product: "Gold Hex Expansiva",
    tagline: "Performance balística certificada para porte e defesa pessoal.",
    accent: "#C75B3F",
    cta: { label: "Conhecer munição", href: "/" },
  },
  {
    brand: "IMBEL",
    category: "Pistola · Linha Tática",
    product: "MD7 .40 Stainless",
    tagline: "Aço inox, slide reforçado e mira ajustável — pronta para o registro PF.",
    accent: "#9DB1C7",
    cta: { label: "Ver ficha técnica", href: "/" },
  },
  {
    brand: "QUERO ARMAS",
    category: "Plataforma · Arsenal",
    product: "Arsenal Inteligente 2.0",
    tagline: "CR, CRAFs, GTs e exames com alertas automáticos antes de vencer.",
    accent: "#7A1F2B",
    cta: { label: "Conhecer", href: "/" },
  },
];

function SponsorShowcase() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const total = SPONSOR_SLIDES.length;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 6500);
    return () => clearInterval(t);
  }, [playing, total]);

  const go = (n: number) => setIdx(((n % total) + total) % total);
  const slide = SPONSOR_SLIDES[idx];

  return (
    <aside className="hidden lg:flex flex-col gap-6 max-w-[640px]" aria-label="Lançamentos dos patrocinadores">
      {/* Headline */}
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 items-center gap-1.5 px-2.5 rounded-full border border-[#D6A64B]/40 bg-[#D6A64B]/10 text-[10px] font-bold uppercase tracking-[0.28em] text-[#D6A64B]">
          <Star size={11} fill="currentColor" /> Lançamentos
        </span>
        <span className="text-[10px] uppercase tracking-[0.28em] text-white/40">
          Espaço dos patrocinadores
        </span>
      </div>

      {/* Card principal */}
      <article
        className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
        style={{ minHeight: 460 }}
      >
        {/* Glow do patrocinador */}
        <div
          className="absolute -top-20 -right-20 h-[360px] w-[360px] rounded-full pointer-events-none transition-colors duration-700"
          style={{ background: `radial-gradient(circle, ${slide.accent}55 0%, transparent 65%)`, filter: "blur(20px)" }}
          aria-hidden
        />

        <div className="relative grid grid-rows-[auto_1fr_auto] h-full p-7 lg:p-9 gap-6">
          {/* Top: marca + selo patrocinado */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/40 mb-2">Apresentado por</div>
              <div
                className="text-2xl font-black tracking-[0.08em]"
                style={{ fontFamily: "Oswald,'Arial Narrow',Arial,sans-serif", color: slide.accent }}
              >
                {slide.brand}
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-[0.3em] text-white/35 border border-white/15 rounded-full px-2.5 py-1">
              Ad
            </span>
          </div>

          {/* Centro: produto */}
          <div className="flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/55 mb-2">
              {slide.category}
            </div>
            <h2
              className="text-[42px] lg:text-[52px] leading-[0.95] font-bold text-white mb-4"
              style={{ fontFamily: "Oswald,'Arial Narrow',Arial,sans-serif", letterSpacing: ".005em" }}
            >
              {slide.product}
            </h2>
            <p className="text-[15px] leading-relaxed text-white/65 max-w-md">
              {slide.tagline}
            </p>
          </div>

          {/* Rodapé: CTA + controles */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {slide.cta && (
              <Link
                to={slide.cta.href}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-[11px] font-bold uppercase tracking-[0.22em] text-black transition hover:scale-[1.02]"
                style={{ background: slide.accent }}
              >
                {slide.cta.label} <ChevronRight size={14} />
              </Link>
            )}

            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" role="tablist" aria-label="Slides">
                {SPONSOR_SLIDES.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`${s.brand} · ${s.product}`}
                    aria-selected={i === idx}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === idx ? 28 : 10,
                      background: i === idx ? slide.accent : "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/[0.06] transition"
                  aria-label={playing ? "Pausar" : "Reproduzir"}
                >
                  {playing ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => go(idx - 1)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/[0.06] transition"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => go(idx + 1)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/[0.06] transition"
                  aria-label="Próximo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Faixa de marcas */}
      <div className="flex items-center gap-2 flex-wrap pl-1">
        <span className="text-[10px] uppercase tracking-[0.28em] text-white/35 mr-2">
          Patrocinadores
        </span>
        {SPONSOR_SLIDES.map((s, i) => (
          <button
            key={s.brand + i}
            type="button"
            onClick={() => go(i)}
            className={`text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-md border transition ${
              i === idx
                ? "border-white/30 bg-white/[0.06] text-white"
                : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
            }`}
            style={{ fontFamily: "Oswald,'Arial Narrow',Arial,sans-serif" }}
          >
            {s.brand}
          </button>
        ))}
      </div>
    </aside>
  );
}