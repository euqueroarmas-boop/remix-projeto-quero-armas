type RenderedContractArgs = {
  html: string | null | undefined;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  fallbackId?: string | null;
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function sanitizeRenderedContractHtml(html: string): string {
  return html
    .replace(/Identificador\s*\(\s*slug\s*\)\s*:?/gi, "Identificador:")
    .replace(/\(\s*slug\s*\)/gi, "")
    .replace(/<li[^>]*>\s*slug[^<]*<\/li>/gi, "")
    .replace(/\bslug\s*:\s*[a-z0-9_-]+/gi, "");
}

export function buildPrintableRenderedContract({
  html,
  contractNumber,
  vendaId,
  fallbackId,
}: RenderedContractArgs): string {
  const number = contractNumber || fallbackId || "contrato";
  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contrato ${escapeHtml(number)} - Quero Armas</title>
<style>
  @page{size:A4;margin:18mm 16mm;}
  *{box-sizing:border-box;}
  body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;background:#fff;}
  h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 22px;}
  h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
  p{margin:10px 0;text-align:justify;}
  ul,ol{padding-left:22px;} li{margin:6px 0;}
  section[data-anexo-slug]{break-inside:avoid;}
  .qa-ref-contract-anexo,.qa-anexo-aviso{background:#fdecee;border-left:3px solid #7a1f2b;padding:8px 12px;}
  .qa-print-actions{position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;margin:-8px 0 22px;padding:10px 0;background:rgba(255,255,255,.95);border-bottom:1px solid #eee;}
  .qa-print-actions button{border:1px solid #7a1f2b;background:#7a1f2b;color:#fff;border-radius:4px;padding:9px 14px;font:700 12px system-ui;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;}
  .qa-print-note{font:12px system-ui;color:#555;margin:0 auto 18px;max-width:780px;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print{
    body{max-width:none;margin:0;padding:0;}
    .qa-print-actions,.qa-print-note{display:none!important;}
  }
</style></head><body>
<div class="qa-print-actions"><button type="button" onclick="window.print()">Salvar/assinar em PDF</button></div>
<p class="qa-print-note">Este é o contrato completo. Para assinar pelo GOV.BR ou certificado ICP-Brasil, use "Salvar/assinar em PDF".</p>
${sanitizeRenderedContractHtml(String(html ?? ""))}
<div class="qa-rodape-probatorio">Documento gerado em ${escapeHtml(generatedAt)} · Contrato ${escapeHtml(number)} · Pedido ${escapeHtml(vendaId ?? "-")}</div>
</body></html>`;
}

export function openRenderedContract(args: RenderedContractArgs): boolean {
  if (!args.html?.trim()) return false;
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildPrintableRenderedContract(args));
  win.document.close();
  return true;
}
