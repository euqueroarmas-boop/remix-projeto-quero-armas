// notificacaoPolicy.ts — Política canônica de notificação ao cliente Quero Armas.
//
// Cobre a decisão da equipe (notificar ou não), canais escolhidos (e-mail,
// WhatsApp, portal), motivo obrigatório quando não notifica, e registra
// TODA a trilha em qa_notificacao_eventos. Também espelha para o sino do
// cliente em qa_arsenal_notificacoes (categoria: operacional) quando
// canal portal=true.
//
// Regras:
// - Nunca envia sem registrar.
// - Nunca deixa de enviar sem registrar motivo.
// - WhatsApp: se canal marcado e provedor não configurado, registra
//   whatsapp_nao_configurado e segue (não quebra o fluxo).
// - E-mail: só envia se cliente tiver e-mail; caso contrário registra
//   notificacao_falhou com motivo "sem_email".

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface NotificacaoCanais {
  email?: boolean;
  whatsapp?: boolean;
  portal?: boolean;
}

export interface NotificacaoPolicy {
  notificar_cliente: boolean;
  canais?: NotificacaoCanais;
  motivo_nao_notificar?: string | null;
}

export interface NotificacaoContexto {
  acao: string;                 // ex: "pagamento_confirmado_manual"
  cliente_id?: number | null;
  venda_id?: number | null;
  contrato_id?: string | null;
  processo_id?: string | null;
  documento_id?: string | null;
  staff_user_id?: string | null;
  staff_email?: string | null;
  origem?: string;              // "piloto_real" | "contrato" | "pagamento" | "documentos" | ...
  titulo_portal?: string;
  mensagem_portal?: string;
  link_portal?: string;
  evento_email?: string;        // evento a passar para qa-processo-notificar (quando aplicável)
  payload_resumo?: Record<string, unknown>;
}

export interface AplicarPolicyResultado {
  policy: NotificacaoPolicy;
  resultado: {
    email?: { enviado: boolean; motivo?: string };
    whatsapp?: { enviado: boolean; motivo?: string };
    portal?: { enviado: boolean; motivo?: string };
  };
  eventos_registrados: string[];
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function registrarEvento(params: {
  tipo_evento: string;
  ctx: NotificacaoContexto;
  policy: NotificacaoPolicy;
  resultado?: Record<string, unknown>;
}) {
  try {
    await admin().from("qa_notificacao_eventos").insert({
      tipo_evento: params.tipo_evento,
      acao: params.ctx.acao,
      cliente_id: params.ctx.cliente_id ?? null,
      venda_id: params.ctx.venda_id ?? null,
      contrato_id: params.ctx.contrato_id ?? null,
      processo_id: params.ctx.processo_id ?? null,
      documento_id: params.ctx.documento_id ?? null,
      staff_user_id: params.ctx.staff_user_id ?? null,
      staff_email: params.ctx.staff_email ?? null,
      notificar_cliente: params.policy.notificar_cliente,
      canais: params.policy.canais ?? {},
      motivo_nao_notificar: params.policy.motivo_nao_notificar ?? null,
      resultado: params.resultado ?? {},
      payload_resumo: params.ctx.payload_resumo ?? {},
    });
  } catch (e) {
    console.warn("[notificacaoPolicy] falha ao registrar evento:", (e as Error).message);
  }
}

function whatsappHabilitado(): boolean {
  return Boolean(Deno.env.get("QA_WHATSAPP_PROVIDER"))
    && Boolean(Deno.env.get("QA_WHATSAPP_TOKEN"));
}

/**
 * Aplica a política de notificação registrando trilha imutável e disparando
 * os canais escolhidos. Nunca lança — falhas viram evento notificacao_falhou.
 */
export async function aplicarPolicyNotificacao(
  policy: NotificacaoPolicy,
  ctx: NotificacaoContexto,
): Promise<AplicarPolicyResultado> {
  const eventos: string[] = [];
  const resultado: AplicarPolicyResultado["resultado"] = {};

  // 1. Sempre registrar decisão
  await registrarEvento({ tipo_evento: "notificacao_policy_definida", ctx, policy });
  eventos.push("notificacao_policy_definida");

  // 2. Decisão de NÃO notificar
  if (!policy.notificar_cliente) {
    const motivo = (policy.motivo_nao_notificar || "").trim();
    if (motivo.length < 20) {
      await registrarEvento({
        tipo_evento: "notificacao_falhou",
        ctx,
        policy,
        resultado: { motivo: "motivo_nao_notificar_invalido", requer_min_20_chars: true },
      });
      eventos.push("notificacao_falhou");
      return { policy, resultado, eventos_registrados: eventos };
    }
    await registrarEvento({
      tipo_evento: "notificacao_nao_enviada_por_opcao",
      ctx,
      policy,
      resultado: { motivo },
    });
    eventos.push("notificacao_nao_enviada_por_opcao");
    return { policy, resultado, eventos_registrados: eventos };
  }

  const canais = policy.canais ?? {};
  const supabase = admin();

  // Busca cliente (email + nome)
  let clienteEmail: string | null = null;
  if (ctx.cliente_id) {
    try {
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("email, nome_completo")
        .eq("id", ctx.cliente_id)
        .maybeSingle();
      clienteEmail = (cli as any)?.email ?? null;
    } catch { /* best effort */ }
  }

  // 3. E-MAIL
  if (canais.email) {
    if (!clienteEmail) {
      resultado.email = { enviado: false, motivo: "sem_email" };
      await registrarEvento({
        tipo_evento: "notificacao_falhou",
        ctx,
        policy,
        resultado: { canal: "email", motivo: "sem_email" },
      });
      eventos.push("notificacao_falhou");
    } else if (ctx.processo_id && ctx.evento_email) {
      // Delegar para qa-processo-notificar (templates oficiais)
      try {
        const r = await supabase.functions.invoke("qa-processo-notificar", {
          body: {
            processo_id: ctx.processo_id,
            evento: ctx.evento_email,
            documento_id: ctx.documento_id ?? undefined,
          },
        });
        const ok = !r.error && (r.data as any)?.success !== false;
        resultado.email = { enviado: ok, motivo: ok ? undefined : (r.error?.message || "falha") };
        await registrarEvento({
          tipo_evento: ok ? "notificacao_enviada" : "notificacao_falhou",
          ctx,
          policy,
          resultado: { canal: "email", ok, detalhe: (r.data as any) ?? r.error?.message },
        });
        eventos.push(ok ? "notificacao_enviada" : "notificacao_falhou");
      } catch (e) {
        resultado.email = { enviado: false, motivo: (e as Error).message };
        await registrarEvento({
          tipo_evento: "notificacao_falhou",
          ctx,
          policy,
          resultado: { canal: "email", motivo: (e as Error).message },
        });
        eventos.push("notificacao_falhou");
      }
    } else {
      // Sem evento_email vinculado: apenas registra intenção. O envio real
      // é feito pelo fluxo dono (ex: qa-generate-contract chama send-transactional-email).
      resultado.email = { enviado: true, motivo: "delegado_ao_fluxo_dono" };
      await registrarEvento({
        tipo_evento: "notificacao_enviada",
        ctx,
        policy,
        resultado: { canal: "email", detalhe: "delegado_ao_fluxo_dono" },
      });
      eventos.push("notificacao_enviada");
    }
  }

  // 4. WHATSAPP (preparado)
  if (canais.whatsapp) {
    if (!whatsappHabilitado()) {
      resultado.whatsapp = { enviado: false, motivo: "provedor_nao_configurado" };
      await registrarEvento({
        tipo_evento: "whatsapp_nao_configurado",
        ctx,
        policy,
        resultado: { canal: "whatsapp", motivo: "provedor_nao_configurado" },
      });
      eventos.push("whatsapp_nao_configurado");
    } else {
      // Provedor real ainda não plugado — deixa pronto para futura implementação.
      resultado.whatsapp = { enviado: false, motivo: "adapter_pendente" };
      await registrarEvento({
        tipo_evento: "notificacao_falhou",
        ctx,
        policy,
        resultado: { canal: "whatsapp", motivo: "adapter_pendente" },
      });
      eventos.push("notificacao_falhou");
    }
  }

  // 5. PORTAL (sino do cliente / qa_arsenal_notificacoes)
  if (canais.portal && ctx.cliente_id) {
    try {
      const titulo = ctx.titulo_portal || ctx.acao;
      const mensagem = ctx.mensagem_portal || `Atualização: ${ctx.acao}`;
      await supabase.from("qa_arsenal_notificacoes").insert({
        cliente_id: ctx.cliente_id,
        tipo: "operacional",
        titulo,
        mensagem,
        link: ctx.link_portal || null,
        metadata: {
          categoria: "operacional",
          origem: ctx.origem || "sistema",
          tipo_evento: ctx.acao,
          venda_id: ctx.venda_id ?? null,
          contrato_id: ctx.contrato_id ?? null,
          processo_id: ctx.processo_id ?? null,
          staff_email: ctx.staff_email ?? null,
          prioridade: "normal",
        },
      });
      resultado.portal = { enviado: true };
      await registrarEvento({
        tipo_evento: "portal_registrado",
        ctx,
        policy,
        resultado: { canal: "portal", ok: true },
      });
      eventos.push("portal_registrado");
    } catch (e) {
      resultado.portal = { enviado: false, motivo: (e as Error).message };
      await registrarEvento({
        tipo_evento: "notificacao_falhou",
        ctx,
        policy,
        resultado: { canal: "portal", motivo: (e as Error).message },
      });
      eventos.push("notificacao_falhou");
    }
  }

  return { policy, resultado, eventos_registrados: eventos };
}

/**
 * Normaliza um body opcional { notificacao_policy } vindo do wizard.
 * Se ausente, assume política padrão (notificar por e-mail).
 */
export function extractPolicy(body: unknown, defaults?: Partial<NotificacaoPolicy>): NotificacaoPolicy {
  const raw = (body as any)?.notificacao_policy;
  if (raw && typeof raw === "object") {
    return {
      notificar_cliente: Boolean(raw.notificar_cliente),
      canais: {
        email: Boolean(raw.canais?.email),
        whatsapp: Boolean(raw.canais?.whatsapp),
        portal: Boolean(raw.canais?.portal),
      },
      motivo_nao_notificar: raw.motivo_nao_notificar || null,
    };
  }
  return {
    notificar_cliente: defaults?.notificar_cliente ?? true,
    canais: defaults?.canais ?? { email: true, whatsapp: false, portal: true },
    motivo_nao_notificar: null,
  };
}