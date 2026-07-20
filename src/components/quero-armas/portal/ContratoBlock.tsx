import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileSignature, Clock, AlertCircle, CheckCircle2, Loader2,
  Download, Upload, RefreshCw,
} from "lucide-react";
import { openMinutaContratoQueroArmas } from "@/lib/quero-armas/minutaContratoDownload";

/**
 * BLOCO 10 (Pass A skeleton)
 * Mostra status do contrato pós-pagamento da venda mais recente paga.
 * Pass B adicionará download/upload/validação.
 */

interface Contract {
  id: string;
  venda_id: number;
  contract_number: string;
  status: string;
  validation_status: string | null;
  issued_at: string | null;
  company_signed_at: string | null;
  customer_uploaded_at: string | null;
  customer_signature_validated_at?: string | null;
  validation_details?: any;
}

const STATUS_MAP: Record<string, { label: string; tone: "muted" | "info" | "warn" | "ok" | "err" }> = {
  generated_pending_company_signature: { label: "DISPONÍVEL PARA ASSINATURA", tone: "info" },
  pending_customer_signature: { label: "DISPONÍVEL PARA ASSINATURA", tone: "info" },
  customer_signature_uploaded: { label: "AGUARDANDO ENVIO DO PDF ASSINADO", tone: "info" },
  validating: { label: "ASSINATURA EM VALIDAÇÃO", tone: "info" },
  validated: { label: "CONTRATO VALIDADO", tone: "ok" },
  rejected: { label: "CONTRATO REJEITADO — REENVIAR", tone: "err" },
  pending_manual_review: { label: "EM REVISÃO MANUAL", tone: "warn" },
};

const TONE_CLS: Record<string, string> = {
  muted: "bg-[#FAFAFA] text-[#6A6A6A] border-[#E4E4E4]",
  info: "bg-white text-[#0A0A0A] border-[#E4E4E4]",
  warn: "bg-white text-[#0A0A0A] border-[#E4E4E4]",
  ok: "bg-white text-[#0A0A0A] border-[#E4E4E4]",
  err: "bg-white text-[#0A0A0A] border-[#E4E4E4]",
};

const DOT_CLS: Record<string, string> = {
  muted: "bg-[#C4C4C4]",
  info: "bg-[#FEBC2E]",
  warn: "bg-[#FEBC2E]",
  ok: "bg-[#28C840]",
  err: "bg-[#FF5F57]",
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
        <div className="rounded-sm border border-[#E4E4E4] bg-white p-5 text-[12px] text-[#6A6A6A]">
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
          .select("id, venda_id, contract_number, status, validation_status, issued_at, company_signed_at, customer_uploaded_at, customer_signature_validated_at, validation_details")
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

  async function handleDownload() {
    if (!contract) return;
    setDownloading(true);
    try {
      await openMinutaContratoQueroArmas({
        contractId: contract.id,
        contractNumber: contract.contract_number,
        vendaId: contract.venda_id,
      });
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
      <div className="rounded-sm border border-[#E4E4E4] bg-white p-5 flex items-center gap-2 text-sm text-[#6A6A6A]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando contrato…
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="rounded-sm border border-[#E4E4E4] bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#0A0A0A]">
          <FileSignature className="h-4 w-4 text-[#0A0A0A]" /> CONTRATO DO SERVIÇO
        </div>
        <p className="text-sm text-[#6A6A6A] mt-2">
          Nenhum contrato disponível ainda. Após a confirmação do pagamento, seu contrato aparecerá aqui.
        </p>
      </div>
    );
  }

  const meta = STATUS_MAP[contract.status] || { label: contract.status.toUpperCase(), tone: "muted" as const };
  // Contrato de adesão: cliente pode baixar assim que o contrato é emitido.
  const canDownloadCompany = !!contract.issued_at;
  const canUpload = [
    "generated_pending_company_signature",
    "pending_customer_signature",
    "rejected",
    "pending_manual_review",
    "customer_signature_uploaded",
  ].includes(contract.status);
  const motivoFalha = contract.validation_details?.motivo_falha as string | undefined;

  return (
    <div className="rounded-sm border border-[#E4E4E4] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#0A0A0A]">
          <FileSignature className="h-4 w-4 text-[#0A0A0A]" /> CONTRATO {contract.contract_number}
          <span className="ml-2 text-[10px] font-mono text-[#6A6A6A]">· CTR · ID:{contract.id.slice(0, 6).toUpperCase()}</span>
        </div>
        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${TONE_CLS[meta.tone]}`}>
          <span className={`h-2 w-2 rounded-full ${DOT_CLS[meta.tone]}`} />
          {meta.label}
        </span>
      </div>

      <ul className="mt-4 space-y-2 text-[12px] text-[#0A0A0A]">
        <li className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${contract.issued_at ? "bg-[#28C840]" : "bg-[#E4E4E4]"}`} />
          Contrato emitido {contract.issued_at && <span className="text-[#6A6A6A]">· {new Date(contract.issued_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>}
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${contract.customer_uploaded_at ? "bg-[#28C840]" : "bg-[#E4E4E4]"}`} />
          PDF assinado pelo cliente {contract.customer_uploaded_at && <span className="text-[#6A6A6A]">· {new Date(contract.customer_uploaded_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>}
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${contract.validation_status === "valid" ? "bg-[#28C840]" : "bg-[#E4E4E4]"}`} />
          Validação criptográfica {contract.customer_signature_validated_at && <span className="text-[#6A6A6A]">· {new Date(contract.customer_signature_validated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>}
        </li>
      </ul>

      {motivoFalha && contract.status === "rejected" && (
        <div className="mt-4 rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[11px] text-[#0A0A0A] flex items-start gap-2">
          <span className="h-2 w-2 rounded-full bg-[#FF5F57] mt-1 shrink-0" />
          <span>
          <strong>Motivo da rejeição:</strong> {motivoFalha} — reenvie o PDF assinado.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={!canDownloadCompany || downloading}
          onClick={() => handleDownload()}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#0A0A0A] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1a1a]"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Baixar contrato
        </button>

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
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-[#0A0A0A] bg-white px-3 py-2 text-[12px] font-bold text-[#0A0A0A] disabled:opacity-50 hover:bg-[#FAFAFA]"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Enviar contrato assinado
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-[#E4E4E4] bg-white px-3 py-2 text-[12px] font-bold text-[#6A6A6A] hover:bg-[#FAFAFA]"
          aria-label="Atualizar status"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-3 text-[11px] text-[#6A6A6A]">
        Contrato de adesão: baixe, assine com Gov.br ou certificado ICP-Brasil e reenvie. A validação é criptográfica — não usamos OCR.
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
