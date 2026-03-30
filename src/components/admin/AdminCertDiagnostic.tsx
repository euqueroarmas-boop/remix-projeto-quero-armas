import { useState, useRef } from "react";
import { requireAdminToken } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, DataPanel } from "@/components/admin/ui/AdminPrimitives";
import {
  Stethoscope, Upload, Loader2, CheckCircle, XCircle, Clock, Eye, EyeOff,
  Lock, Download, Copy, Check, AlertTriangle, FileText, Key, Shield, Hash,
} from "lucide-react";

type DiagStep = {
  step: number;
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  code?: string;
  duration_ms?: number;
};

type DiagResult = {
  success: boolean;
  request_id: string;
  steps: DiagStep[];
  conclusion: string;
  certificate?: {
    subject: string;
    issuer: string;
    serial_number: string;
    valid_from: string;
    valid_to: string;
    is_expired: boolean;
  };
  duration_ms: number;
};

function getAdminToken(): string {
  return requireAdminToken();
}

function StepRow({ step }: { step: DiagStep }) {
  const icon = step.status === "pass"
    ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
    : step.status === "fail"
    ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
    : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      step.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5"
      : step.status === "fail" ? "border-destructive/20 bg-destructive/5"
      : "border-border/40 bg-muted/10"
    }`}>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-right">{step.step}</span>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{step.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{step.message}</p>
        <div className="flex items-center gap-2 mt-1">
          {step.code && (
            <Badge variant="outline" className="text-[9px] font-mono">{step.code}</Badge>
          )}
          {step.duration_ms !== undefined && (
            <span className="text-[9px] text-muted-foreground font-mono">{step.duration_ms}ms</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCertDiagnostic() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runDiagnostic = async () => {
    if (!file || !password) return;
    setRunning(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("certificate", file);
      formData.append("password", password);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-manager?action=diagnose`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "x-admin-token": getAdminToken(),
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData,
      });

      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setResult({
        success: false,
        request_id: "error",
        steps: [{ step: 0, name: "Conexão", status: "fail", message: `Erro de rede: ${e instanceof Error ? e.message : "Desconhecido"}` }],
        conclusion: "Falha na conexão com o backend.",
        duration_ms: 0,
      });
    }
    setRunning(false);
  };

  const copyReport = async () => {
    if (!result) return;
    const report = {
      request_id: result.request_id,
      environment: "production",
      suite: "Certificado Digital / Assinatura A1",
      status: result.steps.every(s => s.status === "pass") ? "PASS" : "FAIL",
      certificate_read: result.certificate ? "sim" : "não",
      private_key_read: result.steps.find(s => s.step === 8)?.status === "pass" ? "sim" : "não",
      sign_test: result.steps.find(s => s.step === 9)?.status === "pass" ? "sim" : "não",
      verify_test: result.steps.find(s => s.step === 10)?.status === "pass" ? "sim" : "não",
      failed_step: result.steps.find(s => s.status === "fail")?.name || "nenhuma",
      failed_code: result.steps.find(s => s.status === "fail")?.code || "nenhum",
      failed_message: result.steps.find(s => s.status === "fail")?.message || "nenhum",
      conclusion: result.conclusion,
      duration_ms: result.duration_ms,
      steps: result.steps,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passedCount = result?.steps.filter(s => s.status === "pass").length || 0;
  const totalSteps = result?.steps.length || 0;
  const allPassed = result ? result.steps.every(s => s.status === "pass") : false;

  return (
    <div className="space-y-6" data-testid="certificate-diagnostic-page">
      <SectionHeader title="Diagnóstico de Certificado Digital" icon={Stethoscope} />
      <p className="text-[11px] text-muted-foreground -mt-4">
        Executa validação completa em 10 etapas sem assinar contrato real. Upload de arquivo .pfx/.p12 para teste isolado.
      </p>

      {/* Upload Section */}
      <DataPanel>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Arquivo do certificado (.pfx ou .p12)
            </label>
            <Input
              ref={fileRef}
              data-testid="certificate-diag-file-input"
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
              className="bg-muted/30 border-border/60"
            />
            {file && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Senha do certificado (somente para teste)
            </label>
            <div className="relative">
              <Input
                data-testid="certificate-diag-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Senha do arquivo .pfx"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/30 border-border/60 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Lock className="h-3 w-3" /> A senha é enviada via HTTPS e processada apenas no backend. Nunca é armazenada neste modo.
            </p>
          </div>

          <Button data-testid="certificate-run-diagnostic-button" onClick={runDiagnostic} disabled={running || !file || !password} className="w-full sm:w-auto">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
            {running ? "Executando diagnóstico..." : "Executar Diagnóstico"}
          </Button>
        </div>
      </DataPanel>

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className={`rounded-xl border p-4 flex items-center justify-between flex-wrap gap-3 ${
           allPassed ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
          }`} data-testid="certificate-result-panel">
            <div className="flex items-center gap-3">
              {allPassed
                ? <Shield className="h-5 w-5 text-emerald-400" />
                : <AlertTriangle className="h-5 w-5 text-destructive" />
              }
              <div>
                <p className="text-sm font-bold text-foreground">
                  {allPassed ? "PASS" : "FAIL"} — {passedCount}/{totalSteps} etapas
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Request ID: <span className="font-mono">{result.request_id?.slice(0, 8)}</span>
                  {" · "}Duração: {result.duration_ms}ms
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={copyReport}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copiado!" : "Copiar relatório"}
              </Button>
            </div>
          </div>

          {/* Step-by-step checklist */}
          <DataPanel>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Checklist técnico por etapa
            </p>
            <div className="space-y-2">
              {result.steps.map((step) => (
                <StepRow key={step.step} step={step} />
              ))}
            </div>
          </DataPanel>

          {/* Certificate info */}
          {result.certificate && (
            <DataPanel>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Metadados do certificado
              </p>
              <div className="grid gap-2 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Titular:</span><span className="font-mono text-foreground truncate ml-2 max-w-[60%] text-right">{result.certificate.subject}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Emissor:</span><span className="font-mono text-foreground truncate ml-2 max-w-[60%] text-right">{result.certificate.issuer}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Serial:</span><span className="font-mono text-foreground">{result.certificate.serial_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Válido de:</span><span className="font-mono text-foreground">{new Date(result.certificate.valid_from).toLocaleDateString("pt-BR")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Válido até:</span><span className={`font-mono ${result.certificate.is_expired ? "text-destructive" : "text-emerald-400"}`}>{new Date(result.certificate.valid_to).toLocaleDateString("pt-BR")}</span></div>
              </div>
            </DataPanel>
          )}

          {/* Conclusion */}
          <DataPanel>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Conclusão técnica
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{result.conclusion}</p>
          </DataPanel>
        </>
      )}
    </div>
  );
}
