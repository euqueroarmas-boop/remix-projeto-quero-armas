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
  solicitacao_id: string;
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

    // Carrega solicitação + cliente
    const { data: sol, error: solErr } = await supabase
      .from("qa_solicitacoes_servico")
      .select("id, cliente_id, service_name")
      .eq("id", body.solicitacao_id)
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

    // Registra o evento na timeline
    await supabase.from("qa_solicitacao_eventos").insert({
      solicitacao_id: body.solicitacao_id,
      cliente_id: sol.cliente_id ?? null,
      evento: body.evento,
      descricao: body.observacao ?? null,
      metadata: {
        documentos_recebidos: body.documentos_recebidos,
        documentos_total: body.documentos_total,
        documento_nome: body.documento_nome,
        status_orgao: body.status_orgao,
      },
      ator: "sistema",
    });

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
        trace_id: `qa-event-${body.evento}-${body.solicitacao_id}`,
      },
    });

    if (mailErr) {
      return new Response(JSON.stringify({ ok: false, mail_error: mailErr.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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