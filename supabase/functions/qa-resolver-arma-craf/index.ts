import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Pede para a IA extrair marca/modelo/calibre/tipo a partir do texto livre do CRAF. */
async function parseArma(nomeArma: string): Promise<{
  marca: string;
  modelo: string;
  calibre: string | null;
  tipo: "pistola"|"revolver"|"espingarda"|"carabina"|"fuzil"|"submetralhadora"|"outra";
} | null> {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!KEY) throw new Error("LOVABLE_API_KEY ausente");

  const tool = {
    type: "function",
    function: {
      name: "registrar_arma",
      description: "Extrai marca, modelo, calibre e tipo de uma arma a partir da descrição do CRAF",
      parameters: {
        type: "object",
        properties: {
          marca: { type: "string", description: "Marca do fabricante (ex: Taurus, Glock, CBC, Beretta)" },
          modelo: { type: "string", description: "Modelo exato (ex: G2C, 17, Pump 12, 92)" },
          calibre: { type: ["string","null"], description: "Calibre real (ex: 9mm, .40 S&W, .12, .380)" },
          tipo: { type: "string", enum: ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"] },
        },
        required: ["marca","modelo","tipo"],
        additionalProperties: false,
      },
    },
  };

  const resp = await fetch(LOVABLE_AI, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em identificação de armas de fogo brasileiras (CAC, PF, EB). Dado um nome livre vindo de um CRAF, extraia marca, modelo, calibre e tipo com precisão. Use grafias canônicas dos fabricantes (Taurus, Glock, CBC, Beretta, Smith & Wesson, Sig Sauer, Imbel, Rossi etc). Se houver múltiplos calibres possíveis, escolha o mais comum para o modelo.",
        },
        { role: "user", content: `Identifique a arma: "${nomeArma}"` },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "registrar_arma" } },
    }),
  });
  if (!resp.ok) {
    console.warn("[parse] gateway falhou", resp.status, await resp.text().catch(()=>""));
    return null;
  }
  const json = await resp.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try { return JSON.parse(args); } catch { return null; }
}

/** Tenta achar uma entrada existente no catálogo por marca+modelo (com calibre opcional). */
async function findCatalog(sb: any, marca: string, modelo: string, calibre: string | null) {
  const m = norm(marca);
  const md = norm(modelo);
  const { data } = await sb
    .from("qa_armamentos_catalogo")
    .select("*")
    .eq("ativo", true);
  if (!data) return null;
  // match exato
  let best: any = null;
  let bestScore = 0;
  for (const it of data as any[]) {
    const im = norm(it.marca);
    const imd = norm(it.modelo);
    let score = 0;
    if (im === m) score += 5;
    else if (im.startsWith(m) || m.startsWith(im)) score += 2;
    if (imd === md) score += 5;
    else if (imd.includes(md) || md.includes(imd)) score += 3;
    if (calibre && norm(it.calibre) === norm(calibre)) score += 2;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return bestScore >= 7 ? best : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Aceita: { craf_id } | { gte_id } | { nome_arma }
    let nomeArma: string | null = body?.nome_arma || null;
    let table: "qa_crafs" | "qa_gtes" | null = null;
    let rowId: number | null = null;
    if (body?.craf_id) {
      table = "qa_crafs"; rowId = Number(body.craf_id);
      const { data } = await sb.from("qa_crafs").select("nome_arma").eq("id", rowId).maybeSingle();
      nomeArma = data?.nome_arma || null;
    } else if (body?.gte_id) {
      table = "qa_gtes"; rowId = Number(body.gte_id);
      const { data } = await sb.from("qa_gtes").select("nome_arma").eq("id", rowId).maybeSingle();
      nomeArma = data?.nome_arma || null;
    }
    if (!nomeArma || !nomeArma.trim()) {
      return new Response(JSON.stringify({ error: "nome_arma vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) IA extrai marca/modelo/calibre/tipo
    const parsed = await parseArma(nomeArma);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "IA não conseguiu identificar a arma" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Procura no catálogo
    let catalog = await findCatalog(sb, parsed.marca, parsed.modelo, parsed.calibre);

    // 3) Se não existe, cria via qa-armamento-gerar-ia (ficha técnica completa)
    if (!catalog) {
      const genResp = await fetch(`${SUPABASE_URL}/functions/v1/qa-armamento-gerar-ia`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          marca: parsed.marca,
          modelo: parsed.modelo,
          calibre: parsed.calibre,
          tipo: parsed.tipo,
        }),
      });
      const genJson = await genResp.json().catch(() => null);
      const tech = genJson?.data;
      if (!tech) {
        return new Response(JSON.stringify({ error: "Falha ao gerar ficha técnica via IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const insertPayload: any = {
        ...tech,
        fonte_dados: "ia_gerado",
        status_revisao: "pendente_revisao",
        search_tokens: `${tech.marca} ${tech.modelo} ${tech.apelido || ""} ${tech.calibre}`.toUpperCase(),
      };
      const { data: created, error: insErr } = await sb
        .from("qa_armamentos_catalogo")
        .insert(insertPayload)
        .select("*")
        .single();
      if (insErr || !created) {
        return new Response(JSON.stringify({ error: insErr?.message || "Falha ao inserir no catálogo" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      catalog = created;
    }

    // 4) Garante foto real (com fundo removido)
    if (!catalog.imagem || !catalog.tem_fundo_transparente) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/qa-armamento-buscar-foto-real`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: catalog.id }),
        });
        // recarrega
        const { data: refreshed } = await sb
          .from("qa_armamentos_catalogo").select("*").eq("id", catalog.id).maybeSingle();
        if (refreshed) catalog = refreshed;
      } catch (e) {
        console.warn("[foto] falhou, segue mesmo assim", e);
      }
    }

    // 5) Vincula no CRAF/GTE
    if (table && rowId) {
      await sb.from(table).update({ catalogo_id: catalog.id }).eq("id", rowId);
    }

    return new Response(JSON.stringify({ ok: true, catalog, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[qa-resolver-arma-craf]", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});