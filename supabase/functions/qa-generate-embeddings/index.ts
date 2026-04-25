import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEmbeddings(documento_id: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let totalGenerated = 0;
  let pass = 0;
  const MAX_PASSES = 10;

  await supabase
    .from("qa_documentos_conhecimento")
    .update({ status_processamento: "gerando_embeddings", updated_at: new Date().toISOString() })
    .eq("id", documento_id);

  while (pass < MAX_PASSES) {
    pass++;

    const { data: chunks } = await supabase
      .from("qa_chunks_conhecimento")
      .select("id, texto_chunk, embedding_status")
      .eq("documento_id", documento_id)
      .in("embedding_status", ["pendente", "erro"])
      .order("ordem_chunk")
      .limit(50);

    if (!chunks || chunks.length === 0) {
      console.log(`Pass ${pass}: no more chunks to process for ${documento_id}. Total generated: ${totalGenerated}`);
      break;
    }

    console.log(`Pass ${pass}: processing ${chunks.length} chunks for ${documento_id}`);

    for (const chunk of chunks) {
      try {
        const embResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "Generate a vector of exactly 1536 floating point numbers between -1 and 1 that semantically represents the text. Output ONLY the JSON array.",
              },
              { role: "user", content: chunk.texto_chunk.substring(0, 500) },
            ],
            max_tokens: 8000,
          }),
        });

        if (!embResp.ok) {
          const status = embResp.status;
          console.error(`Embedding API error for chunk ${chunk.id}: ${status}`);

          if (status === 402) {
            await supabase.from("qa_chunks_conhecimento")
              .update({ embedding_status: "erro" })
              .eq("id", chunk.id);

            await supabase.from("qa_documentos_conhecimento")
              .update({
                status_processamento: "erro",
                resumo_extraido: "Geração de embeddings indisponível no momento por falta de créditos da IA.",
                updated_at: new Date().toISOString(),
              })
              .eq("id", documento_id);
            return { generated: totalGenerated };
          }

          await supabase.from("qa_chunks_conhecimento")
            .update({ embedding_status: "erro" })
            .eq("id", chunk.id);

          if (status === 429) {
            await new Promise(r => setTimeout(r, 5000));
          }
          continue;
        }

        const embData = await embResp.json();
        const content = embData.choices?.[0]?.message?.content || "";

        let vector: number[] | null = null;
        try {
          const match = content.match(/\[[\s\S]*\]/);
          if (match) vector = JSON.parse(match[0]);
        } catch {
          /* invalid JSON */
        }

        if (vector && Array.isArray(vector) && vector.length > 0) {
          while (vector.length < 1536) vector.push(0);
          if (vector.length > 1536) vector = vector.slice(0, 1536);

          const vectorStr = `[${vector.join(",")}]`;

          await supabase.from("qa_embeddings")
            .delete()
            .eq("chunk_id", chunk.id);

          const { error: embInsertErr } = await supabase
            .from("qa_embeddings")
            .insert({
              chunk_id: chunk.id,
              vetor_embedding: vectorStr,
              modelo_embedding: "gemini-2.5-flash-lite",
            });

          if (!embInsertErr) {
            totalGenerated++;
            await supabase.from("qa_chunks_conhecimento")
              .update({ embedding_status: "concluido" })
              .eq("id", chunk.id);
          } else {
            console.error("Embedding insert error:", embInsertErr.message);
            await supabase.from("qa_chunks_conhecimento")
              .update({ embedding_status: "erro" })
              .eq("id", chunk.id);
          }
        } else {
          await supabase.from("qa_chunks_conhecimento")
            .update({ embedding_status: "erro" })
            .eq("id", chunk.id);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error("Embedding error for chunk", chunk.id, ":", e);
        await supabase.from("qa_chunks_conhecimento")
          .update({ embedding_status: "erro" })
          .eq("id", chunk.id);
      }
    }
  }

  await supabase.from("qa_documentos_conhecimento")
    .update({ status_processamento: "concluido", updated_at: new Date().toISOString() })
    .eq("id", documento_id);

  console.log(`Embeddings complete for ${documento_id}: ${totalGenerated} total`);
  return { generated: totalGenerated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { documento_id } = await req.json();
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id required" }), {
        status: 400,
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    (globalThis as any).EdgeRuntime?.waitUntil(generateEmbeddings(documento_id));

    return new Response(JSON.stringify({ success: true, message: "Embedding generation started" }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});