// qa-processo-doc-upload
// Registra metadados de um documento enviado pelo cliente/staff:
// - Recebe processo_id, documento_id (item do checklist) e storage_path
// - Atualiza status para "em_analise" e dispara validação IA via qa-processo-doc-validar-ia
// - O upload do arquivo é feito direto pelo cliente no bucket privado qa-processo-docs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const supabase = createClient(url, service);

    const body = await req.json();
    const {
      processo_id,
      documento_id, // id do qa_processo_documentos (item do checklist)
      storage_path,
      mime_type,
      tamanho_bytes,
      nome_arquivo_original,
      skip_ia, // se true, não dispara validação IA
    } = body || {};

    if (!processo_id || !documento_id || !storage_path) {
      return json({ error: "processo_id, documento_id e storage_path são obrigatórios" }, 400);
    }

    // Verifica permissão: ou staff QA ou cliente dono do processo
    const { data: staffRow } = await supabase
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    const { data: processo } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, status")
      .eq("id", processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    if (!staffRow) {
      const { data: link } = await supabase
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", userId)
        .eq("qa_cliente_id", processo.cliente_id)
        .maybeSingle();
      if (!link) return json({ error: "Sem permissão para este processo" }, 403);
    }

    // Verifica que o arquivo existe no storage
    const { data: signed } = await supabase.storage
      .from("qa-processo-docs")
      .createSignedUrl(storage_path, 30);
    if (!signed?.signedUrl) {
      return json({ error: "Arquivo não encontrado no storage" }, 400);
    }

    // Atualiza item do checklist
    const { data: docRow, error: upErr } = await supabase
      .from("qa_processo_documentos")
      .update({
        storage_path,
        mime_type: mime_type || null,
        tamanho_bytes: tamanho_bytes || null,
        nome_arquivo_original: nome_arquivo_original || null,
        status: "em_analise",
        enviado_por: userId,
        enviado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("id", documento_id)
      .eq("processo_id", processo_id)
      .select()
      .single();

    if (upErr) return json({ error: upErr.message }, 400);

    // Dispara validação IA em background
    let iaTriggered = false;
    if (!skip_ia) {
      try {
        // @ts-ignore EdgeRuntime
        (globalThis as any).EdgeRuntime?.waitUntil(
          fetch(`${url}/functions/v1/qa-processo-doc-validar-ia`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${service}`,
              "x-internal-call": "1",
            },
            body: JSON.stringify({
              processo_id,
              documento_id,
              storage_path,
            }),
          }).then(r => r.text()).catch(e => console.error("IA dispatch err:", e))
        );
        iaTriggered = true;
      } catch (e) {
        console.error("Falha ao agendar IA:", e);
      }
    }

    return json({ success: true, documento: docRow, ia_em_analise: iaTriggered });
  } catch (err: any) {
    console.error("qa-processo-doc-upload:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});