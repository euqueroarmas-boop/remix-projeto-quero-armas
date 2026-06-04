// Gera avatar tático preservando o rosto do cliente usando Lovable AI (Nano Banana edit).
// Recebe { cpf } do usuário autenticado, busca a selfie no bucket privado, edita,
// salva no mesmo bucket e atualiza qa_clientes.avatar_tatico_path.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente.");

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const cpf = onlyDigits(body?.cpf || "");
    if (!cpf || cpf.length < 11) {
      return new Response(JSON.stringify({ error: "cpf inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Localiza cliente e selfie
    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("id, cpf, nome_completo, avatar_tatico_path")
      .eq("cpf", cpf)
      .maybeSingle();

    const { data: cad } = await admin
      .from("qa_cadastro_publico")
      .select("selfie_path")
      .eq("cpf", cpf)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const selfiePath = cad?.selfie_path;
    if (!selfiePath) {
      return new Response(JSON.stringify({ error: "Sem selfie cadastrada. Envie uma foto antes." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Baixa a selfie e converte para data URL
    const { data: blob, error: dlErr } = await admin.storage
      .from("qa-cadastro-selfies").download(selfiePath);
    if (dlErr || !blob) throw new Error(dlErr?.message || "Falha ao baixar selfie");
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = blob.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${b64}`;

    // 3) Edita com Gemini Nano Banana mantendo identidade
    const prompt = [
      "Reimagine este retrato como um avatar tático profissional premium, mantendo EXATAMENTE",
      "o mesmo rosto, traços, etnia, gênero, idade aparente, formato de cabeça, cabelo e barba.",
      "Não altere a fisionomia. Apenas:",
      "- estilize a iluminação como cinematográfica suave (key light dourada/âmbar levemente lateral)",
      "- vista a pessoa com uma camiseta tática preta ou polo tactical preta",
      "- fundo simples em gradiente preto carvão para grafite",
      "- pequena vinheta sutil",
      "- retrato enquadrado dos ombros para cima, centralizado",
      "Resultado: foto realista (não cartoon, não anime), nítida, profissional, formato 1:1.",
    ].join(" ");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione saldo na workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI gateway error ${aiResp.status}: ${t.slice(0, 200)}`);
    }

    const aiJson = await aiResp.json();
    const outUrl: string | undefined =
      aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!outUrl?.startsWith("data:image")) {
      throw new Error("IA não retornou imagem.");
    }

    // 4) Decodifica e sobe ao bucket
    const [, payload] = outUrl.split(",", 2);
    const outBytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const outPath = `cadastro-publico/${cpf}-avatar-${Date.now()}.png`;
    const { error: upErr } = await admin.storage
      .from("qa-cadastro-selfies")
      .upload(outPath, outBytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    if (cliente?.id) {
      await admin.from("qa_clientes").update({
        avatar_tatico_path: outPath,
        avatar_tatico_gerado_em: new Date().toISOString(),
      }).eq("id", cliente.id);
    }

    return new Response(JSON.stringify({ ok: true, avatar_path: outPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[qa-gerar-avatar-tatico]", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
