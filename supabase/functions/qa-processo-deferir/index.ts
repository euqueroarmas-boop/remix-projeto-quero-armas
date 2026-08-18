// ============================================================================
// qa-processo-deferir — o fluxo finalmente termina entregando alguma coisa
// ----------------------------------------------------------------------------
// `deferido` era só um rótulo. Não havia e-mail, não havia entrega do
// documento, não havia baixa do serviço, não havia registro no Arsenal. Para um
// serviço chamado "Autorização de Compra", o produto final não tinha lugar no
// sistema: o cliente pagava, entregava documento por documento durante meses, e
// no fim via a palavra "Deferido" numa tela. O papel chegava por fora.
//
// Esta função fecha o ciclo em um ato:
//   1. amarra ao processo o documento do Hub que é o RESULTADO dele;
//   2. move o processo para `deferido`;
//   3. dá baixa no item da venda (data de deferimento + status);
//   4. entrega ao cliente — e-mail agora, fila do guiado até ele confirmar.
//
// O documento NÃO nasce aqui. Ele entra pelo Hub, com tipo `autorizacao_compra`
// ou `cr` e data de validade — que é o que o faz aparecer no Arsenal e entrar no
// monitoramento de vencimento que já existe. Autorização de compra vence, e
// vencida obriga a refazer o processo inteiro; deixar isso de fora seria
// entregar o papel e perder o prazo dele.
//
// Duas ações, dois atores:
//   acao=registrar            → equipe
//   acao=confirmar_recebimento → cliente (tira o passo da fila do guiado)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente";

/** Tipos do Hub que podem ser o resultado de um processo. */
const TIPOS_RESULTADO = new Set([
  "autorizacao_compra", "cr", "craf", "gte", "gt",
  "porte_arma", "registro_arma", "documento_complementar_caso",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hojeISOBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const processoId = String((body as { processo_id?: string })?.processo_id ?? "").trim();
    const acao = String((body as { acao?: string })?.acao ?? "registrar").trim();
    if (!processoId) return json({ error: "processo_id_obrigatorio" }, 400);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_id, servico_nome, venda_id, status, deferimento_documento_id, deferimento_visto_cliente_em")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);
    const clienteId = Number((processo as { cliente_id: number }).cliente_id);

    // ── Autenticação comum ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "nao_autenticado" }, 401);
    const token = authHeader.slice(7).trim();
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const authUserId = userData?.user?.id;
    if (!authUserId) return json({ error: "nao_autenticado" }, 401);

    const { data: staff } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil").eq("user_id", authUserId).eq("ativo", true).maybeSingle();
    const ehStaff = !!staff;

    // ── AÇÃO DO CLIENTE: confirmar que recebeu ──────────────────────────
    if (acao === "confirmar_recebimento") {
      let dono = ehStaff;
      if (!dono) {
        const { data: cli } = await admin
          .from("qa_clientes").select("user_id").eq("id", clienteId).maybeSingle();
        dono = (cli as { user_id?: string } | null)?.user_id === authUserId;
        if (!dono) {
          const { data: link } = await admin
            .from("cliente_auth_links")
            .select("qa_cliente_id")
            .eq("user_id", authUserId).eq("qa_cliente_id", clienteId).eq("status", "active")
            .maybeSingle();
          dono = !!link;
        }
      }
      if (!dono) return json({ error: "forbidden" }, 403);

      if ((processo as { deferimento_visto_cliente_em?: string }).deferimento_visto_cliente_em) {
        return json({ ok: true, ja_confirmado: true });
      }
      const agora = new Date().toISOString();
      await admin.from("qa_processos")
        .update({ deferimento_visto_cliente_em: agora, updated_at: agora })
        .eq("id", processoId);
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "deferimento_recebido_pelo_cliente",
        descricao: "CLIENTE CONFIRMOU O RECEBIMENTO DO DOCUMENTO DEFERIDO",
        ator: ehStaff ? "equipe_operacional" : "cliente",
        dados_json: {
          documento_id: (processo as { deferimento_documento_id?: string }).deferimento_documento_id ?? null,
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        },
      });
      return json({ ok: true, confirmado_em: agora });
    }

    // ── AÇÃO DA EQUIPE: registrar o deferimento ─────────────────────────
    if (acao !== "registrar") return json({ error: "acao_invalida" }, 400);
    if (!ehStaff) return json({ error: "forbidden" }, 403);

    const documentoId = String((body as { documento_id?: string })?.documento_id ?? "").trim();
    const numero = String((body as { numero?: string })?.numero ?? "").trim().toUpperCase();
    const dataInformada = String((body as { data_deferimento?: string })?.data_deferimento ?? "").trim();
    const dataDeferimento = /^\d{4}-\d{2}-\d{2}$/.test(dataInformada) ? dataInformada : hojeISOBRT();

    // O documento é o ponto todo. Sem ele isto vira de novo uma etiqueta.
    if (!documentoId) return json({ error: "documento_id_obrigatorio" }, 400);

    const { data: doc } = await admin
      .from("qa_documentos_cliente")
      .select("id, qa_cliente_id, tipo_documento, nome_documento, data_validade, status")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return json({ error: "documento_not_found" }, 404);

    // Documento de outro cliente entregaria a autorização de uma pessoa a outra.
    if (Number((doc as { qa_cliente_id?: number }).qa_cliente_id ?? 0) !== clienteId) {
      return json({ error: "documento_de_outro_cliente" }, 409);
    }
    const tipoDoc = String((doc as { tipo_documento: string }).tipo_documento).toLowerCase();
    if (!TIPOS_RESULTADO.has(tipoDoc)) {
      return json({ error: "tipo_de_documento_nao_e_resultado_de_processo", tipo: tipoDoc }, 409);
    }

    const agora = new Date().toISOString();
    const { error: upErr } = await admin
      .from("qa_processos")
      .update({
        status: "deferido",
        deferimento_documento_id: documentoId,
        deferimento_data: dataDeferimento,
        deferimento_numero: numero || null,
        deferimento_registrado_em: agora,
        deferimento_registrado_por: authUserId,
        // Registrar de novo (correção de data/documento) reabre a confirmação:
        // o cliente precisa ver o documento certo.
        deferimento_visto_cliente_em: null,
        updated_at: agora,
      })
      .eq("id", processoId);
    if (upErr) return json({ error: upErr.message }, 500);

    // ── BAIXA NO ITEM DA VENDA ──────────────────────────────────────────
    // `data_deferimento` é o que o motor de prazos lê para encerrar o item.
    // O `status` é validado por trigger contra o catálogo de status; se o
    // código mudar de nome, a gravação da data não pode cair junto.
    let baixaOk = false;
    let baixaAviso: string | null = null;
    try {
      const vendaId = (processo as { venda_id?: number | null }).venda_id ?? null;
      const servicoId = (processo as { servico_id?: number | null }).servico_id ?? null;
      if (!vendaId || !servicoId) {
        baixaAviso = "Processo sem venda/serviço: o item não recebeu baixa.";
      } else {
        const { data: venda } = await admin
          .from("qa_vendas").select("id, id_legado").eq("id", vendaId).maybeSingle();
        const v = venda as { id: number; id_legado?: number | null } | null;
        const fkVenda = v
          ? (typeof v.id_legado === "number" && Number.isFinite(v.id_legado) ? v.id_legado : v.id)
          : null;
        if (!fkVenda) {
          baixaAviso = "Venda do processo não encontrada: o item não recebeu baixa.";
        } else {
          const { data: comData, error: dataErr } = await admin
            .from("qa_itens_venda")
            .update({ data_deferimento: dataDeferimento })
            .eq("venda_id", fkVenda)
            .eq("servico_id", servicoId)
            .select("id");
          if (dataErr) {
            baixaAviso = `Baixa não lançada: ${dataErr.message}`;
          } else if (!comData || comData.length === 0) {
            baixaAviso = "Nenhum item desta venda corresponde ao serviço: baixa não lançada.";
          } else {
            baixaOk = true;
            // Best-effort separado: se o código de status não for aceito pelo
            // catálogo, a DATA já está gravada e o prazo já encerrou.
            const { error: stErr } = await admin
              .from("qa_itens_venda")
              .update({ status: "DEFERIDO" })
              .eq("venda_id", fkVenda)
              .eq("servico_id", servicoId);
            if (stErr) baixaAviso = `Data lançada, mas o status do item não: ${stErr.message}`;
          }
        }
      }
    } catch (e) {
      baixaAviso = `Baixa não lançada: ${e instanceof Error ? e.message : "erro"}`;
    }
    if (baixaAviso) console.warn("[processo-deferir]", baixaAviso);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "processo_deferido",
      descricao:
        `PROCESSO DEFERIDO${numero ? ` — Nº ${numero}` : ""} · DOCUMENTO ENTREGUE AO CLIENTE`,
      ator: "equipe_operacional",
      dados_json: {
        documento_id: documentoId,
        tipo_documento: tipoDoc,
        data_deferimento: dataDeferimento,
        numero: numero || null,
        validade_documento: (doc as { data_validade?: string }).data_validade ?? null,
        baixa_venda_ok: baixaOk,
        baixa_aviso: baixaAviso,
      },
    });

    // ── AVISO AO CLIENTE ────────────────────────────────────────────────
    let emailOk: boolean | null = null;
    try {
      const { data: cliente } = await admin
        .from("qa_clientes").select("nome_completo, email").eq("id", clienteId).maybeSingle();
      const email = (cliente as { email?: string } | null)?.email;
      if (email) {
        const validade = (doc as { data_validade?: string }).data_validade ?? null;
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const r = await sendTransactional({
          templateName: "processo-deferido",
          recipientEmail: email,
          idempotencyKey: `deferido-${processoId}-${documentoId}`,
          templateData: {
            nome: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
            servico: (processo as { servico_nome?: string }).servico_nome ?? "",
            documento: (doc as { nome_documento?: string }).nome_documento ?? tipoDoc.replace(/_/g, " "),
            numero: numero || "",
            dataDeferimento: dataDeferimento.split("-").reverse().join("/"),
            validade: validade ? validade.split("-").reverse().join("/") : "",
            portalUrl: PORTAL_URL,
          },
        });
        emailOk = r.ok;
      }
    } catch (e) {
      console.warn("[processo-deferir] e-mail ao cliente falhou", e);
      emailOk = false;
    }

    return json({
      ok: true,
      status: "deferido",
      documento_id: documentoId,
      data_deferimento: dataDeferimento,
      baixa_venda_ok: baixaOk,
      baixa_aviso: baixaAviso,
      email_cliente_ok: emailOk,
    });
  } catch (e) {
    console.error("[qa-processo-deferir]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});
