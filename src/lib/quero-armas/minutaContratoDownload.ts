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
  const win = window.open("", "_blank");
  if (!win) throw new Error("Pop-up bloqueado. Permita pop-ups para abrir o contrato.");

  win.document.open();
  win.document.write(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carregando contrato...</title><body style="font-family:system-ui;padding:24px;color:#444">Carregando contrato renderizado...</body>',
  );
  win.document.close();

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
    win.close();
    throw new Error(err?.message || err?.error || `HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = await resp.text();
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try { win.print(); } catch { /* ignore */ }
    }, 500);
    return;
  }

  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  win.location.href = blobUrl;
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
