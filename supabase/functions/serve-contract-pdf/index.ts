/**
 * serve-contract-pdf: Proxy that streams contract PDFs from storage
 * without exposing Supabase URLs to the client.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

const BUCKET = "paid-contracts";

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await userClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
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

    // 🔒 Onda 6: Authorization. Allow if:
    //   (a) caller is admin or internal service, OR
    //   (b) authenticated user owns the contract (customers.user_id == auth.uid())
    const guard = await requireAdminOrInternal(req);
    if (!guard.ok) {
      const authenticatedUserId = await getAuthenticatedUserId(req);
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: customer } = await supabase
        .from("customers")
        .select("user_id")
        .eq("id", contract.customer_id)
        .maybeSingle();
      if (!customer || customer.user_id !== authenticatedUserId) {
        return new Response(JSON.stringify({ error: "Acesso negado a este contrato" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
