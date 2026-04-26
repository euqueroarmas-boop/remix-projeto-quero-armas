import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ShieldCheck, KeyRound, CheckCircle2, AlertCircle, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import logoWhite from "@/assets/logo-white.png";

type Step = "identify" | "needs_email" | "otp" | "success" | "awaiting_admin" | "not_found";

const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] tracking-[0.2em] text-zinc-500" style={MONO}>
    {children}
  </label>
);

const TacticalInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="flex items-center border-b border-[#1f1f1f] focus-within:border-[#ff2a2a]/60 bg-black/40 transition-colors">
    <span className="text-[#ff2a2a]/60 text-sm pl-3" style={MONO}>&gt;</span>
    <input
      {...props}
      className={`w-full bg-transparent p-3 text-sm text-white outline-none normal-case placeholder:text-zinc-700 placeholder:tracking-wider ${props.className || ""}`}
      style={{ ...MONO, ...(props.style || {}) }}
    />
  </div>
);

const PrimaryButton = ({ children, onClick, disabled, type = "button" }: any) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="w-full relative bg-[#ff2a2a]/5 hover:bg-[#ff2a2a]/10 border border-[#ff2a2a]/40 hover:border-[#ff2a2a] px-6 py-3.5 flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(255,42,42,0.12)] hover:shadow-[0_0_45px_rgba(255,42,42,0.3)] disabled:opacity-50 disabled:cursor-not-allowed text-[13px] tracking-[0.2em] text-white font-bold"
  >
    <div className="absolute top-0 left-0 size-2.5 border-t-2 border-l-2 border-[#ff2a2a]" />
    <div className="absolute top-0 right-0 size-2.5 border-t-2 border-r-2 border-[#ff2a2a]" />
    <div className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-[#ff2a2a]" />
    <div className="absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-[#ff2a2a]" />
    {children}
  </button>
);

const Notice = ({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warn" | "success" | "info";
  icon: any;
  children: React.ReactNode;
}) => {
  const colors =
    tone === "success"
      ? { border: "border-[#22c55e]/40", text: "text-[#86efac]", icon: "text-[#22c55e]", bg: "bg-[#22c55e]/5" }
      : tone === "warn"
      ? { border: "border-[#f59e0b]/40", text: "text-[#fcd34d]", icon: "text-[#f59e0b]", bg: "bg-[#f59e0b]/5" }
      : { border: "border-[#1f1f1f]", text: "text-zinc-400", icon: "text-zinc-500", bg: "bg-black/40" };
  return (
    <div className={`relative ${colors.bg} border ${colors.border} p-4 flex items-start gap-3`}>
      <div className={`absolute top-0 left-0 size-2 border-t border-l ${colors.border}`} />
      <div className={`absolute bottom-0 right-0 size-2 border-b border-r ${colors.border}`} />
      <Icon className={`h-4 w-4 ${colors.icon} mt-0.5 shrink-0`} />
      <div className={`text-[12px] leading-relaxed ${colors.text} normal-case`} style={MONO}>
        {children}
      </div>
    </div>
  );
};

export default function QAAtivarAcessoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("identify");
  const [loading, setLoading] = useState(false);

  const [identificador, setIdentificador] = useState("");
  const [emailAlt, setEmailAlt] = useState("");
  const [emailMascarado, setEmailMascarado] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    const t = params.get("token");
    const c = params.get("code");
    if (t && c && step === "identify") {
      setOtpId(t);
      setCode(c);
      setStep("otp");
      setTimeout(() => verifyCode(t, c), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestOtp(opts?: { withEmail?: boolean }) {
    if (!identificador.trim()) {
      toast.error("Informe e-mail, CPF ou CNPJ");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cliente-portal-request-otp", {
        body: {
          identificador: identificador.trim(),
          email_alternativo: opts?.withEmail ? emailAlt.trim() : undefined,
        },
      });
      if (error) throw error;
      if (data?.not_found) { setStep("not_found"); return; }
      if (data?.require_email) {
        setClienteNome(data.cliente_nome || "");
        setStep("needs_email");
        return;
      }
      setEmailMascarado(data?.email_mascarado || "");
      setClienteNome(data?.cliente_nome || "");
      if (data?.otp_id) setOtpId(data.otp_id);
      setStep("otp");
      toast.success(`Código enviado para ${data?.email_mascarado || "seu e-mail"}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao solicitar acesso");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(tokenOverride?: string, codeOverride?: string) {
    const tk = tokenOverride || otpId;
    const cd = codeOverride || code;
    if (!tk || !cd) { toast.error("Informe o código recebido por e-mail"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cliente-portal-verify-otp", {
        body: { otp_id: tk, code: cd.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.awaiting_admin) { setStep("awaiting_admin"); return; }
      setCredentials({ email: data.email, password: data.temp_password });
      setStep("success");
    } catch (e: any) {
      toast.error(e?.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado`);
  };

  const stepLabel: Record<Step, string> = {
    identify: "ETAPA_01 // IDENTIFICAR_OPERADOR",
    needs_email: "ETAPA_02 // E-MAIL_AUXILIAR",
    otp: "ETAPA_02 // VALIDAR_CÓDIGO",
    success: "ETAPA_03 // CREDENCIAIS_LIBERADAS",
    awaiting_admin: "PENDENTE // AGUARDANDO_AUTORIZAÇÃO",
    not_found: "FALHA // CADASTRO_NÃO_LOCALIZADO",
  };

  return (
    <div
      className="qa-ativar-shell relative w-full flex items-center justify-center p-4 bg-[#030303] text-[#e0e0e0] uppercase"
      style={{ fontFamily: "'Rajdhani', sans-serif" }}
    >
      {/* Tactical grid */}
      <div className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,42,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,42,42,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at center, transparent 0%, #030303 80%)" }}
      />
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* Terminal */}
      <div className="relative z-10 w-full max-w-[420px] bg-[#0a0a0a]/90 md:border md:border-[#1f1f1f] backdrop-blur-md p-6 flex flex-col gap-6 md:shadow-[0_0_60px_rgba(255,42,42,0.05)]">
        {/* HUD bar */}
        <div className="flex items-center justify-between text-[11px] tracking-[0.2em] text-zinc-500" style={MONO}>
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
              <span className="absolute inline-flex h-full w-full bg-[#ff2a2a] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-[#ff2a2a]" />
            </span>
            <span>ATIVACAO_SEGURA</span>
          </div>
        </div>

        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <img
            src={logoWhite}
            alt="Eu Quero Armas"
            className="h-10 w-auto object-contain drop-shadow-[0_4px_20px_rgba(255,42,42,0.25)]"
            draggable={false}
          />
          <div className="text-[9px] tracking-[0.3em] text-zinc-500 px-3 py-1 border border-zinc-800" style={MONO}>
            ATIVAR_PRIMEIRO_ACESSO
          </div>
        </div>

        {/* Step header */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] tracking-[0.2em] text-[#ff2a2a]/80 pl-2 border-l-2 border-[#ff2a2a]/60" style={MONO}>
            &gt; {stepLabel[step]}
          </div>
        </div>

        {/* ─── STEPS ─── */}
        {step === "identify" && (
          <div className="flex flex-col gap-5">
            <p className="text-[12px] text-zinc-400 normal-case leading-relaxed" style={MONO}>
              Informe seu e-mail, CPF ou CNPJ para localizarmos seu cadastro no sistema.
            </p>
            <div className="flex flex-col gap-2">
              <FieldLabel>E-MAIL / CPF / CNPJ</FieldLabel>
              <TacticalInput
                type="text"
                name="username"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="seu@email.com ou 000.000.000-00"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>
            <PrimaryButton onClick={() => requestOtp()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              LOCALIZAR / ENVIAR CÓDIGO
            </PrimaryButton>
            <button
              onClick={() => navigate("/area-do-cliente/login")}
              className="text-[10px] text-zinc-500 hover:text-[#ff2a2a] tracking-[0.2em] transition-colors text-center"
              style={MONO}
            >
              [ JÁ TENHO ACESSO → ENTRAR NO PORTAL ]
            </button>
          </div>
        )}

        {step === "needs_email" && (
          <div className="flex flex-col gap-5">
            <Notice tone="warn" icon={AlertCircle}>
              Olá{clienteNome ? `, ${clienteNome}` : ""}! Cadastro localizado, mas sem e-mail registrado.
              Informe um e-mail válido. <strong>A liberação passa por aprovação do administrador.</strong>
            </Notice>
            <div className="flex flex-col gap-2">
              <FieldLabel>E-MAIL PARA ACESSO</FieldLabel>
              <TacticalInput
                type="email"
                name="email"
                value={emailAlt}
                onChange={(e) => setEmailAlt(e.target.value)}
                placeholder="seu@email.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <PrimaryButton onClick={() => requestOtp({ withEmail: true })} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              ENVIAR CÓDIGO
            </PrimaryButton>
            <button
              onClick={() => setStep("identify")}
              className="text-[10px] text-zinc-500 hover:text-[#ff2a2a] tracking-[0.2em] transition-colors flex items-center gap-1 self-start"
              style={MONO}
            >
              <ChevronLeft className="h-3 w-3" /> VOLTAR
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="flex flex-col gap-5">
            <p className="text-[12px] text-zinc-400 normal-case leading-relaxed" style={MONO}>
              Código enviado para <strong className="text-white">{emailMascarado || "seu e-mail"}</strong>.
              Digite-o abaixo ou utilize o link mágico.
            </p>
            {!otpId && (
              <div className="flex flex-col gap-2">
                <FieldLabel>TOKEN (DO LINK)</FieldLabel>
                <TacticalInput
                  value={otpId || ""}
                  onChange={(e) => setOtpId(e.target.value)}
                  placeholder="cole o token do link"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <FieldLabel>CÓDIGO 6 DÍGITOS</FieldLabel>
              <div className="border-b border-[#1f1f1f] focus-within:border-[#ff2a2a]/60 bg-black/40 transition-colors">
                <input
                  type="text"
                  name="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-full bg-transparent p-3 text-center text-2xl tracking-[0.5em] text-white outline-none placeholder:text-zinc-700"
                  style={MONO}
                />
              </div>
            </div>
            <PrimaryButton onClick={() => verifyCode()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              VALIDAR / LIBERAR ACESSO
            </PrimaryButton>
            <button
              onClick={() => requestOtp()}
              className="text-[10px] text-zinc-500 hover:text-[#ff2a2a] tracking-[0.2em] transition-colors text-center"
              style={MONO}
            >
              [ REENVIAR CÓDIGO ]
            </button>
          </div>
        )}

        {step === "success" && credentials && (
          <div className="flex flex-col gap-5">
            <Notice tone="success" icon={CheckCircle2}>
              <strong>Acesso liberado.</strong> Use as credenciais abaixo. Recomendamos alterar a senha no primeiro acesso.
            </Notice>
            <div className="flex flex-col gap-3">
              {[
                { label: "E-MAIL", value: credentials.email, copyLabel: "E-mail" },
                { label: "SENHA TEMPORÁRIA", value: credentials.password, copyLabel: "Senha" },
              ].map((c) => (
                <div key={c.label} className="relative flex items-center justify-between bg-black/40 border border-[#1f1f1f] p-3">
                  <div className="text-xs flex-1 min-w-0">
                    <div className="text-[9px] tracking-[0.25em] text-zinc-500" style={MONO}>{c.label}</div>
                    <div className="text-sm text-white truncate normal-case" style={MONO}>{c.value}</div>
                  </div>
                  <button
                    onClick={() => copy(c.value, c.copyLabel)}
                    className="text-zinc-500 hover:text-[#ff2a2a] transition-colors p-1"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <PrimaryButton onClick={() => navigate("/area-do-cliente/login")}>
              <ShieldCheck className="h-4 w-4" />
              IR PARA O PORTAL
            </PrimaryButton>
          </div>
        )}

        {step === "awaiting_admin" && (
          <div className="flex flex-col gap-5">
            <Notice tone="warn" icon={AlertCircle}>
              E-mail validado. Sua solicitação foi enviada para aprovação do administrador.
              Você receberá uma confirmação assim que o acesso for liberado.
            </Notice>
            <PrimaryButton onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4" />
              VOLTAR AO INÍCIO
            </PrimaryButton>
          </div>
        )}

        {step === "not_found" && (
          <div className="flex flex-col gap-5">
            <Notice tone="info" icon={AlertCircle}>
              Não encontramos um cadastro com esses dados. Você pode preencher um pré-cadastro para análise.
            </Notice>
            <PrimaryButton onClick={() => navigate("/cadastro")}>
              <ShieldCheck className="h-4 w-4" />
              FAZER PRÉ-CADASTRO
            </PrimaryButton>
            <button
              onClick={() => setStep("identify")}
              className="text-[10px] text-zinc-500 hover:text-[#ff2a2a] tracking-[0.2em] transition-colors text-center"
              style={MONO}
            >
              [ TENTAR COM OUTRO IDENTIFICADOR ]
            </button>
          </div>
        )}
      </div>

      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap"
      />
      <style>{`
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .qa-ativar-shell { height: 100svh; min-height: 100svh; overflow: hidden; }
        @media (max-height: 820px) {
          .qa-ativar-shell { height: auto; min-height: 100svh; overflow-y: auto; align-items: flex-start; padding-top: 2rem; padding-bottom: 2rem; }
        }
      `}</style>
    </div>
  );
}
