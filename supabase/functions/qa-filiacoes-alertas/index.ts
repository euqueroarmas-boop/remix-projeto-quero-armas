// ============================================================================
// qa-filiacoes-alertas
// ----------------------------------------------------------------------------
// Motor de alertas de filiação a clube de tiro.
//
// Escopo:
//   - Filiação vencida                 -> template `filiacao-vencida`
//   - Filiação próxima do vencimento   -> template `filiacao-vencimento`
//   - Filiação sem validade extraída   -> apenas reportado (sem envio)
//   - Filiação com clube divergente    -> apenas reportado (sem envio)
//
// Marcos de dias: 90, 60, 30, 15, 7, 0 e -1 (vencido) — cada marco é
// deduplicado em `qa_filiacao_alertas_enviados` (uma vez por marco, por
// filiação, por template).
//
// Regras gerais:
//   - dry_run=true por padrão. Nenhum e-mail é disparado nesse modo.
//   - Retorna JSON com candidatos, template, motivo, marco e dedupe_key.
//   - Envio somente via `sendTransactional`. Nunca via send-smtp-email.
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

// Marcos positivos = dias que faltam para vencer. -1 = já vencida.
const MARCOS = [90, 60, 30, 15, 7, 0, -1] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBrDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00-03:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const alvo = new Date(`${iso}T12:00:00-03:00`);
  if (isNaN(alvo.getTime())) return null;
  const agora = new Date();
  const ms = alvo.getTime() - agora.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function marcoAplicavel(dias: number): number | null {
  if (dias < 0) return -1;
  // Encontra o menor marco positivo >= dias (janela aberta).
  // Ex.: dias=25 -> marco 30. dias=5 -> marco 7. dias=0 -> marco 0.
  const positivos = MARCOS.filter((m) => m >= 0).sort((a, b) => a - b);
  for (const m of positivos) {
    if (dias <= m) return m;
  }
  return null;
}

type Candidato = {
  cliente_id: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  filiacao_id: number | null;
  clube_id: number | null;
  clube_nome: string | null;
  validade: string | null;
  dias_restantes: number | null;
  marco: number | null;
  template: string | null;
  motivo: string;
  dedupe_key: string;
  ja_enviado: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dry_run !== false; // default true
    const filtroCliente: number | null = Number(body?.cliente_id) || null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Busca filiações + cliente + clube
    let query = admin
      .from("qa_filiacoes")
      .select(`
        id, validade_filiacao, clube_id, numero_filiacao,
        cliente:qa_clientes!fk_qa_filiacoes__cliente ( id, nome_completo, email, status ),
        clube:qa_clubes ( id, nome_clube )
      `);
    if (filtroCliente) query = query.eq("cliente_id", filtroCliente);

    const { data: filiacoes, error: fErr } = await query;
    if (fErr) {
      console.error("[qa-filiacoes-alertas] select", fErr);
      return json({ error: "select_failed", detail: fErr.message }, 500);
    }

    const candidatos: Candidato[] = [];

    for (const f of filiacoes ?? []) {
      const cliente = (f as any).cliente;
      const clube = (f as any).clube;
      if (!cliente?.id) continue;
      if (cliente?.status && String(cliente.status).toLowerCase() === "excluido_lgpd") continue;

      const validade: string | null = (f as any).validade_filiacao ?? null;
      const dias = diasAte(validade);

      if (validade == null) {
        candidatos.push({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_completo,
          cliente_email: cliente.email,
          filiacao_id: f.id,
          clube_id: clube?.id ?? null,
          clube_nome: clube?.nome_clube ?? null,
          validade: null,
          dias_restantes: null,
          marco: null,
          template: null,
          motivo: "sem_validade_extraida",
          dedupe_key: `sem-validade:${f.id}`,
          ja_enviado: false,
        });
        continue;
      }

      const marco = dias == null ? null : marcoAplicavel(dias);
      if (marco == null) continue; // fora de qualquer janela relevante

      const template = marco === -1 ? "filiacao-vencida" : "filiacao-vencimento";

      candidatos.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_completo,
        cliente_email: cliente.email,
        filiacao_id: f.id,
        clube_id: clube?.id ?? null,
        clube_nome: clube?.nome_clube ?? null,
        validade,
        dias_restantes: dias,
        marco,
        template,
        motivo: marco === -1 ? "filiacao_vencida" : "filiacao_proxima_vencimento",
        dedupe_key: `f${f.id}:m${marco}:${template}`,
        ja_enviado: false,
      });
    }

    // Marca dedupe consultando qa_filiacao_alertas_enviados
    if (candidatos.length) {
      const filiacoesEnv = candidatos
        .filter((c) => c.filiacao_id != null)
        .map((c) => c.filiacao_id!) as number[];
      const { data: enviados } = await admin
        .from("qa_filiacao_alertas_enviados")
        .select("cliente_id, filiacao_id, marco_dias, template_name")
        .in("filiacao_id", filiacoesEnv.length ? filiacoesEnv : [-1]);
      const setEnv = new Set(
        (enviados ?? []).map(
          (e: any) => `${e.cliente_id}:${e.filiacao_id}:${e.marco_dias}:${e.template_name}`,
        ),
      );
      for (const c of candidatos) {
        const k = `${c.cliente_id}:${c.filiacao_id}:${c.marco}:${c.template}`;
        if (setEnv.has(k)) c.ja_enviado = true;
      }
    }

    // Modo dry_run: apenas preview
    if (dryRun) {
      return json({
        success: true,
        dry_run: true,
        total_candidatos: candidatos.length,
        a_enviar: candidatos.filter((c) => c.template && !c.ja_enviado && c.cliente_email).length,
        sem_email: candidatos.filter((c) => c.template && !c.cliente_email).length,
        sem_validade: candidatos.filter((c) => c.motivo === "sem_validade_extraida").length,
        ja_enviados: candidatos.filter((c) => c.ja_enviado).length,
        candidatos,
      });
    }

    // Envio real
    const enviados: Array<{ candidato: Candidato; ok: boolean; erro?: string }> = [];
    for (const c of candidatos) {
      if (!c.template || !c.cliente_email || c.ja_enviado) continue;
      const idempotencyKey = `filiacao:${c.dedupe_key}:${c.validade ?? "sem-data"}`;

      const templateData: Record<string, unknown> = {
        nome: c.cliente_nome ?? "",
        clube: c.clube_nome ?? "—",
        vencimento: toBrDate(c.validade),
        portalUrl: PORTAL_URL,
      };
      if (c.template === "filiacao-vencimento") {
        templateData.diasRestantes = c.dias_restantes ?? "—";
      }
      if (c.template === "filiacao-vencida") {
        templateData.processo = "Renovação/CR";
      }

      const r = await sendTransactional({
        templateName: c.template,
        recipientEmail: c.cliente_email,
        idempotencyKey,
        templateData,
      });

      if (r.ok) {
        await admin.from("qa_filiacao_alertas_enviados").insert({
          cliente_id: c.cliente_id,
          filiacao_id: c.filiacao_id,
          clube_id: c.clube_id,
          marco_dias: c.marco!,
          template_name: c.template,
          data_referencia: c.validade,
        });
      }
      enviados.push({ candidato: c, ok: r.ok, erro: r.error });
    }

    return json({
      success: true,
      dry_run: false,
      total_candidatos: candidatos.length,
      total_enviados: enviados.filter((e) => e.ok).length,
      total_falhados: enviados.filter((e) => !e.ok).length,
      enviados,
    });
  } catch (e: any) {
    console.error("[qa-filiacoes-alertas]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});