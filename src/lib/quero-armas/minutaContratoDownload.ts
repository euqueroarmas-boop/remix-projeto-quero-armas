import { supabase } from "@/integrations/supabase/client";

export const QA_CONTRACT_MINUTA_SOURCE = "Minuta_Contrato_Quero_Armas_v1.md";
export const QA_CONTRACT_TEMPLATE_CODE = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";

type OpenMinutaArgs = {
  contractId: string;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  slugs?: string[];
};

export async function openMinutaContratoQueroArmas(args: OpenMinutaArgs) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-contract-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      contract_id: args.contractId,
      venda_id: args.vendaId ? Number(args.vendaId) : undefined,
      variant: "company_signed",
      template_source: QA_CONTRACT_MINUTA_SOURCE,
      template_codigo: QA_CONTRACT_TEMPLATE_CODE,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || err?.error || `HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  const filename = `Contrato-${args.contractNumber || args.contractId}.${contentType.includes("pdf") ? "pdf" : "html"}`;

  if (contentType.includes("text/html")) {
    // Fallback: abre HTML numa nova aba para o cliente imprimir/salvar como PDF
    const html = await resp.text();
    const w = window.open("", "_blank");
    if (!w) throw new Error("Pop-up bloqueado. Permita pop-ups.");
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  const blob = await resp.blob();
  if (!blob || blob.size === 0) {
    throw new Error("Contrato retornou vazio. Fale com o suporte.");
  }
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
