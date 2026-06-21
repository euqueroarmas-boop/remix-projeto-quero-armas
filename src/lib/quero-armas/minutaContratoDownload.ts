import { supabase } from "@/integrations/supabase/client";
import { filterContractAnexosBySlugs } from "@/lib/quero-armas/contractAnexoFilter";

export const QA_CONTRACT_MINUTA_SOURCE = "Minuta_Contrato_Quero_Armas_v1.md";
export const QA_CONTRACT_TEMPLATE_CODE = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";

type OpenMinutaArgs = {
  contractId: string;
  contractNumber?: string | null;
  vendaId?: number | string | null;
  slugs?: string[];
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sanitizeTechnicalJargon = (html: string) =>
  html
    .replace(/Identificador\s*\(\s*slug\s*\)\s*:?/gi, "Identificador:")
    .replace(/\(\s*slug\s*\)/gi, "")
    .replace(/<li[^>]*>\s*slug[^<]*<\/li>/gi, "")
    .replace(/\bslug\s*:\s*[a-z0-9_-]+/gi, "");

async function loadContractSlugs(contractId: string, fallbackSlugs: string[]) {
  if (fallbackSlugs.length > 0) return fallbackSlugs;

  const { data } = await supabase
    .from("qa_contract_items" as any)
    .select("service_slug_snapshot")
    .eq("contract_id", contractId);

  return ((data as any[]) || [])
    .map((item) => String(item.service_slug_snapshot || "").trim())
    .filter(Boolean);
}

async function loadMinutaHtml() {
  const { data, error } = await supabase
    .from("qa_contract_templates" as any)
    .select("corpo_html")
    .eq("codigo", QA_CONTRACT_TEMPLATE_CODE)
    .eq("vigente", true)
    .ilike("observacoes", `%${QA_CONTRACT_MINUTA_SOURCE}%`)
    .maybeSingle();

  if (error) throw error;
  if (!(data as any)?.corpo_html) {
    throw new Error(`Minuta não encontrada no SQL: ${QA_CONTRACT_MINUTA_SOURCE}`);
  }
  return String((data as any).corpo_html);
}

function buildPrintableMinuta(args: OpenMinutaArgs & { html: string }) {
  const number = args.contractNumber || args.contractId;
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
  .qa-anexo-aviso{background:#fff8db;border-left:3px solid #c9a84c;padding:8px 12px;}
  .qa-print-actions{position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;margin:-8px 0 22px;padding:10px 0;background:rgba(255,255,255,.95);border-bottom:1px solid #eee;}
  .qa-print-actions button{border:1px solid #7a1f2b;background:#7a1f2b;color:#fff;border-radius:4px;padding:9px 14px;font:700 12px system-ui;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;}
  .qa-print-note{font:12px system-ui;color:#555;margin:0 auto 18px;max-width:780px;}
  .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
  @media print{body{max-width:none;margin:0;padding:0;}.qa-print-actions,.qa-print-note{display:none!important;}}
</style></head><body>
<div class="qa-print-actions"><button type="button" onclick="window.print()">Salvar/assinar em PDF</button></div>
<p class="qa-print-note">Modelo: ${escapeHtml(QA_CONTRACT_MINUTA_SOURCE)}. Para assinar pelo GOV.BR ou certificado ICP-Brasil, use "Salvar/assinar em PDF".</p>
${sanitizeTechnicalJargon(args.html)}
<div class="qa-rodape-probatorio">Documento gerado em ${escapeHtml(generatedAt)} · Minuta ${escapeHtml(QA_CONTRACT_MINUTA_SOURCE)} · Contrato ${escapeHtml(number)} · Pedido ${escapeHtml(args.vendaId ?? "-")}</div>
</body></html>`;
}

export async function openMinutaContratoQueroArmas(args: OpenMinutaArgs) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Pop-up bloqueado. Permita pop-ups para abrir o contrato.");

  win.document.open();
  win.document.write(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carregando contrato...</title><body style="font-family:system-ui;padding:24px;color:#444">Carregando Minuta_Contrato_Quero_Armas_v1.md...</body>',
  );
  win.document.close();

  const [html, slugs] = await Promise.all([
    loadMinutaHtml(),
    loadContractSlugs(args.contractId, args.slugs || []),
  ]);
  const filtered = filterContractAnexosBySlugs(html, slugs);

  win.document.open();
  win.document.write(buildPrintableMinuta({ ...args, html: filtered }));
  win.document.close();
}
