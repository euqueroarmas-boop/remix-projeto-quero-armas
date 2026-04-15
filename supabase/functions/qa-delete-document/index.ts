import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { doc_id } = await req.json();
    if (!doc_id) {
      return new Response(JSON.stringify({ error: "doc_id required" }), {
        status: 400, headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get chunk IDs for this document
    const { data: chunks } = await supabase
      .from("qa_chunks_conhecimento")
      .select("id")
      .eq("documento_id", doc_id);

    // Delete embeddings for those chunks
    if (chunks && chunks.length > 0) {
      const chunkIds = chunks.map((c: any) => c.id);
      await supabase.from("qa_embeddings").delete().in("chunk_id", chunkIds);
    }

    // Delete chunks
    await supabase.from("qa_chunks_conhecimento").delete().eq("documento_id", doc_id);

    // Delete preferential references
    await supabase.from("qa_referencias_preferenciais").delete().eq("origem_id", doc_id);

    // Delete audit logs related to this document
    await supabase.from("qa_logs_auditoria").delete().eq("entidade_id", doc_id);

    // Delete the document itself
    const { error: docErr } = await supabase
      .from("qa_documentos_conhecimento")
      .delete()
      .eq("id", doc_id);

    if (docErr) throw new Error(docErr.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("qa-delete-document error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
