// qa-processo-notificar — templates granulares, botões nomeados, sem URL crua.
// Cobra SOMENTE o item afetado (documento_id ou certidão específica).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};
const PORTAL_BASE = "https://www.euqueroarmas.com.br/area-do-cliente";
const BRAND = "QUERO ARMAS";

type Evento =
  | "processo_criado"
  | "pagamento_confirmado"
  | "documento_em_validacao"
  | "documento_faltante"
  | "certidao_faltante"
  | "documento_invalido"
  | "certidao_invalida"
  | "divergencia_dados"
  | "revisao_humana"
  | "documento_aprovado"
  | "documentacao_aprovada"
  | "processo_bloqueado"
  | "processo_concluido";

interface Body {
  processo_id: string;
  evento: Evento;
  documento_id?: string;
  motivo?: string;
}

const TITULOS: Record<Evento, string> = {
  processo_criado: "Processo aberto",
  pagamento_confirmado: "Pagamento confirmado — Central de Documentos liberada",
  documento_em_validacao: "Validando seu documento",
  documento_faltante: "Documento pendente",
  certidao_faltante: "Certidão pendente",
  documento_invalido: "Documento precisa ser reenviado",
  certidao_invalida: "Certidão precisa ser reenviada",
  divergencia_dados: "Divergência entre documento e cadastro",
  revisao_humana: "Documento em revisão humana",
  documento_aprovado: "Documento aprovado",
  documentacao_aprovada: "Documentação aprovada",
  processo_bloqueado: "Processo bloqueado",
  processo_concluido: "Processo concluído",
};

function escapeHtml(s: string) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function btn(href: string, label: string, color = "#0ea5e9") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;margin:6px 4px;">${escapeHtml(label)}</a>`;
}

function corpoEvento(ev: Evento, ctx: { servico: string; documento?: string; motivo?: string; portalUrl: string; uploadUrl: string; linkEmissao?: string | null; labelBotao?: string | null; }) {
  const docName = ctx.documento ? `<strong>${escapeHtml(ctx.documento)}</strong>` : "documento";
  const motivo = ctx.motivo ? `<p style="margin:8px 0;color:#b91c1c;"><em>Motivo: ${escapeHtml(ctx.motivo)}</em></p>` : "";
  const labelEmitir = ctx.labelBotao || "Emitir documento";
  const labelEmitirCert = ctx.labelBotao || "Emitir certidão";

  switch (ev) {
    case "processo_criado":
      return `<p>Seu processo de <strong>${escapeHtml(ctx.servico)}</strong> foi aberto. Após a confirmação do pagamento, liberaremos a Central de Documentos.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo")}</p>`;
    case "pagamento_confirmado":
      return `<p>Pagamento confirmado. A <strong>Central de Documentos</strong> está liberada para envio dos arquivos do seu processo de <strong>${escapeHtml(ctx.servico)}</strong>.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acessar Central de Documentos", "#16a34a")}</p>`;
    case "documento_em_validacao":
      return `<p>Recebemos ${docName}. A validação automática começou e em instantes você terá o resultado.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo")}</p>`;
    case "documento_faltante":
      return `<p>Falta enviar ${docName}. Pedimos apenas este item — os já aprovados não precisam ser reenviados.</p>
        ${ctx.linkEmissao ? `<p style="text-align:center;">${btn(ctx.linkEmissao, labelEmitir, "#0f172a")}${btn(ctx.uploadUrl, "Enviar PDF")}</p>` : `<p style="text-align:center;">${btn(ctx.uploadUrl, "Enviar PDF")}</p>`}`;
    case "certidao_faltante":
      return `<p>Falta enviar ${docName}. Cada certidão é cobrada separadamente — só este item está pendente.</p>
        ${ctx.linkEmissao ? `<p style="text-align:center;">${btn(ctx.linkEmissao, labelEmitirCert, "#0f172a")}${btn(ctx.uploadUrl, "Enviar PDF")}</p>` : `<p style="text-align:center;">${btn(ctx.uploadUrl, "Enviar PDF")}</p>`}`;
    case "documento_invalido":
      return `<p>${docName} foi considerado inválido.</p>${motivo}<p>Reenvie um novo arquivo. Os outros documentos já aprovados permanecem válidos.</p>
        ${ctx.linkEmissao ? `<p style="text-align:center;">${btn(ctx.linkEmissao, labelEmitir, "#0f172a")}${btn(ctx.uploadUrl, "Reenviar PDF", "#dc2626")}</p>` : `<p style="text-align:center;">${btn(ctx.uploadUrl, "Reenviar PDF", "#dc2626")}${btn(ctx.portalUrl, "Ver instruções")}</p>`}`;
    case "certidao_invalida":
      return `<p>${docName} foi considerada inválida.</p>${motivo}<p>Emita novamente e reenvie. As outras certidões aprovadas seguem válidas.</p>
        ${ctx.linkEmissao ? `<p style="text-align:center;">${btn(ctx.linkEmissao, labelEmitirCert, "#0f172a")}${btn(ctx.uploadUrl, "Reenviar PDF", "#dc2626")}</p>` : `<p style="text-align:center;">${btn(ctx.uploadUrl, "Reenviar PDF", "#dc2626")}</p>`}`;
    case "divergencia_dados":
      return `<p>Detectamos divergência entre ${docName} e seu cadastro.</p>${motivo}
        <p>Diga qual dado está correto:</p>
        <p style="text-align:center;">${btn(ctx.portalUrl + "&acao=confirmar_cadastro", "Meu cadastro está correto", "#0f172a")}${btn(ctx.portalUrl + "&acao=confirmar_documento", "O documento está correto", "#0ea5e9")}</p>
        <p style="text-align:center;">${btn(ctx.uploadUrl, "Reenviar PDF correto")}</p>`;
    case "revisao_humana":
      return `<p>${docName} está em revisão humana. Avisaremos assim que terminar — nenhuma ação sua é necessária agora.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo")}</p>`;
    case "documento_aprovado":
      return `<p>${docName} foi aprovado. Continue acompanhando os itens restantes.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo", "#16a34a")}</p>`;
    case "documentacao_aprovada":
      return `<p>Toda a documentação do processo de <strong>${escapeHtml(ctx.servico)}</strong> foi aprovada. Vamos para a próxima etapa.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo", "#16a34a")}</p>`;
    case "processo_bloqueado":
      return `<p>Seu processo está bloqueado.</p>${motivo}<p>Nossa equipe entrará em contato.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acompanhar processo")}</p>`;
    case "processo_concluido":
      return `<p>Seu processo de <strong>${escapeHtml(ctx.servico)}</strong> foi concluído com sucesso. Obrigado pela confiança.</p>
        <p style="text-align:center;">${btn(ctx.portalUrl, "Acessar processo", "#16a34a")}</p>`;
  }
}

function buildHtml(opts: { titulo: string; nomeCliente: string; servico: string; corpo: string; }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
  <tr><td style="background:#0f172a;padding:22px 28px;">
    <div style="font-size:11px;letter-spacing:0.18em;color:#94a3b8;font-weight:700;">${BRAND}</div>
    <div style="font-size:20px;color:#fff;font-weight:700;margin-top:6px;">${escapeHtml(opts.titulo)}</div>
  </td></tr>
  <tr><td style="padding:28px;">
    <p style="font-size:15px;margin:0 0 12px;">Olá, <strong>${escapeHtml(opts.nomeCliente)}</strong>.</p>
    <div style="font-size:15px;line-height:1.6;color:#1f2937;">${opts.corpo}</div>
    <div style="background:#f1f5f9;border-radius:10px;padding:14px 16px;margin:20px 0;">
      <div style="font-size:10px;letter-spacing:0.14em;font-weight:700;color:#64748b;">SERVIÇO</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:4px;text-transform:uppercase;">${escapeHtml(opts.servico)}</div>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${BRAND}.</div>
  </td></tr>
</table></td></tr></table></body></html>`;
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
    if (!TITULOS[body.evento]) {
      return new Response(JSON.stringify({ error: `Evento inválido: ${body.evento}`, traceId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: proc } = await supabase.from("qa_processos")
      .select("id, cliente_id, servico_nome, status").eq("id", body.processo_id).maybeSingle();
    if (!proc) throw new Error("Processo não encontrado");

    const { data: cli } = await supabase.from("qa_clientes")
      .select("nome_completo, email").eq("id", proc.cliente_id).maybeSingle();
    if (!cli?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_email", traceId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nomeDoc: string | undefined;
    let linkEmissao: string | null | undefined;
    let labelBotao: string | null | undefined;
    if (body.documento_id) {
      const { data: doc } = await supabase.from("qa_processo_documentos")
        .select("nome_documento, motivo_rejeicao, link_emissao, regra_validacao")
        .eq("id", body.documento_id).maybeSingle();
      nomeDoc = doc?.nome_documento ?? undefined;
      linkEmissao = doc?.link_emissao ?? null;
      const reg = (doc?.regra_validacao ?? null) as Record<string, unknown> | null;
      labelBotao = (reg && typeof reg["label_botao"] === "string") ? reg["label_botao"] as string : null;
      if (!body.motivo && doc?.motivo_rejeicao) body.motivo = doc.motivo_rejeicao;
    }

    const portalUrl = `${PORTAL_BASE}?processo=${proc.id}`;
    const uploadUrl = body.documento_id ? `${portalUrl}&doc=${body.documento_id}#enviar` : portalUrl;
    const titulo = TITULOS[body.evento];
    const corpo = corpoEvento(body.evento, { servico: proc.servico_nome, documento: nomeDoc, motivo: body.motivo, portalUrl, uploadUrl, linkEmissao, labelBotao });
    const html = buildHtml({ titulo, nomeCliente: cli.nome_completo ?? "cliente", servico: proc.servico_nome, corpo });
    const text = `${titulo}\n\nOlá, ${cli.nome_completo ?? "cliente"}.\nAcompanhe em: ${portalUrl}\n\n— ${BRAND}`;

    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
    const smtpRes = await supabase.functions.invoke("send-smtp-email", {
      headers: { "x-internal-token": internalToken },
      body: { to: cli.email, subject: `${titulo} — ${BRAND}`, html, text, trace_id: traceId },
    });
    const ok = !smtpRes.error && (smtpRes.data as any)?.success;
    await logSistemaBackend({
      tipo: "email", status: ok ? "success" : "error",
      mensagem: `Notificação ${body.evento}: ${cli.email}${ok ? "" : " (FALHA)"}`,
      payload: { trace_id: traceId, processo_id: proc.id, error: ok ? undefined : (smtpRes.error || smtpRes.data) },
    });

    await supabase.from("qa_processo_eventos").insert({
      processo_id: proc.id, documento_id: body.documento_id ?? null,
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
