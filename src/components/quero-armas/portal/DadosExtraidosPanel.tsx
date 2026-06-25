import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Printer, Pencil } from "lucide-react";
import {
  getHubCategoriaMeta,
  getNomeDocumentoDisplay,
  getTipoDocumentoMeta,
} from "@/lib/quero-armas/documentosHubCatalogo";
import { EMPRESA } from "@/lib/quero-armas/empresa";
import logoQueroArmas from "@/assets/logo-eu-quero-armas.png";

/* ============================================================
   DADOS EXTRAÍDOS · sub-visão da aba Documentos
   Lista campos extraídos de cada documento agrupados por
   categoria, com botão "Editar" (reabre ClienteDocsHubModal)
   e "Imprimir relatório" (gera folha A4 institucional).
   ============================================================ */

function parseDateUTC(d: string | null | undefined): Date | null {
  if (!d) return null;
  const s = String(d).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const dt = new Date(Date.UTC(+br[3], +br[2] - 1, +br[1]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  const p = parseDateUTC(d);
  if (!p) return String(d);
  return `${String(p.getUTCDate()).padStart(2, "0")}/${String(p.getUTCMonth() + 1).padStart(2, "0")}/${p.getUTCFullYear()}`;
};

const fmtDateTime = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
};

function isLaudoExame(doc: any): boolean {
  return /laudo|exame|capacidade_tecnica|psicotecnico/i.test(String(doc?.tipo_documento || ""));
}

interface Campo {
  label: string;
  valor: string;
}

function camposDoc(doc: any): Campo[] {
  const base: Campo[] = [
    { label: "Número", valor: doc?.numero_documento || "—" },
    { label: "Órgão emissor", valor: doc?.orgao_emissor || "—" },
    { label: isLaudoExame(doc) ? "Data da avaliação" : "Emissão", valor: fmtDate(doc?.data_emissao) },
    { label: "Validade", valor: fmtDate(doc?.data_validade_efetiva || doc?.data_validade) },
    { label: "Observações", valor: doc?.observacoes || "—" },
  ];
  return base;
}

function camposArma(doc: any): Campo[] | null {
  const tem = doc?.arma_marca || doc?.arma_modelo || doc?.arma_calibre || doc?.arma_especie || doc?.arma_numero_serie;
  if (!tem) return null;
  return [
    { label: "Marca", valor: doc?.arma_marca || "—" },
    { label: "Modelo", valor: doc?.arma_modelo || "—" },
    { label: "Calibre", valor: doc?.arma_calibre || "—" },
    { label: "Espécie", valor: doc?.arma_especie || "—" },
    { label: "Nº de série", valor: doc?.arma_numero_serie || "—" },
  ];
}

interface Props {
  cliente: any;
  meusDocs: any[];
  onEditDoc: (doc: any) => void;
}

export default function DadosExtraidosPanel({ cliente, meusDocs, onEditDoc }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; docs: any[] }>();
    meusDocs.forEach((d) => {
      const tipoMeta = getTipoDocumentoMeta(d.tipo_documento);
      const catKey = (tipoMeta?.categoria || d.categoria_hub || "outros") as string;
      const catMeta = (() => {
        try { return getHubCategoriaMeta(catKey as any); } catch { return { label: catKey }; }
      })();
      if (!map.has(catKey)) map.set(catKey, { label: (catMeta as any).label || catKey, docs: [] });
      map.get(catKey)!.docs.push(d);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, label: String(v.label).toUpperCase(), docs: v.docs }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [meusDocs]);

  const totalCampos = useMemo(() => {
    return meusDocs.reduce((acc, d) => acc + camposDoc(d).length + (camposArma(d)?.length || 0), 0);
  }, [meusDocs]);

  const nomeCliente = String(cliente?.nome_completo || cliente?.nome || "—").toUpperCase();
  const cr = String(cliente?.cr_numero || cliente?.numero_cr || "—");
  const emissao = fmtDateTime(new Date());

  const onPrint = () => {
    window.print();
  };

  return (
    <div className="qa-dados-extraidos" style={{ color: "#0A0A0A" }}>
      <style>{`
        .qa-dados-extraidos{font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:.02em}
        .qa-dados-extraidos .os{font-family:'Oswald','Arial Narrow',Arial,sans-serif}
        .qa-dx-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap}
        .qa-dx-toolbar .ttl{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:.22em;font-weight:900;color:#0A0A0A;text-transform:uppercase}
        .qa-dx-toolbar .sub{font-size:11px;color:#7A7A7A;text-transform:uppercase;letter-spacing:.18em;font-weight:700}
        .qa-dx-print{display:inline-flex;align-items:center;gap:6px;background:#7A1F2B;color:#fff;border:0;padding:9px 14px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;letter-spacing:.22em;font-size:11px;font-weight:900;cursor:pointer;border-radius:2px;text-transform:uppercase}
        .qa-dx-print:hover{background:#5e1721}
        .qa-dx-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}
        .qa-dx-kpi{background:#fff;border:1px solid #E5E5E5;padding:12px;border-radius:4px}
        .qa-dx-kpi .l{font-family:'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.24em;color:#7A7A7A;text-transform:uppercase}
        .qa-dx-kpi .v{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:26px;font-weight:900;margin-top:8px;color:#0A0A0A;line-height:1}
        .qa-dx-grp{background:#fff;border:1px solid #E5E5E5;border-radius:4px;margin-bottom:12px;overflow:hidden}
        .qa-dx-grp-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #F2F2F2;background:#FAFAFA;cursor:pointer;user-select:none}
        .qa-dx-grp-h .gt{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.22em;color:#0A0A0A;font-weight:900;display:flex;align-items:center;gap:8px;text-transform:uppercase}
        .qa-dx-grp-h .gt .gc{background:#EDEDED;color:#444;font-size:9px;padding:1px 6px;border-radius:2px;font-weight:900;letter-spacing:.18em}
        .qa-dx-doc{padding:14px 16px;border-top:1px solid #F2F2F2}
        .qa-dx-doc:first-child{border-top:0}
        .qa-dx-doc-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
        .qa-dx-doc-nm{font-family:'Arial Narrow',Arial,sans-serif;font-size:13px;font-weight:900;color:#0A0A0A;text-transform:none;letter-spacing:-.01em}
        .qa-dx-doc-meta{font-size:10px;color:#7A7A7A;margin-top:2px;text-transform:uppercase;letter-spacing:.18em;font-weight:700}
        .qa-dx-edit{display:inline-flex;align-items:center;gap:4px;background:transparent;border:1px solid #C8C8C8;color:#7A7A7A;padding:5px 9px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;letter-spacing:.18em;font-size:9px;font-weight:900;border-radius:2px;cursor:pointer;text-transform:uppercase}
        .qa-dx-edit:hover{border-color:#7A1F2B;color:#7A1F2B}
        .qa-dx-table{width:100%;border-collapse:collapse;font-size:12px}
        .qa-dx-table th,.qa-dx-table td{padding:6px 8px;border-bottom:1px solid #F2F2F2;text-align:left;vertical-align:top}
        .qa-dx-table th{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;color:#7A7A7A;text-transform:uppercase;width:34%}
        .qa-dx-table td{font-family:'Arial Narrow',Arial,sans-serif;color:#0A0A0A;font-weight:700}
        .qa-dx-sub{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:10px;letter-spacing:.22em;color:#7A1F2B;font-weight:900;text-transform:uppercase;margin:10px 0 4px}
        .qa-dx-empty{padding:30px;text-align:center;color:#9A9A9A;font-size:12px;background:#fff;border:1px solid #E5E5E5;border-radius:4px}

        /* Bloco de impressão */
        .qa-print-root{display:none}
        @media print{
          @page{size:A4;margin:18mm 14mm 22mm 14mm}
          body * {visibility:hidden !important}
          .qa-print-root, .qa-print-root *{visibility:visible !important}
          .qa-print-root{display:block;position:absolute;left:0;top:0;width:100%;color:#000;background:#fff;font-family:'Arial Narrow',Arial,sans-serif}
          .qa-print-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:10px;border-bottom:2px solid #000;margin-bottom:14px}
          .qa-print-hdr .l-logo{display:flex;align-items:center;gap:10px}
          .qa-print-hdr .l-logo img{height:36px;width:auto}
          .qa-print-hdr .l-logo .sub{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:10px;letter-spacing:.22em;color:#000;text-transform:uppercase;font-weight:900}
          .qa-print-hdr .r-emp{font-size:10px;line-height:1.4;color:#000;text-align:right}
          .qa-print-hdr .r-emp .rz{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:11px}
          .qa-print-title{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:16px;letter-spacing:.22em;font-weight:900;text-transform:uppercase;margin:0 0 4px 0}
          .qa-print-meta{font-size:11px;color:#000;margin-bottom:14px}
          .qa-print-meta span{margin-right:14px;text-transform:uppercase;letter-spacing:.06em}
          .qa-print-grp{margin-bottom:14px;page-break-inside:avoid}
          .qa-print-grp-h{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.22em;font-weight:900;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:3px;margin-bottom:8px}
          .qa-print-doc{margin-bottom:10px;page-break-inside:avoid}
          .qa-print-doc-nm{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:11px;letter-spacing:.12em;font-weight:900;text-transform:uppercase;margin-bottom:4px}
          .qa-print-table{width:100%;border-collapse:collapse;font-size:10.5px}
          .qa-print-table th,.qa-print-table td{padding:3px 6px;border-bottom:1px solid #BBB;text-align:left;vertical-align:top}
          .qa-print-table th{width:32%;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#000}
          .qa-print-sub{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:10px;letter-spacing:.18em;font-weight:900;text-transform:uppercase;margin:8px 0 3px 0}
          .qa-print-foot{position:fixed;bottom:8mm;left:14mm;right:14mm;border-top:1px solid #000;padding-top:4px;font-size:9px;color:#000;display:flex;justify-content:space-between;gap:8px}
          .qa-print-foot .l{max-width:70%}
        }
      `}</style>

      {/* Toolbar */}
      <div className="qa-dx-toolbar no-print">
        <div>
          <div className="ttl">Dados extraídos</div>
          <div className="sub">Campos lidos pela IA · {meusDocs.length} {meusDocs.length === 1 ? "documento" : "documentos"} · {totalCampos} campos</div>
        </div>
        <button type="button" className="qa-dx-print" onClick={onPrint}>
          <Printer size={14} />
          Imprimir relatório
        </button>
      </div>

      {/* KPIs */}
      <div className="qa-dx-kpis no-print">
        <div className="qa-dx-kpi"><div className="l">Documentos</div><div className="v">{meusDocs.length}</div></div>
        <div className="qa-dx-kpi"><div className="l">Categorias</div><div className="v">{grupos.length}</div></div>
        <div className="qa-dx-kpi"><div className="l">Campos extraídos</div><div className="v">{totalCampos}</div></div>
      </div>

      {/* Grupos */}
      {grupos.length === 0 ? (
        <div className="qa-dx-empty">Nenhum documento com dados extraídos.</div>
      ) : (
        grupos.map((g) => {
          const isCol = collapsed[g.key];
          return (
            <div key={g.key} className="qa-dx-grp">
              <div className="qa-dx-grp-h" onClick={() => setCollapsed((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                <div className="gt">{g.label} <span className="gc">{g.docs.length}</span></div>
                {isCol ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
              {!isCol && g.docs.map((d) => {
                const arma = camposArma(d);
                return (
                  <div key={d.id} className="qa-dx-doc">
                    <div className="qa-dx-doc-h">
                      <div>
                        <div className="qa-dx-doc-nm">{getNomeDocumentoDisplay(d, d.tipo_documento || "Documento")}</div>
                        <div className="qa-dx-doc-meta">Atualizado {fmtDate(d.updated_at || d.created_at)}</div>
                      </div>
                      <button type="button" className="qa-dx-edit" onClick={() => onEditDoc(d)}>
                        <Pencil size={11} /> Editar
                      </button>
                    </div>
                    <table className="qa-dx-table">
                      <tbody>
                        {camposDoc(d).map((c) => (
                          <tr key={c.label}><th>{c.label}</th><td>{c.valor}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {arma && (
                      <>
                        <div className="qa-dx-sub">Arma</div>
                        <table className="qa-dx-table">
                          <tbody>
                            {arma.map((c) => (
                              <tr key={c.label}><th>{c.label}</th><td>{c.valor}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Layout de impressão */}
      <div className="qa-print-root" aria-hidden>
        <div className="qa-print-hdr">
          <div className="l-logo">
            <img src={logoQueroArmas} alt="Quero Armas" />
          </div>
          <div className="r-emp">
            <div className="rz">{EMPRESA.razaoSocial}</div>
            <div>CNPJ {EMPRESA.cnpj}</div>
            <div>{EMPRESA.endereco}</div>
            <div>{EMPRESA.cidadeUf} — CEP {EMPRESA.cep}</div>
            <div>{EMPRESA.telefone}</div>
            <div>{EMPRESA.site}</div>
          </div>
        </div>

        <h1 className="qa-print-title">Relatório de documentos</h1>
        <div className="qa-print-meta">
          <span><b>Cliente:</b> {nomeCliente}</span>
          <span><b>CR:</b> {cr}</span>
          <span><b>Emissão:</b> {emissao}</span>
          <span><b>Documentos:</b> {meusDocs.length}</span>
          <span><b>Campos:</b> {totalCampos}</span>
        </div>

        {grupos.map((g) => (
          <div key={g.key} className="qa-print-grp">
            <div className="qa-print-grp-h">{g.label} · {g.docs.length}</div>
            {g.docs.map((d) => {
              const arma = camposArma(d);
              return (
                <div key={d.id} className="qa-print-doc">
                  <div className="qa-print-doc-nm">{getNomeDocumentoDisplay(d, d.tipo_documento || "Documento")}</div>
                  <table className="qa-print-table">
                    <tbody>
                      {camposDoc(d).map((c) => (
                        <tr key={c.label}><th>{c.label}</th><td>{c.valor}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {arma && (
                    <>
                      <div className="qa-print-sub">Arma</div>
                      <table className="qa-print-table">
                        <tbody>
                          {arma.map((c) => (
                            <tr key={c.label}><th>{c.label}</th><td>{c.valor}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="qa-print-foot">
          <div className="l">
            {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj}
            <br />
            Documento gerado pelo Portal do Cliente Quero Armas em {emissao} — sujeito a conferência.
          </div>
          <div className="r">Quero Armas</div>
        </div>
      </div>
    </div>
  );
}