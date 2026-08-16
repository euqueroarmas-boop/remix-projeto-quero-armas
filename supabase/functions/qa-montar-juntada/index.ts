// ============================================================================
// qa-montar-juntada — Bloco 3: o dossiê vira um arquivo só, sozinho
// ----------------------------------------------------------------------------
// A "JUNTADA" é o PDF único que a equipe entrega na Polícia Federal. Hoje ela é
// montada à mão: alguém baixa documento por documento, ordena, converte foto em
// página e concatena. Nos casos reais que analisamos deu 42, 55 e 106 páginas —
// e o próprio site da PF exige arquivo único ("digitalizar todos os documentos
// em um único arquivo .pdf e anexar no campo Todos os documentos exigidos").
//
// Aqui isso vira um clique. A ordem NÃO é a de chegada dos documentos: é a
// ordem canônica do protocolo (`_shared/ordemProtocolo.ts`), a mesma numeração
// do ZIP de referência da equipe — 1.0 requerimento, 1.1 GRU, 1.2 petição,
// 2 foto, 3 identidade, 4 residência, 5 ocupação, 6-12 idoneidade, 13-14 laudos.
//
// DUAS REGRAS DE OURO:
//   1. Só entra documento APROVADO.
//   2. Só entra documento VIGENTE. Achou vencido, nada é montado: as linhas
//      voltam a ser pendência e o cliente reenvia antes de qualquer coisa
//      seguir. Certidão e comprovante de residência vivem ~30 dias, e um
//      processo que demorou juntando laudo chega ao protocolo com metade da
//      papelada fora do prazo. Entregar assim não economiza tempo — vira
//      exigência, mais 10 dias e o dossiê refeito.
//
// Entrada (POST, staff): { processo_id }
// Saída: { ok, storage_path, paginas, itens: [...], ignorados: [...] }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";
import { compararProtocolo, posicaoProtocolo } from "../_shared/ordemProtocolo.ts";
import { estaVencido, hojeISOBRT, validadeVigente } from "../_shared/vigenciaDossie.ts";

const corsHeaders = qaAuthCors;

/** Bucket dos documentos do processo (mesmo do upload do portal). */
const BUCKET_PROCESSO = "qa-processo-docs";
/** Bucket do Hub / documentos do cliente. */
const BUCKET_HUB = "qa-documentos";

/** A4 em pontos — as imagens são centralizadas nesta página. */
const PAG_W = 595.28;
const PAG_H = 841.89;

/** Status que valem como documento pronto para ir à delegacia. */
const STATUS_APROVADOS = new Set([
  "aprovado",
  "entregue_pelo_hub",
  "dispensado_por_reaproveitamento",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ItemJuntada {
  /** id da linha de origem — usado para reabrir a pendência quando vencido. */
  origem_id: string;
  origem_tabela: "qa_processo_documentos" | "qa_documentos_cliente";
  tipo_documento: string;
  nome_documento: string | null;
  storage_path: string;
  bucket: string;
  numero: string;
  grupo: number;
  grupoNome: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const processoId = String(body?.processo_id ?? "").trim();
    if (!processoId) return json({ error: "processo_id é obrigatório." }, 400);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_id")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado." }, 404);

    // ── 1) Documentos do processo ────────────────────────────────────────
    const { data: docsProcesso } = await admin
      .from("qa_processo_documentos")
      .select("id, tipo_documento, nome_documento, status, arquivo_storage_key, data_validade, data_validade_efetiva")
      .eq("processo_id", processoId);

    // ── 2) Documentos do Hub do cliente (identidade, certidões, laudos) ──
    //     Entram porque muita exigência é satisfeita por reaproveitamento: o
    //     documento vive no Hub e a linha do processo só aponta para ele.
    const { data: docsHub } = await admin
      .from("qa_documentos_cliente")
      .select("id, tipo_documento, nome_documento, status, arquivo_storage_path, data_validade")
      .eq("qa_cliente_id", processo.cliente_id);

    const itens: ItemJuntada[] = [];
    const ignorados: Array<{ tipo: string; motivo: string }> = [];
    const jaVisto = new Set<string>();

    const vencidos: Array<{ tipo: string; nome: string | null; venceu_em: string | null }> = [];
    const hoje = hojeISOBRT();

    const considerar = (
      tipo: string,
      nome: string | null,
      status: string,
      caminho: string | null,
      bucket: string,
      origemId: string,
      origemTabela: "qa_processo_documentos" | "qa_documentos_cliente",
      validade: { data_validade?: string | null; data_validade_efetiva?: string | null },
    ) => {
      const t = String(tipo || "").toLowerCase().trim();
      if (!t) return;
      // A juntada assinada é o PRODUTO deste processo — se entrasse aqui,
      // a juntada conteria a si mesma na rodada seguinte.
      if (t === "juntada_assinada" || t === "credencial_gov_br") return;
      if (!STATUS_APROVADOS.has(String(status || "").toLowerCase())) {
        ignorados.push({ tipo: t, motivo: `status ${status || "vazio"}` });
        return;
      }
      if (!caminho) {
        ignorados.push({ tipo: t, motivo: "sem arquivo no storage" });
        return;
      }
      // Um tipo entra uma vez só: Hub e processo costumam apontar para o
      // mesmo documento, e duplicar página no dossiê confunde o analista.
      if (jaVisto.has(t)) return;
      jaVisto.add(t);

      // VENCIDO NÃO ENTRA. O dossiê inteiro é barrado até o cliente reenviar —
      // documento fora do prazo dentro da juntada é exigência garantida.
      if (estaVencido(validade, hoje)) {
        vencidos.push({ tipo: t, nome, venceu_em: validadeVigente(validade) });
        return;
      }

      const pos = posicaoProtocolo(t, nome);
      itens.push({
        origem_id: origemId,
        origem_tabela: origemTabela,
        tipo_documento: t,
        nome_documento: nome,
        storage_path: caminho,
        bucket,
        numero: pos.numero,
        grupo: pos.grupo,
        grupoNome: pos.grupoNome,
      });
    };

    for (const d of docsProcesso ?? []) {
      const r = d as Record<string, string | null>;
      considerar(
        String(r.tipo_documento ?? ""),
        r.nome_documento,
        String(r.status ?? ""),
        r.arquivo_storage_key,
        BUCKET_PROCESSO,
        String(r.id ?? ""),
        "qa_processo_documentos",
        { data_validade: r.data_validade, data_validade_efetiva: r.data_validade_efetiva },
      );
    }
    for (const d of docsHub ?? []) {
      const r = d as Record<string, string | null>;
      considerar(
        String(r.tipo_documento ?? ""),
        r.nome_documento,
        String(r.status ?? ""),
        r.arquivo_storage_path,
        BUCKET_HUB,
        String(r.id ?? ""),
        "qa_documentos_cliente",
        { data_validade: r.data_validade },
      );
    }

    // ── TRAVA DE VIGÊNCIA ────────────────────────────────────────────────
    // Achou vencido: nada é montado. As linhas do processo voltam a ser
    // pendência para o cliente reenviar — o pop-up guiado já as reapresenta na
    // ordem dos grupos, então basta devolvê-las ao estado pendente.
    if (vencidos.length > 0) {
      const tiposVencidos = vencidos.map((v) => v.tipo);
      await admin
        .from("qa_processo_documentos")
        .update({
          status: "pendente",
          motivo_rejeicao:
            "Documento vencido antes do protocolo. Envie uma versão vigente — a Polícia Federal "
            + "não aceita documento fora do prazo no dossiê.",
          data_validacao: null,
        })
        .eq("processo_id", processoId)
        .in("tipo_documento", tiposVencidos);

      await admin.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "juntada_bloqueada_vencidos",
        descricao: `JUNTADA BLOQUEADA — ${vencidos.length} documento(s) vencido(s) reabertos para reenvio`,
        ator: "sistema",
        dados_json: { vencidos },
      });

      return json({
        error: "Há documentos vencidos. O cliente precisa reenviar antes de montar a juntada.",
        vencidos,
        reabertos: tiposVencidos.length,
      }, 409);
    }

    if (itens.length === 0) {
      return json({ error: "Nenhum documento aprovado para montar a juntada.", ignorados }, 400);
    }

    itens.sort(compararProtocolo);

    // ── 3) Concatenação ──────────────────────────────────────────────────
    const dossie = await PDFDocument.create();
    dossie.setTitle(`Juntada de documentos — processo ${processoId}`);
    dossie.setProducer("Quero Armas");

    const incluidos: ItemJuntada[] = [];

    for (const item of itens) {
      try {
        const { data: file } = await admin.storage.from(item.bucket).download(item.storage_path);
        if (!file) {
          ignorados.push({ tipo: item.tipo_documento, motivo: "download falhou" });
          continue;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const nome = String(item.storage_path).toLowerCase();
        const ehPdf = nome.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50);

        if (ehPdf) {
          // ignoreEncryption: muita certidão sai do tribunal com permissões
          // restritas. Sem isso o dossiê inteiro falha por causa de uma delas.
          const anexo = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const paginas = await dossie.copyPages(anexo, anexo.getPageIndices());
          paginas.forEach((pg) => dossie.addPage(pg));
        } else {
          const img = nome.endsWith(".png")
            ? await dossie.embedPng(bytes)
            : await dossie.embedJpg(bytes);
          const pg = dossie.addPage([PAG_W, PAG_H]);
          const escala = Math.min((PAG_W - 40) / img.width, (PAG_H - 40) / img.height, 1);
          pg.drawImage(img, {
            x: (PAG_W - img.width * escala) / 2,
            y: (PAG_H - img.height * escala) / 2,
            width: img.width * escala,
            height: img.height * escala,
          });
        }
        incluidos.push(item);
      } catch (e) {
        // Um arquivo problemático não pode derrubar o dossiê inteiro — ele sai
        // da lista e aparece em `ignorados` para a equipe resolver.
        console.warn("[qa-montar-juntada] item ignorado:", item.storage_path, e);
        ignorados.push({ tipo: item.tipo_documento, motivo: "arquivo ilegível" });
      }
    }

    if (incluidos.length === 0) {
      return json({ error: "Nenhum arquivo pôde ser lido.", ignorados }, 400);
    }

    const bytesFinal = new Uint8Array(await dossie.save({ useObjectStreams: false }));

    // ── 4) Guarda no storage do processo ─────────────────────────────────
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    const destino = `${processo.cliente_id}/juntadas/juntada-${processoId}-${carimbo}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET_PROCESSO)
      .upload(destino, bytesFinal, { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: `Falha ao guardar a juntada: ${upErr.message}` }, 500);

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "juntada_montada",
      descricao:
        `JUNTADA MONTADA — ${incluidos.length} documentos, ${dossie.getPageCount()} páginas` +
        (ignorados.length ? ` (${ignorados.length} fora)` : ""),
      ator: "sistema",
      dados_json: {
        storage_path: destino,
        paginas: dossie.getPageCount(),
        itens: incluidos.map((i) => ({ numero: i.numero, tipo: i.tipo_documento })),
        ignorados,
      },
    });

    return json({
      ok: true,
      storage_path: destino,
      bucket: BUCKET_PROCESSO,
      paginas: dossie.getPageCount(),
      itens: incluidos.map((i) => ({
        numero: i.numero,
        grupo: i.grupo,
        grupo_nome: i.grupoNome,
        tipo_documento: i.tipo_documento,
        nome_documento: i.nome_documento,
      })),
      ignorados,
    });
  } catch (e) {
    console.error("[qa-montar-juntada]", e);
    return json({ error: "Erro ao montar a juntada." }, 500);
  }
});
