/**
 * qa-upload-signed-procuracao
 *
 * Cliente envia a procuração assinada em PDF.
 * Atualiza qa_procuracoes para customer_signature_uploaded.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "paid-contracts";
const MAX_BYTES = 25 * 1024 * 1024;

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join("");
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

async function resolveClienteIds(sb: ReturnType<typeof svc>, userId: string): Promise<number[]> {
  const ids = new Set<number>();

  const { data: link } = await sb
    .from("cliente_auth_links")
    .select("qa_cliente_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if ((link as any)?.qa_cliente_id) ids.add(Number((link as any).qa_cliente_id));

  const { data: clientes } = await sb
    .from("qa_clientes")
    .select("id, id_legado")
    .eq("user_id", userId);
  for (const cliente of (clientes ?? []) as any[]) {
    if (cliente.id) ids.add(Number(cliente.id));
    if (cliente.id_legado) ids.add(Number(cliente.id_legado));
  }

  return Array.from(ids).filter((id) => Number.isFinite(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const userId = await authUserId(req);
  if (!userId) return jsonResp({ error: "Unauthorized" }, 401);

  const sb = svc();
  const clienteIds = await resolveClienteIds(sb, userId);
  if (!clienteIds.length) return jsonResp({ error: "Cliente não vinculado" }, 403);

  const uploadIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const uploadUserAgent = req.headers.get("user-agent") || null;

  let pdfBytes: Uint8Array | null = null;
  let procuracaoId = "";

  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      procuracaoId = String(fd.get("procuracao_id") || "");
      const file = fd.get("file") as File | null;
      if (!file) return jsonResp({ error: "Arquivo obrigatório" }, 400);
      if (file.size > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      procuracaoId = String(body.procuracao_id || "");
      if (!body.file_base64) return jsonResp({ error: "file_base64 obrigatório" }, 400);
      const bin = atob(String(body.file_base64).replace(/^data:[^;]+;base64,/, ""));
      pdfBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
      if (pdfBytes.byteLength > MAX_BYTES) return jsonResp({ error: "Arquivo > 25MB" }, 413);
    }
  } catch (e) {
    return jsonResp({ error: "Falha ao ler upload", detail: (e as Error).message }, 400);
  }

  if (!procuracaoId) return jsonResp({ error: "procuracao_id obrigatório" }, 400);
  if (!pdfBytes || pdfBytes.byteLength < 256) return jsonResp({ error: "Arquivo inválido" }, 400);

  const head = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (!head.startsWith("%PDF")) return jsonResp({ error: "Apenas PDF é aceito" }, 415);

  const { data: procuracao } = await sb
    .from("qa_procuracoes")
    .select("id, cliente_id, venda_id, status")
    .eq("id", procuracaoId)
    .maybeSingle();
  if (!procuracao) return jsonResp({ error: "Procuração não encontrada" }, 404);
  if (!clienteIds.includes(Number((procuracao as any).cliente_id))) {
    return jsonResp({ error: "Acesso negado" }, 403);
  }

  const allowed = ["generated_pending_customer_signature", "rejected", "customer_signature_uploaded"];
  if (!allowed.includes(String((procuracao as any).status || ""))) {
    return jsonResp({ error: `Procuração em status ${(procuracao as any).status} não aceita upload` }, 409);
  }

  const path = `qa-procuracoes/${(procuracao as any).cliente_id}/${procuracaoId}/customer-signed.pdf`;
  const sig = await sha256(pdfBytes);
  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadErr) return jsonResp({ error: "Falha ao gravar PDF", detail: uploadErr.message }, 500);

  const uploadedAt = new Date().toISOString();
  const { error: updateErr } = await sb
    .from("qa_procuracoes")
    .update({
      status: "customer_signature_uploaded",
      arquivo_assinado_path: path,
      customer_signature_uploaded_at: uploadedAt,
      rejection_reason: null,
    })
    .eq("id", procuracaoId);
  if (updateErr) return jsonResp({ error: "Falha ao atualizar procuração", detail: updateErr.message }, 500);

  await sb.from("qa_status_eventos").insert({
    tipo: "procuracao_assinada_enviada",
    payload: {
      procuracao_id: procuracaoId,
      venda_id: (procuracao as any).venda_id ?? null,
      sha256: sig,
      size: pdfBytes.byteLength,
      ip: uploadIp,
      user_agent: uploadUserAgent,
    },
  }).then(() => null, () => null);

  // Espelha a procuração assinada no Hub Documental (categoria Jurídico).
  //
  // IDEMPOTENTE POR PROCURAÇÃO: reenviar é legítimo — o cliente pode ter
  // mandado o arquivo errado, e `allowed` inclui customer_signature_uploaded
  // justamente para permitir a correção. O storage usa upsert e a linha de
  // qa_procuracoes é a mesma, mas este espelho fazia INSERT cego: cada reenvio
  // criava um documento novo no Hub. Um cliente que reenviou três vezes ficou
  // com três "Procuração assinada" em análise, todas apontando para o mesmo
  // arquivo. Agora atualizamos o documento existente daquela procuração.
  const metadados = {
    procuracao_id: procuracaoId,
    venda_id: (procuracao as any).venda_id ?? null,
    sha256: sig,
    bucket: BUCKET,
    origem_upload: "qa-upload-signed-procuracao",
    uploaded_at: uploadedAt,
    ip: uploadIp,
    user_agent: uploadUserAgent,
  };
  // Regra oficial Quero Armas: procuração vale 12 MESES a partir da emissão
  // (data da assinatura). Gravamos já calculada para o Hub e para os alertas.
  const emissaoProcIso = String(uploadedAt).slice(0, 10);
  const validadeProcIso = (() => {
    const [y, m, d] = emissaoProcIso.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 + 12, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)))
      .toISOString().slice(0, 10);
  })();
  try {
    const { data: existente } = await sb
      .from("qa_documentos_cliente")
      .select("id")
      .eq("tipo_documento", "procuracao_assinada")
      .eq("metadados_documento_json->>procuracao_id", String(procuracaoId))
      .neq("status", "excluido")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente?.id) {
      // Reenvio: atualiza o mesmo documento e devolve para análise.
      await sb.from("qa_documentos_cliente")
        .update({
          arquivo_storage_path: path,
          arquivo_nome: "procuracao-assinada.pdf",
          arquivo_mime: "application/pdf",
          status: "pendente_aprovacao",
          motivo_reprovacao: null,
          data_emissao: emissaoProcIso,
          data_validade: validadeProcIso,
          metadados_documento_json: metadados,
          updated_at: uploadedAt,
        })
        .eq("id", existente.id);
    } else {
      await sb.from("qa_documentos_cliente").insert({
        qa_cliente_id: Number((procuracao as any).cliente_id),
        tipo_documento: "procuracao_assinada",
        nome_documento: "Procuração assinada (Gov.br)",
        arquivo_storage_path: path,
        arquivo_nome: "procuracao-assinada.pdf",
        arquivo_mime: "application/pdf",
        origem: "cliente",
        status: "pendente_aprovacao",
        data_emissao: emissaoProcIso,
        data_validade: validadeProcIso,
        ia_status: "nao_processado",
        categoria_hub: "juridico",
        escopo_documental: "processo",
        reaproveitavel_global: false,
        revisao_humana_obrigatoria: true,
        metadados_documento_json: metadados,
      });
    }
  } catch (e) {
    console.error("[qa-upload-signed-procuracao] hub upsert falhou", (e as Error).message);
  }

  // Notifica admin (eu@queroarmas.com.br) que o cliente subiu a procuração assinada.
  try {
    const clienteIdProc = Number((procuracao as { cliente_id?: number | string }).cliente_id);
    const { data: cli } = await sb
      .from("qa_clientes")
      .select("nome_completo, email, cpf")
      .or(`id.eq.${clienteIdProc},id_legado.eq.${clienteIdProc}`)
      .limit(1)
      .maybeSingle();
    const { notifyAdminUpload } = await import("../_shared/notifyAdminUpload.ts");
    await notifyAdminUpload({
      tipo: "procuracao",
      cliente_nome: (cli as { nome_completo?: string } | null)?.nome_completo ?? null,
      cliente_email: (cli as { email?: string } | null)?.email ?? null,
      cliente_cpf: (cli as { cpf?: string } | null)?.cpf ?? null,
      documento_nome: "Procuração assinada (Gov.br/ICP-Brasil)",
      exigencia: "Procuração para representação junto à PF/SIGMA",
      procuracao_id: procuracaoId,
      extras: { SHA256: sig },
    });
  } catch (e) {
    console.error("[qa-upload-signed-procuracao] admin notify falhou", (e as Error).message);
  }

  return jsonResp({ ok: true, procuracao_id: procuracaoId, sha256: sig, status: "customer_signature_uploaded" });
});
