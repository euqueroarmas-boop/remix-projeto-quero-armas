import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, History, Plus, Sparkles, Upload, FileBadge, Crosshair, Landmark } from "lucide-react";
import { ArsenalSummary, ArsenalSummaryTarget } from "./ArsenalSummary";
import { Workbench, WorkbenchWeapon } from "./Workbench";
import { WeaponDrawer } from "./WeaponDrawer";
import { MunicoesMovimentacoesManager } from "./MunicoesMovimentacoesManager";
import {
  TACTICAL,
  urgencyTone,
  buildWeaponInfo,
  isInvalidWeaponModel,
  getGteKpiStatus,
  normalizeCalibre,
  isGteExigivelParaArma,
  getWeaponRegime,
  type GtDocStatus,
} from "./utils";
import {
  listGtDeclaracoes,
  weaponKeyOf,
  type GtDeclaracaoRow,
} from "./gtDeclaracoes";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { CrModal, CrafModal, GteModal, DeleteConfirm } from "@/components/quero-armas/clientes/SubEntityModals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ArsenalGTEControl from "./ArsenalGTEControl";
import ArsenalCRAFControl from "./ArsenalCRAFControl";
import ArsenalAutorizacoesControl from "./ArsenalAutorizacoesControl";
import { CrafUploadIAModal } from "./CrafUploadIAModal";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { excluirDocumentoLogico } from "@/components/quero-armas/clientes/docsAprovacao";
import { AlertasDrillDownModal, type AlertaItem } from "./AlertasDrillDownModal";
import { useArsenalGruposLayout, type ArsenalGroupId } from "./useArsenalGruposLayout";
import { ArsenalGruposToolbar } from "./ArsenalGruposToolbar";
import { ArsenalGroupItem } from "./ArsenalGroupItem";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  getStatusUnificado,
  getStatusValidade,
  reduzirStatus,
  type DocumentoUploadLite,
  type StatusUnificado,
} from "@/lib/quero-armas/statusUnificado";
import { useClienteStatusAgregado, type KpiValidade, type KpiCR } from "@/hooks/useClienteStatusAgregado";
import type { CorStatus } from "@/lib/quero-armas/statusUnificado";

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
  /** Quando true, indica que o painel está sendo usado pela Equipe Quero Armas
   *  (perfil interno) — habilita controles de exclusão de docs genéricos. */
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
  // O catálogo é apenas sugestão visual: nunca pode substituir marca/modelo
  // digitados ou confirmados no documento/CRAF.
  const marca = (info.marca || catalog?.marca || "").trim();
  const modeloRaw = (info.modelo || "").trim();
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
  const calibre = (info.calibre || calibreHint || catalog?.calibre || "").trim();
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

const normWeaponKey = (s: string | null | undefined) =>
  String(s || "").replace(/\s+/g, "").toUpperCase().trim();

const isValidDateFromToday = (value: string | null | undefined, today: Date) => {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.getTime() >= today.getTime();
};

type LinkedDocStatus = "valido" | "ativo" | "vencido" | "ausente" | "revisar";

interface WeaponLinkState {
  crafMatches: any[];
  gteMatches: any[];
  gtMatches: any[];
  crafStatus: LinkedDocStatus;
  gteStatus: LinkedDocStatus;
  crafLabel: string;
  gteLabel: string;
  crafValido: boolean;
  gteValida: boolean;
  /** Status da GT (retirada/transporte inicial) — informativo, nunca crítico. */
  gtStatus: GtDocStatus;
  /** Cliente declarou que não possui mais a GT. */
  gtDeclaradaNaoPossui: boolean;
  /** Data/hora ISO da declaração persistida no banco (quando houver). */
  gtDeclaradaEm: string | null;
  semVinculo: boolean;
  hasWeakCrafDoc: boolean;
  hasWeakGteDoc: boolean;
}

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
  // Declarações persistentes "Não possuo mais a GT" — fonte de verdade no banco.
  const [gtDeclaracoes, setGtDeclaracoes] = useState<GtDeclaracaoRow[]>([]);
  const [ammo, setAmmo] = useState<{ total: number; byCalibre: { calibre: string; quantidade: number }[] }>({
    total: 0,
    byCalibre: [],
  });
  const { match: matchCatalogo, byId: catalogoById, resolveCraf, loading: catalogoLoading } = useArmamentoCatalogo();

  // Carrega declarações GT persistentes + realtime para refletir mudanças
  // feitas pela Equipe ou em outra aba/dispositivo.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = await listGtDeclaracoes(clienteId);
      if (!cancelled) setGtDeclaracoes(rows);
    };
    void load();
    const ch = supabase
      .channel(`arsenal_gt_decl_${clienteId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_arma_gt_declaracoes", filter: `qa_cliente_id=eq.${clienteId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [clienteId]);

  const gtDeclaracaoMap = useMemo(() => {
    const m = new Map<string, GtDeclaracaoRow>();
    gtDeclaracoes.forEach((r) => m.set(r.weapon_key, r));
    return m;
  }, [gtDeclaracoes]);

  // ─── Estados dos modais de CRUD do Arsenal ───
  const [crModal, setCrModal] = useState<{ open: boolean; item?: any }>({ open: false });

  // ─── GTEs (qa_gte_documentos) — fonte do KPI de GTE no Arsenal ───
  // Lê apenas os campos mínimos exigidos pelo helper getGteKpiStatus.
  const [gteDocs, setGteDocs] = useState<{ id: string; data_validade: string | null; status_processamento: string | null }[]>([]);

  // ─── BLOCO 2 — Datasets adicionais para os KPIs Documentos / Processos /
  //     Autorizações / Exames (Linha 2 recolhível no ArsenalSummary).
  //     Leitura mínima, somente leitura, sem mexer em schema.
  const [processos, setProcessos] = useState<{ id: string; status: string | null; pagamento_status: string | null; servico_nome: string | null; service_slug?: string | null }[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<{ id: string; status_servico: string | null; status_financeiro: string | null; service_slug: string | null; service_name: string | null }[]>([]);
  const [exames, setExames] = useState<{ id: string; tipo: string | null; data_realizacao: string | null; data_vencimento: string | null }[]>([]);

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

  // BLOCO 2 — fetch das fontes de Documentos/Processos/Autorizações/Exames.
  // Reusa as tabelas já existentes (qa_documentos_cliente é lida via meusDocs).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: procs }, { data: sols }, { data: exs }] = await Promise.all([
        supabase
          .from("qa_processos" as any)
          .select("id, status, pagamento_status, servico_nome")
          .eq("cliente_id", clienteId),
        supabase
          .from("qa_solicitacoes_servico" as any)
          .select("id, status_servico, status_financeiro, service_slug, service_name")
          .eq("cliente_id", clienteId),
        supabase
          .from("qa_exames_cliente" as any)
          .select("id, tipo, data_realizacao, data_vencimento")
          .eq("cliente_id", clienteId),
      ]);
      if (cancelled) return;
      setProcessos(((procs as any[]) || []) as any);
      setSolicitacoes(((sols as any[]) || []) as any);
      setExames(((exs as any[]) || []) as any);
    };
    void load();
    return () => { cancelled = true; };
  }, [clienteId]);

  const [crafModal, setCrafModal] = useState<{ open: boolean; item?: any }>({ open: false });
  // Modal NOVO: upload + leitura por IA + confirmação humana.
  // O CrafModal antigo (acima) continua sendo usado para EDIÇÃO manual de um CRAF já cadastrado.
  const [crafUploadIA, setCrafUploadIA] = useState<{ open: boolean }>({ open: false });
  // Hub Documental — fluxo unificado de envio de CRAF (mesma lógica do Hub do cliente).
  // Substitui o botão "ENVIAR CRAF" no header da Bancada para usar IA + revisão + aprovação.
  const [crafHubModal, setCrafHubModal] = useState<{ open: boolean }>({ open: false });
  const [gteModal, setGteModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    title: string;
    desc: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, title: "", desc: "", onConfirm: async () => {} });
  const [deleting, setDeleting] = useState(false);
  // BLOCO 4 — drill-down do KPI Alertas
  const [alertasModal, setAlertasModal] = useState(false);

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
    await excluirDocumentoLogico(id);
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
    if (target === "alertas") {
      setAlertasModal(true);
      return;
    }
    if (target === "gte") {
      document.getElementById("arsenal-gte")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const sectionId =
      target === "crafs"
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
        numero_cad_sinarm: c.numero_cad_sinarm || null,
        numero_registro_sigma: c.numero_registro_sigma || null,
        sistema_registro: c.sistema_registro || null,
        arma_especie: (c as any).arma_especie || null,
        data_validade: c.data_validade,
        daysToExpire: daysUntil(c.data_validade),
        hasGte: !!gte,
        catalogo_id: c.catalogo_id || null,
        // CRAF é certificado da arma e NÃO prova sozinho que o registro é SINARM
        // de defesa pessoal — armas SIGMA/CAC também possuem CRAF/certificado.
        // Mantemos sistema/finalidade indefinidos até haver indício confiável
        // (campo explícito do CRAF, vínculo com GT/GTE, etc.).
        sistema: null,
        finalidade: null,
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
        // GT (guia de retirada/transporte inicial da loja) é histórica/informativa
        // e NÃO cria arma sozinha — fica vinculada à arma existente.
        const ehDocDeArma = ["craf", "sinarm", "gte", "autorizacao_compra", "outro"].includes(tipo);
        if (!ehDocDeArma || !normalizeDocWeaponName(d)) return false;
        // Regra de domínio: documento sem identificador físico (sem nº de
        // série e sem nº SIGMA/SINARM) NÃO cria arma automaticamente —
        // marca+modelo+calibre são insuficientes para uma unidade física.
        // Esses documentos aparecem na bancada como "sem vínculo" / revisão.
        const serial = String(d.arma_numero_serie || "").trim();
        const sigmaLike = ["craf", "sinarm"].includes(tipo)
          ? String(d.numero_documento || "").trim()
          : "";
        if (!serial && !sigmaLike) return false;
        return true;
      })
      .map((d: any) => {
        const nome = normalizeDocWeaponName(d);
        const tipoUpper = String(d.tipo_documento || "DOC").toUpperCase();
        const tipoLower = String(d.tipo_documento || "").toLowerCase();
        // Inferência conservadora de regime: somente documentos do acervo
        // SIGMA (GT/GTE/SIGMA) indicam CAC. CRAF/SINARM/autorização de compra
        // NÃO são prova suficiente de SINARM/Defesa Pessoal — deixamos
        // indefinido para não mascarar irregularidade de armas SIGMA com CRAF.
        const sistemaInferido =
          ["sigma", "gt", "gte"].includes(tipoLower) ? "SIGMA" : null;
        const finalidadeInferida = sistemaInferido === "SIGMA" ? "CAC" : null;
        return {
          id: `doc-${d.id}`,
          source: (tipoUpper === "GTE" ? "GTE" : "CRAF") as "CRAF" | "GTE",
          nome_arma: nome,
          numero_arma: d.arma_numero_serie || null,
          numero_sigma: ["craf", "sinarm"].includes(tipoLower) ? d.numero_documento || null : null,
        numero_cad_sinarm: (d as any).numero_cad_sinarm || null,
        numero_registro_sigma: (d as any).numero_registro_sigma || null,
        sistema_registro: (d as any).sistema_registro || null,
        arma_especie: (d as any).arma_especie || null,
          data_validade: d.data_validade,
          daysToExpire: daysUntil(d.data_validade),
          hasGte: false,
          catalogo_id: null as string | null,
          sistema: sistemaInferido,
          finalidade: finalidadeInferida,
          documentPreview: tipoUpper === "GTE" && d.arquivo_storage_path
            ? {
                bucket: "qa-documentos",
                storagePath: d.arquivo_storage_path,
                mime: d.arquivo_mime || null,
              }
            : null,
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
    const merged = [...fromCrafs, ...fromDocs];

    // ── Consolidação por ARMA FÍSICA ÚNICA ───────────────────────────────
    // Regra de domínio: KPI ARMAS conta arma física, NÃO documentos/origens.
    // Várias entradas (CRAF + doc OCR + GTE etc.) com mesma série/SIGMA/catálogo
    // colapsam em uma única arma. Preferimos a entrada com source "CRAF" e
    // mais campos preenchidos como representante.
    const keyOf = (w: any): string => {
      const serial = norm(w.numero_arma);
      const sigma = norm(w.numero_sigma);
      // arma_id explícito tem prioridade máxima como identidade física.
      if (w.arma_id) return `A:${w.arma_id}`;
      if (serial) return `S:${serial}`;
      if (sigma) return `G:${sigma}`;
      // Combinação forte: catálogo + série/SIGMA já é coberta acima por serial/sigma.
      // catalogo_id SOZINHO NÃO identifica unidade física (mesmo modelo pode ter
      // várias séries). Nunca fundir só por catálogo — manter como item separado
      // (revisão de vínculo físico).
      return `U:${w.source}-${w.id}`;
    };
    const score = (w: any) => {
      let s = 0;
      if (w.source === "CRAF") s += 4;
      if (w.numero_arma) s += 3;
      if (w.numero_sigma) s += 2;
      if (w.catalogo_id) s += 1;
      if (w.data_validade) s += 1;
      return s;
    };
    const consolidated = new Map<string, any>();
    for (const w of merged) {
      const k = keyOf(w);
      const prev = consolidated.get(k);
      if (!prev) { consolidated.set(k, w); continue; }
      // Mantém o representante de maior score; preserva campos não-nulos do outro.
      const winner = score(w) > score(prev) ? { ...prev, ...w } : { ...w, ...prev };
      // Reaproveita identificadores faltantes vindos do outro registro.
      winner.numero_arma = winner.numero_arma || prev.numero_arma || w.numero_arma;
      winner.numero_sigma = winner.numero_sigma || prev.numero_sigma || w.numero_sigma;
      winner.catalogo_id = winner.catalogo_id || prev.catalogo_id || w.catalogo_id;
      consolidated.set(k, winner);
    }
    return Array.from(consolidated.values());
  }, [crafs, gtes, meusDocs]);

  const weaponLinkState = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const docApproved = (d: any) => !["excluido", "excluido_lgpd", "reprovado", "invalidado"].includes(String(d?.status || "").toLowerCase());
    const byKey = (items: any[]) => {
      const map = new Map<string, any[]>();
      items.forEach((item) => {
        [normWeaponKey(item?.numero_arma), normWeaponKey(item?.numero_sigma)].forEach((k) => {
          if (!k) return;
          const arr = map.get(k) || [];
          arr.push(item);
          map.set(k, arr);
        });
      });
      return map;
    };
    const byCatalogo = (items: any[]) => {
      const map = new Map<string, any[]>();
      items.forEach((item) => {
        if (!item?.catalogo_id) return;
        const k = String(item.catalogo_id);
        const arr = map.get(k) || [];
        arr.push(item);
        map.set(k, arr);
      });
      return map;
    };
    const typedDocs = (tipo: "craf" | "gte" | "gt") => (meusDocs || [])
      .filter((d: any) => {
        const t = String(d?.tipo_documento || "").toLowerCase();
        if (!docApproved(d)) return false;
        if (tipo === "craf") return ["craf", "sinarm"].includes(t);
        if (tipo === "gte") return t === "gte";
        // GT (Guia de Tráfego de retirada/transporte inicial — informativa).
        return t === "gt";
      });
    const crafSources = [...(crafs || []), ...typedDocs("craf").map((d: any) => ({ ...d, numero_arma: d.arma_numero_serie, numero_sigma: d.numero_documento, __doc: true }))];
    const gteSources = [...(gtes || []), ...typedDocs("gte").map((d: any) => ({ ...d, numero_arma: d.arma_numero_serie, numero_sigma: null, __doc: true }))];
    const gtSources = [...typedDocs("gt").map((d: any) => ({ ...d, numero_arma: d.arma_numero_serie, numero_sigma: null, __doc: true }))];
    const crafByKey = byKey(crafSources);
    const gteByKey = byKey(gteSources);
    const gtByKey = byKey(gtSources);
    const crafByCatalogo = byCatalogo(crafSources);
    const gteByCatalogo = byCatalogo(gteSources);
    const gtByCatalogo = byCatalogo(gtSources);
    const weakDocs = (tipo: "craf" | "gte", w: WorkbenchWeapon) => {
      const wCat = w.catalogo_id ? catalogoById(w.catalogo_id) : null;
      const wInfo = buildWeaponInfo(w.nome_arma, w.numero_arma);
      const wMarcaModelo = `${wCat?.marca || wInfo.marca || ""} ${wCat?.modelo || wInfo.modelo || ""}`.replace(/\s+/g, " ").trim().toUpperCase();
      const wCal = normalizeCalibre(wCat?.calibre || wInfo.calibre);
      return typedDocs(tipo).filter((d: any) => {
        if (normWeaponKey(d.arma_numero_serie) || (tipo === "craf" && normWeaponKey(d.numero_documento))) return false;
        const modeloSeguro = isInvalidWeaponModel(d.arma_modelo) ? "" : String(d.arma_modelo || "").trim();
        const dMarcaModelo = `${d.arma_marca || ""} ${modeloSeguro}`.replace(/\s+/g, " ").trim().toUpperCase();
        const dCal = normalizeCalibre(d.arma_calibre);
        return !!wMarcaModelo && !!dMarcaModelo && wMarcaModelo === dMarcaModelo && (!wCal || !dCal || wCal === dCal);
      });
    };
    const statusFor = (matches: any[], valid: boolean, weak: boolean, activeLabel: "VÁLIDO" | "ATIVA"): { status: LinkedDocStatus; label: string } => {
      if (valid) return { status: activeLabel === "ATIVA" ? "ativo" : "valido", label: activeLabel };
      if (matches.length > 0) {
        const hasExpired = matches.some((m) => m?.data_validade && !isValidDateFromToday(m.data_validade, today));
        return hasExpired ? { status: "vencido", label: "VENCIDO" } : { status: "revisar", label: "REVISAR VÍNCULO" };
      }
      if (weak) return { status: "revisar", label: "REVISAR VÍNCULO" };
      return { status: "ausente", label: "AUSENTE" };
    };
    const out = new Map<string, WeaponLinkState>();
    weapons.forEach((w) => {
      const key = `${w.source}-${w.id}`;
      const keys = [normWeaponKey(w.numero_arma), normWeaponKey(w.numero_sigma)].filter(Boolean);
      const cat = w.catalogo_id ? String(w.catalogo_id) : null;
      const collect = (catalogMap: Map<string, any[]>, keyMap: Map<string, any[]>) => {
        const matches: any[] = [];
        if (cat) (catalogMap.get(cat) || []).forEach((x) => matches.push(x));
        keys.forEach((k) => (keyMap.get(k) || []).forEach((x) => { if (!matches.includes(x)) matches.push(x); }));
        return matches;
      };
      const crafMatches = collect(crafByCatalogo, crafByKey);
      const gteMatches = collect(gteByCatalogo, gteByKey);
      const gtMatches = collect(gtByCatalogo, gtByKey);
      const hasWeakCrafDoc = weakDocs("craf", w).length > 0;
      const hasWeakGteDoc = weakDocs("gte", w).length > 0;
      const crafValido = crafMatches.some((c) => isValidDateFromToday(c?.data_validade, today));
      const gteValida = gteMatches.some((g) => isValidDateFromToday(g?.data_validade, today));
      const craf = statusFor(crafMatches, crafValido, hasWeakCrafDoc, "VÁLIDO");
      const gte = statusFor(gteMatches, gteValida, hasWeakGteDoc, "ATIVA");
      // Declaração "não possuo mais a GT" — persistida em qa_arma_gt_declaracoes.
      const decl = gtDeclaracaoMap.get(weaponKeyOf(w));
      const gtDeclaradaNaoPossui = !!decl && decl.status === "nao_possuo";
      const gtDeclaradaEm = gtDeclaradaNaoPossui ? decl!.declarado_em : null;
      // Status da GT — sempre informativo, nunca crítico.
      let gtStatus: GtDocStatus;
      if (gtDeclaradaNaoPossui) gtStatus = "nao_possuo";
      else if (gtMatches.some((g) => {
        const s = String(g?.status || "").toLowerCase();
        return s === "aprovado" || s === "validado" || s === "concluido";
      })) gtStatus = "aprovada";
      else if (gtMatches.some((g) => {
        const s = String(g?.status || "").toLowerCase();
        return s === "pendente_aprovacao" || s === "em_analise" || s === "pendente";
      })) gtStatus = "em_analise";
      else if (gtMatches.length > 0) gtStatus = "enviada";
      else gtStatus = "nao_enviada";
      out.set(key, {
        crafMatches,
        gteMatches,
        gtMatches,
        crafStatus: craf.status,
        gteStatus: gte.status,
        crafLabel: craf.label,
        gteLabel: gte.label,
        crafValido,
        gteValida,
        gtStatus,
        gtDeclaradaNaoPossui,
        gtDeclaradaEm,
        semVinculo: keys.length === 0 && !cat,
        hasWeakCrafDoc,
        hasWeakGteDoc,
      });
    });
    return out;
  }, [weapons, crafs, gtes, meusDocs, catalogoById, clienteId, gtDeclaracaoMap]);

  const weaponsWithLinkedStatus: WorkbenchWeapon[] = useMemo(
    () => weapons.map((w) => {
      const link = weaponLinkState.get(`${w.source}-${w.id}`);
      const hasGteVinculada = !!(link?.gteMatches && link.gteMatches.length > 0);
      const hasGtVinculada = !!(link?.gtMatches && link.gtMatches.length > 0);
      const regime = getWeaponRegime(w as any, {
        hasGteVinculada,
        hasGtVinculada,
        numeroCadSinarm: (w as any).numero_cad_sinarm,
        numeroRegistroSigma: (w as any).numero_registro_sigma,
      });
      const gteExigivel = regime === "SIGMA";
      return {
        ...w,
        regime,
        hasCraf: !!link?.crafValido,
        hasGte: !!link?.gteValida,
        crafStatus: link?.crafStatus,
        gteStatus: link?.gteStatus,
        crafLabel: link?.crafLabel,
        gteLabel: regime === "SINARM" && !link?.gteValida
          ? "NÃO EXIGÍVEL"
          : regime === "REVISAR"
            ? "REVISAR REGIME"
            : link?.gteLabel,
        gteExigivel,
        gtStatus: link?.gtStatus,
        hasGt: !!(link?.gtMatches && link.gtMatches.length > 0),
        gtDeclaradaNaoPossui: !!link?.gtDeclaradaNaoPossui,
        gtDeclaradaEm: link?.gtDeclaradaEm ?? null,
        linkReview: !!(link?.hasWeakCrafDoc || link?.hasWeakGteDoc || link?.semVinculo),
      };
    }),
    [weapons, weaponLinkState],
  );

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
    const link = weaponLinkState.get(`${selected.source}-${selected.id}`);
    const out: { category: string; title: string; date: string | null; bucket?: string; path?: string | null; fileName?: string | null }[] = [];
    // Resolver arquivo original do CRAF: prioriza qa_crafs.arquivo_storage_path,
    // depois cai em qa_documentos_cliente vinculado (mesma série/SIGMA/número CRAF).
    const findDocFile = (matches: any[], match: any, kind: "craf" | "gte"): { path: string | null; fileName: string | null } => {
      const direct = match?.arquivo_storage_path || match?.storage_path;
      if (direct) return { path: direct, fileName: match?.arquivo_nome || match?.nome_original || null };
      const sib = (matches || []).find((m) => m?.__doc && m?.arquivo_storage_path);
      if (sib) return { path: sib.arquivo_storage_path, fileName: sib.arquivo_nome };
      // fallback: procurar em meusDocs por número de série / SIGMA / número CRAF
      const tipos = kind === "craf" ? ["craf", "sinarm"] : ["gte"];
      const serie = String(match?.numero_arma || "").replace(/\s+/g, "").toUpperCase();
      const sigma = String(match?.numero_sigma || "").replace(/\s+/g, "").toUpperCase();
      const numero = String(match?.nome_craf || match?.numero_gte || "").replace(/\s+/g, "").toUpperCase();
      const hit = (meusDocs || []).find((d: any) => {
        if (!tipos.includes(String(d?.tipo_documento || "").toLowerCase())) return false;
        if (!d?.arquivo_storage_path) return false;
        const ds = String(d?.arma_numero_serie || "").replace(/\s+/g, "").toUpperCase();
        const dn = String(d?.numero_documento || "").replace(/\s+/g, "").toUpperCase();
        return (serie && ds === serie) || (sigma && dn === sigma) || (numero && dn === numero);
      });
      if (hit) return { path: hit.arquivo_storage_path, fileName: hit.arquivo_nome };
      return { path: null, fileName: null };
    };
    (link?.crafMatches || []).forEach((c) => {
      const f = findDocFile(link?.crafMatches || [], c, "craf");
      const titulo = c.nome_arma
        || [c.arma_marca, c.arma_modelo].filter(Boolean).join(" ").trim()
        || c.nome_craf
        || (c.numero_documento ? `CRAF ${c.numero_documento}` : "CRAF vinculado");
      out.push({
        category: "CRAF",
        title: titulo,
        date: c.data_validade,
        bucket: "qa-documentos",
        path: f.path,
        fileName: f.fileName,
      });
    });
    (link?.gteMatches || []).forEach((g) => {
      const f = findDocFile(link?.gteMatches || [], g, "gte");
      const titulo = g.nome_arma
        || [g.arma_marca, g.arma_modelo].filter(Boolean).join(" ").trim()
        || g.nome_gte
        || (g.numero_documento ? `GTE ${g.numero_documento}` : "GTE vinculada");
      out.push({
        category: "GTE",
        title: titulo,
        date: g.data_validade,
        bucket: "qa-documentos",
        path: f.path,
        fileName: f.fileName,
      });
    });
    (link?.gtMatches || []).forEach((g: any) => out.push({
      category: "GT",
      title: g.arquivo_nome || "GT enviada (retirada/transporte inicial)",
      date: g.data_emissao || null,
      bucket: "qa-documentos",
      path: g.arquivo_storage_path || null,
      fileName: g.arquivo_nome || null,
    }));
    if (!link?.crafValido) out.push({ category: "CRAF", title: link?.hasWeakCrafDoc ? "Documento sem vínculo com arma — revisar vínculo do documento." : "CRAF ausente — regularizar documento da arma.", date: null });
    // GT — sempre informativa
    if (link?.gtDeclaradaNaoPossui) {
      out.push({ category: "GT", title: "Cliente declarou que não possui mais este documento.", date: null });
    } else if (!link?.gtMatches || link.gtMatches.length === 0) {
      out.push({ category: "GT", title: "GT não enviada — documento histórico de retirada/transporte (não bloqueia o cadastro).", date: null });
    }
    if (!link?.gteValida) {
      const gteExigivel = isGteExigivelParaArma(selected as any);
      if (!gteExigivel) {
        out.push({ category: "GTE", title: "GTE não exigível para esta arma (sem indício de acervo SIGMA/CAC).", date: null });
      } else {
        out.push({ category: "GTE", title: link?.hasWeakGteDoc ? "Documento sem vínculo com arma — revisar vínculo do documento." : "GTE ausente — regularizar vínculo/documento da arma.", date: null });
      }
    }
    return out;
  }, [selected, weaponLinkState]);

  const ammoSameCalibre = useMemo(() => {
    if (!selected) return 0;
    const cat = selected.catalogo_id ? catalogoById(selected.catalogo_id) : null;
    const info = buildWeaponInfo(selected.nome_arma, selected.numero_arma);
    const target = normalizeCalibre(cat?.calibre || info.calibre);
    if (!target) return 0;
    return ammo.byCalibre
      .filter((a) => normalizeCalibre(a.calibre) === target)
      .reduce((s, a) => s + a.quantidade, 0);
  }, [selected, ammo, catalogoById]);

  // Documentos enviados pelo cliente via Hub aguardando aprovação da equipe.
  // Quando existem, refletimos no KPI como "EM ANÁLISE" (âmbar) — em vez de
  // mostrar "SEM CR / SEM CRAFs / SEM GTE" cinza, que dava sensação de erro.
  const pendingDocs = useMemo(() => {
    const list = (meusDocs ?? []) as any[];
    const isPending = (d: any) => {
      const s = String(d?.status ?? "").toLowerCase();
      return s === "pendente_aprovacao" || s === "pendente" || s === "em_analise";
    };
    let cr = 0;
    let craf = 0;
    let gte = 0;
    for (const d of list) {
      if (!isPending(d)) continue;
      const t = String(d?.tipo_documento ?? "").toLowerCase();
      if (t === "cr") cr++;
      else if (t === "craf") craf++;
      else if (t === "gte" || t === "gt") gte++;
    }
    return { cr, craf, gte };
  }, [meusDocs]);

  const crStatus = (() => {
    if (!cadastroCr?.validade_cr) {
      if (pendingDocs.cr > 0) return { tone: "warn" as const, label: "EM ANÁLISE" };
      return { tone: "muted" as const, label: "SEM CR" };
    }
    const d = daysUntil(cadastroCr.validade_cr);
    const t = urgencyTone(d);
    if (t === "ok") return { tone: "ok" as const, label: "EM DIA" };
    if (t === "warn") return { tone: "warn" as const, label: "ATENÇÃO" };
    if (t === "danger") return { tone: "danger" as const, label: d! < 0 ? "VENCIDO" : "URGENTE" };
    return { tone: "muted" as const, label: "SEM DATA" };
  })();

  // ── BLOCO 1 — Leitura unificada (Regra-Mãe) para CR / CRAF / GTE ──────────
  // Camada incremental: usa apenas dados já carregados pela tela.
  // Se vier vazio, ArsenalSummary cai no fallback legacy automaticamente.
  const docsByTipo = useMemo(() => {
    const list = (meusDocs ?? []) as any[];
    const toLite = (d: any): DocumentoUploadLite => ({
      status: d?.status ?? null,
      ia_status: d?.ia_status ?? d?.status_ia ?? null,
      origem: d?.origem ?? null,
      data_validade: d?.data_validade ?? null,
    });
    const out: Record<string, DocumentoUploadLite[]> = { cr: [], craf: [], gte: [] };
    for (const d of list) {
      const t = String(d?.tipo_documento ?? "").toLowerCase();
      if (t === "cr") out.cr.push(toLite(d));
      else if (t === "craf") out.craf.push(toLite(d));
      else if (t === "gte" || t === "gt") out.gte.push(toLite(d));
    }
    return out;
  }, [meusDocs]);

  const crUnified = useMemo(
    () =>
      getStatusUnificado({
        tipo: "CR",
        cadastro: cadastroCr?.validade_cr ? { data_validade: cadastroCr.validade_cr } : null,
        documentos: docsByTipo.cr,
      }),
    [cadastroCr?.validade_cr, docsByTipo.cr],
  );

  const crafUnified = useMemo(() => {
    // Pega o CRAF de menor prioridade (mais crítico) entre os documentos.
    if (docsByTipo.craf.length === 0 && (crafs?.length ?? 0) === 0) return null;
    // Validade mais próxima entre os CRAFs do cliente (driver de vencido/vencendo).
    const validades = (crafs ?? [])
      .map((c: any) => c?.data_validade ?? c?.validade ?? null)
      .filter(Boolean) as (string | Date)[];
    const maisProxima = validades
      .map((v) => new Date(v as any))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return getStatusUnificado({
      tipo: "CRAF",
      cadastro: maisProxima ? { data_validade: maisProxima } : null,
      documentos: docsByTipo.craf,
    });
  }, [docsByTipo.craf, crafs]);

  const gteUnified = useMemo(() => {
    // gteDocs vem da tabela qa_gte_documentos; convertemos para DocumentoUploadLite.
    const docs: DocumentoUploadLite[] = (gteDocs || []).map((g) => ({
      status: null,
      ia_status: g.status_processamento ?? null,
      data_validade: g.data_validade ?? null,
    }));
    if (docs.length === 0 && docsByTipo.gte.length === 0) return null;
    // Validade mais próxima entre as GTEs (engine usa cadastro.data_validade).
    const validades = (gteDocs ?? [])
      .map((g) => g.data_validade)
      .filter(Boolean) as string[];
    const maisProxima = validades
      .map((v) => new Date(v))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return getStatusUnificado({
      tipo: "GTE",
      cadastro: maisProxima ? { data_validade: maisProxima } : null,
      documentos: [...docs, ...docsByTipo.gte],
    });
  }, [gteDocs, docsByTipo.gte]);

  // ── BLOCO 2 — KPIs adicionais (Linha 2 recolhível) ────────────────────────
  // Documentos genéricos (exclui CR/CRAF/GTE — já têm KPI próprio).
  const docsGenericos = useMemo<DocumentoUploadLite[]>(() => {
    const list = (meusDocs ?? []) as any[];
    return list
      .filter((d) => {
        const t = String(d?.tipo_documento ?? "").toLowerCase();
        return t && t !== "cr" && t !== "craf" && t !== "gte" && t !== "gt";
      })
      .map((d) => ({
        status: d?.status ?? null,
        ia_status: d?.ia_status ?? d?.status_ia ?? null,
        origem: d?.origem ?? null,
        data_validade: d?.data_validade ?? null,
      }));
  }, [meusDocs]);

  const documentosUnified = useMemo(() => {
    if (docsGenericos.length === 0) return null;
    return getStatusUnificado({ tipo: "DOCUMENTO_INDIVIDUAL", documentos: docsGenericos });
  }, [docsGenericos]);

  // Processos: usa apenas as solicitações reais de processo administrativo.
  // Filtra autorizações de compra (já têm KPI próprio).
  const solicitacoesProcessos = useMemo(
    () =>
      solicitacoes.filter((s) => {
        const slug = String(s.service_slug ?? "").toLowerCase();
        return !(slug.includes("autorizacao") && slug.includes("compra"));
      }),
    [solicitacoes],
  );

  const processosUnified = useMemo(() => {
    if (processos.length === 0 && solicitacoesProcessos.length === 0) return null;
    return getStatusUnificado({
      tipo: "PROCESSO_ADM",
      processos: processos.map((p) => ({ status: p.status })),
      solicitacoes: solicitacoesProcessos.map((s) => ({
        status_servico: s.status_servico,
        status_financeiro: s.status_financeiro,
        status_processo: null,
      })),
    });
  }, [processos, solicitacoesProcessos]);

  // Autorizações de compra (subset das solicitações).
  const autorizacoes = useMemo(
    () =>
      solicitacoes.filter((s) => {
        const slug = String(s.service_slug ?? "").toLowerCase();
        return slug.includes("autorizacao") && slug.includes("compra");
      }),
    [solicitacoes],
  );

  const autorizacoesUnified = useMemo(() => {
    if (autorizacoes.length === 0) return null;
    return getStatusUnificado({
      tipo: "AUTORIZACAO_COMPRA",
      solicitacoes: autorizacoes.map((s) => ({
        status_servico: s.status_servico,
        status_financeiro: s.status_financeiro,
        status_processo: null,
      })),
    });
  }, [autorizacoes]);

  // Exames / Laudos — engine usa cadastro.data_validade (mais próximo).
  const examesUnified = useMemo(() => {
    if (exames.length === 0) return null;
    const validades = exames
      .map((e) => e.data_vencimento)
      .filter(Boolean)
      .map((v) => new Date(v as string))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    const maisProxima = validades[0] ?? null;
    return getStatusUnificado({
      tipo: "EXAME_LAUDO",
      cadastro: maisProxima ? { data_validade: maisProxima } : null,
    });
  }, [exames]);

  // ── BLOCO 3 — Alertas Globais de Vencimento ───────────────────────────────
  // Consolida TODOS os prazos do cliente usando a engine já criada
  // (janelas 180/90/60/30/15/7/vencido + indeferido/inválido).
  // Não cria nova infra: lê `expDocs` (já calculado por ClienteOverview /
  // QAClientePortalPage), `processos` (com prazo crítico) e os KPIs já
  // unificados desta tela. Reduz para o pior status.
  const alertasUnified = useMemo<StatusUnificado | null>(() => {
    const itens: StatusUnificado[] = [];

    // 1) Cada item de validade vira um StatusUnificado por categoria.
    const catToTipo: Record<string, Parameters<typeof getStatusValidade>[1]> = {
      CR: "CR",
      CRAF: "CRAF",
      GTE: "GTE",
      EXAME: "EXAME_LAUDO",
      "EXAME PSICOLÓGICO": "EXAME_LAUDO",
      "EXAME DE TIRO": "EXAME_LAUDO",
      LAUDO: "EXAME_LAUDO",
      "FILIAÇÃO": "GENERICO",
      SERVIÇO: "GENERICO",
    };
    for (const d of expDocs ?? []) {
      if (!d?.date) continue;
      const tipo = catToTipo[String(d.category ?? "").toUpperCase()] ?? "GENERICO";
      itens.push(getStatusValidade(d.date, tipo));
    }

    // 2) Processos com prazo crítico (etapa_liberada_ate) entram como validade genérica.
    for (const p of processos ?? []) {
      const prazo = (p as any)?.etapa_liberada_ate ?? null;
      if (!prazo) continue;
      itens.push(getStatusValidade(prazo, "PROCESSO_ADM"));
    }

    // 3) Inclui leituras unificadas já feitas (capturam indeferido/inválido,
    //    não apenas data). Mantém pesos da engine.
    const incluir = [
      crUnified, crafUnified, gteUnified,
      documentosUnified, processosUnified, autorizacoesUnified, examesUnified,
    ].filter((s): s is StatusUnificado => !!s);
    itens.push(...incluir);

    // GTE/CRAF ausente, vencido ou sem vínculo confiável é alerta da ARMA,
    // não apenas detalhe interno do breakdown.
    weapons.forEach((w) => {
      const link = weaponLinkState.get(`${w.source}-${w.id}`);
      if (!link) return;
      const gteExigivel = isGteExigivelParaArma(w as any);
      if (gteExigivel && !link.gteValida) itens.push({ dimensao: "alerta", codigo: "documentos_incompletos", label: "GTE AUSENTE", cor: "vermelho", prioridade: 3, sub: "Regularizar vínculo/documento da arma" });
      if (!link.crafValido) itens.push({ dimensao: "alerta", codigo: "documentos_incompletos", label: "CRAF AUSENTE", cor: "vermelho", prioridade: 3, sub: "Revisar vínculo/documento da arma" });
      if (link.hasWeakCrafDoc || link.hasWeakGteDoc || link.semVinculo) itens.push({ dimensao: "alerta", codigo: "documentos_incompletos", label: "REVISAR VÍNCULO", cor: "laranja", prioridade: 4, sub: "Documento sem vínculo confiável com arma" });
    });

    // Filtra: só conta como ALERTA o que exige atenção real.
    // Estados "ok", "deferido", "documento_aprovado", "vencendo_180" (verde
    // "EM DIA"), "em_analise_orgao", "hub_reaproveitado" e "sem_dado" NÃO
    // geram alerta — KPI deve ficar neutro/cinza nesses casos.
    const ALERT_CODES = new Set([
      "indeferido",
      "vencido",
      "pagamento_falhou",
      "exigencia_pf",
      "iminente",
      "vencendo_15",
      "vencendo_30",
      "vencendo_60",
      "vencendo_90",
      "documentos_invalidos",
      "documentos_incompletos",
      "ia_falhou",
      "aguardando_pagamento",
      "aguardando_documentacao",
    ]);
    const alertas = itens.filter((s) => ALERT_CODES.has(s.codigo));
    if (alertas.length === 0) {
      // Sem alerta real: força neutro/cinza com "Tudo em dia",
      // mesmo que `alerts.length` legado seja > 0 (filtro <=90d cru).
      return {
        dimensao: "vazio",
        codigo: "sem_alerta",
        label: "TUDO EM DIA",
        cor: "cinza",
        prioridade: 10,
      } satisfies StatusUnificado;
    }
    return reduzirStatus(alertas);
  }, [
    expDocs, processos,
    crUnified, crafUnified, gteUnified,
    documentosUnified, processosUnified, autorizacoesUnified, examesUnified,
    weapons, weaponLinkState,
  ]);

  // BLOCO 4 — Lista detalhada de alertas (drill-down do KPI Alertas).
  // Reusa exatamente a mesma whitelist da consolidação acima, sem
  // recalcular nada. Cada item carrega título humano, tipo, status,
  // data de vencimento e dias restantes.
  const alertasDetalhados = useMemo<AlertaItem[]>(() => {
    const ALERT_CODES = new Set([
      "indeferido", "vencido", "pagamento_falhou", "exigencia_pf", "iminente",
      "vencendo_15", "vencendo_30", "vencendo_60", "vencendo_90",
      "documentos_invalidos", "documentos_incompletos", "ia_falhou",
      "aguardando_pagamento", "aguardando_documentacao",
    ]);
    const catToTipo: Record<string, Parameters<typeof getStatusValidade>[1]> = {
      CR: "CR", CRAF: "CRAF", GTE: "GTE",
      EXAME: "EXAME_LAUDO", "EXAME PSICOLÓGICO": "EXAME_LAUDO",
      "EXAME DE TIRO": "EXAME_LAUDO", LAUDO: "EXAME_LAUDO",
      "FILIAÇÃO": "GENERICO", SERVIÇO: "GENERICO",
    };
    const out: AlertaItem[] = [];

    // 1) Itens com data (expDocs) — driver mais comum de alerta.
    (expDocs ?? []).forEach((d, i) => {
      if (!d?.date) return;
      const cat = String(d.category ?? "").toUpperCase();
      const tipo = catToTipo[cat] ?? "GENERICO";
      const status = getStatusValidade(d.date, tipo);
      if (!ALERT_CODES.has(status.codigo)) return;
      out.push({
        id: `exp-${i}-${d.label}`,
        titulo: (d.label || cat || "ITEM").toUpperCase(),
        tipo: cat || "DOCUMENTO",
        status,
        dataVencimento: d.date,
        diasRestantes: d.days ?? null,
      });
    });

    // 2) Processos com prazo crítico (etapa_liberada_ate).
    (processos ?? []).forEach((p) => {
      const prazo = (p as any)?.etapa_liberada_ate ?? null;
      if (!prazo) return;
      const status = getStatusValidade(prazo, "PROCESSO_ADM");
      if (!ALERT_CODES.has(status.codigo)) return;
      out.push({
        id: `proc-${p.id}`,
        titulo: (p.servico_nome || "PROCESSO ADMINISTRATIVO").toUpperCase(),
        tipo: "PROCESSO",
        status,
        dataVencimento: typeof prazo === "string" ? prazo : null,
        diasRestantes: daysUntil(typeof prazo === "string" ? prazo : null),
      });
    });

    // 2.b) Exames / laudos — cada item individualmente (não estão em expDocs).
    (exames ?? []).forEach((e) => {
      const venc = e.data_vencimento;
      if (!venc) return;
      const status = getStatusValidade(venc, "EXAME_LAUDO");
      if (!ALERT_CODES.has(status.codigo)) return;
      const tipoExame = (e.tipo || "EXAME").toUpperCase();
      out.push({
        id: `exame-${e.id}`,
        titulo: tipoExame.includes("EXAME") ? tipoExame : `EXAME ${tipoExame}`,
        tipo: "EXAME",
        status,
        dataVencimento: venc,
        diasRestantes: daysUntil(venc),
      });
    });

    // 3) Estados não-data (indeferido/inválido/exigência/pagamento) já
    //    consolidados nos KPIs unificados.
    const unificadosLabel: { s: StatusUnificado | null; tipo: string; titulo: string }[] = [
      { s: crUnified, tipo: "CR", titulo: "CERTIFICADO DE REGISTRO (CR)" },
      { s: crafUnified, tipo: "CRAF", titulo: "REGISTRO DE ARMA (CRAF)" },
      { s: gteUnified, tipo: "GTE", titulo: "GUIA DE TRÁFEGO (GTE)" },
      { s: documentosUnified, tipo: "DOCUMENTO", titulo: "DOCUMENTOS GERAIS" },
      { s: processosUnified, tipo: "PROCESSO", titulo: "PROCESSOS EM ANDAMENTO" },
      { s: autorizacoesUnified, tipo: "AUTORIZAÇÃO", titulo: "AUTORIZAÇÕES DE COMPRA" },
      { s: examesUnified, tipo: "EXAME", titulo: "EXAMES E LAUDOS" },
    ];
    unificadosLabel.forEach(({ s, tipo, titulo }, i) => {
      if (!s || !ALERT_CODES.has(s.codigo)) return;
      // Evita duplicar com itens de expDocs (que já cobrem datas).
      // Mantém aqui apenas códigos não-data (decisão/exigência/financeiro/docs).
      const codigosDeData = new Set(["vencido", "iminente", "vencendo_15", "vencendo_30", "vencendo_60", "vencendo_90"]);
      if (codigosDeData.has(s.codigo)) return;
      out.push({
        id: `uni-${tipo}-${i}`,
        titulo,
        tipo,
        status: s,
        dataVencimento: null,
        diasRestantes: null,
      });
    });

    weapons.forEach((w) => {
      const link = weaponLinkState.get(`${w.source}-${w.id}`);
      if (!link) return;
      const nome = (w.nome_arma || "ARMA").toUpperCase();
      const gteExigivel = isGteExigivelParaArma(w as any);
      if (gteExigivel && !link.gteValida) out.push({
        id: `arma-gte-${w.source}-${w.id}`,
        titulo: `${nome} — GTE AUSENTE`,
        tipo: "ARMA/GTE",
        status: { dimensao: "alerta", codigo: "documentos_incompletos", label: "CRÍTICO", cor: "vermelho", prioridade: 3, sub: "Regularizar vínculo/documento da arma" },
        dataVencimento: null,
        diasRestantes: null,
      });
      if (!link.crafValido) out.push({
        id: `arma-craf-${w.source}-${w.id}`,
        titulo: `${nome} — CRAF AUSENTE/VÍNCULO`,
        tipo: "ARMA/CRAF",
        status: { dimensao: "alerta", codigo: "documentos_incompletos", label: "CRÍTICO", cor: "vermelho", prioridade: 3, sub: "Revisar vínculo/documento da arma" },
        dataVencimento: null,
        diasRestantes: null,
      });
      if (link.hasWeakCrafDoc || link.hasWeakGteDoc || link.semVinculo) out.push({
        id: `arma-vinculo-${w.source}-${w.id}`,
        titulo: `${nome} — DOCUMENTO SEM VÍNCULO COM ARMA`,
        tipo: "VÍNCULO",
        status: { dimensao: "alerta", codigo: "documentos_incompletos", label: "REVISAR", cor: "laranja", prioridade: 4, sub: "Revisar vínculo do documento" },
        dataVencimento: null,
        diasRestantes: null,
      });
    });

    return out;
  }, [
    expDocs, processos, exames,
    crUnified, crafUnified, gteUnified,
    documentosUnified, processosUnified, autorizacoesUnified, examesUnified,
    weapons, weaponLinkState,
  ]);

  // ── BLOCO CANÔNICO — useClienteStatusAgregado ─────────────────────────────
  // Integração incremental, não destrutiva. Se o hook trouxer dados, eles
  // sobrepõem os *Unified locais. Se vier vazio/erro, mantemos a leitura
  // legacy (Zero Regression).
  const { data: agregado } = useClienteStatusAgregado(clienteId);

  const corToCodigo = (cor: CorStatus): string => {
    if (cor === "verde") return "ok";
    if (cor === "vermelho") return "vencido";
    if (cor === "laranja") return "vencendo_30";
    if (cor === "amarelo") return "vencendo_60";
    if (cor === "azul") return "em_andamento";
    return "sem_dado";
  };
  const buildSU = (label: string, cor: CorStatus, sub?: string): StatusUnificado => ({
    dimensao: "alerta",
    codigo: corToCodigo(cor),
    label,
    sub,
    cor,
    prioridade: 5,
  });
  const subValidade = (k: KpiValidade): string | undefined => {
    if (k.total === 0) return undefined;
    const partes: string[] = [];
    if (k.vencidos) partes.push(`${k.vencidos} vencido${k.vencidos > 1 ? "s" : ""}`);
    if (k.vencendo) partes.push(`${k.vencendo} vencendo`);
    if (!partes.length && k.ok) partes.push(`${k.ok} em dia`);
    return partes.join(" · ");
  };

  const crUnifiedFinal: StatusUnificado | null = agregado?.kpis.cr.data_validade
    ? buildSU(
        (agregado.kpis.cr as KpiCR).label,
        agregado.kpis.cr.tone,
        agregado.kpis.cr.dias_restantes != null ? `${agregado.kpis.cr.dias_restantes} dias` : undefined,
      )
    : crUnified;
  const crafUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.crafs.total > 0
      ? buildSU("CRAFs", agregado.kpis.crafs.tone, subValidade(agregado.kpis.crafs))
      : crafUnified;
  const gteUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.gtes.total > 0
      ? buildSU("GTEs", agregado.kpis.gtes.tone, subValidade(agregado.kpis.gtes))
      : gteUnified;
  const documentosUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.documentos.total > 0
      ? buildSU(
          "DOCUMENTOS",
          agregado.kpis.documentos.tone,
          `${agregado.kpis.documentos.aprovados} aprov · ${agregado.kpis.documentos.pendentes} pend`,
        )
      : documentosUnified;
  const processosUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.processos.total > 0
      ? buildSU(
          "PROCESSOS",
          agregado.kpis.processos.tone,
          `${agregado.kpis.processos.deferidos} deferidos · ${agregado.kpis.processos.aguardando_documentos} aguard`,
        )
      : processosUnified;
  const autorizacoesUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.autorizacoes.total > 0
      ? buildSU("AUTORIZAÇÕES", agregado.kpis.autorizacoes.tone, subValidade(agregado.kpis.autorizacoes))
      : autorizacoesUnified;
  const examesUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.exames.total > 0
      ? buildSU("EXAMES", agregado.kpis.exames.tone, subValidade(agregado.kpis.exames))
      : examesUnified;
  const alertasUnifiedFinal: StatusUnificado | null =
    agregado && agregado.kpis.alertas.total > 0
      ? buildSU(
          agregado.kpis.alertas.criticos > 0 ? "ATENÇÃO CRÍTICA" : "ATENÇÃO",
          agregado.kpis.alertas.criticos > 0 ? "vermelho" : agregado.kpis.alertas.atencao > 0 ? "laranja" : "cinza",
          `${agregado.kpis.alertas.total} item${agregado.kpis.alertas.total > 1 ? "s" : ""}`,
        )
      : alertasUnified;
  const municoesUnifiedFinal: StatusUnificado | null = (() => {
    const m = agregado?.kpis.municoes;
    if (!m || m.total === 0) return null;
    const partes: string[] = [];
    if (m.vencidas) partes.push(`${m.vencidas} vencida${m.vencidas > 1 ? "s" : ""}`);
    if (m.vencendo) partes.push(`${m.vencendo} vencendo`);
    if (m.sem_data) partes.push(`${m.sem_data} sem data`);
    if (!partes.length && m.ok) partes.push(`${m.ok} em dia`);
    return buildSU("MUNIÇÕES", m.tone, partes.join(" · "));
  })();

  // ── F1B-1: Ordem manual dos grupos do Arsenal ─────────────────────────────
  const grupos = useArsenalGruposLayout(clienteId);
  const [organizandoGrupos, setOrganizandoGrupos] = useState(false);

  // ── Breakdown da KPI ARMAS — vínculo físico (nº de série / SIGMA) ────────
  // Regra de domínio: a ARMA é a entidade principal. Um CRAF só conta para
  // uma arma se houver MATCH FÍSICO (mesmo numero_arma OU numero_sigma) e
  // validade >= hoje. Idem para GTE. Documentos sem vínculo confiável não
  // tornam a arma "regular" — ficam como pendência (irregularidade).
  const armasBreakdown = useMemo(() => {
    let comCrafValido = 0;
    let comGteAtiva = 0;
    let comVencimento = 0;
    let comIrregularidade = 0;

    for (const w of weapons) {
      const link = weaponLinkState.get(`${w.source}-${w.id}`);
      const hasGteVinculada = !!(link?.gteMatches && link.gteMatches.length > 0);
      const hasGtVinculada = !!(link?.gtMatches && link.gtMatches.length > 0);
      const regime = getWeaponRegime(w as any, {
        hasGteVinculada,
        hasGtVinculada,
        numeroCadSinarm: (w as any).numero_cad_sinarm,
        numeroRegistroSigma: (w as any).numero_registro_sigma,
      });
      if (link?.crafValido) comCrafValido++;
      if (link?.gteValida) comGteAtiva++;

      // Vencimento próximo (<= 60d) ou vencido
      const dias = w.daysToExpire;
      const vencido = dias != null && dias < 0;
      const vencendo = dias != null && dias >= 0 && dias <= 60;
      if (vencendo) comVencimento++;

      // Irregularidade: vencido OU sem vínculo confiável OU sem CRAF válido
      // OU (regime SIGMA sem GTE ativa) OU regime REVISAR.
      const semVinculo = !!link?.semVinculo;
      const semCrafValido = !link?.crafValido;
      const gteExigivel = regime === "SIGMA";
      const semGteAtiva = gteExigivel && !link?.gteValida;
      const regimeRevisar = regime === "REVISAR";
      if (vencido || semVinculo || semCrafValido || semGteAtiva || regimeRevisar) comIrregularidade++;
    }

    const piorStatus: "ok" | "warn" | "danger" | "muted" =
      weapons.length === 0
        ? "muted"
        : comIrregularidade > 0
          ? "danger"
          : comVencimento > 0
            ? "warn"
            : "ok";

    return {
      total: weapons.length,
      comCrafValido,
      comGteAtiva,
      comVencimento,
      comIrregularidade,
      piorStatus,
    };
  }, [weapons, weaponLinkState]);

  // ── Calibres distintos NORMALIZADOS ──────────────────────────────────────
  // REGRA DE VÍNCULO:
  //   1) Calibre só conta se vier de ARMA FÍSICA CONSOLIDADA, OU
  //   2) de CRAF/GTE/munição/documento explicitamente VINCULADO a uma arma
  //      consolidada (mesma série, SIGMA/SINARM, arma_id ou catalogo_id).
  //   Documento órfão, OCR sem vínculo e munição sem arma NÃO entram na KPI
  //   principal — evita "calibre fantasma" (ex.: .40 que não existe).
  //
  //   Como CRAFs/docs vinculados normalmente compartilham o calibre da arma
  //   consolidada, esse conjunto também é dominado pelas armas — mas a regra
  //   garante rastreabilidade e diagnóstico.
  const totalCalibresNormalizados = useMemo(() => {
    const normKey = (s: any) =>
      String(s || "").replace(/\s+/g, "").toUpperCase().trim();
    // Conjunto de identificadores físicos das armas consolidadas.
    const physicalSerials = new Set<string>();
    const physicalSigmas = new Set<string>();
    const physicalCatalogIds = new Set<string>();
    const physicalArmaIds = new Set<string>();
    for (const w of weapons) {
      const s = normKey((w as any).numero_arma);
      const g = normKey((w as any).numero_sigma);
      const cat = (w as any).catalogo_id ? String((w as any).catalogo_id) : "";
      const aid = (w as any).arma_id ? String((w as any).arma_id) : "";
      if (s) physicalSerials.add(s);
      if (g) physicalSigmas.add(g);
      if (cat) physicalCatalogIds.add(cat);
      if (aid) physicalArmaIds.add(aid);
    }
    const isLinkedToWeapon = (item: any): boolean => {
      const s = normKey(item?.numero_arma ?? item?.arma_numero_serie);
      const g = normKey(item?.numero_sigma ?? item?.numero_documento);
      const cat = item?.catalogo_id ? String(item.catalogo_id) : "";
      const aid = item?.arma_id ? String(item.arma_id) : "";
      if (aid && physicalArmaIds.has(aid)) return true;
      if (s && (physicalSerials.has(s) || physicalSigmas.has(s))) return true;
      if (g && (physicalSigmas.has(g) || physicalSerials.has(g))) return true;
      // catálogo só vincula se houver também série/SIGMA conhecido — sozinho
      // não prova mesma unidade física (mesma regra do keyOf).
      if (cat && physicalCatalogIds.has(cat) && (s || g)) return true;
      return false;
    };

    // 1) Armas consolidadas (fonte primária e sempre rastreável).
    const fromArmas = new Set<string>();
    for (const w of weapons) {
      const cat = (w as any).catalogo_id ? catalogoById((w as any).catalogo_id) : null;
      const fromCatalog = normalizeCalibre(cat?.calibre);
      if (fromCatalog) { fromArmas.add(fromCatalog); continue; }
      const info = buildWeaponInfo(w.nome_arma, w.numero_arma);
      const c = normalizeCalibre(info.calibre);
      if (c) fromArmas.add(c);
    }

    // 2) CRAFs/GTEs/munições/docs — apenas se VINCULADOS.
    const fromCrafsVinculados = new Set<string>();
    const fromCrafsOrfaos = new Set<string>();
    for (const c of crafs as any[]) {
      const cat = c?.catalogo_id ? catalogoById(c.catalogo_id) : null;
      const k = normalizeCalibre(cat?.calibre || c?.calibre);
      if (!k) continue;
      if (isLinkedToWeapon(c)) fromCrafsVinculados.add(k);
      else fromCrafsOrfaos.add(k);
    }
    const fromGtesVinculados = new Set<string>();
    const fromGtesOrfaos = new Set<string>();
    for (const g of gtes as any[]) {
      const cat = g?.catalogo_id ? catalogoById(g.catalogo_id) : null;
      const k = normalizeCalibre(cat?.calibre || g?.calibre);
      if (!k) continue;
      if (isLinkedToWeapon(g)) fromGtesVinculados.add(k);
      else fromGtesOrfaos.add(k);
    }
    const fromDocsVinculados = new Set<string>();
    const fromDocsOrfaos = new Set<string>();
    for (const d of meusDocs as any[]) {
      const k = normalizeCalibre(d?.arma_calibre);
      if (!k) continue;
      if (isLinkedToWeapon(d)) fromDocsVinculados.add(k);
      else fromDocsOrfaos.add(k);
    }
    // Munições: comparar calibre normalizado com os calibres das armas.
    const fromMunicoesVinculadas = new Set<string>();
    const fromMunicoesOrfas = new Set<string>();
    for (const a of ammo.byCalibre) {
      const k = normalizeCalibre(a.calibre);
      if (!k) continue;
      if (fromArmas.has(k)) fromMunicoesVinculadas.add(k);
      else fromMunicoesOrfas.add(k);
    }

    // União final = armas + vinculados.
    const final = new Set<string>([
      ...fromArmas,
      ...fromCrafsVinculados,
      ...fromGtesVinculados,
      ...fromDocsVinculados,
      ...fromMunicoesVinculadas,
    ]);

    if (import.meta.env.DEV) {
      const j = (s: Set<string>) => Array.from(s).sort().join(", ") || "—";
      // eslint-disable-next-line no-console
      console.groupCollapsed(`[Arsenal] KPI CALIBRES — diagnóstico (${final.size})`);
      // eslint-disable-next-line no-console
      console.table({
        "1. Armas consolidadas": j(fromArmas),
        "2. CRAFs vinculados": j(fromCrafsVinculados),
        "3. GTEs vinculadas": j(fromGtesVinculados),
        "4. Munições vinculadas": j(fromMunicoesVinculadas),
        "5. Documentos vinculados": j(fromDocsVinculados),
        "— CRAFs órfãos (ignorados)": j(fromCrafsOrfaos),
        "— GTEs órfãs (ignoradas)": j(fromGtesOrfaos),
        "— Munições órfãs (ignoradas)": j(fromMunicoesOrfas),
        "— Docs órfãos (ignorados)": j(fromDocsOrfaos),
        "= Calibres CONTADOS na KPI": j(final),
      });
      if (final.size === 0 && weapons.length > 0) {
        // eslint-disable-next-line no-console
        console.warn("[Arsenal] KPI CALIBRES = 0 mas há armas — verifique se o calibre está parseável (catálogo/nome).");
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    return final.size;
  }, [weapons, ammo.byCalibre, crafs, gtes, meusDocs, catalogoById]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    grupos.reorder(String(active.id), String(over.id));
  };

  // Renderiza cada grupo isoladamente (mesmo conteúdo de antes, só envelopado).
  const renderGrupo = (id: ArsenalGroupId) => {
    switch (id) {
      case "proximos_vencimentos":
        return (
          <aside id="arsenal-situacao" className="scroll-mt-28">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              {(() => {
                const criticos = alertasDetalhados.filter((a) => a.status.cor === "vermelho").length;
                const preventivos = alertasDetalhados.filter((a) => a.status.cor === "laranja" || a.status.cor === "amarelo").length;
                const total = alertasDetalhados.length;
                const subtitulo = total === 0
                  ? "Tudo em dia"
                  : criticos > 0
                    ? "Ação imediata necessária"
                    : preventivos > 0
                      ? "Atenção preventiva"
                      : "Acompanhamento recomendado";
                const cor = total === 0
                  ? "text-emerald-600"
                  : criticos > 0
                    ? "text-red-600"
                    : "text-amber-600";
                return (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`h-3.5 w-3.5 ${cor}`} />
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                          Próximos Vencimentos
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${cor}`}>{subtitulo}</span>
                    </div>
                    {total === 0 ? (
                      <p className="text-[11px] text-slate-500">Nenhum vencimento próximo. Tudo em dia.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {alertasDetalhados.slice(0, 6).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate text-slate-700">
                              <span className="font-bold uppercase">{a.titulo}</span>
                              <span className="ml-1 text-[9px] uppercase tracking-wider text-slate-400">· {a.tipo}</span>
                            </span>
                            <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-600">
                              {a.diasRestantes === null
                                ? "—"
                                : a.diasRestantes < 0
                                  ? `Vencido há ${Math.abs(a.diasRestantes)}d`
                                  : a.diasRestantes === 0
                                    ? "Vence hoje"
                                    : `${a.diasRestantes}d`}
                            </span>
                          </div>
                        ))}
                        {alertasDetalhados.length > 6 && (
                          <p className="pt-1 text-[10px] text-slate-400">+{alertasDetalhados.length - 6} outros</p>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </aside>
        );
      case "circunscricao_pf":
        return (
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
        );
      case "bancada":
        return (
          <div id="arsenal-bancada" className="scroll-mt-28">
            <Workbench
              weapons={weaponsWithLinkedStatus}
              documents={benchDocs}
              ammoByCalibre={ammo.byCalibre}
              onSelectWeapon={(w) => setSelected(w)}
              headerAction={
                <button
                  type="button"
                  onClick={() => setCrafHubModal({ open: true })}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-amber-400/60 bg-amber-50 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 hover:bg-amber-100 transition"
                  title="Enviar documento — Hub Documental com IA"
                >
                  <Upload className="h-3.5 w-3.5" /> ENVIAR
                </button>
              }
            />
          </div>
        );
      case "craf":
        return (
          <div id="arsenal-craf" className="scroll-mt-28">
            <ArsenalCRAFControl clienteId={clienteId} origem={isAdmin ? "equipe" : "cliente"} />
          </div>
        );
      case "autorizacoes":
        return (
          <div id="arsenal-autorizacoes" className="scroll-mt-28">
            <ArsenalAutorizacoesControl clienteId={clienteId} origem={isAdmin ? "equipe" : "cliente"} />
          </div>
        );
      case "gte":
        return (
          <div id="arsenal-gte" className="scroll-mt-28">
            <ArsenalGTEControl clienteId={clienteId} origem={isAdmin ? "equipe" : "cliente"} />
          </div>
        );
      case "municoes":
        return (
          <div id="arsenal-municoes" className="scroll-mt-28">
            <MunicoesMovimentacoesManager clienteId={clienteId} onChange={setAmmo} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="qa-arsenal-z6 space-y-5">
      {/* Máscara visual Cockpit Z6 Light · Deck V29 — aplicada APENAS como skin
          cosmético sobre o layout existente do Arsenal Inteligente. Não altera
          estrutura, ordem, dados ou comportamento. Reflete os mesmos tokens
          usados no Resumo (ClienteResumoKanban). */}
      <style>{`
        .qa-arsenal-z6{--paper:#f3f3f2;--card:#ffffff;--ink:#111111;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;--amber:#d5a33d;--green:#278652;--red:#df2727;background:var(--paper);color:var(--ink);font-family:'Arial Narrow',Arial,sans-serif;padding:14px;border-radius:6px}
        .qa-arsenal-z6 :where(h1,h2,h3,h4){font-family:'Oswald','Arial Narrow',Arial,sans-serif !important;text-transform:uppercase;letter-spacing:.04em;color:var(--ink) !important}
        .qa-arsenal-z6 div.rounded-2xl.bg-white,
        .qa-arsenal-z6 div.rounded-xl.bg-white{position:relative;border-radius:3px !important;border:1px solid var(--line) !important;box-shadow:0 6px 14px rgba(17,17,17,.04) !important}
        .qa-arsenal-z6 div.rounded-2xl.bg-white::before,
        .qa-arsenal-z6 div.rounded-xl.bg-white::before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:4px;background:var(--bordo);border-radius:3px 3px 0 0;pointer-events:none;z-index:1}
        .qa-arsenal-z6 .font-mono{font-family:'Oswald','Arial Narrow',Arial,sans-serif !important;font-weight:900;letter-spacing:0}
        .qa-arsenal-z6 [class*="uppercase"][class*="tracking-"]{font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:.22em !important;color:var(--muted)}
      `}</style>
      {/* KPIs */}
      <ArsenalSummary
        totalArmas={weapons.length}
        totalMunicoes={ammo.total}
        totalCalibres={totalCalibresNormalizados}
        crStatus={crStatus.tone}
        crLabel={crStatus.label}
        totalCrafs={weapons.filter((w) => w.source === "CRAF").length}
        alerts={alertasDetalhados.length}
        alertasCriticos={alertasDetalhados.filter((a) => a.status.cor === "vermelho").length}
        alertasPreventivos={alertasDetalhados.filter((a) => a.status.cor === "laranja" || a.status.cor === "amarelo").length}
        totalGtes={gteKpi.total}
        gteStatus={gteKpi.statusVisual}
        gteHint={gteKpi.labelSecundaria}
        crafPending={pendingDocs.craf}
        gtePending={pendingDocs.gte}
        armasBreakdown={armasBreakdown}
        crUnified={crUnifiedFinal}
        crafUnified={crafUnifiedFinal}
        gteUnified={gteUnifiedFinal}
        alertasUnified={alertasUnifiedFinal}
        documentosUnified={documentosUnifiedFinal}
        processosUnified={processosUnifiedFinal}
        autorizacoesUnified={autorizacoesUnifiedFinal}
        examesUnified={examesUnifiedFinal}
        municoesUnified={municoesUnifiedFinal}
        municoesPorCalibre={ammo.byCalibre}
        municoesLotesSemData={agregado?.kpis.municoes?.sem_data ?? 0}
        documentosCount={docsGenericos.length}
        processosCount={processos.length + solicitacoesProcessos.length}
        autorizacoesCount={autorizacoes.length}
        examesCount={exames.length}
        examesDetalhados={exames}
        onNavigate={scrollToSection}
      />

      {/* F1B-1 — Toolbar para reordenar manualmente os grupos do Arsenal */}
      <ArsenalGruposToolbar
        editing={organizandoGrupos}
        saving={grupos.saving}
        onToggle={() => setOrganizandoGrupos((v) => !v)}
        onRestoreDefault={() => grupos.restoreDefault()}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={grupos.order} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {grupos.order.map((id, idx) => (
              <ArsenalGroupItem
                key={id}
                id={id}
                editing={organizandoGrupos}
                isFirst={idx === 0}
                isLast={idx === grupos.order.length - 1}
                onMoveUp={() => grupos.move(id, -1)}
                onMoveDown={() => grupos.move(id, 1)}
              >
                {renderGrupo(id)}
              </ArsenalGroupItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <WeaponDrawer
        open={!!selected}
        weapon={selected}
        relatedDocs={relatedDocs}
        ammoSameCalibre={ammoSameCalibre}
        onClose={() => setSelected(null)}
        clienteId={clienteId}
        onGtDeclaracaoChange={async () => {
          // Recarrega imediatamente; realtime também atualizará para outras abas/staff.
          const rows = await listGtDeclaracoes(clienteId);
          setGtDeclaracoes(rows);
        }}
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
      <CrafUploadIAModal
        open={crafUploadIA.open}
        onClose={() => setCrafUploadIA({ open: false })}
        onSaved={refreshArsenal}
        clienteId={clienteId}
      />
      {/* Hub Documental — mesma lógica de envio do Hub do cliente, agora disponível na Bancada */}
      <ClienteDocsHubModal
        open={crafHubModal.open}
        onClose={() => setCrafHubModal({ open: false })}
        customerId={null}
        qaClienteId={clienteId}
        mode="arsenal"
        onSaved={refreshArsenal}
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
      <AlertasDrillDownModal
        open={alertasModal}
        onClose={() => setAlertasModal(false)}
        alertas={alertasDetalhados}
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
