import { supabase } from "@/integrations/supabase/client";

export const QA_CONTRACT_MINUTA_SOURCE = "Minuta_Contrato_Quero_Armas_v1.md";
export const QA_CONTRACT_TEMPLATE_CODE = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";

type OpenMinutaArgs = {
  contractId: string;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  slugs?: string[];
};

function triggerHiddenFrameDownload(url: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 120_000);
}

async function triggerBlobDownload(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  if (!blob || blob.size === 0) throw new Error("Contrato retornou vazio. Fale com o suporte.");
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openMinutaContratoQueroArmas(args: OpenMinutaArgs) {
  const { data: { session } } = await supabase.auth.getSession();
  let resp: Response;
  try {
    resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-contract-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        contract_id: args.contractId,
        venda_id: args.vendaId ? Number(args.vendaId) : undefined,
        variant: "download_url",
        template_source: QA_CONTRACT_MINUTA_SOURCE,
        template_codigo: QA_CONTRACT_TEMPLATE_CODE,
      }),
    });
  } catch (e) {
    throw e;
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const message = err?.message || err?.error || `HTTP ${resp.status}`;
    throw new Error(message);
  }

  const contentType = resp.headers.get("content-type") || "";
  const filename = `Contrato-${args.contractNumber || args.contractId}.${contentType.includes("pdf") ? "pdf" : "html"}`;

  if (contentType.includes("application/json")) {
    const data = await resp.json().catch(() => ({}));
    if (!data?.url) throw new Error("Link de download indisponível. Tente novamente.");
    triggerHiddenFrameDownload(String(data.url));
    return;
  }

  if (contentType.includes("text/html")) {
    throw new Error("Contrato retornou em HTML. Fale com o suporte para gerar o PDF canônico.");
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
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10 * 60_000);
}
