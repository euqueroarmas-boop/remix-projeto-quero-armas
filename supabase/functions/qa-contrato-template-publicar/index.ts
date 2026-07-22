/**
 * qa-contrato-template-publicar — Publica uma nova versão do contrato primário.
 *
 * Recebe o corpo do contrato (HTML ou texto puro), faz o parse dos anexos por
 * serviço (blocos <section data-anexo-slug="...">) e:
 *  1. Faz upsert do anexo de cada serviço em qa_servicos_catalogo
 *     (anexo_corpo_html / anexo_titulo / anexo_versao), casando pelo slug.
 *  2. Substitui os blocos de anexo pelo placeholder {{anexos_i_dinamicos}}
 *     — o motor dinâmico (qaAnexos.ts) monta o Anexo I em runtime a partir
 *     do catálogo, então serviços novos entram no contrato automaticamente.
 *  3. Grava nova versão em qa_contract_templates (versao = max+1,
 *     vigente = true) e desativa as versões anteriores.
 *
 * Acesso restrito a administradores.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TEMPLATE_CODIGO_DEFAULT = "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS";
const CODIGOS_PERMITIDOS = new Set([
  "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
  "PROCURACAO_PADRAO_QUERO_ARMAS",
]);
const PLACEHOLDER = "{{anexos_i_dinamicos}}";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Conversão leve de texto puro/markdown para HTML quando o corpo não tem tags.
function textoParaHtml(texto: string): string {
  const linhas = texto.split(/\r?\n/);
  const out: string[] = [];
  let paragrafo: string[] = [];
  const flush = () => {
    if (paragrafo.length) {
      out.push(`<p>${escHtml(paragrafo.join(" ").trim())}</p>`);
      paragrafo = [];
    }
  };
  for (const raw of linhas) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    if (l === PLACEHOLDER) { flush(); out.push(PLACEHOLDER); continue; }
    if (/^#\s+/.test(l)) { flush(); out.push(`<h1>${escHtml(l.replace(/^#\s+/, ""))}</h1>`); continue; }
    if (/^##\s+/.test(l)) { flush(); out.push(`<h2>${escHtml(l.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^###\s+/.test(l)) { flush(); out.push(`<h3>${escHtml(l.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^(CONTRATO\b|CLÁUSULA\b|CLAUSULA\b|ANEXO\b|ASSINATURA\b|FIM DO INSTRUMENTO)/i.test(l) && l.length < 140) {
      flush(); out.push(`<h2>${escHtml(l)}</h2>`); continue;
    }
    paragrafo.push(l);
  }
  flush();
  return out.join("\n");
}

function extrairTituloAnexo(html: string): string | null {
  const m = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (!m) return null;
  const titulo = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return titulo || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: perfil } = await admin
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", user.id)
      .maybeSingle();
    if (perfil?.perfil !== "administrador") {
      return json({ error: "Acesso restrito a administradores" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const corpoBruto = String(body?.corpo || "").trim();
    const codigoIn = String(body?.codigo || "").trim() || TEMPLATE_CODIGO_DEFAULT;
    if (!CODIGOS_PERMITIDOS.has(codigoIn)) return json({ error: `Código de template não permitido: ${codigoIn}` }, 422);
    const TEMPLATE_CODIGO = codigoIn;
    const tituloDefault = codigoIn === "PROCURACAO_PADRAO_QUERO_ARMAS"
      ? "Procuração — Quero Armas"
      : "Contrato de Adesão de Assessoria Técnica e Despacho Administrativo";
    const titulo = String(body?.titulo || "").trim() || tituloDefault;
    const observacoes = String(body?.observacoes || "").trim() || null;
    const dryRun = body?.dry_run === true;
    // Procuração não tem anexos por serviço — pula toda a lógica de sections.
    const puloAnexos = codigoIn === "PROCURACAO_PADRAO_QUERO_ARMAS";

    if (!corpoBruto) return json({ error: "Corpo do contrato vazio" }, 400);
    if (corpoBruto.length < 500) return json({ error: "Corpo do contrato muito curto — envie o contrato completo" }, 422);

    // Se não há tags HTML, converte texto puro/markdown para HTML.
    const temHtml = /<\s*(h[1-6]|p|section|div|ul|ol|table)\b/i.test(corpoBruto);
    let corpoHtml = temHtml ? corpoBruto : textoParaHtml(corpoBruto);

    // Remove blocos <style> e comentários HTML — servem apenas para a
    // pré-visualização do arquivo enviado; o portal aplica o próprio estilo.
    corpoHtml = corpoHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>\s*/gi, "")
      .replace(/<!--[\s\S]*?-->\s*/g, "")
      .trim();

    // Extrai blocos de anexo por slug.
    const sectionRe = /<section\s+[^>]*data-anexo-slug="([^"]+)"[^>]*>[\s\S]*?<\/section>\s*/gi;
    const anexos: Array<{ slug: string; html: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = sectionRe.exec(corpoHtml)) !== null) {
      const slug = m[1].trim().toLowerCase();
      if (slug && slug !== "__aviso__") anexos.push({ slug, html: m[0] });
    }

    const temPlaceholder = corpoHtml.includes(PLACEHOLDER);
    if (!puloAnexos && !temPlaceholder && anexos.length === 0) {
      return json({
        error:
          "Nenhum ponto de inserção de anexos encontrado. Inclua o placeholder " +
          PLACEHOLDER +
          " no local do Anexo I, ou marque cada anexo com <section data-anexo-slug=\"slug-do-servico\">...</section>.",
      }, 422);
    }

    // Substitui o primeiro bloco de anexo pelo placeholder e remove os demais.
    if (anexos.length > 0) {
      let primeiro = true;
      corpoHtml = corpoHtml.replace(sectionRe, () => {
        if (primeiro && !temPlaceholder) { primeiro = false; return PLACEHOLDER + "\n"; }
        return "";
      });
    }

    // Confere quais slugs existem no catálogo.
    const slugsEncontrados = anexos.map((a) => a.slug);
    const { data: catalogo } = await admin
      .from("qa_servicos_catalogo")
      .select("id, slug, nome, anexo_versao")
      .in("slug", slugsEncontrados.length ? slugsEncontrados : ["__nenhum__"]);
    const catalogoMap = new Map<string, { id: string; nome: string; anexo_versao: number }>(
      ((catalogo ?? []) as any[]).map((c) => [String(c.slug).toLowerCase(), { id: c.id, nome: c.nome, anexo_versao: Number(c.anexo_versao) || 0 }]),
    );
    const anexosSemServico = slugsEncontrados.filter((s) => !catalogoMap.has(s));

    // Próxima versão do template.
    const { data: versoes } = await admin
      .from("qa_contract_templates")
      .select("versao")
      .eq("codigo", TEMPLATE_CODIGO)
      .order("versao", { ascending: false })
      .limit(1);
    const novaVersao = ((versoes?.[0] as any)?.versao ?? 0) + 1;

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        nova_versao: novaVersao,
        anexos_detectados: slugsEncontrados,
        anexos_sem_servico: anexosSemServico,
        usa_placeholder: temPlaceholder || anexos.length > 0,
      });
    }

    // 1. Upsert dos anexos no catálogo (só contrato — procuração não tem anexos).
    const anexosAtualizados: Array<{ slug: string; nome: string; versao: number }> = [];
    for (const a of (puloAnexos ? [] : anexos)) {
      const cat = catalogoMap.get(a.slug);
      if (!cat) continue;
      const versaoAnexo = cat.anexo_versao + 1;
      const { error: upErr } = await admin
        .from("qa_servicos_catalogo")
        .update({
          anexo_corpo_html: a.html.trim(),
          anexo_titulo: extrairTituloAnexo(a.html),
          anexo_versao: versaoAnexo,
          anexo_atualizado_em: new Date().toISOString(),
        })
        .eq("id", cat.id);
      if (upErr) return json({ error: `Falha ao atualizar anexo do serviço "${a.slug}": ${upErr.message}` }, 500);
      anexosAtualizados.push({ slug: a.slug, nome: cat.nome, versao: versaoAnexo });
    }

    // 2. Desativa versões anteriores e grava a nova como vigente.
    const { error: offErr } = await admin
      .from("qa_contract_templates")
      .update({ vigente: false })
      .eq("codigo", TEMPLATE_CODIGO)
      .eq("vigente", true);
    if (offErr) return json({ error: `Falha ao desativar versão anterior: ${offErr.message}` }, 500);

    const { data: novo, error: insErr } = await admin
      .from("qa_contract_templates")
      .insert({
        codigo: TEMPLATE_CODIGO,
        versao: novaVersao,
        titulo,
        corpo_html: corpoHtml,
        vigente: true,
        data_publicacao: new Date().toISOString(),
        observacoes,
      })
      .select("id, versao")
      .single();
    if (insErr) {
      // Tenta restaurar a versão anterior como vigente para não deixar o sistema sem template.
      await admin
        .from("qa_contract_templates")
        .update({ vigente: true })
        .eq("codigo", TEMPLATE_CODIGO)
        .eq("versao", novaVersao - 1);
      return json({ error: `Falha ao publicar template: ${insErr.message}` }, 500);
    }

    await admin.from("qa_logs_auditoria").insert({
      acao: "contrato_template_publicado",
      entidade_tipo: "qa_contract_templates",
      entidade_id: (novo as any).id,
      user_id: user.id,
      detalhes_json: {
        codigo: TEMPLATE_CODIGO,
        versao: novaVersao,
        anexos_atualizados: anexosAtualizados,
        anexos_sem_servico: anexosSemServico,
      },
    });

    return json({
      ok: true,
      versao: novaVersao,
      template_id: (novo as any).id,
      anexos_atualizados: anexosAtualizados,
      anexos_sem_servico: anexosSemServico,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
