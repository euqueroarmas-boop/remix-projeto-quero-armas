/**
 * qa-efetiva-destravar-bo — libera o cliente que ficou preso esperando o
 * segundo (ou terceiro) boletim de ocorrência.
 *
 * Regra do usuário (17/08/2026): quando o cliente responde que VAI abrir outro
 * boletim, o passo trava até o documento chegar. Isso é proposital — é o que
 * impede a defesa de ser fechada pela metade. Se ele desistir do outro
 * registro, não se destrava sozinho: ele abre chamado com a equipe, e a equipe
 * libera aqui, com motivo, autor e carimbo de conexão em auditoria.
 *
 * A destrava vale só para a espera atual: se ele disser de novo que vai abrir
 * outro boletim, trava de novo (o portal compara `bo_destravado_em` com
 * `bo_aguardando_desde`).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "missing_token" }, 401);

  let autorId = "";
  let autorEmail: string | null = null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!resp.ok) return json({ error: "unauthenticated" }, 401);
    const u = await resp.json();
    autorId = u?.id || "";
    autorEmail = u?.email ?? null;
  } catch (e) {
    return json({ error: "unauthenticated", message: (e as Error).message }, 401);
  }
  if (!autorId) return json({ error: "unauthenticated" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const registroId = String(body?.registro_id ?? "").trim();
  const motivo = String(body?.motivo ?? "").trim().slice(0, 1000);
  if (!registroId) return json({ error: "registro_id obrigatório" }, 400);
  // Sem motivo não há destrava: o cliente abriu um chamado, e é o chamado que
  // fica registrado aqui.
  if (motivo.length < 5) return json({ error: "informe o motivo (o chamado do cliente)" }, 400);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Só equipe destrava. O cliente não tem como se liberar sozinho.
  const { data: perfis, error: erroPerfil } = await sb
    .from("qa_usuarios_perfis")
    .select("perfil")
    .eq("user_id", autorId)
    .eq("ativo", true)
    .in("perfil", ["administrador", "operador", "advogado"]);
  if (erroPerfil) {
    console.error("[qa-efetiva-destravar-bo] perfil:", erroPerfil.message);
    return json({ error: "Não foi possível conferir a sua permissão." }, 500);
  }
  if ((perfis ?? []).length === 0) return json({ error: "forbidden" }, 403);

  const { data: reg } = await sb
    .from("qa_efetiva_necessidade")
    .select("id, cliente_id, status, bo_quer_outro, bo_aguardando_desde")
    .eq("id", registroId)
    .maybeSingle();
  if (!reg) return json({ error: "Registro não encontrado" }, 404);

  const agora = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ?? null;
  const ua = req.headers.get("user-agent");

  const { error: upErr } = await sb
    .from("qa_efetiva_necessidade")
    .update({
      // A resposta do cliente NÃO é apagada — ela é o histórico do que ele
      // pediu. O que muda é o carimbo da liberação.
      bo_destravado_em: agora,
      bo_destravado_por: autorId,
      bo_destravado_por_nome: autorEmail,
      bo_destrava_motivo: motivo,
      updated_at: agora,
    })
    .eq("id", registroId);
  if (upErr) return json({ error: "Falha ao gravar", details: upErr.message }, 500);

  await sb.from("qa_efetiva_necessidade_auditoria").insert({
    efetiva_id: registroId,
    cliente_id: reg.cliente_id,
    acao: "bo_adicional_destravado",
    status_anterior: reg.status ?? null,
    status_novo: reg.status ?? null,
    autor_tipo: "equipe",
    autor_id: autorId,
    autor_nome: autorEmail,
    observacao: motivo,
    ip,
    user_agent: ua,
  });

  return json({ ok: true, bo_destravado_em: agora });
});
