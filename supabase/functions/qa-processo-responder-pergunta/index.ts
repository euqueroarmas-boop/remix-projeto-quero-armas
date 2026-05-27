// qa-processo-responder-pergunta
// Camada ADITIVA — grava a resposta de uma "pergunta" do assistente guiado
// (ex.: "O comprovante de residência está no seu nome?") usando service_role,
// porque a RLS de qa_processos só permite UPDATE por staff.
//
// Não modifica nem substitui qa-processo-doc-upload / qa-processo-doc-validar-ia
// / qa-processo-set-condicao / qa-processo-notificar.
//
// Segurança:
//   - Exige JWT do cliente.
//   - Confere que o processo pertence ao cliente atual (qa_current_cliente_id).
//   - Staff também pode usar (ex.: equipe ajudando o cliente).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length).trim();

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Valida JWT
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const processo_id = String(body?.processo_id || "");
    const documento_id = String(body?.documento_id || "");
    const chave = String(body?.chave || "");
    const valor = String(body?.valor || "");
    if (!processo_id || !documento_id || !chave || !valor) {
      return json({ error: "missing_fields" }, 400);
    }

    const admin = createClient(url, service);

    // Resolve cliente_id do usuário e flag staff (best-effort).
    const [clienteRes, staffRes] = await Promise.all([
      admin.rpc("qa_current_cliente_id", { _uid: userId } as any),
      admin.rpc("qa_is_active_staff", { _uid: userId } as any),
    ]);
    const clienteIdUsuario = (clienteRes.data as number | null) ?? null;
    const isStaff = staffRes.data === true;

    // Carrega processo + documento
    const { data: proc, error: procErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id, respostas_questionario_json")
      .eq("id", processo_id)
      .maybeSingle();
    if (procErr) return json({ error: procErr.message }, 500);
    if (!proc) return json({ error: "processo_not_found" }, 404);

    if (!isStaff && proc.cliente_id !== clienteIdUsuario) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: doc, error: docErr } = await admin
      .from("qa_processo_documentos")
      .select("id, processo_id, tipo_documento, status")
      .eq("id", documento_id)
      .maybeSingle();
    if (docErr) return json({ error: docErr.message }, 500);
    if (!doc || doc.processo_id !== processo_id) {
      return json({ error: "documento_not_found" }, 404);
    }

    // 1) Grava a resposta no questionário (trigger SQL exige chave antes do doc).
    const respostas =
      (proc.respostas_questionario_json as Record<string, string> | null) ?? {};
    const novas = { ...respostas, [chave]: valor };
    const { error: upProcErr } = await admin
      .from("qa_processos")
      .update({ respostas_questionario_json: novas })
      .eq("id", processo_id);
    if (upProcErr) return json({ error: upProcErr.message }, 500);

    // 2) Marca a pergunta como respondida (dispensado_grupo).
    const { error: upDocErr } = await admin
      .from("qa_processo_documentos")
      .update({
        status: "dispensado_grupo",
        observacoes: `Resposta do cliente: ${valor.toUpperCase()} em ${new Date().toISOString()}`,
      })
      .eq("id", documento_id);
    if (upDocErr) return json({ error: upDocErr.message }, 500);

    // 3) Evento auditável.
    await admin.from("qa_processo_eventos").insert({
      processo_id,
      tipo_evento: "pergunta_respondida",
      descricao: `Cliente respondeu "${chave}": ${valor.toUpperCase()}`,
      ator: isStaff ? "equipe" : "cliente",
      dados_json: {
        documento_id,
        tipo_documento: doc.tipo_documento,
        chave,
        valor,
        via: "qa-processo-responder-pergunta",
      },
    });

    return json({ success: true, processo_id, documento_id, chave, valor });
  } catch (e) {
    console.error("qa-processo-responder-pergunta:", e);
    return json({ error: (e as any)?.message || "internal_error" }, 500);
  }
});