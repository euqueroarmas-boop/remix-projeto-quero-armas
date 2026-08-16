// ============================================================================
// qa-recurso-aprovar — o cliente confirma que os fatos são dele
// ----------------------------------------------------------------------------
// O relato do recurso é escrito na voz do cliente. Antes de virar peça e entrar
// na delegacia, ele precisa ler e dizer "é isso mesmo" — porque recurso
// protocolado com fato errado não se conserta: vira parte do processo e a
// próxima autoridade lê aquilo.
//
// ── POR QUE UMA EDGE E NÃO UM UPDATE DIRETO ─────────────────────────────────
// RLS não restringe coluna. Dar UPDATE ao cliente na tabela daria a ele o
// direito de mexer em status, datas e número de protocolo — coisas que são da
// equipe. Aqui ele só consegue fazer uma coisa: aprovar o texto que é dele,
// com ou sem edição.
//
// ── APROVOU, VAI PARA A EQUIPE NO MESMO ATO ─────────────────────────────────
// Não existe estado "aprovado e parado": aprovação sem aviso é aprovação que
// ninguém vê, e o prazo de 10 dias corre igual. O e-mail sai no mesmo passo, e
// o processo fica marcado como aguardando a equipe protocolar.
//
// A EDIÇÃO DO CLIENTE É PRESERVADA COMO VEIO. Se ele corrigiu uma data ou o
// nome de uma rua, foi porque o texto estava errado — quem viveu o fato é ele.
// Nada de "normalizar" o que ele escreveu.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TEAM_EMAIL = "eu@queroarmas.com.br";
const ADMIN_BASE = "https://www.euqueroarmas.com.br/quero-armas/processos";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const body = await req.json().catch(() => ({}));
    const recursoId = String((body as { recurso_id?: string })?.recurso_id ?? "").trim();
    const textoEditado = String((body as { texto?: string })?.texto ?? "");
    if (!recursoId) return json({ error: "recurso_id_obrigatorio" }, 400);

    const { data: recurso } = await admin
      .from("qa_processo_recursos")
      .select("id, processo_id, status, narrativa_gerada, narrativa_final")
      .eq("id", recursoId)
      .maybeSingle();
    if (!recurso) return json({ error: "recurso_not_found" }, 404);

    const processoId = String((recurso as { processo_id: string }).processo_id);
    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_nome, status")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);
    const clienteId = (processo as { cliente_id: number }).cliente_id;

    // ── Autorização: dono do processo ou staff ativo ────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "nao_autenticado" }, 401);
    const token = authHeader.slice(7).trim();
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const authUserId = userData?.user?.id;
    if (!authUserId) return json({ error: "nao_autenticado" }, 401);

    let autorizado = false;
    let aprovadoPeloCliente = false;
    const { data: staff } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil").eq("user_id", authUserId).eq("ativo", true).maybeSingle();
    if (staff) autorizado = true;
    if (!autorizado) {
      const { data: cli } = await admin
        .from("qa_clientes").select("user_id").eq("id", clienteId).maybeSingle();
      if ((cli as { user_id?: string } | null)?.user_id === authUserId) {
        autorizado = true;
        aprovadoPeloCliente = true;
      }
      if (!autorizado) {
        const { data: link } = await admin
          .from("cliente_auth_links")
          .select("qa_cliente_id")
          .eq("user_id", authUserId).eq("qa_cliente_id", clienteId).eq("status", "active")
          .maybeSingle();
        if (link) { autorizado = true; aprovadoPeloCliente = true; }
      }
    }
    if (!autorizado) return json({ error: "forbidden" }, 403);

    // Idempotente: aprovar de novo não reenvia e-mail nem reescreve a data.
    const statusAtual = String((recurso as { status: string }).status);
    if (["aprovado", "enviado_equipe", "protocolado"].includes(statusAtual)) {
      return json({ ok: true, ja_aprovado: true, status: statusAtual });
    }

    const gerada = String((recurso as { narrativa_gerada?: string }).narrativa_gerada ?? "");
    const final = textoEditado.trim() ? textoEditado : gerada;
    if (final.trim().length < 200) {
      return json({ error: "texto_curto_demais", minimo: 200 }, 400);
    }
    const editada = final.trim() !== gerada.trim();
    const agora = new Date().toISOString();

    const { error: upErr } = await admin
      .from("qa_processo_recursos")
      .update({
        narrativa_final: final,
        editada_pelo_cliente: editada && aprovadoPeloCliente,
        aprovado_em: agora,
        aprovado_por: authUserId,
        // Aprovou = já foi para a equipe. Não existe "aprovado e parado".
        status: "enviado_equipe",
        enviado_equipe_em: agora,
        updated_at: agora,
      })
      .eq("id", recursoId);
    if (upErr) {
      console.error("[recurso-aprovar] update falhou", upErr);
      return json({ error: upErr.message }, 500);
    }

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "recurso_aprovado_pelo_cliente",
      descricao:
        `Cliente aprovou o relato do recurso${editada ? " COM edições próprias" : " sem alterações"}. ` +
        "Pronto para a equipe redigir a peça e protocolar.",
      ator: aprovadoPeloCliente ? "cliente" : "equipe_operacional",
      dados_json: { recurso_id: recursoId, editada_pelo_cliente: editada, caracteres: final.length },
    });

    // ── E-MAIL À EQUIPE ────────────────────────────────────────────────
    // O prazo é de 10 dias e corre contra o processo. Aprovação que fica
    // esperando alguém abrir o admin é aprovação perdida.
    let emailOk: boolean | null = null;
    try {
      const { data: cliente } = await admin
        .from("qa_clientes").select("nome_completo, cpf").eq("id", clienteId).maybeSingle();
      const { sendTransactional } = await import("../_shared/sendTransactional.ts");
      const r = await sendTransactional({
        templateName: "recurso-aprovado-equipe",
        recipientEmail: TEAM_EMAIL,
        idempotencyKey: `recurso-aprovado-${recursoId}`,
        templateData: {
          nomeCliente: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
          cpf: (cliente as { cpf?: string } | null)?.cpf ?? "",
          servico: (processo as { servico_nome?: string }).servico_nome ?? "",
          editadoPeloCliente: editada,
          adminUrl: `${ADMIN_BASE}?processo=${processoId}`,
        },
      });
      emailOk = r.ok;
    } catch (e) {
      console.warn("[recurso-aprovar] e-mail à equipe falhou", e);
      emailOk = false;
    }

    return json({
      ok: true,
      status: "enviado_equipe",
      editada_pelo_cliente: editada,
      email_equipe_ok: emailOk,
    });
  } catch (e) {
    console.error("[qa-recurso-aprovar]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});
