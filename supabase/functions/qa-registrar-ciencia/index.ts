/**
 * qa-registrar-ciencia — grava, de forma permanente e auditável, que o cliente
 * leu e entendeu um termo (hoje: a explicação do boletim de ocorrência).
 *
 * Guarda o texto INTEGRAL que estava na tela, o hash SHA-256 desse texto e o
 * carimbo da conexão (IP, user-agent, idioma, referer, data/hora BRT). É o que
 * a auditoria precisa para provar o que o cliente viu no momento do aceite.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      cliente_id, processo_id, cadastro_publico_id,
      termo_codigo, termo_versao, termo_titulo, termo_texto,
      origem, metadados,
    } = body ?? {};

    if (!termo_codigo || !termo_versao || !termo_texto || String(termo_texto).trim().length < 50) {
      return json({ error: "Termo inválido." }, 400);
    }
    if (!cliente_id && !cadastro_publico_id) {
      return json({ error: "Informe o cliente." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
      || req.headers.get("cf-connecting-ip") || null;

    const registro = {
      cliente_id: cliente_id ?? null,
      cadastro_publico_id: cadastro_publico_id ?? null,
      processo_id: processo_id ?? null,
      termo_codigo: String(termo_codigo),
      termo_versao: String(termo_versao),
      termo_titulo: String(termo_titulo ?? termo_codigo),
      termo_texto: String(termo_texto),
      termo_hash: await sha256Hex(String(termo_texto)),
      aceito_em: new Date().toISOString(),
      ip,
      user_agent: req.headers.get("user-agent"),
      accept_language: req.headers.get("accept-language"),
      referer: req.headers.get("referer"),
      origem: String(origem ?? "portal_cliente"),
      metadados: metadados && typeof metadados === "object" ? metadados : {},
    };

    const { data, error } = await supabase
      .from("qa_cliente_ciencias")
      .insert(registro)
      .select("id, aceito_em, termo_hash")
      .single();

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, ciencia: data });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});