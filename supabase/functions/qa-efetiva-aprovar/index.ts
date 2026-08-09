/**
 * qa-efetiva-aprovar — o cliente leu, ajustou se quis, e concordou.
 *
 * O que acontece aqui, na ordem:
 *  1) grava o texto FINAL (o que ele aprovou, editado ou não) e o carimbo da
 *     conexão: data/hora BRT, IP, user-agent, idioma e hash SHA-256 do texto;
 *  2) monta UM ÚNICO arquivo (dossiê): capa + respostas + relato aprovado +
 *     carimbo + todos os anexos que ele enviou, na sequência;
 *  3) assina digitalmente esse arquivo com o certificado A1 ICP-Brasil da
 *     empresa, quando houver — é a prova de integridade do que foi aceito;
 *  4) envia por e-mail ao cliente o link do arquivo assinado;
 *  5) libera o agendamento dos exames.
 *
 * Não há revisão humana antes: a concordância do cliente é o ato. É o que
 * transforma o material em base probatória da defesa dele.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import { addPlaceholderAndSign } from "../_shared/pdfSign.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "qa-documentos";
const CERT_BUCKET = "certificates";
const CERT_FOLDER = "a1-certificates";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decryptAesGcm(encryptedBytes: Uint8Array): Promise<Uint8Array> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const km = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key).slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = encryptedBytes.slice(0, 12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, km, encryptedBytes.slice(12));
  return new Uint8Array(dec);
}

const brt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Latin-1 apenas: as fontes padrão do pdf-lib não têm glifo para o resto. */
function limparParaPdf(s: string): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // deno-lint-ignore no-control-regex
    .replace(/[^\x00-\xFF]/g, "");
}

function quebrar(texto: string, font: any, size: number, maxWidth: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of limparParaPdf(texto).split("\n")) {
    if (!paragrafo.trim()) { linhas.push(""); continue; }
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (font.widthOfTextAtSize(teste, size) <= maxWidth) atual = teste;
      else { if (atual) linhas.push(atual); atual = palavra; }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const registroId = body?.registro_id as string | undefined;
    const textoFinal = String(body?.texto_final ?? "").trim();
    const textoBo = String(body?.texto_bo ?? "").trim().slice(0, 500);
    const textoBoEditado = Boolean(body?.texto_bo_editado);
    const editado = Boolean(body?.editado);
    if (!registroId || textoFinal.length < 200) {
      return json({ error: "registro_id e texto_final são obrigatórios" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reg } = await sb
      .from("qa_efetiva_necessidade")
      .select("*")
      .eq("id", registroId)
      .maybeSingle();
    if (!reg) return json({ error: "Registro não encontrado" }, 404);

    const { data: cliente } = await sb
      .from("qa_clientes")
      .select("nome_completo, email, cpf, profissao, cidade, estado")
      .eq("id", reg.cliente_id)
      .maybeSingle();

    const { data: linkBo } = await sb
      .from("qa_bo_links_uf")
      .select("uf, nome_orgao, url_abrir, url_acompanhar, observacao")
      .eq("uf", String(cliente?.estado ?? "").toUpperCase())
      .maybeSingle();

    const { data: provas } = await sb
      .from("qa_efetiva_necessidade_provas")
      .select("tipo, numero, orgao, data_fato, naturezas, arquivo_nome, arquivo_storage_path")
      .eq("efetiva_necessidade_id", registroId)
      .order("created_at");

    const { data: acrescimos } = await sb
      .from("qa_efetiva_necessidade_acrescimos")
      .select("texto, created_at")
      .eq("efetiva_necessidade_id", registroId)
      .order("ordem");

    /* ── 1) Carimbo da conexão ─────────────────────────────────────────── */
    const agora = new Date();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ?? null;
    const ua = body?.user_agent ?? req.headers.get("user-agent");
    const idioma = body?.accept_language ?? req.headers.get("accept-language");
    const hashTexto = await sha256Hex(new TextEncoder().encode(textoFinal));

    /* ── 2) Dossiê único ───────────────────────────────────────────────── */
    const pdfLib = await import("npm:pdf-lib@1.17.1");
    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const doc = await PDFDocument.create();
    const fonte = await doc.embedFont(StandardFonts.Helvetica);
    const fonteBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const M = 56;
    const W = 595.28, H = 841.89;
    let page = doc.addPage([W, H]);
    let y = H - M;

    const escrever = (texto: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
      const size = opts.size ?? 10.5;
      const f = opts.bold ? fonteBold : fonte;
      for (const linha of quebrar(texto, f, size, W - M * 2)) {
        if (y < M + 40) { page = doc.addPage([W, H]); y = H - M; }
        if (linha) page.drawText(linha, { x: M, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 4;
      }
      y -= opts.gap ?? 6;
    };

    escrever("ARSENAL INTELIGENTE - QUERO ARMAS", { size: 9, bold: true, gap: 2 });
    escrever("RELATO DE EFETIVA NECESSIDADE APROVADO PELO REQUERENTE", { size: 14, bold: true, gap: 10 });
    escrever(
      `Requerente: ${cliente?.nome_completo ?? "-"}${cliente?.cpf ? ` - CPF ${cliente.cpf}` : ""}\n` +
        `Profissao declarada: ${cliente?.profissao ?? "-"}\n` +
        `Aprovado em: ${brt(agora)} (BRT)\n` +
        `Texto ${editado ? "editado pelo proprio requerente antes da aprovacao" : "aprovado sem alteracoes"}`,
      { size: 10, gap: 12 },
    );

    escrever("1. RESPOSTAS DO QUESTIONARIO", { size: 11.5, bold: true, gap: 4 });
    const simNao = (v: boolean | null) => (v === true ? "SIM" : v === false ? "NAO" : "nao respondeu");
    escrever(
      `Boletim de ocorrencia registrado: ${simNao(reg.tem_bo)}\n` +
        `Inquerito policial instaurado: ${simNao(reg.tem_inquerito)}\n` +
        `Acao criminal movida: ${simNao(reg.tem_acao_criminal)}\n` +
        `Sofre ou se sente ameacado: ${simNao(reg.sofre_ameaca)}`,
      { size: 10, gap: 12 },
    );

    escrever("2. PROVAS ANEXADAS", { size: 11.5, bold: true, gap: 4 });
    escrever(
      (provas ?? []).length
        ? (provas ?? []).map((p: any, i: number) =>
          `${i + 1}. ${p.tipo}${p.numero ? ` no ${p.numero}` : ""}${p.orgao ? ` - ${p.orgao}` : ""}` +
          `${p.data_fato ? ` - fato em ${p.data_fato}` : ""} - arquivo: ${p.arquivo_nome ?? "-"}`
        ).join("\n")
        : "Nenhuma prova documental anexada. O relato abaixo e o material integral.",
      { size: 10, gap: 12 },
    );

    escrever("3. RELATO APROVADO PELO REQUERENTE", { size: 11.5, bold: true, gap: 4 });
    escrever(textoFinal, { size: 10.5, gap: 14 });

    let secao = 4;
    if ((acrescimos ?? []).length) {
      escrever(`${secao}. FATOS ACRESCENTADOS PELO REQUERENTE`, { size: 11.5, bold: true, gap: 4 });
      escrever(
        (acrescimos ?? []).map((a: any, i: number) =>
          `${i + 1}. (${brt(new Date(a.created_at))}) ${a.texto}`
        ).join("\n\n"),
        { size: 10, gap: 12 },
      );
      secao += 1;
    }

    if (textoBo) {
      escrever(`${secao}. TEXTO PARA REGISTRO DE BOLETIM DE OCORRENCIA`, { size: 11.5, bold: true, gap: 4 });
      escrever(textoBo, { size: 10.5, gap: 12 });
      secao += 1;
    }

    escrever(`${secao}. REGISTRO DE SESSAO - MP 2.200-2/2001`, { size: 11.5, bold: true, gap: 4 });
    escrever(
      `DATA/HORA (BRT): ${brt(agora)}\n` +
        `IP: ${ip ?? "-"}\n` +
        `USER-AGENT: ${ua ?? "-"}\n` +
        `IDIOMA: ${idioma ?? "-"}\n` +
        `ACAO: aprovacao eletronica do relato de efetiva necessidade\n` +
        `HASH SHA-256 DO TEXTO: ${hashTexto}`,
      { size: 9, gap: 4 },
    );

    // Anexos, na sequência, dentro do MESMO arquivo.
    for (const p of provas ?? []) {
      if (!p.arquivo_storage_path) continue;
      try {
        const { data: file } = await sb.storage.from(BUCKET).download(p.arquivo_storage_path);
        if (!file) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const nome = String(p.arquivo_nome ?? "").toLowerCase();
        if (nome.endsWith(".pdf") || bytes[0] === 0x25) {
          const anexo = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const paginas = await doc.copyPages(anexo, anexo.getPageIndices());
          paginas.forEach((pg) => doc.addPage(pg));
        } else {
          const img = nome.endsWith(".png")
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
          const pg = doc.addPage([W, H]);
          const escala = Math.min((W - 80) / img.width, (H - 120) / img.height);
          pg.drawImage(img, {
            x: (W - img.width * escala) / 2,
            y: (H - img.height * escala) / 2,
            width: img.width * escala,
            height: img.height * escala,
          });
        }
      } catch (e) {
        console.warn("[qa-efetiva-aprovar] anexo ignorado:", p.arquivo_storage_path, e);
      }
    }

    /* ── 3) Assinatura ICP-Brasil (quando houver certificado ativo) ─────── */
    let finalBytes = new Uint8Array(await doc.save({ useObjectStreams: false }));
    let assinado = false;
    try {
      const { data: cfg } = await sb
        .from("certificate_config")
        .select("*")
        .eq("status", "active")
        .eq("auto_sign_enabled", true)
        .maybeSingle();
      if (cfg && (!cfg.valid_to || new Date(cfg.valid_to) >= new Date())) {
        const { data: certData } = await sb.storage.from(CERT_BUCKET).download(cfg.certificate_storage_path);
        const { data: passData } = await sb.storage
          .from(CERT_BUCKET)
          .download(`${CERT_FOLDER}/${cfg.certificate_hash}.key`);
        if (certData && passData) {
          const pfx = await decryptAesGcm(new Uint8Array(await certData.arrayBuffer()));
          const senha = new TextDecoder().decode(await decryptAesGcm(base64Decode(await passData.text())));
          const paraAssinar = await PDFDocument.load(finalBytes);
          const { signedPdf } = await addPlaceholderAndSign(paraAssinar, pfx, senha, {
            reason: "Relato de efetiva necessidade aprovado pelo requerente",
            location: "Brasil",
            contactInfo: "contato@queroarmas.com.br",
            signerName: "Quero Armas",
            usePades: true,
          });
          finalBytes = signedPdf;
          assinado = true;
        }
      }
    } catch (e) {
      console.warn("[qa-efetiva-aprovar] assinatura indisponivel:", e);
    }

    const path = `cliente-docs/qa-${reg.cliente_id}/efetiva_necessidade/dossie_${registroId}.pdf`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, finalBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: "Falha ao gerar o arquivo", details: upErr.message }, 500);

    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);

    /* ── 4) Persistência ───────────────────────────────────────────────── */
    await sb.from("qa_efetiva_necessidade").update({
      narrativa_final: textoFinal,
      narrativa_editada_pelo_cliente: editado,
      texto_bo: textoBo || null,
      texto_bo_editado_pelo_cliente: textoBoEditado,
      bo_pendente_registro: Boolean(textoBo),
      aprovado_cliente: true,
      aprovado_cliente_em: agora.toISOString(),
      aprovacao_ip: ip,
      aprovacao_user_agent: ua,
      aprovacao_accept_language: idioma,
      aprovacao_hash: hashTexto,
      dossie_storage_path: path,
      dossie_gerado_em: agora.toISOString(),
      exames_liberados_em: agora.toISOString(),
      enviado_equipe_em: agora.toISOString(),
      status: "aprovado",
      updated_at: agora.toISOString(),
    }).eq("id", registroId);

    /* ── 5) E-mail com o arquivo único ─────────────────────────────────── */
    if (cliente?.email && signed?.signedUrl) {
      const esc = (s: string) =>
        String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const paragrafos = textoFinal.split("\n").filter((l) => l.trim())
        .map((l) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#222">${esc(l)}</p>`)
        .join("");
      const html = `
        <p style="font-size:15px;color:#111"><strong>${esc(cliente.nome_completo ?? "")}</strong>, o seu relato de efetiva necessidade foi aprovado por você.</p>
        <p style="font-size:13px;color:#555">Segue abaixo exatamente o texto que você aprovou. Em anexo (link), o arquivo único${assinado ? " assinado digitalmente" : ""} com este relato, as suas respostas e todos os documentos que você enviou.</p>
        <div style="border-left:3px solid #7A1F2B;padding-left:14px;margin:18px 0">${paragrafos}</div>
        <p style="margin:18px 0"><a href="${signed.signedUrl}" style="background:#7A1F2B;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold">BAIXAR O ARQUIVO COMPLETO</a></p>
        <p style="font-size:11px;color:#777;line-height:1.5">
          APROVADO POR VOCÊ — Data/hora (BRT): ${esc(brt(agora))} · IP: ${esc(ip ?? "-")} ·
          Dispositivo: ${esc(String(ua ?? "-").slice(0, 160))} · Idioma: ${esc(idioma ?? "-")} ·
          Hash SHA-256 do texto: ${esc(hashTexto)}<br/>
          Registro de sessão nos termos da MP 2.200-2/2001. O link do arquivo expira em 30 dias; ele continua disponível na sua área do cliente.
        </p>
        <p style="font-size:13px;color:#111;margin-top:16px"><strong>Próximo passo:</strong> o agendamento dos seus exames (psicológico e de tiro) já está liberado na área do cliente.</p>`;
      const blocoBo = textoBo
        ? `
        <div style="margin:22px 0;padding:16px;border:1px solid #e5e5e5;border-radius:8px">
          <p style="margin:0 0 8px;font-size:13px;color:#111"><strong>Texto para você registrar o boletim de ocorrência</strong></p>
          <p style="margin:0 0 12px;font-size:12px;color:#555">Copie o texto abaixo e use no registro da ocorrência. Depois, envie o boletim de volta na sua área do cliente.</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#222;background:#faf7f7;padding:12px;border-left:3px solid #7A1F2B">${esc(textoBo)}</p>
          ${linkBo?.url_abrir
            ? `<p style="margin:0 0 6px;font-size:12px;color:#333">Registrar (${esc(linkBo.uf)}): <a href="${esc(linkBo.url_abrir)}">${esc(linkBo.nome_orgao ?? linkBo.url_abrir)}</a></p>`
            : `<p style="margin:0 0 6px;font-size:12px;color:#333">Procure a delegacia eletrônica da Polícia Civil do seu estado para registrar.</p>`}
          ${linkBo?.url_acompanhar
            ? `<p style="margin:0 0 6px;font-size:12px;color:#333">Acompanhar andamento: <a href="${esc(linkBo.url_acompanhar)}">${esc(linkBo.url_acompanhar)}</a></p>`
            : ""}
          ${linkBo?.observacao ? `<p style="margin:0;font-size:11px;color:#777">${esc(linkBo.observacao)}</p>` : ""}
        </div>`
        : "";
      await sendTransactional({
        templateName: "arsenal-generic",
        recipientEmail: cliente.email,
        idempotencyKey: `efetiva-aprovada-${registroId}`,
        templateData: { subject: "Seu relato de efetiva necessidade foi aprovado", html: html + blocoBo },
      });
    }

    return json({ ok: true, assinado, dossie_path: path, url: signed?.signedUrl ?? null });
  } catch (e) {
    console.error("[qa-efetiva-aprovar]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});