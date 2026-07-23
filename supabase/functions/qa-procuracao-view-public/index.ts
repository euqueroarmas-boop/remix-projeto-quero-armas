/**
 * qa-procuracao-view-public
 *
 * Link público por UUID, no mesmo padrão do contrato de adesão.
 * Entrega HTML para visualização e PDF para download da procuração.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function textFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function filename(partes: Array<string | null | undefined>): string {
  return partes
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() + ".pdf";
}

function renderPdf(html: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const marginX = 54;
  const marginY = 56;
  const width = 595.28 - marginX * 2;
  let y = marginY;

  doc.setFont("times", "normal");
  doc.setFontSize(12);

  for (const raw of textFromHtml(html).split(/\n+/)) {
    const line = raw.trim();
    if (!line) {
      y += 10;
      continue;
    }
    const wrapped = doc.splitTextToSize(line, width) as string[];
    for (const piece of wrapped) {
      if (y > 785) {
        doc.addPage();
        y = marginY;
      }
      doc.text(piece, marginX, y);
      y += 17;
    }
    y += 5;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    let procuracaoId = "";
    let action = "";
    let format = "";
    if (req.method === "GET") {
      const url = new URL(req.url);
      procuracaoId = String(url.searchParams.get("procuracao_id") ?? url.searchParams.get("id") ?? "").trim();
      action = String(url.searchParams.get("action") ?? "").trim();
      format = String(url.searchParams.get("format") ?? "").trim();
    } else {
      const body = await req.json().catch(() => ({}));
      procuracaoId = String(body.procuracao_id ?? body.id ?? "").trim();
      action = String(body.action ?? "").trim();
      format = String(body.format ?? "").trim();
    }

    if (!procuracaoId || !UUID_RE.test(procuracaoId)) {
      return json({ error: "procuracao_id inválido" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await sb
      .from("qa_procuracoes")
      .select("id, cliente_id, venda_id, status, conteudo_renderizado, generated_at, outorgado_ate")
      .eq("id", procuracaoId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Procuração não encontrada" }, 404);

    const conteudo = String((data as any).conteudo_renderizado ?? "").trim();
    if (!conteudo) return json({ error: "Procuração sem conteúdo publicado" }, 422);

    const { data: cliente } = await sb
      .from("qa_clientes")
      .select("nome_completo")
      .eq("id", (data as any).cliente_id)
      .maybeSingle();

    const numero = (data as any).venda_id ? `VENDA ${(data as any).venda_id}` : "PROCURAÇÃO";
    const nomeCliente = (cliente as any)?.nome_completo ?? "";

    if (action === "download" || format === "pdf") {
      const pdf = renderPdf(conteudo);
      const fname = filename([numero, "Procuração Quero Armas", nomeCliente]);
      return new Response(pdf, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
          "Cache-Control": "no-store",
        },
      });
    }

    return json({
      ok: true,
      id: (data as any).id,
      status: (data as any).status,
      issued_at: (data as any).generated_at,
      outorgado_ate: (data as any).outorgado_ate,
      conteudo_html: conteudo,
      venda_id: (data as any).venda_id ?? null,
      nome_cliente: nomeCliente,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
