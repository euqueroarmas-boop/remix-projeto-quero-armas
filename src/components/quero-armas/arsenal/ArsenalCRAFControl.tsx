/**
 * ArsenalCRAFControl
 *
 * Bloco "Controle de CRAF" da aba Arsenal — F1A.
 * Padrão visual idêntico ao ArsenalGTEControl.
 *
 * Fontes de leitura (NÃO escreve nada nesta etapa):
 *   - qa_crafs:               CRAFs canônicos já consolidados.
 *   - qa_documentos_cliente:  documentos enviados com tipo CRAF aguardando
 *                             ou já validados pela Equipe Quero Armas.
 *
 * Indicadores: total, válidos, próx. vencer, vencidos, armas vinculadas,
 * sem vínculo e pendentes de revisão.
 *
 * Cadastro/edição manual e OCR/IA serão liberados na F1B.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Crosshair, FileText, Link2, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clienteId: number;
  origem: "cliente" | "equipe";
}

interface CrafCanonico {
  id: number;
  cliente_id: number;
  data_validade: string | null;
  nome_arma: string | null;
  numero_sigma: string | null;
  numero_arma: string | null;
  nome_craf: string | null;
}

interface CrafDocumento {
  id: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  orgao_emissor: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  arma_numero_serie: string | null;
  status: string | null;
  ia_status: string | null;
  validado_admin: boolean | null;
  arquivo_nome: string | null;
  origem: string | null;
  created_at: string;
}

const TONE_BG: Record<string, string> = {
  ok: "hsl(142 70% 45% / 0.12)",
  warn: "hsl(38 92% 50% / 0.18)",
  danger: "hsl(0 78% 55% / 0.15)",
  muted: "hsl(220 13% 92%)",
};
const TONE_FG: Record<string, string> = {
  ok: "hsl(142 70% 32%)",
  warn: "hsl(28 92% 32%)",
  danger: "hsl(0 70% 42%)",
  muted: "hsl(220 10% 40%)",
};

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
};
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
};
const statusVisual = (validade: string | null) => {
  const days = daysUntil(validade);
  if (days === null) return { tone: "muted" as const, label: "SEM VALIDADE" };
  if (days < 0) return { tone: "danger" as const, label: `VENCIDO HÁ ${Math.abs(days)}d` };
  if (days <= 30) return { tone: "warn" as const, label: `${days}d P/ VENCER` };
  return { tone: "ok" as const, label: "VÁLIDO" };
};

function Kpi({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: number; tone: "ok" | "warn" | "danger" | "muted";
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5" style={{ color: TONE_FG[tone] }} />
      <div>
        <div className="text-[14px] font-bold leading-none text-slate-800">{value}</div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function ArsenalCRAFControl({ clienteId, origem: _origem }: Props) {
  const [canonicos, setCanonicos] = useState<CrafCanonico[]>([]);
  const [documentos, setDocumentos] = useState<CrafDocumento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cans }, { data: docs }] = await Promise.all([
      supabase
        .from("qa_crafs" as any)
        .select("id,cliente_id,data_validade,nome_arma,numero_sigma,numero_arma,nome_craf")
        .eq("cliente_id", clienteId),
      supabase
        .from("qa_documentos_cliente" as any)
        .select(
          "id,tipo_documento,numero_documento,orgao_emissor,data_emissao,data_validade,arma_marca,arma_modelo,arma_calibre,arma_numero_serie,status,ia_status,validado_admin,arquivo_nome,origem,created_at",
        )
        .eq("qa_cliente_id", clienteId)
        .ilike("tipo_documento", "%CRAF%")
        .order("created_at", { ascending: false }),
    ]);
    setCanonicos((cans as any[] as CrafCanonico[]) || []);
    setDocumentos((docs as any[] as CrafDocumento[]) || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  // Realtime — quando equipe valida documento ou IA processa, atualiza.
  useEffect(() => {
    const ch = supabase
      .channel(`qa_craf_${clienteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_crafs", filter: `cliente_id=eq.${clienteId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_documentos_cliente", filter: `qa_cliente_id=eq.${clienteId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clienteId, load]);

  const kpis = useMemo(() => {
    let validos = 0, vencidos = 0, proximos = 0, semValidade = 0;
    canonicos.forEach((c) => {
      const days = daysUntil(c.data_validade);
      if (days === null) { semValidade++; return; }
      if (days < 0) vencidos++;
      else if (days <= 30) proximos++;
      else validos++;
    });
    const armasVinculadas = canonicos.filter((c) => (c.numero_arma || c.numero_sigma)).length;
    const semVinculo = canonicos.length - armasVinculadas;
    const pendentesRevisao = documentos.filter(
      (d) => !d.validado_admin && (d.ia_status === "pendente" || d.ia_status === "processando" || d.status === "EM_ANALISE" || d.status === "PENDENTE"),
    ).length;
    return {
      total: canonicos.length,
      validos,
      proximos,
      vencidos,
      armasVinculadas,
      semVinculo: Math.max(0, semVinculo),
      pendentesRevisao,
    };
  }, [canonicos, documentos]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" style={{ color: "hsl(0 60% 35%)" }} />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Controle de CRAF
          </h3>
          <span className="text-[10px] text-slate-500">
            Certificados de Registro de Arma de Fogo vinculados ao cliente
          </span>
        </div>
      </header>

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi icon={FileText} label="Total" value={kpis.total} tone="muted" />
        <Kpi icon={CheckCircle2} label="Válidos" value={kpis.validos} tone="ok" />
        <Kpi icon={Clock} label="Próx. vencer" value={kpis.proximos} tone="warn" />
        <Kpi icon={AlertTriangle} label="Vencidos" value={kpis.vencidos} tone="danger" />
        <Kpi icon={Crosshair} label="Armas vinculadas" value={kpis.armasVinculadas} tone="muted" />
        <Kpi icon={Link2} label="Sem vínculo" value={kpis.semVinculo} tone="muted" />
        <Kpi icon={Loader2} label="Pendentes revisão" value={kpis.pendentesRevisao} tone={kpis.pendentesRevisao > 0 ? "warn" : "muted"} />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="py-6 text-center text-[11px] text-slate-500">Carregando CRAFs…</p>
      ) : canonicos.length === 0 && documentos.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-slate-500">
          Nenhum CRAF vinculado a este cliente.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {canonicos.map((c) => {
            const sv = statusVisual(c.data_validade);
            return (
              <li key={`craf-${c.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-wide text-slate-800">
                      {c.nome_craf || (c.numero_sigma ? `SIGMA ${c.numero_sigma}` : "CRAF SEM IDENTIFICAÇÃO")}
                    </span>
                    <span
                      className="rounded-full px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: TONE_BG[sv.tone], color: TONE_FG[sv.tone] }}
                    >
                      {sv.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                    <span>Validade: <b className="text-slate-700">{fmtDate(c.data_validade)}</b></span>
                    {c.nome_arma && <span>Arma: <b className="text-slate-700">{c.nome_arma}</b></span>}
                    {c.numero_arma && <span>Nº arma: <b className="text-slate-700">{c.numero_arma}</b></span>}
                    {c.numero_sigma && <span>SIGMA: <b className="text-slate-700">{c.numero_sigma}</b></span>}
                  </div>
                </div>
              </li>
            );
          })}
          {documentos
            .filter((d) => !canonicos.some((c) =>
              (d.arma_numero_serie && c.numero_arma && d.arma_numero_serie === c.numero_arma) ||
              (d.numero_documento && c.numero_sigma && d.numero_documento === c.numero_sigma),
            ))
            .map((d) => {
              const sv = statusVisual(d.data_validade);
              const pendente = !d.validado_admin;
              return (
                <li key={`doc-${d.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold uppercase tracking-wide text-slate-800">
                        {d.numero_documento ? `CRAF Nº ${d.numero_documento}` : (d.arquivo_nome || "CRAF EM ANÁLISE")}
                      </span>
                      <span
                        className="rounded-full px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: TONE_BG[sv.tone], color: TONE_FG[sv.tone] }}
                      >
                        {sv.label}
                      </span>
                      {pendente && (
                        <span className="rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase text-amber-800"
                              style={{ background: "hsl(38 92% 50% / 0.18)" }}>
                          PENDENTE REVISÃO
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                      <span>Validade: <b className="text-slate-700">{fmtDate(d.data_validade)}</b></span>
                      {d.orgao_emissor && <span>Órgão: <b className="text-slate-700">{d.orgao_emissor}</b></span>}
                      {d.arma_modelo && <span>Modelo: <b className="text-slate-700">{d.arma_modelo}</b></span>}
                      {d.arma_calibre && <span>Calibre: <b className="text-slate-700">{d.arma_calibre}</b></span>}
                      {d.arma_numero_serie && <span>Nº série: <b className="text-slate-700">{d.arma_numero_serie}</b></span>}
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <p className="mt-3 text-[10px] italic text-slate-400">
        Cadastro manual e edição completa serão liberados na próxima etapa.
      </p>
    </section>
  );
}