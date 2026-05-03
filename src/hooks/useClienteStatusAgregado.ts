/**
 * useClienteStatusAgregado(clienteId)
 *
 * Hook canônico de leitura — consolida em um único lugar todas as fontes de
 * status do cliente Quero Armas. Não escreve, não cria RPC, não altera schema.
 * Usa as funções puras já existentes em statusUnificado.ts e statusColors.ts.
 *
 * Fontes lidas:
 *  - qa_cadastro_cr        (CR)
 *  - qa_crafs              (CRAF)
 *  - qa_gtes               (GTE)
 *  - qa_gte_documentos     (matching/leitura GTE)
 *  - qa_exames_cliente     (exames/laudos)
 *  - qa_documentos_cliente (hub documental + autorizações)
 *  - qa_processo_documentos (checklist por processo)
 *  - qa_processos
 *  - qa_solicitacoes_servico
 *  - qa_itens_venda
 *  - qa_cliente_armas_manual
 *
 * Munições NÃO entram nesta etapa (depende de migration data_fabricacao).
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStatusValidade,
  normalizeQaStatus,
  type StatusUnificado,
  type CorStatus,
  type TipoKpi,
} from "@/lib/quero-armas/statusUnificado";
import { getStatusTone, piorTone } from "@/lib/quero-armas/statusColors";

// ─────────── Tipos públicos ────────────────────────────────────────────────

export interface KpiValidade {
  total: number;
  ok: number;
  vencendo: number;
  vencidos: number;
  sem_data: number;
  tone: CorStatus;
}

export interface KpiCR {
  status: string;
  label: string;
  tone: CorStatus;
  dias_restantes: number | null;
  data_validade: string | null;
}

export interface KpiDocumentos {
  total: number;
  enviados: number;
  aprovados: number;
  pendentes: number;
  invalidos: number;
  vencidos: number;
  em_analise: number;
  reaproveitados: number;
  tone: CorStatus;
}

export interface KpiProcessos {
  total: number;
  aguardando_documentos: number;
  protocolados: number;
  deferidos: number;
  indeferidos: number;
  em_recurso: number;
  tone: CorStatus;
}

export interface KpiGtes extends KpiValidade {
  pendentes_leitura: number;
}

export interface AlertaItem {
  fonte: "CR" | "CRAF" | "GTE" | "EXAME" | "DOCUMENTO" | "AUTORIZACAO" | "PROCESSO";
  titulo: string;
  data_validade: string | null;
  dias_restantes: number | null;
  tone: CorStatus;
  status: StatusUnificado;
}

export interface KpiAlertas {
  total: number;
  criticos: number; // vermelho
  atencao: number; // laranja + amarelo
  ok: number; // verde
  itens: AlertaItem[];
}

export interface ClienteStatusAgregado {
  cliente_id: number;
  status_geral: string;
  tom_geral: CorStatus;
  contagem_por_cor: Record<CorStatus, number>;
  kpis: {
    cr: KpiCR;
    crafs: KpiValidade;
    gtes: KpiGtes;
    exames: KpiValidade;
    documentos: KpiDocumentos;
    autorizacoes: KpiValidade;
    processos: KpiProcessos;
    municoes: { total: number; tone: CorStatus; nota: string };
    alertas: KpiAlertas;
  };
}

// ─────────── Helpers internos ───────────────────────────────────────────────

function diasRestantes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - hoje.getTime()) / 86_400_000);
}

function classificarValidade(itens: { data_validade: string | null }[], tipo: TipoKpi): KpiValidade {
  let ok = 0,
    vencendo = 0,
    vencidos = 0,
    sem_data = 0;
  const tones: CorStatus[] = [];
  for (const i of itens) {
    if (!i.data_validade) {
      sem_data++;
      tones.push("cinza");
      continue;
    }
    const s = getStatusValidade(i.data_validade, tipo);
    tones.push(s.cor);
    if (s.cor === "vermelho") vencidos++;
    else if (s.cor === "amarelo" || s.cor === "laranja") vencendo++;
    else if (s.cor === "verde") ok++;
  }
  return {
    total: itens.length,
    ok,
    vencendo,
    vencidos,
    sem_data,
    tone: piorTone(tones.length ? tones : ["cinza"]),
  };
}

// ─────────── Hook ───────────────────────────────────────────────────────────

export function useClienteStatusAgregado(clienteId: number | null | undefined) {
  const [data, setData] = useState<ClienteStatusAgregado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sb = supabase as any;
      // NOTA: qa_itens_venda NÃO possui cliente_id; sua leitura aqui exigiria
      // join via venda_id. Como esse KPI ainda não é consumido, evitamos a
      // query global (proibido buscar sem vínculo de cliente). Será reintroduzida
      // quando ArsenalSummary realmente precisar dessa dimensão.
      const [
        crResp,
        crafResp,
        gteResp,
        gteDocResp,
        examesResp,
        docsResp,
        procDocResp,
        procResp,
      ] = await Promise.all([
        sb.from("qa_cadastro_cr").select("validade_cr, consolidado_em").eq("cliente_id", clienteId).order("id", { ascending: false }).limit(1),
        sb.from("qa_crafs").select("data_validade, nome_craf").eq("cliente_id", clienteId),
        sb.from("qa_gtes").select("data_validade").eq("cliente_id", clienteId),
        sb.from("qa_gte_documentos").select("data_validade, status_processamento, matching_status").eq("cliente_id", clienteId),
        sb.from("qa_exames_cliente").select("data_vencimento, tipo").eq("cliente_id", clienteId),
        sb.from("qa_documentos_cliente").select("status, data_validade, tipo_documento, origem").eq("qa_cliente_id", clienteId).neq("status", "excluido"),
        sb.from("qa_processo_documentos").select("status, data_validade_efetiva, processo_id").eq("cliente_id", clienteId),
        sb.from("qa_processos").select("status, pagamento_status").eq("cliente_id", clienteId),
      ]);

      const cr = crResp?.data?.[0] ?? null;
      const crafs: any[] = crafResp?.data ?? [];
      const gtes: any[] = gteResp?.data ?? [];
      const gteDocs: any[] = gteDocResp?.data ?? [];
      const exames: any[] = examesResp?.data ?? [];
      const docs: any[] = docsResp?.data ?? [];
      const procDocs: any[] = procDocResp?.data ?? [];
      const procs: any[] = procResp?.data ?? [];

      // ─── KPI: CR ──────────────────────────────────────────────────────────
      const crStatusU: StatusUnificado = cr?.validade_cr
        ? getStatusValidade(cr.validade_cr, "CR")
        : { dimensao: "vazio", codigo: "sem_cr", label: "CR NÃO CADASTRADO", cor: "cinza", prioridade: 10 };
      const kpiCr: KpiCR = {
        status: crStatusU.codigo,
        label: crStatusU.label,
        tone: crStatusU.cor,
        dias_restantes: diasRestantes(cr?.validade_cr ?? null),
        data_validade: cr?.validade_cr ?? null,
      };

      // ─── KPI: CRAF ────────────────────────────────────────────────────────
      const kpiCrafs = classificarValidade(
        crafs.map((c) => ({ data_validade: c.data_validade ?? null })),
        "CRAF",
      );

      // ─── KPI: GTE ─────────────────────────────────────────────────────────
      const baseGte = classificarValidade(
        gtes.map((g) => ({ data_validade: g.data_validade ?? null })),
        "GTE",
      );
      const pendentesLeitura = gteDocs.filter((d) => {
        const s = normalizeQaStatus(d.status_processamento);
        return s === "pendente" || s === "processando" || s === "aguardando_leitura_ia" || s === "em_leitura_ia";
      }).length;
      const kpiGtes: KpiGtes = {
        ...baseGte,
        pendentes_leitura: pendentesLeitura,
        tone: pendentesLeitura > 0 && baseGte.tone === "verde" ? "cinza" : baseGte.tone,
      };

      // ─── KPI: Exames ─────────────────────────────────────────────────────
      const kpiExames = classificarValidade(
        exames.map((e) => ({ data_validade: e.data_vencimento ?? null })),
        "EXAME_LAUDO",
      );

      // ─── Documentos: separar autorizações de demais ──────────────────────
      const autorizacoes = docs.filter((d) => {
        const t = normalizeQaStatus(d.tipo_documento);
        return t.includes("autoriza") || t.includes("aquisi");
      });
      const docsGerais = docs.filter((d) => !autorizacoes.includes(d));

      // ─── KPI: Documentos (status individual) ─────────────────────────────
      let aprovados = 0,
        invalidos = 0,
        pendentes = 0,
        emAnalise = 0,
        vencidosDocs = 0,
        reaproveitados = 0,
        enviados = 0;
      const tonesDocs: CorStatus[] = [];
      for (const d of docsGerais) {
        enviados++;
        const s = normalizeQaStatus(d.status);
        const origem = normalizeQaStatus(d.origem);
        if (origem.includes("hub") || s === "reaproveitado_do_hub_cliente") reaproveitados++;
        if (s === "aprovado" || s === "documentos_aprovados") aprovados++;
        else if (s === "invalido" || s === "reprovado" || s === "recusado" || s === "divergente") invalidos++;
        else if (s === "em_analise" || s === "em_validacao" || s === "em_validacao_ia" || s === "em_analise_equipe") emAnalise++;
        else if (s === "pendente" || s === "aguardando_complementacao" || !s) pendentes++;
        // validade
        if (d.data_validade) {
          const sv = getStatusValidade(d.data_validade, "DOCUMENTO_INDIVIDUAL");
          if (sv.cor === "vermelho") vencidosDocs++;
          tonesDocs.push(sv.cor);
        }
        tonesDocs.push(getStatusTone(s));
      }
      // checklist por processo (qa_processo_documentos) entra em pendentes
      for (const pd of procDocs) {
        const s = normalizeQaStatus(pd.status);
        if (s === "aprovado") aprovados++;
        else if (s === "invalido" || s === "reprovado") invalidos++;
        else pendentes++;
        if (pd.data_validade_efetiva) {
          const sv = getStatusValidade(pd.data_validade_efetiva, "DOCUMENTO_INDIVIDUAL");
          if (sv.cor === "vermelho") vencidosDocs++;
          tonesDocs.push(sv.cor);
        }
      }
      const kpiDocs: KpiDocumentos = {
        total: docsGerais.length + procDocs.length,
        enviados,
        aprovados,
        pendentes,
        invalidos,
        vencidos: vencidosDocs,
        em_analise: emAnalise,
        reaproveitados,
        tone: piorTone(tonesDocs.length ? tonesDocs : ["cinza"]),
      };

      // ─── KPI: Autorizações de compra ─────────────────────────────────────
      const kpiAuth = classificarValidade(
        autorizacoes.map((a) => ({ data_validade: a.data_validade ?? null })),
        "AUTORIZACAO_COMPRA",
      );

      // ─── KPI: Processos ──────────────────────────────────────────────────
      let aguardandoDocs = 0,
        protocolados = 0,
        deferidos = 0,
        indeferidos = 0,
        emRecurso = 0;
      const tonesProc: CorStatus[] = [];
      for (const p of procs) {
        const s = normalizeQaStatus(p.status);
        if (s === "aguardando_documentos" || s === "aguardando_documentacao") aguardandoDocs++;
        else if (s === "enviado_ao_orgao" || s === "protocolado" || s === "em_analise_orgao") protocolados++;
        else if (s === "deferido" || s === "finalizado" || s === "concluido") deferidos++;
        else if (s === "indeferido") indeferidos++;
        else if (s === "recurso_administrativo" || s === "recurso") emRecurso++;
        tonesProc.push(getStatusTone(s));
      }
      const kpiProc: KpiProcessos = {
        total: procs.length,
        aguardando_documentos: aguardandoDocs,
        protocolados,
        deferidos,
        indeferidos,
        em_recurso: emRecurso,
        tone: piorTone(tonesProc.length ? tonesProc : ["cinza"]),
      };

      // ─── Alertas (tudo com prazo) ─────────────────────────────────────────
      const alertas: AlertaItem[] = [];
      const empurra = (
        fonte: AlertaItem["fonte"],
        titulo: string,
        data: string | null,
        tipo: TipoKpi,
      ) => {
        if (!data) return;
        const s = getStatusValidade(data, tipo);
        if (s.cor === "verde") return; // só atenção/critico
        alertas.push({
          fonte,
          titulo,
          data_validade: data,
          dias_restantes: diasRestantes(data),
          tone: s.cor,
          status: s,
        });
      };
      if (cr?.validade_cr) empurra("CR", "CR", cr.validade_cr, "CR");
      crafs.forEach((c) => empurra("CRAF", c.nome_craf || "CRAF", c.data_validade, "CRAF"));
      gtes.forEach((g, i) => empurra("GTE", `GTE #${i + 1}`, g.data_validade, "GTE"));
      exames.forEach((e) => empurra("EXAME", e.tipo || "EXAME", e.data_vencimento, "EXAME_LAUDO"));
      docsGerais.forEach((d) => empurra("DOCUMENTO", d.tipo_documento || "DOCUMENTO", d.data_validade, "DOCUMENTO_INDIVIDUAL"));
      autorizacoes.forEach((a) => empurra("AUTORIZACAO", a.tipo_documento || "AUTORIZAÇÃO", a.data_validade, "AUTORIZACAO_COMPRA"));

      const kpiAlertas: KpiAlertas = {
        total: alertas.length,
        criticos: alertas.filter((a) => a.tone === "vermelho").length,
        atencao: alertas.filter((a) => a.tone === "amarelo" || a.tone === "laranja").length,
        ok: 0,
        itens: alertas.sort((a, b) => (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999)),
      };

      // ─── Status geral / contagem por cor ─────────────────────────────────
      const tonesGerais: CorStatus[] = [
        kpiCr.tone,
        kpiCrafs.tone,
        kpiGtes.tone,
        kpiExames.tone,
        kpiDocs.tone,
        kpiAuth.tone,
        kpiProc.tone,
      ];
      const contagem: Record<CorStatus, number> = {
        verde: 0,
        azul: 0,
        amarelo: 0,
        laranja: 0,
        vermelho: 0,
        cinza: 0,
      };
      tonesGerais.forEach((t) => {
        contagem[t]++;
      });

      const tomGeral = piorTone(tonesGerais);
      const labelGeral =
        tomGeral === "vermelho"
          ? "ATENÇÃO CRÍTICA"
          : tomGeral === "laranja"
            ? "PENDÊNCIAS"
            : tomGeral === "amarelo"
              ? "ATENÇÃO"
              : tomGeral === "azul"
                ? "EM ANDAMENTO"
                : tomGeral === "verde"
                  ? "EM DIA"
                  : "SEM DADOS";

      setData({
        cliente_id: clienteId,
        status_geral: labelGeral,
        tom_geral: tomGeral,
        contagem_por_cor: contagem,
        kpis: {
          cr: kpiCr,
          crafs: kpiCrafs,
          gtes: kpiGtes,
          exames: kpiExames,
          documentos: kpiDocs,
          autorizacoes: kpiAuth,
          processos: kpiProc,
          municoes: {
            total: 0,
            tone: "cinza",
            nota: "Aguardando migração de data_fabricacao",
          },
          alertas: kpiAlertas,
        },
      } as ClienteStatusAgregado);
    } catch (e: any) {
      setError(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { data, loading, error, recarregar: carregar };
}