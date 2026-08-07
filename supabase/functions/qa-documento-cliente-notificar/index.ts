// Notifica o cliente quando um documento do Hub Documental é aprovado ou reprovado pela equipe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSistemaBackend } from "../_shared/logSistema.ts";
import { requireQAStaff } from "../_shared/qaAuth.ts";
import { sendTransactional } from "../_shared/sendTransactional.ts";

// Caixa da equipe. Mesmo endereço que o notifyAdminUpload já usa, para não
// espalhar destinatário administrativo por vários lugares.
const EMAIL_EQUIPE = "eu@queroarmas.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  rg_com_cpf: "Cédula de Identidade (RG) com CPF",
  rg: "Cédula de Identidade (RG) com CPF",
  cin: "Carteira de Identidade Nacional (CIN)",
  cnh: "Carteira Nacional de Habilitação (CNH)",
  cpf: "Cadastro de Pessoas Físicas (CPF)",
  certidao_alteracao_nome: "Certidão averbada de alteração de nome",
  comprovante_residencia: "Comprovante de residência",
  comprovante_endereco: "Comprovante de residência",
  declaracao_responsavel_imovel: "Declaração do responsável pelo imóvel",
  ctps: "Carteira de Trabalho (CTPS)",
  renda_holerite_mes_atual: "Holerite mais recente",
  renda_holerite_funcionario_publico: "Holerite recente (servidor público)",
  renda_cartao_cnpj: "Cartão CNPJ",
  renda_qsa: "QSA — Quadro de Sócios e Administradores",
  renda_contrato_social: "Contrato Social / Requerimento de Empresário",
  renda_ccmei: "CCMEI — Certificado da Condição de MEI",
  renda_cnpj_autonomo: "Cartão CNPJ (autônomo / MEI)",
  renda_nf_recente: "Nota fiscal recente",
  renda_comprovante_beneficio: "Comprovante de benefício",
  renda_extrato_inss: "Extrato INSS",
  antecedentes_criminais: "Certidão de Antecedentes Criminais — Polícia Civil/SP",
  antecedentes_federal: "Certidão de Distribuição Criminal — Justiça Federal",
  antecedentes_estadual: "Certidão Estadual Criminal — TJSP",
  antecedentes_federal_trf3_regional: "Certidão Federal — TRF 3ª Região",
  antecedentes_federal_sjsp_jef: "Certidão Federal — Seção Judiciária SP e JEF/SP",
  antecedentes_estadual_distribuicao: "Certidão Estadual TJSP — Distribuição de Ações Criminais",
  antecedentes_estadual_execucoes: "Certidão Estadual TJSP — Execuções Criminais",
  antecedentes_militar: "Certidão Criminal Militar — STM (União)",
  antecedentes_militar_estadual: "Certidão Criminal Militar — TJM (Estadual)",
  antecedentes_eleitoral: "Certidão de Crimes Eleitorais — TSE",
  declaracao_sem_inquerito_processo_criminal: "Declaração de não responder a inquérito/processo",
  declaracao_guarda_responsavel: "Declaração de guarda responsável",
  declaracao_correlata: "Declaração correlata",
  laudo_psicologico: "Laudo psicológico",
  laudo_capacidade_tecnica: "Atestado de capacidade técnica",
  comprovante_efetiva_necessidade: "Comprovação de efetiva necessidade",
  documento_complementar_caso: "Documento complementar do caso",
  cr: "CR — Certificado de Registro",
  craf: "CRAF — Certificado de Registro de Arma de Fogo",
  sinarm: "SINARM — Certificado de Registro de Arma de Fogo",
  gt: "GT — Guia de Tráfego",
  gte: "GTE — Guia de Tráfego Eventual",
  autorizacao_compra: "Autorização de compra",
  nota_fiscal_arma: "Nota fiscal da arma",
  comprovante_habitualidade: "Comprovante de habitualidade",
  comprovante_clube_tiro: "Comprovante de clube / entidade",
  comprovante_competicao: "Comprovante de competição / atividade",
  comprovante_pagamento: "Comprovante de pagamento",
  protocolo_processo: "Protocolo do processo",
  oficio: "Ofício",
  despacho: "Despacho / movimentação",
  exigencia: "Exigência administrativa",
  indeferimento: "Indeferimento",
  procuracao: "Procuração",
  procuracao_assinada: "Procuração assinada",
  contrato_assinado: "Contrato assinado",
  recurso_administrativo_doc: "Recurso administrativo",
  mandado_seguranca_doc: "Mandado de segurança / peça jurídica",
  outro: "Documento complementar",
};

function nomeDocumento(doc: Record<string, unknown>) {
  const nome = String(doc.nome_documento || "").trim();
  if (nome) return nome;
  const tipo = String(doc.tipo_documento || "").trim().toLowerCase();
  return TIPO_DOCUMENTO_LABELS[tipo] || "Documento complementar";
}

function motivoPadrao(status: string) {
  return status === "aprovado"
    ? "Documento conferido pela equipe e aprovado para uso no cadastro, acervo ou processo aplicável."
    : "Documento conferido pela equipe e recusado. Verifique o motivo e envie uma nova versão pelo portal.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  const traceId = `qa-hub-doc-status-${crypto.randomUUID()}`;

  try {
    const body = await req.json().catch(() => ({}));
    const documentoId = String(body?.documento_id || "").trim();
    const statusInformado = String(body?.status || "").trim().toLowerCase();
    const motivoInformado = String(body?.motivo || "").trim();

    if (!documentoId) return json({ error: "documento_id é obrigatório", traceId }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: docErr } = await supabase
      .from("qa_documentos_cliente")
      .select("id, qa_cliente_id, customer_id, tipo_documento, nome_documento, arquivo_nome, status, motivo_reprovacao")
      .eq("id", documentoId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: "Documento não encontrado", traceId }, 404);

    // ── ALERTA INTERNO: vai para a EQUIPE, nunca para o cliente ──────────
    //
    // Regra do usuário (01/08/2026): quando o credenciado do laudo não é
    // encontrado no cadastro da PF, o cliente AVANÇA e não é alarmado. Quem
    // decide se há problema é a equipe — e, se houver, é a equipe que avisa.
    //
    // Fica aqui, e não numa função nova, porque este endpoint já é chamado
    // pelo mesmo modal que faz a conferência do laudo.
    const alertaEquipe = String(body?.alerta_equipe || "").trim();
    if (alertaEquipe) {
      const resultEquipe = await sendTransactional({
        templateName: "documento-status-cliente",
        recipientEmail: EMAIL_EQUIPE,
        idempotencyKey: `${traceId}-${documentoId}-alerta-equipe`,
        templateData: {
          nome: "Equipe Quero Armas",
          documento: nomeDocumento(doc),
          status: "alerta_interno",
          motivo:
            `Cliente ${String(body?.cliente_nome || "").trim() || doc.qa_cliente_id || "—"} enviou ` +
            `${nomeDocumento(doc)}. ${alertaEquipe} Conferir manualmente antes de protocolar. ` +
            `O cliente NÃO foi avisado.`,
          portalUrl: "https://euqueroarmas.com.br/admin",
        },
      });
      await logSistemaBackend({
        tipo: "email",
        status: resultEquipe.ok ? "success" : "error",
        mensagem: `Alerta interno de laudo enviado à equipe: ${EMAIL_EQUIPE}`,
        payload: { trace_id: traceId, documento_id: documentoId, alerta: alertaEquipe, queued: resultEquipe.queued, error: resultEquipe.error },
      }).catch(() => {});
      return json({ ok: true, destinatario: "equipe", traceId });
    }

    const status = statusInformado || String(doc.status || "").toLowerCase();
    if (status !== "aprovado" && status !== "reprovado") {
      return json({ skipped: true, reason: "status_sem_notificacao", status, traceId });
    }

    let cliente: { nome_completo: string | null; email: string | null } | null = null;
    if (doc.qa_cliente_id) {
      const { data } = await supabase
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("id", doc.qa_cliente_id)
        .maybeSingle();
      cliente = data;
    }
    if (!cliente?.email && doc.customer_id) {
      const { data } = await supabase
        .from("qa_clientes")
        .select("nome_completo, email")
        .eq("customer_id", doc.customer_id)
        .maybeSingle();
      cliente = data;
    }

    if (!cliente?.email) {
      await logSistemaBackend({
        tipo: "email",
        status: "warning",
        mensagem: "Documento aprovado/reprovado sem e-mail de cliente",
        payload: { trace_id: traceId, documento_id: documentoId, status },
      });
      return json({ skipped: true, reason: "cliente_sem_email", traceId });
    }

    const motivo = motivoInformado || String(doc.motivo_reprovacao || "").trim() || motivoPadrao(status);
    const portalUrl = "https://euqueroarmas.com.br/area-do-cliente?tab=documentos";

    const result = await sendTransactional({
      templateName: "documento-status-cliente",
      recipientEmail: cliente.email,
      // Uma mudança de estado gera no máximo um e-mail, mesmo se o navegador
      // repetir a chamada após timeout ou reconexão.
      idempotencyKey: `documento-status-${documentoId}-${status}`,
      templateData: {
        nome: cliente.nome_completo || "cliente",
        documento: nomeDocumento(doc),
        status,
        motivo,
        portalUrl,
      },
    });

    await logSistemaBackend({
      tipo: "email",
      status: result.ok ? "success" : "error",
      mensagem: `Aviso de documento ${status}: ${cliente.email}`,
      payload: { trace_id: traceId, documento_id: documentoId, status, queued: result.queued, error: result.error },
    });

    await supabase.from("qa_documentos_cliente_eventos").insert({
      documento_id: documentoId,
      customer_id: doc.customer_id ?? null,
      qa_cliente_id: doc.qa_cliente_id ?? null,
      acao: status,
      ator_tipo: "equipe",
      ator_user_id: guard.userId,
      detalhes: { trace_id: traceId, email: cliente.email, status, motivo, tipo: "email_documento_status", ok: result.ok, queued: result.queued, error: result.error },
    }).then(() => {}, () => {});

    return json({ success: result.ok, queued: result.queued, traceId }, result.ok ? 200 : 500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[qa-documento-cliente-notificar]", traceId, msg);
    return json({ error: msg, traceId }, 500);
  }
});
