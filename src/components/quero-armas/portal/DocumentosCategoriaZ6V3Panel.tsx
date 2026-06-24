import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Eye, Download, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHubCategoriaMeta, getTipoDocumentoMeta } from "@/lib/quero-armas/documentosHubCatalogo";

/* ============================================================
   DOCUMENTOS · CATEGORIA Z6 V3 (canônico papel + bordô)
   Header cliente-cêntrico + KPIs + lista agrupada por categoria
   com ações discretas: VISUALIZAR · BAIXAR · RENOVAR
   Todo evento é gravado em qa_documentos_cliente_eventos.
   ============================================================ */

const DOC_BUCKET = "qa-documentos";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const p = new Date(d);
    return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  try {
    const p = new Date(d);
    return isNaN(p.getTime()) ? null : Math.ceil((p.getTime() - Date.now()) / 86400000);
  } catch {
    return null;
  }
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

function dotColor(d: number | null): string {
  if (d === null) return "#8A8A8A";
  if (d < 0) return "#D9342B";
  if (d <= 7) return "#D9342B";
  if (d <= 30) return "#D6A64B";
  return "#2F8F4A";
}

function remainingLabel(d: number | null): string {
  if (d === null) return "SEM DATA";
  if (d < 0) return `VENCIDO HÁ ${Math.abs(d)}D`;
  if (d === 0) return "VENCE HOJE";
  return `${d}D RESTANTES`;
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
    const { data, error } = await supabase.storage
      .from(DOC_BUCKET)
      .createSignedUrl(doc.arquivo_storage_path, 3600, modo === "baixado" ? { download: doc.arquivo_nome || true } : undefined);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    if (modo === "baixado") {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.arquivo_nome || "documento";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
  onOpenAdd: (tipoDocumento?: string) => void;
}

export default function DocumentosCategoriaZ6V3Panel({ cliente, meusDocs, customerId, onReload, onOpenAdd }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<null | "total" | "aprov" | "venc7" | "venc30" | "vencidos" | "hoje">(null);

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
      const dias = daysUntil(d.data_validade);
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
      const dias = daysUntil(d.data_validade);
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
      .filter((d) => d.data_validade)
      .sort((a, b) => (daysUntil(a.data_validade) ?? 99999) - (daysUntil(b.data_validade) ?? 99999))[0];
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
        docs: v.docs.sort((a, b) => (daysUntil(a.data_validade) ?? 99999) - (daysUntil(b.data_validade) ?? 99999)),
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
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: "#F2F2F2",
        color: "#0A0A0A",
        padding: "20px 24px 24px",
        borderRadius: 4,
      }}
    >
      <style>{`
        .qa-docsz6 .os{font-family:'Oswald','Inter',sans-serif}
        .qa-docsz6 .hdr h1{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;letter-spacing:.04em;color:#0A0A0A;text-transform:uppercase}
        .qa-docsz6 .hdr .meta{margin-top:6px;font-size:11px;color:#6A6A6A;display:flex;gap:18px;flex-wrap:wrap;font-family:'Oswald',sans-serif;letter-spacing:.1em}
        .qa-docsz6 .hdr .meta span b{color:#0A0A0A;font-weight:600}
        .qa-docsz6 .focus{background:#fff;border:1px solid #E5E5E5;border-left:3px solid #D9342B;border-radius:4px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:16px}
        .qa-docsz6 .focus .lbl{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.2em;color:#D9342B}
        .qa-docsz6 .focus .msg{font-size:13px;margin-top:6px;font-weight:600;color:#0A0A0A}
        .qa-docsz6 .focus button{background:#7A1F2B;color:#fff;border:0;padding:9px 16px;font-family:'Oswald',sans-serif;letter-spacing:.16em;font-size:10.5px;font-weight:600;cursor:pointer;border-radius:2px}
        .qa-docsz6 .focus button:hover{background:#5e1721}
        .qa-docsz6 .kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:18px}
        .qa-docsz6 .kpi{background:#fff;border:1px solid #E5E5E5;padding:12px 12px;border-radius:4px;cursor:pointer;transition:all .12s ease;text-align:left;font:inherit;color:inherit}
        .qa-docsz6 .kpi:hover{border-color:#7A1F2B}
        .qa-docsz6 .kpi.active{border-color:#7A1F2B;box-shadow:inset 0 0 0 1px #7A1F2B;background:#FFF8F8}
        .qa-docsz6 .kpi .l{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:.18em;color:#7A7A7A;display:flex;align-items:center;gap:6px}
        .qa-docsz6 .kpi .v{font-family:'Oswald',sans-serif;font-size:24px;font-weight:600;margin-top:6px;color:#0A0A0A;line-height:1}
        .qa-docsz6 .kpi .s{font-size:10px;color:#7A7A7A;margin-top:3px}
        .qa-docsz6 .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
        .qa-docsz6 .listhead{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #E5E5E5;border-radius:4px 4px 0 0;padding:12px 16px;border-bottom:0;gap:12px}
        .qa-docsz6 .listhead .ttl{font-family:'Oswald',sans-serif;font-size:10.5px;letter-spacing:.18em;color:#0A0A0A;font-weight:600;display:flex;align-items:center;gap:8px}
        .qa-docsz6 .listhead .ttl .cnt{background:#EDEDED;color:#444;font-size:9px;padding:1px 6px;border-radius:2px;font-family:'Oswald',sans-serif;letter-spacing:.14em}
        .qa-docsz6 .listhead .add{display:inline-flex;align-items:center;gap:3px;background:transparent;border:1px solid #C8C8C8;color:#7A7A7A;padding:2px 5px;font-family:'Oswald',sans-serif;letter-spacing:.14em;font-size:7.5px;font-weight:600;border-radius:2px;cursor:pointer;text-transform:uppercase}
        .qa-docsz6 .listhead .add:hover{border-color:#7A1F2B;color:#7A1F2B}
        .qa-docsz6 .grp-h{margin-bottom:16px}
        .qa-docsz6 .grp{background:#fff;border:1px solid #E5E5E5;border-top:0}
        .qa-docsz6 .grp:last-child{border-radius:0 0 4px 4px}
        .qa-docsz6 .grp-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #EFEFEF;background:#FAFAFA;cursor:pointer;user-select:none}
        .qa-docsz6 .grp-h .gt{font-family:'Oswald',sans-serif;font-size:10.5px;letter-spacing:.18em;color:#0A0A0A;font-weight:600;display:flex;align-items:center;gap:8px}
        .qa-docsz6 .grp-h .gt .gc{background:#EDEDED;color:#444;font-size:9px;padding:1px 6px;border-radius:2px;font-family:'Oswald',sans-serif;letter-spacing:.14em}
        .qa-docsz6 .grp-h .chev{color:#7A7A7A}
        .qa-docsz6 .row{display:grid;grid-template-columns:14px 1fr auto auto auto auto;gap:18px;align-items:center;padding:16px 18px;border-bottom:3px solid #F2F2F2}
        .qa-docsz6 .row:last-child{border-bottom:0}
        .qa-docsz6 .row .nm{font-size:12px;font-weight:600;color:#0A0A0A;line-height:1.3}
        .qa-docsz6 .row .mt{font-size:10px;color:#7A7A7A;margin-top:2px;font-family:'Oswald',sans-serif;letter-spacing:.06em}
        .qa-docsz6 .pill{font-family:'Oswald',sans-serif;font-size:9px;letter-spacing:.16em;font-weight:600;padding:3px 7px;border-radius:2px;text-transform:uppercase}
        .qa-docsz6 .pill-aprov{background:#E3F2E8;color:#1F6638}
        .qa-docsz6 .pill-pend{background:#FCEFCE;color:#7A5A14}
        .qa-docsz6 .pill-repr{background:#FCE3E1;color:#8A1410}
        .qa-docsz6 .dt{font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.08em;color:#0A0A0A;font-weight:600;text-align:right;min-width:78px}
        .qa-docsz6 .rem{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.14em;font-weight:600;text-align:right;min-width:110px}
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
      <div className="hdr" style={{ marginBottom: 16 }}>
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
        const tipoMeta = getTipoDocumentoMeta(focoDoc.tipo_documento);
        const nome = tipoMeta?.label || String(focoDoc.tipo_documento || "Documento").replace(/_/g, " ");
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
          { k: "total",    dot: "#8A8A8A", l: "TOTAL",            v: kpis.total,    s: "documentos",     vc: "#0A0A0A" },
          { k: "aprov",    dot: "#2F8F4A", l: "APROVADOS",        v: kpis.aprov,    s: "validados",      vc: "#0A0A0A" },
          { k: "venc7",    dot: "#D9342B", l: "A VENCER 7D",      v: kpis.venc7,    s: "ação imediata",  vc: kpis.venc7 > 0 ? "#D9342B" : "#0A0A0A" },
          { k: "venc30",   dot: "#D6A64B", l: "A VENCER 30D",     v: kpis.venc30,   s: "atenção",        vc: kpis.venc30 > 0 ? "#7A5A14" : "#0A0A0A" },
          { k: "vencidos", dot: "#7A1F2B", l: "VENCIDOS",         v: kpis.vencidos, s: "regularizar",    vc: kpis.vencidos > 0 ? "#7A1F2B" : "#0A0A0A" },
          { k: "hoje",     dot: "#2F8F4A", l: "ATUALIZADOS HOJE", v: kpis.hoje,     s: "últimas 24h",    vc: "#0A0A0A" },
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FFF8F8",border:"1px solid #7A1F2B",borderRadius:4,padding:"8px 12px",marginBottom:14,fontFamily:"'Oswald',sans-serif",fontSize:10.5,letterSpacing:".16em",color:"#7A1F2B",fontWeight:600}}>
          <span>FILTRO ATIVO · {docsFiltrados.length} DOCUMENTO{docsFiltrados.length === 1 ? "" : "S"}</span>
          <button type="button" onClick={() => setFilter(null)} style={{background:"transparent",border:0,color:"#7A1F2B",cursor:"pointer",fontFamily:"'Oswald',sans-serif",letterSpacing:".16em",fontSize:10}}>LIMPAR ✕</button>
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
          const isCollapsed = collapsed[g.key];
          return (
            <div className="grp" key={g.key}>
              <div className="grp-h" onClick={() => setCollapsed((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                <div className="gt">
                  {g.label}
                  <span className="gc">{g.docs.length}</span>
                </div>
                <span className="chev">{isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</span>
              </div>

              {!isCollapsed && g.docs.map((d) => {
                const tipoMeta = getTipoDocumentoMeta(d.tipo_documento);
                const nome = tipoMeta?.label || String(d.tipo_documento || "Documento").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                const dias = daysUntil(d.data_validade);
                const cor = dotColor(dias);
                const metaLine = [d.numero_documento, d.orgao_emissor, d.data_emissao ? `emitido ${formatDate(d.data_emissao)}` : null]
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
                    <span className="dt">{d.data_validade ? formatDate(d.data_validade) : "—"}</span>
                    <span className="rem" style={{ color: cor }}>{remainingLabel(dias)}</span>
                    <div className="acts">
                      <button
                        className="act"
                        type="button"
                        title="Visualizar"
                        disabled={!temArquivo}
                        onClick={() => abrirArquivo(d, "visualizado")}
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
    </div>
  );
}