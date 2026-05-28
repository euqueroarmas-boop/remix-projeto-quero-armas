// qa-processo-doc-upload
// HARDENING:
// - Aceita parâmetros do front (storage_key/file_name) E nomes legados (storage_path/nome_arquivo_original).
// - Enforcement REAL de formato_aceito (bloqueia ANTES da IA).
// - Enforcement REAL de tamanho mínimo / máximo (qualidade de imagem) e tamanho máximo absoluto.
// - Atualiza status para "em_analise" e dispara validação IA via qa-processo-doc-validar-ia.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_BYTES = 20 * 1024 * 1024; // 20MB absoluto
const MIN_IMG_BYTES = 40 * 1024;    // 40KB mínimo p/ foto (evita JPG borrado/cortado de baixíssima resolução)
const MIN_PDF_BYTES = 8 * 1024;     // 8KB mínimo p/ PDF (evita PDF vazio/corrompido)

function extOf(name: string | undefined | null, mime: string | undefined | null): string {
  const fromName = (name?.split(".").pop() || "").toLowerCase().trim();
  if (fromName) return fromName;
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return "";
}

// Normaliza valores de formato_aceito (que podem vir como MIME types tipo
// "application/pdf", "APPLICATION/PDF", "image/jpeg" ou como extensões "pdf",
// "jpg") para uma extensão canônica em minúsculo. Garante que a comparação
// seja sempre case-insensitive e independente de MIME vs extensão.
function normalizeFmt(raw: unknown): string {
  const v = String(raw ?? "").toLowerCase().trim();
  if (!v) return "";
  if (v.includes("/")) {
    if (v.includes("pdf")) return "pdf";
    if (v.includes("png")) return "png";
    if (v.includes("jpeg") || v.includes("jpg")) return "jpg";
    const tail = v.split("/").pop() || "";
    return tail;
  }
  if (v === "jpeg") return "jpg";
  return v;
}

const TIPO_CERTIDAO_ALTERACAO_NOME = "certidao_alteracao_nome";

function arquivoPareceCertidaoAlteracaoNome(nome: string | undefined | null): boolean {
  const n = String(nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(certidao|casamento|nascimento|averbac|averbad|alteracao.*nome|nome.*alteracao)/.test(n);
}

function docTemDivergenciaNome(doc: any): boolean {
  const divs = Array.isArray(doc?.divergencias_json) ? doc.divergencias_json : [];
  if (divs.some((d: any) => /^(nome|nome_titular|titular|nome_completo)$/i.test(String(d?.campo || "")))) return true;
  return /\bnome\b|\btitular\b/i.test(String(doc?.motivo_rejeicao || ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const supabase = createClient(url, service);

    const body = await req.json();
    const documento_id: string | undefined = body?.documento_id;
    // Aceita ambos os nomes
    const storage_path: string | undefined = body?.storage_path || body?.storage_key;
    const nome_arquivo_original: string | undefined = body?.nome_arquivo_original || body?.file_name;
    const mime_type: string | undefined = body?.mime_type;
    const tamanho_bytes: number | undefined = body?.tamanho_bytes;
    const skip_ia: boolean = !!body?.skip_ia;

    if (!documento_id || !storage_path) {
      return json({ error: "documento_id e storage_path/storage_key são obrigatórios" }, 400);
    }

    // Carrega item do checklist
    const { data: docRow0, error: docErr } = await supabase
      .from("qa_processo_documentos")
      .select("id, processo_id, cliente_id, tipo_documento, nome_documento, formato_aceito, regra_validacao, status, motivo_rejeicao, divergencias_json")
      .eq("id", documento_id)
      .maybeSingle();
    if (docErr || !docRow0) return json({ error: "Item do checklist não encontrado" }, 404);

    const processo_id = docRow0.processo_id;
    let documentoIdAlvo = documento_id;
    let docUpload: any = docRow0;

    // Verifica permissão: ou staff QA ou cliente dono do processo
    const { data: staffRow } = await supabase
      .from("qa_usuarios_perfis")
      .select("perfil")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    const { data: processo } = await supabase
      .from("qa_processos")
      .select("id, cliente_id, status")
      .eq("id", processo_id)
      .maybeSingle();
    if (!processo) return json({ error: "Processo não encontrado" }, 404);

    if (!staffRow) {
      const { data: link } = await supabase
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", userId)
        .eq("qa_cliente_id", processo.cliente_id)
        .maybeSingle();
      if (!link) return json({ error: "Sem permissão para este processo" }, 403);
    }

    // Proteção crítica: se o cliente anexar uma certidão averbada enquanto o
    // item ativo ainda é um comprovante divergente por nome, redirecionamos o
    // upload para a pendência própria. A IA nunca deve validar certidão como
    // comprovante_endereco_ano_YYYY.
    if (
      docRow0.tipo_documento !== TIPO_CERTIDAO_ALTERACAO_NOME &&
      docTemDivergenciaNome(docRow0) &&
      arquivoPareceCertidaoAlteracaoNome(nome_arquivo_original)
    ) {
      const { data: existente } = await supabase
        .from("qa_processo_documentos")
        .select("*")
        .eq("processo_id", processo_id)
        .eq("tipo_documento", TIPO_CERTIDAO_ALTERACAO_NOME)
        .maybeSingle();

      if (existente?.id) {
        documentoIdAlvo = existente.id;
        docUpload = existente;
      } else {
        const { data: criada, error: criaErr } = await supabase
          .from("qa_processo_documentos")
          .insert({
            processo_id,
            cliente_id: processo.cliente_id,
            tipo_documento: TIPO_CERTIDAO_ALTERACAO_NOME,
            nome_documento: "Certidão averbada de alteração de nome",
            etapa: "complementar",
            obrigatorio: true,
            formato_aceito: ["pdf", "jpg", "jpeg", "png"],
            status: "pendente",
            regra_validacao: {
              descricao: "Certidão de casamento ou nascimento averbada que comprova alteração de nome em cartório.",
              exige: ["nome_anterior", "nome_atual"],
            },
            instrucoes: "Envie sua certidão de casamento ou nascimento averbada para comprovar a alteração do seu nome.",
          })
          .select("*")
          .maybeSingle();
        if (criaErr || !criada) return json({ error: criaErr?.message || "Falha ao criar pendência da certidão" }, 500);
        documentoIdAlvo = criada.id;
        docUpload = criada;
      }

      await supabase.from("qa_processo_eventos").insert({
        processo_id,
        documento_id: documentoIdAlvo,
        tipo_evento: "upload_certidao_redirecionado",
        descricao: "Certidão averbada enviada a partir de divergência de nome foi associada ao item correto.",
        dados_json: { documento_origem_id: documento_id, tipo_origem: docRow0.tipo_documento },
        ator: "sistema",
      });
    }

    // Verifica que o arquivo existe no storage e descobre o tamanho real (anti-spoof do client)
    const { data: blob, error: dlErr } = await supabase.storage
      .from("qa-processo-docs")
      .download(storage_path);
    if (dlErr || !blob) return json({ error: "Arquivo não encontrado no storage" }, 400);

    const realSize = blob.size ?? 0;
    const realMime = blob.type || mime_type || "";
    const ext = extOf(nome_arquivo_original, realMime);

    // ===== Enforcement de formato =====
    // Normaliza para extensão canônica em minúsculo dos dois lados (banco pode
    // ter "application/pdf", "APPLICATION/PDF", "pdf", etc.).
    const formatosAceitos: string[] = Array.isArray(docUpload.formato_aceito)
      ? (docUpload.formato_aceito as string[]).map(normalizeFmt).filter(Boolean)
      : [];
    const extNorm = normalizeFmt(ext);

    if (formatosAceitos.length > 0 && !formatosAceitos.includes(extNorm)) {
      // Bloqueia antes da IA, registra evento + status invalido
      const motivo =
        formatosAceitos.length === 1 && formatosAceitos[0] === "pdf"
          ? "Este documento deve ser enviado exclusivamente em PDF."
          : `Formato não aceito. Envie: ${formatosAceitos.join(", ").toUpperCase()}.`;

      await supabase.from("qa_processo_documentos").update({
        arquivo_storage_key: storage_path,
        status: "invalido",
        motivo_rejeicao: motivo,
        data_envio: new Date().toISOString(),
        validacao_ia_status: "bloqueado_pre_ia",
        validacao_ia_erro: "formato_invalido",
      }).eq("id", documentoIdAlvo);

      await supabase.from("qa_processo_eventos").insert({
        processo_id, documento_id: documentoIdAlvo,
        tipo_evento: "upload_bloqueado_formato",
        descricao: motivo,
        dados_json: { formatos_aceitos: formatosAceitos, recebido: ext, mime: realMime, bytes: realSize },
        ator: "sistema",
      });

      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: "documento_invalido", motivo },
        });
      } catch (_) {}

      return json({ error: motivo, code: "formato_invalido" }, 400);
    }

    // ===== Enforcement de tamanho/qualidade =====
    if (realSize > MAX_BYTES) {
      const motivo = "Arquivo excede o limite de 20MB.";
      await supabase.from("qa_processo_documentos").update({
        status: "invalido", motivo_rejeicao: motivo,
        validacao_ia_status: "bloqueado_pre_ia", validacao_ia_erro: "arquivo_muito_grande",
      }).eq("id", documentoIdAlvo);
      return json({ error: motivo, code: "arquivo_muito_grande" }, 400);
    }
    const isImage = ["jpg", "jpeg", "png"].includes(ext);
    const isPdf = ext === "pdf";
    if (isImage && realSize < MIN_IMG_BYTES) {
      const motivo = "Imagem com qualidade insuficiente. Reenvie uma foto nítida e sem cortes, preferencialmente como PDF escaneado.";
      await supabase.from("qa_processo_documentos").update({
        arquivo_storage_key: storage_path,
        status: "invalido", motivo_rejeicao: motivo,
        validacao_ia_status: "bloqueado_pre_ia", validacao_ia_erro: "imagem_baixa_qualidade",
      }).eq("id", documentoIdAlvo);
      await supabase.from("qa_processo_eventos").insert({
        processo_id, documento_id: documentoIdAlvo,
        tipo_evento: "upload_bloqueado_qualidade",
        descricao: motivo,
        dados_json: { bytes: realSize, ext },
        ator: "sistema",
      });
      try {
        await supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id, evento: "documento_invalido", motivo },
        });
      } catch (_) {}
      return json({ error: motivo, code: "imagem_baixa_qualidade" }, 400);
    }
    if (isPdf && realSize < MIN_PDF_BYTES) {
      const motivo = "PDF parece vazio ou corrompido. Reenvie o documento.";
      await supabase.from("qa_processo_documentos").update({
        status: "invalido", motivo_rejeicao: motivo,
        validacao_ia_status: "bloqueado_pre_ia", validacao_ia_erro: "pdf_invalido",
      }).eq("id", documentoIdAlvo);
      return json({ error: motivo, code: "pdf_invalido" }, 400);
    }

    // ===== OK: registra envio e dispara IA =====
    const { data: docRow, error: upErr } = await supabase
      .from("qa_processo_documentos")
      .update({
        arquivo_storage_key: storage_path,
        arquivo_url: null,
        status: "em_analise",
        data_envio: new Date().toISOString(),
        motivo_rejeicao: null,
        validacao_ia_status: "fila",
        validacao_ia_erro: null,
        observacoes: nome_arquivo_original
          ? `arquivo:${nome_arquivo_original}|mime:${realMime}|bytes:${realSize}`
          : `mime:${realMime}|bytes:${realSize}`,
      })
      .eq("id", documentoIdAlvo)
      .eq("processo_id", processo_id)
      .select()
      .single();

    if (upErr) return json({ error: upErr.message }, 400);

    let iaTriggered = false;
    if (!skip_ia) {
      try {
        // @ts-ignore EdgeRuntime
        (globalThis as any).EdgeRuntime?.waitUntil(
          fetch(`${url}/functions/v1/qa-processo-doc-validar-ia`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${service}`,
              "x-internal-call": "1",
            },
            body: JSON.stringify({ processo_id, documento_id: documentoIdAlvo, storage_path }),
          }).then(r => r.text()).catch(e => console.error("IA dispatch err:", e))
        );
        iaTriggered = true;
      } catch (e) {
        console.error("Falha ao agendar IA:", e);
      }
    }

    try {
      // @ts-ignore EdgeRuntime
      (globalThis as any).EdgeRuntime?.waitUntil(
        supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id, documento_id: documentoIdAlvo, evento: "documento_em_validacao" },
        }).catch((e: any) => console.warn("[upload] notif falhou:", e?.message ?? e)),
      );
    } catch (_) {}

    return json({
      success: true,
      documento: docRow,
      documento_id_alvo: documentoIdAlvo,
      redirecionado: documentoIdAlvo !== documento_id,
      ia_em_analise: iaTriggered,
    });
  } catch (err: any) {
    console.error("qa-processo-doc-upload:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});
