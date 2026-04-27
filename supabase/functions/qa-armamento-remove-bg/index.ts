import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMOVE_BG_API_KEY = Deno.env.get("REMOVE_BG_API_KEY");
const BUCKET = "qa-armamentos";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extrai o caminho relativo no bucket a partir da URL pública. */
function pathFromPublicUrl(url: string): string | null {
  // .../object/public/qa-armamentos/<path>?...
  const m = url.match(/\/object\/public\/qa-armamentos\/([^?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

async function processOne(
  admin: ReturnType<typeof createClient>,
  id: string,
): Promise<{ id: string; ok: boolean; error?: string; imagem?: string }> {
  const { data: row, error } = await admin
    .from("qa_armamentos_catalogo")
    .select("id, imagem")
    .eq("id", id)
    .maybeSingle();
  if (error) return { id, ok: false, error: error.message };
  if (!row?.imagem) return { id, ok: false, error: "sem_imagem" };

  // baixa a imagem original
  const imgRes = await fetch(row.imagem);
  if (!imgRes.ok) return { id, ok: false, error: `download_${imgRes.status}` };
  const imgBlob = await imgRes.blob();

  // envia ao remove.bg
  const fd = new FormData();
  fd.append("image_file", imgBlob, "image.png");
  fd.append("size", "auto");
  fd.append("format", "png");
  fd.append("type", "product");

  const rb = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": REMOVE_BG_API_KEY! },
    body: fd,
  });
  if (!rb.ok) {
    const txt = await rb.text().catch(() => "");
    return { id, ok: false, error: `remove_bg_${rb.status}:${txt.slice(0, 200)}` };
  }
  const cleanBuf = new Uint8Array(await rb.arrayBuffer());

  // grava no mesmo path (ou novo) no bucket público
  const existingPath = pathFromPublicUrl(row.imagem);
  const targetPath = existingPath || `auto/${id}.png`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(targetPath, cleanBuf, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) return { id, ok: false, error: `upload:${upErr.message}` };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(targetPath);
  const finalUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await admin
    .from("qa_armamentos_catalogo")
    .update({ imagem: finalUrl, imagem_status: "pronta" })
    .eq("id", id);
  if (updErr) return { id, ok: false, error: `update:${updErr.message}` };

  return { id, ok: true, imagem: finalUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!REMOVE_BG_API_KEY) {
    return jsonResponse({ error: "REMOVE_BG_API_KEY não configurado" }, 500);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // modo lote
  if (Array.isArray(body?.ids) && body.ids.length > 0) {
    const results = [];
    for (const id of body.ids) {
      try {
        results.push(await processOne(admin, String(id)));
      } catch (e: any) {
        results.push({ id: String(id), ok: false, error: e?.message || String(e) });
      }
    }
    return jsonResponse({ results });
  }

  // modo individual
  const id = body?.id ? String(body.id) : null;
  if (!id) return jsonResponse({ error: "id obrigatório" }, 400);

  try {
    const r = await processOne(admin, id);
    return jsonResponse(r, r.ok ? 200 : 422);
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message || String(e) }, 500);
  }
});