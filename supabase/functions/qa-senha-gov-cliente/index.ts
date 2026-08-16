// ============================================================================
// qa-senha-gov-cliente — Bloco 2: o cliente guarda a própria senha do gov.br
// ----------------------------------------------------------------------------
// Versão da `qa-senha-gov` SEGURA para o portal do cliente. Em vez de exigir
// perfil staff, valida que o usuário autenticado é o DONO do cadastro.
//
// DIFERENÇA DELIBERADA EM RELAÇÃO À VERSÃO STAFF: aqui NÃO existe leitura da
// senha. O cliente pode gravar e trocar a dele, e consultar se já existe uma
// guardada — nunca lê o valor de volta. Endpoint de leitura é superfície de
// ataque sem contrapartida: quem precisa da senha para protocolar é a equipe,
// pela função staff, que já registra cada abertura em qa_senha_gov_acessos.
//
// Por que guardamos senha de gov.br: o protocolo do requerimento é feito no
// site da Polícia Federal com a conta do próprio cliente. Ele autoriza, a gente
// protocola. A senha entra cifrada em AES-GCM (mesma chave e mesmo formato da
// função staff) e todo acesso fica registrado.
//
// Endpoints (POST JSON):
//   { action: "status" }            -> { tem_senha, atualizada_em }
//   { action: "set", senha: "..." } -> grava/atualiza e libera a exigência
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Código da exigência que este passo cumpre no checklist do processo. */
const TIPO_EXIGENCIA = "credencial_gov_br";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHexLit(bytes: Uint8Array): string {
  return "\\x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mesma chave e mesmo formato da função staff — as duas leem o mesmo cofre. */
async function loadKey(): Promise<CryptoKey> {
  const rawEnv = Deno.env.get("QA_ENCRYPTION_KEY") || "";
  if (!rawEnv) throw new Error("QA_ENCRYPTION_KEY not configured");
  const raw = rawEnv.replace(/\s+/g, "").trim();
  let bytes: Uint8Array | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = hexToBytes(raw);
  } else {
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    try { bytes = b64ToBytes(b64); } catch { bytes = null; }
  }
  if (!bytes || bytes.length !== 32) throw new Error("QA_ENCRYPTION_KEY inválida (precisa 32 bytes)");
  return await crypto.subtle.importKey(
    "raw",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSenha(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer.slice(0) as ArrayBuffer },
    key,
    enc.buffer.slice(0) as ArrayBuffer,
  );
  const cipher = new Uint8Array(cipherBuf);
  const tagLen = 16;
  return {
    ct: cipher.slice(0, cipher.length - tagLen),
    iv,
    tag: cipher.slice(cipher.length - tagLen),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return json({ error: "Sessão inválida" }, 401);
    const authUserId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Dono do cadastro ────────────────────────────────────────────────
    // Duas portas, como no resto do portal: vínculo direto em qa_clientes e o
    // vínculo de login social em cliente_auth_links.
    let clienteId: number | null = null;
    const { data: direto } = await admin
      .from("qa_clientes")
      .select("id")
      .eq("user_id", authUserId)
      .eq("excluido", false)
      .maybeSingle();
    if (direto?.id != null) clienteId = Number(direto.id);

    if (clienteId == null) {
      const { data: link } = await admin
        .from("cliente_auth_links")
        .select("qa_cliente_id")
        .eq("user_id", authUserId)
        .not("qa_cliente_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (link?.qa_cliente_id != null) clienteId = Number(link.qa_cliente_id);
    }

    if (clienteId == null) return json({ error: "Cadastro não encontrado para este login." }, 404);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    // ── STATUS: só diz SE existe. Nunca devolve a senha. ────────────────
    if (action === "status") {
      const { data: cred } = await admin
        .from("qa_cliente_credenciais")
        .select("id, updated_at")
        .eq("cliente_id", clienteId)
        .eq("tipo_credencial", "gov_br")
        .eq("status", "ativa")
        .maybeSingle();
      return json({
        tem_senha: !!cred,
        atualizada_em: (cred as { updated_at?: string } | null)?.updated_at ?? null,
      });
    }

    // ── SET ─────────────────────────────────────────────────────────────
    if (action === "set") {
      const senha = String(body?.senha ?? "");
      if (senha.trim().length < 6) {
        return json({ error: "Informe a senha do gov.br (mínimo 6 caracteres)." }, 400);
      }

      const key = await loadKey();
      const { ct, iv, tag } = await encryptSenha(senha, key);

      const { data: existing } = await admin
        .from("qa_cliente_credenciais")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("tipo_credencial", "gov_br")
        .eq("status", "ativa")
        .maybeSingle();

      if (existing) {
        await admin
          .from("qa_cliente_credenciais")
          .update({
            senha_encrypted: toHexLit(ct),
            senha_iv: toHexLit(iv),
            senha_tag: toHexLit(tag),
            origem: "portal_cliente",
            updated_by: authUserId,
          })
          .eq("id", (existing as { id: number }).id);
      } else {
        await admin.from("qa_cliente_credenciais").insert({
          cliente_id: clienteId,
          tipo_credencial: "gov_br",
          senha_encrypted: toHexLit(ct),
          senha_iv: toHexLit(iv),
          senha_tag: toHexLit(tag),
          origem: "portal_cliente",
          status: "ativa",
          updated_by: authUserId,
        });
      }

      // Trilha de auditoria: a mesma tabela que registra cada leitura da
      // equipe registra também quando o cliente entregou ou trocou a senha.
      await admin.from("qa_senha_gov_acessos").insert({
        cliente_id: clienteId,
        user_id: authUserId,
        acao: existing ? "cliente_update" : "cliente_set",
        ip,
        user_agent: ua,
        contexto: "portal do cliente — Bloco 2 (acesso gov.br)",
      });

      // Libera a exigência no checklist dos processos abertos do cliente.
      // Sem isto o passo continuaria pendente para sempre: não existe arquivo
      // para subir, então nada mais mudaria o status desta linha.
      const { data: liberados } = await admin
        .from("qa_processo_documentos")
        .update({
          status: "aprovado",
          data_envio: new Date().toISOString(),
          data_validacao: new Date().toISOString(),
          observacoes: "Senha do gov.br entregue pelo cliente no portal.",
        })
        .eq("cliente_id", clienteId)
        .eq("tipo_documento", TIPO_EXIGENCIA)
        .neq("status", "aprovado")
        .select("id");

      return json({ ok: true, exigencias_liberadas: (liberados ?? []).length });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("[qa-senha-gov-cliente]", e);
    return json({ error: "Erro ao guardar o acesso. Tente novamente." }, 500);
  }
});
