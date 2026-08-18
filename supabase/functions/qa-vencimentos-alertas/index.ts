import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { escolherMarco, marcosParaTipo, MARCOS_PADRAO } from "../_shared/marcosVencimento.ts";
import {
  documentoSobGestaoDeAlerta,
  faixaVencimento,
  instrucaoAindaExigida,
  marcosFaixaDocumento,
} from "../_shared/faixaAlertaDocumento.ts";
import { comoResolverDocumento, nomeDocumentoCanonico } from "../_shared/nomeDocumento.ts";

/**
 * qa-vencimentos-alertas (BLOCO 5 — Etapas A+B+D)
 *
 * Rotina UNIFICADA para cobrir LACUNAS de alertas de vencimento:
 *   - CR (qa_cadastro_cr.validade_cr)
 *   - CRAF (qa_crafs.data_validade)
 *   - DOCUMENTOS com validade (qa_documentos_cliente.data_validade)
 *   - AUTORIZAÇÕES de compra (qa_documentos_cliente, tipo_documento ILIKE 'autoriza%')
 *   - DOSSIÊ: documentos do CHECKLIST DO PROCESSO (qa_processo_documentos)
 *
 * NÃO substitui ainda:
 *   - qa-gte-alertas
 *   - qa-exames-alertas
 *   - qa-processo-prazo-alertas
 *
 * MODO PADRÃO: dry_run=true (NUNCA envia e-mail real nesta etapa).
 * Só retorna preview de candidatos + assunto + corpo resumido.
 *
 * Dedupe: tabela `qa_vencimentos_alertas_enviados` com UNIQUE
 *   (fonte, ref_id, marco_dias, canal, data_referencia).
 *   Se data_referencia mudar (renovação), permite reenvio no novo ciclo.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
};

const MARCOS = MARCOS_PADRAO;
const PORTAL_LINK = "https://www.euqueroarmas.com.br/area-do-cliente";
const REMETENTE = "arsenalinteligente@notificacao.euqueroarmas.com.br";

type Fonte = "CR" | "CRAF" | "DOCUMENTO" | "AUTORIZACAO" | "DOSSIE";

interface Candidato {
  fonte: Fonte;
  ref_id: string;
  cliente_id: number;
  titulo: string;
  data_validade: string;
  dias: number;
  marco: number;
  /** Faixa em que o documento acabou de entrar (só fonte DOCUMENTO). */
  faixa?: "atencao" | "critico";
  /** Frase dinâmica de "onde emitir a via nova" (só fonte DOCUMENTO). */
  comoResolver?: string;
}

function diasRestantes(validade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${validade}T00:00:00`);
  return Math.floor((v.getTime() - hoje.getTime()) / 86400000);
}

function pickMarco(d: number, tipo?: string | null): number | null {
  if (d < -1) return -1; // agrupa vencidos pós dia 1
  const marcos = tipo ? marcosParaTipo(tipo) : MARCOS;
  // Certidões e laudos usam faixas próprias (15/10 + regressiva diária;
  // 120/90/60/45/30/20/10 + regressiva diária).
  return escolherMarco(d, marcos);
}

/**
 * MARCOS POR VIRADA DE FAIXA (documentos do Hub) — regra canônica 14/08/2026.
 *
 * O cliente é avisado quando o documento MUDA DE STATUS, não todo dia:
 *   entra em AMARELO  → 9 dias (ciclo curto) ou 30 dias (demais)
 *   entra em VERMELHO → 4 dias (ciclo curto) ou 10 dias (demais)
 *   vence             → marco 0 e, passado o dia, marco -1
 *
 * `escolherMarco` devolve o MENOR marco ainda >= dias restantes, então cada
 * faixa dispara uma única vez mesmo se o cron falhar por alguns dias. A trava
 * de repetição é a dedupe (fonte, ref_id, marco, canal, data_referencia): como
 * a data de referência é a validade do documento, enviar uma via nova cria um
 * ciclo novo e os alertas voltam a valer do zero.
 */
function pickMarcoFaixa(d: number, tipo?: string | null): number | null {
  if (d < -1) return -1;
  const { atencao, critico } = marcosFaixaDocumento(tipo);
  return escolherMarco(d, [atencao, critico, 0]);
}

/** Em qual faixa o documento entrou — define qual dos dois textos sai. */
function faixaDoMarco(d: number, tipo?: string | null): "atencao" | "critico" {
  return faixaVencimento(d, tipo) === "warn" ? "atencao" : "critico";
}

function brDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function buildSubject(
  fonte: Fonte,
  titulo: string,
  dias: number,
  marco: number,
  faixa?: "atencao" | "critico",
): string {
  // Documento em virada de faixa usa o assunto aprovado do template novo —
  // o dry_run precisa mostrar exatamente o que o cliente vai receber.
  if (faixa && dias >= 0) {
    const plural = dias === 1 ? "dia" : "dias";
    if (faixa === "critico") {
      return dias <= 0
        ? `${titulo} vence hoje — envie agora`
        : `${titulo} vence em ${dias} ${plural} — envie hoje`;
    }
    return `${titulo} entra em contagem — ${dias} ${plural} para vencer`;
  }
  if (dias < 0) return `🚨 ${fonte} ${titulo} VENCIDA há ${Math.abs(dias)} dia(s)`;
  if (marco === 0) return `🚨 ${fonte} ${titulo} vence HOJE`;
  return `⚠️ ${fonte} ${titulo} vence em ${dias} dia(s)`;
}

/** Como a fonte é NOMEADA para o cliente. "sua DOSSIE" não é português. */
function rotuloFonte(f: Fonte): string {
  if (f === "DOSSIE") return "documentação do processo";
  if (f === "DOCUMENTO") return "documentação";
  if (f === "AUTORIZACAO") return "autorização de compra";
  return f;
}

function buildResumo(c: Candidato, nome: string): string {
  const v = brDate(c.data_validade);
  const f = rotuloFonte(c.fonte);
  if (c.dias < 0) {
    return `Olá ${nome}, sua ${f} (${c.titulo}) está VENCIDA desde ${v} (${Math.abs(c.dias)} dia(s) de atraso).`;
  }
  if (c.marco === 0) {
    return `Olá ${nome}, sua ${f} (${c.titulo}) vence HOJE (${v}).`;
  }
  return `Olá ${nome}, sua ${f} (${c.titulo}) vence em ${c.dias} dia(s) — ${v}.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { requireQAStaff, requireCronToken } = await import("../_shared/qaAuth.ts");
  const cronCheck = requireCronToken(req);
  if (!cronCheck.ok) {
    const staffCheck = await requireQAStaff(req);
    if (!staffCheck.ok) return staffCheck.response;
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* GET ou body vazio */ }

  // Envio real por padrão desde 2026-07-22 (antes era dry_run por padrão).
  // Passe { dry_run: true } explicitamente para voltar ao modo simulação.
  const dryRun: boolean = body?.dry_run === true;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Reabre exigências sustentadas por documento vencido ANTES dos alertas.
    try {
      const { error: reabrirErr } = await sb.rpc("qa_reabrir_exigencias_documento_invalido");
      if (reabrirErr) console.error("[qa-vencimentos-alertas] reabrir exigencias:", reabrirErr);
    } catch (e) {
      console.error("[qa-vencimentos-alertas] reabrir exigencias (throw):", e);
    }

    const candidatos: Candidato[] = [];

    // 1) CR
    {
      const { data, error } = await sb
        .from("qa_cadastro_cr")
        .select("id, cliente_id, numero_cr, validade_cr, consolidado_em")
        .is("consolidado_em", null)
        .not("validade_cr", "is", null);
      if (error) throw error;
      for (const r of data || []) {
        if (!r.cliente_id || !r.validade_cr) continue;
        const d = diasRestantes(r.validade_cr);
        const m = pickMarco(d);
        if (m === null) continue;
        candidatos.push({
          fonte: "CR",
          ref_id: `cr:${r.id}`,
          cliente_id: r.cliente_id,
          titulo: r.numero_cr || `CR #${r.id}`,
          data_validade: r.validade_cr,
          dias: d,
          marco: m,
        });
      }
    }

    // 2) CRAF
    {
      const { data, error } = await sb
        .from("qa_crafs")
        .select("id, cliente_id, nome_craf, numero_arma, numero_sigma, data_validade")
        .not("data_validade", "is", null);
      if (error) throw error;
      for (const r of data || []) {
        if (!r.cliente_id || !r.data_validade) continue;
        const d = diasRestantes(r.data_validade);
        const m = pickMarco(d);
        if (m === null) continue;
        const titulo = `${r.nome_craf || "CRAF"} ${r.numero_sigma || r.numero_arma || `#${r.id}`}`;
        candidatos.push({
          fonte: "CRAF",
          ref_id: `craf:${r.id}`,
          cliente_id: r.cliente_id,
          titulo,
          data_validade: r.data_validade,
          dias: d,
          marco: m,
        });
      }
    }

    // 3) DOCUMENTOS com validade + 4) AUTORIZAÇÕES (mesma tabela, fonte distinta)
    {
      const { data, error } = await sb
        .from("qa_documentos_cliente")
        .select(
          "id, qa_cliente_id, tipo_documento, nome_documento, numero_documento, orgao_emissor, status, data_validade, ia_dados_extraidos",
        )
        .not("data_validade", "is", null);
      if (error) throw error;

      // Regime de gestão do alerta: documento de INSTRUÇÃO para de ser cobrado
      // depois do protocolo na PF. Precisamos dos processos de cada cliente
      // para saber se ainda existe pasta antes do protocolo.
      const clientesComDoc = [
        ...new Set((data || []).map((r) => r.qa_cliente_id).filter(Boolean)),
      ] as number[];
      const processosPorCliente = new Map<number, Array<{ status?: string | null }>>();
      if (clientesComDoc.length) {
        const { data: procs } = await sb
          .from("qa_processos")
          .select("cliente_id, status")
          .in("cliente_id", clientesComDoc);
        for (const p of (procs || []) as Array<{ cliente_id: number; status: string | null }>) {
          if (p?.cliente_id == null) continue;
          const lista = processosPorCliente.get(p.cliente_id) ?? [];
          lista.push({ status: p.status });
          processosPorCliente.set(p.cliente_id, lista);
        }
      }

      const STATUS_DOC_IGNORADOS = new Set(["reprovado", "substituido", "excluido"]);

      for (const r of data || []) {
        if (!r.qa_cliente_id || !r.data_validade) continue;
        const tipo = String(r.tipo_documento || "").toLowerCase();
        // Pular o que já é tratado por outras rotinas
        if (tipo.includes("gte") || tipo.includes("exame") || tipo.includes("laudo")) continue;
        // Documento reprovado/substituído/excluído não cobra prazo: o que vale
        // é a via vigente, e o cliente já foi avisado por outro caminho.
        if (STATUS_DOC_IGNORADOS.has(String(r.status || "").toLowerCase())) continue;
        const ehAutorizacao = tipo.includes("autoriza") || tipo.includes("aquisi");
        const d = diasRestantes(r.data_validade);

        // Instrução já protocolada não gera mais alerta — nem cor, nem e-mail.
        if (
          !documentoSobGestaoDeAlerta(tipo, {
            instrucaoExigida: instrucaoAindaExigida(processosPorCliente.get(r.qa_cliente_id)),
          })
        ) {
          continue;
        }

        // O DOCUMENTO comum avisa na VIRADA DE FAIXA (verde→amarelo,
        // amarelo→vermelho) e no vencimento — não em contagem diária.
        // Autorização de compra mantém os marcos próprios dela.
        const m = ehAutorizacao ? pickMarco(d, tipo) : pickMarcoFaixa(d, tipo);
        if (m === null) continue;
        candidatos.push({
          fonte: ehAutorizacao ? "AUTORIZACAO" : "DOCUMENTO",
          ref_id: `${ehAutorizacao ? "auth" : "doc"}:${r.id}`,
          cliente_id: r.qa_cliente_id,
          titulo: ehAutorizacao
            ? `${r.tipo_documento}${r.numero_documento ? ` ${r.numero_documento}` : ""}`
            : nomeDocumentoCanonico(r, String(r.tipo_documento || "Documento")),
          data_validade: r.data_validade,
          dias: d,
          marco: m,
          faixa: ehAutorizacao ? undefined : faixaDoMarco(d, tipo),
          comoResolver: ehAutorizacao ? undefined : comoResolverDocumento(r),
        });
      }
    }

    // 4.5) DOSSIÊ — documentos do CHECKLIST DO PROCESSO
    //
    // SEXTA AUDITORIA (18/08/2026). Nada vigiava a validade dos documentos que
    // vivem no checklist do processo: esta rotina só olhava o Hub
    // (`qa_documentos_cliente`). Os dois pontos que enxergam vencimento no
    // processo são REATIVOS e disparam tarde demais:
    //
    //   • `qa-montar-juntada` recusa montar o dossiê e reabre as linhas;
    //   • `qa-processo-checar-conclusao-checklist` barra a promoção.
    //
    // Ou seja: a equipe descobria no clique de montar a juntada, e o cliente
    // era mandado reemitir certidão no exato momento em que o processo deveria
    // estar indo para a delegacia. Certidão e comprovante de residência vivem
    // ~30 dias; um processo que demorou dois meses juntando laudo e exame de
    // tiro chega no protocolo com metade da papelada fora do prazo. Avisar
    // ANTES é a diferença entre reemitir com calma e refazer o dossiê inteiro.
    {
      const { data: procs } = await sb
        .from("qa_processos")
        .select("id, cliente_id, status");
      // Só processo ANTES do protocolo: depois disso o dossiê já foi entregue e
      // cobrar validade de documento protocolado é cobrar o que não se usa mais.
      const POS_PROTOCOLO = new Set([
        "protocolado", "em_analise_orgao", "notificado", "recurso_administrativo",
        "deferido", "indeferido", "concluido", "cancelado",
      ]);
      const processoDoCliente = new Map<string, number>();
      for (const p of (procs || []) as Array<{ id: string; cliente_id: number; status: string | null }>) {
        if (POS_PROTOCOLO.has(String(p.status ?? "").toLowerCase())) continue;
        processoDoCliente.set(p.id, p.cliente_id);
      }

      if (processoDoCliente.size > 0) {
        const { data: pdocs } = await sb
          .from("qa_processo_documentos")
          .select("id, cliente_id, processo_id, tipo_documento, nome_documento, status, data_validade, data_validade_efetiva")
          .in("processo_id", [...processoDoCliente.keys()]);

        // O MESMO PAPEL NÃO AVISA DUAS VEZES. Quase toda linha do checklist é
        // satisfeita por reaproveitamento do Hub, e o bloco 3 já cobriu essas.
        // Sem esta chave, o cliente receberia dois e-mails da mesma certidão.
        const jaCobertoPeloHub = new Set(
          candidatos
            .filter((c) => c.fonte === "DOCUMENTO")
            .map((c) => `${c.cliente_id}|${String(c.titulo).toLowerCase()}`),
        );

        // Só entra o que CONTA para o dossiê: pendente vencido não é problema
        // de validade, é problema de envio, e já aparece como pendência.
        const CONTA_NO_DOSSIE = new Set([
          "aprovado", "entregue_pelo_hub", "dispensado_por_reaproveitamento",
        ]);

        for (const r of (pdocs || []) as Array<Record<string, string | null>>) {
          const clienteId = processoDoCliente.get(String(r.processo_id));
          if (!clienteId) continue;
          if (!CONTA_NO_DOSSIE.has(String(r.status ?? "").toLowerCase())) continue;
          const validade = r.data_validade_efetiva || r.data_validade;
          if (!validade) continue;
          const tipo = String(r.tipo_documento || "").toLowerCase();
          // Tratados por rotinas próprias, com regra de negócio diferente.
          if (tipo.includes("gte") || tipo.includes("exame") || tipo.includes("laudo")) continue;

          const titulo = nomeDocumentoCanonico(
            r as Record<string, unknown>,
            String(r.nome_documento || r.tipo_documento || "Documento"),
          );
          if (jaCobertoPeloHub.has(`${clienteId}|${titulo.toLowerCase()}`)) continue;

          const d = diasRestantes(validade);
          const m = pickMarcoFaixa(d, tipo);
          if (m === null) continue;
          candidatos.push({
            fonte: "DOSSIE",
            ref_id: `procdoc:${r.id}`,
            cliente_id: clienteId,
            titulo,
            data_validade: validade,
            dias: d,
            marco: m,
            faixa: faixaDoMarco(d, tipo),
            comoResolver: comoResolverDocumento(r as Record<string, unknown>),
          });
        }
      }
    }

    // 5) Filtrar contra dedupe table
    const refIds = candidatos.map((c) => c.ref_id);
    const { data: jaEnviados } = refIds.length
      ? await sb
          .from("qa_vencimentos_alertas_enviados")
          .select("fonte, ref_id, marco_dias, canal, data_referencia")
          .in("ref_id", refIds)
      : { data: [] as any[] };
    const dedupeSet = new Set(
      (jaEnviados || []).map(
        (r: any) => `${r.fonte}|${r.ref_id}|${r.marco_dias}|${r.canal}|${r.data_referencia}`,
      ),
    );

    // 6) Carregar dados de clientes
    const clienteIds = [...new Set(candidatos.map((c) => c.cliente_id))];
    const { data: clientes } = clienteIds.length
      ? await sb
          .from("qa_clientes")
          .select("id, nome_completo, email")
          .in("id", clienteIds)
      : { data: [] as any[] };
    const clienteMap = new Map<number, any>(
      (clientes || []).map((c: any) => [c.id, c]),
    );

    // 7) Montar preview / executar envio
    const previews: any[] = [];
    let pulados = 0;
    let enviados = 0;
    const inserts: any[] = [];

    for (const c of candidatos) {
      const cliente = clienteMap.get(c.cliente_id);
      if (!cliente?.email) {
        pulados++;
        continue;
      }
      const canal = "email_cliente";
      const dedupeKey = `${c.fonte}|${c.ref_id}|${c.marco}|${canal}|${c.data_validade}`;
      if (dedupeSet.has(dedupeKey)) {
        pulados++;
        continue;
      }

      const nome = cliente.nome_completo || "Cliente";
      const subject = buildSubject(c.fonte, c.titulo, c.dias, c.marco, c.faixa);
      const resumo = buildResumo(c, nome);

      previews.push({
        destinatario: cliente.email,
        remetente: REMETENTE,
        assunto: subject,
        fonte: c.fonte,
        item: c.titulo,
        data_vencimento: c.data_validade,
        marco_dias: c.marco,
        dias_restantes: c.dias,
        faixa: c.faixa ?? null,
        como_resolver: c.comoResolver ?? null,
        mensagem: resumo,
        portal: PORTAL_LINK,
        cliente_nome: nome,
        cliente_id: c.cliente_id,
      });

      if (!dryRun) {
        // ENVIO REAL — roteia template por fonte/marco (Arsenal Inteligente).
        try {
          const { sendTransactional } = await import("../_shared/sendTransactional.ts");
          const vencimentoBR = (c.data_validade || "").split("-").reverse().join("/");
          let templateName = "vencimento-documento";
          let templateData: Record<string, unknown> = {
            nome,
            documento: subject.replace(/^[^\w]*\s*/, ""),
            observacao: resumo,
            diasRestantes: String(c.dias),
            vencimento: vencimentoBR,
            portalUrl: PORTAL_LINK,
          };
          if (c.fonte === "AUTORIZACAO") {
            templateName = "autorizacao-compra-vencimento";
            templateData = {
              nome,
              autorizacao: c.titulo,
              vencimento: vencimentoBR,
              portalUrl: PORTAL_LINK,
            };
          } else if (c.fonte === "CR" && (c.marco === 90 || c.marco === 60)) {
            // Janela oficial de renovação PF: 30–90 dias antes do vencimento.
            templateName = "risco-janela-renovacao-cr";
            templateData = {
              nome,
              cr: c.titulo,
              vencimento: vencimentoBR,
              portalUrl: PORTAL_LINK,
            };
          } else if ((c.fonte === "DOCUMENTO" || c.fonte === "DOSSIE") && c.faixa && c.dias >= 0) {
            // VIRADA DE FAIXA — o texto nomeia o documento, diz o prazo real e
            // fecha com onde emitir a via nova. Um e-mail por virada.
            templateName = "documento-mudanca-faixa";
            templateData = {
              nome,
              documento: c.titulo,
              faixa: c.faixa,
              diasRestantes: String(c.dias),
              vencimento: vencimentoBR,
              comoResolver: c.comoResolver,
              portalUrl: PORTAL_LINK,
            };
          }
          const res = await sendTransactional({
            templateName,
            recipientEmail: cliente.email,
            // A data de validade entra na chave DE PROPÓSITO: ela é o ciclo do
            // documento. Sem ela, um cliente que renovasse o documento e caísse
            // no mesmo marco (ex.: 9 dias de novo) seria barrado como repetido
            // e nunca mais receberia o aviso. É a mesma regra da dedupe em
            // qa_vencimentos_alertas_enviados, que já usa data_referencia.
            idempotencyKey: `qa-venc-${c.fonte}-${c.ref_id}-${c.marco}-${c.data_validade}`,
            templateData,
          });
          if (!res.ok) throw new Error(res.error);
          enviados++;
          inserts.push({
            cliente_id: c.cliente_id,
            fonte: c.fonte,
            ref_id: c.ref_id,
            marco_dias: c.marco,
            canal,
            destinatario: cliente.email,
            data_referencia: c.data_validade,
            status: "enviado",
            detalhes: { dias_restantes: c.dias, titulo: c.titulo },
          });
        } catch (err: any) {
          inserts.push({
            cliente_id: c.cliente_id,
            fonte: c.fonte,
            ref_id: c.ref_id,
            marco_dias: c.marco,
            canal,
            destinatario: cliente.email,
            data_referencia: c.data_validade,
            status: "erro",
            erro_mensagem: String(err?.message || err),
          });
        }
      }
    }

    if (!dryRun && inserts.length) {
      await sb.from("qa_vencimentos_alertas_enviados").upsert(inserts, {
        onConflict: "fonte,ref_id,marco_dias,canal,data_referencia",
        ignoreDuplicates: true,
      });
    }

    // Motor de notificações in-app (popup persistente no portal do cliente).
    // Urgente para CR/CRAF/Autorização de compra dentro de 30 dias (ou já
    // vencido). Roda mesmo em dry_run — é o popup do portal, não e-mail.
    const categoriaPorFonte: Partial<Record<Fonte, string>> = {
      CR: "cr", CRAF: "craf", AUTORIZACAO: "autorizacao_compra",
    };
    const referenciaTabelaPorFonte: Partial<Record<Fonte, string>> = {
      CR: "qa_cadastro_cr", CRAF: "qa_crafs", AUTORIZACAO: "qa_documentos_cliente",
    };
    const urgentesAgora = new Set<string>();
    const notifRows: any[] = [];
    for (const c of candidatos) {
      const categoria = categoriaPorFonte[c.fonte];
      if (!categoria || c.marco > 30) continue;
      const refTabela = referenciaTabelaPorFonte[c.fonte]!;
      const refId = c.ref_id.split(":")[1] || c.ref_id;
      urgentesAgora.add(`${c.cliente_id}_${categoria}_${refTabela}_${refId}`);
      const vencStr = brDate(c.data_validade);
      notifRows.push({
        cliente_id: c.cliente_id,
        categoria,
        urgencia: "urgente",
        titulo: c.dias < 0 ? `${c.fonte} vencida` : `${c.fonte} vencendo em ${c.dias} dia(s)`,
        mensagem: c.dias < 0
          ? `Sua ${c.fonte} (${c.titulo}) está vencida desde ${vencStr}. Regularize o quanto antes.`
          : `Sua ${c.fonte} (${c.titulo}) vence em ${c.dias} dia(s) — ${vencStr}.`,
        link: "/area-do-cliente/alertas-vencimento",
        referencia_tabela: refTabela,
        referencia_id: refId,
        ativa: true,
      });
    }
    if (notifRows.length > 0) {
      await sb.from("qa_notificacoes_cliente").upsert(notifRows, {
        onConflict: "cliente_id,categoria,referencia_tabela,referencia_id",
      });
    }
    const { data: ativasVenc } = await sb
      .from("qa_notificacoes_cliente")
      .select("id, cliente_id, categoria, referencia_tabela, referencia_id")
      .in("categoria", ["cr", "craf", "autorizacao_compra"])
      .eq("ativa", true);
    const paraResolverVenc = ((ativasVenc || []) as any[])
      .filter((n) => !urgentesAgora.has(`${n.cliente_id}_${n.categoria}_${n.referencia_tabela}_${n.referencia_id}`))
      .map((n) => n.id);
    if (paraResolverVenc.length > 0) {
      await sb.from("qa_notificacoes_cliente")
        .update({ ativa: false, resolvida_em: new Date().toISOString() })
        .in("id", paraResolverVenc);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        candidatos_total: candidatos.length,
        previews_count: previews.length,
        pulados_dedupe_ou_sem_email: pulados,
        enviados_reais: enviados,
        erros_count: inserts.filter((i) => i.status === "erro").length,
        previews,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[qa-vencimentos-alertas] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});