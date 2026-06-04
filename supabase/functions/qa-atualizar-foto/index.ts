import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const action = body.action;
    const cpfDigits = (body.cpf || "").replace(/\D/g, "");
    if (cpfDigits.length !== 11) return json({ error: "CPF inválido" }, 400);

    // ── Lookup ──
    if (action === "lookup") {
      // 1) cadastro público mais recente
      const { data: cad } = await supabase
        .from("qa_cadastro_publico")
        .select("id, nome_completo, status, created_at, selfie_path, cliente_id_vinculado")
        .eq("cpf", cpfDigits)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2) cliente legado
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id, nome_completo, imagem")
        .eq("cpf", cpfDigits)
        .eq("excluido", false)
        .maybeSingle();

      if (!cad && !cli) return json({ found: false });

      return json({
        found: true,
        cadastro: cad || null,
        cliente: cli || null,
      });
    }

    // ── Update ──
    if (action === "update") {
      const selfie_path = String(body.selfie_path || "");
      if (!selfie_path) return json({ error: "selfie_path obrigatório" }, 400);

      const ip = req.headers.get("x-forwarded-for") || "unknown";
      const ua = req.headers.get("user-agent") || "unknown";
      const now = new Date().toISOString();

      const { data: cad } = await supabase
        .from("qa_cadastro_publico")
        .select("id, cliente_id_vinculado")
        .eq("cpf", cpfDigits)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let cadastroAtualizado = false;
      let clienteAtualizado = false;

      if (cad?.id) {
        const { error: e1 } = await supabase
          .from("qa_cadastro_publico")
          .update({
            selfie_path,
            updated_at: now,
            notas_processamento: `[${now}] Foto atualizada pelo titular via fluxo rápido (IP ${ip.substring(0, 45)})`,
          })
          .eq("id", cad.id);
        if (!e1) cadastroAtualizado = true;
      }

      // Atualizar também o cliente legado (campo imagem)
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id")
        .eq("cpf", cpfDigits)
        .eq("excluido", false)
        .maybeSingle();

      if (cli?.id) {
        // Copiar a selfie do bucket qa-cadastro-selfies para qa-documentos
        // (a UI do admin lê fotos do cliente em qa-documentos)
        let imagemPath = selfie_path;
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from("qa-cadastro-selfies")
            .download(selfie_path);
          if (!dlErr && blob) {
            const destPath = `clientes/${cli.id}/foto-${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("qa-documentos")
              .upload(destPath, blob, { contentType: "image/jpeg", upsert: true });
            if (!upErr) imagemPath = destPath;
            else console.error("[qa-atualizar-foto] copy upload err", upErr);
          } else if (dlErr) {
            console.error("[qa-atualizar-foto] copy download err", dlErr);
          }
        } catch (copyErr) {
          console.error("[qa-atualizar-foto] copy exception", copyErr);
        }

        const { error: e2 } = await supabase
          .from("qa_clientes")
          .update({ imagem: imagemPath, updated_at: now })
          .eq("id", cli.id);
        if (!e2) clienteAtualizado = true;
      }

      await supabase.from("integration_logs").insert({
        integration_name: "qa_atualizar_foto",
        operation_name: "update",
        request_payload: {
          cpf: cpfDigits.slice(0, 3) + "***",
          cadastro_id: cad?.id || null,
          cliente_id: cli?.id || null,
          ip: ip.substring(0, 45),
          ua: ua.substring(0, 200),
        },
        status: "success",
      });

      if (!cadastroAtualizado && !clienteAtualizado) {
        return json({ error: "Nenhum registro encontrado para este CPF" }, 404);
      }

      return json({ success: true, cadastroAtualizado, clienteAtualizado });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    console.error("[qa-atualizar-foto]", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
