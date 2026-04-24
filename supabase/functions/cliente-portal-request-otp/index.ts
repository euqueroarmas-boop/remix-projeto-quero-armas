import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildDocumentVariants,
  generateOtpCode,
  hashOtpCode,
  logAcesso,
  lookupClienteByIdentifier,
  maskEmail,
  normalizeDocument,
  normalizeEmail,
} from "../_shared/clienteLookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OTP_TTL_MIN = 15;
const OTP_SALT = Deno.env.get("OTP_SALT") || "qa-portal-otp-v1";

function emailHtml(code: string, magicLink: string, nome: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;color:#0f172a;">
      <h2 style="margin:0 0 12px 0;font-size:20px;">Acesso ao Portal do Cliente</h2>
      <p style="font-size:14px;color:#475569;">Olá${nome ? `, ${nome}` : ""}! Recebemos uma solicitação de acesso ao seu portal.</p>
      <p style="font-size:14px;color:#475569;">Use o código abaixo, válido por ${OTP_TTL_MIN} minutos:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#0f172a;color:#fff;padding:16px;border-radius:8px;text-align:center;margin:16px 0;">${code}</div>
      <p style="font-size:14px;color:#475569;">Ou clique no link mágico para entrar diretamente:</p>
      <p style="margin:12px 0;"><a href="${magicLink}" style="background:#0f172a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Acessar meu portal</a></p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">Se você não solicitou este acesso, ignore este e-mail. Nenhuma ação será tomada.</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for") || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    const body = await req.json().catch(() => ({}));
    const { identificador, email_alternativo } = body as {
      identificador?: string;
      email_alternativo?: string;
    };

    const ident = String(identificador || "").trim();
    if (!ident) {
      return new Response(JSON.stringify({ error: "Informe e-mail, CPF ou CNPJ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lookup = await lookupClienteByIdentifier(supabase, ident);
    const found = lookup.qa_cliente || lookup.customer;

    if (!found) {
      await logAcesso(supabase, {
        evento: "ativacao_tentativa",
        identificador: ident,
        status: "nao_encontrado",
        ip,
        user_agent: ua,
      });
      return new Response(JSON.stringify({
        success: false,
        not_found: true,
        message: "Não encontramos um cadastro com esses dados. Você pode continuar preenchendo seu cadastro para análise.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let emailDestino = lookup.email_cadastrado || "";
    let emailNovoSolicitado = false;
    const altEmail = normalizeEmail(email_alternativo || "");

    if (!emailDestino) {
      if (!altEmail) {
        // precisa de e-mail
        return new Response(JSON.stringify({
          success: false,
          require_email: true,
          message: "Encontramos seu cadastro, mas não há e-mail registrado. Informe um e-mail válido para receber o código de acesso.",
          cliente_nome: lookup.qa_cliente?.nome_completo || lookup.customer?.razao_social || null,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailDestino = altEmail;
      emailNovoSolicitado = true;
    } else if (altEmail && altEmail !== emailDestino) {
      // cliente quer atualizar e-mail; envia OTP no novo, mas marca que precisa aprovação admin
      emailDestino = altEmail;
      emailNovoSolicitado = true;
    }

    // Cria OTP
    const code = generateOtpCode();
    const codeHash = await hashOtpCode(code, OTP_SALT);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();

    const { data: otpRow, error: otpErr } = await supabase
      .from("cliente_otp_codes")
      .insert({
        email: emailDestino,
        code_hash: codeHash,
        qa_cliente_id: lookup.qa_cliente?.id || null,
        customer_id: lookup.customer?.id || null,
        documento_normalizado: normalizeDocument(lookup.qa_cliente?.cpf || lookup.customer?.cnpj_ou_cpf || ident),
        purpose: "portal_activation",
        expires_at: expiresAt,
        ip,
      })
      .select("id")
      .single();

    if (otpErr) throw otpErr;

    // Atualiza/cria registro de vínculo pendente
    const docNorm = normalizeDocument(lookup.qa_cliente?.cpf || lookup.customer?.cnpj_ou_cpf || ident);
    const targetStatus = emailNovoSolicitado ? "awaiting_admin" : "pending";

    const { data: existingLink } = await supabase
      .from("cliente_auth_links")
      .select("id, status, user_id")
      .or([
        lookup.qa_cliente ? `qa_cliente_id.eq.${lookup.qa_cliente.id}` : "",
        lookup.customer ? `customer_id.eq.${lookup.customer.id}` : "",
      ].filter(Boolean).join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingLink && existingLink.length) {
      await supabase.from("cliente_auth_links").update({
        email: emailDestino,
        email_pendente: emailNovoSolicitado ? emailDestino : null,
        documento_normalizado: docNorm,
        status: existingLink[0].status === "active" ? existingLink[0].status : targetStatus,
        motivo: emailNovoSolicitado ? "E-mail informado difere do cadastro; aguardando aprovação" : null,
      }).eq("id", existingLink[0].id);
    } else {
      await supabase.from("cliente_auth_links").insert({
        qa_cliente_id: lookup.qa_cliente?.id || null,
        customer_id: lookup.customer?.id || null,
        email: emailDestino,
        email_pendente: emailNovoSolicitado ? emailDestino : null,
        documento_normalizado: docNorm,
        status: targetStatus,
        motivo: emailNovoSolicitado ? "E-mail informado difere do cadastro; aguardando aprovação" : null,
      });
    }

    // Envia e-mail (OTP + magic link)
    const origin = req.headers.get("origin") || "https://wmti.com.br";
    const magicLink = `${origin.replace(/\/$/, "")}/ativar-acesso?token=${otpRow.id}&code=${code}`;
    const nome = lookup.qa_cliente?.nome_completo || lookup.customer?.razao_social || "";

    try {
      await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: emailDestino,
          subject: `Código de acesso ao Portal: ${code}`,
          html: emailHtml(code, magicLink, nome),
        },
      });
    } catch (e) {
      console.error("[cliente-portal-request-otp] email error", e);
    }

    await logAcesso(supabase, {
      evento: "otp_enviado",
      identificador: ident,
      email: emailDestino,
      qa_cliente_id: lookup.qa_cliente?.id || null,
      customer_id: lookup.customer?.id || null,
      status: emailNovoSolicitado ? "awaiting_admin" : "pending",
      detalhes: { otp_id: otpRow.id, email_alternativo: emailNovoSolicitado },
      ip,
      user_agent: ua,
    });

    return new Response(JSON.stringify({
      success: true,
      email_mascarado: maskEmail(emailDestino),
      requires_admin_approval: emailNovoSolicitado,
      cliente_nome: nome,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[cliente-portal-request-otp] fatal", msg);
    await logAcesso(supabase, {
      evento: "otp_erro",
      status: "error",
      detalhes: { error: msg },
      ip,
      user_agent: ua,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});