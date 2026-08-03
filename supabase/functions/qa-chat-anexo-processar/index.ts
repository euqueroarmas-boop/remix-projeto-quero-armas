// ─────────────────────────────────────────────────────────────
// qa-chat-anexo-processar
//   POST { storage_path, nome_arquivo, mime_type, tamanho_bytes, sessao_id? }
//   - Registra o anexo em qa_chat_anexos (auditoria total)
//   - Extrai texto (texto puro nativo, imagens/PDF via Gemini Vision)
//   - Retorna { id, texto_extraido, metodo_extracao }
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const {
      storage_path,
      nome_arquivo,
      mime_type,
      tamanho_bytes,
      sessao_id = null,
    } = await req.json();

    if (!storage_path || !nome_arquivo) {
      return json({ error: "storage_path e nome_arquivo obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Usuário autenticado
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    let usuarioId: string | null = null;
    let clienteId: number | null = null;
    if (jwt) {
      const { data: u } = await supabase.auth.getUser(jwt);
      usuarioId = u?.user?.id ?? null;
      if (usuarioId) {
        const { data: cli } = await supabase
          .from("qa_clientes")
          .select("id")
          .eq("auth_user_id", usuarioId)
          .maybeSingle();
        clienteId = (cli as any)?.id ?? null;
      }
    }
    if (!usuarioId) return json({ error: "não autenticado" }, 401);

    // Download do arquivo
    const { data: blob, error: dlErr } = await supabase.storage
      .from("qa-chat-anexos")
      .download(storage_path);
    if (dlErr || !blob) return json({ error: dlErr?.message || "arquivo não encontrado" }, 404);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await sha256Hex(bytes);
    const mime = (mime_type || blob.type || "application/octet-stream").toLowerCase();

    // Registro de auditoria (sempre, mesmo se a extração falhar)
    const { data: row, error: insErr } = await supabase
      .from("qa_chat_anexos")
      .insert({
        sessao_id,
        cliente_id: clienteId,
        usuario_id: usuarioId,
        nome_arquivo,
        mime_type: mime,
        tamanho_bytes: tamanho_bytes ?? bytes.length,
        storage_path,
        hash_sha256: hash,
        origem: "chat_cliente",
        status_processamento: "processando",
      })
      .select("id")
      .single();
    if (insErr || !row) return json({ error: insErr?.message || "falha ao registrar anexo" }, 500);
    const anexoId = row.id as string;

    let texto = "";
    let metodo = "nenhum";
    let erro: string | null = null;

    try {
      if (mime.startsWith("text/") || mime.includes("json") || mime.includes("csv")) {
        texto = new TextDecoder().decode(bytes).slice(0, 60000);
        metodo = "texto_nativo";
      } else if (mime.startsWith("image/") || mime === "application/pdf") {
        const KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!KEY) throw new Error("LOVABLE_API_KEY ausente");
        const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Você extrai o conteúdo textual de documentos e imagens. Transcreva fielmente todo o texto visível, preservando nomes, datas, números e órgãos emissores. Se for uma foto sem texto, descreva objetivamente o que aparece. Não interprete nem opine.",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: `Extraia o conteúdo do arquivo "${nome_arquivo}".` },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
          }),
        });
        if (!r.ok) throw new Error(`gateway ${r.status}: ${await r.text()}`);
        const j = await r.json();
        texto = (j?.choices?.[0]?.message?.content || "").toString().slice(0, 60000);
        metodo = "gemini_vision";
      } else {
        erro = "tipo de arquivo não suportado para leitura";
      }
    } catch (e: any) {
      erro = e?.message ?? "falha na extração";
      console.error("[qa-chat-anexo-processar] extração:", erro);
    }

    await supabase
      .from("qa_chat_anexos")
      .update({
        texto_extraido: texto || null,
        metodo_extracao: metodo,
        status_processamento: texto ? "concluido" : "falhou",
        erro_processamento: erro,
      })
      .eq("id", anexoId);

    return json({
      id: anexoId,
      nome_arquivo,
      mime_type: mime,
      texto_extraido: texto || null,
      metodo_extracao: metodo,
      erro,
    });
  } catch (e: any) {
    console.error("qa-chat-anexo-processar error:", e);
    return json({ error: e?.message ?? "erro" }, 500);
  }
});