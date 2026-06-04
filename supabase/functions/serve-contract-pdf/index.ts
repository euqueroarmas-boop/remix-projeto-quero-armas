/**
 * serve-contract-pdf: Proxy that streams contract PDFs from storage
 * without exposing Supabase URLs to the client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "paid-contracts";

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { quote_id, contract_id } = body;

    if (!quote_id && !contract_id) {
      return new Response(JSON.stringify({ error: "quote_id ou contract_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();

    // Find the contract
    let query = supabase.from("contracts").select("id, contract_pdf_path, contract_type, customer_id");
    if (contract_id) {
      query = query.eq("id", contract_id);
    } else {
      query = query.eq("quote_id", quote_id).order("created_at", { ascending: false }).limit(1);
    }

    const { data: contract, error: contractErr } = await query.single();

    if (contractErr || !contract) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contract.contract_pdf_path) {
      return new Response(JSON.stringify({ error: "PDF ainda não foi gerado para este contrato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET)
      .download(contract.contract_pdf_path);

    if (downloadErr || !fileData) {
      console.error("[serve-contract-pdf] Download error:", downloadErr);
      return new Response(JSON.stringify({ error: "Arquivo PDF não encontrado no storage" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await fileData.arrayBuffer();
    const fileName = `contrato-wmti-${contract.id.slice(0, 8).toUpperCase()}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": pdfBytes.byteLength.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[serve-contract-pdf] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
