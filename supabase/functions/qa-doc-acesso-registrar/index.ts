// qa-doc-acesso-registrar
//
// Registra em qa_documento_acessos toda vez que a EQUIPE visualiza ou baixa
// documento(s) do cliente e avisa o cliente — portal + e-mail.
//
// Rejeição e exclusão continuam sendo notificadas por qa-notify-event (com
// templates próprios); aqui só entram as ações de leitura/download, que não
// tinham rastro nenhum.
//
// Anti-spam: visualização/download do MESMO documento só gera novo aviso
// depois de 6h. O registro de auditoria, porém, é SEMPRE gravado.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";
const JANELA_AVISO_MS = 6 * 60 * 60 * 1000;

interface Body {
  cliente_id?: number;
  acao?: "visualizado" | "baixado" | "baixado_lote";
  documento_id?: string | null;
  documento_tipo?: string | null;
  documento_nome?: string | null;
  quantidade?: number;
  detalhes?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const guard = await (await import("../_shared/qaAuth.ts")).requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as Body;
    const acao = body.acao;
    const clienteId = Number(body.cliente_id) || null;
    if (!clienteId || !acao || !["visualizado", "baixado", "baixado_lote"].includes(acao)) {
      return json({ error: "cliente_id e acao válidos são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const quantidade = Math.max(1, Number(body.quantidade) || 1);
    const nomeDoc = body.documento_nome || body.documento_tipo || "documento";

    // 1) Auditoria — sempre.
    const { data: registro } = await supabase
      .from("qa_documento_acessos")
      .insert({
        cliente_id: clienteId,
        documento_id: body.documento_id ?? null,
        documento_tipo: body.documento_tipo ?? null,
        documento_nome: body.documento_nome ?? null,
        acao,
        quantidade,
        usuario_id: guard.userId ?? null,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: req.headers.get("user-agent"),
        detalhes: body.detalhes ?? {},
      })
      .select("id")
      .maybeSingle();

    // 2) Dedupe do aviso ao cliente (6h por documento + ação).
    const desde = new Date(Date.now() - JANELA_AVISO_MS).toISOString();
    let q = supabase
      .from("qa_documento_acessos")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("acao", acao)
      .not("notificado_em", "is", null)
      .gte("notificado_em", desde)
      .limit(1);
    q = body.documento_id ? q.eq("documento_id", body.documento_id) : q.is("documento_id", null);
    const { data: jaAvisado } = await q;
    if (jaAvisado && jaAvisado.length > 0) {
      return json({ ok: true, auditado: true, avisado: false, motivo: "janela_6h" });
    }

    const { data: cli } = await supabase
      .from("qa_clientes")
      .select("nome_completo, email")
      .eq("id", clienteId)
      .maybeSingle();
    const nome = String((cli as any)?.nome_completo || "Cliente").split(" ")[0];
    const email = (cli as any)?.email as string | undefined;

    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const titulo =
      acao === "baixado_lote"
        ? "Sua equipe baixou seu dossiê completo"
        : acao === "baixado"
          ? "Sua equipe baixou um documento seu"
          : "Sua equipe visualizou um documento seu";
    const mensagem =
      acao === "baixado_lote"
        ? `Baixamos ${quantidade} documento(s) do seu acervo em ${quando} para montar o seu dossiê de protocolo.`
        : `${acao === "baixado" ? "Baixamos" : "Visualizamos"} "${nomeDoc}" em ${quando} para conferência do seu processo.`;

    // Portal
    try {
      await supabase.from("qa_notificacoes_cliente").upsert(
        {
          cliente_id: clienteId,
          categoria: `documento_${acao}`,
          urgencia: "normal",
          titulo,
          mensagem,
          link: "/area-do-cliente",
          referencia_tabela: "qa_documentos_cliente",
          referencia_id: body.documento_id ?? null,
          expira_em: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
          ativa: true,
        },
        { onConflict: "cliente_id,categoria,referencia_tabela,referencia_id" },
      );
    } catch (err) {
      console.error("[qa-doc-acesso-registrar] popup:", err);
    }

    // E-mail (transparência de acesso — LGPD)
    let emailOk = false;
    if (email) {
      const html = `
        <p style="font-size:15px;color:#0a0a0a;margin:0 0 12px">Olá, ${nome}.</p>
        <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px">${mensagem}</p>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
          Este aviso é automático e serve para você acompanhar todo acesso da nossa equipe aos seus documentos.
          Nenhuma alteração foi feita no seu acervo.
        </p>
        <p style="margin:16px 0 0"><a href="${PORTAL_URL}" style="background:#7A1F2B;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold">ABRIR MEU ARSENAL</a></p>`;
      const send = await sendTransactional({
        templateName: "arsenal-generic",
        recipientEmail: email,
        idempotencyKey: `qa-doc-acesso-${clienteId}-${acao}-${body.documento_id ?? "lote"}-${Math.floor(Date.now() / JANELA_AVISO_MS)}`,
        templateData: { subject: titulo, html },
      });
      emailOk = send.ok;
    }

    if (registro?.id) {
      await supabase
        .from("qa_documento_acessos")
        .update({ notificado_em: new Date().toISOString() })
        .eq("id", registro.id);
    }

    return json({ ok: true, auditado: true, avisado: true, emailOk });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});