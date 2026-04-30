import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

/**
 * Notificações operacionais Quero Armas — disparadas por EVENTOS REAIS do
 * fluxo (nunca genéricas). Cada evento mapeia 1:1 para um e-mail com texto
 * específico para o cliente. Usa send-smtp-email já existente.
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

function buildBody(p: Payload, cliente: { nome?: string | null }, servico: string): { subject: string; html: string } {
  const nome = (cliente.nome || "Cliente").split(" ")[0];
  const svc = servico || "seu serviço";
  switch (p.evento) {
    case "montando_pasta":
      return {
        subject: `Iniciamos a preparação do seu processo — ${svc}`,
        html: `<p>Olá, ${nome}.</p><p>Demos início à preparação da sua pasta para <strong>${svc}</strong>. Em breve solicitaremos a documentação necessária.</p><p>— Equipe Quero Armas</p>`,
      };
    case "documento_recebido": {
      const x = p.documentos_recebidos ?? 0;
      const y = p.documentos_total ?? 0;
      const doc = p.documento_nome ? ` (${p.documento_nome})` : "";
      return {
        subject: `Documento recebido — ${x}/${y}`,
        html: `<p>Olá, ${nome}.</p><p>Recebemos um novo documento${doc} para o serviço <strong>${svc}</strong>. Você está em <strong>${x} de ${y}</strong> documentos enviados.</p>${y && x < y ? `<p>Faltam <strong>${y - x}</strong> documento(s).</p>` : ""}<p>— Equipe Quero Armas</p>`,
      };
    }
    case "todos_documentos_recebidos":
      return {
        subject: `Documentação completa — ${svc}`,
        html: `<p>Olá, ${nome}.</p><p>Recebemos todos os documentos necessários para <strong>${svc}</strong>. Vamos iniciar a verificação.</p><p>— Equipe Quero Armas</p>`,
      };
    case "em_verificacao":
      return {
        subject: `Sua documentação está em verificação — ${svc}`,
        html: `<p>Olá, ${nome}.</p><p>Sua documentação para <strong>${svc}</strong> está em análise interna pela nossa equipe técnica.</p><p>— Equipe Quero Armas</p>`,
      };
    case "pronto_para_protocolo":
      return {
        subject: `Tudo pronto para protocolar — ${svc}`,
        html: `<p>Olá, ${nome}.</p><p>Sua pasta para <strong>${svc}</strong> foi aprovada internamente e está pronta para protocolo no órgão competente.</p><p>— Equipe Quero Armas</p>`,
      };
    case "enviado_ao_orgao":
      return {
        subject: `Processo enviado ao órgão — ${svc}`,
        html: `<p>Olá, ${nome}.</p><p>Seu processo de <strong>${svc}</strong> foi protocolado junto ao órgão competente. A partir de agora, acompanharemos a evolução por lá.</p><p>— Equipe Quero Armas</p>`,
      };
    case "status_orgao": {
      const st = (p.status_orgao || "atualização").toUpperCase().replace(/_/g, " ");
      const obs = p.observacao ? `<p>${p.observacao}</p>` : "";
      return {
        subject: `Atualização do órgão — ${st}`,
        html: `<p>Olá, ${nome}.</p><p>Houve uma atualização no seu processo <strong>${svc}</strong> junto ao órgão competente: <strong>${st}</strong>.</p>${obs}<p>— Equipe Quero Armas</p>`,
      };
    }
  }
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
    const { subject, html } = buildBody(body, { nome }, servicoNome);

    const { error: mailErr } = await supabase.functions.invoke("send-smtp-email", {
      body: {
        to: email,
        subject,
        html,
        from_name: "Quero Armas",
        trace_id: `qa-event-${body.evento}-${solicitacaoId}`,
      },
    });

    if (mailErr) {
      return new Response(JSON.stringify({ ok: false, mail_error: mailErr.message }), {
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