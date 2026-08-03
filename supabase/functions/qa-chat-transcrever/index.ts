// ─────────────────────────────────────────────────────────────
// qa-chat-transcrever
//   POST multipart/form-data { file }  →  { text }
//   Transcreve a gravação de voz do chat do Klal via Lovable AI.
// ─────────────────────────────────────────────────────────────
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

const MAX_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "arquivo de áudio ausente" }, 400);
    if (file.size < 2048) return json({ error: "Gravação muito curta. Tente novamente." }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Gravação muito longa." }, 413);

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", file, "gravacao.wav");
    upstream.append("stream", "true");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: upstream,
    });
    if (!r.ok || !r.body) {
      const body = await r.text().catch(() => "");
      console.error("[qa-chat-transcrever] gateway:", r.status, body);
      return json({ error: "Falha ao transcrever o áudio.", status: r.status, details: body }, r.status);
    }

    // Consome o SSE no servidor e devolve o texto final.
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "transcript.text.delta" && evt.delta) texto += evt.delta;
          else if (evt.type === "transcript.text.done" && evt.text) texto = evt.text;
        } catch { /* chunk parcial */ }
      }
    }

    return json({ text: texto.trim() });
  } catch (e: any) {
    console.error("qa-chat-transcrever error:", e);
    return json({ error: e?.message ?? "erro" }, 500);
  }
});