import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileSignature, ShieldCheck, Clock, AlertCircle, CheckCircle2, Loader2,
  Download, Upload, RefreshCw,
} from "lucide-react";

/**
 * BLOCO 10 (Pass A skeleton)
 * Mostra status do contrato pós-pagamento da venda mais recente paga.
 * Pass B adicionará download/upload/validação.
 */

interface Contract {
  id: string;
  contract_number: string;
  status: string;
  validation_status: string | null;
  issued_at: string | null;
  company_signed_at: string | null;
  customer_uploaded_at: string | null;
  customer_signature_validated_at?: string | null;
  validation_details?: any;
  customer_signed_pdf_path?: string | null;
}

const STATUS_MAP: Record<string, { label: string; tone: "muted" | "info" | "warn" | "ok" | "err" }> = {
  generated_pending_company_signature: { label: "AGUARDANDO ASSINATURA DA QUERO ARMAS", tone: "warn" },
  pending_customer_signature: { label: "DISPONÍVEL PARA ASSINATURA", tone: "info" },
  customer_signature_uploaded: { label: "AGUARDANDO ENVIO DO PDF ASSINADO", tone: "info" },
  validating: { label: "ASSINATURA EM VALIDAÇÃO", tone: "info" },
  validated: { label: "CONTRATO VALIDADO", tone: "ok" },
  rejected: { label: "CONTRATO REJEITADO — REENVIAR", tone: "err" },
  pending_manual_review: { label: "EM REVISÃO MANUAL", tone: "warn" },
};

const TONE_CLS: Record<string, string> = {
  muted: "bg-neutral-100 text-neutral-700 border-neutral-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  err: "bg-rose-50 text-rose-800 border-rose-200",
};

/**
 * Local error boundary: garante que falha em qa_contracts/RLS/edge functions
 * NUNCA derrube o portal (Arsenal, Documentos, etc.).
 */
class ContratoBlockErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[ContratoBlock] erro isolado:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 text-[12px] text-neutral-500">
          Não foi possível carregar o contrato agora. Tente novamente em instantes.
        </div>
      );
    }
    return this.props.children;
  }
}

function ContratoBlockInner({ clienteId }: { clienteId: number | null }) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!clienteId) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_contracts" as any)
          .select("id, contract_number, status, validation_status, issued_at, company_signed_at, customer_uploaded_at, customer_signature_validated_at, validation_details, customer_signed_pdf_path")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("[ContratoBlock] qa_contracts query falhou (ignorando):", error.message);
        }
        if (!cancel) {
          setContract((data as any) || null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancel) {
          // eslint-disable-next-line no-console
          console.warn("[ContratoBlock] exceção na carga (ignorando):", e);
          setContract(null);
          setLoading(false);
        }
      }
    })();
    return () => { cancel = true; };
  }, [clienteId, refreshKey]);

  // Realtime updates for status changes
  useEffect(() => {
    if (!contract?.id) return;
    const ch = supabase
      .channel(`qa_contract_${contract.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "qa_contracts", filter: `id=eq.${contract.id}` },
        () => setRefreshKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contract?.id]);

  async function handleDownload(variant: "company_signed" | "customer_signed") {
    if (!contract) return;
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-contract-pdf`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ contract_id: contract.id, variant }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `contrato-${contract.contract_number}-${variant}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar contrato");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(file: File) {
    if (!contract) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas arquivo PDF");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo maior que 25 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("contract_id", contract.id);
      fd.append("file", file);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-upload-signed-contract`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      toast.success("Contrato enviado. Validação em andamento.");
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar contrato");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5 flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando contrato…
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-900">
          <FileSignature className="h-4 w-4 text-[#7A1F2B]" /> CONTRATO DO SERVIÇO
        </div>
        <p className="text-sm text-neutral-600 mt-2">
          Nenhum contrato disponível ainda. Após a confirmação do pagamento, seu contrato aparecerá aqui.
        </p>
      </div>
    );
  }

  const meta = STATUS_MAP[contract.status] || { label: contract.status.toUpperCase(), tone: "muted" as const };
  const canDownloadCompany = !!contract.company_signed_at;
  const canUpload = ["pending_customer_signature", "rejected", "pending_manual_review", "customer_signature_uploaded"].includes(contract.status);
  const motivoFalha = contract.validation_details?.motivo_falha as string | undefined;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-neutral-900">
          <FileSignature className="h-4 w-4 text-[#7A1F2B]" /> CONTRATO {contract.contract_number}
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest ${TONE_CLS[meta.tone]}`}>
          {meta.label}
        </span>
      </div>

      <ul className="mt-4 space-y-2 text-[12px] text-neutral-700">
        <li className="flex items-center gap-2">
          <CheckCircle2 className={`h-3.5 w-3.5 ${contract.issued_at ? "text-emerald-600" : "text-neutral-300"}`} />
          Contrato emitido {contract.issued_at && <span className="text-neutral-400">· {new Date(contract.issued_at).toLocaleString("pt-BR")}</span>}
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className={`h-3.5 w-3.5 ${contract.company_signed_at ? "text-emerald-600" : "text-neutral-300"}`} />
          Assinatura da Quero Armas {contract.company_signed_at && <span className="text-neutral-400">· {new Date(contract.company_signed_at).toLocaleString("pt-BR")}</span>}
        </li>
        <li className="flex items-center gap-2">
          <Clock className={`h-3.5 w-3.5 ${contract.customer_uploaded_at ? "text-emerald-600" : "text-neutral-300"}`} />
          PDF assinado pelo cliente {contract.customer_uploaded_at && <span className="text-neutral-400">· {new Date(contract.customer_uploaded_at).toLocaleString("pt-BR")}</span>}
        </li>
        <li className="flex items-center gap-2">
          <AlertCircle className={`h-3.5 w-3.5 ${contract.validation_status === "valid" ? "text-emerald-600" : "text-neutral-300"}`} />
          Validação criptográfica {contract.customer_signature_validated_at && <span className="text-neutral-400">· {new Date(contract.customer_signature_validated_at).toLocaleString("pt-BR")}</span>}
        </li>
      </ul>

      {motivoFalha && contract.status === "rejected" && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          <strong>Motivo da rejeição:</strong> {motivoFalha} — reenvie o PDF assinado.
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={!canDownloadCompany || downloading}
          onClick={() => handleDownload("company_signed")}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#7A1F2B] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar contrato
        </button>

        {contract.customer_signed_pdf_path && (
          <button
            type="button"
            disabled={downloading}
            onClick={() => handleDownload("customer_signed")}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-[12px] font-bold text-neutral-800 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Meu PDF assinado
          </button>
        )}

        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <button
              type="button"
              disabled={uploading || !canDownloadCompany}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#7A1F2B] bg-white px-3 py-2 text-[12px] font-bold text-[#7A1F2B] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Enviar contrato assinado
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px] font-bold text-neutral-600"
          aria-label="Atualizar status"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">
        O contrato deve ser assinado com Gov.br ou certificado ICP-Brasil. A validação é criptográfica — não usamos OCR.
      </p>
    </div>
  );
}

export default function ContratoBlock(props: { clienteId: number | null }) {
  return (
    <ContratoBlockErrorBoundary>
      <ContratoBlockInner {...props} />
    </ContratoBlockErrorBoundary>
  );
}