import { supabase } from "@/integrations/supabase/client";

export const QA_CONTRACT_MINUTA_SOURCE = "Minuta_Contrato_Quero_Armas_v1.md";
export const QA_CONTRACT_TEMPLATE_CODE = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";

type OpenMinutaArgs = {
  contractId: string;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  slugs?: string[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDownloadWindow(win: Window | null, title: string, body: string) {
  if (!win) return;
  try {
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f6f5f1;color:#0a0a0a;font-family:Arial,sans-serif}.wrap{max-width:720px;margin:56px auto;padding:0 24px}h1{font-family:Arial Narrow,Arial,sans-serif;font-size:20px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px}p{font-size:14px;line-height:1.5;color:#444}.btn{display:inline-block;margin-top:18px;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:2px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.hint{margin-top:14px;font-size:12px;color:#666}iframe{width:100%;height:70vh;border:1px solid #ddd;background:#fff;margin-top:20px}</style></head><body><main class="wrap">${body}</main></body></html>`);
    win.document.close();
  } catch {
    // Se o navegador impedir escrita na janela, o download por anchor abaixo ainda será tentado.
  }
}

export async function openMinutaContratoQueroArmas(args: OpenMinutaArgs) {
  const downloadWindow = window.open("", "_blank");
  renderDownloadWindow(
    downloadWindow,
    "Preparando contrato",
    "<h1>Preparando contrato</h1><p>O PDF correto está sendo gerado. Esta janela será atualizada automaticamente.</p>",
  );

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
        variant: "company_signed",
        template_source: QA_CONTRACT_MINUTA_SOURCE,
        template_codigo: QA_CONTRACT_TEMPLATE_CODE,
      }),
    });
  } catch (e) {
    renderDownloadWindow(
      downloadWindow,
      "Falha ao preparar contrato",
      "<h1>Falha ao preparar contrato</h1><p>Não foi possível conectar ao sistema agora. Volte para a área do cliente e tente novamente.</p>",
    );
    throw e;
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const message = err?.message || err?.error || `HTTP ${resp.status}`;
    renderDownloadWindow(
      downloadWindow,
      "Falha ao preparar contrato",
      `<h1>Falha ao preparar contrato</h1><p>${escapeHtml(message)}</p>`,
    );
    throw new Error(message);
  }

  const contentType = resp.headers.get("content-type") || "";
  const filename = `Contrato-${args.contractNumber || args.contractId}.${contentType.includes("pdf") ? "pdf" : "html"}`;

  if (contentType.includes("text/html")) {
    // Fallback: abre HTML numa nova aba para o cliente imprimir/salvar como PDF
    const html = await resp.text();
    if (!downloadWindow) throw new Error("Pop-up bloqueado. Permita pop-ups ou downloads para este site.");
    downloadWindow.document.open();
    downloadWindow.document.write(html);
    downloadWindow.document.close();
    return;
  }

  const blob = await resp.blob();
  if (!blob || blob.size === 0) {
    renderDownloadWindow(
      downloadWindow,
      "Contrato vazio",
      "<h1>Contrato vazio</h1><p>O sistema retornou um arquivo vazio. Fale com o suporte.</p>",
    );
    throw new Error("Contrato retornou vazio. Fale com o suporte.");
  }
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  renderDownloadWindow(
    downloadWindow,
    "Contrato pronto",
    `<h1>Contrato pronto</h1><p>Se o download não começou automaticamente, clique no botão abaixo.</p><a class="btn" href="${blobUrl}" download="${escapeHtml(filename)}">Baixar contrato PDF</a><p class="hint">Depois de baixar, assine este mesmo PDF no GOV.BR sem editar, imprimir ou digitalizar.</p><iframe src="${blobUrl}" title="Contrato PDF"></iframe>`,
  );
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10 * 60_000);
}
