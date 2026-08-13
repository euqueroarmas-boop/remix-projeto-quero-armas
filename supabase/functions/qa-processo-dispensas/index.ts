// ============================================================================
// qa-processo-dispensas
// ----------------------------------------------------------------------------
// Aplica a matriz "Categoria × Exigência" (public.qa_regras_categoria) sobre o
// checklist de um processo.
//
//   action = "aplicar" → marca como dispensadas as exigências dos grupos que a
//     matriz dispensa para a categoria/corporação do titular, gravando a base
//     legal em regra_validacao.dispensa (o carimbo lido pelo cliente).
//     Nunca toca em documento já entregue, aprovado ou em análise.
//
//   action = "ciente"  → o cliente clicou AVANÇAR no passo dispensado; marca
//     regra_validacao.dispensa.ciente = true para o passo sair da fila.
//
// Idempotente: pode ser chamada a cada abertura do portal.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { grupoDaPendencia } from "../_shared/pendenciasGrupos.ts";
import { resolverRegra, registroDoTitular, type RegraCategoria } from "../_shared/regrasCategoria.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Status que já representam entrega/entrada em análise — intocáveis. */
const INTOCAVEIS = new Set([
  "aprovado", "validado", "concluido", "em_analise", "enviado",
  // Entrega feita pelo cliente PELO HUB durante o processo: é entrega, não
  // reuso — nunca pode ser dispensada por esta rotina.
  "entregue_pelo_hub",
  "revisao_humana", "em_revisao_humana", "substituido",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const supabase = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const processo_id: string | undefined = body?.processo_id;
    const action: string = String(body?.action || "aplicar");
    if (!processo_id) return json({ error: "processo_id obrigatório" }, 400);

    const { data: processo } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, servico_id")
      .eq("id", processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    // Permissão: staff QA OU cliente dono do processo.
    const { data: staffRow } = await supabase
      .from("qa_usuarios_perfis").select("perfil")
      .eq("user_id", userId).eq("ativo", true).maybeSingle();
    if (!staffRow) {
      const { data: link } = await supabase
        .from("cliente_auth_links").select("qa_cliente_id")
        .eq("user_id", userId).eq("qa_cliente_id", processo.cliente_id).maybeSingle();
      if (!link) return json({ error: "Sem permissão para este processo" }, 403);
    }

    // ─── action: ciente ───
    if (action === "ciente") {
      const doc_id: string | undefined = body?.documento_id;
      if (!doc_id) return json({ error: "documento_id obrigatório" }, 400);
      const { data: doc } = await supabase
        .from("qa_processo_documentos")
        .select("id, regra_validacao")
        .eq("id", doc_id).eq("processo_id", processo_id).maybeSingle();
      if (!doc) return json({ error: "Documento não encontrado" }, 404);
      const rv = (doc.regra_validacao ?? {}) as Record<string, unknown>;
      const dispensa = { ...((rv.dispensa ?? {}) as Record<string, unknown>), ciente: true, ciente_em: new Date().toISOString() };
      await supabase.from("qa_processo_documentos")
        .update({ regra_validacao: { ...rv, dispensa } })
        .eq("id", doc_id);
      return json({ success: true });
    }

    // ─── action: aplicar ───
    const { data: cliente } = await supabase
      .from("qa_clientes")
      .select("id, categoria_titular, subcategoria, profissao")
      .eq("id", processo.cliente_id)
      .maybeSingle();

    const categoria = String((cliente as any)?.categoria_titular ?? "").trim().toLowerCase();
    const corporacao = String((cliente as any)?.subcategoria ?? "").trim() || null;
    if (!categoria) return json({ success: true, aplicados: 0, motivo: "sem_categoria" });

    const { data: regrasRaw } = await supabase
      .from("qa_regras_categoria")
      .select("*")
      .eq("ativo", true);
    const regras = (regrasRaw ?? []) as RegraCategoria[];
    const ctx = { servicoId: processo.servico_id, categoria, corporacao };
    const registro = registroDoTitular(regras, ctx);

    if (regras.length === 0) {
      return json({ success: true, aplicados: 0, registro: registro.sistema, motivo: "matriz_vazia" });
    }

    const { data: docs } = await supabase
      .from("qa_processo_documentos")
      .select("id, tipo_documento, nome_documento, status, obrigatorio, regra_validacao, arquivo_storage_key")
      .eq("processo_id", processo_id);

    let aplicados = 0;
    for (const d of (docs ?? []) as any[]) {
      const st = String(d.status ?? "").toLowerCase();
      if (INTOCAVEIS.has(st)) continue;
      if (d.arquivo_storage_key) continue;
      const rv = (d.regra_validacao ?? {}) as Record<string, any>;
      if (rv?.tipo === "pergunta") continue;
      if (rv?.dispensa?.base_legal) continue; // já carimbado

      const grupo = grupoDaPendencia(d.tipo_documento, null);
      const r = resolverRegra(regras, ctx, grupo.id, d.tipo_documento);
      if (r.modo !== "dispensado") continue;

      await supabase.from("qa_processo_documentos")
        .update({
          status: "dispensado_grupo",
          regra_validacao: {
            ...rv,
            dispensa: {
              base_legal: r.base_legal,
              categoria,
              corporacao,
              grupo: grupo.id,
              grupo_label: grupo.label,
              aplicada_em: new Date().toISOString(),
              ciente: false,
            },
          },
        })
        .eq("id", d.id);
      aplicados++;
    }

    if (aplicados > 0) {
      await supabase.from("qa_processo_eventos").insert({
        processo_id,
        tipo_evento: "dispensas_categoria_aplicadas",
        descricao: `${aplicados} exigência(s) dispensada(s) por lei conforme a categoria ${categoria.toUpperCase()}.`,
        dados_json: { categoria, corporacao, aplicados },
        ator: staffRow ? "staff" : "cliente",
        user_id: userId,
      });
    }

    return json({ success: true, aplicados, registro: registro.sistema, registro_base_legal: registro.base_legal });
  } catch (e: any) {
    console.error("qa-processo-dispensas:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
