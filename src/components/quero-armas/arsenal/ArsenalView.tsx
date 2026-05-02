import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, History, Plus, Sparkles, Upload, FileBadge, Crosshair, Landmark } from "lucide-react";
import { ArsenalSummary, ArsenalSummaryTarget } from "./ArsenalSummary";
import { Workbench, WorkbenchWeapon } from "./Workbench";
import { WeaponDrawer } from "./WeaponDrawer";
import { MunicoesManager } from "./MunicoesManager";
import { TACTICAL, urgencyTone, buildWeaponInfo, isInvalidWeaponModel, getGteKpiStatus } from "./utils";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { CrModal, CrafModal, GteModal, DeleteConfirm } from "@/components/quero-armas/clientes/SubEntityModals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ArsenalGTEControl from "./ArsenalGTEControl";

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
  onArsenalChanged?: () => Promise<void> | void;
  /** Quando true, exibe controles de exclusão de docs genéricos (admin tem permissão total). */
  isAdmin?: boolean;
  /** Cidade do cliente (usada para resolver Circunscrição PF). */
  clienteCidade?: string | null;
  /** UF do cliente (usada para resolver Circunscrição PF). */
  clienteUf?: string | null;
}

const normalizeDocWeaponName = (doc: any) => {
  const marca = String(doc?.arma_marca || "").trim();
  const modeloRaw = String(doc?.arma_modelo || "").trim();
  // Defesa: nunca aceitar número de documento/registro como modelo.
  const modelo = isInvalidWeaponModel(modeloRaw) ? "" : modeloRaw;
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
  onArsenalChanged,
  isAdmin = false,
  clienteCidade,
  clienteUf,
}: Props) {
  // RLS garante o que pode ser feito; flag identifica origem visual (cliente vs equipe).
  const [selected, setSelected] = useState<WorkbenchWeapon | null>(null);
  const [ammo, setAmmo] = useState<{ total: number; byCalibre: { calibre: string; quantidade: number }[] }>({
    total: 0,
    byCalibre: [],
  });
  const { match: matchCatalogo, byId: catalogoById, resolveCraf, loading: catalogoLoading } = useArmamentoCatalogo();

  // ─── Estados dos modais de CRUD do Arsenal ───
  const [crModal, setCrModal] = useState<{ open: boolean; item?: any }>({ open: false });

  // ─── GTEs (qa_gte_documentos) — fonte do KPI de GTE no Arsenal ───
  // Lê apenas os campos mínimos exigidos pelo helper getGteKpiStatus.
  const [gteDocs, setGteDocs] = useState<{ id: string; data_validade: string | null; status_processamento: string | null }[]>([]);

  // ─── Circunscrição PF (resolve via mesma RPC usada na geração de peças) ───
  const [circ, setCirc] = useState<{ unidade_pf: string; sigla_unidade: string; municipio_sede?: string } | null>(null);
  const [circStatus, setCircStatus] = useState<"idle" | "loading" | "ok" | "not_found" | "error">("idle");
  useEffect(() => {
    let cancelled = false;
    const cidade = String(clienteCidade || "").trim();
    const uf = String(clienteUf || "").trim().toUpperCase();
    if (!cidade || !uf) { setCirc(null); setCircStatus("idle"); return; }
    setCircStatus("loading");
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const apikey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/rpc/qa_resolver_circunscricao_pf`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ p_municipio: cidade.toUpperCase(), p_uf: uf }),
        });
        if (cancelled) return;
        if (!res.ok) { setCirc(null); setCircStatus("error"); return; }
        const data = await res.json();
        if (!data || (Array.isArray(data) && data.length === 0)) { setCirc(null); setCircStatus("not_found"); return; }
        const row = Array.isArray(data) ? data[0] : data;
        setCirc(row); setCircStatus("ok");
      } catch {
        if (!cancelled) { setCirc(null); setCircStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [clienteCidade, clienteUf]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("qa_gte_documentos" as any)
        .select("id, data_validade, status_processamento")
        .eq("cliente_id", clienteId);
      if (!cancelled) setGteDocs(((data as any[]) || []) as any);
    };
    load();
    const ch = supabase
      .channel(`arsenal_gte_kpi_${clienteId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_gte_documentos", filter: `cliente_id=eq.${clienteId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [clienteId]);

  const gteKpi = useMemo(() => getGteKpiStatus(gteDocs), [gteDocs]);

  const [crafModal, setCrafModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [gteModal, setGteModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    title: string;
    desc: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, title: "", desc: "", onConfirm: async () => {} });
  const [deleting, setDeleting] = useState(false);

  const refreshArsenal = async () => { await onArsenalChanged?.(); };

  const askDelete = (title: string, desc: string, onConfirm: () => Promise<void>) =>
    setDeleteModal({ open: true, title, desc, onConfirm });

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteModal.onConfirm();
      setDeleteModal((s) => ({ ...s, open: false }));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const deleteCr = async () => {
    if (!cadastroCr?.id) return;
    const { error } = await supabase.from("qa_cadastro_cr" as any).delete().eq("id", cadastroCr.id);
    if (error) throw error;
    toast.success("CR removido.");
    await refreshArsenal();
  };

  const deleteCraf = async (id: number) => {
    const { error } = await supabase.from("qa_crafs" as any).delete().eq("id", id);
    if (error) throw error;
    toast.success("CRAF removido.");
    await refreshArsenal();
  };

  const deleteGte = async (id: number) => {
    const { error } = await supabase.from("qa_gtes" as any).delete().eq("id", id);
    if (error) throw error;
    toast.success("GTE removido.");
    await refreshArsenal();
  };

  const deleteDocCliente = async (id: string) => {
    // Soft-delete: marca como excluído para preservar auditoria; some do portal e dos KPIs.
    const { error } = await supabase
      .from("qa_documentos_cliente" as any)
      .update({ status: "excluido" })
      .eq("id", id);
    if (error) throw error;
    toast.success("Documento removido.");
    await refreshArsenal();
  };

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
    // Clique no KPI "Status CR" abre o modal de CR (criar ou editar) — controle total.
    if (target === "cr") {
      setCrModal({ open: true, item: cadastroCr || undefined });
      return;
    }
    if (target === "gte") {
      document.getElementById("arsenal-gte")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const sectionId =
      target === "alertas" || target === "crafs"
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
    // Chave única por arma física = número de série (numero_arma) OU número SIGMA.
    // Usar apenas marca/modelo no nome causava falsos negativos (ex.: "GLOCK G25" vs
    // "GLOCK GMBH (AUSTRIA) G25" extraído via OCR), gerando armas duplicadas na bancada.
    const norm = (s: string | null | undefined) =>
      String(s || "").replace(/\s+/g, "").toUpperCase().trim();
    const crafSerials = new Set<string>();
    const crafSigmas = new Set<string>();
    fromCrafs.forEach((w) => {
      const serial = norm(w.numero_arma);
      const sigma = norm(w.numero_sigma);
      if (serial) crafSerials.add(serial);
      if (sigma) crafSigmas.add(sigma);
    });
    const fromDocs = meusDocs
      .filter((d: any) => {
        const tipo = String(d.tipo_documento || "").toLowerCase();
        // Documentos vinculados a arma (CRAF, SINARM, GT, GTE, autorização) entram no arsenal
        // desde que tenham marca/modelo válidos extraídos.
        const ehDocDeArma = ["craf", "sinarm", "gt", "gte", "autorizacao_compra", "outro"].includes(tipo);
        return ehDocDeArma && normalizeDocWeaponName(d);
      })
      .map((d: any) => {
        const nome = normalizeDocWeaponName(d);
        const tipoUpper = String(d.tipo_documento || "DOC").toUpperCase();
        return {
          id: `doc-${d.id}`,
          source: (tipoUpper === "GTE" ? "GTE" : "CRAF") as "CRAF" | "GTE",
          nome_arma: nome,
          numero_arma: d.arma_numero_serie || d.numero_documento || null,
          numero_sigma: d.numero_documento || null,
          data_validade: d.data_validade,
          daysToExpire: daysUntil(d.data_validade),
          hasGte: false,
        };
      })
      .filter((w: WorkbenchWeapon) => {
        // Considera duplicada se a série OU o SIGMA já estiverem presentes nos CRAFs
        // oficiais (qa_crafs). Chave física, independente de variações de nome/OCR.
        const serial = norm(w.numero_arma);
        const sigma = norm(w.numero_sigma);
        if (serial && crafSerials.has(serial)) return false;
        if (sigma && crafSigmas.has(sigma)) return false;
        // O numero_documento de SINARM/CRAF muitas vezes é o próprio SIGMA — cruza também.
        if (serial && crafSigmas.has(serial)) return false;
        if (sigma && crafSerials.has(sigma)) return false;
        return true;
      });
    return [...fromCrafs, ...fromDocs];
  }, [crafs, gtes, meusDocs]);

  // Documentos a exibir como "tags" sobre a bancada
  const benchDocs = useMemo(() => {
    const norm = (s: string | null | undefined) =>
      String(s || "").replace(/\s+/g, "").toUpperCase().trim();
    // Conjuntos das chaves físicas (série/SIGMA) já cobertas pelos CRAFs oficiais.
    const crafSerials = new Set<string>();
    const crafSigmas = new Set<string>();
    crafs.forEach((c: any) => {
      const s = norm(c.numero_arma);
      const g = norm(c.numero_sigma);
      if (s) crafSerials.add(s);
      if (g) crafSigmas.add(g);
    });
    const list: { id: string; category: string; title: string; date: string | null; daysToExpire: number | null; onOpen?: () => void; onDelete?: () => void }[] = [];
    if (cadastroCr?.validade_cr) {
      list.push({
        id: `cr-${cadastroCr.id}`,
        category: "CR",
        title: cadastroCr.numero_cr ? `CR ${cadastroCr.numero_cr}` : "Certificado de Registro",
        date: cadastroCr.validade_cr,
        daysToExpire: daysUntil(cadastroCr.validade_cr),
        onOpen: () => setCrModal({ open: true, item: cadastroCr }),
        onDelete: () => askDelete(
          "Excluir CR",
          `Excluir o CR "${cadastroCr.numero_cr || ""}" deste cliente? Esta ação não pode ser desfeita.`,
          deleteCr,
        ),
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
        onOpen: () => setCrafModal({ open: true, item: c }),
        onDelete: () => askDelete(
          "Excluir CRAF",
          `Excluir o CRAF de "${formatArmaTitulo(c.nome_arma, c.calibre, cat)}"?`,
          () => deleteCraf(c.id),
        ),
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
        onOpen: () => setGteModal({ open: true, item: g }),
        onDelete: () => askDelete(
          "Excluir GTE",
          `Excluir a GTE de "${formatArmaTitulo(g.nome_arma, g.calibre, cat)}"?`,
          () => deleteGte(g.id),
        ),
      });
    });
    meusDocs.forEach((d: any) => {
      // Defesa: nunca aceitar número como modelo.
      const modeloSeguro = isInvalidWeaponModel(d.arma_modelo) ? "" : String(d.arma_modelo || "").trim();
      const armaNome = [d.arma_marca, modeloSeguro].filter(Boolean).join(" ").trim();
      const tipo = String(d.tipo_documento || "").toLowerCase();
      // Não duplicar o CR já presente em qa_cadastro_cr.
      if (tipo === "cr" && cadastroCr?.validade_cr) return;
      // Não duplicar CRAFs/SINARMs já presentes em qa_crafs (mesma arma física).
      const docSerial = norm(d.arma_numero_serie);
      const docNumDoc = norm(d.numero_documento);
      if (
        ["craf", "sinarm", "gt", "gte", "autorizacao_compra"].includes(tipo) &&
        ((docSerial && (crafSerials.has(docSerial) || crafSigmas.has(docSerial))) ||
         (docNumDoc && (crafSigmas.has(docNumDoc) || crafSerials.has(docNumDoc))))
      ) {
        return;
      }
      // Documentos de arma (CRAF, SINARM, GT, GTE, autorização) e qualquer "outro"
      // que tenha marca/modelo extraídos devem mostrar o NOME DA ARMA.
      // Nunca usar número de documento como título.
      const ehDocDeArma = ["craf", "sinarm", "gt", "gte", "autorizacao_compra"].includes(tipo);
      const cat = matchCatalogo(armaNome);
      let titulo: string;
      if (armaNome) {
        titulo = formatArmaTitulo(armaNome, d.arma_calibre, cat);
      } else if (ehDocDeArma) {
        // Documento de arma sem modelo extraído → pendência de conferência
        titulo = "MODELO PENDENTE DE CONFERÊNCIA";
      } else {
        // Documento administrativo genuíno (sem vínculo de arma)
        titulo = (d.numero_documento || "DOCUMENTO").toUpperCase();
      }
      list.push({
        id: `doc-${d.id}`,
        category: (d.tipo_documento || "DOC").toUpperCase(),
        title: titulo,
        date: d.data_validade,
        daysToExpire: daysUntil(d.data_validade),
        onDelete: () => askDelete(
          "Excluir documento",
          `Excluir o documento "${titulo}"? Esta ação não pode ser desfeita.`,
          () => deleteDocCliente(d.id),
        ),
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
        totalGtes={gteKpi.total}
        gteStatus={gteKpi.statusVisual}
        gteHint={gteKpi.labelSecundaria}
        onNavigate={scrollToSection}
      />

      {/* Situação Geral + Próximos vencimentos — strip horizontal acima da bancada */}
      <aside
        id="arsenal-situacao"
        className="scroll-mt-28 grid gap-3 md:grid-cols-2"
      >
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" style={{ color: TACTICAL.cyan }} />
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                Situação Geral
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
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

      {/* Circunscrição PF do cliente — visível na aba Arsenal */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-slate-600" />
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Circunscrição PF
          </div>
        </div>
        {circStatus === "loading" && (
          <p className="text-[11px] text-slate-500">Resolvendo circunscrição…</p>
        )}
        {circStatus === "ok" && circ && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-bold uppercase text-slate-800 leading-tight break-words">
                {circ.unidade_pf}
              </div>
              {circ.municipio_sede && (
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                  Sede: {circ.municipio_sede}
                </div>
              )}
            </div>
            <span
              className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "hsl(220 13% 92%)", color: "hsl(220 10% 30%)" }}
            >
              {circ.sigla_unidade}
            </span>
          </div>
        )}
        {circStatus === "not_found" && (
          <p className="text-[11px] text-slate-500">
            Circunscrição não localizada para {String(clienteCidade || "—")}/{String(clienteUf || "—")}.
          </p>
        )}
        {circStatus === "error" && (
          <p className="text-[11px] text-amber-700">Falha ao consultar circunscrição. Tente novamente.</p>
        )}
        {circStatus === "idle" && (
          <p className="text-[11px] text-slate-500">Cadastre cidade e UF do cliente para resolver a circunscrição.</p>
        )}
      </div>

      {/* Bancada Tática — largura total */}
      <div id="arsenal-bancada" className="scroll-mt-28">
        {/* Ação rápida — envio de CRAF (alimenta Arsenal/Bancada).
            GTE NÃO entra aqui: o upload de GTE vive dentro de "Controle de GTE" abaixo. */}
        <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
          <button
            type="button"
            onClick={() => setCrafModal({ open: true })}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-amber-400/60 bg-amber-50 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 hover:bg-amber-100 transition"
            title="Enviar / cadastrar CRAF"
          >
            <Upload className="h-3.5 w-3.5" /> ENVIAR CRAF
          </button>
        </div>
        <Workbench
          weapons={weapons}
          documents={benchDocs}
          ammoByCalibre={ammo.byCalibre}
          onSelectWeapon={(w) => setSelected(w)}
        />
      </div>

      {/* Controle de GTE — extração IA + KPIs (cliente + equipe) */}
      <div id="arsenal-gte" className="scroll-mt-28">
        <ArsenalGTEControl clienteId={clienteId} origem={isAdmin ? "equipe" : "cliente"} />
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
        onDelete={async (w) => {
          // ref_id: para fontes "doc-..." manda o id real do documento
          const isDoc = typeof w.id === "string" && w.id.startsWith("doc-");
          const source = isDoc ? "DOC" : w.source;
          const ref_id = isDoc ? String(w.id).replace(/^doc-/, "") : w.id;
          const { data, error } = await supabase.functions.invoke("qa-cliente-excluir-armamento", {
            body: {
              cliente_id: clienteId,
              source,
              ref_id,
              numero_arma: w.numero_arma,
              numero_sigma: w.numero_sigma,
            },
          });
          if (error || (data as any)?.error) {
            toast.error((data as any)?.error || error?.message || "Erro ao excluir");
            throw new Error("delete_failed");
          }
          toast.success("Armamento removido do arsenal.");
          await onArsenalChanged?.();
        }}
      />

      {/* Modais de CRUD do Arsenal — controle total a partir da Bancada e dos KPIs */}
      <CrModal
        open={crModal.open}
        onClose={() => setCrModal({ open: false })}
        onSaved={refreshArsenal}
        clienteId={clienteId}
        cadastro={crModal.item}
      />
      <CrafModal
        open={crafModal.open}
        onClose={() => setCrafModal({ open: false })}
        onSaved={refreshArsenal}
        clienteId={clienteId}
        craf={crafModal.item}
      />
      <GteModal
        open={gteModal.open}
        onClose={() => setGteModal({ open: false })}
        onSaved={refreshArsenal}
        clienteId={clienteId}
        gte={gteModal.item}
      />
      <DeleteConfirm
        open={deleteModal.open}
        onClose={() => setDeleteModal((s) => ({ ...s, open: false }))}
        onConfirm={confirmDelete}
        title={deleteModal.title}
        description={deleteModal.desc}
        loading={deleting}
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