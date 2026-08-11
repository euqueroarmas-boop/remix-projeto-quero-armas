// qa-email-dlq-reprocessar
// Reenfileira e-mails que ficaram em DLQ (dead letter queue).
// Cada reenvio recebe uma NOVA idempotencyKey — a API recusa a mesma chave
// após uma falha. Pula endereços suprimidos/bounce e itens antigos (janela
// padrão: 7 dias) que já não fazem sentido reenviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrInternal } from "../_shared/internalAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireAdminOrInternal(req);
  if (!guard.ok) return guard.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  const dias = Number.isFinite(Number(body?.dias)) ? Math.max(1, Number(body.dias)) : 7;
  const dryRun = Boolean(body?.dryRun);
  const limite = Math.min(200, Number(body?.limite) || 100);
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: dlqRows, error: dlqError } = await supabase
    .from("email_send_log")
    .select("message_id, template_name, recipient_email, created_at")
    .eq("status", "dlq")
    .order("created_at", { ascending: false })
    .limit(500);

  if (dlqError) return json({ error: dlqError.message }, 500);

  const vistos = new Set<string>();
  const candidatos: any[] = [];
  const descartados: any[] = [];

  for (const r of dlqRows ?? []) {
    const mid = String(r.message_id ?? "");
    if (!mid || vistos.has(mid)) continue;
    vistos.add(mid);
    if (r.created_at < desde) {
      descartados.push({ message_id: mid, motivo: "obsoleto", template: r.template_name });
      continue;
    }
    candidatos.push(r);
  }

  // Não reenviar se o mesmo message_id já foi enviado com sucesso depois.
  const ids = candidatos.map((c) => c.message_id);
  const enviados = new Set<string>();
  if (ids.length) {
    const { data } = await supabase
      .from("email_send_log")
      .select("message_id")
      .in("message_id", ids)
      .eq("status", "sent");
    for (const s of data ?? []) enviados.add(String(s.message_id));
  }

  const emails = Array.from(new Set(candidatos.map((c) => String(c.recipient_email ?? "").toLowerCase())));
  const suprimidos = new Set<string>();
  if (emails.length) {
    const { data } = await supabase
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    for (const s of data ?? []) suprimidos.add(String(s.email).toLowerCase());
  }

  const fila = candidatos
    .filter((c) => {
      const mid = String(c.message_id);
      const to = String(c.recipient_email ?? "").toLowerCase();
      if (enviados.has(mid)) { descartados.push({ message_id: mid, motivo: "ja_enviado" }); return false; }
      if (suprimidos.has(to)) { descartados.push({ message_id: mid, motivo: "suprimido" }); return false; }
      if (!/^\S+@\S+\.\S+$/.test(to)) { descartados.push({ message_id: mid, motivo: "email_invalido" }); return false; }
      return true;
    })
    .slice(0, limite);

  if (dryRun) {
    return json({ ok: true, dryRun: true, reenviaria: fila.length, descartados: descartados.length, janela_dias: dias });
  }

  let reenviados = 0;
  const erros: any[] = [];

  for (const item of fila) {
    const mid = String(item.message_id);
    const { data: conteudo } = await supabase
      .from("email_content_log")
      .select("template_name, recipient_email, template_data")
      .eq("message_id", mid)
      .maybeSingle();

    const templateName = String(conteudo?.template_name || item.template_name || "").trim();
    const recipientEmail = String(conteudo?.recipient_email || item.recipient_email || "").toLowerCase();
    if (!templateName || !recipientEmail) {
      descartados.push({ message_id: mid, motivo: "sem_conteudo" });
      continue;
    }

    const result = await sendTransactional({
      templateName,
      recipientEmail,
      idempotencyKey: `retry-${mid}-${Date.now()}`,
      templateData: (conteudo?.template_data as Record<string, unknown>) ?? {},
    });

    if (result.ok) {
      reenviados++;
      // Marca a falha original como resolvida pelo reenvio, para que ela
      // deixe de contar como "falha pendente" nos painéis.
      if (result.messageId) {
        await supabase
          .from("email_send_log")
          .update({ resolvido_por_message_id: result.messageId })
          .eq("message_id", mid)
          .is("resolvido_por_message_id", null);
      }
    } else {
      erros.push({ message_id: mid, error: result.error });
    }
  }

  return json({
    ok: true,
    janela_dias: dias,
    total_dlq: vistos.size,
    reenviados,
    descartados: descartados.length,
    detalhe_descartados: descartados.slice(0, 50),
    erros,
  });
});
