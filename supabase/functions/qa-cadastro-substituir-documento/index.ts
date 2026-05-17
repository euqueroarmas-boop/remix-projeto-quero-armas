import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  documento_anterior_id: z.string().uuid(),
  storage_path: z.string().min(3).max(500),
  arquivo_nome: z.string().min(1).max(255),
  arquivo_mime: z.string().min(3).max(120),
  data_validade: z.string().optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let payload: unknown;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Resolve qa_cliente_id do usuário autenticado via função SECURITY DEFINER já existente.
  const { data: clienteId } = await admin.rpc("qa_current_cliente_id", { _uid: userId } as never);
  const myClienteId: number | null = (typeof clienteId === "number" ? clienteId : null);
  if (myClienteId == null) return json({ error: "cliente_nao_encontrado" }, 403);

  // Busca doc anterior — confere posse e estado.
  const { data: anterior, error: antErr } = await admin
    .from("qa_documentos_cliente")
    .select("id, qa_cliente_id, tipo_documento, versao, substituido_em, status")
    .eq("id", input.documento_anterior_id)
    .maybeSingle();
  if (antErr) return json({ error: "db_error", details: antErr.message }, 500);
  if (!anterior) return json({ error: "documento_nao_encontrado" }, 404);
  if (anterior.qa_cliente_id !== myClienteId) return json({ error: "forbidden" }, 403);
  if (anterior.substituido_em) return json({ error: "ja_substituido" }, 409);

  // Insere novo doc — preserva tipo, incrementa versao, mantém origem=cliente/pendente_aprovacao.
  const novaVersao = (anterior.versao ?? 1) + 1;
  const { data: novo, error: insErr } = await admin
    .from("qa_documentos_cliente")
    .insert({
      qa_cliente_id: myClienteId,
      tipo_documento: anterior.tipo_documento,
      arquivo_storage_path: input.storage_path,
      arquivo_nome: input.arquivo_nome,
      arquivo_mime: input.arquivo_mime,
      data_validade: input.data_validade || null,
      status: "pendente_aprovacao",
      origem: "cliente",
      validado_admin: false,
      substitui_documento_id: anterior.id,
      versao: novaVersao,
    } as never)
    .select("id, versao")
    .single();
  if (insErr || !novo) return json({ error: "insert_failed", details: insErr?.message }, 500);

  // Marca anterior como substituído — NÃO altera status.
  const { error: updErr } = await admin
    .from("qa_documentos_cliente")
    .update({
      substituido_em: new Date().toISOString(),
      substituido_por_documento_id: novo.id,
    } as never)
    .eq("id", anterior.id);
  if (updErr) {
    // Rollback do novo para não deixar inconsistente.
    await admin.from("qa_documentos_cliente").delete().eq("id", novo.id);
    return json({ error: "update_failed", details: updErr.message }, 500);
  }

  // Auditoria (best-effort).
  await admin.from("qa_status_eventos").insert({
    cliente_id: myClienteId,
    documento_id: novo.id,
    origem: "cadastro_mira",
    entidade: "qa_documentos_cliente",
    entidade_id: novo.id,
    campo_status: "substituicao",
    status_anterior: "ativo",
    status_novo: "substituido",
    usuario_id: userId,
    detalhes: {
      documento_anterior_id: anterior.id,
      documento_novo_id: novo.id,
      tipo_documento: anterior.tipo_documento,
      versao: novaVersao,
    },
  } as never);
  await admin.from("qa_logs_auditoria").insert({
    usuario_id: userId,
    entidade: "qa_documentos_cliente",
    entidade_id: novo.id,
    acao: "substituir_documento_cliente",
    detalhes_json: {
      documento_anterior_id: anterior.id,
      documento_novo_id: novo.id,
      tipo_documento: anterior.tipo_documento,
      versao: novaVersao,
      cliente_id: myClienteId,
      origem: "cadastro_mira",
    },
  } as never);

  return json({ ok: true, documento_id: novo.id, versao: novaVersao });
});
