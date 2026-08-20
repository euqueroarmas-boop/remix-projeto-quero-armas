// ============================================================================
// qa-processo-checar-conclusao-checklist
// ----------------------------------------------------------------------------
// Quando TODAS as exigências documentais de um processo estão cumpridas (sem
// pendência, sem em análise, perguntas-pivot respondidas) e o pagamento já
// foi confirmado, promove o status macro do processo para
// `pronto_para_protocolar` e dispara DUAS notificações idempotentes:
//   1. e-mail ao cliente: "Documentação completa"
//   2. e-mail à equipe (eu@queroarmas.com.br) com link do processo
//
// Idempotência: grava `respostas_questionario_json.notificacoes
// .pronto_para_protocolar_enviado_em`. Se já existir, NÃO reenvia.
//
// Pode ser chamado por:
//   - service_role (Edge Functions internas) → x-internal-token
//   - staff QA ativo
//   - dono do processo (cliente autenticado direto ou via cliente_auth_links)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ehExigenciaEtapaFinal, itemContaParaConclusao, itemVisivelGuia } from "../_shared/checklistVisibility.ts";
import { estaVencido, hojeISOBRT, validadeVigente } from "../_shared/vigenciaDossie.ts";
import { mesclarRespostasCadastro } from "../_shared/respostasCadastro.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token, x-admin-token",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CUMPRIDO = new Set([
  "aprovado", "validado", "concluido", "concluído",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento",
  "entregue_pelo_hub",
  "nao_aplicavel", "hub_reaproveitado",
]);
const EM_ANALISE = new Set([
  "em_analise", "enviado", "fila", "processando",
  "revisao_humana", "em_revisao_humana", "pendente_aprovacao", "aguardando_equipe",
]);

// Status macro do processo que ainda contam como "checklist em curso" e
// portanto podem ser promovidos a `pronto_para_protocolar`. Qualquer outro
// status já avançou no fluxo (protocolado, deferido, etc.) e NÃO deve voltar.
// Precisa cobrir TODO status de "checklist em curso" do CHECK do banco.
// `validado` e `em_analise_interna` faltavam: a equipe marcava a documentação
// como aprovada e o processo virava um beco sem saída — a promoção automática
// recusava para sempre, e com ela o e-mail de "documentação completa" ao
// cliente e o aviso à equipe. Os dois primeiros da segunda linha são valores
// legados que nunca constaram do CHECK; ficam por segurança e são inofensivos.
const STATUS_PROMOVIVEIS = new Set([
  "aguardando_documentos", "em_validacao", "revisao_humana",
  "pendente_cliente", "em_analise_interna", "validado",
  "documentos_pendentes", "em_documentacao",
]);

const TEAM_EMAIL = "eu@queroarmas.com.br";
const PORTAL_BASE = "https://www.euqueroarmas.com.br/area-do-cliente";
const ADMIN_BASE = "https://www.euqueroarmas.com.br/quero-armas/processos";
const BRAND = "QUERO ARMAS";

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isPergunta(d: any): boolean {
  if (d?.regra_validacao?.tipo === "pergunta") return true;
  return String(d?.tipo_documento || "").toLowerCase().startsWith("pergunta_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, service);

  try {
    const body = await req.json().catch(() => ({}));
    const processoId = String((body as any)?.processo_id || "").trim();
    const origem = String((body as any)?.origem || "auto");
    if (!processoId) return json({ error: "processo_id_obrigatorio" }, 400);
    // O gate da peça monta um filtro `.or(...)` com este id — string livre
    // dentro de filtro é porta de injeção. UUID ou nada.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(processoId)) {
      return json({ error: "processo_id_invalido" }, 400);
    }

    // Autorização leve: internal-token OU staff OU dono.
    const internalToken = req.headers.get("x-internal-token") || "";
    const isInternal = internalToken && internalToken === Deno.env.get("INTERNAL_FUNCTION_TOKEN");
    let isAuthorized = !!isInternal;
    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const userClient = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await userClient.auth.getUser(token);
        const authUserId = userData?.user?.id;
        if (authUserId) {
          const { data: staff } = await admin.from("qa_usuarios_perfis")
            .select("perfil, ativo").eq("user_id", authUserId).eq("ativo", true).maybeSingle();
          if (staff) isAuthorized = true;
          if (!isAuthorized) {
            const { data: proc } = await admin.from("qa_processos")
              .select("cliente_id").eq("id", processoId).maybeSingle();
            if (proc) {
              const { data: cli } = await admin.from("qa_clientes")
                .select("user_id").eq("id", proc.cliente_id).maybeSingle();
              if ((cli as any)?.user_id === authUserId) isAuthorized = true;
              if (!isAuthorized) {
                const { data: link } = await admin.from("cliente_auth_links")
                  .select("qa_cliente_id").eq("user_id", authUserId)
                  .eq("qa_cliente_id", proc.cliente_id).eq("status", "active").maybeSingle();
                if (link) isAuthorized = true;
              }
            }
          }
        }
      }
    }
    if (!isAuthorized) return json({ error: "forbidden" }, 403);

    const { data: processo } = await admin
      .from("qa_processos")
      .select("id, cliente_id, servico_id, servico_nome, status, pagamento_status, respostas_questionario_json")
      .eq("id", processoId)
      .maybeSingle();
    if (!processo) return json({ error: "processo_not_found" }, 404);

    const statusAtual = String((processo as any).status || "").toLowerCase();
    const respostasProcesso = (processo as any).respostas_questionario_json || {};
    const { data: clienteCad } = await admin
      .from("qa_clientes")
      .select("categoria_titular, profissao")
      .eq("id", (processo as any).cliente_id)
      .maybeSingle();
    // Cadastro como fonte derivada de resposta (espelha o front).
    const respostas = mesclarRespostasCadastro(respostasProcesso, clienteCad as any);
    const notificacoes = (respostas?.notificacoes || {}) as Record<string, any>;
    const jaNotificadoEm = notificacoes?.pronto_para_protocolar_enviado_em || null;

    // Curto-circuito: já está protocolado ou além.
    if (statusAtual === "pronto_para_protocolar") {
      return json({ pronto: true, ja_estava: true, motivo: "ja_pronto" });
    }
    if (!STATUS_PROMOVIVEIS.has(statusAtual)) {
      return json({ pronto: false, motivo: "status_macro_nao_promovivel", status_atual: statusAtual });
    }
    if ((processo as any).pagamento_status && (processo as any).pagamento_status !== "confirmado") {
      return json({ pronto: false, motivo: "pagamento_nao_confirmado" });
    }

    const { data: docs } = await admin
      .from("qa_processo_documentos")
      .select("id, status, obrigatorio, tipo_documento, regra_validacao, data_validade, data_validade_efetiva")
      .eq("processo_id", processoId);
    const lista = (docs || []) as any[];
    // Filtra usando a regra compartilhada com o front (itemVisivelGuia +
    // obrigatório). Itens escondidos por exige_quando/depende_de a partir das
    // respostas atuais NÃO contam como pendentes.
    const obrigatorios = lista.filter((d) => itemContaParaConclusao(d, respostas));

    // Este processo tem passos que só abrem AGORA (assinar a juntada no gov.br,
    // gerar o código de duas etapas)? Eles ficaram de fora da contagem acima de
    // propósito — não são pré-requisito para protocolar, eles SÃO o protocolo.
    // Mas mudam o e-mail: "acabou, pode relaxar" seria mentira num processo em
    // que o cliente ainda tem duas coisas para fazer, e mentira que faz ele
    // parar de olhar o portal justamente na hora de agir.
    const temEtapaFinal = lista.some((d) =>
      d?.obrigatorio === true && ehExigenciaEtapaFinal(d) && itemVisivelGuia(d, respostas)
    );

    if (obrigatorios.length === 0) {
      return json({ pronto: false, motivo: "sem_exigencias_obrigatorias" });
    }

    for (const d of obrigatorios) {
      if (isPergunta(d)) {
        const chave = d?.regra_validacao?.chave;
        // Só trata como pergunta-pivot quando existe `chave` válida.
        // Perguntas legadas sem chave caem no fluxo padrão por status.
        if (chave) {
          const v = respostas[chave];
          if (v === undefined || v === null || v === "") {
            return json({ pronto: false, motivo: "pergunta_pendente" });
          }
          continue;
        }
      }
      const st = String(d.status || "").toLowerCase();
      if (EM_ANALISE.has(st)) return json({ pronto: false, motivo: "documento_em_analise" });
      if (!CUMPRIDO.has(st)) return json({ pronto: false, motivo: "documento_pendente", status_doc: st });

      // VIGÊNCIA (regra da equipe, 16/08/2026): documento aprovado mas VENCIDO
      // não deixa o processo ficar pronto. Certidão e comprovante de residência
      // vivem ~30 dias; um processo que demorou juntando laudo chega ao
      // protocolo com metade da papelada fora do prazo. Deixar passar aqui é
      // empurrar o problema para a delegacia, onde ele vira exigência e mais
      // 10 dias de prazo.
      if (estaVencido(d, hojeISOBRT())) {
        return json({
          pronto: false,
          motivo: "documento_vencido",
          tipo_documento: d.tipo_documento,
          venceu_em: validadeVigente(d),
        });
      }
    }

    // ── GATE: A PETIÇÃO PRECISA TER PASSADO PELA EQUIPE ──────────────────
    //
    // O aceite do cliente em `qa-efetiva-aprovar` fecha a linha do checklist
    // como `aprovado` — de propósito, para o cliente seguir para os laudos sem
    // esperar. Mas aceite do cliente NÃO é revisão da equipe: o próprio
    // `qa-efetiva-aprovar` deixa o registro em `em_revisao` justamente porque
    // alguém ainda precisa ler.
    //
    // Sem este gate, o checklist ficava 100% e o processo virava
    // `pronto_para_protocolar` com uma petição de efetiva necessidade que
    // ninguém da Quero Armas leu — e ela é a peça que decide o pedido. Pior:
    // seguia direto para a juntada e para a delegacia.
    //
    // Só morde quando existe registro: serviço sem efetiva necessidade não tem
    // linha nenhuma aqui e passa reto.
    {
      const { data: efetivas } = await admin
        .from("qa_efetiva_necessidade")
        .select("id, status, aprovado_cliente")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: false })
        .limit(1);
      const efetiva = (efetivas ?? [])[0] as { status?: string } | undefined;
      if (efetiva && String(efetiva.status ?? "").toLowerCase() !== "aprovado") {
        return json({
          pronto: false,
          motivo: "efetiva_necessidade_sem_revisao_da_equipe",
          status_efetiva: efetiva.status ?? null,
        });
      }
    }

    // ── GATE: A DEFESA PRECISA ESTAR APROVADA PELO CLIENTE ───────────────
    //
    // A peça é o documento que sustenta o pedido — o que a Polícia Federal lê e
    // que decide o processo. Protocolada com fato errado não se conserta: vira
    // parte do processo e a autoridade seguinte lê aquilo.
    //
    // E promover aqui não é detalhe de status: `pronto_para_protocolar` é
    // exatamente o que ABRE a etapa final para o cliente — GRU, gov.br,
    // juntada (ver `_shared/checklistVisibility` e `etapaFinalProtocolo`). Ou
    // seja, promover sem defesa aprovada é convidar o cliente a pagar a taxa da
    // PF antes de existir defesa.
    //
    // Até 20/08/2026 o freio só mordia a peça JÁ enviada e pendurada
    // (`aguardando_cliente`/`devolvida`). Processo sem peça nenhuma — o caso
    // real do Anthony — passava reto. Agora o serviço declara se tem defesa
    // escrita (`qa_servicos_catalogo.exige_peca_defesa`) e, quando tem, só o
    // `aprovada` libera.
    {
      const servicoId = (processo as any).servico_id ?? null;
      const clienteId = (processo as any).cliente_id ?? null;

      const { data: servicos } = servicoId == null
        ? { data: null }
        : await admin
            .from("qa_servicos_catalogo")
            .select("exige_peca_defesa")
            .eq("servico_id", servicoId)
            .limit(1);
      const exigePeca = ((servicos ?? [])[0] as { exige_peca_defesa?: boolean } | undefined)?.exige_peca_defesa === true;

      // A minuta nasce SEM `processo_id` — quem grava esse vínculo é
      // `qa-peca-enviar-cliente`, no envio. Procurar só por processo deixaria
      // de fora justamente o rascunho que ainda está com a equipe.
      const filtro = clienteId == null
        ? `processo_id.eq.${processoId}`
        : `processo_id.eq.${processoId},and(processo_id.is.null,cliente_id.eq.${clienteId})`;
      const { data: pecas } = await admin
        .from("qa_geracoes_pecas")
        .select("id, status_cliente, processo_id, cliente_id")
        .or(filtro);

      const status = (pecas ?? []).map((p: any) => String(p?.status_cliente ?? "").toLowerCase());
      const pendente = status.find((s) => s === "aguardando_cliente" || s === "devolvida");
      if (pendente) {
        return json({
          pronto: false,
          motivo: pendente === "devolvida"
            ? "peticao_devolvida_pelo_cliente"
            : "peticao_aguardando_aprovacao_do_cliente",
          status_peca: pendente,
        });
      }

      if (exigePeca && !status.includes("aprovada")) {
        return json({
          pronto: false,
          motivo: status.includes("nao_enviada")
            ? "peticao_em_rascunho_nao_enviada"
            : "peticao_nao_escrita",
          pecas_encontradas: status.length,
        });
      }
    }

    const agora = new Date().toISOString();

    // Promove status macro (guard idempotente — só se ainda estiver num
    // status promovível). Atualiza também o JSON de notificações para evitar
    // reenvio.
    const novasNotificacoes = {
      ...notificacoes,
      pronto_para_protocolar_enviado_em: jaNotificadoEm || agora,
      pronto_para_protocolar_origem: origem,
    };
    const { error: upErr } = await admin
      .from("qa_processos")
      .update({
        status: "pronto_para_protocolar",
        respostas_questionario_json: { ...respostasProcesso, notificacoes: novasNotificacoes },
        updated_at: agora,
      })
      .eq("id", processoId)
      .in("status", Array.from(STATUS_PROMOVIVEIS));
    if (upErr) {
      console.error("[checar-conclusao] update status falhou", upErr);
      return json({ error: upErr.message }, 500);
    }

    await admin.from("qa_processo_eventos").insert({
      processo_id: processoId,
      tipo_evento: "processo_pronto_para_protocolar",
      descricao: "CHECKLIST DOCUMENTAL 100% CUMPRIDO — PROCESSO PRONTO PARA PROTOCOLO",
      ator: "sistema_auto",
      dados_json: { origem, status_anterior: statusAtual },
    });

    // Envia e-mails apenas na PRIMEIRA promoção (idempotência via jaNotificadoEm).
    let emailClienteOk: boolean | null = null;
    let emailEquipeOk: boolean | null = null;
    if (!jaNotificadoEm) {
      const { data: cliente } = await admin
        .from("qa_clientes")
        .select("nome_completo, email, cpf")
        .eq("id", (processo as any).cliente_id)
        .maybeSingle();

      const servico = (processo as any).servico_nome || "seu processo";
      const portalUrl = `${PORTAL_BASE}?processo=${processoId}`;
      const adminUrl = `${ADMIN_BASE}?processo=${processoId}`;
      const nomeCli = (cliente as any)?.nome_completo || "cliente";
      const internalTokenSecret = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || "";

      // 1) E-mail ao cliente
      if ((cliente as any)?.email) {
        const htmlCliente = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
  <tr><td style="background:#0f172a;padding:22px 28px;">
    <div style="font-size:11px;letter-spacing:0.18em;color:#94a3b8;font-weight:700;">${BRAND}</div>
    <div style="font-size:20px;color:#fff;font-weight:700;margin-top:6px;">Documentação completa</div>
  </td></tr>
  <tr><td style="padding:28px;">
    <p style="font-size:15px;margin:0 0 12px;">Olá, <strong>${escapeHtml(nomeCli)}</strong>.</p>
    <p style="font-size:15px;line-height:1.6;color:#1f2937;margin:0 0 14px;">
      Sua documentação do processo <strong>${escapeHtml(servico)}</strong> foi concluída e está
      <strong>pronta para protocolo</strong> junto ao órgão competente.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 18px;">
      A equipe Quero Armas seguirá com a próxima etapa. Você poderá acompanhar tudo pela Área do Cliente.
    </p>
    <p style="text-align:center;margin:24px 0 8px;">
      <a href="${portalUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">Acessar Área do Cliente</a>
    </p>
    <div style="background:#f1f5f9;border-radius:10px;padding:14px 16px;margin:20px 0 0;">
      <div style="font-size:10px;letter-spacing:0.14em;font-weight:700;color:#64748b;">SERVIÇO</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:4px;text-transform:uppercase;">${escapeHtml(servico)}</div>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;">
    <div style="font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${BRAND}.</div>
  </td></tr>
</table></td></tr></table></body></html>`;
        try {
          const { sendTransactional } = await import("../_shared/sendTransactional.ts");
          const r = await sendTransactional({
            // TUDO É COMUNICADO POR E-MAIL (regra da equipe, 16/08/2026). Quando
            // o processo tem etapa final, o e-mail que sai aqui é o que diz que
            // chegamos no momento da entrega à PF e que o cliente precisa
            // assinar a juntada e gerar o código do gov.br.
            templateName: temEtapaFinal ? "etapa-final-liberada" : "documentacao-completa",
            recipientEmail: (cliente as any).email,
            idempotencyKey: `pronto-proto-cli-${processoId}`,
            templateData: {
              nome: nomeCli,
              servico,
              portalUrl,
            },
          });
          emailClienteOk = r.ok;
        } catch (e) {
          console.warn("[checar-conclusao] email cliente falhou", e);
          emailClienteOk = false;
        }
      }

      // 2) E-mail à equipe
      try {
        const htmlEquipe = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
  <tr><td style="background:#0f172a;padding:20px 26px;">
    <div style="font-size:11px;letter-spacing:0.18em;color:#94a3b8;font-weight:700;">${BRAND} · INTERNO</div>
    <div style="font-size:18px;color:#fff;font-weight:700;margin-top:6px;">Processo pronto para protocolar</div>
  </td></tr>
  <tr><td style="padding:24px 26px;">
    <p style="margin:0 0 12px;font-size:14px;">Um processo concluiu 100% do checklist documental e está pronto para dar entrada no órgão competente.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:14px 0;">
      <tr><td style="padding:6px 0;color:#64748b;width:130px;">Cliente</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(nomeCli)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">CPF</td><td style="padding:6px 0;font-weight:700;">${escapeHtml((cliente as any)?.cpf || "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Serviço</td><td style="padding:6px 0;font-weight:700;text-transform:uppercase;">${escapeHtml(servico)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Processo</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${escapeHtml(processoId)}</td></tr>
    </table>
    <p style="text-align:center;margin:22px 0 0;">
      <a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">Abrir no Admin</a>
    </p>
  </td></tr>
</table></td></tr></table></body></html>`;
        const { sendTransactional } = await import("../_shared/sendTransactional.ts");
        const r = await sendTransactional({
          templateName: "processo-pronto-protocolar",
          recipientEmail: TEAM_EMAIL,
          idempotencyKey: `pronto-proto-team-${processoId}`,
          templateData: {
            nomeCliente: nomeCli,
            servico,
            vendaId: String(processoId),
            adminUrl,
          },
        });
        emailEquipeOk = r.ok;
      } catch (e) {
        console.warn("[checar-conclusao] email equipe falhou", e);
        emailEquipeOk = false;
      }
    }

    return json({
      pronto: true,
      status_anterior: statusAtual,
      status_novo: "pronto_para_protocolar",
      ja_estava: false,
      ja_notificado: !!jaNotificadoEm,
      email_cliente_ok: emailClienteOk,
      email_equipe_ok: emailEquipeOk,
    });
  } catch (err: any) {
    console.error("qa-processo-checar-conclusao-checklist:", err);
    return json({ error: err?.message || "erro_interno" }, 500);
  }
});