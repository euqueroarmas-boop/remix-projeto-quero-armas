import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Mail, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";

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

  // Magic link auto-verify
  useEffect(() => {
    const t = params.get("token");
    const c = params.get("code");
    if (t && c && step === "identify") {
      setOtpId(t);
      setCode(c);
      setStep("otp");
      // small delay then verify
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
      if (data?.not_found) {
        setStep("not_found");
        return;
      }
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
    if (!tk || !cd) {
      toast.error("Informe o código recebido por e-mail");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cliente-portal-verify-otp", {
        body: { otp_id: tk, code: cd.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.awaiting_admin) {
        setStep("awaiting_admin");
        return;
      }
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-6 w-6 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-900">Acesso ao Portal do Cliente</h1>
        </div>

        {step === "identify" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Informe seu <strong>e-mail</strong>, <strong>CPF</strong> ou <strong>CNPJ</strong> para localizarmos seu cadastro.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ident">E-mail, CPF ou CNPJ</Label>
              <Input
                id="ident"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="seu@email.com ou 000.000.000-00"
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={() => requestOtp()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Localizar e enviar código
            </Button>
            <button
              onClick={() => navigate("/area-do-cliente/login")}
              className="text-xs text-slate-500 hover:text-slate-700 underline w-full text-center"
            >
              Já tenho acesso → Entrar no portal
            </button>
          </div>
        )}

        {step === "needs_email" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
              Olá{clienteNome ? `, ${clienteNome}` : ""}! Localizamos seu cadastro, mas não há e-mail registrado.
              Informe um e-mail válido para receber o código. <strong>A liberação passará por aprovação do administrador.</strong>
            </div>
            <div className="space-y-2">
              <Label>E-mail para acesso</Label>
              <Input type="email" value={emailAlt} onChange={(e) => setEmailAlt(e.target.value)} placeholder="seu@email.com" />
            </div>
            <Button className="w-full" onClick={() => requestOtp({ withEmail: true })} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar código
            </Button>
            <button onClick={() => setStep("identify")} className="text-xs text-slate-500 hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Enviamos um código para <strong>{emailMascarado || "seu e-mail"}</strong>. Digite-o abaixo ou use o link mágico recebido.
            </p>
            {!otpId && (
              <div className="space-y-2">
                <Label htmlFor="otpId">ID do código (do link recebido)</Label>
                <Input id="otpId" value={otpId || ""} onChange={(e) => setOtpId(e.target.value)} placeholder="cole o token do link" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <Button className="w-full" onClick={() => verifyCode()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Validar e liberar acesso
            </Button>
            <button onClick={() => requestOtp()} className="text-xs text-slate-500 hover:underline">
              Reenviar código
            </button>
          </div>
        )}

        {step === "success" && credentials && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="text-sm text-green-900">
                <strong>Acesso liberado!</strong> Use as credenciais abaixo para entrar.
                Recomendamos alterar a senha no primeiro acesso.
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 border rounded p-3">
                <div className="text-xs">
                  <div className="text-slate-500">E-mail</div>
                  <div className="font-mono text-sm">{credentials.email}</div>
                </div>
                <button onClick={() => copy(credentials.email, "E-mail")} className="text-slate-400 hover:text-slate-700">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border rounded p-3">
                <div className="text-xs">
                  <div className="text-slate-500">Senha temporária</div>
                  <div className="font-mono text-sm">{credentials.password}</div>
                </div>
                <button onClick={() => copy(credentials.password, "Senha")} className="text-slate-400 hover:text-slate-700">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={() => navigate("/area-do-cliente/login")}>
              Ir para o portal
            </Button>
          </div>
        )}

        {step === "awaiting_admin" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                E-mail validado. Sua solicitação foi enviada para aprovação do administrador.
                Você receberá uma confirmação assim que o acesso for liberado.
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </div>
        )}

        {step === "not_found" && (
          <div className="space-y-4">
            <div className="bg-slate-100 border rounded p-4 text-sm text-slate-700">
              Não encontramos um cadastro com esses dados. Você pode continuar preenchendo seu cadastro para análise.
            </div>
            <Button className="w-full" onClick={() => navigate("/cadastro")}>
              Fazer pré-cadastro
            </Button>
            <button onClick={() => setStep("identify")} className="text-xs text-slate-500 hover:underline w-full text-center">
              Tentar com outro identificador
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}