import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronLeft, ShieldCheck, KeyRound, CheckCircle2, AlertCircle, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import logoColor from "@/assets/logo-color.png";

type Step = "identify" | "needs_email" | "otp" | "success" | "awaiting_admin" | "not_found";

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
    identify: "Identificar cadastro",
    needs_email: "E-mail auxiliar",
    otp: "Validar código",
    success: "Credenciais liberadas",
    awaiting_admin: "Aguardando autorização",
    not_found: "Cadastro não localizado",
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50">
      <div className="relative z-10 w-full max-w-[440px] bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Ativação segura</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <img src={logoColor} alt="Eu Quero Armas" className="h-10 w-auto object-contain" draggable={false} />
          <div className="text-[11px] tracking-wider text-slate-500 px-3 py-1 border border-slate-200 rounded-full bg-slate-50">
            Ativar primeiro acesso
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-900 pl-3 border-l-2 border-slate-900">
            {stepLabel[step]}
          </div>
        </div>

        {step === "identify" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              Informe seu e-mail, CPF ou CNPJ para localizarmos seu cadastro.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-700">E-mail / CPF / CNPJ</label>
              <input
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
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={() => requestOtp()}
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Localizar / enviar código
            </button>
            <button
              onClick={() => navigate("/area-do-cliente/login")}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors text-center"
            >
              Já tenho acesso → entrar no portal
            </button>
          </div>
        )}

        {step === "needs_email" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                Olá{clienteNome ? `, ${clienteNome}` : ""}! Cadastro localizado, mas sem e-mail registrado.
                Informe um e-mail válido. <strong>A liberação passa por aprovação do administrador.</strong>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-700">E-mail para acesso</label>
              <input
                type="email"
                name="email"
                value={emailAlt}
                onChange={(e) => setEmailAlt(e.target.value)}
                placeholder="seu@email.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={() => requestOtp({ withEmail: true })}
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar código
            </button>
            <button
              onClick={() => setStep("identify")}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 self-start"
            >
              <ChevronLeft className="h-3 w-3" /> Voltar
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              Código enviado para <strong className="text-slate-900">{emailMascarado || "seu e-mail"}</strong>.
              Digite-o abaixo ou utilize o link mágico.
            </p>
            {!otpId && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-700">Token (do link)</label>
                <input
                  value={otpId || ""}
                  onChange={(e) => setOtpId(e.target.value)}
                  placeholder="cole o token do link"
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-700">Código de 6 dígitos</label>
              <input
                type="text"
                name="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full h-14 px-3 text-center text-2xl font-mono tracking-[0.5em] rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-300 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={() => verifyCode()}
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Validar / liberar acesso
            </button>
            <button
              onClick={() => requestOtp()}
              className="text-xs text-slate-500 hover:text-slate-900 text-center"
            >
              Reenviar código
            </button>
          </div>
        )}

        {step === "success" && credentials && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong>Acesso liberado.</strong> Use as credenciais abaixo. Recomendamos alterar a senha no primeiro acesso.
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { label: "E-mail", value: credentials.email, copyLabel: "E-mail" },
                { label: "Senha temporária", value: credentials.password, copyLabel: "Senha" },
              ].map((c) => (
                <div key={c.label} className="relative flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md p-3">
                  <div className="text-xs flex-1 min-w-0">
                    <div className="text-[11px] text-slate-500">{c.label}</div>
                    <div className="text-sm text-slate-900 truncate font-mono">{c.value}</div>
                  </div>
                  <button
                    onClick={() => copy(c.value, c.copyLabel)}
                    className="text-slate-500 hover:text-slate-900 transition-colors p-1"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                navigate("/area-do-cliente/login", {
                  state: {
                    prefillEmail: credentials.email,
                    prefillPassword: credentials.password,
                  },
                })
              }
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Ir para o portal
            </button>
          </div>
        )}

        {step === "awaiting_admin" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                E-mail validado. Sua solicitação foi enviada para aprovação do administrador.
                Você receberá uma confirmação assim que o acesso for liberado.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar ao início
            </button>
          </div>
        )}

        {step === "not_found" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                Não encontramos um cadastro com esses dados. Você pode preencher um pré-cadastro para análise.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/cadastro")}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              <ShieldCheck className="h-4 w-4" />
              Fazer pré-cadastro
            </button>
            <button
              onClick={() => setStep("identify")}
              className="text-xs text-slate-500 hover:text-slate-900 text-center"
            >
              Tentar com outro identificador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
