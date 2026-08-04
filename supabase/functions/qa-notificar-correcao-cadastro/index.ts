import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional } from "../_shared/sendTransactional.ts";

interface CampoCorrigido {
  campo: string;
  era: string;
  agora: string;
}

interface Payload {
  clienteId: number;
  campos: CampoCorrigido[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Payload = await req.json();
    const { clienteId, campos } = body;

    if (!clienteId || !Array.isArray(campos) || campos.length === 0) {
      return Response.json({ error: "clienteId e campos são obrigatórios" }, { status: 400 });
    }

    const { data: cliente, error: cErr } = await admin
      .from("qa_clientes")
      .select("nome_completo, email")
      .eq("id", clienteId)
      .maybeSingle();

    if (cErr || !cliente?.email) {
      return Response.json({ error: "Cliente não encontrado ou sem e-mail" }, { status: 404 });
    }

    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const primeiroNome = (cliente.nome_completo ?? "").split(" ")[0] || "cliente";

    const result = await sendTransactional({
      templateName: "correcao-cadastro-admin",
      recipientEmail: cliente.email,
      idempotencyKey: `correcao-${clienteId}-${Date.now()}`,
      templateData: {
        nome: primeiroNome,
        campos,
        corrigidoEm: agora,
      },
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ ok: true, queued: result.queued });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
