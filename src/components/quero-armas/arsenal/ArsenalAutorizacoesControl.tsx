/**
 * ArsenalAutorizacoesControl
 *
 * Bloco "Controle de Autorizações" da aba Arsenal — F1B-3.
 *
 * Fontes:
 *   - qa_solicitacoes_servico: solicitações em andamento (slug autorizacao+compra).
 *   - qa_documentos_cliente:   autorizações emitidas (tipo_documento ~ AUTORIZ).
 *
 * Funcionalidades:
 *   - Upload + OCR via edge `qa-autorizacao-extrair`.
 *   - Cadastro manual.
 *   - Edição completa.
 *   - Vínculo opcional com arma (não sobrescreve sem confirmação).
 *   - Baixa/utilização e cancelamento com histórico/auditoria.
 *   - Status visual: válida, próx. vencer, vencida, pendente revisão,
 *     utilizada/baixada, cancelada.
 *   - Validade alimenta Alertas/Próximos Vencimentos via data_validade.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, ClipboardList, Clock, Crosshair, Download,
  FileText, Loader2, PackageCheck, Pencil, Plus, RefreshCw, ShoppingCart, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ArsenalAutorizacaoEditModal from "./ArsenalAutorizacaoEditModal";
import ArsenalAutorizacaoBaixaModal from "./ArsenalAutorizacaoBaixaModal";

interface Props {
  clienteId: number;
  origem: "cliente" | "equipe";
}

interface Solicitacao {
  id: string;
  service_slug: string | null;
  service_name: string | null;
  status_servico: string | null;
  status_financeiro: string | null;
  status_processo: string | null;
  observacoes: string | null;
  created_at: string;
}

interface AutorizacaoDoc {
  id: string;
  qa_cliente_id: number;
  tipo_documento: string | null;
  numero_documento: string | null;
  orgao_emissor: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  arma_numero_serie: string | null;
  arma_especie: string | null;
  status: string | null;
  ia_status: string | null;
  validado_admin: boolean | null;
  arquivo_nome: string | null;
  arquivo_storage_path: string | null;
  ia_dados_extraidos: any;
  observacoes: string | null;
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
const statusVisual = (validade: string | null, statusDoc?: string | null) => {
  const st = (statusDoc || "").toUpperCase();
  if (st === "UTILIZADA" || st === "BAIXADA") return { tone: "muted" as const, label: "UTILIZADA" };
  if (st === "CANCELADA") return { tone: "danger" as const, label: "CANCELADA" };
  const days = daysUntil(validade);
  if (days === null) return { tone: "muted" as const, label: "SEM VALIDADE" };
  if (days < 0) return { tone: "danger" as const, label: `VENCIDA HÁ ${Math.abs(days)}d` };
  if (days <= 30) return { tone: "warn" as const, label: `${days}d P/ VENCER` };
  return { tone: "ok" as const, label: "VÁLIDA" };
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

const isSlugAutorizacaoCompra = (slug?: string | null) => {
  const s = String(slug ?? "").toLowerCase();
  return s.includes("autorizacao") && s.includes("compra");
};

export default function ArsenalAutorizacoesControl({ clienteId, origem: _origem }: Props) {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [documentos, setDocumentos] = useState<AutorizacaoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<AutorizacaoDoc | null>(null);
  const [baixa, setBaixa] = useState<{ doc: AutorizacaoDoc; modo: "utilizar" | "cancelar" } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sols }, { data: docs }] = await Promise.all([
      supabase
        .from("qa_solicitacoes_servico" as any)
        .select("id,service_slug,service_name,status_servico,status_financeiro,status_processo,observacoes,created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("qa_documentos_cliente" as any)
        .select(
          "id,qa_cliente_id,tipo_documento,numero_documento,orgao_emissor,data_emissao,data_validade,arma_marca,arma_modelo,arma_calibre,arma_numero_serie,arma_especie,status,ia_status,validado_admin,arquivo_nome,arquivo_storage_path,ia_dados_extraidos,observacoes,origem,created_at",
        )
        .eq("qa_cliente_id", clienteId)
        .ilike("tipo_documento", "%AUTORIZ%")
        .order("created_at", { ascending: false }),
    ]);
    setSolicitacoes(((sols as any[]) || []).filter((s: any) => isSlugAutorizacaoCompra(s.service_slug)));
    setDocumentos((docs as any[] as AutorizacaoDoc[]) || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`qa_autorizacoes_${clienteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_solicitacoes_servico", filter: `cliente_id=eq.${clienteId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_documentos_cliente", filter: `qa_cliente_id=eq.${clienteId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clienteId, load]);

  const onPickFile = () => fileRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (limite 20 MB)."); return; }
    setUploading(true);
    try {
      const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `autorizacoes/${clienteId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await supabase
        .from("qa_documentos_cliente" as any)
        .insert({
          qa_cliente_id: clienteId,
          tipo_documento: "AUTORIZACAO_COMPRA",
          arquivo_storage_path: path,
          arquivo_nome: file.name,
          arquivo_mime: file.type || "application/pdf",
          ia_status: "pendente",
          status: "EM_ANALISE",
          origem: _origem === "equipe" ? "equipe" : "portal_cliente",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      toast.success("Autorização enviada. Extraindo dados…");
      supabase.functions
        .invoke("qa-autorizacao-extrair", { body: { documento_id: (inserted as any).id } })
        .then(({ error }) => { if (error) toast.error(`Falha na leitura: ${error.message}`); })
        .catch((err) => toast.error(err?.message || "Falha na leitura"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const onReprocessar = async (d: AutorizacaoDoc) => {
    if (!d.arquivo_storage_path) { toast.error("Documento sem arquivo no storage."); return; }
    const { error } = await supabase.functions.invoke("qa-autorizacao-extrair", { body: { documento_id: d.id } });
    if (error) toast.error(error.message); else toast.success("Reprocessamento iniciado.");
  };

  const onDownload = async (d: AutorizacaoDoc) => {
    if (!d.arquivo_storage_path) return;
    const { data, error } = await supabase.storage.from("qa-documentos").download(d.arquivo_storage_path);
    if (error || !data) { toast.error(error?.message || "Falha ao baixar"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.arquivo_nome || `autorizacao-${d.id}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onCadastroManual = async () => {
    const { data: inserted, error } = await supabase
      .from("qa_documentos_cliente" as any)
      .insert({
        qa_cliente_id: clienteId,
        tipo_documento: "AUTORIZACAO_COMPRA",
        ia_status: "pendente_revisao",
        status: "EM_ANALISE",
        origem: _origem === "equipe" ? "equipe" : "portal_cliente",
      })
      .select("id,qa_cliente_id,tipo_documento,numero_documento,orgao_emissor,data_emissao,data_validade,arma_marca,arma_modelo,arma_calibre,arma_numero_serie,arma_especie,status,ia_status,validado_admin,arquivo_nome,arquivo_storage_path,ia_dados_extraidos,observacoes,origem,created_at")
      .single();
    if (error) { toast.error(error.message); return; }
    setEditing(inserted as any as AutorizacaoDoc);
  };

  const kpis = useMemo(() => {
    let validas = 0, vencidas = 0, proximas = 0, utilizadas = 0;
    documentos.forEach((d) => {
      const st = (d.status || "").toUpperCase();
      if (st === "UTILIZADA" || st === "BAIXADA") { utilizadas++; return; }
      const days = daysUntil(d.data_validade);
      if (days === null) return;
      if (days < 0) vencidas++;
      else if (days <= 30) proximas++;
      else validas++;
    });
    const armasVinculadas = documentos.filter((d) => d.arma_numero_serie || d.arma_modelo).length;
    const pendentes = solicitacoes.filter((s) => {
      const ss = (s.status_servico || "").toLowerCase();
      return ss === "" || ss.includes("analise") || ss.includes("aguard") || ss.includes("pend");
    }).length;
    return {
      total: documentos.length + solicitacoes.length,
      validas,
      proximas,
      vencidas,
      pendentes,
      utilizadas,
      armasVinculadas,
    };
  }, [documentos, solicitacoes]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" style={{ color: "hsl(0 60% 35%)" }} />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Controle de Autorizações
          </h3>
          <span className="text-[10px] text-slate-500">
            Autorizações de compra vinculadas ao cliente
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" accept="application/pdf,image/*" onChange={onFileSelected} />
          <button
            onClick={onCadastroManual}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3 w-3" /> Cadastrar manual
          </button>
          <button
            onClick={onPickFile}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: "#7A1F2B" }}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Enviar autorização
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi icon={FileText} label="Total" value={kpis.total} tone="muted" />
        <Kpi icon={CheckCircle2} label="Válidas" value={kpis.validas} tone="ok" />
        <Kpi icon={Clock} label="Próx. vencer" value={kpis.proximas} tone="warn" />
        <Kpi icon={AlertTriangle} label="Vencidas" value={kpis.vencidas} tone="danger" />
        <Kpi icon={Loader2} label="Pendentes" value={kpis.pendentes} tone={kpis.pendentes > 0 ? "warn" : "muted"} />
        <Kpi icon={ClipboardList} label="Utilizadas" value={kpis.utilizadas} tone="muted" />
        <Kpi icon={Crosshair} label="Armas vinculadas" value={kpis.armasVinculadas} tone="muted" />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="py-6 text-center text-[11px] text-slate-500">Carregando autorizações…</p>
      ) : documentos.length === 0 && solicitacoes.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-slate-500">
          Nenhuma autorização vinculada a este cliente.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {documentos.map((d) => {
            const sv = statusVisual(d.data_validade, d.status);
            const validadoPelaEquipe = !!d.validado_admin;
            const ia = (d.ia_status || "").toLowerCase();
            const processando = ia === "processando";
            const erroIA = ia === "erro";
            const revisaoNecessaria = !!(d.ia_dados_extraidos as any)?.revisao_necessaria;
            const pendente = !validadoPelaEquipe || ia === "pendente_revisao" || revisaoNecessaria;
            const baixada = (d.status || "").toUpperCase() === "UTILIZADA"
              || (d.status || "").toUpperCase() === "BAIXADA";
            const cancelada = (d.status || "").toUpperCase() === "CANCELADA";
            const finalizada = baixada || cancelada;
            return (
              <li key={`doc-${d.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-wide text-slate-800">
                      {d.numero_documento ? `AUT. Nº ${d.numero_documento}` : (d.arquivo_nome || "AUTORIZAÇÃO EM ANÁLISE")}
                    </span>
                    <span
                      className="rounded-full px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: TONE_BG[sv.tone], color: TONE_FG[sv.tone] }}
                    >
                      {sv.label}
                    </span>
                    {processando && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase text-slate-700"
                            style={{ background: "hsl(220 13% 92%)" }}>
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> PROCESSANDO IA
                      </span>
                    )}
                    {erroIA && (
                      <span className="rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase text-red-700"
                            style={{ background: "hsl(0 78% 55% / 0.15)" }}>
                        ERRO DE LEITURA
                      </span>
                    )}
                    {pendente && !processando && !erroIA && !finalizada && (
                      <span className="rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase text-amber-800"
                            style={{ background: "hsl(38 92% 50% / 0.18)" }}>
                        {revisaoNecessaria ? "REVISÃO NECESSÁRIA" : "PENDENTE REVISÃO"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                    <span>Validade: <b className="text-slate-700">{fmtDate(d.data_validade)}</b></span>
                    {d.orgao_emissor && <span>Órgão: <b className="text-slate-700">{d.orgao_emissor}</b></span>}
                    {d.arma_especie && <span>Espécie: <b className="text-slate-700">{d.arma_especie}</b></span>}
                    {d.arma_modelo && <span>Modelo: <b className="text-slate-700">{d.arma_modelo}</b></span>}
                    {d.arma_calibre && <span>Calibre: <b className="text-slate-700">{d.arma_calibre}</b></span>}
                    {d.arma_numero_serie && <span>Nº série: <b className="text-slate-700">{d.arma_numero_serie}</b></span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(d)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {d.arquivo_storage_path && (
                    <button
                      onClick={() => onReprocessar(d)}
                      disabled={processando}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      title="Reprocessar IA"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {d.arquivo_storage_path && (
                    <button
                      onClick={() => onDownload(d)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100"
                      title="Baixar arquivo"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!finalizada && (
                    <>
                      <button
                        onClick={() => setBaixa({ doc: d, modo: "utilizar" })}
                        className="rounded p-1 text-emerald-700 hover:bg-emerald-50"
                        title="Dar baixa / Utilizar"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setBaixa({ doc: d, modo: "cancelar" })}
                        className="rounded p-1 text-red-700 hover:bg-red-50"
                        title="Cancelar"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {solicitacoes.map((s) => (
            <li key={`sol-${s.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]">
              <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-wide text-slate-800">
                    {s.service_name || "AUTORIZAÇÃO DE COMPRA"}
                  </span>
                  <span className="rounded-full px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: TONE_BG.muted, color: TONE_FG.muted }}>
                    {(s.status_servico || "EM ANDAMENTO").toUpperCase()}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                  <span>Solicitado: <b className="text-slate-700">{fmtDate(s.created_at)}</b></span>
                  {s.status_financeiro && <span>Financeiro: <b className="text-slate-700">{s.status_financeiro}</b></span>}
                  {s.status_processo && <span>Processo: <b className="text-slate-700">{s.status_processo}</b></span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ArsenalAutorizacaoEditModal
          doc={editing as any}
          clienteId={clienteId}
          onClose={() => setEditing(null)}
          onSaved={() => { load(); }}
        />
      )}
      {baixa && (
        <ArsenalAutorizacaoBaixaModal
          doc={baixa.doc as any}
          modo={baixa.modo}
          onClose={() => setBaixa(null)}
          onSaved={() => { load(); }}
        />
      )}
    </section>
  );
}