// qa-cliente-seguranca
// Central de segurança da conta do cliente (Arsenal Inteligente):
// - registrar_login: grava sessão (IP, dispositivo, navegador, SO) e avisa por e-mail
// - listar: config + últimos acessos
// - salvar_config: preferências (alerta de login, MFA por e-mail na troca de senha)
// - solicitar_codigo: envia contra-senha de 6 dígitos por e-mail
// - trocar_senha: valida contra-senha (se MFA ativo) e troca a senha
// - encerrar_sessoes: desloga a conta em todos os dispositivos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PORTAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente/configuracoes";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseUA(ua: string) {
  const u = ua || "";
  const sistema =
    /Windows NT 10/.test(u) ? "Windows 10/11" :
    /Windows/.test(u) ? "Windows" :
    /iPhone|iPad|iPod/.test(u) ? "iOS" :
    /Android/.test(u) ? "Android" :
    /Mac OS X/.test(u) ? "macOS" :
    /Linux/.test(u) ? "Linux" : "Desconhecido";
  const navegador =
    /Edg\//.test(u) ? "Microsoft Edge" :
    /OPR\//.test(u) ? "Opera" :
    /Chrome\//.test(u) ? "Chrome" :
    /Firefox\//.test(u) ? "Firefox" :
    /Safari\//.test(u) ? "Safari" : "Desconhecido";
  const dispositivo =
    /iPad|Tablet/.test(u) ? "Tablet" :
    /Mobi|iPhone|Android/.test(u) ? "Celular" : "Computador";
  return { sistema, navegador, dispositivo };
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtData(d = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(d);
}

async function localPorIp(ip: string): Promise<string> {
  if (!ip || ip === "desconhecido" || ip.startsWith("127.") || ip.startsWith("192.168.")) return "Não identificado";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return "Não identificado";
    const j = await r.json();
    const partes = [j?.city, j?.region_code || j?.region, j?.country_name].filter(Boolean);
    return partes.length ? partes.join(" / ") : "Não identificado";
  } catch {
    return "Não identificado";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Sessão inválida" }, 401);
    const uid = String(claimsData.claims.sub);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRes } = await admin.auth.admin.getUserById(uid);
    const email = String(userRes?.user?.email || claimsData.claims.email || "").toLowerCase();
    const nome = String(
      (userRes?.user?.user_metadata as any)?.nome ||
      (userRes?.user?.user_metadata as any)?.full_name || "",
    ).split(" ")[0] || "";

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // Config (cria default na primeira vez)
    const carregarConfig = async () => {
      const { data } = await admin
        .from("qa_cliente_seguranca_config")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) return data as any;
      const { data: novo } = await admin
        .from("qa_cliente_seguranca_config")
        .insert({ user_id: uid })
        .select("*")
        .maybeSingle();
      return (novo as any) || { user_id: uid, alerta_login: true, mfa_troca_senha: true };
    };

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
    const ua = req.headers.get("user-agent") || "";

    if (action === "registrar_login") {
      const cfg = await carregarConfig();
      const { sistema, navegador, dispositivo } = parseUA(String(body?.userAgent || ua));
      const local = await localPorIp(ip);
      const quando = fmtData();

      // Obs.: qa_cliente_login_eventos.qa_cliente_id é uuid e não comporta o id
      // numérico de qa_clientes; o vínculo é resolvido no painel por
      // user_id / e-mail.
      const { data: evento } = await admin
        .from("qa_cliente_login_eventos")
        .insert({
          user_id: uid,
          email,
          ip,
          user_agent: String(body?.userAgent || ua).slice(0, 500),
          dispositivo,
          navegador,
          sistema,
          local_aproximado: local,
          origem: String(body?.origem || "senha"),
          alerta_enviado: false,
        })
        .select("id")
        .maybeSingle();

      if (cfg.alerta_login && email) {
        const r = await sendTransactional({
          templateName: "login-suspeito",
          recipientEmail: email,
          idempotencyKey: `login-alerta-${uid}-${Date.now()}`,
          templateData: {
            nome,
            quando,
            local: `${local} · IP ${ip}`,
            dispositivo: `${dispositivo} · ${sistema} · ${navegador}`,
            resetUrl: PORTAL_URL,
          },
        });
        if (r.ok && (evento as any)?.id) {
          await admin.from("qa_cliente_login_eventos")
            .update({ alerta_enviado: true }).eq("id", (evento as any).id);
        }
      }
      return json({ ok: true });
    }

    if (action === "listar") {
      const cfg = await carregarConfig();
      const { data: eventos } = await admin
        .from("qa_cliente_login_eventos")
        .select("id, created_at, ip, dispositivo, navegador, sistema, local_aproximado, origem")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(15);
      return json({ ok: true, config: cfg, eventos: eventos || [], email });
    }

    if (action === "salvar_config") {
      await carregarConfig();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body?.alerta_login === "boolean") patch.alerta_login = body.alerta_login;
      if (typeof body?.mfa_troca_senha === "boolean") patch.mfa_troca_senha = body.mfa_troca_senha;
      const { data } = await admin
        .from("qa_cliente_seguranca_config")
        .update(patch)
        .eq("user_id", uid)
        .select("*")
        .maybeSingle();
      return json({ ok: true, config: data });
    }

    if (action === "solicitar_codigo") {
      if (!email) return json({ error: "Conta sem e-mail cadastrado." }, 400);
      // Rate limit simples: 1 código por minuto
      const { data: recente } = await admin
        .from("qa_cliente_senha_desafios")
        .select("created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recente && Date.now() - new Date((recente as any).created_at).getTime() < 60_000) {
        return json({ error: "Aguarde 1 minuto para pedir outra contra-senha." }, 429);
      }

      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      await admin.from("qa_cliente_senha_desafios").insert({
        user_id: uid,
        email,
        codigo_hash: await sha256(codigo),
        expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
      });

      const r = await sendTransactional({
        templateName: "contra-senha-troca",
        recipientEmail: email,
        idempotencyKey: `contrasenha-${uid}-${Date.now()}`,
        templateData: { nome, codigo },
      });
      if (!r.ok) return json({ error: "Não foi possível enviar a contra-senha agora." }, 502);
      return json({ ok: true, mascara: email.replace(/^(.).*(@.*)$/, "$1•••$2") });
    }

    if (action === "trocar_senha") {
      const novaSenha = String(body?.novaSenha || "");
      if (novaSenha.length < 8) return json({ error: "A nova senha precisa ter ao menos 8 caracteres." }, 400);
      const cfg = await carregarConfig();

      if (cfg.mfa_troca_senha) {
        const codigo = String(body?.codigo || "").trim();
        if (!/^\d{6}$/.test(codigo)) return json({ error: "Informe a contra-senha de 6 dígitos enviada por e-mail." }, 400);
        const hash = await sha256(codigo);
        const { data: desafio } = await admin
          .from("qa_cliente_senha_desafios")
          .select("*")
          .eq("user_id", uid)
          .is("usado_em", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const d = desafio as any;
        if (!d) return json({ error: "Nenhuma contra-senha ativa. Solicite uma nova." }, 400);
        if (new Date(d.expira_em).getTime() < Date.now()) return json({ error: "Contra-senha expirada. Solicite outra." }, 400);
        if (d.tentativas >= 5) return json({ error: "Muitas tentativas. Solicite uma nova contra-senha." }, 429);
        if (d.codigo_hash !== hash) {
          await admin.from("qa_cliente_senha_desafios")
            .update({ tentativas: d.tentativas + 1 }).eq("id", d.id);
          return json({ error: "Contra-senha incorreta." }, 400);
        }
        await admin.from("qa_cliente_senha_desafios")
          .update({ usado_em: new Date().toISOString() }).eq("id", d.id);
      }

      const { error: upErr } = await admin.auth.admin.updateUserById(uid, {
        password: novaSenha,
        user_metadata: {
          ...(userRes?.user?.user_metadata || {}),
          password_change_required: false,
        },
      });
      if (upErr) return json({ error: upErr.message }, 400);

      if (body?.encerrarSessoes) {
        try { await admin.auth.admin.signOut(uid, "global"); } catch { /* segue */ }
      }

      if (email) {
        await sendTransactional({
          templateName: "senha-alterada",
          recipientEmail: email,
          idempotencyKey: `senha-alterada-${uid}-${Date.now()}`,
          templateData: { nome, resetUrl: PORTAL_URL },
        });
      }
      return json({ ok: true });
    }

    if (action === "encerrar_sessoes") {
      const { error } = await admin.auth.admin.signOut(uid, "global");
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[qa-cliente-seguranca]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});