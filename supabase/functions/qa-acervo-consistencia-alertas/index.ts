// ============================================================================
// qa-acervo-consistencia-alertas
// ----------------------------------------------------------------------------
// Motor de consistência de ACERVO / CRAF / AUTORIZAÇÃO.
// dry_run=true por padrão. Envio exclusivo via sendTransactional.
// Dedupe em qa_acervo_alertas_enviados por (cliente, item, divergência,
// template, hash_estado). Só grava se envio ok.
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
const norm = (v: unknown) => String(v ?? "").replace(/\D+/g, "").trim();
const normStr = (v: unknown) => String(v ?? "").trim().toUpperCase();
async function sha1Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ItemTipo = "arma_manual" | "craf" | "autorizacao" | "acervo";
interface Candidato {
  cliente_id: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  item_tipo: ItemTipo;
  item_id: string;
  divergencia_tipo: string;
  template: string;
  motivo: string;
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

    let clientesQ = admin.from("qa_clientes").select("id, nome_completo, email, status");
    if (filtroCliente) clientesQ = clientesQ.eq("id", filtroCliente);
    const { data: clientes, error: cErr } = await clientesQ;
    if (cErr) return json({ error: "select_clientes_failed", detail: cErr.message }, 500);

    const clientesMap = new Map<number, any>();
    for (const c of clientes ?? []) {
      if (String(c.status ?? "").toLowerCase() === "excluido_lgpd") continue;
      clientesMap.set(c.id, c);
    }
    if (clientesMap.size === 0) {
      return json({ success: true, dry_run: dryRun, total_candidatos: 0, candidatos: [] });
    }
    const clientesIds = Array.from(clientesMap.keys());

    const [armasR, crafsR] = await Promise.all([
      admin.from("qa_cliente_armas_manual")
        .select("id, qa_cliente_id, marca, modelo, calibre, numero_serie, numero_craf, numero_sigma, numero_sinarm, numero_autorizacao_compra")
        .in("qa_cliente_id", clientesIds),
      admin.from("qa_crafs")
        .select("id, cliente_id, data_validade, nome_arma, numero_arma, numero_sigma, catalogo_id, catalogo:qa_armamentos_catalogo(id, marca, modelo, calibre)")
        .in("cliente_id", clientesIds),
    ]);
    if (armasR.error) return json({ error: "select_armas_failed", detail: armasR.error.message }, 500);
    if (crafsR.error) return json({ error: "select_crafs_failed", detail: crafsR.error.message }, 500);

    const armas = armasR.data ?? [];
    const crafs = crafsR.data ?? [];

    const armasPorCliente = new Map<number, any[]>();
    for (const a of armas) {
      const arr = armasPorCliente.get(a.qa_cliente_id) ?? [];
      arr.push(a); armasPorCliente.set(a.qa_cliente_id, arr);
    }
    const crafsPorCliente = new Map<number, any[]>();
    for (const c of crafs) {
      const arr = crafsPorCliente.get(c.cliente_id) ?? [];
      arr.push(c); crafsPorCliente.set(c.cliente_id, arr);
    }

    const candidatos: Candidato[] = [];

    for (const [cid, cliente] of clientesMap) {
      const armasC = armasPorCliente.get(cid) ?? [];
      const crafsC = crafsPorCliente.get(cid) ?? [];

      const identsCraf = new Set<string>();
      for (const c of crafsC) {
        [c.numero_arma, c.numero_sigma].forEach((n) => {
          const nn = norm(n); if (nn.length >= 4) identsCraf.add(nn);
        });
      }

      let divergenciasCliente = 0;

      // arma sem CRAF
      for (const a of armasC) {
        const ids = [a.numero_serie, a.numero_craf, a.numero_sigma, a.numero_sinarm].map(norm).filter((x) => x.length >= 4);
        const bate = ids.some((x) => identsCraf.has(x));
        const temCrafTexto = norm(a.numero_craf).length >= 4;
        if (!bate && !temCrafTexto) {
          const detalhe = { marca: a.marca, modelo: a.modelo, calibre: a.calibre, numero_serie: a.numero_serie, numero_sigma: a.numero_sigma };
          const hash = await sha1Hex(JSON.stringify(detalhe));
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "arma_manual", item_id: String(a.id),
            divergencia_tipo: "arma_sem_craf", template: "arma-sem-craf",
            motivo: "arma_cadastrada_sem_craf", detalhe, hash_estado: hash,
            dedupe_key: `arma:${a.id}:arma_sem_craf`, ja_enviado: false,
          });
          divergenciasCliente++;
        }
      }

      // CRAF sem arma / série / calibre divergente
      for (const c of crafsC) {
        const ids = [c.numero_arma, c.numero_sigma].map(norm).filter((x) => x.length >= 4);
        const armaMatch = armasC.find((a) => {
          const idsA = [a.numero_serie, a.numero_craf, a.numero_sigma, a.numero_sinarm].map(norm);
          return ids.some((x) => idsA.includes(x));
        });
        if (!armaMatch) {
          const detalhe = { nome_arma: c.nome_arma, numero_arma: c.numero_arma, numero_sigma: c.numero_sigma, validade: c.data_validade };
          const hash = await sha1Hex(JSON.stringify(detalhe));
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "craf", item_id: String(c.id),
            divergencia_tipo: "craf_sem_arma", template: "craf-inconsistente",
            motivo: "craf_sem_arma_correspondente", detalhe, hash_estado: hash,
            dedupe_key: `craf:${c.id}:craf_sem_arma`, ja_enviado: false,
          });
          divergenciasCliente++;
          continue;
        }
        const calArma = normStr(armaMatch.calibre);
        const calCatalogo = normStr((c as any).catalogo?.calibre);
        if (calArma && calCatalogo && calArma !== calCatalogo) {
          const detalhe = { arma_id: armaMatch.id, calibre_acervo: calArma, calibre_craf: calCatalogo };
          const hash = await sha1Hex(JSON.stringify(detalhe));
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "craf", item_id: String(c.id),
            divergencia_tipo: "craf_calibre_divergente", template: "craf-inconsistente",
            motivo: "craf_calibre_divergente_do_acervo", detalhe, hash_estado: hash,
            dedupe_key: `craf:${c.id}:calibre`, ja_enviado: false,
          });
          divergenciasCliente++;
        }
        const serieArma = norm(armaMatch.numero_serie);
        const serieCraf = norm(c.numero_arma);
        if (serieArma && serieCraf && serieArma !== serieCraf) {
          const detalhe = { arma_id: armaMatch.id, serie_acervo: serieArma, serie_craf: serieCraf };
          const hash = await sha1Hex(JSON.stringify(detalhe));
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "craf", item_id: String(c.id),
            divergencia_tipo: "craf_serie_divergente", template: "craf-inconsistente",
            motivo: "craf_serie_divergente_do_acervo", detalhe, hash_estado: hash,
            dedupe_key: `craf:${c.id}:serie`, ja_enviado: false,
          });
          divergenciasCliente++;
        }
      }

      // autorização de compra sem CRAF
      for (const a of armasC) {
        const temAutorizacao = norm(a.numero_autorizacao_compra).length >= 4;
        if (!temAutorizacao) continue;
        const idsA = [a.numero_serie, a.numero_craf, a.numero_sigma, a.numero_sinarm].map(norm);
        const temCraf = idsA.some((x) => x && identsCraf.has(x)) || norm(a.numero_craf).length >= 4;
        if (!temCraf) {
          const detalhe = { arma_id: a.id, marca: a.marca, modelo: a.modelo, calibre: a.calibre, autorizacao: a.numero_autorizacao_compra };
          const hash = await sha1Hex(JSON.stringify(detalhe));
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "autorizacao", item_id: String(a.id),
            divergencia_tipo: "autorizacao_sem_craf", template: "autorizacao-compra-sem-craf",
            motivo: "autorizacao_de_compra_sem_craf_posterior", detalhe, hash_estado: hash,
            dedupe_key: `auth:${a.id}:sem_craf`, ja_enviado: false,
          });
          divergenciasCliente++;
        }
      }

      if (armasC.length + crafsC.length > 0) {
        const detalheResumo = { total_armas: armasC.length, total_crafs: crafsC.length, divergencias: divergenciasCliente };
        const hash = await sha1Hex(JSON.stringify(detalheResumo));
        if (divergenciasCliente > 0) {
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "acervo", item_id: String(cid),
            divergencia_tipo: "acervo_inconsistente", template: "acervo-inconsistente",
            motivo: `acervo_com_${divergenciasCliente}_divergencia(s)`, detalhe: detalheResumo,
            hash_estado: hash, dedupe_key: `acervo:${cid}:incons`, ja_enviado: false,
          });
        } else {
          candidatos.push({
            cliente_id: cid, cliente_nome: cliente.nome_completo, cliente_email: cliente.email,
            item_tipo: "acervo", item_id: String(cid),
            divergencia_tipo: "acervo_conforme", template: "acervo-conforme",
            motivo: "acervo_100_conforme", detalhe: detalheResumo,
            hash_estado: hash, dedupe_key: `acervo:${cid}:conf`, ja_enviado: false,
          });
        }
      }
    }

    if (candidatos.length) {
      const { data: enviados } = await admin
        .from("qa_acervo_alertas_enviados")
        .select("cliente_id, item_tipo, item_id, divergencia_tipo, template_name, hash_estado")
        .in("cliente_id", clientesIds);
      const set = new Set(
        (enviados ?? []).map(
          (e: any) => `${e.cliente_id}:${e.item_tipo}:${e.item_id ?? ""}:${e.divergencia_tipo}:${e.template_name}:${e.hash_estado}`,
        ),
      );
      for (const c of candidatos) {
        const k = `${c.cliente_id}:${c.item_tipo}:${c.item_id}:${c.divergencia_tipo}:${c.template}:${c.hash_estado}`;
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
        por_template: candidatos.reduce<Record<string, number>>((acc, c) => {
          acc[c.template] = (acc[c.template] ?? 0) + 1; return acc;
        }, {}),
        candidatos,
      });
    }

    const enviados: Array<{ candidato: Candidato; ok: boolean; erro?: string }> = [];
    for (const c of candidatos) {
      if (!c.cliente_email || c.ja_enviado) continue;
      const templateData = montarTemplateData(c);
      const idempotencyKey = `acervo:${c.dedupe_key}:${c.hash_estado.slice(0, 12)}`;
      const r = await sendTransactional({
        templateName: c.template, recipientEmail: c.cliente_email,
        idempotencyKey, templateData,
      });
      if (r.ok) {
        await admin.from("qa_acervo_alertas_enviados").insert({
          cliente_id: c.cliente_id, item_tipo: c.item_tipo, item_id: c.item_id,
          divergencia_tipo: c.divergencia_tipo, template_name: c.template,
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
    console.error("[qa-acervo-consistencia-alertas]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});

function montarTemplateData(c: Candidato): Record<string, unknown> {
  const base = { nome: c.cliente_nome ?? "", portalUrl: PORTAL_URL } as Record<string, unknown>;
  const d = c.detalhe as any;
  switch (c.template) {
    case "arma-sem-craf":
      return { ...base, arma: [d.marca, d.modelo, d.calibre].filter(Boolean).join(" ") || "Arma sem descrição", serie: d.numero_serie ?? "—" };
    case "craf-inconsistente":
      return { ...base, motivo: c.motivo, detalhes: JSON.stringify(d) };
    case "autorizacao-compra-sem-craf":
      return { ...base, arma: [d.marca, d.modelo, d.calibre].filter(Boolean).join(" ") || "—", autorizacao: d.autorizacao ?? "—" };
    case "acervo-inconsistente":
      return { ...base, totalArmas: d.total_armas, totalCrafs: d.total_crafs, divergencias: d.divergencias };
    case "acervo-conforme":
      return { ...base, totalArmas: d.total_armas, totalCrafs: d.total_crafs };
  }
  return base;
}
