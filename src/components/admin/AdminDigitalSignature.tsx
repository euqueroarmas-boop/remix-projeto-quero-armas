import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminFunctionFetch } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SectionHeader, DataPanel, StatusPill } from "@/components/admin/ui/AdminPrimitives";
import {
  Shield, Upload, CheckCircle, XCircle, AlertTriangle, Clock, Key,
  FileSignature, RefreshCw, Loader2, ShieldCheck, Calendar, Activity,
  Lock, Eye, EyeOff, Play, Download, FileText,
} from "lucide-react";

interface CertificateInfo {
  id: string;
  subject: string;
  issuer: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  auto_sign_enabled: boolean;
  last_used_at: string | null;
  status: string;
  created_at: string;
  is_expired: boolean;
  days_until_expiry: number | null;
}

interface SignatureLog {
  id: string;
  contract_id: string | null;
  status: string;
  signed_at: string;
  error_message: string | null;
  original_pdf_path: string | null;
  signed_pdf_path: string | null;
  document_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  certificate_id: string | null;
  validation_result: string | null;
  created_at: string;
}

async function certApi(action: string, options?: { method?: string; body?: any; formData?: FormData }) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-manager?action=${action}`;
  const headers: Record<string, string> = {
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  let fetchOptions: RequestInit = { method: options?.method || "POST", headers };

  if (options?.formData) {
    fetchOptions.body = options.formData;
  } else if (options?.body) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
    fetchOptions.headers = headers;
  } else {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify({});
    fetchOptions.headers = headers;
  }

  const resp = await adminFunctionFetch(url, fetchOptions);
  return resp.json();
}

export default function AdminDigitalSignature() {
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<CertificateInfo | null>(null);
  const [stats, setStats] = useState({ total_signed: 0, total_failed: 0 });
  const [recentLogs, setRecentLogs] = useState<SignatureLog[]>([]);
  const [allLogs, setAllLogs] = useState<SignatureLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Full signing test state
  interface SigningStep { step: number; name: string; status: "pass" | "fail"; message: string; duration_ms: number; }
  interface SigningTestResult {
    success: boolean;
    total_duration_ms: number;
    steps: SigningStep[];
    certificate?: { subject_cn: string; issuer_cn: string; valid_from: string; valid_to: string; };
    signature?: { hash: string; algorithm: string; };
    signed_pdf_base64?: string;
    signed_pdf_size?: number;
    error?: string;
  }
  const [signingTest, setSigningTest] = useState<SigningTestResult | null>(null);
  const [signingTesting, setSigningTesting] = useState(false);

  // Toggle state
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await certApi("status");
      if (data.success) {
        setCert(data.certificate);
        setStats(data.stats);
        setRecentLogs(data.recent_logs || []);
      }
    } catch (e) {
      console.error("[AdminDigitalSignature] Failed to fetch status:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleUpload = async () => {
    if (!uploadFile || !certPassword) {
      setUploadError("Selecione o certificado (.pfx/.p12) e informe a senha.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("certificate", uploadFile);
      formData.append("password", certPassword);

      const result = await certApi("upload", { formData });
      if (result.success) {
        setUploadSuccess(`Certificado configurado com sucesso. Válido por ${result.certificate.days_until_expiry} dias.`);
        setCertPassword("");
        setUploadFile(null);
        await fetchStatus();
      } else {
        setUploadError(result.error || "Falha ao enviar certificado");
      }
    } catch (e) {
      setUploadError("Erro de conexão ao enviar certificado");
    }
    setUploading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await certApi("test");
      setTestResult({
        success: result.success,
        message: result.success ? result.message : result.error,
      });
      if (result.success) await fetchStatus();
    } catch {
      setTestResult({ success: false, message: "Erro de conexão" });
    }
    setTesting(false);
  };

  const handleFullSigningTest = async () => {
    setSigningTesting(true);
    setSigningTest(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-certificate-sign`;
      const resp = await adminFunctionFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ use_stored: true }),
      });
      const data = await resp.json();
      setSigningTest(data);
      if (data.success) await fetchStatus();
    } catch (e) {
      setSigningTest({ success: false, total_duration_ms: 0, steps: [], error: e instanceof Error ? e.message : "Erro de conexão" });
    }
    setSigningTesting(false);
  };

  const downloadSignedPdf = () => {
    if (!signingTest?.signed_pdf_base64) return;
    const byteChars = atob(signingTest.signed_pdf_base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teste-assinatura-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewSignedPdf = () => {
    if (!signingTest?.signed_pdf_base64) return;
    const byteChars = atob(signingTest.signed_pdf_base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      const result = await certApi("toggle", { body: { auto_sign_enabled: enabled } });
      if (result.success) {
        setCert(prev => prev ? { ...prev, auto_sign_enabled: enabled } : null);
      }
    } catch (e) {
      console.error("[AdminDigitalSignature] Toggle failed:", e);
    }
    setToggling(false);
  };

  const loadAllLogs = async () => {
    try {
      const result = await certApi("logs");
      if (result.success) setAllLogs(result.logs);
    } catch {
      console.error("Failed to load logs");
    }
    setShowLogs(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando configuração...
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="certificate-module-page">
      {/* Certificate Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <DataPanel>
          <div className="flex items-center gap-3 mb-3">
            {cert ? (
              cert.is_expired ? (
                <div className="p-2 rounded-lg bg-destructive/10"><XCircle className="h-5 w-5 text-destructive" /></div>
              ) : cert.days_until_expiry !== null && cert.days_until_expiry < 30 ? (
                <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-500/10"><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>
              )
            ) : (
              <div className="p-2 rounded-lg bg-muted"><Shield className="h-5 w-5 text-muted-foreground" /></div>
            )}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Certificado</p>
              <p className="text-sm font-bold text-foreground">
                {!cert ? "Não configurado" : cert.is_expired ? "Expirado" : "Ativo"}
              </p>
            </div>
          </div>
          {cert && (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p className="truncate" title={cert.subject}><strong>Titular:</strong> {cert.subject}</p>
              <p className="truncate" title={cert.issuer}><strong>Emissor:</strong> {cert.issuer}</p>
            </div>
          )}
        </DataPanel>

        <DataPanel>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10"><Calendar className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Validade</p>
              <p className="text-sm font-bold text-foreground">
                {cert ? (
                  cert.is_expired ? "Expirado" :
                  cert.days_until_expiry !== null ? `${cert.days_until_expiry} dias` : "N/A"
                ) : "—"}
              </p>
            </div>
          </div>
          {cert && (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p><strong>De:</strong> {new Date(cert.valid_from).toLocaleDateString("pt-BR")}</p>
              <p><strong>Até:</strong> {new Date(cert.valid_to).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
        </DataPanel>

        <DataPanel>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Assinaturas</p>
              <p className="text-sm font-bold text-foreground">{stats.total_signed}</p>
            </div>
          </div>
          <div className="flex gap-3 text-[11px]">
            <span className="text-emerald-400">✓ {stats.total_signed} sucesso</span>
            <span className="text-destructive">✗ {stats.total_failed} falha(s)</span>
          </div>
          {cert?.last_used_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Último uso: {new Date(cert.last_used_at).toLocaleString("pt-BR")}
            </p>
          )}
        </DataPanel>
      </div>

      {/* Auto-sign toggle */}
      {cert && !cert.is_expired && (
        <DataPanel>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Assinatura automática</p>
                <p className="text-[11px] text-muted-foreground">
                  Quando ativada, todo contrato gerado será assinado digitalmente com o certificado A1.
                </p>
              </div>
            </div>
            <Switch
              checked={cert.auto_sign_enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </DataPanel>
      )}

      {/* Expiry warning */}
      {cert && !cert.is_expired && cert.days_until_expiry !== null && cert.days_until_expiry < 30 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Certificado próximo da expiração</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O certificado A1 expira em {cert.days_until_expiry} dia(s). Providencie a renovação para evitar interrupção na assinatura automática.
            </p>
          </div>
        </div>
      )}

      {cert && cert.is_expired && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Certificado expirado</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O certificado digital está expirado. Envie um novo certificado A1 válido para reativar a assinatura automática.
            </p>
          </div>
        </div>
      )}

      {/* Upload Certificate */}
      <DataPanel>
        <SectionHeader title={cert ? "Substituir Certificado A1" : "Enviar Certificado A1"} icon={Upload} />
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Arquivo do certificado (.pfx ou .p12)
            </label>
            <Input
              data-testid="certificate-upload-input"
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => {
                setUploadFile(e.target.files?.[0] || null);
                setUploadError("");
                setUploadSuccess("");
              }}
              className="bg-muted/30 border-border/60"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Senha do certificado
            </label>
            <div className="relative">
              <Input
                data-testid="certificate-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Senha do arquivo .pfx"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
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
              <Lock className="h-3 w-3" /> A senha é criptografada e armazenada de forma segura. Nunca é exposta no frontend.
            </p>
          </div>

          {uploadError && (
            <p className="text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">{uploadError}</p>
          )}
          {uploadSuccess && (
            <p className="text-emerald-400 text-xs bg-emerald-500/10 rounded-md px-3 py-2 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> {uploadSuccess}
            </p>
          )}

          <Button data-testid="certificate-upload-button" onClick={handleUpload} disabled={uploading || !uploadFile || !certPassword}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? "Enviando..." : "Enviar certificado"}
          </Button>
        </div>
      </DataPanel>

      {/* Test Signature */}
      {cert && !cert.is_expired && (
        <DataPanel>
          <SectionHeader title="Testar Assinatura" icon={CheckCircle} />
          <p className="text-[11px] text-muted-foreground mt-2 mb-4">
            Verifica se o certificado está acessível, descriptografável e válido para assinatura.
          </p>
          <div className="flex items-center gap-3">
            <Button data-testid="certificate-test-sign-button" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              {testing ? "Testando..." : "Testar certificado"}
            </Button>
            {testResult && (
              <span className={`text-xs ${testResult.success ? "text-emerald-400" : "text-destructive"}`}>
                {testResult.success ? "✓" : "✗"} {testResult.message}
              </span>
            )}
          </div>
        </DataPanel>
      )}

      {/* Recent Signature Logs */}
      <DataPanel>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Logs de Assinatura" icon={FileSignature} />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={fetchStatus} className="text-[11px] h-7">
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            {!showLogs && recentLogs.length > 0 && (
              <Button variant="outline" size="sm" onClick={loadAllLogs} className="text-[11px] h-7">
                Ver todos
              </Button>
            )}
          </div>
        </div>

        {(showLogs ? allLogs : recentLogs).length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6">Nenhum log de assinatura encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Data</TableHead>
                  <TableHead className="text-[10px]">Contrato</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showLogs ? allLogs : recentLogs).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[11px] font-mono whitespace-nowrap">
                      {new Date(log.signed_at || log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-[11px] font-mono">
                      {log.contract_id ? log.contract_id.slice(0, 8).toUpperCase() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "signed" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" :
                          log.status === "error" ? "border-destructive/30 text-destructive bg-destructive/10" :
                          "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        }
                      >
                        {log.status === "signed" ? "Assinado" : log.status === "error" ? "Erro" : log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
