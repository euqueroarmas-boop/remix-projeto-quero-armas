import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTAL_BASE = "https://www.euqueroarmas.com.br/area-do-cliente";
const BRAND = "QUERO ARMAS";

type Evento =
  | "processo_criado"
  | "documento_pendente"
  | "documento_em_validacao"
  | "documento_divergente"
  | "documento_invalido"
  | "documento_aprovado"
  | "revisao_humana"
  | "documentacao_aprovada"
  | "processo_concluido"
  | "processo_bloqueado";

interface Body {
  processo_id: string;
  evento: Evento;
  documento_id?: string;
  motivo?: string;
  trace_id?: string;
}

const TITULOS: Record<Evento, string> = {
  processo_criado: "📂 Novo processo aberto",
  documento_pendente: "📎 Envie seus documentos",
  documento_em_validacao: "🔎 Validando seu documento",
  documento_divergente: "⚠️ Divergência detectada em documento",
  documento_invalido: "❌ Documento rejeitado",
  documento_aprovado: "✅ Documento aprovado",
  revisao_humana: "👤 Documento em revisão humana",
  documentacao_aprovada: "🎯 Documentação aprovada",
  processo_concluido: "🏁 Processo concluído",
  processo_bloqueado: "🚫 Processo bloqueado",
};

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function corpoEvento(evento: Evento, ctx: { servico: string; documento?: string; motivo?: string }) {
  switch (evento) {
    case "processo_criado":
      return `Seu processo de <strong>${escapeHtml(ctx.servico)}</strong> foi aberto. Em seguida, listaremos os documentos necessários para análise.`;
    case "documento_pendente":
      return `Há documentos pendentes em seu processo de <strong>${escapeHtml(ctx.servico)}</strong>. Acesse o portal para enviá-los.`;
    case "documento_em_validacao":
      return `Recebemos o documento <strong>${escapeHtml(ctx.documento ?? "")}</strong> e iniciamos a validação automática. Em alguns instantes você terá o resultado.`;
    case "documento_divergente":
      return `Detectamos divergência entre as informações do documento <strong>${escapeHtml(ctx.documento ?? "")}</strong> e seu cadastro.${ctx.motivo ? ` Motivo: <em>${escapeHtml(ctx.motivo)}</em>.` : ""} Verifique seus dados de cadastro ou reenvie o documento correto.`;
    case "documento_invalido":
      return `O documento <strong>${escapeHtml(ctx.documento ?? "")}</strong> foi considerado inválido.${ctx.motivo ? ` Motivo: <em>${escapeHtml(ctx.motivo)}</em>.` : ""} Por favor, reenvie um documento legível e válido.`;
    case "documento_aprovado":
      return `O documento <strong>${escapeHtml(ctx.documento ?? "")}</strong> foi aprovado. Continue acompanhando o restante do checklist.`;
    case "revisao_humana":
      return `O documento <strong>${escapeHtml(ctx.documento ?? "")}</strong> está em revisão humana. Avisaremos assim que for concluída.`;
    case "documentacao_aprovada":
      return `Toda a documentação do processo <strong>${escapeHtml(ctx.servico)}</strong> foi aprovada. Vamos dar seguimento à próxima etapa.`;
    case "processo_concluido":
      return `Seu processo de <strong>${escapeHtml(ctx.servico)}</strong> foi concluído com sucesso. Obrigado pela confiança!`;
    case "processo_bloqueado":
      return `Seu processo de <strong>${escapeHtml(ctx.servico)}</strong> foi temporariamente bloqueado.${ctx.motivo ? ` Motivo: <em>${escapeHtml(ctx.motivo)}</em>.` : ""} Nossa equipe entrará em contato.`;
  }
}

function buildHtml(opts: { titulo: string; nomeCliente: string; servico: string; corpo: string; portalUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
        <tr><td style="background:#0f172a;padding:22px 28px;">
          <div style="font-size:11px;letter-spacing:0.18em;color:#94a3b8;font-weight:700;text-transform:uppercase;">${BRAND}</div>
          <div style="font-size:20px;color:#ffffff;font-weight:700;margin-top:6px;">${escapeHtml(opts.titulo)}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="font-size:15px;margin:0 0 12px;">Olá, <strong>${escapeHtml(opts.nomeCliente)}</strong>.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1f2937;">${opts.corpo}</p>
          <div style="background:#f1f5f9;border-radius:10px;padding:14px 16px;margin:20px 0;">
            <div style="font-size:10px;letter-spacing:0.14em;font-weight:700;color:#64748b;text-transform:uppercase;">Serviço</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:4px;text-transform:uppercase;">${escapeHtml(opts.servico)}</div>
          </div>
          <p style="text-align:center;margin:28px 0;">
            <a href="${opts.portalUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:10px;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">Acompanhar processo</a>
          </p>
          <p style="font-size:12px;color:#64748b;margin:24px 0 0;line-height:1.5;">Este é um e-mail automático. Se precisar de ajuda, responda este e-mail.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${BRAND}. Todos os direitos reservados.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildText(opts: { titulo: string; nomeCliente: string; servico: string; corpo: string; portalUrl: string }) {
  const stripped = opts.corpo.replace(/<[^>]+>/g, "");
  return `${opts.titulo}\n\nOlá, ${opts.nomeCliente}.\n\n${stripped}\n\nServiço: ${opts.servico}\n\nAcompanhe em: ${opts.portalUrl}\n\n— ${BRAND}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = `qa-proc-notif-${crypto.randomUUID()}`;
  try {
    const body = (await req.json()) as Body;
    if (!body?.processo_id || !body?.evento) {
      return new Response(JSON.stringify({ error: "processo_id e evento são obrigatórios", traceId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carrega processo + cliente
    const { data: proc, error: pErr } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, servico_nome, status")
      .eq("id", body.processo_id)
      .maybeSingle();
    if (pErr || !proc) throw new Error(pErr?.message ?? "Processo não encontrado");

    const { data: cli } = await supabase
      .from("qa_clientes")
      .select("nome_completo, email")
      .eq("id", proc.cliente_id)
      .maybeSingle();
    if (!cli?.email) {
      console.warn(`[qa-processo-notificar][${traceId}] cliente sem email`, { cliente_id: proc.cliente_id });
      return new Response(JSON.stringify({ skipped: true, reason: "no_email", traceId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nomeDoc: string | undefined;
    if (body.documento_id) {
      const { data: doc } = await supabase
        .from("qa_processo_documentos")
        .select("nome_documento, motivo_rejeicao")
        .eq("id", body.documento_id)
        .maybeSingle();
      nomeDoc = doc?.nome_documento ?? undefined;
      if (!body.motivo && doc?.motivo_rejeicao) body.motivo = doc.motivo_rejeicao;
    }

    const titulo = TITULOS[body.evento];
    if (!titulo) {
      return new Response(JSON.stringify({ error: `Evento inválido: ${body.evento}`, traceId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const corpo = corpoEvento(body.evento, { servico: proc.servico_nome, documento: nomeDoc, motivo: body.motivo });
    const portalUrl = `${PORTAL_BASE}?processo=${proc.id}`;
    const html = buildHtml({ titulo, nomeCliente: cli.nome_completo ?? "cliente", servico: proc.servico_nome, corpo, portalUrl });
    const text = buildText({ titulo, nomeCliente: cli.nome_completo ?? "cliente", servico: proc.servico_nome, corpo, portalUrl });

    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      headers: { "x-internal-token": internalToken },
      body: { to: cli.email, subject: `${titulo} — ${BRAND}`, html, text, trace_id: traceId },
    });

    const ok = !smtpRes.error && (smtpRes.data as any)?.success;
    if (!ok) {
      await logSistemaBackend({ tipo: "email", status: "error", mensagem: `Falha notificação ${body.evento}: ${cli.email}`, payload: { trace_id: traceId, processo_id: proc.id, error: smtpRes.error || smtpRes.data } });
    } else {
      await logSistemaBackend({ tipo: "email", status: "success", mensagem: `Notificação ${body.evento} enviada: ${cli.email}`, payload: { trace_id: traceId, processo_id: proc.id, evento: body.evento } });
    }

    // Registra evento no histórico do processo
    await supabase.from("qa_processo_eventos").insert({
      processo_id: proc.id,
      documento_id: body.documento_id ?? null,
      tipo_evento: `email_${body.evento}`,
      descricao: `${titulo} — ${cli.email}${ok ? "" : " (FALHA)"}`,
      ator: "sistema",
      dados_json: { trace_id: traceId, evento: body.evento, motivo: body.motivo ?? null },
    });

    return new Response(JSON.stringify({ success: ok, traceId }), {
      status: ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[qa-processo-notificar][${traceId}] error`, msg);
    return new Response(JSON.stringify({ error: msg, traceId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});