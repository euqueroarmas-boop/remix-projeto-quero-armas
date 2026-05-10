import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, ShieldCheck, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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

export default function ContratoBlock({ clienteId }: { clienteId: number | null }) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => {
    if (!clienteId) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_contracts" as any)
        .select("id, contract_number, status, validation_status, issued_at, company_signed_at, customer_uploaded_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancel) {
        setContract((data as any) || null);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [clienteId]);

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
          PDF assinado pelo cliente
        </li>
        <li className="flex items-center gap-2">
          <AlertCircle className={`h-3.5 w-3.5 ${contract.validation_status === "valid" ? "text-emerald-600" : "text-neutral-300"}`} />
          Validação criptográfica
        </li>
      </ul>

      <p className="mt-4 text-[11px] text-neutral-500">
        Download e envio do contrato assinado serão liberados na próxima etapa.
      </p>
    </div>
  );
}