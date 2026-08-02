/**
 * qa-declaracao-residencia
 *
 * Fluxo do comprovante de residencia em nome de terceiro.
 *
 *   acao = "gerar"           -> monta a DECLARACAO DO RESPONSAVEL PELO IMOVEL
 *                              com os dados do dono do imovel no preambulo,
 *                              grava o carimbo de sessao da emissao e devolve
 *                              o PDF (mesmo padrao do contrato e da procuracao).
 *   acao = "enviar_assinada" -> recebe o PDF assinado no GOV.BR pelo RESPONSAVEL
 *                              e confronta, sem tolerancia:
 *                                1. nome/CPF do signatario x dados do responsavel
 *                                2. data da assinatura >= data da geracao
 *                                3. cadeia ICP-Brasil (gov.br)
 *
 * Quem assina e o DONO DO IMOVEL - nao o requerente.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";
import { validatePdfSignature, normalizeCpf } from "../_shared/qaPdfSignatureValidate.ts";
import { desenharCarimbo } from "../_shared/carimboConexao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";
const MAX_BYTES = 25 * 1024 * 1024;

/** Mesmo motor de carimbo do contrato e da procuração. */
function detectarSO(ua: string): string | null {
  if (!ua) return null;
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}
function detectarNavegador(ua: string): string | null {
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}
async function sha256Hex(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authUserId(req: Request): Promise<string | null> {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function clienteIdsDoUsuario(sb: ReturnType<typeof svc>, userId: string): Promise<number[]> {
  const ids = new Set<number>();
  const { data: link } = await sb
    .from("cliente_auth_links")
    .select("qa_cliente_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if ((link as any)?.qa_cliente_id) ids.add(Number((link as any).qa_cliente_id));
  const { data: clientes } = await sb.from("qa_clientes").select("id, id_legado").eq("user_id", userId);
  for (const c of (clientes ?? []) as any[]) {
    if (c.id) ids.add(Number(c.id));
    if (c.id_legado) ids.add(Number(c.id_legado));
  }
  return Array.from(ids).filter((n) => Number.isFinite(n));
}

const PREPS = new Set(["da", "das", "de", "do", "dos", "e"]);
function titulo(s: string): string {
  if (!s) return "";
  return s.toLowerCase().split(" ").map((w, i) => (i > 0 && PREPS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
function first(...v: unknown[]): string {
  for (const x of v) { const t = String(x ?? "").trim(); if (t) return t; }
  return "";
}
function normNome(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}
function brDataExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}
function enderecoDoCliente(c: Record<string, unknown>): string {
  return [
    titulo(first(c.endereco)),
    first(c.numero) ? `n${String.fromCharCode(186)} ${first(c.numero)}` : "",
    titulo(first(c.complemento)),
    titulo(first(c.bairro)),
    titulo(first(c.cidade)),
    first(c.estado) ? String(c.estado).toUpperCase() : "",
    first(c.cep) ? `CEP ${first(c.cep)}` : "",
  ].filter(Boolean).join(", ");
}

/** Segmento de texto: negrito marca TODO dado extraído. */
type Seg = { t: string; b?: boolean };

/** Texto literal do modelo oficial. Nada e inventado alem dos dados. */
function corpoDeclaracaoSegs(ctx: Record<string, string>): Seg[][] {
  const preambulo: Seg[] = [{ t: "Eu, " }, { t: ctx.responsavel_nome, b: true }];
  const add = (rotuloAntes: string, valor: string) => {
    if (!valor) return;
    preambulo.push({ t: rotuloAntes });
    preambulo.push({ t: valor, b: true });
  };
  add(", ", ctx.responsavel_nacionalidade ? ctx.responsavel_nacionalidade.toLowerCase() : "");
  add(", natural de ", ctx.responsavel_naturalidade);
  add(", nascido(a) em ", ctx.responsavel_nascimento);
  add(", ", ctx.responsavel_profissao ? ctx.responsavel_profissao.toLowerCase() : "");
  add(", ", ctx.responsavel_estado_civil ? ctx.responsavel_estado_civil.toLowerCase() : "");
  add(", inscrito(a) no CPF sob o n\u00ba ", ctx.responsavel_cpf);

  const p1: Seg[] = [
    ...preambulo,
    { t: ", DECLARO, para os devidos fins de direito e sob as penas da lei, que " },
    { t: ctx.requerente_nome, b: true },
  ];
  if (ctx.requerente_cpf) {
    p1.push({ t: ", inscrito(a) no CPF sob o n\u00ba " }, { t: ctx.requerente_cpf, b: true });
  }
  p1.push({ t: ", reside no im\u00f3vel situado \u00e0 " }, { t: ctx.endereco_completo, b: true });
  if (ctx.mora_desde) p1.push({ t: ", desde " }, { t: ctx.mora_desde, b: true });
  p1.push({ t: ", im\u00f3vel este de minha propriedade e/ou responsabilidade." });

  return [
    p1,
    [{ t: "Declaro ainda estar ciente de que a falsidade desta declara\u00e7\u00e3o configura crime previsto no artigo 299 do C\u00f3digo Penal Brasileiro, sujeitando o declarante \u00e0s san\u00e7\u00f5es penais e civis cab\u00edveis, bem como que esta declara\u00e7\u00e3o destina-se \u00e0 instru\u00e7\u00e3o de processo administrativo perante a Pol\u00edcia Federal, nos termos da Lei n\u00ba 10.826/2003 e do Decreto n\u00ba 11.615/2023." }],
    [{ t: "Por ser express\u00e3o da verdade, firmo a presente declara\u00e7\u00e3o para que produza seus efeitos legais." }],
  ];
}

function segsParaTexto(segs: Seg[]): string {
  return segs.map((s) => s.t).join("");
}

function montarPdf(ctx: Record<string, string>, sessao: Record<string, unknown>): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const MARGEM = 104;
  const DIREITA = 56;
  const largura = doc.internal.pageSize.getWidth() - MARGEM - DIREITA;
  const SIZE = 10.5;
  const LINHA = SIZE + 4;
  let y = 76;

  const quebrarPagina = () => {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 76; }
  };

  const escrever = (
    texto: string,
    opts: { size?: number; bold?: boolean; espaco?: number; align?: "left" | "center" } = {},
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? SIZE);
    const linhas = doc.splitTextToSize(texto, largura) as string[];
    for (const linha of linhas) {
      quebrarPagina();
      if (opts.align === "center") doc.text(linha, MARGEM + largura / 2, y, { align: "center" });
      else doc.text(linha, MARGEM, y);
      y += (opts.size ?? SIZE) + 4;
    }
    y += opts.espaco ?? 10;
  };

  /** Justifica a esquerda mantendo negrito por trecho (dados extraidos). */
  const escreverRico = (segs: Seg[], espaco = 12) => {
    doc.setFontSize(SIZE);
    type Palavra = { t: string; b: boolean };
    const palavras: Palavra[] = [];
    for (const seg of segs) {
      const partes = seg.t.split(/(\s+)/).filter((x) => x !== "");
      for (const parte of partes) palavras.push({ t: parte, b: !!seg.b });
    }
    let x = MARGEM;
    quebrarPagina();
    for (const p of palavras) {
      doc.setFont("helvetica", p.b ? "bold" : "normal");
      const w = doc.getTextWidth(p.t);
      if (/^\s+$/.test(p.t)) {
        if (x > MARGEM) x += w;
        continue;
      }
      if (x + w > MARGEM + largura) {
        y += LINHA;
        quebrarPagina();
        x = MARGEM;
      }
      doc.text(p.t, x, y);
      x += w;
    }
    y += LINHA + espaco;
  };

  escrever("DECLARA\u00c7\u00c3O DO RESPONS\u00c1VEL PELO IM\u00d3VEL", { size: 13, bold: true, espaco: 22, align: "center" });

  for (const p of corpoDeclaracaoSegs(ctx)) escreverRico(p, 12);

  y += 10;
  // Local e data: cidade do comprovante de endereco, dados em negrito.
  escreverRico([{ t: `${ctx.cidade_declaracao}, `, b: true }, { t: `${ctx.data_hoje_extenso}.`, b: true }], 0);

  // 10 quebras de linha antes da assinatura.
  y += LINHA * 10;
  quebrarPagina();

  escrever("____________________________________________", { size: 10, espaco: 2 });
  escrever(ctx.responsavel_nome.toUpperCase(), { size: 10, bold: true, espaco: 2 });
  if (ctx.responsavel_cpf) escrever(`CPF n\u00ba ${ctx.responsavel_cpf}`, { size: 9, bold: true, espaco: 2 });
  escrever("RESPONS\u00c1VEL PELO IM\u00d3VEL \u00b7 ASSINATURA DIGITAL GOV.BR / ICP-BRASIL", { size: 8, espaco: 0 });

  desenharCarimbo(doc, {
    sessao: {
      numero: String(sessao.numero ?? ""),
      rotuloNumero: "DECLARA\u00c7\u00c3O",
      registrado_em: String(sessao.registrado_em ?? ""),
      ip: (sessao.ip as string) ?? null,
      user_agent: (sessao.user_agent as string) ?? null,
      accept_language: (sessao.accept_language as string) ?? null,
      referer: (sessao.referer as string) ?? null,
      acao: "emiss\u00e3o da declara\u00e7\u00e3o do respons\u00e1vel pelo im\u00f3vel",
      hash: (sessao.hash as string) ?? undefined,
    },
    margemEsquerda: MARGEM,
  });

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

/**
 * O endereco da declaracao e SEMPRE o do comprovante de residencia enviado
 * (a conta do responsavel pelo imovel) — nunca o endereco do cadastro do
 * requerente. A cidade do local/data segue o mesmo comprovante.
 */
function limparEndereco(bruto: string): string {
  return String(bruto || "").replace(/\s+/g, " ").trim();
}
function cidadeDoEndereco(bruto: string): string {
  const txt = limparEndereco(bruto);
  // "... / FERRAZ DE VASCONCELOS - SP CEP: 08545-090"
  const m = txt.match(/\/\s*([^\/\-]+?)\s*-\s*[A-Z]{2}\b/i) || txt.match(/,\s*([^,]+?)\s*[-\/]\s*[A-Z]{2}\b/i);
  if (m?.[1]) return titulo(m[1].trim());
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const userId = await authUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const sb = svc();
  const clienteIds = await clienteIdsDoUsuario(sb, userId);
  if (!clienteIds.length) return json({ error: "Cliente n\u00e3o vinculado" }, 403);

  const sessaoBase = {
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    user_agent: req.headers.get("user-agent") || null,
    accept_language: req.headers.get("accept-language") || null,
    referer: req.headers.get("referer") || null,
    so: detectarSO(req.headers.get("user-agent") || ""),
    browser: detectarNavegador(req.headers.get("user-agent") || ""),
    country: req.headers.get("cf-ipcountry"),
  };

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "Body inv\u00e1lido" }, 400); }
  const acao = String(body.acao || "gerar");

  /* GERAR */
  if (acao === "gerar") {
    const clienteId = Number(body.qa_cliente_id);
    if (!clienteIds.includes(clienteId)) return json({ error: "Acesso negado" }, 403);

    const responsavelNome = String(body.responsavel_nome || "").trim();
    if (!responsavelNome) return json({ error: "responsavel_nome obrigat\u00f3rio" }, 400);

    const { data: cli } = await sb
      .from("qa_clientes")
      .select("id, id_legado, nome_completo, cpf, nacionalidade, naturalidade, data_nascimento, profissao, estado_civil, endereco, numero, complemento, bairro, cidade, estado, cep")
      .or(`id.eq.${clienteId},id_legado.eq.${clienteId}`)
      .limit(1)
      .maybeSingle();
    if (!cli) return json({ error: "Cliente n\u00e3o encontrado" }, 404);

    const { data: cfg } = await sb
      .from("qa_config_geral" as any)
      .select("chave, valor")
      .in("chave", ["empresa_razao_social", "empresa_cnpj_completo"]);
    const cfgMap: Record<string, string> = {};
    for (const r of (cfg ?? []) as any[]) cfgMap[r.chave] = r.valor ?? "";

    const endereco = String(body.endereco_completo || "").trim() || enderecoDoCliente(cli as any);
    const agora = new Date();

    const ctx: Record<string, string> = {
      empresa_razao_social: cfgMap.empresa_razao_social || "QUERO ARMAS",
      empresa_cnpj_completo: cfgMap.empresa_cnpj_completo || "",
      responsavel_nome: responsavelNome,
      responsavel_cpf: body.responsavel_cpf ? normalizeCpf(String(body.responsavel_cpf)) : "",
      responsavel_nacionalidade: titulo(String(body.responsavel_nacionalidade || "brasileiro(a)")),
      responsavel_naturalidade: titulo(String(body.responsavel_naturalidade || "")),
      responsavel_nascimento: String(body.responsavel_nascimento || ""),
      responsavel_profissao: titulo(String(body.responsavel_profissao || "")),
      responsavel_estado_civil: titulo(String(body.responsavel_estado_civil || "")),
      requerente_nome: String((cli as any).nome_completo || ""),
      requerente_cpf: String((cli as any).cpf || ""),
      endereco_completo: endereco,
      mora_desde: String(body.mora_desde || ""),
      cidade_declaracao: titulo(String((cli as any).cidade || "Jacare\u00ed")),
      data_hoje_extenso: brDataExtenso(agora),
    };

    const registro: Record<string, unknown> = {
      qa_cliente_id: clienteId,
      documento_comprovante_id: body.documento_comprovante_id ?? null,
      requerente_nome: ctx.requerente_nome,
      requerente_cpf: (cli as any).cpf ?? null,
      requerente_nacionalidade: (cli as any).nacionalidade ?? null,
      requerente_naturalidade: (cli as any).naturalidade ?? null,
      requerente_nascimento: (cli as any).data_nascimento ?? null,
      requerente_profissao: (cli as any).profissao ?? null,
      requerente_estado_civil: (cli as any).estado_civil ?? null,
      responsavel_nome: responsavelNome,
      responsavel_cpf: ctx.responsavel_cpf || null,
      responsavel_nacionalidade: body.responsavel_nacionalidade ?? null,
      responsavel_naturalidade: body.responsavel_naturalidade ?? null,
      responsavel_nascimento: body.responsavel_nascimento ?? null,
      responsavel_profissao: body.responsavel_profissao ?? null,
      responsavel_estado_civil: body.responsavel_estado_civil ?? null,
      responsavel_doc_path: body.responsavel_doc_path ?? null,
      endereco_completo: endereco,
      mora_desde: body.mora_desde ?? null,
      conteudo_html: `<article class="qa-doc"><h1>DECLARA\u00c7\u00c3O DO RESPONS\u00c1VEL PELO IM\u00d3VEL</h1>${corpoDeclaracaoSegs(ctx).map((p) => `<p>${segsParaTexto(p)}</p>`).join("")}<p class="qa-doc__date">${ctx.cidade_declaracao}, ${ctx.data_hoje_extenso}.</p></article>`,
      status: "gerada_pendente_assinatura",
      gerado_em: agora.toISOString(),
      sessao_geracao_json: sessaoBase,
    };

    const { data: criada, error: insErr } = await sb
      .from("qa_declaracoes_residencia")
      .insert(registro)
      .select("id")
      .single();
    if (insErr) return json({ error: "Falha ao registrar declara\u00e7\u00e3o", detail: insErr.message }, 500);

    const hashConteudo = await sha256Hex(String(registro.conteudo_html ?? ""));
    const pdf = montarPdf(ctx, {
      numero: (criada as any).id,
      registrado_em: agora.toISOString(),
      hash: hashConteudo,
      ...sessaoBase,
    });

    const path = `qa-declaracoes-residencia/${clienteId}/${(criada as any).id}/declaracao.pdf`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json({ error: "Falha ao gravar PDF", detail: upErr.message }, 500);

    await sb.from("qa_declaracoes_residencia").update({ arquivo_assinado_path: null }).eq("id", (criada as any).id);
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);

    return json({
      ok: true,
      declaracao_id: (criada as any).id,
      pdf_path: path,
      pdf_url: signed?.signedUrl ?? null,
      status: "gerada_pendente_assinatura",
    });
  }

  /* ATUAL — retoma a declaracao pendente/reprovada ja gerada para o cliente */
  if (acao === "atual") {
    const clienteId = Number(body.qa_cliente_id);
    if (!clienteIds.includes(clienteId)) return json({ error: "Acesso negado" }, 403);

    const { data: decl } = await sb
      .from("qa_declaracoes_residencia")
      .select("*")
      .eq("qa_cliente_id", clienteId)
      .in("status", ["gerada_pendente_assinatura", "assinada_rejeitada"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!decl) return json({ ok: true, declaracao: null });

    const d = decl as any;
    return json({
      ok: true,
      declaracao: {
        id: d.id,
        status: d.status,
        documento_comprovante_id: d.documento_comprovante_id ?? null,
        motivo_reprovacao: d.assinatura_motivo_falha ?? null,
        dados: {
          responsavel_nome: d.responsavel_nome ?? "",
          responsavel_documento: d.responsavel_cpf ?? "",
          estado_civil: d.responsavel_estado_civil ?? "",
          profissao: d.responsavel_profissao ?? "",
          mora_desde: d.mora_desde ?? "",
          responsavel_arquivo_path: d.responsavel_doc_path ?? null,
        },
      },
    });
  }

  /* BAIXAR — devolve os MESMOS bytes canonicos, como no contrato/procuracao */
  if (acao === "baixar") {
    const declaracaoId = String(body.declaracao_id || "");
    if (!declaracaoId) return json({ error: "declaracao_id obrigat\u00f3rio" }, 400);

    const { data: decl } = await sb
      .from("qa_declaracoes_residencia")
      .select("id, qa_cliente_id, responsavel_nome")
      .eq("id", declaracaoId)
      .maybeSingle();
    if (!decl) return json({ error: "Declara\u00e7\u00e3o n\u00e3o encontrada" }, 404);
    if (!clienteIds.includes(Number((decl as any).qa_cliente_id))) return json({ error: "Acesso negado" }, 403);

    const path = `qa-declaracoes-residencia/${(decl as any).qa_cliente_id}/${declaracaoId}/declaracao.pdf`;
    const { data: file, error: dlErr } = await sb.storage.from(BUCKET).download(path);
    if (dlErr || !file) return json({ error: "PDF n\u00e3o encontrado", detail: dlErr?.message }, 404);

    const nome = `Declaracao do Responsavel pelo Imovel - ${String((decl as any).responsavel_nome || "")}`
      .replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ".pdf";

    return new Response(await file.arrayBuffer(), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  /* ENVIAR ASSINADA */
  if (acao === "enviar_assinada") {
    const declaracaoId = String(body.declaracao_id || "");
    if (!declaracaoId) return json({ error: "declaracao_id obrigat\u00f3rio" }, 400);
    if (!body.file_base64) return json({ error: "file_base64 obrigat\u00f3rio" }, 400);

    const bin = atob(String(body.file_base64).replace(/^data:[^;]+;base64,/, ""));
    const pdfBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
    if (pdfBytes.byteLength > MAX_BYTES) return json({ error: "Arquivo > 25MB" }, 413);
    if (pdfBytes.byteLength < 256) return json({ error: "Arquivo inv\u00e1lido" }, 400);
    if (!new TextDecoder().decode(pdfBytes.slice(0, 5)).startsWith("%PDF")) {
      return json({ error: "Apenas PDF assinado no GOV.BR \u00e9 aceito" }, 415);
    }

    const { data: decl } = await sb
      .from("qa_declaracoes_residencia")
      .select("*")
      .eq("id", declaracaoId)
      .maybeSingle();
    if (!decl) return json({ error: "Declara\u00e7\u00e3o n\u00e3o encontrada" }, 404);
    if (!clienteIds.includes(Number((decl as any).qa_cliente_id))) return json({ error: "Acesso negado" }, 403);

    const path = `qa-declaracoes-residencia/${(decl as any).qa_cliente_id}/${declaracaoId}/assinada.pdf`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return json({ error: "Falha ao gravar PDF", detail: upErr.message }, 500);

    const sig = validatePdfSignature(pdfBytes);

    const motivos: string[] = [];
    if (sig.status === "sem_assinatura") {
      motivos.push("O PDF n\u00e3o cont\u00e9m assinatura digital. Assine em gov.br e reenvie o arquivo assinado.");
    } else if (!sig.valida) {
      motivos.push(sig.motivo_falha || "A assinatura digital n\u00e3o p\u00f4de ser interpretada.");
    } else {
      if (!sig.icp_brasil) motivos.push("A assinatura n\u00e3o pertence \u00e0 cadeia ICP-Brasil / GOV.BR.");
      const nomeAssinante = normNome(sig.signatario);
      const nomeResponsavel = normNome((decl as any).responsavel_nome);
      const cpfAssinante = normalizeCpf(sig.cpf_signatario || "");
      const cpfResponsavel = normalizeCpf((decl as any).responsavel_cpf || "");
      const cpfConfere = !!cpfAssinante && !!cpfResponsavel && cpfAssinante === cpfResponsavel;
      if (!cpfConfere && nomeAssinante && nomeResponsavel && nomeAssinante !== nomeResponsavel) {
        motivos.push(`A declara\u00e7\u00e3o foi assinada por ${sig.signatario}, e n\u00e3o pelo respons\u00e1vel pelo im\u00f3vel (${(decl as any).responsavel_nome}).`);
      }
      if (cpfAssinante && cpfResponsavel && cpfAssinante !== cpfResponsavel) {
        motivos.push("O CPF do signat\u00e1rio n\u00e3o corresponde ao CPF do respons\u00e1vel pelo im\u00f3vel.");
      }
      if (sig.data_assinatura) {
        const assinadaEm = new Date(sig.data_assinatura).getTime();
        const geradaEm = new Date((decl as any).gerado_em).getTime();
        if (Number.isFinite(assinadaEm) && assinadaEm + 5 * 60 * 1000 < geradaEm) {
          motivos.push("A data da assinatura \u00e9 anterior \u00e0 emiss\u00e3o da declara\u00e7\u00e3o \u2014 o arquivo assinado n\u00e3o \u00e9 este documento.");
        }
      }
    }

    const conforme = motivos.length === 0;
    const agoraIso = new Date().toISOString();

    await sb.from("qa_declaracoes_residencia").update({
      arquivo_assinado_path: path,
      assinado_enviado_em: agoraIso,
      sessao_envio_json: sessaoBase,
      status: conforme ? "assinada_validada" : "assinada_rejeitada",
      assinatura_status: sig.status,
      assinatura_signatario: sig.signatario,
      assinatura_cpf: sig.cpf_signatario,
      assinatura_data: sig.data_assinatura,
      assinatura_autoridade: sig.autoridade,
      assinatura_icp_brasil: sig.icp_brasil,
      assinatura_motivo_falha: conforme ? null : motivos.join(" "),
      assinatura_detalhes_json: sig as unknown as Record<string, unknown>,
      updated_at: agoraIso,
    }).eq("id", declaracaoId);

    try {
      const metadados = {
        declaracao_residencia_id: declaracaoId,
        bucket: BUCKET,
        assinatura: sig,
        motivos,
        ...sessaoBase,
      };
      const { data: existente } = await sb
        .from("qa_documentos_cliente")
        .select("id")
        .eq("tipo_documento", "declaracao_responsavel_imovel")
        .eq("metadados_documento_json->>declaracao_residencia_id", declaracaoId)
        .neq("status", "excluido")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const comum = {
        arquivo_storage_path: path,
        arquivo_nome: "declaracao-responsavel-imovel-assinada.pdf",
        arquivo_mime: "application/pdf",
        status: conforme ? "aprovado" : "reprovado",
        motivo_reprovacao: conforme ? null : motivos.join(" "),
        data_emissao: agoraIso.slice(0, 10),
        metadados_documento_json: metadados,
        updated_at: agoraIso,
      };
      if (existente?.id) {
        await sb.from("qa_documentos_cliente").update(comum).eq("id", existente.id);
      } else {
        await sb.from("qa_documentos_cliente").insert({
          qa_cliente_id: Number((decl as any).qa_cliente_id),
          tipo_documento: "declaracao_responsavel_imovel",
          nome_documento: "Declara\u00e7\u00e3o do respons\u00e1vel pelo im\u00f3vel (assinada Gov.br)",
          origem: "cliente",
          ia_status: "nao_processado",
          categoria_hub: "juridico",
          escopo_documental: "processo",
          reaproveitavel_global: false,
          revisao_humana_obrigatoria: false,
          ...comum,
        });
      }
    } catch (e) {
      console.error("[qa-declaracao-residencia] hub upsert falhou", (e as Error).message);
    }

    // REGRA: o comprovante de endereco em nome de terceiro fica AGUARDANDO ate
    // aqui. Ele so e aprovado (exigencia cumprida) quando a declaracao do
    // responsavel pelo imovel e validada. Se a assinatura falhar, o comprovante
    // continua pendente com o motivo visivel para o cliente.
    try {
      const comprovanteId = (decl as any)?.documento_comprovante_id as string | null;
      if (comprovanteId) {
        await sb
          .from("qa_documentos_cliente")
          .update(
            conforme
              ? {
                  status: "aprovado",
                  aprovado_em: agoraIso,
                  motivo_reprovacao: null,
                  updated_at: agoraIso,
                }
              : {
                  status: "pendente_aprovacao",
                  motivo_reprovacao:
                    "Aguardando a declaracao do responsavel pelo imovel assinada no GOV.BR. " +
                    motivos.join(" "),
                  updated_at: agoraIso,
                },
          )
          .eq("id", comprovanteId);
      }
    } catch (e) {
      console.error("[qa-declaracao-residencia] comprovante update falhou", (e as Error).message);
    }

    return json({
      ok: true,
      conforme,
      motivos,
      assinatura: sig,
      status: conforme ? "assinada_validada" : "assinada_rejeitada",
    });
  }

  return json({ error: `A\u00e7\u00e3o desconhecida: ${acao}` }, 400);
});
