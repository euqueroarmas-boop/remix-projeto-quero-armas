import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function processJob(jobId: string) {
  const supabase = getSupabase();

  const { data: job, error: jobErr } = await supabase
    .from("qa_document_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    console.error("Job not found:", jobId);
    return;
  }

  if (job.status === "done" || job.status === "failed") {
    console.log(`Job ${jobId} already in terminal state: ${job.status}`);
    return;
  }

  let docId = job.documento_id as string | null;

  const updateJob = async (fields: Record<string, unknown>) => {
    await supabase
      .from("qa_document_jobs")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  };

  const updateDocumentStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!docId) return;
    await supabase
      .from("qa_documentos_conhecimento")
      .update({ status_processamento: status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", docId);
  };

  try {
    await updateJob({ status: "saved", etapa_atual: "verificando_arquivo", started_at: job.started_at || new Date().toISOString() });
    await updateDocumentStatus("verificando_arquivo");

    const storagePath = job.storage_path;
    if (!storagePath) throw new Error("storage_path ausente no job");

    const { data: fileCheck } = await supabase.storage.from("qa-documentos").createSignedUrl(storagePath, 10);
    if (!fileCheck?.signedUrl) throw new Error("Arquivo não encontrado no storage");

    await updateJob({ status: "saved", etapa_atual: "arquivo_confirmado" });
    await updateDocumentStatus("verificando_arquivo");

    if (!docId) {
      await updateJob({ status: "extracting", etapa_atual: "registrando_documento" });

      const papelDocumento = job.caso_id ? "auxiliar_caso" : "aprendizado";
      const ativoNaIa = papelDocumento === "aprendizado";

      const { data: docData, error: dbErr } = await supabase.from("qa_documentos_conhecimento").insert({
        titulo: job.nome_arquivo,
        nome_arquivo: job.nome_arquivo,
        storage_path: storagePath,
        tipo_documento: job.tipo_documental,
        tipo_origem: "arquivo_upload",
        papel_documento: papelDocumento,
        categoria: job.tipo_documental,
        status_processamento: "pendente",
        status_validacao: "validado",
        ativo: true,
        ativo_na_ia: ativoNaIa,
        caso_id: job.caso_id || null,
        enviado_por: job.user_id || null,
        mime_type: job.mime_type || null,
        tamanho_bytes: job.tamanho_bytes || null,
      }).select("id").single();

      if (dbErr) throw new Error(`Erro ao registrar documento: ${dbErr.message}`);
      docId = docData.id;
      await updateJob({ documento_id: docId });
    }

    await updateJob({ status: "extracting", etapa_atual: "extracao_texto" });
    await updateDocumentStatus("extraindo_texto", { resumo_extraido: null });

    const ingestResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-ingest-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ storage_path: storagePath, user_id: job.user_id }),
    });

    if (!ingestResp.ok) {
      const errBody = await ingestResp.text();
      throw new Error(`Falha ao iniciar ingestão (${ingestResp.status}): ${errBody || "sem detalhes"}`);
    }

    await ingestResp.text();
    await updateJob({ status: "processing", etapa_atual: "aguardando_extracao" });

    const MAX_POLL_SECONDS = 600;
    const POLL_INTERVAL = 4000;
    const pollStart = Date.now();
    let extractionDone = false;

    while (Date.now() - pollStart < MAX_POLL_SECONDS * 1000) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));

      const { data: check } = await supabase
        .from("qa_documentos_conhecimento")
        .select("status_processamento")
        .eq("id", docId)
        .maybeSingle();

      const st = check?.status_processamento;
      if (st === "concluido" || st === "gerando_embeddings") {
        extractionDone = true;
        break;
      }
      if (st === "erro" || st === "texto_invalido") {
        throw new Error(`Extração falhou: ${st}`);
      }

      const etapaMap: Record<string, string> = {
        pendente: "aguardando_extracao",
        verificando_arquivo: "verificando_arquivo",
        extraindo_texto: "extraindo_texto",
        rodando_ocr: "rodando_ocr",
        gerando_resumo: "gerando_resumo",
        criando_chunks: "criando_chunks",
        gerando_embeddings: "gerando_embeddings",
      };
      const etapa = etapaMap[st || "pendente"] || `extracao_em_andamento (${st || "pendente"})`;
      await updateJob({ etapa_atual: etapa, tentativas: (job.tentativas || 0) });
    }

    if (!extractionDone) {
      const { data: final } = await supabase
        .from("qa_documentos_conhecimento")
        .select("status_processamento")
        .eq("id", docId)
        .maybeSingle();

      if (final?.status_processamento === "concluido" || final?.status_processamento === "gerando_embeddings") {
        extractionDone = true;
      } else {
        throw new Error("Extração não concluída após tempo máximo (10 min)");
      }
    }

    await updateJob({ etapa_atual: "estruturando_campos" });

    try {
      const procResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qa-processar-documento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ documento_id: docId, user_id: job.user_id }),
      });

      if (procResp.ok) {
        await procResp.text();
        await updateJob({ etapa_atual: "salvando_metadados" });
      } else {
        console.warn("qa-processar-documento returned", procResp.status);
        await procResp.text();
      }
    } catch (e) {
      console.warn("Specialized processing error (non-fatal):", e);
    }

    await updateJob({
      status: "done",
      etapa_atual: "concluido",
      finished_at: new Date().toISOString(),
      documento_id: docId,
    });

    console.log(`Job ${jobId} completed. documento_id=${docId}`);

    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: job.user_id || null,
        entidade: "qa_document_jobs",
        entidade_id: jobId,
        acao: "job_concluido",
        detalhes_json: { documento_id: docId, tipo_documental: job.tipo_documental },
      });
    } catch {
      /* non-critical */
    }
  } catch (err: any) {
    const message = err?.message || "Erro desconhecido";
    console.error(`Job ${jobId} failed:`, message);

    await updateJob({
      status: "failed",
      etapa_atual: "erro",
      erro: message,
      finished_at: new Date().toISOString(),
      tentativas: (job.tentativas || 0) + 1,
    });

    await updateDocumentStatus("erro", { resumo_extraido: `Erro: ${message}` });

    try {
      await supabase.from("qa_logs_auditoria").insert({
        usuario_id: job.user_id || null,
        entidade: "qa_document_jobs",
        entidade_id: jobId,
        acao: "job_erro",
        detalhes_json: { erro: message, documento_id: docId || job.documento_id },
      });
    } catch {
      /* non-critical */
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    // Auth: require active QA staff
    const { requireQAStaff } = await import("../_shared/qaAuth.ts");
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsH, "Content-Type": "application/json" },
      });
    }

    (globalThis as any).EdgeRuntime?.waitUntil(processJob(job_id));

    return new Response(JSON.stringify({
      success: true,
      message: "Job iniciado em background. O processamento continua mesmo se você sair da tela.",
    }), {
      status: 202,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});