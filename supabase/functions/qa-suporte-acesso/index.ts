// Acesso de suporte (impersonação auditada) — Arsenal Inteligente.
// NÃO existe "senha master": o operador entra com a PRÓPRIA conta admin e o
// servidor emite um link de sessão temporária para a conta do cliente,
// registrando quem entrou, quando, de onde e por quê.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactional } from "../_shared/sendTransactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const P = "font-size:14px;line-height:1.6;color:#222;margin:0 0 14px";

function htmlInicio(nome: string, operador: string, processo: string, motivo: string) {
  return `
    <p style="${P}">Olá${nome ? `, <strong>${esc(nome)}</strong>` : ""}!</p>
    <p style="${P}">A equipe de suporte do <strong>Arsenal Inteligente</strong> conectou na sua conta para dar suporte ao processo <strong>${esc(processo || "em andamento")}</strong> e resolver o caso.</p>
    <p style="${P}"><strong>Motivo:</strong> ${esc(motivo)}<br/>
    <strong>Atendente:</strong> ${esc(operador)}<br/>
    <strong>Acesso:</strong> somente leitura e envio de documentos — não alteramos seus dados cadastrais, não assinamos contratos e não realizamos pagamentos em seu nome.</p>
    <p style="${P}">Ao encerrar o atendimento você receberá um resumo do que foi feito.</p>
    <p style="${P}">Qualquer dúvida, entre em contato.<br/><strong>Arsenal Inteligente</strong></p>`;
}

function htmlFim(nome: string, operador: string, processo: string, resumo: string, duracao: string) {
  return `
    <p style="${P}">Olá${nome ? `, <strong>${esc(nome)}</strong>` : ""}!</p>
    <p style="${P}">O atendimento na sua conta foi <strong>encerrado</strong>. Segue o resumo do que foi feito:</p>
    <div style="border-left:3px solid #7A1F2B;padding:10px 14px;background:#faf9f6;font-size:14px;line-height:1.6;color:#222;margin:0 0 14px">${esc(resumo).replace(/\n/g, "<br/>")}</div>
    <p style="${P}"><strong>Processo:</strong> ${esc(processo || "—")}<br/>
    <strong>Atendente:</strong> ${esc(operador)}<br/>
    <strong>Duração do acesso:</strong> ${esc(duracao)}</p>
    <p style="${P}">Qualquer dúvida, entre em contato.<br/><strong>Arsenal Inteligente</strong></p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "missing_token" }, 401);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: roleData } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  const isAdmin = Boolean(roleData);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = String(body.action || "");

  // "encerrar" também pode ser disparado de dentro da sessão de suporte
  // (o operador está logado como o cliente, portanto sem papel de admin).
  if (!isAdmin) {
    if (action !== "encerrar") return json({ error: "forbidden" }, 403);
    const { data: sCheck } = await admin
      .from("qa_suporte_sessoes").select("cliente_email")
      .eq("id", String(body.sessao_id || "")).maybeSingle();
    const callerEmail = (userData.user.email || "").toLowerCase();
    if (!sCheck || String(sCheck.cliente_email || "").toLowerCase() !== callerEmail) {
      return json({ error: "forbidden" }, 403);
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  const operadorEmail = userData.user.email || "equipe@queroarmas.com.br";

  try {
    if (action === "iniciar") {
      const clienteId = String(body.cliente_id || "");
      const motivo = String(body.motivo || "").trim();
      const processoRef = String(body.processo_ref || "").trim();
      const origin = String(body.origin || req.headers.get("origin") || "https://euqueroarmas.com.br");
      if (!clienteId) return json({ error: "cliente_id_required" }, 400);
      if (motivo.length < 5) return json({ error: "motivo_required" }, 400);

      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("id, nome_completo, email, user_id")
        .eq("id", clienteId).maybeSingle();
      if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);
      const email = String(cliente.email || "").trim().toLowerCase();
      if (!email) return json({ error: "cliente_sem_email" }, 400);

      const { data: sessao, error: sessErr } = await admin
        .from("qa_suporte_sessoes")
        .insert({
          cliente_id: cliente.id,
          cliente_email: email,
          cliente_nome: cliente.nome_completo,
          operador_user_id: userData.user.id,
          operador_email: operadorEmail,
          motivo,
          processo_ref: processoRef || null,
          ip,
          user_agent: userAgent,
        })
        .select("id, iniciado_em").single();
      if (sessErr) throw sessErr;

      const redirectTo = `${origin.replace(/\/$/, "")}/area-do-cliente?suporte=${sessao.id}`;
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        return json({ error: "link_indisponivel", detail: linkErr?.message || null }, 500);
      }

      const mail = await sendTransactional({
        templateName: "arsenal-generic",
        recipientEmail: email,
        idempotencyKey: `suporte-inicio-${sessao.id}`,
        templateData: {
          subject: "Suporte Arsenal Inteligente acessou sua conta",
          html: htmlInicio(String(cliente.nome_completo || ""), operadorEmail, processoRef, motivo),
        },
      });
      await admin.from("qa_suporte_sessoes").update({ email_inicio_enviado: mail.ok }).eq("id", sessao.id);

      return json({
        ok: true,
        sessao_id: sessao.id,
        action_link: linkData.properties.action_link,
        email_enviado: mail.ok,
        cliente: { id: cliente.id, nome: cliente.nome_completo, email },
      });
    }

    if (action === "registrar_acao") {
      const sessaoId = String(body.sessao_id || "");
      const descricao = String(body.descricao || "").trim();
      if (!sessaoId || !descricao) return json({ error: "params_required" }, 400);
      const { data: s } = await admin.from("qa_suporte_sessoes").select("acoes").eq("id", sessaoId).maybeSingle();
      const acoes = Array.isArray(s?.acoes) ? s!.acoes as unknown[] : [];
      acoes.push({ em: new Date().toISOString(), por: operadorEmail, descricao });
      await admin.from("qa_suporte_sessoes").update({ acoes }).eq("id", sessaoId);
      return json({ ok: true });
    }

    if (action === "encerrar") {
      const sessaoId = String(body.sessao_id || "");
      const resumo = String(body.resumo || "").trim();
      if (!sessaoId) return json({ error: "sessao_id_required" }, 400);
      const { data: s } = await admin.from("qa_suporte_sessoes").select("*").eq("id", sessaoId).maybeSingle();
      if (!s) return json({ error: "sessao_nao_encontrada" }, 404);
      if (s.encerrado_em) return json({ ok: true, ja_encerrada: true });

      const fim = new Date();
      const inicio = new Date(s.iniciado_em);
      const mins = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 60000));
      const acoesTxt = Array.isArray(s.acoes) && s.acoes.length
        ? (s.acoes as any[]).map((a) => `• ${a.descricao}`).join("\n")
        : "";
      const resumoFinal = resumo || acoesTxt || "Verificação da conta e acompanhamento do processo.";

      const mail = await sendTransactional({
        templateName: "arsenal-generic",
        recipientEmail: String(s.cliente_email),
        idempotencyKey: `suporte-fim-${sessaoId}`,
        templateData: {
          subject: "Resumo do atendimento na sua conta",
          html: htmlFim(String(s.cliente_nome || ""), String(s.operador_email || ""), String(s.processo_ref || ""), resumoFinal, `${mins} min`),
        },
      });

      await admin.from("qa_suporte_sessoes")
        .update({ encerrado_em: fim.toISOString(), resumo: resumoFinal, email_fim_enviado: mail.ok })
        .eq("id", sessaoId);

      return json({ ok: true, email_enviado: mail.ok, duracao_min: mins });
    }

    if (action === "listar") {
      const clienteId = body.cliente_id ? String(body.cliente_id) : null;
      let q = admin.from("qa_suporte_sessoes").select("*").order("iniciado_em", { ascending: false }).limit(200);
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return json({ items: data || [] });
    }

    return json({ error: "acao_invalida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});