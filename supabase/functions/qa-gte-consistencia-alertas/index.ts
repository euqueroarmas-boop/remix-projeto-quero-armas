// ============================================================================
// qa-gte-consistencia-alertas
// ----------------------------------------------------------------------------
// Motor de CONSISTÊNCIA de GTE (independente do motor de PRAZOS).
// Detecta:
//   - origem/destino ausente
//   - datas incompatíveis (validade < emissão OU emissão futura)
//   - GTE sem vínculo com evento/treino/competição/manutenção/exposição
//   - GTE vinculada a arma errada (matching_status='divergente')
//   - GTE fora do período útil (janela emissão→validade não abrange hoje)
//
// dry_run=true por padrão. Envio via sendTransactional -> gte-inconsistente.
// Dedupe em qa_gte_consistencia_alertas_enviados (hash_estado).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL_URL = "https://euqueroarmas.com.br/area-do-cliente";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function sha1Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toBrDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00-03:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

interface Candidato {
  cliente_id: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  gte_documento_id: string;
  numero_gte: string | null;
  divergencia_tipo: string;
  motivo: string;
  origem: string | null;
  destino: string | null;
  data_emissao: string | null;
  detalhe: Record<string, unknown>;
  hash_estado: string;
  dedupe_key: string;
  ja_enviado: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dry_run !== false;
    const filtroCliente: number | null = Number(body?.cliente_id) || null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = admin
      .from("qa_gte_documentos")
      .select(`
        id, cliente_id, numero_gte, endereco_origem, endereco_destino,
        data_emissao, data_validade, status_processamento, matching_status,
        armas_vinculadas_json, matching_resumo_json, dados_extraidos_json,
        cliente:qa_clientes ( id, nome_completo, email, status )
      `)
      .eq("status_processamento", "concluido");
    if (filtroCliente) q = q.eq("cliente_id", filtroCliente);

    const { data: gtes, error } = await q;
    if (error) return json({ error: "select_failed", detail: error.message }, 500);

    const hoje = new Date();
    hoje.setUTCHours(12, 0, 0, 0);

    const candidatos: Candidato[] = [];

    for (const g of gtes ?? []) {
      const cliente = (g as any).cliente;
      if (!cliente?.id) continue;
      if (String(cliente.status ?? "").toLowerCase() === "excluido_lgpd") continue;

      const problemas: Array<{ tipo: string; motivo: string; detalhe: Record<string, unknown> }> = [];

      // Origem/destino ausente
      if (!g.endereco_origem || !g.endereco_destino) {
        problemas.push({
          tipo: "origem_destino_ausente",
          motivo: "gte_sem_origem_ou_destino",
          detalhe: { origem: g.endereco_origem, destino: g.endereco_destino },
        });
      }

      // Datas incompatíveis
      const emissao = g.data_emissao ? new Date(`${g.data_emissao}T12:00:00-03:00`) : null;
      const validade = g.data_validade ? new Date(`${g.data_validade}T12:00:00-03:00`) : null;
      if (emissao && validade && validade.getTime() < emissao.getTime()) {
        problemas.push({
          tipo: "datas_incompativeis",
          motivo: "validade_anterior_a_emissao",
          detalhe: { emissao: g.data_emissao, validade: g.data_validade },
        });
      }
      if (emissao && emissao.getTime() > hoje.getTime()) {
        problemas.push({
          tipo: "emissao_futura",
          motivo: "gte_com_data_emissao_no_futuro",
          detalhe: { emissao: g.data_emissao },
        });
      }
      if (emissao && validade && (hoje.getTime() < emissao.getTime() || hoje.getTime() > validade.getTime())) {
        problemas.push({
          tipo: "fora_periodo_util",
          motivo: "hoje_fora_da_janela_emissao_validade",
          detalhe: { emissao: g.data_emissao, validade: g.data_validade },
        });
      }

      // Sem vínculo com evento/treino/competição (heurística: dados_extraidos_json.finalidade / motivo)
      const extra = (g.dados_extraidos_json ?? {}) as any;
      const finalidade = String(extra?.finalidade ?? extra?.motivo ?? extra?.evento ?? "").trim().toLowerCase();
      const VINCULOS = ["evento", "treino", "competi", "manuten", "exposi", "caça", "cursos"];
      const temVinculo = VINCULOS.some((v) => finalidade.includes(v));
      if (!temVinculo) {
        problemas.push({
          tipo: "sem_vinculo_atividade",
          motivo: "gte_sem_vinculo_com_evento_treino_competicao_manutencao_exposicao",
          detalhe: { finalidade: finalidade || null },
        });
      }

      // GTE vinculada a arma errada
      if (String(g.matching_status ?? "").toLowerCase() === "divergente") {
        problemas.push({
          tipo: "arma_errada",
          motivo: "gte_vinculada_a_arma_divergente",
          detalhe: { matching_resumo: g.matching_resumo_json ?? null },
        });
      }

      for (const p of problemas) {
        const hash = await sha1Hex(JSON.stringify({ tipo: p.tipo, ...p.detalhe }));
        candidatos.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_completo,
          cliente_email: cliente.email,
          gte_documento_id: g.id,
          numero_gte: g.numero_gte,
          divergencia_tipo: p.tipo,
          motivo: p.motivo,
          origem: g.endereco_origem,
          destino: g.endereco_destino,
          data_emissao: g.data_emissao,
          detalhe: p.detalhe,
          hash_estado: hash,
          dedupe_key: `gte:${g.id}:${p.tipo}`,
          ja_enviado: false,
        });
      }
    }

    // Dedupe
    if (candidatos.length) {
      const ids = Array.from(new Set(candidatos.map((c) => c.gte_documento_id)));
      const { data: enviados } = await admin
        .from("qa_gte_consistencia_alertas_enviados")
        .select("gte_documento_id, divergencia_tipo, template_name, hash_estado")
        .in("gte_documento_id", ids);
      const set = new Set(
        (enviados ?? []).map((e: any) => `${e.gte_documento_id}:${e.divergencia_tipo}:${e.template_name}:${e.hash_estado}`),
      );
      for (const c of candidatos) {
        const k = `${c.gte_documento_id}:${c.divergencia_tipo}:gte-inconsistente:${c.hash_estado}`;
        if (set.has(k)) c.ja_enviado = true;
      }
    }

    if (dryRun) {
      return json({
        success: true, dry_run: true,
        total_candidatos: candidatos.length,
        a_enviar: candidatos.filter((c) => !c.ja_enviado && c.cliente_email).length,
        sem_email: candidatos.filter((c) => !c.cliente_email).length,
        ja_enviados: candidatos.filter((c) => c.ja_enviado).length,
        candidatos,
      });
    }

    const enviados: Array<{ candidato: Candidato; ok: boolean; erro?: string }> = [];
    for (const c of candidatos) {
      if (!c.cliente_email || c.ja_enviado) continue;
      const idempotencyKey = `gte-consist:${c.dedupe_key}:${c.hash_estado.slice(0, 12)}`;
      const r = await sendTransactional({
        templateName: "gte-inconsistente",
        recipientEmail: c.cliente_email,
        idempotencyKey,
        templateData: {
          nome: c.cliente_nome ?? "",
          gte: c.numero_gte ?? "—",
          origem: c.origem ?? "—",
          destino: c.destino ?? "—",
          data: toBrDate(c.data_emissao),
          portalUrl: PORTAL_URL,
        },
      });
      if (r.ok) {
        await admin.from("qa_gte_consistencia_alertas_enviados").insert({
          cliente_id: c.cliente_id,
          gte_documento_id: c.gte_documento_id,
          divergencia_tipo: c.divergencia_tipo,
          template_name: "gte-inconsistente",
          hash_estado: c.hash_estado,
        });
      }
      enviados.push({ candidato: c, ok: r.ok, erro: r.error });
    }

    return json({
      success: true, dry_run: false,
      total_candidatos: candidatos.length,
      total_enviados: enviados.filter((e) => e.ok).length,
      total_falhados: enviados.filter((e) => !e.ok).length,
      enviados,
    });
  } catch (e: any) {
    console.error("[qa-gte-consistencia-alertas]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
