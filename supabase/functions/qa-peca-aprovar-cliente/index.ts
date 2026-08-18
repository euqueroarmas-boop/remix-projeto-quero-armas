// ============================================================================
// qa-peca-aprovar-cliente — o cliente lê a própria petição e decide
// ----------------------------------------------------------------------------
// Petição protocolada com fato errado não se conserta. Ela vira parte do
// processo, e a autoridade seguinte lê aquilo — inclusive a data trocada, o
// nome da rua errado, o número de boletim que não é o dele.
//
// Nos indeferimentos reais que analisamos, dois motivos não tinham nada a ver
// com mérito: divergência de nome e de endereço entre o que foi declarado e o
// que os documentos diziam. Quem pega isso é o cliente, não o revisor.
//
// ── POR QUE UMA EDGE E NÃO UM UPDATE DIRETO ─────────────────────────────────
// RLS não restringe coluna. Dar UPDATE ao cliente em `qa_geracoes_pecas` daria
// a ele o direito de mexer em `status_revisao`, `score_confianca` e nos
// fundamentos usados — coisas da equipe. Aqui ele consegue exatamente duas:
// aprovar o texto que é dele, ou devolvê-lo com um motivo.
//
// ── A EDIÇÃO DELE É PRESERVADA COMO VEIO ────────────────────────────────────
// Se corrigiu uma data ou o nome de uma rua, foi porque estava errado. Nada de
// "normalizar" o que ele escreveu.
//
// Entrada (POST, dono do processo ou staff):
//   { geracao_id, acao: "aprovar" | "devolver", texto?, motivo? }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEAM_EMAIL = "eu@queroarmas.com.br";
const ADMIN_BASE = "https://www.euqueroarmas.com.br/quero-armas/processos";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const geracaoId = String((body as { geracao_id?: string })?.geracao_id ?? "").trim();
    const acao = String((body as { acao?: string })?.acao ?? "aprovar").trim();
    const textoEditado = String((body as { texto?: string })?.texto ?? "");
    const motivo = String((body as { motivo?: string })?.motivo ?? "").trim().slice(0, 1000);

    if (!geracaoId) return json({ error: "geracao_id_obrigatorio" }, 400);
    if (acao !== "aprovar" && acao !== "devolver") {
      return json({ error: "acao deve ser 'aprovar' ou 'devolver'" }, 400);
    }
    if (acao === "devolver" && motivo.length < 5) {
      return json({ error: "diga o que precisa mudar", minimo: 5 }, 400);
    }

    const { data: peca } = await admin
      .from("qa_geracoes_pecas")
      .select("id, cliente_id, processo_id, status_cliente, minuta_gerada, texto_final, titulo_geracao, tipo_peca")
      .eq("id", geracaoId)
      .maybeSingle();
    if (!peca) return json({ error: "peca_not_found" }, 404);

    const clienteId = Number((peca as { cliente_id?: number }).cliente_id ?? 0);
    const processoId = (peca as { processo_id?: string }).processo_id ?? null;

    // ── Autorização: dono do processo ou staff ──────────────────────────
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
    let ehCliente = false;
    const { data: staff } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil").eq("user_id", authUserId).eq("ativo", true).maybeSingle();
    if (staff) autorizado = true;
    if (!autorizado && clienteId) {
      const { data: cli } = await admin
        .from("qa_clientes").select("user_id").eq("id", clienteId).maybeSingle();
      if ((cli as { user_id?: string } | null)?.user_id === authUserId) {
        autorizado = true; ehCliente = true;
      }
      if (!autorizado) {
        const { data: link } = await admin
          .from("cliente_auth_links")
          .select("qa_cliente_id")
          .eq("user_id", authUserId).eq("qa_cliente_id", clienteId).eq("status", "active")
          .maybeSingle();
        if (link) { autorizado = true; ehCliente = true; }
      }
    }
    if (!autorizado) return json({ error: "forbidden" }, 403);

    const statusAtual = String((peca as { status_cliente?: string }).status_cliente ?? "");
    // Idempotente: aprovar de novo não reenvia e-mail nem reescreve a data.
    if (statusAtual === "aprovada") {
      return json({ ok: true, ja_aprovada: true, status_cliente: statusAtual });
    }
    if (statusAtual !== "aguardando_cliente") {
      return json({ error: "peca_nao_esta_com_o_cliente", status_cliente: statusAtual }, 409);
    }

    const agora = new Date().toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ?? null;
    const ua = req.headers.get("user-agent");
    const idioma = req.headers.get("accept-language");

    // ── DEVOLVER ────────────────────────────────────────────────────────
    if (acao === "devolver") {
      const { error } = await admin
        .from("qa_geracoes_pecas")
        .update({
          status_cliente: "devolvida",
          devolucao_motivo: motivo,
          devolvida_em: agora,
          updated_at: agora,
        })
        .eq("id", geracaoId);
      if (error) return json({ error: error.message }, 500);

      if (processoId) {
        await admin.from("qa_processo_eventos").insert({
          processo_id: processoId,
          tipo_evento: "peca_devolvida_pelo_cliente",
          descricao: `CLIENTE PEDIU AJUSTE NA PETIÇÃO — ${motivo.toUpperCase()}`,
          ator: ehCliente ? "cliente" : "equipe_operacional",
          dados_json: { geracao_id: geracaoId, motivo },
        });
      }

      await notificarEquipe(admin, {
        geracaoId, processoId, clienteId, motivo, aprovada: false, editada: false,
      });
      return json({ ok: true, status_cliente: "devolvida" });
    }

    // ── APROVAR ─────────────────────────────────────────────────────────
    const gerada = String((peca as { minuta_gerada?: string }).minuta_gerada ?? "");
    const final = textoEditado.trim() ? textoEditado : gerada;
    if (final.trim().length < 200) {
      return json({ error: "texto_curto_demais", minimo: 200 }, 400);
    }
    const editada = final.trim() !== gerada.trim();
    const hash = await sha256Hex(final);

    const { error } = await admin
      .from("qa_geracoes_pecas")
      .update({
        texto_final: final,
        editada_pelo_cliente: editada && ehCliente,
        status_cliente: "aprovada",
        aprovada_cliente_em: agora,
        aprovacao_ip: ip,
        aprovacao_user_agent: ua,
        aprovacao_accept_language: idioma,
        aprovacao_hash: hash,
        devolucao_motivo: null,
        updated_at: agora,
      })
      .eq("id", geracaoId);
    if (error) return json({ error: error.message }, 500);

    if (processoId) {
      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "peca_aprovada_pelo_cliente",
        descricao:
          `CLIENTE APROVOU A PETIÇÃO${editada ? " COM EDIÇÕES PRÓPRIAS" : " SEM ALTERAÇÕES"}`,
        ator: ehCliente ? "cliente" : "equipe_operacional",
        dados_json: {
          geracao_id: geracaoId,
          editada_pelo_cliente: editada,
          caracteres: final.length,
          hash_sha256: hash,
          ip,
        },
      });

      // Aprovou: o gate do protocolo caiu. Checa se o processo já pode andar.
      try {
        const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
        await admin.functions.invoke("qa-processo-checar-conclusao-checklist", {
          headers: { "x-internal-token": internalToken },
          body: { processo_id: processoId, origem: "peca_aprovada" },
        });
      } catch (e) { console.warn("[peca-aprovar] checar-conclusao falhou", e); }
    }

    const emailOk = await notificarEquipe(admin, {
      geracaoId, processoId, clienteId, motivo: null, aprovada: true, editada,
    });

    return json({
      ok: true,
      status_cliente: "aprovada",
      editada_pelo_cliente: editada,
      email_equipe_ok: emailOk,
    });
  } catch (e) {
    console.error("[qa-peca-aprovar-cliente]", e);
    return json({ error: e instanceof Error ? e.message : "erro_interno" }, 500);
  }
});

/**
 * Avisa a equipe. Não existe "aprovado e parado": aprovação que ninguém vê é
 * aprovação perdida, e o processo fica esperando alguém abrir o admin.
 */
async function notificarEquipe(
  admin: ReturnType<typeof createClient>,
  args: {
    geracaoId: string;
    processoId: string | null;
    clienteId: number;
    motivo: string | null;
    aprovada: boolean;
    editada: boolean;
  },
): Promise<boolean | null> {
  try {
    const { data: cliente } = await admin
      .from("qa_clientes").select("nome_completo, cpf").eq("id", args.clienteId).maybeSingle();
    const { data: processo } = args.processoId
      ? await admin.from("qa_processos").select("servico_nome").eq("id", args.processoId).maybeSingle()
      : { data: null };

    const { sendTransactional } = await import("../_shared/sendTransactional.ts");
    const r = await sendTransactional({
      templateName: "peca-decidida-equipe",
      recipientEmail: TEAM_EMAIL,
      idempotencyKey: `peca-${args.aprovada ? "aprovada" : "devolvida"}-${args.geracaoId}`,
      templateData: {
        nomeCliente: (cliente as { nome_completo?: string } | null)?.nome_completo ?? "cliente",
        cpf: (cliente as { cpf?: string } | null)?.cpf ?? "",
        servico: (processo as { servico_nome?: string } | null)?.servico_nome ?? "",
        aprovada: args.aprovada,
        editada: args.editada,
        motivo: args.motivo ?? "",
        adminUrl: args.processoId ? `${ADMIN_BASE}?processo=${args.processoId}` : ADMIN_BASE,
      },
    });
    return r.ok;
  } catch (e) {
    console.warn("[peca-aprovar-cliente] e-mail à equipe falhou", e);
    return false;
  }
}
