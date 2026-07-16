import { supabase } from "@/integrations/supabase/client";

export const QA_CONTRACT_MINUTA_SOURCE = "Minuta_Contrato_Quero_Armas_v1.md";
export const QA_CONTRACT_TEMPLATE_CODE = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";

type OpenMinutaArgs = {
  contractId: string;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  slugs?: string[];
};

export type PreparedMinutaDownload = {
  href: string;
  filename: string;
  revoke: () => void;
  /** true quando o href é uma página HTML para abrir em nova aba (não um PDF para download direto) */
  openInNewTab?: boolean;
};

function filenameFromContentDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8.replace(/\+/g, "%20"));
  const quoted = header.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) return quoted;
  const plain = header.match(/filename=([^;]+)/i)?.[1]?.trim();
  return plain || fallback;
}

async function sessionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

function contractRequestBody(args: OpenMinutaArgs, variant: "company_signed" | "download_url" | "html_preview") {
  return JSON.stringify({
    contract_id: args.contractId,
    venda_id: args.vendaId ? Number(args.vendaId) : undefined,
    variant,
    template_source: QA_CONTRACT_MINUTA_SOURCE,
    template_codigo: QA_CONTRACT_TEMPLATE_CODE,
  });
}

export async function prepareMinutaContratoQueroArmas(args: OpenMinutaArgs): Promise<PreparedMinutaDownload> {
  const headers = await sessionHeaders();
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-contract-pdf`;

  // Baixa direto o PDF assinado (company_signed) — a variante html_preview
  // não é suportada pela edge function e resulta em 400 variant_desconhecida.
  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: contractRequestBody(args, "company_signed"),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || err?.error || `HTTP ${resp.status}`);
  }

  const blob = await resp.blob();
  if (!blob || blob.size === 0) {
    throw new Error("Contrato retornou vazio. Fale com o suporte.");
  }

  const fallback = `Contrato-${args.contractNumber || args.contractId}.pdf`;
  const filename = filenameFromContentDisposition(resp.headers.get("content-disposition"), fallback);
  const href = URL.createObjectURL(blob);
  return {
    href,
    filename,
    revoke: () => URL.revokeObjectURL(href),
  };
}

export async function openMinutaContratoQueroArmas(args: OpenMinutaArgs) {
  const prepared = await prepareMinutaContratoQueroArmas(args);
  const a = document.createElement("a");
  a.href = prepared.href;
  a.download = prepared.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(prepared.revoke, 60_000);
}
