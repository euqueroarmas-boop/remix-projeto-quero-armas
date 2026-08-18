// ============================================================================
// qa-peca-enviar-cliente — a equipe devolve a petição para o cliente aprovar
// ----------------------------------------------------------------------------
// A peça gerada pela IA nunca chegava ao cliente. Ela é escrita, revisada e
// protocolada dentro da área da equipe, e o documento que sustenta o pedido —
// o que a Polícia Federal vai ler e que decide o processo — passava inteiro
// sem que o requerente visse uma linha.
//
// Aqui a equipe faz a devolução. A partir deste momento:
//   • a peça entra na fila do pop-up guiado do cliente;
//   • o processo NÃO pode virar `pronto_para_protocolar` até ele aprovar
//     (gate em qa-processo-checar-conclusao-checklist);
//   • o e-mail avisa, mas quem manda é a fila — o cliente age no guiado.
//
// Entrada (POST, staff): { geracao_id, processo_id }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

const corsHeaders = qaAuthCors;
const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const geracaoId = String((body as { geracao_id?: string })?.geracao_id ?? "").trim();
    const processoId = String((body as { processo_id?: string })?.processo_id ?? "").trim();
    if (!geracaoId || !processoId) {
      return json({ error: "geracao_id e processo_id são obrigatórios" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: peca } = await admin
      .from("qa_geracoes_pecas")
      .select("id, cliente_id, tipo_peca, titulo_geracao, minuta_gerada, status_cliente")
      .eq("id", geracaoId)
      .maybeSingle();
    if (!peca) return json({ error: "peca_not_found" }, 404);

    // Texto vazio não vai para aprovação: o cliente abriria a fila e não teria
    // o que ler — e o processo ficaria travado esperando um aceite impossível.
    const minuta = String((peca as { minuta_gerada?: string }).minuta_gerada ?? "").trim();
    if (minuta.length < 200) {
      return json({ error: "peca_sem_texto", minimo: 200 }, 400);
    }

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_nome")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    // A peça é de um cliente; o processo é de outro. Devolver assim mandaria a
    // petição de uma pessoa para a fila de outra.
    const clienteDaPeca = Number((peca as { cliente_id?: number }).cliente_id ?? 0);
    const clienteDoProcesso = Number((processo as { cliente_id: number }).cliente_id);
    if (clienteDaPeca && clienteDaPeca !== clienteDoProcesso) {
      return json(
        { error: "peca_de_outro_cliente", cliente_peca: clienteDaPeca, cliente_processo: clienteDoProcesso },
        409,
      );
    }

    const jaEnviada = String((peca as { status_cliente?: string }).status_cliente ?? "");
    if (jaEnviada === "aprovada") {
      return json({ ok: true, ja_aprovada: true, status_cliente: jaEnviada });
    }

    const agora = new Date().toISOString();
    const { error: upErr } = await admin
      .from("qa_geracoes_pecas")
      .update({
        processo_id: processoId,
        cliente_id: clienteDoProcesso,
        status_cliente: "aguardando_cliente",
        enviada_cliente_em: agora,
        enviada_cliente_por: guard.userId,
        // Reenvio depois de devolução: o motivo antigo sai da tela do cliente.
        devolucao_motivo: null,
        devolvida_em: null,
        updated_at: agora,
      })
      .eq("id", geracaoId);
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "peca_enviada_ao_cliente",
      descricao:
        `PETIÇÃO ENVIADA PARA APROVAÇÃO DO CLIENTE — ${String((peca as { titulo_geracao?: string }).titulo_geracao ?? "peça").toUpperCase()}`,
      ator: "equipe_operacional",
      dados_json: {
        geracao_id: geracaoId,
        tipo_peca: (peca as { tipo_peca?: string }).tipo_peca ?? null,
        reenvio: jaEnviada === "devolvida",
      },
    });

    // E-MAIL AVISA, O GUIADO É ONDE ELE AGE. Os dois, sempre.
    let emailOk: boolean | null = null;
    const { data: cliente } = await admin
      .from("qa_clientes")
      .select("nome_completo, email")
      .eq("id", clienteDoProcesso)
      .maybeSingle();
    const email = (cliente as { email?: string } | null)?.email;
    if (email) {
      try {
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const r = await sendTransactional({
          templateName: "peca-pronta-aprovacao",
          recipientEmail: email,
          idempotencyKey: `peca-envio-${geracaoId}-${agora.slice(0, 16)}`,
          templateData: {
            nome: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
            servico: (processo as { servico_nome?: string }).servico_nome ?? "",
            portalUrl: PORTAL_URL,
          },
        });
        emailOk = r.ok;
      } catch (e) {
        console.warn("[peca-enviar-cliente] e-mail falhou", e);
        emailOk = false;
      }
    }

    return json({ ok: true, status_cliente: "aguardando_cliente", email_cliente_ok: emailOk });
  } catch (e) {
    console.error("[qa-peca-enviar-cliente]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});
