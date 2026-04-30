import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Atualização auditável de status_servico de uma solicitação.
 * - Se sem_checklist_configurado=true e status_tentado != 'aguardando_documentacao':
 *   registra evento 'tentativa_status_bloqueada' e retorna 409.
 * - Caso contrário, executa o UPDATE; eventuais bloqueios do trigger
 *   (transição inválida, etc.) também são auditados.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      solicitacao_id,
      status_servico,
      status_financeiro,
      status_processo,
      observacoes,
    } = body || {};

    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: "solicitacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve ator a partir do JWT
    let ator = "operador";
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      try {
        const payload = JSON.parse(atob(auth.slice(7).split(".")[1]));
        ator = payload?.email || payload?.sub || ator;
      } catch { /* ignore */ }
    }

    // Estado atual
    const { data: atual, error: atualErr } = await supa
      .from("qa_solicitacoes_servico")
      .select("id, cliente_id, status_servico, status_financeiro, sem_checklist_configurado")
      .eq("id", solicitacao_id)
      .maybeSingle();
    if (atualErr || !atual) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tentaStatus =
      typeof status_servico === "string" && status_servico !== atual.status_servico;

    // Bloqueio explícito: sem checklist
    if (
      tentaStatus &&
      atual.sem_checklist_configurado === true &&
      status_servico !== "aguardando_documentacao" &&
      status_servico !== "finalizado"
    ) {
      await supa.from("qa_solicitacao_eventos").insert({
        solicitacao_id,
        cliente_id: atual.cliente_id,
        evento: "tentativa_status_bloqueada",
        status_anterior: atual.status_servico,
        descricao: "Tentativa de alterar status sem checklist configurado",
        ator,
        metadata: {
          status_tentado: status_servico,
          motivo: "sem_checklist_configurado",
        },
      });
      return new Response(
        JSON.stringify({
          error: "Status bloqueado: configure o checklist antes de avançar.",
          motivo: "sem_checklist_configurado",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Monta payload (omite status_servico se sem_checklist)
    const payload: Record<string, any> = {};
    if (typeof status_servico === "string" && !atual.sem_checklist_configurado) {
      payload.status_servico = status_servico;
    }
    if (typeof status_financeiro === "string") payload.status_financeiro = status_financeiro;
    if (typeof status_processo === "string") payload.status_processo = status_processo;
    if (typeof observacoes !== "undefined") payload.observacoes = observacoes || null;

    if (Object.keys(payload).length === 0) {
      return new Response(JSON.stringify({ ok: true, noop: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supa
      .from("qa_solicitacoes_servico")
      .update(payload)
      .eq("id", solicitacao_id);

    if (updErr) {
      // Trigger barrou (transição inválida etc.) — audita também
      await supa.from("qa_solicitacao_eventos").insert({
        solicitacao_id,
        cliente_id: atual.cliente_id,
        evento: "tentativa_status_bloqueada",
        status_anterior: atual.status_servico,
        descricao: updErr.message,
        ator,
        metadata: {
          status_tentado: status_servico ?? null,
          motivo: "trigger_validacao",
        },
      });
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🚀 Gatilho automático: provisionar acesso ao Portal quando status_financeiro virar "pago"
    const PAID_STATUSES = new Set(["pago", "quitado", "recebido", "confirmado"]);
    const becamePaid =
      typeof status_financeiro === "string" &&
      PAID_STATUSES.has(String(status_financeiro).toLowerCase()) &&
      !PAID_STATUSES.has(String(atual.status_financeiro || "").toLowerCase());

    if (becamePaid && atual.cliente_id) {
      try {
        // Idempotência: só provisiona se ainda não foi provisionado
        const { data: cli } = await supa
          .from("qa_clientes")
          .select("id, nome_completo, email, cpf, user_id, customer_id, portal_provisionado_em")
          .eq("id", atual.cliente_id)
          .maybeSingle();

        if (cli && cli.email && !cli.portal_provisionado_em) {
          // Gera senha temporária e cria acesso via create-client-user (idempotente lá também)
          const tempPwd = generateTempPassword();

          const { data: provisionRes, error: provisionErr } = await supa.functions.invoke("create-client-user", {
            body: {
              qa_client_id: cli.id,
              customer_id: cli.customer_id || undefined,
              email: cli.email,
              document: cli.cpf,
              user_password: tempPwd,
              name: cli.nome_completo,
              customer_data: {
                email: cli.email,
                razao_social: cli.nome_completo,
                responsavel: cli.nome_completo,
                cnpj_ou_cpf: String(cli.cpf || "").replace(/\D/g, ""),
                status_cliente: "ativo",
              },
            },
            headers: {
              // sinaliza que é chamada interna do servidor (sem JWT de usuário)
              "x-internal-token": Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "",
              "x-admin-token": "",
            },
          });

          if (provisionErr || provisionRes?.error) {
            await supa.from("qa_solicitacao_eventos").insert({
              solicitacao_id,
              cliente_id: atual.cliente_id,
              evento: "falha_envio_email",
              descricao: `Falha ao provisionar Portal automaticamente após pagamento: ${provisionErr?.message || provisionRes?.error}`,
              ator: "sistema",
              metadata: { motivo: "auto_provisionamento_pagamento" },
            });
          } else {
            await supa.from("qa_solicitacao_eventos").insert({
              solicitacao_id,
              cliente_id: atual.cliente_id,
              evento: "portal_provisionado",
              descricao: `Acesso ao Portal provisionado automaticamente após pagamento confirmado (${cli.email})`,
              ator: "sistema",
              metadata: {
                motivo: "auto_provisionamento_pagamento",
                trigger: "status_financeiro=pago",
                user_id: provisionRes?.user_id ?? null,
              },
            });
          }
        } else if (cli && cli.portal_provisionado_em) {
          // Já provisionado — não recria/reenvia (regra: manual só reenvia se operador clicar)
          console.info("[qa-status-update] portal já provisionado, ignorando auto-envio", { qa_client_id: cli.id });
        } else if (cli && !cli.email) {
          await supa.from("qa_solicitacao_eventos").insert({
            solicitacao_id,
            cliente_id: atual.cliente_id,
            evento: "falha_envio_email",
            descricao: "Cliente sem e-mail cadastrado — provisionamento automático ignorado",
            ator: "sistema",
            metadata: { motivo: "sem_email" },
          });
        }
      } catch (autoErr) {
        console.error("[qa-status-update] erro no auto-provisionamento:", autoErr);
        try {
          await supa.from("qa_solicitacao_eventos").insert({
            solicitacao_id,
            cliente_id: atual.cliente_id,
            evento: "falha_envio_email",
            descricao: `Erro inesperado no auto-provisionamento: ${(autoErr as Error).message}`,
            ator: "sistema",
            metadata: { motivo: "exception_auto_provisionamento" },
          });
        } catch { /* ignore */ }
      }
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

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 10; i++) pwd += chars[arr[i] % chars.length];
  return pwd + "!1";
}