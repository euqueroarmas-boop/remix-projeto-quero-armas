import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Phone, Mail, ShieldCheck, ChevronLeft, Loader2, Sparkles } from "lucide-react";
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
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/area-do-cliente/login",
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
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#f6f5f1" }}>
      <div className="w-full border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-black/60 hover:text-[#7A1F2B]"
          >
            <ChevronLeft size={14} /> Voltar
          </button>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-black/40">
            <ShieldCheck size={12} /> Conexão protegida
          </span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logoColor} alt="Quero Armas" className="h-14 w-auto mb-4" />
            <h1 className="text-2xl font-bold uppercase tracking-wide text-black text-center">
              Acesso do Cliente
            </h1>
            <p className="text-sm text-black/60 mt-1 text-center">
              Entre na sua área para acompanhar processos e documentos.
            </p>
          </div>

          <div className="bg-white border border-black/10 rounded-xl shadow-sm p-6">
            {needCpf ? (
              <form onSubmit={handleLinkByCpf} className="space-y-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-black mb-1">
                    Localizar seu cadastro
                  </h2>
                  <p className="text-xs text-black/60 leading-relaxed">
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
                    className="h-11 px-4 rounded-lg border border-black/15 text-sm font-semibold text-black/70 hover:bg-black/[0.03]"
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
                    className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg border border-black/15 bg-white hover:bg-black/[0.03] transition text-sm font-medium text-black disabled:opacity-60"
                  >
                    {loadingProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continuar com Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocial("apple")}
                    disabled={loadingProvider !== null}
                    className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg bg-black hover:bg-black/90 transition text-sm font-medium text-white disabled:opacity-60"
                  >
                    {loadingProvider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />}
                    Continuar com Apple
                  </button>
                </div>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-black/10" />
                  <span className="text-[10px] uppercase tracking-[0.25em] text-black/40">ou</span>
                  <div className="flex-1 h-px bg-black/10" />
                </div>

                <div className="flex rounded-lg bg-black/5 p-1 mb-4">
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
                      <span className="ml-1 text-[8px] uppercase tracking-[0.18em] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black"
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
                        className="text-xs uppercase tracking-wider text-[#7A1F2B] hover:underline disabled:opacity-60"
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
                    <p className="text-xs text-black/55 leading-relaxed">
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
                        className="h-11 px-4 rounded-lg border border-black/15 text-xs font-semibold uppercase tracking-wider text-black/70 hover:bg-black/[0.03]"
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
                className="w-full mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wider transition"
              >
                <Sparkles size={14} /> Primeiro acesso · Ativar conta
              </button>

              <p className="text-center text-sm text-black/60 mt-6">
                Ainda não tem cadastro?{" "}
                <Link
                  to="/cadastro"
                  className="text-[#7A1F2B] font-semibold uppercase tracking-wider text-xs hover:underline"
                >
                  Criar cadastro
                </Link>
              </p>
            </>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] uppercase tracking-wider text-black/40">
            <ShieldCheck size={14} />
            Conexão protegida · LGPD
          </div>
        </div>
      </main>

      <style>{`
        .qa-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.15);
          background: #fff;
          font-size: 14px;
          color: #000;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .qa-input:focus {
          border-color: #7A1F2B;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.12);
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-xs uppercase tracking-wider font-semibold transition ${
        active ? "bg-white text-black shadow-sm" : "text-black/55 hover:text-black"
      }`}
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
      className="flex-1 w-full h-11 rounded-lg bg-[#7A1F2B] hover:bg-[#651822] transition text-white text-sm font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 disabled:opacity-60"
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