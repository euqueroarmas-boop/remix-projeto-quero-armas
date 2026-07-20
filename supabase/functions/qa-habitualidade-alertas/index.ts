// ============================================================================
// qa-habitualidade-alertas
// ----------------------------------------------------------------------------
// Motor de alertas de habitualidade (IN 311/2025 — Arts. 71 a 75).
//
// Escopo:
//   - Progresso de nível          -> `habitualidade-progresso-nivel`
//   - Quase batendo o próximo N   -> `habitualidade-quase-nivel`
//   - Pronto para mudar de nível  -> `habitualidade-pronto-mudanca-nivel`
//   - Bloqueio por tipo de arma   -> `habitualidade-por-tipo-arma-incompleta`
//   - Risco de rebaixamento       -> `habitualidade-risco-rebaixamento`
//
// Regras:
//   - dry_run=true por padrão (nenhum e-mail é disparado).
//   - Envio apenas via `sendTransactional`. Nunca via send-smtp-email.
//   - Dedupe em `qa_habitualidade_alertas_enviados` por
//     (cliente_id, template_name, marco_hash). O marco_hash inclui nível
//     atual, contagem de treinos, competições e tipo âncora — assim o
//     mesmo alerta só é reenviado quando o estado do cliente muda.
//   - Registra dedupe apenas após envio OK.
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

// Metas IN 311/2025, Art. 71 (por tipo de arma, janela de 12 meses).
const METAS: Record<string, { treinos: number; competicoes: number }> = {
  nivel_1: { treinos: 8, competicoes: 0 },
  nivel_2: { treinos: 12, competicoes: 4 },
  nivel_3: { treinos: 20, competicoes: 6 },
};

const TIPOS_HABITUALIDADE = new Set([
  "comprovante_habitualidade",
  "declaracao_habitualidade",
  "declaracao_habitualidade_esportiva",
]);
const TIPOS_COMPETICAO = new Set([
  "comprovante_competicao",
  "certificado_competicao",
  "certificado_campeonato",
]);

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

function normalizarTipoArma(v: unknown): string {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return "outros";
  if (/(pistola|revolver|revólver|garrucha|curta)/.test(s)) return "arma_curta";
  if (/(fuzil|carabina|rifle|raiada|longa.*raiada)/.test(s)) return "longa_raiada";
  if (/(espingarda|calibre.*12|lisa|longa.*lisa)/.test(s)) return "longa_lisa";
  return s.replace(/[^a-z0-9_]+/g, "_").slice(0, 32) || "outros";
}

function nivelFromCliente(cli: any): "nivel_1" | "nivel_2" | "nivel_3" {
  const raw = String(cli?.subcategoria ?? "").toLowerCase();
  if (/n[íi]vel\s*3|nivel_3|iii/.test(raw)) return "nivel_3";
  if (/n[íi]vel\s*2|nivel_2|ii/.test(raw)) return "nivel_2";
  return "nivel_1";
}

function proximoNivel(atual: string): "nivel_2" | "nivel_3" | null {
  if (atual === "nivel_1") return "nivel_2";
  if (atual === "nivel_2") return "nivel_3";
  return null;
}

function nivelLabel(n: string): string {
  return n === "nivel_3" ? "Nível 3" : n === "nivel_2" ? "Nível 2" : "Nível 1";
}

type ContagemTipo = { tipo: string; treinos: number; competicoes: number };
type Candidato = {
  cliente_id: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  nivel_atual: string;
  nivel_sugerido: string | null;
  treinos_validos: number;
  competicoes_validas: number;
  tipo_arma_ancora: string | null;
  periodo: string;
  por_tipo: ContagemTipo[];
  template: string;
  motivo: string;
  proximaAcao: string;
  marco_hash: string;
  ja_enviado: boolean;
};

function decidirTemplate(
  nivelAtual: string,
  porTipo: ContagemTipo[],
): { template: string; motivo: string; nivelSugerido: string | null; proximaAcao: string; ancora: string | null } | null {
  if (!porTipo.length) return null;

  const prox = proximoNivel(nivelAtual);
  const metaAtual = METAS[nivelAtual];
  const metaProx = prox ? METAS[prox] : null;

  // Menor nível comprovado (Art. 74 parágrafo único).
  const bateMetaAtual = porTipo.every(
    (t) => t.treinos >= metaAtual.treinos && t.competicoes >= metaAtual.competicoes,
  );
  const bateMetaProx = metaProx
    ? porTipo.every(
        (t) => t.treinos >= metaProx.treinos && t.competicoes >= metaProx.competicoes,
      )
    : false;

  const ancora = [...porTipo].sort((a, b) => a.treinos - b.treinos)[0];

  if (metaProx && bateMetaProx) {
    return {
      template: "habitualidade-pronto-mudanca-nivel",
      motivo: "meta_proximo_nivel_atingida_em_todos_os_tipos",
      nivelSugerido: prox,
      proximaAcao: "Solicitar mudança de nível de atirador desportivo",
      ancora: ancora?.tipo ?? null,
    };
  }

  if (nivelAtual !== "nivel_1" && !bateMetaAtual) {
    return {
      template: "habitualidade-risco-rebaixamento",
      motivo: "meta_do_nivel_atual_nao_sustentada",
      nivelSugerido: nivelAtual === "nivel_3" ? "nivel_2" : "nivel_1",
      proximaAcao: "Regularizar habitualidade com urgência",
      ancora: ancora?.tipo ?? null,
    };
  }

  if (metaProx) {
    const menorTreinosProx = Math.min(...porTipo.map((t) => t.treinos / metaProx.treinos));
    if (menorTreinosProx >= 0.8) {
      return {
        template: "habitualidade-quase-nivel",
        motivo: "80pct_do_proximo_nivel",
        nivelSugerido: prox,
        proximaAcao: "Completar treinos ou competições restantes",
        ancora: ancora?.tipo ?? null,
      };
    }
  }

  if (porTipo.length > 1) {
    const tiposIncompletos = porTipo.filter(
      (t) => t.treinos < metaAtual.treinos || t.competicoes < metaAtual.competicoes,
    );
    if (tiposIncompletos.length && tiposIncompletos.length < porTipo.length) {
      return {
        template: "habitualidade-por-tipo-arma-incompleta",
        motivo: "tipo_de_arma_puxando_nivel_para_baixo",
        nivelSugerido: null,
        proximaAcao: `Completar habitualidade do tipo ${tiposIncompletos[0].tipo}`,
        ancora: tiposIncompletos[0].tipo,
      };
    }
  }

  const totalTreinos = porTipo.reduce((s, t) => s + t.treinos, 0);
  const totalComp = porTipo.reduce((s, t) => s + t.competicoes, 0);
  if (totalTreinos + totalComp > 0) {
    return {
      template: "habitualidade-progresso-nivel",
      motivo: "contagem_atualizada",
      nivelSugerido: prox,
      proximaAcao: "Acompanhar progresso no Arsenal Inteligente",
      ancora: ancora?.tipo ?? null,
    };
  }

  return null;
}

function marcoHash(c: Omit<Candidato, "marco_hash" | "ja_enviado">): string {
  return [
    c.template,
    c.nivel_atual,
    c.nivel_sugerido ?? "",
    c.treinos_validos,
    c.competicoes_validas,
    c.tipo_arma_ancora ?? "",
  ].join("|");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dry_run !== false;
    const filtroCliente: number | null = Number(body?.cliente_id) || null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Janela oficial: últimos 12 meses.
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000);
    const periodo = `${toBrDate(inicio.toISOString().slice(0, 10))} a ${toBrDate(hoje.toISOString().slice(0, 10))}`;

    // Busca clientes ativos com e-mail
    let qCli = admin
      .from("qa_clientes")
      .select("id, nome_completo, email, subcategoria, categoria_titular, status")
      .not("email", "is", null);
    if (filtroCliente) qCli = qCli.eq("id", filtroCliente);
    const { data: clientes, error: cliErr } = await qCli;
    if (cliErr) {
      console.error("[qa-habitualidade-alertas] clientes", cliErr);
      return json({ error: "select_clientes_failed", detail: cliErr.message }, 500);
    }

    const candidatos: Candidato[] = [];

    for (const cli of clientes ?? []) {
      if (String((cli as any).status ?? "").toLowerCase() === "excluido_lgpd") continue;

      // Categoria titular precisa ser CAC/atirador para o motor se aplicar.
      const cat = String((cli as any).categoria_titular ?? "").toLowerCase();
      if (cat && !/(atirador|cac|desportivo|colecionador|ca[çc]ador)/.test(cat)) continue;

      // Acervo do cliente (tipos únicos)
      const { data: armas } = await admin
        .from("qa_cliente_armas_manual")
        .select("tipo_arma")
        .eq("cliente_id", (cli as any).id);
      const tiposAcervo = new Set(
        (armas ?? []).map((a: any) => normalizarTipoArma(a.tipo_arma)).filter(Boolean),
      );

      // Documentos de habitualidade nos últimos 365 dias
      const { data: docs } = await admin
        .from("qa_documentos_cliente")
        .select("tipo_documento, data_emissao, ia_dados_extraidos, metadados_documento_json")
        .eq("cliente_id", (cli as any).id)
        .gte("data_emissao", inicio.toISOString().slice(0, 10));

      const contagens = new Map<string, ContagemTipo>();
      // Garante todos os tipos do acervo no output, mesmo zerados
      for (const t of tiposAcervo) {
        contagens.set(t, { tipo: t, treinos: 0, competicoes: 0 });
      }

      for (const d of docs ?? []) {
        const tipo = String((d as any).tipo_documento ?? "").toLowerCase();
        const isTreino = TIPOS_HABITUALIDADE.has(tipo);
        const isComp = TIPOS_COMPETICAO.has(tipo);
        if (!isTreino && !isComp) continue;
        const meta =
          (d as any).ia_dados_extraidos ?? (d as any).metadados_documento_json ?? {};
        const tipoArma = normalizarTipoArma(
          meta?.tipo_arma ?? meta?.categoria_arma ?? meta?.arma_tipo ?? "",
        );
        const alvo = tiposAcervo.size ? tiposAcervo.has(tipoArma) ? tipoArma : [...tiposAcervo][0] : tipoArma;
        if (!contagens.has(alvo)) contagens.set(alvo, { tipo: alvo, treinos: 0, competicoes: 0 });
        const c = contagens.get(alvo)!;
        if (isTreino) c.treinos += 1;
        else c.competicoes += 1;
      }

      const porTipo = [...contagens.values()];
      if (!porTipo.length) continue;

      const nivelAtual = nivelFromCliente(cli);
      const decisao = decidirTemplate(nivelAtual, porTipo);
      if (!decisao) continue;

      const totalTreinos = porTipo.reduce((s, t) => s + t.treinos, 0);
      const totalComp = porTipo.reduce((s, t) => s + t.competicoes, 0);

      const base = {
        cliente_id: (cli as any).id as number,
        cliente_nome: (cli as any).nome_completo as string | null,
        cliente_email: (cli as any).email as string | null,
        nivel_atual: nivelAtual,
        nivel_sugerido: decisao.nivelSugerido,
        treinos_validos: totalTreinos,
        competicoes_validas: totalComp,
        tipo_arma_ancora: decisao.ancora,
        periodo,
        por_tipo: porTipo,
        template: decisao.template,
        motivo: decisao.motivo,
        proximaAcao: decisao.proximaAcao,
      };
      const hash = marcoHash(base);
      candidatos.push({ ...base, marco_hash: hash, ja_enviado: false });
    }

    // Marca dedupe consultando qa_habitualidade_alertas_enviados
    if (candidatos.length) {
      const ids = [...new Set(candidatos.map((c) => c.cliente_id))];
      const { data: enviados } = await admin
        .from("qa_habitualidade_alertas_enviados")
        .select("cliente_id, template_name, marco_hash")
        .in("cliente_id", ids);
      const set = new Set(
        (enviados ?? []).map(
          (e: any) => `${e.cliente_id}:${e.template_name}:${e.marco_hash}`,
        ),
      );
      for (const c of candidatos) {
        if (set.has(`${c.cliente_id}:${c.template}:${c.marco_hash}`)) c.ja_enviado = true;
      }
    }

    if (dryRun) {
      return json({
        success: true,
        dry_run: true,
        total_candidatos: candidatos.length,
        a_enviar: candidatos.filter((c) => !c.ja_enviado && c.cliente_email).length,
        sem_email: candidatos.filter((c) => !c.cliente_email).length,
        ja_enviados: candidatos.filter((c) => c.ja_enviado).length,
        candidatos,
      });
    }

    // Envio real
    const enviados: Array<{ candidato: Candidato; ok: boolean; erro?: string }> = [];
    for (const c of candidatos) {
      if (!c.cliente_email || c.ja_enviado) continue;
      const idempotencyKey = `habitualidade:${c.cliente_id}:${c.template}:${c.marco_hash}`;
      const templateData = {
        nome: c.cliente_nome ?? "",
        nivelAtual: nivelLabel(c.nivel_atual),
        nivelSugerido: c.nivel_sugerido ? nivelLabel(c.nivel_sugerido) : "—",
        treinosValidos: c.treinos_validos,
        competicoesValidas: c.competicoes_validas,
        periodo: c.periodo,
        proximaAcao: c.proximaAcao,
        portalUrl: PORTAL_URL,
      };
      const r = await sendTransactional({
        templateName: c.template,
        recipientEmail: c.cliente_email,
        idempotencyKey,
        templateData,
      });
      if (r.ok) {
        await admin.from("qa_habitualidade_alertas_enviados").insert({
          cliente_id: c.cliente_id,
          template_name: c.template,
          nivel_atual: c.nivel_atual,
          nivel_sugerido: c.nivel_sugerido,
          treinos_validos: c.treinos_validos,
          competicoes_validas: c.competicoes_validas,
          tipo_arma_ancora: c.tipo_arma_ancora,
          periodo_ref: new Date().toISOString().slice(0, 10),
          marco_hash: c.marco_hash,
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
    console.error("[qa-habitualidade-alertas]", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});