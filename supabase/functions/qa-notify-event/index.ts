import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

/**
 * Notificações operacionais Arsenal Inteligente — disparadas por EVENTOS REAIS do
 * fluxo (nunca genéricas). Cada evento mapeia 1:1 para um e-mail com texto
 * específico para o cliente. Cada evento usa um template dedicado
 * (evento-*) via send-transactional-email (Lovable Emails).
 *
 * Eventos suportados:
 *  - montando_pasta            (início do serviço)
 *  - documento_recebido        (X de Y)
 *  - todos_documentos_recebidos
 *  - em_verificacao
 *  - pronto_para_protocolo
 *  - enviado_ao_orgao
 *  - status_orgao              (em_analise_orgao | notificado | restituido | recurso_administrativo | deferido | indeferido)
 */

type Evento =
  | "montando_pasta"
  | "documento_recebido"
  | "todos_documentos_recebidos"
  | "em_verificacao"
  | "pronto_para_protocolo"
  | "enviado_ao_orgao"
  | "status_orgao";

interface Payload {
  evento: Evento;
  solicitacao_id?: string;
  /** Quando solicitacao_id não for informada, resolve a partir do cliente. */
  cliente_id?: number;
  /** Para documento_recebido. */
  documentos_recebidos?: number;
  documentos_total?: number;
  documento_nome?: string;
  /** Para status_orgao. */
  status_orgao?: string;
  observacao?: string;
  /** Override opcional, se já carregado em memória. */
  cliente?: { nome?: string | null; email?: string | null };
  servico_nome?: string | null;
  /** Status novo após mudança (para anti-dup em mudanças manuais). */
  status_novo?: string | null;
}

const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

function firstName(nome: string | null | undefined): string {
  return (nome || "Cliente").split(" ")[0];
}

/** Mapeia cada evento para um template dedicado + templateData. */
function mapEventoToTemplate(
  p: Payload,
  cliente: { nome?: string | null },
  servico: string,
): { templateName: string; templateData: Record<string, unknown> } | null {
  const nome = firstName(cliente.nome);
  const svc = servico || "seu serviço";
  const portalUrl = PORTAL_URL;
  switch (p.evento) {
    case "montando_pasta":
      return { templateName: "evento-montando-pasta", templateData: { nome, servico: svc, portalUrl } };
    case "documento_recebido":
      return {
        templateName: "evento-documento-recebido",
        templateData: {
          nome,
          servico: svc,
          recebidos: String(p.documentos_recebidos ?? 0),
          total: String(p.documentos_total ?? 0),
          portalUrl,
        },
      };
    case "todos_documentos_recebidos":
      return { templateName: "evento-todos-documentos-recebidos", templateData: { nome, servico: svc, portalUrl } };
    case "em_verificacao":
      return { templateName: "evento-em-verificacao", templateData: { nome, servico: svc, portalUrl } };
    case "pronto_para_protocolo":
      return { templateName: "evento-pronto-protocolo", templateData: { nome, servico: svc, portalUrl } };
    case "enviado_ao_orgao":
      return {
        templateName: "evento-enviado-orgao",
        templateData: { nome, servico: svc, portalUrl, protocolo: p.observacao ?? "" },
      };
    case "status_orgao": {
      const status = (p.status_orgao || "atualização").replace(/_/g, " ");
      return {
        templateName: "evento-status-orgao",
        templateData: { nome, servico: svc, status, observacao: p.observacao ?? "", portalUrl },
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (!body?.evento || !body?.solicitacao_id) {
      return new Response(JSON.stringify({ error: "evento e solicitacao_id obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve solicitacao_id se vier apenas cliente_id (pega a mais recente
    // não-finalizada/indeferida do cliente).
    let solicitacaoId = body.solicitacao_id ?? null;
    if (!solicitacaoId && body.cliente_id) {
      const { data: ativa } = await supabase
        .from("qa_solicitacoes_servico")
        .select("id")
        .eq("cliente_id", body.cliente_id)
        .not("status_servico", "in", "(deferido,indeferido,finalizado)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      solicitacaoId = (ativa as any)?.id ?? null;
    }
    if (!solicitacaoId) {
      return new Response(JSON.stringify({ error: "solicitacao_id ou cliente_id válidos são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sol, error: solErr } = await supabase
      .from("qa_solicitacoes_servico")
      .select("id, cliente_id, service_name, status_servico")
      .eq("id", solicitacaoId)
      .maybeSingle();
    if (solErr || !sol) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nome = body.cliente?.nome ?? null;
    let email = body.cliente?.email ?? null;
    if ((!nome || !email) && sol.cliente_id) {
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", sol.cliente_id)
        .maybeSingle();
      if (cli) {
        nome = nome || (cli as any).nome_completo;
        email = email || (cli as any).email;
      }
    }

    // Anti-duplicidade: já existe e-mail enviado para este (solicitacao, evento, status_novo)
    // sem mudança real de status no meio?
    const statusRef = body.status_novo ?? (sol as any).status_servico ?? null;
    const { data: jaNotif } = await supabase.rpc("qa_evento_ja_notificado", {
      _solicitacao_id: solicitacaoId,
      _evento: body.evento,
      _status_novo: statusRef,
    });

    // Registra o evento na timeline (sempre — útil para auditoria)
    const { data: eventoRow } = await supabase
      .from("qa_solicitacao_eventos")
      .insert({
        solicitacao_id: solicitacaoId,
      cliente_id: sol.cliente_id ?? null,
      evento: body.evento,
        status_novo: statusRef,
      descricao: body.observacao ?? null,
      metadata: {
        documentos_recebidos: body.documentos_recebidos,
        documentos_total: body.documentos_total,
        documento_nome: body.documento_nome,
        status_orgao: body.status_orgao,
      },
      ator: "sistema",
      })
      .select("id")
      .single();

    if (jaNotif === true) {
      return new Response(JSON.stringify({ ok: true, email_skipped: "duplicado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // E-mail só se tiver destinatário válido
    if (!email) {
      return new Response(JSON.stringify({ ok: true, email_skipped: "sem_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const servicoNome = body.servico_nome ?? (sol as any).service_name ?? "seu serviço";
    const mapped = mapEventoToTemplate(body, { nome }, servicoNome);
    if (!mapped) {
      return new Response(JSON.stringify({ ok: true, email_skipped: "evento_sem_template" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const send = await sendTransactional({
      templateName: mapped.templateName,
      recipientEmail: email,
      idempotencyKey: `qa-event-${body.evento}-${solicitacaoId}-${statusRef ?? "na"}`,
      templateData: mapped.templateData,
    });

    if (!send.ok) {
      return new Response(JSON.stringify({ ok: false, mail_error: send.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca evento como notificado por e-mail (para a anti-dup futura)
    if ((eventoRow as any)?.id) {
      await supabase
        .from("qa_solicitacao_eventos")
        .update({ email_enviado_em: new Date().toISOString() })
        .eq("id", (eventoRow as any).id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});