// ============================================================================
// notificarExigenciaPF — a equipe fica sabendo quando o cliente responde a PF
// ----------------------------------------------------------------------------
// Furo medido em 18/08/2026: quando a Polícia Federal notifica ou indefere,
// correm 10 dias e o requerimento é arquivado se ninguém responder. O cliente
// cumprir a exigência é o momento em que a bola volta para a equipe — e esse
// momento era INVISÍVEL.
//
// O e-mail `exigencia-cumprida` existia no sistema, mas só era disparado por
// `Etapa4Salvar.tsx`, o assistente de pré-piloto. O fluxo real — cliente sobe o
// documento no portal, IA valida, equipe aprova — nunca o acionava. A equipe só
// descobria abrindo o admin por acaso, com o prazo correndo.
//
// Aqui há dois avisos, e eles respondem a perguntas diferentes:
//
//   avisarEntregaExigenciaPF  → "chegou um documento que a PF pediu"
//                               Dispara no UPLOAD, antes da validação. É o
//                               sinal de que o cliente reagiu.
//
//   avisarCumprimentoExigenciaPF → "a notificação foi respondida por inteiro"
//                               Dispara quando o ÚLTIMO item daquela
//                               manifestação é cumprido. É o gatilho para
//                               devolver o material à delegacia.
//
// Ambos são best-effort: nenhum deles pode derrubar o upload ou a validação.
// Um e-mail que falha é um aviso perdido; um upload que falha é o cliente
// perdendo o prazo.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEAM_EMAIL = "eu@queroarmas.com.br";
const ADMIN_BASE = "https://www.euqueroarmas.com.br/quero-armas/processos";

/** Status em que a exigência já está satisfeita e não cobra mais nada. */
const CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "concluído",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento",
  "entregue_pelo_hub", "nao_aplicavel", "hub_reaproveitado",
]);

interface DocLinha {
  id: string;
  tipo_documento: string | null;
  nome_documento: string | null;
  status: string | null;
  regra_validacao: Record<string, unknown> | null;
}

/** A linha nasceu de uma manifestação da PF? */
export function ehExigenciaDaPF(regra: unknown): boolean {
  const r = (regra ?? {}) as Record<string, unknown>;
  return r.origem === "manifestacao_pf" || r.grupo_checklist === "exigencias_pf";
}

function rotulo(d: Pick<DocLinha, "nome_documento" | "tipo_documento">): string {
  return (
    d.nome_documento ||
    String(d.tipo_documento ?? "").replace(/_/g, " ") ||
    "documento"
  );
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Contexto comum aos dois avisos. Devolve null quando não é exigência da PF. */
async function montarContexto(
  admin: SupabaseClient,
  processoId: string,
  documentoId: string,
) {
  const { data: doc } = await admin
    .from("qa_processo_documentos")
    .select("id, tipo_documento, nome_documento, status, regra_validacao")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc || !ehExigenciaDaPF((doc as DocLinha).regra_validacao)) return null;

  const regra = ((doc as DocLinha).regra_validacao ?? {}) as Record<string, unknown>;
  const manifestacaoId = regra.manifestacao_id ? String(regra.manifestacao_id) : null;

  const { data: processo } = await admin
    .from("qa_processos")
    .select("id, cliente_id, servico_nome")
    .eq("id", processoId)
    .maybeSingle();
  if (!processo) return null;

  const { data: cliente } = await admin
    .from("qa_clientes")
    .select("nome_completo, cpf, email")
    .eq("id", (processo as { cliente_id: number }).cliente_id)
    .maybeSingle();

  // Irmãs da MESMA manifestação. Sem o id (exigência antiga), cai para todas as
  // exigências da PF do processo — melhor cobrir demais que avisar de menos.
  const { data: irmasRaw } = await admin
    .from("qa_processo_documentos")
    .select("id, tipo_documento, nome_documento, status, regra_validacao")
    .eq("processo_id", processoId);

  const irmas = ((irmasRaw ?? []) as DocLinha[]).filter((d) => {
    if (!ehExigenciaDaPF(d.regra_validacao)) return false;
    if (!manifestacaoId) return true;
    return String((d.regra_validacao as Record<string, unknown>)?.manifestacao_id ?? "") === manifestacaoId;
  });

  let prazoLimite: string | null = null;
  let delegado: string | null = null;
  if (manifestacaoId) {
    const { data: m } = await admin
      .from("qa_processo_manifestacoes_pf")
      .select("prazo_limite, delegado_nome, unidade_pf")
      .eq("id", manifestacaoId)
      .maybeSingle();
    prazoLimite = (m as { prazo_limite?: string } | null)?.prazo_limite ?? null;
    delegado =
      (m as { delegado_nome?: string } | null)?.delegado_nome ??
      (m as { unidade_pf?: string } | null)?.unidade_pf ??
      null;
  }
  delegado = delegado ?? (regra.delegado_nome ? String(regra.delegado_nome) : null);

  return {
    doc: doc as DocLinha,
    processo: processo as { id: string; cliente_id: number; servico_nome: string | null },
    cliente: cliente as { nome_completo?: string; cpf?: string; email?: string } | null,
    manifestacaoId,
    irmas,
    prazoLimite,
    delegado,
  };
}

/**
 * O cliente acabou de subir um documento que a PF pediu.
 *
 * `chaveExtra` deve variar a cada envio (usamos o caminho no storage), senão um
 * reenvio depois de recusa não avisa ninguém — que é exatamente quando avisar
 * mais importa.
 */
export async function avisarEntregaExigenciaPF(args: {
  admin: SupabaseClient;
  processoId: string;
  documentoId: string;
  chaveExtra: string;
}): Promise<{ notificado: boolean; motivo?: string }> {
  try {
    const ctx = await montarContexto(args.admin, args.processoId, args.documentoId);
    if (!ctx) return { notificado: false, motivo: "nao_e_exigencia_pf" };

    const pendentes = ctx.irmas.filter(
      (d) => d.id !== ctx.doc.id && !CUMPRIDO.has(String(d.status ?? "").toLowerCase()),
    );

    const { sendTransactional } = await import("./sendTransactional.ts");
    const r = await sendTransactional({
      templateName: "exigencia-pf-respondida",
      recipientEmail: TEAM_EMAIL,
      idempotencyKey: `exig-pf-entrega-${args.documentoId}-${args.chaveExtra}`,
      templateData: {
        nomeCliente: ctx.cliente?.nome_completo ?? "cliente",
        cpf: ctx.cliente?.cpf ?? "",
        servico: ctx.processo.servico_nome ?? "",
        exigencia: rotulo(ctx.doc),
        delegado: ctx.delegado ?? "",
        prazoLimite: dataBR(ctx.prazoLimite),
        pendentes: pendentes.length
          ? pendentes.map((d) => rotulo(d)).join(" · ")
          : "Nada",
        completo: false,
        adminUrl: `${ADMIN_BASE}?processo=${args.processoId}`,
      },
    });

    await args.admin.from("qa_processo_eventos").insert({
      processo_id: args.processoId,
      documento_id: args.documentoId,
      tipo_evento: "exigencia_pf_respondida",
      descricao:
        `CLIENTE RESPONDEU À PF — ${rotulo(ctx.doc).toUpperCase()}` +
        (pendentes.length ? ` · AINDA FALTAM ${pendentes.length}` : " · ÚLTIMO ITEM"),
      ator: "cliente",
      dados_json: {
        manifestacao_id: ctx.manifestacaoId,
        pendentes: pendentes.map((d) => d.tipo_documento),
        email_equipe_ok: r.ok,
      },
    });

    return { notificado: r.ok };
  } catch (e) {
    console.warn("[notificarExigenciaPF] entrega falhou:", e);
    return { notificado: false, motivo: "erro" };
  }
}

/**
 * A exigência foi APROVADA. Se era a última daquela manifestação, a equipe pode
 * devolver o material à delegacia — e o cliente merece saber que acabou.
 */
export async function avisarCumprimentoExigenciaPF(args: {
  admin: SupabaseClient;
  processoId: string;
  documentoId: string;
}): Promise<{ completo: boolean; notificado: boolean }> {
  try {
    const ctx = await montarContexto(args.admin, args.processoId, args.documentoId);
    if (!ctx) return { completo: false, notificado: false };

    const pendentes = ctx.irmas.filter(
      (d) => !CUMPRIDO.has(String(d.status ?? "").toLowerCase()),
    );
    // Ainda falta gente: o aviso de entrega já saiu no upload, não repetimos.
    if (pendentes.length > 0) return { completo: false, notificado: false };

    const { sendTransactional } = await import("./sendTransactional.ts");
    const chave = ctx.manifestacaoId ?? `proc-${args.processoId}`;

    const equipe = await sendTransactional({
      templateName: "exigencia-pf-respondida",
      recipientEmail: TEAM_EMAIL,
      idempotencyKey: `exig-pf-completa-${chave}`,
      templateData: {
        nomeCliente: ctx.cliente?.nome_completo ?? "cliente",
        cpf: ctx.cliente?.cpf ?? "",
        servico: ctx.processo.servico_nome ?? "",
        exigencia: ctx.irmas.map((d) => rotulo(d)).join(" · "),
        delegado: ctx.delegado ?? "",
        prazoLimite: dataBR(ctx.prazoLimite),
        pendentes: "Nada",
        completo: true,
        adminUrl: `${ADMIN_BASE}?processo=${args.processoId}`,
      },
    });

    // O cliente também é avisado — pelo canal de sempre, com o evento que já
    // existia e nunca era usado no fluxo real.
    if (ctx.cliente?.email) {
      try {
        await args.admin.functions.invoke("qa-notify-event", {
          body: {
            evento: "exigencia_cumprida",
            cliente_id: ctx.processo.cliente_id,
            payload: {
              processo: ctx.processo.servico_nome ?? "",
              exigencia: ctx.irmas.map((d) => rotulo(d)).join(" · "),
            },
          },
        });
      } catch (e) {
        console.warn("[notificarExigenciaPF] aviso ao cliente falhou:", e);
      }
    }

    await args.admin.from("qa_processo_eventos").insert({
      processo_id: args.processoId,
      tipo_evento: "manifestacao_pf_cumprida",
      descricao:
        "TODAS AS EXIGÊNCIAS DESTA NOTIFICAÇÃO DA PF FORAM CUMPRIDAS — PRONTO PARA DEVOLVER À DELEGACIA",
      ator: "sistema_auto",
      dados_json: {
        manifestacao_id: ctx.manifestacaoId,
        itens: ctx.irmas.map((d) => d.tipo_documento),
        email_equipe_ok: equipe.ok,
      },
    });

    return { completo: true, notificado: equipe.ok };
  } catch (e) {
    console.warn("[notificarExigenciaPF] cumprimento falhou:", e);
    return { completo: false, notificado: false };
  }
}
