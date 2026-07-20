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
  nome_cliente_humano: "Willian Massaroto",
  nome_documento: "CRAF — PISTOLA TAURUS G2C 9MM",
  tipo_documento: "CRAF",
  data_vencimento: "15/03/2027",
  dias_restantes: "45",
  fabricante_armamento: "TAURUS",
  modelo_armamento: "G2C",
  numero_serie: "ABC123456",
  sistema_origem: "SIGMA / EXÉRCITO",
  link_hub: "https://www.euqueroarmas.com.br/area-do-cliente/arsenal",
  // Concordância de gênero para a arma do exemplo (pistola — feminino)
  arma_nome: "pistola Taurus G2C 9mm",
  arma_artigo: "sua",
  arma_artigo_cap: "Sua",
  arma_artigo_a: "à sua",
  arma_artigo_de: "da sua",
  link_gerenciar_avisos: "https://www.euqueroarmas.com.br/area-do-cliente/preferencias",
};

function fill(html: string) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => REPLACEMENTS[k] ?? `{{${k}}}`);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toPlainText(html: string) {
  return decodeEntities(fill(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function cleanSubject(title: string) {
  const base = fill(title)
    .replace(/^\d+\s*[·.-]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || "Atualização do Arsenal Inteligente";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({} as any));
    const recipient = (payload?.to || "willmassaroto@gmail.com").toLowerCase();
    const indexParam = Number(payload?.index);

    const page = ARSENAL_MOCK_HTML;
    const styleMatch = page.match(/<style>([\s\S]*?)<\/style>/);
    const styleCss = styleMatch ? styleMatch[1] : "";

    // Cada mockup começa em <div class="mock-label">…</div> e é seguido por
    // <table class="email">…</table>. O corpo do e-mail tem <table class="meta">
    // aninhada, então um regex simples para no primeiro </table>. Aqui fazemos
    // um parsing balanceado: encontramos cada início de <table class="email"
    // e contamos abre/fecha até bater zero.
    const labelRe = /<div class="mock-label"><span>(?:\s*<span class="status-dot"[^>]*><\/span>)?([\s\S]*?)<\/span>[\s\S]*?<\/div>/g;
    const mockups: { title: string; html: string }[] = [];
    let lm: RegExpExecArray | null;
    while ((lm = labelRe.exec(page)) !== null) {
      const rawTitle = lm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      // Encontra o próximo <table class="email" após o label
      const startSearchFrom = lm.index + lm[0].length;
      const tableStart = page.indexOf('<table class="email"', startSearchFrom);
      if (tableStart < 0) continue;
      // Balanceia <table ... > e </table>
      const openRe = /<table\b[^>]*>/g;
      const closeRe = /<\/table>/g;
      openRe.lastIndex = tableStart;
      closeRe.lastIndex = tableStart;
      let depth = 0;
      let cursor = tableStart;
      let end = -1;
      // Itera pegando o próximo open ou close, o que vier antes
      while (true) {
        openRe.lastIndex = cursor;
        closeRe.lastIndex = cursor;
        const openMatch = openRe.exec(page);
        const closeMatch = closeRe.exec(page);
        if (!closeMatch) break;
        if (openMatch && openMatch.index < closeMatch.index) {
          depth += 1;
          cursor = openMatch.index + openMatch[0].length;
        } else {
          depth -= 1;
          cursor = closeMatch.index + closeMatch[0].length;
          if (depth === 0) { end = cursor; break; }
        }
      }
      if (end < 0) continue;
      mockups.push({ title: rawTitle, html: page.slice(tableStart, end) });
    }

    const results: Array<{ n: number; title: string; ok: boolean; error?: string }> = [];
    // If `index` (1-based) is provided OR mode=one, send a single mockup.
    // Default rotation: pick based on current UTC minute (% mockups.length) so cron every 1 min cycles.
    let toSend: { mock: { title: string; html: string }; i: number }[] = [];
    if (payload?.mode === "all") {
      toSend = mockups.map((mock, idx) => ({ mock, i: idx + 1 }));
    } else {
      const total = mockups.length;
      const idx = Number.isFinite(indexParam) && indexParam >= 1 && indexParam <= total
        ? Math.floor(indexParam) - 1
        : new Date().getUTCMinutes() % total;
      toSend = [{ mock: mockups[idx], i: idx + 1 }];
    }

    // LIGHT (fundo branco) preservando indicadores coloridos, header, status pill e botão CTA.
    const lightOverride = `
      body{background:#FFFFFF !important;color:#0A0A0A !important;}
      .page{background:#FFFFFF !important;}
      .email{background:#FFFFFF !important;border-color:#E5E5E7 !important;box-shadow:0 1px 3px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08) !important;}
      .email-header{border-bottom-color:#EFEFF1 !important;}
      .email-footer{border-top-color:#EFEFF1 !important;color:#74747E !important;background:#FFFFFF !important;}
      .brand-name strong,h1,h2,.section-title,.kicker,.guardrail h3{color:#0A0A0A !important;}
      .brand-name span,.header-code,.mock-label{color:#74747E !important;}
      .copy,.lead,.guardrail p{color:#3A3A3F !important;}
      .meta td{border-bottom-color:#EFEFF1 !important;}
      .meta td:first-child{color:#74747E !important;}
      .meta td:last-child{color:#0A0A0A !important;}
      .note{color:#74747E !important;}
      .cta{color:#FFFFFF !important;}
      .email-header{display:table !important;width:100% !important;}
      .brand{display:table-cell !important;vertical-align:middle !important;text-align:left !important;width:60% !important;}
      .header-code{display:table-cell !important;vertical-align:middle !important;text-align:right !important;white-space:nowrap !important;width:40% !important;}
    `;
    for (const { mock, i } of toSend) {
      // Boas-vindas usa --status:#FFFFFF (invisível no fundo branco) → troca para tinta preta.
      // Remove o filter que deixa a logo branca (some no fundo branco).
      const mockHtml = fill(mock.html)
        .replace(/--status:\s*#FFFFFF/gi, "--status:#0A0A0A")
        .replace(/--status-fg:\s*#000000/gi, "--status-fg:#FFFFFF")
        .replace(/filter:\s*brightness\(0\)\s*invert\(1\);?/gi, "");
      const wrapped = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><style>${styleCss}${lightOverride}</style></head><body style="background:#FFFFFF;margin:0;padding:24px 12px;">${mockHtml}</body></html>`;
      const subject = cleanSubject(mock.title);
      const text = `${subject}\n\n${toPlainText(mock.html)}\n\nAcesse seu Arsenal Inteligente: ${REPLACEMENTS.link_hub}\n\nPara não receber estes avisos, responda este e-mail com a palavra REMOVER.`;
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-smtp-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "x-internal-token": INTERNAL_TOKEN,
          },
          body: JSON.stringify({
            to: recipient,
            subject,
            html: wrapped,
            text,
            from_name: "Arsenal Inteligente",
            reply_to: "contato@euqueroarmas.com.br",
            list_unsubscribe: "<mailto:contato@euqueroarmas.com.br?subject=REMOVER>",
            list_unsubscribe_post: "List-Unsubscribe=One-Click",
          }),
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