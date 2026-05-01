/**
 * ArsenalGTEControl
 *
 * Bloco de Controle de GTE (Guia de Tráfego Especial) dentro do Arsenal.
 * Cliente OU equipe podem enviar a GTE em PDF/imagem; a IA extrai
 * armas, endereços, clubes e datas; o bloco exibe KPIs + lista + detalhe.
 *
 * Regras (Diretriz Global Quero Armas):
 *  - Não duplica dados (não escreve em qa_gtes); fonte = qa_gte_documentos.
 *  - Cliente vê só o que é seu (RLS); equipe vê tudo (RLS).
 *  - Frontend só exibe; cálculo de KPI é leitura simples sobre data_validade.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Crosshair, Download,
  FileText, Loader2, MapPin, ShieldCheck, Upload, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  clienteId: number;
  /** Quem está visualizando: "cliente" ou "equipe". Define apenas o badge de origem ao enviar. */
  origem: "cliente" | "equipe";
}

interface GteDoc {
  id: string;
  cliente_id: number;
  storage_path: string;
  nome_original: string | null;
  origem_envio: "cliente" | "equipe";
  numero_gte: string | null;
  orgao_emissor: string | null;
  requerente_nome: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  endereco_origem: string | null;
  endereco_destino: string | null;
  armas_total: number;
  enderecos_total: number;
  armas_json: any[];
  enderecos_json: any[];
  clubes_json: any[];
  dados_extraidos_json: any;
  observacoes_ia: string | null;
  status_processamento: "pendente" | "processando" | "concluido" | "erro";
  erro_mensagem: string | null;
  created_at: string;
}

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

const statusVisual = (validade: string | null, status: GteDoc["status_processamento"]) => {
  if (status === "erro") return { tone: "danger" as const, label: "ERRO NA LEITURA" };
  if (status === "pendente" || status === "processando")
    return { tone: "muted" as const, label: status === "processando" ? "PROCESSANDO" : "PENDENTE" };
  const days = daysUntil(validade);
  if (days === null) return { tone: "muted" as const, label: "SEM VALIDADE" };
  if (days < 0) return { tone: "danger" as const, label: `VENCIDA HÁ ${Math.abs(days)}d` };
  if (days <= 30) return { tone: "warn" as const, label: `${days}d P/ VENCER` };
  return { tone: "ok" as const, label: "VÁLIDA" };
};

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

export default function ArsenalGTEControl({ clienteId, origem }: Props) {
  const [docs, setDocs] = useState<GteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openDetail, setOpenDetail] = useState<GteDoc | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_gte_documentos" as any)
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as any[] as GteDoc[]) || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  // Realtime — quando a IA terminar de processar, lista atualiza sozinha.
  useEffect(() => {
    const channel = supabase
      .channel(`qa_gte_doc_${clienteId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_gte_documentos", filter: `cliente_id=eq.${clienteId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clienteId, load]);

  const onPickFile = () => fileRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (limite 20 MB).");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `gtes/${clienteId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("qa-documentos").upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("qa_gte_documentos" as any)
        .insert({
          cliente_id: clienteId,
          storage_path: path,
          nome_original: file.name,
          mime_type: file.type || "application/pdf",
          tamanho_bytes: file.size,
          origem_envio: origem,
          status_processamento: "pendente",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      toast.success("GTE enviada. Extraindo dados…");
      // Dispara extração em background (não bloqueia a UI; realtime atualiza)
      supabase.functions
        .invoke("qa-gte-extrair", { body: { gte_documento_id: (inserted as any).id } })
        .then(({ error }) => { if (error) toast.error(`Falha na leitura: ${error.message}`); })
        .catch((err) => toast.error(err?.message || "Falha na leitura"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (d: GteDoc) => {
    const { data, error } = await supabase.storage.from("qa-documentos").download(d.storage_path);
    if (error || !data) { toast.error(error?.message || "Falha ao baixar"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.nome_original || `gte-${d.id}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onReprocessar = async (d: GteDoc) => {
    const { error } = await supabase.functions.invoke("qa-gte-extrair", { body: { gte_documento_id: d.id } });
    if (error) toast.error(error.message); else toast.success("Reprocessamento iniciado.");
  };

  const kpis = useMemo(() => {
    const concluidas = docs.filter(d => d.status_processamento === "concluido");
    let validas = 0, vencidas = 0, proximas = 0;
    let totalArmas = 0, totalEnderecos = 0;
    const clubesSet = new Set<string>();
    concluidas.forEach((d) => {
      const days = daysUntil(d.data_validade);
      if (days === null) return;
      if (days < 0) vencidas++;
      else if (days <= 30) proximas++;
      else validas++;
      totalArmas += d.armas_total || 0;
      totalEnderecos += d.enderecos_total || 0;
      (d.clubes_json || []).forEach((c: any) => {
        const key = (c?.nome || c?.cnpj || "").toString().trim().toUpperCase();
        if (key) clubesSet.add(key);
      });
    });
    return {
      total: docs.length,
      validas, vencidas, proximas,
      totalArmas, totalEnderecos,
      clubes: clubesSet.size,
    };
  }, [docs]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" style={{ color: "hsl(38 92% 50%)" }} />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Controle de GTE
          </h3>
          <span className="text-[10px] text-slate-500">Guia de Tráfego Especial</span>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={onFileSelected} />
          <button
            type="button"
            onClick={onPickFile}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Enviar GTE
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Kpi icon={FileText} label="Total" value={kpis.total} tone="muted" />
        <Kpi icon={CheckCircle2} label="Válidas" value={kpis.validas} tone="ok" />
        <Kpi icon={Clock} label="Próx. vencer" value={kpis.proximas} tone="warn" />
        <Kpi icon={AlertTriangle} label="Vencidas" value={kpis.vencidas} tone="danger" />
        <Kpi icon={Crosshair} label="Armas" value={kpis.totalArmas} tone="muted" />
        <Kpi icon={MapPin} label="Endereços" value={kpis.totalEnderecos} tone="muted" />
        <Kpi icon={ShieldCheck} label="Clubes" value={kpis.clubes} tone="muted" />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="py-6 text-center text-[11px] text-slate-500">Carregando GTEs…</p>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-slate-500">
          Nenhuma GTE enviada. Use “Enviar GTE” para anexar o PDF — a IA extrai armas, endereços e prazos automaticamente.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {docs.map((d) => {
            const sv = statusVisual(d.data_validade, d.status_processamento);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px]">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-wide text-slate-800">
                      {d.numero_gte ? `GTE Nº ${d.numero_gte}` : (d.nome_original || "GTE sem identificação")}
                    </span>
                    <span
                      className="rounded-full px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: TONE_BG[sv.tone], color: TONE_FG[sv.tone] }}
                    >
                      {sv.label}
                    </span>
                    <span className="rounded px-1.5 py-[1px] text-[9px] font-semibold uppercase text-slate-500"
                          style={{ background: "hsl(220 13% 95%)" }}>
                      {d.origem_envio === "cliente" ? "ENVIO CLIENTE" : "ENVIO EQUIPE"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                    <span>Validade: <b className="text-slate-700">{fmtDate(d.data_validade)}</b></span>
                    <span>Armas: <b className="text-slate-700">{d.armas_total}</b></span>
                    <span>Endereços: <b className="text-slate-700">{d.enderecos_total}</b></span>
                    {d.requerente_nome && <span>Titular: <b className="text-slate-700">{d.requerente_nome}</b></span>}
                  </div>
                  {d.status_processamento === "erro" && d.erro_mensagem && (
                    <p className="mt-1 text-[10px] text-red-600">⚠ {d.erro_mensagem}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpenDetail(d)}
                    className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                  >
                    Detalhes
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownload(d)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" /> Baixar
                  </button>
                  {d.status_processamento === "erro" && (
                    <button
                      type="button"
                      onClick={() => onReprocessar(d)}
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100"
                    >
                      Reprocessar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {openDetail && <DetailDrawer doc={openDetail} onClose={() => setOpenDetail(null)} />}
    </section>
  );
}

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

function DetailDrawer({ doc, onClose }: { doc: GteDoc; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Guia de Tráfego Especial
            </div>
            <div className="text-[14px] font-bold text-slate-800">
              {doc.numero_gte ? `GTE Nº ${doc.numero_gte}` : (doc.nome_original || "GTE")}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5 text-[12px]">
          <Section title="Identificação">
            <Field label="Número GTE" value={doc.numero_gte} />
            <Field label="Órgão emissor" value={doc.orgao_emissor} />
            <Field label="Requerente" value={doc.requerente_nome} />
            <Field label="Emissão" value={fmtDate(doc.data_emissao)} />
            <Field label="Validade" value={fmtDate(doc.data_validade)} />
          </Section>

          <Section title="Trajeto">
            <Field label="Origem" value={doc.endereco_origem} full />
            <Field label="Destino" value={doc.endereco_destino} full />
          </Section>

          <Section title={`Armas autorizadas (${doc.armas_total})`}>
            {doc.armas_json?.length ? (
              <ul className="col-span-2 space-y-1.5">
                {doc.armas_json.map((a: any, i: number) => (
                  <li key={i} className="rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                    <div className="font-bold text-slate-800">
                      {[a.marca, a.modelo].filter(Boolean).join(" ") || "Arma sem identificação"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {a.especie ? `${a.especie} · ` : ""}{a.calibre ? `CAL ${a.calibre}` : ""}
                      {a.numero_serie ? ` · Série ${a.numero_serie}` : ""}
                      {a.numero_sigma ? ` · SIGMA ${a.numero_sigma}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </Section>

          <Section title={`Endereços (${doc.enderecos_total})`}>
            {doc.enderecos_json?.length ? (
              <ul className="col-span-2 space-y-1">
                {doc.enderecos_json.map((e: any, i: number) => (
                  <li key={i} className="text-slate-700">
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                      {e.tipo || "endereço"}
                    </span>
                    {e.endereco}
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </Section>

          <Section title={`Clubes vinculados (${(doc.clubes_json || []).length})`}>
            {doc.clubes_json?.length ? (
              <ul className="col-span-2 space-y-1">
                {doc.clubes_json.map((c: any, i: number) => (
                  <li key={i} className="text-slate-700">
                    <b>{c.nome}</b>
                    {c.cnpj ? ` · CNPJ ${c.cnpj}` : ""}
                    {c.endereco ? ` · ${c.endereco}` : ""}
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </Section>

          {doc.observacoes_ia && (
            <Section title="Observações">
              <p className="col-span-2 text-slate-700">{doc.observacoes_ia}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function Field({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[12px] text-slate-800">{value || "—"}</div>
    </div>
  );
}
function Empty() { return <p className="col-span-2 text-[11px] text-slate-500">Nada extraído.</p>; }