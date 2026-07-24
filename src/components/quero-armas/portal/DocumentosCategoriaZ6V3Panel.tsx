import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Eye, Download, RefreshCw, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHubCategoriaMeta, getNomeDocumentoDisplay, getTipoDocumentoMeta } from "@/lib/quero-armas/documentosHubCatalogo";
import { getValidadeInfo } from "@/lib/quero-armas/validadeDocumento";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/* ============================================================
   DOCUMENTOS · CATEGORIA Z6 V3 (canônico papel + bordô)
   Header cliente-cêntrico + KPIs + lista agrupada por categoria
   com ações discretas: VISUALIZAR · BAIXAR · RENOVAR
   Todo evento é gravado em qa_documentos_cliente_eventos.
   ============================================================ */

const DOC_BUCKET = "qa-documentos";

function parseDateUTC(d: string | null | undefined): Date | null {
  if (!d) return null;
  const iso = String(d).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const br = String(d).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const dt = new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

function toISODateString(value: string): string | null {
  const date = parseDateUTC(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function pickDocDate(doc: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = key.includes(".") ? getNestedValue(doc, key) : doc?.[key];
    if (typeof value === "string") {
      const iso = toISODateString(value);
      if (iso) return iso;
    }
  }
  return null;
}

function dataEmissaoHub(doc: any): string | null {
  return pickDocDate(doc, [
    "data_emissao",
    "data_expedicao",
    "data_expedicao_rg",
    "ia_dados_extraidos.camposExtraidos.data_emissao",
    "ia_dados_extraidos.camposExtraidos.data_expedicao",
    "ia_dados_extraidos.camposExtraidos.data_expedicao_rg",
    "ia_dados_extraidos.campos_extraidos.data_emissao",
    "ia_dados_extraidos.campos_extraidos.data_expedicao",
    "ia_dados_extraidos.campos_extraidos.data_expedicao_rg",
    "ia_dados_extraidos.campos.data_emissao",
    "ia_dados_extraidos.campos.data_expedicao",
    "ia_dados_extraidos.campos.data_expedicao_rg",
  ]);
}

function dataValidadeHub(doc: any): string | null {
  return getValidadeInfo({
    tipo_documento: doc?.tipo_documento,
    data_emissao: dataEmissaoHub(doc),
    data_validade_efetiva: doc?.data_validade_efetiva,
    data_validade: doc?.data_validade,
    ano_competencia: doc?.ano_competencia,
    regra_validacao: doc?.regra_validacao,
  }).iso;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const p = parseDateUTC(d);
  if (!p) return d;
  return `${String(p.getUTCDate()).padStart(2, "0")}/${String(p.getUTCMonth() + 1).padStart(2, "0")}/${p.getUTCFullYear()}`;
};

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  const p = parseDateUTC(d);
  if (!p) return null;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((p.getTime() - todayUTC) / 86400000);
};

const formatCPF = (cpf: string | null | undefined) => {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatMemberSince = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return "—";
    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${meses[p.getMonth()]}/${p.getFullYear()}`;
  } catch {
    return "—";
  }
};

function dotColor(d: number | null, status?: string | null): string {
  const s = String(status || "").toLowerCase();
  // Documentos aprovados sem data de validade (contrato, procuração, etc.)
  // devem exibir verde — indicam exigência cumprida e não têm ciclo de expiração.
  if (d === null) {
    if (s === "aprovado") return "#2F8F4A";
    if (s === "reprovado") return "#D9342B";
    return "#8A8A8A";
  }
  if (d < 0) return "#D9342B";
  if (d <= 7) return "#D9342B";
  if (d <= 30) return "#D6A64B";
  return "#2F8F4A";
}

function remainingLabel(d: number | null): string {
  if (d === null) return "SEM DATA";
  if (d < 0) {
    const n = Math.abs(d);
    return `VENCIDO HÁ ${n} ${n === 1 ? "DIA" : "DIAS"}`;
  }
  if (d === 0) return "VENCE HOJE";
  return `${d} ${d === 1 ? "DIA RESTANTE" : "DIAS RESTANTES"}`;
}

async function logEvento(
  documentoId: string,
  customerId: string | null | undefined,
  qaClienteId: number | null | undefined,
  acao: "upload" | "visualizado" | "baixado" | "renovado" | "removido" | "aprovado" | "reprovado" | "substituido" | "editado" | "expirou",
  detalhes?: Record<string, any>,
) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    await supabase.from("qa_documentos_cliente_eventos" as any).insert({
      documento_id: documentoId,
      customer_id: customerId ?? null,
      qa_cliente_id: qaClienteId ?? null,
      acao,
      ator_tipo: "cliente",
      ator_user_id: user?.id ?? null,
      ator_email: user?.email ?? null,
      detalhes: detalhes ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    // não bloqueia ação do usuário caso log falhe
    console.warn("[docs-z6] falha ao registrar evento", e);
  }
}

async function abrirArquivo(doc: any, modo: "visualizado" | "baixado") {
  if (!doc?.arquivo_storage_path) {
    toast.error("Documento sem arquivo anexado.");
    return;
  }
  try {
    const bucket = doc?.metadados_documento_json?.bucket || DOC_BUCKET;
    let signedUrl: string | null = null;
    if (bucket !== DOC_BUCKET) {
      const { data: fn, error: fnErr } = await supabase.functions.invoke("qa-hub-doc-signed-url", {
        body: { documento_id: doc.id, download: modo === "baixado" },
      });
      if (fnErr || !(fn as any)?.signed_url) {
        toast.error("Não foi possível abrir o arquivo.");
        return;
      }
      signedUrl = (fn as any).signed_url;
    } else {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(doc.arquivo_storage_path, 3600, modo === "baixado" ? { download: doc.arquivo_nome || true } : undefined);
      if (error || !data?.signedUrl) {
        toast.error("Não foi possível abrir o arquivo.");
        return;
      }
      signedUrl = data.signedUrl;
    }
    if (modo === "baixado") {
      const a = document.createElement("a");
      a.href = signedUrl!;
      a.download = doc.arquivo_nome || "documento";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(signedUrl!, "_blank", "noopener,noreferrer");
    }
    await logEvento(doc.id, doc.customer_id, doc.qa_cliente_id, modo, { path: doc.arquivo_storage_path });
  } catch (e) {
    toast.error("Erro ao acessar arquivo.");
  }
}

interface Props {
  cliente: any;
  meusDocs: any[];
  customerId?: string | null;
  onReload: () => void;
  onOpenAdd: (tipoDocumento?: string, substituirDocumentoId?: string) => void;
}

export default function DocumentosCategoriaZ6V3Panel({ cliente, meusDocs, customerId, onReload, onOpenAdd }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<null | "total" | "aprov" | "venc7" | "venc30" | "vencidos" | "hoje">(null);
  const [preview, setPreview] = useState<null | { url: string; nome: string; mime: string; blob: Blob }>(null);

  const openPreview = async (doc: any) => {
    if (!doc?.arquivo_storage_path) {
      toast.error("Documento sem arquivo anexado.");
      return;
    }
    try {
      const nome = String(doc.arquivo_nome || doc.tipo_documento || "documento");
      const ext = nome.toLowerCase().split(".").pop() || "";
      const mime = ext === "pdf"
        ? "application/pdf"
        : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
          ? `image/${ext === "jpg" ? "jpeg" : ext}`
          : "application/octet-stream";
      // Baixa o binário e serve via blob local — sem expor URL do Supabase
      // e sem depender do visualizador nativo do navegador (bloqueado no Edge).
      const { data: blob, error } = await supabase.storage
        .from(DOC_BUCKET)
        .download(doc.arquivo_storage_path);
      let effectiveBlob: Blob | null = blob ?? null;
      const altBucket = doc?.metadados_documento_json?.bucket;
      if ((error || !blob) && altBucket && altBucket !== DOC_BUCKET) {
        const { data: fn, error: fnErr } = await supabase.functions.invoke("qa-hub-doc-signed-url", {
          body: { documento_id: doc.id, download: false },
        });
        if (fnErr || !(fn as any)?.signed_url) {
          toast.error("Não foi possível abrir o arquivo.");
          return;
        }
        const resp = await fetch((fn as any).signed_url);
        if (!resp.ok) {
          toast.error("Não foi possível abrir o arquivo.");
          return;
        }
        effectiveBlob = await resp.blob();
      }
      if (!effectiveBlob) {
        toast.error("Não foi possível abrir o arquivo.");
        return;
      }
      const typed = effectiveBlob.type ? effectiveBlob : new Blob([effectiveBlob], { type: mime });
      const url = URL.createObjectURL(typed);
      setPreview({ url, nome, mime, blob: typed });
      await logEvento(doc.id, doc.customer_id, doc.qa_cliente_id, "visualizado", { path: doc.arquivo_storage_path });
    } catch (e) {
      toast.error("Erro ao acessar arquivo.");
    }
  };

  const nomePrimeiro = useMemo(() => {
    const nome = String(cliente?.nome_completo || cliente?.nome || "").trim();
    return (nome.split(/\s+/)[0] || "VOCÊ").toUpperCase();
  }, [cliente]);

  const cpfFmt = formatCPF(cliente?.cpf);
  const memberSince = formatMemberSince(cliente?.created_at || cliente?.data_cadastro);

  /* KPIs ---------------------------------------------------- */
  const kpis = useMemo(() => {
    const total = meusDocs.length;
    let aprov = 0, venc7 = 0, venc30 = 0, vencidos = 0, hoje = 0;
    const hojeISO = new Date().toISOString().slice(0, 10);
    meusDocs.forEach((d) => {
      if (d.status === "aprovado") aprov++;
      const dias = daysUntil(dataValidadeHub(d));
      if (dias !== null) {
        if (dias < 0) vencidos++;
        else if (dias <= 7) venc7++;
        else if (dias <= 30) venc30++;
      }
      if (String(d.updated_at || "").slice(0, 10) === hojeISO) hoje++;
    });
    return { total, aprov, venc7, venc30, vencidos, hoje };
  }, [meusDocs]);

  /* Filtragem por KPI -------------------------------------- */
  const docsFiltrados = useMemo(() => {
    if (!filter || filter === "total") return meusDocs;
    const hojeISO = new Date().toISOString().slice(0, 10);
    return meusDocs.filter((d) => {
      const dias = daysUntil(dataValidadeHub(d));
      if (filter === "aprov") return d.status === "aprovado";
      if (filter === "venc7") return dias !== null && dias >= 0 && dias <= 7;
      if (filter === "venc30") return dias !== null && dias > 7 && dias <= 30;
      if (filter === "vencidos") return dias !== null && dias < 0;
      if (filter === "hoje") return String(d.updated_at || "").slice(0, 10) === hojeISO;
      return true;
    });
  }, [meusDocs, filter]);

  /* Foco do dia — doc mais urgente -------------------------- */
  const focoDoc = useMemo(() => {
    return [...meusDocs]
      .filter((d) => dataValidadeHub(d))
      .sort((a, b) => (daysUntil(dataValidadeHub(a)) ?? 99999) - (daysUntil(dataValidadeHub(b)) ?? 99999))[0];
  }, [meusDocs]);

  /* Agrupamento por categoria ------------------------------- */
  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; docs: any[] }>();
    docsFiltrados.forEach((d) => {
      const tipoMeta = getTipoDocumentoMeta(d.tipo_documento);
      const catKey = tipoMeta?.categoria || d.categoria_hub || "outros";
      const catMeta = getHubCategoriaMeta(catKey);
      if (!map.has(catKey)) map.set(catKey, { label: catMeta.label, docs: [] });
      map.get(catKey)!.docs.push(d);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        label: v.label.toUpperCase(),
        docs: v.docs.sort((a, b) => (daysUntil(dataValidadeHub(a)) ?? 99999) - (daysUntil(dataValidadeHub(b)) ?? 99999)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docsFiltrados]);

  const handleRemover = async (doc: any) => {
    if (!confirm("Remover este documento?")) return;
    await logEvento(doc.id, doc.customer_id, doc.qa_cliente_id, "removido", { tipo: doc.tipo_documento });
    const { error } = await supabase.from("qa_documentos_cliente" as any).delete().eq("id", doc.id);
    if (error) {
      toast.error("Erro ao remover.");
      return;
    }
    toast.success("Documento removido.");
    onReload();
  };

  const handleRenovar = async (doc: any) => {
    await logEvento(doc.id, doc.customer_id, doc.qa_cliente_id, "renovado", { tipo: doc.tipo_documento, motivo: "iniciada renovação pelo cliente" });
    onOpenAdd(doc.tipo_documento);
  };

  /* ------------------------------------------------------- */
  return (
    <div
      className="qa-docsz6"
      style={{
        // Mesma trinca real da tela Resumo: Arial Narrow no corpo, Oswald nos títulos/números, Georgia serif no destaque
        fontFamily: "'Arial Narrow', Arial, sans-serif",
        letterSpacing: ".02em",
        textTransform: "uppercase",
        color: "#0A0A0A",
        padding: 0,
        borderRadius: 0,
      }}
    >
      <style>{`
        .qa-docsz6 .os{font-family:'Oswald','Arial Narrow',Arial,sans-serif}
        .qa-docsz6 .hdr h1{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:.04em;color:#0A0A0A;text-transform:uppercase;line-height:1.05;margin:0}
        .qa-docsz6 .hdr .meta{margin-top:11px;font-size:10px;color:#6A6A6A;display:flex;gap:18px;flex-wrap:wrap;font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.22em}
        .qa-docsz6 .hdr .meta span b{color:#0A0A0A;font-weight:600}
        .qa-docsz6 .focus{background:#fff;border:1px solid #E5E5E5;border-left:4px solid #D9342B;border-radius:3px;padding:16px 20px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:18px}
        .qa-docsz6 .focus .lbl{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.28em;color:#D9342B;text-transform:uppercase}
        .qa-docsz6 .focus .msg{font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.15;margin-top:6px;font-weight:700;color:#0c0c0c;text-transform:none;letter-spacing:-.01em}
        .qa-docsz6 .focus button{background:#7A1F2B;color:#fff;border:0;padding:11px 16px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;letter-spacing:.22em;font-size:11px;font-weight:900;cursor:pointer;border-radius:2px;text-transform:uppercase}
        .qa-docsz6 .focus button:hover{background:#5e1721}
        .qa-docsz6 .kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:18px}
        .qa-docsz6 .kpi{background:#fff;border:1px solid #E5E5E5;padding:12px 12px;border-radius:4px;cursor:pointer;transition:all .12s ease;text-align:left;font:inherit;color:inherit}
        .qa-docsz6 .kpi:hover{border-color:#7A1F2B}
        .qa-docsz6 .kpi.active{border-color:#7A1F2B;box-shadow:inset 0 0 0 1px #7A1F2B;background:#FFF8F8}
        .qa-docsz6 .kpi .l{font-family:'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.24em;color:#7A7A7A;display:flex;align-items:center;gap:6px;text-transform:uppercase}
        .qa-docsz6 .kpi .v{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:26px;font-weight:900;margin-top:9px;color:#0A0A0A;line-height:1;letter-spacing:0}
        .qa-docsz6 .kpi .s{font-family:'Arial Narrow',Arial,sans-serif;font-size:11px;color:#7A7A7A;margin-top:3px;text-transform:none;letter-spacing:0;font-weight:700}
        .qa-docsz6 .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
        .qa-docsz6 .listhead{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #E5E5E5;border-radius:4px 4px 0 0;padding:12px 16px;border-bottom:0;gap:12px}
        .qa-docsz6 .listhead .ttl{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.22em;color:#0A0A0A;font-weight:900;display:flex;align-items:center;gap:8px;text-transform:uppercase}
        .qa-docsz6 .listhead .ttl .cnt{background:#EDEDED;color:#444;font-size:9px;padding:1px 6px;border-radius:2px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.18em}
        .qa-docsz6 .listhead .add{display:inline-flex;align-items:center;gap:3px;background:transparent;border:1px solid #C8C8C8;color:#7A7A7A;padding:3px 7px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;letter-spacing:.18em;font-size:8.5px;font-weight:900;border-radius:2px;cursor:pointer;text-transform:uppercase}
        .qa-docsz6 .listhead .add:hover{border-color:#7A1F2B;color:#7A1F2B}
        
        .qa-docsz6 .grp{background:#fff;border:1px solid #E5E5E5;border-top:0}
        .qa-docsz6 .grp:last-child{border-radius:0 0 4px 4px}
        .qa-docsz6 .grp-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:3px solid #F2F2F2;background:#FAFAFA;cursor:pointer;user-select:none}
        .qa-docsz6 .grp-h .gt{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.22em;color:#0A0A0A;font-weight:900;display:flex;align-items:center;gap:8px;text-transform:uppercase}
        .qa-docsz6 .grp-h .gt .gc{background:#EDEDED;color:#444;font-size:9px;padding:1px 6px;border-radius:2px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.18em}
        .qa-docsz6 .grp-h .chev{color:#7A7A7A}
        .qa-docsz6 .row{display:grid;grid-template-columns:14px 1fr auto auto auto auto;gap:18px;align-items:center;padding:16px 18px;border-bottom:3px solid #F2F2F2}
        .qa-docsz6 .row:last-child{border-bottom:0}
        .qa-docsz6 .row .nm{font-family:'Arial Narrow',Arial,sans-serif;font-size:13px;font-weight:900;color:#0A0A0A;line-height:1.3;letter-spacing:-.01em;text-transform:none}
        .qa-docsz6 .row .mt{font-family:'Arial Narrow',Arial,sans-serif;font-size:11px;color:#7A7A7A;margin-top:2px;letter-spacing:0;text-transform:none}
        .qa-docsz6 .pill{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:9px;letter-spacing:.22em;font-weight:900;padding:3px 7px;border-radius:2px;text-transform:uppercase}
        .qa-docsz6 .pill-aprov{background:#E3F2E8;color:#1F6638}
        .qa-docsz6 .pill-pend{background:#FCEFCE;color:#7A5A14}
        .qa-docsz6 .pill-repr{background:#FCE3E1;color:#8A1410}
        .qa-docsz6 .dt{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:13px;letter-spacing:.08em;color:#0A0A0A;font-weight:900;text-align:right;min-width:78px}
        .qa-docsz6 .rem{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:11px;letter-spacing:.18em;font-weight:900;text-align:right;min-width:110px;text-transform:uppercase}
        .qa-docsz6 .acts{display:flex;align-items:center;gap:6px;justify-content:flex-end}
        .qa-docsz6 .act{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid transparent;background:transparent;color:#9A9A9A;border-radius:2px;cursor:pointer;transition:all .12s ease}
        .qa-docsz6 .act:hover{color:#7A1F2B;border-color:#E5E5E5;background:#fff}
        .qa-docsz6 .act:disabled{opacity:.35;cursor:not-allowed}
        .qa-docsz6 .act:disabled:hover{color:#9A9A9A;border-color:transparent;background:transparent}
        .qa-docsz6 .rm{color:#C8C8C8}
        .qa-docsz6 .rm:hover{color:#D9342B}
        .qa-docsz6 .empty{padding:30px;text-align:center;color:#9A9A9A;font-size:12px;background:#fff;border:1px solid #E5E5E5;border-radius:4px}
        @media (max-width: 900px){
          .qa-docsz6 .kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
          .qa-docsz6 .row{grid-template-columns:14px 1fr;gap:10px;row-gap:8px;padding:14px 16px;border-bottom:3px solid #F2F2F2}
          .qa-docsz6 .row .dt,.qa-docsz6 .row .rem,.qa-docsz6 .row .acts,.qa-docsz6 .row .pill{grid-column:2}
          .qa-docsz6 .row .dt,.qa-docsz6 .row .rem{text-align:left;min-width:0}
          .qa-docsz6 .row .acts{justify-content:flex-start;margin-top:4px}
          .qa-docsz6 .focus{flex-direction:column;align-items:flex-start}
        }
      `}</style>

      {/* HEADER cliente-cêntrico */}
      <div className="hdr" style={{ marginBottom: 20 }}>
        <h1>{nomePrimeiro}, ESSES SÃO SEUS DOCUMENTOS</h1>
        <div className="meta">
          <span>CPF · <b>{cpfFmt}</b></span>
          <span>MEMBRO DESDE · <b>{memberSince}</b></span>
          <span><b>{kpis.total}</b> DOCUMENTOS ATIVOS</span>
        </div>
      </div>

      {/* FOCO DO DIA */}
      {focoDoc && (() => {
        const dias = daysUntil(focoDoc.data_validade);
        if (dias === null || dias > 30) return null;
        const nome = getNomeDocumentoDisplay(focoDoc, "Documento");
        const msg = dias < 0
          ? `${nome} venceu há ${Math.abs(dias)} dias — atualize agora`
          : dias === 0
          ? `${nome} vence hoje — atualize agora`
          : `${nome} vence em ${dias} dias — atualize agora`;
        return (
          <div className="focus">
            <div>
              <div className="lbl">FOCO DO DIA · AÇÃO BLOQUEANTE</div>
              <div className="msg">{msg}</div>
            </div>
            <button type="button" onClick={() => handleRenovar(focoDoc)}>
              ATUALIZAR AGORA →
            </button>
          </div>
        );
      })()}

      {/* KPIs */}
      <div className="kpis">
        {([
          { k: "total",    dot: "#8A8A8A", l: "TOTAL",            v: kpis.total,    s: "documentos",     vc: "#8A8A8A" },
          { k: "aprov",    dot: "#2F8F4A", l: "APROVADOS",        v: kpis.aprov,    s: "validados",      vc: "#2F8F4A" },
          { k: "venc7",    dot: "#D6A64B", l: "A VENCER 7D",      v: kpis.venc7,    s: "ação imediata",  vc: "#D6A64B" },
          { k: "venc30",   dot: "#D6A64B", l: "A VENCER 30D",     v: kpis.venc30,   s: "atenção",        vc: "#D6A64B" },
          { k: "vencidos", dot: "#D9342B", l: "VENCIDOS",         v: kpis.vencidos, s: "regularizar",    vc: "#D9342B" },
          { k: "hoje",     dot: "#2F8F4A", l: "ATUALIZADOS HOJE", v: kpis.hoje,     s: "últimas 24h",    vc: "#2F8F4A" },
        ] as const).map((it) => (
          <button
            key={it.k}
            type="button"
            className={`kpi${filter === it.k ? " active" : ""}`}
            onClick={() => setFilter((f) => (f === it.k ? null : it.k))}
            aria-pressed={filter === it.k}
          >
            <div className="l"><span className="dot" style={{ background: it.dot }} />{it.l}</div>
            <div className="v" style={{ color: it.vc }}>{it.v}</div>
            <div className="s">{it.s}</div>
          </button>
        ))}
      </div>

      {filter && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FFF8F8",border:"1px solid #7A1F2B",borderRadius:4,padding:"8px 12px",marginBottom:14,fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif",fontSize:11,letterSpacing:".22em",color:"#7A1F2B",fontWeight:900,textTransform:"uppercase"}}>
          <span>FILTRO ATIVO · {docsFiltrados.length} DOCUMENTO{docsFiltrados.length === 1 ? "" : "S"}</span>
          <button type="button" onClick={() => setFilter(null)} style={{background:"transparent",border:0,color:"#7A1F2B",cursor:"pointer",fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif",letterSpacing:".22em",fontSize:10,fontWeight:900}}>LIMPAR ✕</button>
        </div>
      )}

      {/* LISTA AGRUPADA POR CATEGORIA */}
      <div className="listhead">
        <div className="ttl">DOCUMENTOS · AGRUPADO POR CATEGORIA <span className="cnt">{kpis.total}</span></div>
        <button className="add" type="button" onClick={() => onOpenAdd()}>
          <Plus className="h-3 w-3" /> ADICIONAR
        </button>
      </div>

      {grupos.length === 0 ? (
        <div className="empty">Nenhum documento cadastrado ainda.</div>
      ) : (
        grupos.map((g) => {
          // Padrão: categorias iniciam RECOLHIDAS (só expandem por clique do usuário)
          const isCollapsed = collapsed[g.key] ?? true;
          return (
            <div className="grp" key={g.key}>
              <div className="grp-h" onClick={() => setCollapsed((s) => ({ ...s, [g.key]: !(s[g.key] ?? true) }))}>
                <div className="gt">
                  {g.label}
                  <span className="gc">{g.docs.length}</span>
                </div>
                <span className="chev">{isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</span>
              </div>

              {!isCollapsed && g.docs.map((d) => {
                const nome = getNomeDocumentoDisplay(d, "Documento");
                const validade = dataValidadeHub(d);
                const dias = daysUntil(validade);
                const cor = dotColor(dias, d.status);
                const dataEmissao = dataEmissaoHub(d);
                const metaLine = [d.numero_documento, d.orgao_emissor, dataEmissao ? `emitido ${formatDate(dataEmissao)}` : null]
                  .filter(Boolean).join(" · ") || "emitido recente";
                const pillCls = d.status === "aprovado" ? "pill pill-aprov" : d.status === "reprovado" ? "pill pill-repr" : "pill pill-pend";
                const pillTxt = d.status === "aprovado" ? "APROVADO" : d.status === "reprovado" ? "REPROVADO" : "EM ANÁLISE";
                const temArquivo = Boolean(d.arquivo_storage_path);
                return (
                  <div className="row" key={d.id}>
                    <span className="dot" style={{ background: cor, width: 8, height: 8 }} />
                    <div>
                      <div className="nm">{nome}</div>
                      <div className="mt">{metaLine}</div>
                    </div>
                    <span className={pillCls}>{pillTxt}</span>
                    <span className="dt">{validade ? formatDate(validade) : "—"}</span>
                    <span className="rem" style={{ color: cor }}>{remainingLabel(dias)}</span>
                    <div className="acts">
                      <button
                        className="act"
                        type="button"
                        title="Visualizar"
                        disabled={!temArquivo}
                        onClick={() => openPreview(d)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="act"
                        type="button"
                        title="Baixar"
                        disabled={!temArquivo}
                        onClick={() => abrirArquivo(d, "baixado")}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="act"
                        type="button"
                        title="Renovar"
                        onClick={() => handleRenovar(d)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="act rm"
                        type="button"
                        title="Remover"
                        onClick={() => handleRemover(d)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {preview && (
        <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function PreviewModal({
  preview,
  onClose,
}: {
  preview: { url: string; nome: string; mime: string; blob: Blob };
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [numPages, setNumPages] = useState<number>(0);
  const isPdf = preview.mime === "application/pdf";
  const isImage = preview.mime.startsWith("image/");

  useEffect(() => {
    return () => URL.revokeObjectURL(preview.url);
  }, [preview.url]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(cr.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const triggerDownload = () => {
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = preview.nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
          role="dialog"
          aria-modal="true"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,10,10,0.78)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#f6f5f1",
              border: "1px solid #e5e5e5",
              borderRadius: 4,
              width: "min(1100px, 96vw)",
              height: "min(92vh, 900px)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,.35)",
              overflow: "hidden",
              fontFamily: "'Arial Narrow', Arial, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid #e5e5e5",
                background: "#fff",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif",
                  fontWeight: 900,
                  letterSpacing: ".18em",
                  fontSize: 12,
                  color: "#0A0A0A",
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={preview.nome}
              >
                {preview.nome}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={triggerDownload}
                  style={{
                    background: "#7A1F2B",
                    color: "#fff",
                    border: 0,
                    padding: "7px 12px",
                    fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif",
                    letterSpacing: ".22em",
                    fontSize: 10,
                    fontWeight: 900,
                    borderRadius: 2,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Baixar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  style={{
                    background: "transparent",
                    border: "1px solid #c8c8c8",
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0A0A0A",
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div ref={containerRef} style={{ flex: 1, background: "#1c1c1c", overflow: "auto" }}>
              {isImage ? (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
                  <img src={preview.url} alt={preview.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              ) : isPdf ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 16 }}>
                  <Document
                    file={preview.blob}
                    onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                    loading={
                      <div style={{ color: "#fff", fontFamily: "'Oswald',sans-serif", letterSpacing: ".22em", fontSize: 11, padding: 40 }}>
                        CARREGANDO PDF…
                      </div>
                    }
                    error={
                      <div style={{ color: "#fff", fontFamily: "'Oswald',sans-serif", letterSpacing: ".22em", fontSize: 11, padding: 40 }}>
                        NÃO FOI POSSÍVEL RENDERIZAR ESTE PDF.
                      </div>
                    }
                  >
                    {Array.from({ length: numPages }, (_, i) => (
                      <div key={i} style={{ marginBottom: 12, background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,.4)" }}>
                        <Page
                          pageNumber={i + 1}
                          width={Math.min(width - 32, 980)}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                        />
                      </div>
                    ))}
                  </Document>
                </div>
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 12, color: "#fff", padding: 24, textAlign: "center",
                  fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif",
                  letterSpacing: ".14em", fontSize: 12,
                }}>
                  <div>FORMATO NÃO SUPORTADO PARA VISUALIZAÇÃO INLINE.</div>
                  <button
                    type="button"
                    onClick={triggerDownload}
                    style={{
                      background: "#7A1F2B", color: "#fff", border: 0,
                      padding: "10px 16px",
                      letterSpacing: ".22em", fontWeight: 900, borderRadius: 2,
                      cursor: "pointer",
                      fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif",
                      fontSize: 11,
                    }}
                  >
                    BAIXAR ARQUIVO
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
