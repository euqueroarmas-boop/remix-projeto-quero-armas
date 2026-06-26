const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token",
};

import { ARSENAL_MOCK_HTML } from "./mock.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TOKEN = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";

const REPLACEMENTS: Record<string, string> = {
  nome_cliente: "WILLIAN MASSAROTO",
  nome_documento: "CRAF — PISTOLA TAURUS G2C 9MM",
  tipo_documento: "CRAF",
  data_vencimento: "15/03/2027",
  dias_restantes: "45",
  fabricante_armamento: "TAURUS",
  modelo_armamento: "G2C",
  numero_serie: "ABC123456",
  sistema_origem: "SIGMA / EXÉRCITO",
  link_hub: "https://www.euqueroarmas.com.br/area-do-cliente/arsenal",
};

function fill(html: string) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => REPLACEMENTS[k] ?? `{{${k}}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { to } = await req.json().catch(() => ({ to: null }));
    const recipient = (to || "willmassaroto@gmail.com").toLowerCase();

    const page = ARSENAL_MOCK_HTML;
    const styleMatch = page.match(/<style>([\s\S]*?)<\/style>/);
    const styleCss = styleMatch ? styleMatch[1] : "";

    // Each mockup = <div class="mock-label">...</div>\n<table class="email"...>...</table>
    const blockRegex = /<div class="mock-label"><span>\s*(?:<span class="status-dot"[^>]*><\/span>)?([\s\S]*?)<\/span>[\s\S]*?<\/div>\s*(<table class="email"[\s\S]*?<\/table>)/g;
    const mockups: { title: string; html: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = blockRegex.exec(page)) !== null) {
      const rawTitle = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      mockups.push({ title: rawTitle, html: m[2] });
    }

    const results: Array<{ n: number; title: string; ok: boolean; error?: string }> = [];
    let i = 0;
    for (const mock of mockups) {
      i++;
      const wrapped = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><style>${styleCss}</style></head><body style="background:#000;margin:0;padding:24px 12px;">${fill(mock.html)}</body></html>`;
      const subject = `[ARSENAL INTELIGENTE · ${String(i).padStart(2, "0")}/12] ${fill(mock.title)}`;
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-smtp-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "x-internal-token": INTERNAL_TOKEN,
          },
          body: JSON.stringify({ to: recipient, subject, html: wrapped, from_name: "Quero Armas · Arsenal Inteligente" }),
        });
        const body = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 200)}`);
        results.push({ n: i, title: mock.title, ok: true });
      } catch (e) {
        results.push({ n: i, title: mock.title, ok: false, error: String((e as Error)?.message || e) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ recipient, total: mockups.length, sent: results.filter((r) => r.ok).length, results }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});