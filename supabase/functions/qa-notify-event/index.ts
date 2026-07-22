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
  | "status_orgao"
  // Verde — documento com validade cadastrado/renovado (não precisa de solicitacao_id)
  | "documento_em_dia"
  // Verde — exigência do processo cumprida
  | "exigencia_cumprida";

/** Eventos verdes não exigem solicitacao_id e disparam popup normal no portal. */
const EVENTOS_VERDES = new Set<Evento>(["documento_em_dia", "exigencia_cumprida"]);

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
  /** Para documento_em_dia. */
  documento?: string;
  numero?: string;
  validade?: string; // YYYY-MM-DD
  documento_evento?: "cadastrado" | "renovado";
  referencia_tabela?: string;
  referencia_id?: string;
  /** Para exigencia_cumprida. */
  processo?: string;
  exigencia?: string;
}

function brDate(iso?: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  return s.includes("-") ? s.split("-").reverse().join("/") : s;
}

function diasAteVencer(iso?: string | null): string {
  if (!iso) return "—";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return String(Math.floor((v.getTime() - hoje.getTime()) / 86400000));
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
    case "documento_em_dia":
      return {
        templateName: "documento-em-dia",
        templateData: {
          nome,
          documento: p.documento || "documento",
          numero: p.numero || "—",
          validade: brDate(p.validade),
          diasRestantes: diasAteVencer(p.validade),
          evento: p.documento_evento === "renovado" ? "renovado" : "cadastrado",
          portalUrl,
        },
      };
    case "exigencia_cumprida":
      return {
        templateName: "exigencia-cumprida",
        templateData: {
          nome,
          processo: p.processo || svc,
          exigencia: p.exigencia || "—",
          cumpridaEm: brDate(new Date().toISOString()),
          portalUrl,
        },
      };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (!body?.evento) {
      return new Response(JSON.stringify({ error: "evento obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Eventos verdes (documento_em_dia / exigencia_cumprida) não exigem
    // solicitacao_id — bastam cliente_id + dados do documento/exigência.
    if (!EVENTOS_VERDES.has(body.evento) && !body.solicitacao_id && !body.cliente_id) {
      return new Response(JSON.stringify({ error: "solicitacao_id ou cliente_id obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fast path para eventos verdes: envia e-mail verde + popup normal, sem
    // depender de solicitação. Reusa sendTransactional (motor Lovable com
    // remetente arsenalinteligente@notificacao.euqueroarmas.com.br) e a
    // tabela qa_notificacoes_cliente já existente.
    if (EVENTOS_VERDES.has(body.evento)) {
      if (!body.cliente_id) {
        return new Response(JSON.stringify({ error: "cliente_id obrigatório para evento verde" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: cli } = await supabase
        .from("qa_clientes").select("nome_completo, email").eq("id", body.cliente_id).maybeSingle();
      const nomeCli = (cli as any)?.nome_completo ?? null;
      const emailCli = (cli as any)?.email ?? null;
      const mapped = mapEventoToTemplate(body, { nome: nomeCli }, body.processo || body.documento || "");
      let emailOk = false;
      if (mapped && emailCli) {
        const idem = body.evento === "documento_em_dia"
          ? `qa-verde-doc-${body.cliente_id}-${body.referencia_tabela || "x"}-${body.referencia_id || body.documento || "x"}-${body.validade || "x"}`
          : `qa-verde-exig-${body.cliente_id}-${body.referencia_id || body.exigencia || Date.now()}`;
        const send = await sendTransactional({
          templateName: mapped.templateName,
          recipientEmail: emailCli,
          idempotencyKey: idem,
          templateData: mapped.templateData,
        });
        emailOk = send.ok;
      }
      const categoria = body.evento === "documento_em_dia" ? "documento_em_dia" : "exigencia_cumprida";
      const titulo = body.evento === "documento_em_dia"
        ? `${body.documento || "Documento"} ${body.documento_evento === "renovado" ? "renovado" : "cadastrado"} — em dia`
        : "Exigência cumprida";
      const mensagem = body.evento === "documento_em_dia"
        ? (body.validade ? `Em dia até ${brDate(body.validade)}.` : "Cadastrado com sucesso.")
        : (body.exigencia ? `Exigência "${body.exigencia}" atendida.` : "Exigência atendida.");
      try {
        await supabase.from("qa_notificacoes_cliente").upsert({
          cliente_id: body.cliente_id,
          categoria,
          urgencia: "normal",
          titulo,
          mensagem,
          link: "/area-do-cliente",
          referencia_tabela: body.referencia_tabela || null,
          referencia_id: body.referencia_id || null,
          ativa: true,
        }, { onConflict: "cliente_id,categoria,referencia_tabela,referencia_id" });
      } catch (err) {
        console.error("[qa-notify-event] popup verde:", err);
      }
      return new Response(JSON.stringify({ ok: true, verde: true, emailOk }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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