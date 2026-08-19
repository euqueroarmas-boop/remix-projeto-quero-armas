// qa-processo-set-modalidade
// Grava a MODALIDADE CAC do processo (colecionador / atirador / caçador) e
// ajusta o checklist na mesma tacada.
//
// Por que não passa por qa-processo-responder-pergunta: responder a pergunta
// apenas marcaria a linha como cumprida. A modalidade decide QUAIS exigências
// existem — filiação a entidade de tiro é do atirador e do caçador, o
// compromisso de habitualidade é só do atirador, o documento do Ibama é só do
// caçador. Quem faz esse ajuste é a RPC `qa_processo_definir_modalidade`, que
// remove o que não se aplica (sem tocar no que já foi entregue) e injeta o que
// passou a valer. É a mesma divisão de trabalho de qa-processo-set-condicao.
//
// Base normativa: IN DG/PF nº 311/2025, art. 18, § 2º, incisos I, II e IV.
//
// Segurança: exige JWT; libera para a equipe (staff ativo) ou para o cliente
// dono do processo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Modalidades CAC aceitas. Espelha os códigos ativos de `qa_modalidades`. */
const MODALIDADES = ["colecionador", "atirador", "cacador"] as const;
type Modalidade = (typeof MODALIDADES)[number];

/** Chave da resposta no questionário do processo. */
const CHAVE = "modalidade_cac";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice("Bearer ".length).trim();

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "invalid_token" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const processo_id = String(body?.processo_id || "");
    const modalidade = String(body?.modalidade || "").trim().toLowerCase() as Modalidade;
    if (!processo_id || !MODALIDADES.includes(modalidade)) {
      return json(
        { error: "missing_fields", detail: `processo_id e modalidade (${MODALIDADES.join("|")}) obrigatórios` },
        400,
      );
    }

    const admin = createClient(url, service);

    const [clienteRes, staffRes] = await Promise.all([
      admin.rpc("qa_current_cliente_id", { _uid: userId } as any),
      admin.rpc("qa_is_active_staff", { _uid: userId } as any),
    ]);
    const clienteIdUsuario = (clienteRes.data as number | null) ?? null;
    const isStaff = staffRes.data === true;

    const { data: proc, error: procErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id, modalidade, respostas_questionario_json")
      .eq("id", processo_id)
      .maybeSingle();
    if (procErr) return json({ error: procErr.message }, 500);
    if (!proc) return json({ error: "processo_not_found" }, 404);
    if (!isStaff && proc.cliente_id !== clienteIdUsuario) return json({ error: "forbidden" }, 403);

    // 1) A resposta entra ANTES no questionário: o trigger que guarda as
    //    perguntas-pivot recusa marcar a linha como cumprida sem a chave, e uma
    //    reexplosão do checklist recriaria a pergunta já respondida sem ela.
    //    Merge, nunca sobrescrita das demais chaves.
    const respostas =
      (proc.respostas_questionario_json as Record<string, unknown> | null) ?? {};
    const { error: upProcErr } = await admin
      .from("qa_processos")
      .update({ respostas_questionario_json: { ...respostas, [CHAVE]: modalidade } })
      .eq("id", processo_id);
    if (upProcErr) return json({ error: upProcErr.message }, 500);

    // 2) A RPC grava a modalidade no processo e acerta o checklist.
    const { data: ajuste, error: rpcErr } = await admin.rpc("qa_processo_definir_modalidade", {
      p_processo_id: processo_id,
      p_modalidade: modalidade,
    } as any);
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    // 3) A pergunta fica RESPONDIDA, não apagada — o cliente precisa poder ver
    //    o que escolheu, e a equipe precisa do rastro. `dispensado_grupo` é o
    //    status de pergunta cumprida (pergunta não é documento aprovado).
    const { error: upDocErr } = await admin
      .from("qa_processo_documentos")
      .update({
        status: "dispensado_grupo",
        observacoes: `Modalidade escolhida: ${modalidade.toUpperCase()} em ${new Date().toISOString()}`,
      })
      .eq("processo_id", processo_id)
      .eq("tipo_documento", "pergunta_modalidade_cac");
    if (upDocErr) return json({ error: upDocErr.message }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id,
      tipo_evento: "pergunta_respondida",
      descricao: `Modalidade CAC definida: ${modalidade.toUpperCase()}`,
      ator: isStaff ? "equipe" : "cliente",
      dados_json: {
        chave: CHAVE,
        valor: modalidade,
        anterior: proc.modalidade ?? null,
        ajuste: ajuste ?? null,
        via: "qa-processo-set-modalidade",
      },
    });

    return json({ ok: true, modalidade, ajuste: ajuste ?? null });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
