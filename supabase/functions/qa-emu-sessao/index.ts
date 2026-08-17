// MODO ESPELHO — emulador real da Área do Cliente para a equipe.
//
// Diferença fundamental para o modelo antigo (qa-suporte-acesso): aqui NÃO
// emitimos magic link nem logamos o operador como o cliente. O operador segue
// autenticado na própria conta de staff; esta função só abre/fecha a "janela"
// de espelho e cuida dos avisos ao cliente. Como auth.uid() continua sendo o do
// operador, toda alteração já nasce atribuída a ele — os gatilhos
// `qa_emu_rastro` gravam isso na linha do tempo que o cliente vê.
//
// AUTOCONTIDA DE PROPÓSITO: sem imports de `../_shared/*`. O Lovable não
// publica funções que chegam pelo GitHub, então esta precisa poder ser colada
// inteira no painel do Supabase — e lá não existe a pasta _shared. As duas
// dependências (guarda de staff e envio de e-mail) estão inline abaixo,
// espelhando qaAuth.ts e sendTransactional.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Duração padrão da janela de espelho. Sessão esquecida morre sozinha. */
const DURACAO_MIN_PADRAO = 30;
const DURACAO_MIN_MAX = 120;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Guarda de staff (espelha _shared/qaAuth.ts)
// ---------------------------------------------------------------------------
type StaffGuard =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: Response };

/**
 * Valida o JWT batendo em /auth/v1/user (evita o "Auth session missing!" do
 * supabase-js fora do navegador) e exige perfil ATIVO em qa_usuarios_perfis.
 */
async function requireQAStaff(req: Request): Promise<StaffGuard> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let userId = "";
  let email: string | null = null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return { ok: false, response: json({ error: "Invalid token", detail: detail || `status ${resp.status}` }, 401) };
    }
    const u = await resp.json();
    userId = String(u?.id || "");
    email = u?.email ?? null;
    if (!userId) return { ok: false, response: json({ error: "Invalid token", detail: "no user id" }, 401) };
  } catch (e) {
    return { ok: false, response: json({ error: "Invalid token", detail: (e as Error)?.message || "fetch failed" }, 401) };
  }

  const adminClient = createClient(url, service);
  const { data: perfilRow } = await adminClient
    .from("qa_usuarios_perfis")
    .select("perfil, ativo")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (!perfilRow) return { ok: false, response: json({ error: "Forbidden: no active QA profile" }, 403) };

  return { ok: true, userId, email };
}

// ---------------------------------------------------------------------------
// E-mail transacional (espelha _shared/sendTransactional.ts)
// ---------------------------------------------------------------------------
async function sendTransactional(args: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.functions.invoke("send-transactional-email", {
      body: {
        templateName: args.templateName,
        recipientEmail: args.recipientEmail,
        idempotencyKey: args.idempotencyKey,
        templateData: args.templateData ?? {},
      },
    });
    if (error) return { ok: false, error: error.message };
    const ok = Boolean(data?.success || data?.queued);
    return { ok, error: ok ? undefined : String(data?.error || data?.reason || "E-mail não enfileirado") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const P = "font-size:14px;line-height:1.6;color:#222;margin:0 0 14px";

function htmlInicio(nome: string, operador: string, processo: string, motivo: string, minutos: number) {
  return `
    <p style="${P}">Olá${nome ? `, <strong>${esc(nome)}</strong>` : ""}!</p>
    <p style="${P}">A equipe do <strong>Arsenal Inteligente</strong> abriu a sua área para trabalhar no processo <strong>${esc(processo || "em andamento")}</strong>.</p>
    <p style="${P}"><strong>Motivo:</strong> ${esc(motivo)}<br/>
    <strong>Responsável:</strong> ${esc(operador)}<br/>
    <strong>Janela de acesso:</strong> ${minutos} minutos</p>
    <p style="${P}">Tudo o que for alterado aparece no seu <strong>histórico de atualizações</strong> identificado com o nome de quem fez. A equipe <strong>não</strong> contrata serviços, não realiza pagamentos e não assina contratos no seu lugar — isso continua sendo só seu.</p>
    <p style="${P}">Ao terminar, você recebe o resumo do que foi feito.<br/><strong>Arsenal Inteligente</strong></p>`;
}

function htmlFim(nome: string, operador: string, processo: string, resumo: string, duracao: string) {
  return `
    <p style="${P}">Olá${nome ? `, <strong>${esc(nome)}</strong>` : ""}!</p>
    <p style="${P}">O atendimento na sua área foi <strong>encerrado</strong>. Resumo do que foi feito:</p>
    <div style="border-left:3px solid #7A1F2B;padding:10px 14px;background:#faf9f6;font-size:14px;line-height:1.6;color:#222;margin:0 0 14px">${esc(resumo).replace(/\n/g, "<br/>")}</div>
    <p style="${P}"><strong>Processo:</strong> ${esc(processo || "—")}<br/>
    <strong>Responsável:</strong> ${esc(operador)}<br/>
    <strong>Duração:</strong> ${esc(duracao)}</p>
    <p style="${P}">Qualquer dúvida, entre em contato.<br/><strong>Arsenal Inteligente</strong></p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = String(body.action || "");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  const operadorEmail = guard.email || "equipe@queroarmas.com.br";

  // Nome do operador para exibir ao cliente ("Equipe Quero Armas · Fulano").
  const { data: perfilOperador } = await admin
    .from("qa_usuarios_perfis")
    .select("nome")
    .eq("user_id", guard.userId)
    .maybeSingle();
  const operadorNome = String((perfilOperador as { nome?: string } | null)?.nome || "").trim() || operadorEmail;

  try {
    if (action === "iniciar") {
      const clienteId = Number(body.cliente_id);
      const motivo = String(body.motivo || "").trim();
      const processoRef = String(body.processo_ref || "").trim();
      // Guardamos o id além do nome: nome muda quando o catálogo é editado, o
      // vínculo não. A auditoria precisa apontar para o processo de verdade.
      const processoId = body.processo_id ? String(body.processo_id) : null;
      const minutos = Math.min(
        DURACAO_MIN_MAX,
        Math.max(5, Number(body.minutos) || DURACAO_MIN_PADRAO),
      );
      if (!Number.isFinite(clienteId) || clienteId <= 0) return json({ error: "cliente_id_invalido" }, 400);
      if (motivo.length < 5) return json({ error: "motivo_required" }, 400);

      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("id, nome_completo, email")
        .eq("id", clienteId)
        .maybeSingle();
      if (!cliente) return json({ error: "cliente_nao_encontrado" }, 404);

      // Uma janela por operador. Reabrir fecha a anterior — evita sessão órfã
      // segurando o bloqueio de compras por engano.
      await admin
        .from("qa_emu_sessoes")
        .update({
          encerrado_em: new Date().toISOString(),
          encerrado_por: "substituida_por_nova_sessao",
          resumo: "Encerrada automaticamente ao abrir outra janela de espelho.",
        })
        .eq("operador_user_id", guard.userId)
        .is("encerrado_em", null);

      const expiraEm = new Date(Date.now() + minutos * 60_000).toISOString();
      const { data: sessao, error: sessErr } = await admin
        .from("qa_emu_sessoes")
        .insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_completo,
          cliente_email: cliente.email,
          operador_user_id: guard.userId,
          operador_email: operadorEmail,
          operador_nome: operadorNome,
          motivo,
          processo_ref: processoRef || null,
          processo_id: processoId,
          expira_em: expiraEm,
          ip,
          user_agent: userAgent,
        })
        .select("id, iniciado_em, expira_em")
        .single();
      if (sessErr) throw sessErr;

      // Aviso ao cliente. Falha de e-mail NÃO impede o atendimento — fica
      // registrado em email_inicio_enviado para a auditoria cobrar depois.
      let emailOk = false;
      const email = String(cliente.email || "").trim();
      if (email) {
        const mail = await sendTransactional({
          templateName: "arsenal-generic",
          recipientEmail: email,
          idempotencyKey: `emu-inicio-${sessao.id}`,
          templateData: {
            subject: "A equipe Quero Armas está trabalhando na sua área",
            html: htmlInicio(String(cliente.nome_completo || ""), operadorNome, processoRef, motivo, minutos),
          },
        });
        emailOk = mail.ok;
        await admin.from("qa_emu_sessoes").update({ email_inicio_enviado: emailOk }).eq("id", sessao.id);
      }

      return json({
        ok: true,
        sessao: {
          id: sessao.id,
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_completo,
          operador_nome: operadorNome,
          operador_email: operadorEmail,
          iniciado_em: sessao.iniciado_em,
          expira_em: sessao.expira_em,
        },
        email_enviado: emailOk,
      });
    }

    if (action === "estado") {
      const { data } = await admin
        .from("qa_emu_sessoes")
        .select("id, cliente_id, cliente_nome, operador_nome, operador_email, iniciado_em, expira_em")
        .eq("operador_user_id", guard.userId)
        .is("encerrado_em", null)
        .gt("expira_em", new Date().toISOString())
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({ ok: true, sessao: data || null });
    }

    if (action === "registrar_acao") {
      const sessaoId = String(body.sessao_id || "");
      const descricao = String(body.descricao || "").trim();
      if (!sessaoId || !descricao) return json({ error: "params_required" }, 400);
      const { data: s } = await admin
        .from("qa_emu_sessoes")
        .select("acoes, operador_user_id, cliente_id")
        .eq("id", sessaoId)
        .maybeSingle();
      if (!s || s.operador_user_id !== guard.userId) return json({ error: "forbidden" }, 403);

      const acoes = Array.isArray(s.acoes) ? (s.acoes as unknown[]) : [];
      acoes.push({ em: new Date().toISOString(), por: operadorNome, op: "NOTA", descricao });
      await admin.from("qa_emu_sessoes").update({ acoes }).eq("id", sessaoId);

      // Nota manual também aparece para o cliente.
      await admin.from("qa_cliente_historico_atualizacoes").insert({
        cliente_id: s.cliente_id,
        changed_fields: [{ field: "atendimento", label: "Atendimento da equipe", old: null, new: descricao }],
        origem: "equipe_espelho",
        autor: `Equipe Quero Armas · ${operadorNome}`,
      });
      return json({ ok: true });
    }

    if (action === "encerrar") {
      const sessaoId = String(body.sessao_id || "");
      const resumo = String(body.resumo || "").trim();
      if (!sessaoId) return json({ error: "sessao_id_required" }, 400);

      const { data: s } = await admin.from("qa_emu_sessoes").select("*").eq("id", sessaoId).maybeSingle();
      if (!s) return json({ error: "sessao_nao_encontrada" }, 404);
      if (s.operador_user_id !== guard.userId) return json({ error: "forbidden" }, 403);
      if (s.encerrado_em) return json({ ok: true, ja_encerrada: true });

      const fim = new Date();
      const mins = Math.max(1, Math.round((fim.getTime() - new Date(s.iniciado_em).getTime()) / 60000));
      const acoes = Array.isArray(s.acoes) ? (s.acoes as { descricao?: string }[]) : [];
      const acoesTxt = acoes.length ? acoes.map((a) => `• ${a.descricao}`).join("\n") : "";
      const resumoFinal = resumo || acoesTxt || "Verificação da conta e acompanhamento do processo.";

      let emailOk = false;
      const email = String(s.cliente_email || "").trim();
      if (email) {
        const mail = await sendTransactional({
          templateName: "arsenal-generic",
          recipientEmail: email,
          idempotencyKey: `emu-fim-${sessaoId}`,
          templateData: {
            subject: "Resumo do atendimento na sua área",
            html: htmlFim(
              String(s.cliente_nome || ""),
              String(s.operador_nome || s.operador_email || ""),
              String(s.processo_ref || ""),
              resumoFinal,
              `${mins} min`,
            ),
          },
        });
        emailOk = mail.ok;
      }

      await admin
        .from("qa_emu_sessoes")
        .update({
          encerrado_em: fim.toISOString(),
          encerrado_por: operadorNome,
          resumo: resumoFinal,
          email_fim_enviado: emailOk,
        })
        .eq("id", sessaoId);

      return json({ ok: true, email_enviado: emailOk, duracao_min: mins, acoes: acoes.length });
    }

    if (action === "listar") {
      const clienteId = body.cliente_id ? Number(body.cliente_id) : null;
      let q = admin
        .from("qa_emu_sessoes")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(100);
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, items: data || [] });
    }

    return json({ error: "acao_invalida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
