import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, History, Plus, Sparkles, Upload, FileBadge, Crosshair } from "lucide-react";
import { ArsenalSummary, ArsenalSummaryTarget } from "./ArsenalSummary";
import { Workbench, WorkbenchWeapon } from "./Workbench";
import { WeaponDrawer } from "./WeaponDrawer";
import { MunicoesManager } from "./MunicoesManager";
import { TACTICAL, urgencyTone, buildWeaponInfo } from "./utils";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";

interface Props {
  clienteId: number;
  clienteNome: string;
  crafs: any[];
  gtes: any[];
  cadastroCr: any;
  meusDocs: any[];
  expDocs: { label: string; date: string | null; days: number | null; category: string }[];
  alerts: { label: string; date: string | null; days: number | null; category: string }[];
  onOpenAddDoc: () => void;
  onUpdateAvatarClick?: () => void;
}

const normalizeDocWeaponName = (doc: any) => {
  const marca = String(doc?.arma_marca || "").trim();
  const modelo = String(doc?.arma_modelo || "").trim();
  return [marca, modelo].filter(Boolean).join(" ").trim() || null;
};

const formatArmaTitulo = (
  nomeArma: string | null | undefined,
  calibreHint?: string | null,
  catalog?: ArmamentoCatalogo | null,
): string => {
  const info = buildWeaponInfo(nomeArma || null, null);
  const marca = (catalog?.marca || info.marca || "").trim();
  const modeloRaw = (catalog?.modelo || info.modelo || "").trim();
  // Espingardas levam espaços ("Pump Military 3.0").
  // Pistolas, revólveres e fuzis ficam compactados ("TS9", "RT838", "T4").
  const isEspingarda = info.kind === "espingarda";
  const modelo = isEspingarda
    ? modeloRaw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
    : modeloRaw.replace(/\s+/g, "").trim();
  const calibre = (catalog?.calibre || info.calibre || calibreHint || "").trim();
  const partes: string[] = [];
  if (marca) partes.push(marca);
  if (modelo) partes.push(modelo);
  let base = partes.join(" ");
  if (!base) base = (nomeArma || "ARMA").trim();
  if (calibre) base = `${base} · CAL ${calibre}`;
  return base.toUpperCase();
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

export function ArsenalView({
  clienteId,
  clienteNome,
  crafs,
  gtes,
  cadastroCr,
  meusDocs,
  expDocs,
  alerts,
  onOpenAddDoc,
}: Props) {
  const [selected, setSelected] = useState<WorkbenchWeapon | null>(null);
  const [ammo, setAmmo] = useState<{ total: number; byCalibre: { calibre: string; quantidade: number }[] }>({
    total: 0,
    byCalibre: [],
  });
  const { match: matchCatalogo, byId: catalogoById, resolveCraf, loading: catalogoLoading } = useArmamentoCatalogo();

  // Resolve via IA CRAFs/GTEs sem catalogo_id (uma vez por arma)
  useEffect(() => {
    if (catalogoLoading) return;
    crafs.forEach((c: any) => {
      if (!c.catalogo_id && c.nome_arma) resolveCraf({ craf_id: c.id });
    });
    gtes.forEach((g: any) => {
      if (!g.catalogo_id && g.nome_arma) resolveCraf({ gte_id: g.id });
    });
  }, [crafs, gtes, catalogoLoading, resolveCraf]);

  const scrollToSection = (target: ArsenalSummaryTarget) => {
    const sectionId =
      target === "alertas" || target === "cr" || target === "crafs"
        ? "arsenal-situacao"
        : target === "municoes" || target === "calibres"
        ? "arsenal-municoes"
        : "arsenal-bancada";
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Constrói lista de armas a partir dos CRAFs (fonte primária) e
   *  agrega informação de GTE quando o número de série bate. */
  const weapons: WorkbenchWeapon[] = useMemo(() => {
    const gteByArma = new Map<string, any>();
    gtes.forEach((g) => {
      const k = (g.numero_arma || g.numero_sigma || "").toString().trim();
      if (k) gteByArma.set(k, g);
    });
    const fromCrafs = crafs.map((c: any) => {
      const k = (c.numero_arma || c.numero_sigma || "").toString().trim();
      const gte = k ? gteByArma.get(k) : null;
      return {
        id: c.id,
        source: "CRAF" as const,
        nome_arma: c.nome_arma,
        numero_arma: c.numero_arma,
        numero_sigma: c.numero_sigma,
        data_validade: c.data_validade,
        daysToExpire: daysUntil(c.data_validade),
        hasGte: !!gte,
        catalogo_id: c.catalogo_id || null,
      };
    });
    const crafKeys = new Set(
      fromCrafs.map((w) => `${w.numero_arma || ""}|${w.numero_sigma || ""}|${(w.nome_arma || "").toUpperCase()}`),
    );
    const fromDocs = meusDocs
      .filter((d: any) => String(d.tipo_documento || "").toLowerCase() === "craf" && normalizeDocWeaponName(d))
      .map((d: any) => {
        const nome = normalizeDocWeaponName(d);
        return {
          id: `doc-${d.id}`,
          source: "CRAF" as const,
          nome_arma: nome,
          numero_arma: d.arma_numero_serie || d.numero_documento || null,
          numero_sigma: d.numero_documento || null,
          data_validade: d.data_validade,
          daysToExpire: daysUntil(d.data_validade),
          hasGte: false,
        };
      })
      .filter((w: WorkbenchWeapon) => !crafKeys.has(`${w.numero_arma || ""}|${w.numero_sigma || ""}|${(w.nome_arma || "").toUpperCase()}`));
    return [...fromCrafs, ...fromDocs];
  }, [crafs, gtes, meusDocs]);

  // Documentos a exibir como "tags" sobre a bancada
  const benchDocs = useMemo(() => {
    const list: { id: string; category: string; title: string; date: string | null; daysToExpire: number | null }[] = [];
    if (cadastroCr?.validade_cr) {
      list.push({
        id: `cr-${cadastroCr.id}`,
        category: "CR",
        title: cadastroCr.numero_cr ? `CR ${cadastroCr.numero_cr}` : "Certificado de Registro",
        date: cadastroCr.validade_cr,
        daysToExpire: daysUntil(cadastroCr.validade_cr),
      });
    }
    crafs.forEach((c: any) => {
      if (!c.data_validade) return;
      const cat = catalogoById(c.catalogo_id) || matchCatalogo(c.nome_arma);
      list.push({
        id: `craf-${c.id}`,
        category: "CRAF",
        title: formatArmaTitulo(c.nome_arma, c.calibre, cat),
        date: c.data_validade,
        daysToExpire: daysUntil(c.data_validade),
      });
    });
    gtes.forEach((g: any) => {
      if (!g.data_validade) return;
      const cat = catalogoById(g.catalogo_id) || matchCatalogo(g.nome_arma);
      list.push({
        id: `gte-${g.id}`,
        category: "GTE",
        title: formatArmaTitulo(g.nome_arma, g.calibre, cat),
        date: g.data_validade,
        daysToExpire: daysUntil(g.data_validade),
      });
    });
    meusDocs.slice(0, 4).forEach((d: any) => {
      const armaNome = [d.arma_marca, d.arma_modelo].filter(Boolean).join(" ").trim();
      const tipo = String(d.tipo_documento || "").toLowerCase();
      // Para CRAF/GTE o título deve ser o nome da arma (marca + modelo).
      // Apenas documentos sem vínculo de arma caem no número do documento.
      const ehDocDeArma = tipo === "craf" || tipo === "gte";
      const cat = matchCatalogo(armaNome || d.numero_documento);
      const titulo = ehDocDeArma
        ? formatArmaTitulo(armaNome || d.numero_documento, d.arma_calibre, cat)
        : (d.numero_documento || armaNome || "Documento").toUpperCase();
      list.push({
        id: `doc-${d.id}`,
        category: (d.tipo_documento || "DOC").toUpperCase(),
        title: titulo,
        date: d.data_validade,
        daysToExpire: daysUntil(d.data_validade),
      });
    });
    // Ordem da bancada:
    //  1) CR sempre primeiro
    //  2) CRAFs por ordem de deferimento (validade ascendente = mais antigo primeiro)
    //  3) Demais documentos por proximidade de vencimento
    const categoryRank = (cat: string) => {
      if (cat === "CR") return 0;
      if (cat === "CRAF") return 1;
      return 2;
    };
    list.sort((a, b) => {
      const ra = categoryRank(a.category);
      const rb = categoryRank(b.category);
      if (ra !== rb) return ra - rb;
      if (a.category === "CRAF" && b.category === "CRAF") {
        // Validade ascendente equivale a ordem de deferimento (mais antigo primeiro)
        const da = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
        const db = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      }
      return (a.daysToExpire ?? 9999) - (b.daysToExpire ?? 9999);
    });
    return list;
  }, [cadastroCr, crafs, gtes, meusDocs, matchCatalogo, catalogoById]);

  // Drawer: documentos relacionados à arma selecionada
  const relatedDocs = useMemo(() => {
    if (!selected) return [];
    const key = (selected.numero_arma || "").toString().trim().toLowerCase();
    const sigma = (selected.numero_sigma || "").toString().trim().toLowerCase();
    const out: { category: string; title: string; date: string | null }[] = [];
    out.push({ category: selected.source, title: selected.nome_arma || "—", date: selected.data_validade });
    gtes.forEach((g: any) => {
      const gk = (g.numero_arma || "").toString().trim().toLowerCase();
      const gs = (g.numero_sigma || "").toString().trim().toLowerCase();
      if ((key && gk === key) || (sigma && gs === sigma)) {
        out.push({ category: "GTE", title: g.nome_arma || "Guia de Tráfego", date: g.data_validade });
      }
    });
    meusDocs.forEach((d: any) => {
      const dk = (d.arma_serie || d.numero_documento || "").toString().trim().toLowerCase();
      if (dk && (dk === key || dk === sigma)) {
        out.push({
          category: (d.tipo_documento || "DOC").toUpperCase(),
          title: d.numero_documento || [d.arma_marca, d.arma_modelo].filter(Boolean).join(" "),
          date: d.data_validade,
        });
      }
    });
    return out;
  }, [selected, gtes, meusDocs]);

  const ammoSameCalibre = useMemo(() => {
    if (!selected) return 0;
    const info = buildWeaponInfo(selected.nome_arma, selected.numero_arma);
    if (!info.calibre) return 0;
    return ammo.byCalibre
      .filter((a) => a.calibre.replace(/\s/g, "") === info.calibre!.replace(/\s/g, ""))
      .reduce((s, a) => s + a.quantidade, 0);
  }, [selected, ammo]);

  const crStatus = (() => {
    if (!cadastroCr?.validade_cr) return { tone: "muted" as const, label: "SEM CR" };
    const d = daysUntil(cadastroCr.validade_cr);
    const t = urgencyTone(d);
    if (t === "ok") return { tone: "ok" as const, label: "EM DIA" };
    if (t === "warn") return { tone: "warn" as const, label: "ATENÇÃO" };
    if (t === "danger") return { tone: "danger" as const, label: d! < 0 ? "VENCIDO" : "URGENTE" };
    return { tone: "muted" as const, label: "SEM DATA" };
  })();

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <ArsenalSummary
        totalArmas={weapons.length}
        totalMunicoes={ammo.total}
        totalCalibres={ammo.byCalibre.length}
        crStatus={crStatus.tone}
        crLabel={crStatus.label}
        totalCrafs={weapons.filter((w) => w.source === "CRAF").length}
        alerts={alerts.length}
        onNavigate={scrollToSection}
      />

      {/* Bancada + Sidebar */}
      <div id="arsenal-bancada" className="grid scroll-mt-28 gap-4 xl:grid-cols-[1fr_320px]">
        <Workbench
          weapons={weapons}
          documents={benchDocs}
          ammoByCalibre={ammo.byCalibre}
          onSelectWeapon={(w) => setSelected(w)}
        />

        {/* Sidebar Status */}
        <aside id="arsenal-situacao" className="scroll-mt-28 space-y-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" style={{ color: TACTICAL.cyan }} />
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                Situação Geral
              </div>
            </div>
            <div className="space-y-2 text-[11px]">
              <Row
                label="Documentos em dia"
                value={`${expDocs.length - alerts.length}/${expDocs.length || 0}`}
                tone={alerts.length === 0 ? "ok" : "warn"}
              />
              <Row label="Validade do CR" value={crStatus.label} tone={crStatus.tone} />
              <Row label="CRAFs vinculados" value={String(weapons.filter((w) => w.source === "CRAF").length)} tone="cyan" />
              <Row label="Guias ativas" value={String(gtes.length)} tone="cyan" />
              <Row label="Munições totais" value={ammo.total.toLocaleString("pt-BR")} tone="ok" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-slate-600" />
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                Próximos vencimentos
              </div>
            </div>
            {alerts.length === 0 ? (
              <p className="text-[11px] text-slate-500">Nenhum vencimento próximo. Tudo em dia.</p>
            ) : (
              <div className="space-y-1.5">
                {alerts.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-slate-700">{a.label}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-600">
                      {a.days! < 0
                        ? `Vencido há ${Math.abs(a.days!)} ${Math.abs(a.days!) === 1 ? "dia" : "dias"}`
                        : `${a.days} ${a.days === 1 ? "dia" : "dias"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Munições */}
      <div id="arsenal-municoes" className="scroll-mt-28">
        <MunicoesManager clienteId={clienteId} onChange={setAmmo} />
      </div>

      <WeaponDrawer
        open={!!selected}
        weapon={selected}
        relatedDocs={relatedDocs}
        ammoSameCalibre={ammoSameCalibre}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "muted" | "cyan";
}) {
  const color =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : tone === "cyan"
      ? TACTICAL.cyan
      : "hsl(220 10% 50%)";
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${color}14`, color }}>
        {value}
      </span>
    </div>
  );
}