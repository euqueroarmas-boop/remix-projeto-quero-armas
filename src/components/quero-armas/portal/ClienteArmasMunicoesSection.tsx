import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Gauge,
  Image as ImageIcon,
  Info,
  Loader2,
  ShieldCheck,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isDocDeArma } from "@/lib/quero-armas/documentosDeArma";

type ClienteArma = {
  arma_uid: string | null;
  fonte: string | null;
  qa_cliente_id: number | null;
  sistema: string | null;
  tipo_arma: string | null;
  marca: string | null;
  modelo: string | null;
  calibre: string | null;
  numero_serie: string | null;
  numero_craf: string | null;
  numero_sinarm: string | null;
  numero_sigma: string | null;
  status_documental: string | null;
  needs_review: boolean | null;
};

type Craf = {
  id: number;
  catalogo_id?: string | null;
  nome_arma?: string | null;
  nome_craf?: string | null;
  numero_arma?: string | null;
  numero_cad_sinarm?: string | null;
  numero_registro_sigma?: string | null;
  numero_sigma?: string | null;
  sistema_registro?: string | null;
  arma_especie?: string | null;
  data_validade?: string | null;
  documento_origem_id?: string | null;
};

type DocumentoArma = {
  id: string;
  tipo_documento: string;
  status: string;
  arquivo_nome: string | null;
  arquivo_storage_path?: string | null;
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  arma_especie: string | null;
  arma_numero_serie: string | null;
  numero_documento: string | null;
  numero_cad_sinarm: string | null;
  numero_registro_sigma: string | null;
  sistema_registro: string | null;
  data_validade: string | null;
  created_at: string;
};

type CatalogoArma = {
  id: string;
  marca: string;
  modelo: string;
  apelido: string | null;
  tipo: string;
  calibre: string;
  capacidade_carregador: number | null;
  peso_gramas: number | null;
  comprimento_cano_mm: number | null;
  alcance_efetivo_m: number | null;
  velocidade_projetil_ms: number | null;
  origem: string | null;
  classificacao_legal: string | null;
  descricao: string | null;
  fonte_dados: string;
  fonte_url: string | null;
  imagem: string | null;
  imagens: string[] | null;
  manual_url: string | null;
  stat_alcance: number | null;
  stat_cadencia: number | null;
  stat_controle: number | null;
  stat_dano: number | null;
  stat_mobilidade: number | null;
  stat_precisao: number | null;
  status_revisao: string;
};

type ArmaView = {
  uid: string;
  marca: string;
  modelo: string;
  titulo: string;
  calibre: string;
  tipo: string;
  sistema: string;
  numeroSerie: string | null;
  numeroCraf: string | null;
  numeroSigma: string | null;
  numeroSinarm: string | null;
  dataValidade: string | null;
  origem: "craf" | "manual" | "documento";
  fonteDocumento: string | null;
  craf?: Craf | null;
  documento?: DocumentoArma | null;
  catalogo?: CatalogoArma | null;
};

type Props = {
  clienteId: number;
  meusDocs?: any[];
  crafs?: any[];
  onOpenDocumentos?: () => void;
};

type DossieTab = "resumo" | "ficha" | "tecnica" | "municoes" | "craf" | "fabricante" | "fontes";

const TX22_FABRICANTE = {
  fonteUrl: "https://www.taurususa.com/product/pistols/taurustx-22/taurustx-22/",
  item: "1-TX22141O",
  acao: "SAO (ação simples)",
  capacidade: "16 cartuchos",
  cano: "4,10 pol. / 104 mm",
  comprimento: "7,06 pol. / 179 mm",
  altura: "5,44 pol. / 138 mm",
  largura: "1,25 pol. / 32 mm",
  peso: "17,30 oz / 490 g descarregada",
  passoRaiamento: "1:16",
  miras: "Massa fixa com ponto branco e alça ajustável com ponto branco",
  trilho: "Trilho Picatinny",
  materiais: "Armação em polímero, ferrolho em alumínio e cano em aço-liga",
  segurancas: "Bloqueio do percussor, trava de gatilho e trava manual",
};

const BASE_NORMATIVA = [
  "Lei 10.826/2003",
  "Decreto 11.615/2023",
  "Decreto 12.345/2024",
  "IN DG/PF 201",
  "IN DG/PF 311",
];

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function norm(v: unknown): string {
  return clean(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function human(v: unknown, fallback = "Nao informado"): string {
  const s = clean(v);
  return s || fallback;
}

function formatDate(v: string | null | undefined): string {
  if (!v) return "Sem vencimento informado";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

function inferMarca(...parts: Array<string | null | undefined>): string {
  const source = norm(parts.filter(Boolean).join(" "));
  if (source.includes("TAURUS")) return "Taurus";
  if (source.includes("CBC")) return "CBC";
  if (source.includes("IMBEL")) return "IMBEL";
  return clean(parts.find((p) => clean(p)) || "") || "Marca nao identificada";
}

function inferCalibre(...parts: Array<string | null | undefined>): string {
  const source = norm(parts.filter(Boolean).join(" "));
  if (source.includes("22 LONG RIFLE") || source.includes("22LR") || source.includes("22 LR")) return ".22 LR";
  if (source.includes("9X19") || source.includes("9MM") || source.includes("9 MM")) return "9mm";
  if (source.includes("380")) return ".380 ACP";
  if (source.includes("12 GA") || source.includes("CAL 12")) return "Calibre 12";
  return clean(parts.find((p) => clean(p)) || "") || "Calibre nao identificado";
}

function inferModelo(...parts: Array<string | null | undefined>): string {
  const source = norm(parts.filter(Boolean).join(" "));
  if (source.includes("TX22")) return "TX22";
  if (source.includes("TS9")) return "TS9";
  const raw = clean(parts.find((p) => clean(p)) || "");
  return raw
    .replace(/FORJAS\s+TAURUS/gi, "")
    .replace(/TAURUS/gi, "")
    .replace(/\.?22\s*(LONG\s+RIFLE|LR)/gi, "")
    .trim() || "Modelo nao identificado";
}

function inferTipo(...parts: Array<string | null | undefined>): string {
  const source = norm(parts.filter(Boolean).join(" "));
  if (source.includes("PISTOLA") || source.includes("TX22") || source.includes("TS9")) return "Pistola";
  if (source.includes("REVOLVER")) return "Revolver";
  if (source.includes("ESPINGARDA")) return "Espingarda";
  if (source.includes("CARABINA")) return "Carabina";
  return clean(parts.find((p) => clean(p)) || "") || "Tipo nao identificado";
}

function matchCatalogo(arma: Partial<ArmaView>, craf: Craf | null, catalogo: CatalogoArma[]): CatalogoArma | null {
  if (craf?.catalogo_id) {
    const byId = catalogo.find((item) => item.id === craf.catalogo_id);
    if (byId) return byId;
  }
  const alvo = norm([arma.marca, arma.modelo, arma.calibre].join(" "));
  return catalogo.find((item) => {
    const itemNorm = norm([item.marca, item.modelo, item.apelido, item.calibre].join(" "));
    return norm(arma.modelo).length >= 3 && itemNorm.includes(norm(arma.modelo)) && (
      !arma.calibre || itemNorm.includes(norm(arma.calibre)) || alvo.includes(norm(item.calibre))
    );
  }) || null;
}

function energiaEstimativa(catalogo: CatalogoArma | null): string {
  if (!catalogo?.velocidade_projetil_ms) return "Nao informado";
  const calibre = norm(catalogo.calibre);
  const massaKg = calibre.includes("22") ? 0.00259 : null;
  if (!massaKg) return `${catalogo.velocidade_projetil_ms} m/s (energia depende da munição)`;
  const joules = Math.round((massaKg * catalogo.velocidade_projetil_ms ** 2) / 2);
  return `~${joules} J, variavel conforme munição`;
}

function isTx22(arma: ArmaView): boolean {
  return norm([arma.marca, arma.modelo, arma.calibre].join(" ")).includes("TAURUS TX22");
}

function StatBar({ label, value, icon: Icon }: { label: string; value: number | null | undefined; icon: typeof Zap }) {
  const safe = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
          <Icon className="h-3.5 w-3.5 text-slate-950" /> {label}
        </div>
        <span className="font-mono text-[12px] font-bold text-slate-900">{safe || "—"}</span>
      </div>
      <div className="mt-2 h-1.5 bg-slate-100">
        <div className="h-1.5 bg-slate-950" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function TabChip({ children, active = false, onClick }: { children: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center rounded-full border px-4 text-[10px] font-black uppercase tracking-[0.18em] ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-[13px] font-black leading-snug text-slate-950">{value}</div>
    </div>
  );
}

export default function ClienteArmasMunicoesSection({ clienteId, meusDocs = [], crafs = [], onOpenDocumentos }: Props) {
  const [loading, setLoading] = useState(true);
  const [armas, setArmas] = useState<ClienteArma[]>([]);
  const [docs, setDocs] = useState<DocumentoArma[]>([]);
  const [crafsDb, setCrafsDb] = useState<Craf[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoArma[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DossieTab>("resumo");
  const [tecnicaIndex, setTecnicaIndex] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setErro(null);
      try {
        const [armasRes, crafsRes, docsRes, catalogoRes] = await Promise.all([
          supabase.from("qa_cliente_armas" as any).select("*").eq("qa_cliente_id", clienteId),
          supabase.from("qa_crafs" as any).select("*").eq("cliente_id", clienteId),
          supabase
            .from("qa_documentos_cliente" as any)
            .select("id,tipo_documento,status,arquivo_nome,arquivo_storage_path,arma_marca,arma_modelo,arma_calibre,arma_especie,arma_numero_serie,numero_documento,numero_cad_sinarm,numero_registro_sigma,sistema_registro,data_validade,created_at")
            .eq("qa_cliente_id", clienteId)
            .neq("status", "excluido")
            .order("created_at", { ascending: false }),
          supabase
            .from("qa_armamentos_catalogo" as any)
            .select("*")
            .eq("ativo", true)
            .order("marca")
            .order("modelo"),
        ]);

        if (!alive) return;
        if (armasRes.error) throw armasRes.error;
        if (crafsRes.error) throw crafsRes.error;
        if (docsRes.error) throw docsRes.error;
        if (catalogoRes.error) throw catalogoRes.error;

        setArmas((armasRes.data as ClienteArma[]) ?? []);
        setCrafsDb((crafsRes.data as Craf[]) ?? []);
        setDocs((docsRes.data as DocumentoArma[]) ?? []);
        setCatalogo((catalogoRes.data as CatalogoArma[]) ?? []);
      } catch (e: any) {
        if (alive) setErro(e?.message || "Nao foi possivel carregar armas e munições.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [clienteId]);

  const armasView = useMemo<ArmaView[]>(() => {
    const crafList = (crafsDb.length ? crafsDb : (crafs as Craf[])).filter(Boolean);
    const docList = (docs.length ? docs : (meusDocs as DocumentoArma[])).filter((d) => isDocDeArma(d?.tipo_documento));

    const fromArmas = armas.map((arma, idx) => {
      const craf = crafList.find((c) =>
        (arma.numero_serie && c.numero_arma === arma.numero_serie) ||
        (arma.numero_sigma && c.numero_sigma === arma.numero_sigma) ||
        (arma.numero_craf && c.nome_craf === arma.numero_craf)
      ) || null;
      const documento = docList.find((d) =>
        (craf?.documento_origem_id && d.id === craf.documento_origem_id) ||
        (arma.numero_serie && d.arma_numero_serie === arma.numero_serie) ||
        (arma.numero_sigma && d.numero_registro_sigma === arma.numero_sigma)
      ) || null;
      const sourceName = [arma.marca, arma.modelo, craf?.nome_arma, documento?.arma_marca, documento?.arma_modelo].filter(Boolean).join(" ");
      const marca = inferMarca(arma.marca, documento?.arma_marca, craf?.nome_arma);
      const modelo = inferModelo(arma.modelo, documento?.arma_modelo, craf?.nome_arma, sourceName);
      const calibre = inferCalibre(arma.calibre, documento?.arma_calibre, craf?.nome_arma, sourceName);
      const tipo = inferTipo(arma.tipo_arma, documento?.arma_especie, craf?.arma_especie, modelo);
      const base: ArmaView = {
        uid: arma.arma_uid || `arma:${idx}`,
        marca,
        modelo,
        titulo: `${marca} ${modelo}`.trim(),
        calibre,
        tipo,
        sistema: human(arma.sistema || craf?.sistema_registro, "Sistema nao informado"),
        numeroSerie: arma.numero_serie || craf?.numero_arma || documento?.arma_numero_serie || null,
        numeroCraf: arma.numero_craf || craf?.nome_craf || documento?.numero_documento || null,
        numeroSigma: arma.numero_sigma || craf?.numero_sigma || craf?.numero_registro_sigma || documento?.numero_registro_sigma || null,
        numeroSinarm: arma.numero_sinarm || craf?.numero_cad_sinarm || documento?.numero_cad_sinarm || null,
        dataValidade: craf?.data_validade || documento?.data_validade || null,
        origem: arma.fonte === "manual" ? "manual" : "craf",
        fonteDocumento: documento?.arquivo_nome || craf?.nome_craf || null,
        craf,
        documento,
      };
      return { ...base, catalogo: matchCatalogo(base, craf, catalogo) };
    });

    const seen = new Set(fromArmas.map((a) => a.numeroSerie || a.numeroSigma || a.uid));
    const fromCrafs = crafList
      .filter((craf) => !seen.has(craf.numero_arma || craf.numero_sigma || `craf:${craf.id}`))
      .map((craf) => {
        const documento = docList.find((d) => d.id === craf.documento_origem_id) || null;
        const marca = inferMarca(documento?.arma_marca, craf.nome_arma);
        const modelo = inferModelo(documento?.arma_modelo, craf.nome_arma);
        const calibre = inferCalibre(documento?.arma_calibre, craf.nome_arma);
        const tipo = inferTipo(documento?.arma_especie, craf.arma_especie, craf.nome_arma);
        const base: ArmaView = {
          uid: `craf:${craf.id}`,
          marca,
          modelo,
          titulo: `${marca} ${modelo}`.trim(),
          calibre,
          tipo,
          sistema: human(craf.sistema_registro, "Sistema nao informado"),
          numeroSerie: craf.numero_arma || documento?.arma_numero_serie || null,
          numeroCraf: craf.nome_craf || documento?.numero_documento || null,
          numeroSigma: craf.numero_sigma || craf.numero_registro_sigma || documento?.numero_registro_sigma || null,
          numeroSinarm: craf.numero_cad_sinarm || documento?.numero_cad_sinarm || null,
          dataValidade: craf.data_validade || documento?.data_validade || null,
          origem: "craf",
          fonteDocumento: documento?.arquivo_nome || craf.nome_craf || null,
          craf,
          documento,
        };
        return { ...base, catalogo: matchCatalogo(base, craf, catalogo) };
      });

    const fromDocs = docList
      .filter((doc) => ![...seen].includes(doc.arma_numero_serie || doc.numero_registro_sigma || doc.id))
      .filter((doc) => doc.arma_marca || doc.arma_modelo || doc.arma_numero_serie || doc.tipo_documento === "craf")
      .map((doc) => {
        const marca = inferMarca(doc.arma_marca, doc.arquivo_nome);
        const modelo = inferModelo(doc.arma_modelo, doc.arquivo_nome);
        const calibre = inferCalibre(doc.arma_calibre, doc.arquivo_nome);
        const tipo = inferTipo(doc.arma_especie, doc.arquivo_nome);
        const base: ArmaView = {
          uid: `doc:${doc.id}`,
          marca,
          modelo,
          titulo: `${marca} ${modelo}`.trim(),
          calibre,
          tipo,
          sistema: human(doc.sistema_registro, "Sistema nao informado"),
          numeroSerie: doc.arma_numero_serie || null,
          numeroCraf: doc.numero_documento || null,
          numeroSigma: doc.numero_registro_sigma || null,
          numeroSinarm: doc.numero_cad_sinarm || null,
          dataValidade: doc.data_validade || null,
          origem: "documento",
          fonteDocumento: doc.arquivo_nome || null,
          documento: doc,
        };
        return { ...base, catalogo: matchCatalogo(base, null, catalogo) };
      });

    return [...fromArmas, ...fromCrafs, ...fromDocs];
  }, [armas, catalogo, crafs, crafsDb, docs, meusDocs]);

  useEffect(() => {
    if (!selectedUid && armasView[0]?.uid) setSelectedUid(armasView[0].uid);
  }, [armasView, selectedUid]);

  useEffect(() => {
    setTecnicaIndex(0);
  }, [selectedUid]);

  const selected = armasView.find((a) => a.uid === selectedUid) || armasView[0] || null;
  const fotos = selected?.catalogo ? [selected.catalogo.imagem, ...(selected.catalogo.imagens || [])].filter(Boolean) as string[] : [];
  const fabricante = selected && isTx22(selected) ? TX22_FABRICANTE : null;
  const tecnicaCarousel = [
    { label: "Ação", value: fabricante?.acao || "Nao informado" },
    { label: "Raiamento", value: fabricante?.passoRaiamento || "Nao informado" },
    { label: "Miras", value: fabricante?.miras || "Nao informado" },
    { label: "Trilho", value: fabricante?.trilho || "Nao informado" },
    { label: "Materiais", value: fabricante?.materiais || "Nao informado" },
    { label: "Segurança", value: fabricante?.segurancas || "Nao informado" },
  ];
  const tecnicaAtual = tecnicaCarousel[tecnicaIndex] || tecnicaCarousel[0];
  const municoes = selected?.calibre === ".22 LR"
    ? [".22 LR", ".22 Long Rifle"]
    : selected?.calibre
      ? [selected.calibre]
      : ["Nao identificado"];
  const tabs: Array<{ id: DossieTab; label: string }> = [
    { id: "resumo", label: "Resumo" },
    { id: "ficha", label: "Ficha" },
    { id: "tecnica", label: "Tecnica" },
    { id: "municoes", label: "Municoes" },
    { id: "craf", label: "CRAF" },
    { id: "fabricante", label: "Fabricante" },
    { id: "fontes", label: "Fontes" },
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-950" />
        <p className="mt-3 text-sm font-semibold">Carregando armas pelo Hub de Documentos...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-white p-6 text-slate-950">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
          <AlertTriangle className="h-4 w-4" /> Armas e Munições
        </div>
        <p className="mt-2 text-sm">{erro}</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Target className="mx-auto h-9 w-9 text-slate-400" />
        <h2 className="mt-4 text-2xl font-black text-slate-950">Nenhuma arma encontrada no Hub de Documentos</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Anexe o CRAF na seção Documentos. Depois da leitura, a arma aparece aqui com identificação,
          ficha técnica, fotos e munições compatíveis.
        </p>
        {onOpenDocumentos && (
          <Button onClick={onOpenDocumentos} className="mt-5 bg-slate-950 text-white hover:bg-slate-800">
            <Upload className="mr-2 h-4 w-4" /> Abrir Documentos
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-950">Armas e Munições</div>
          <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{selected.titulo}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Dados consolidados a partir do CRAF e dos documentos anexados pelo cliente no Hub de Documentos,
            complementados pelo catálogo técnico e pela fonte do fabricante quando disponível.
          </p>
        </div>
      </div>

      {armasView.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {armasView.map((arma) => (
            <button
              key={arma.uid}
              type="button"
              onClick={() => setSelectedUid(arma.uid)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-bold ${
                arma.uid === selected.uid
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-950"
              }`}
            >
              {arma.titulo}
            </button>
          ))}
        </div>
      )}

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <div className="h-[720px]">
          <div className="relative h-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(0deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <div className="relative flex h-full items-center justify-center px-6 pb-24 pt-12">
              {fotos[0] ? (
                <img src={fotos[0]} alt={selected.titulo} className="max-h-[560px] w-full object-contain drop-shadow-2xl" />
              ) : (
                <div className="text-center text-slate-500">
                  <ImageIcon className="mx-auto h-12 w-12" />
                  <p className="mt-3 text-sm font-semibold">Foto pendente no catalogo tecnico</p>
                </div>
              )}
            </div>

            <div className="absolute left-7 top-7 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-950">
              {selected.tipo}
            </div>

            <div className="absolute bottom-5 left-7 right-7 grid grid-cols-7 gap-2">
              {fotos.length ? fotos.slice(0, 7).map((src, idx) => (
                <div key={`${src}-${idx}`} className={`h-14 border bg-white p-1 ${idx === 0 ? "border-slate-950" : "border-slate-200"}`}>
                  <img src={src} alt={`${selected.titulo} foto ${idx + 1}`} className="h-full w-full object-contain" />
                </div>
              )) : (
                <div className="col-span-7 border border-dashed border-slate-300 bg-white p-4 text-center text-[12px] text-slate-500">
                  Sem fotos aprovadas para esta arma.
                </div>
              )}
            </div>
          </div>

        </div>

        <aside className="flex h-[720px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="shrink-0 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <TabChip key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </TabChip>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {activeTab === "resumo" && (
            <div className="mt-6 space-y-5">
              <div className="border-b border-slate-200 pb-4">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Dossie do armamento</div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                  Visão consolidada da arma encontrada no Hub de Documentos, cruzando documento anexado,
                  catalogo tecnico e fonte do fabricante quando houver correspondencia.
                </p>
              </div>
              <div className="grid gap-2">
                <StatBar label="Dano" value={selected.catalogo?.stat_dano} icon={Zap} />
                <StatBar label="Precisao" value={selected.catalogo?.stat_precisao} icon={Target} />
                <StatBar label="Controle" value={selected.catalogo?.stat_controle} icon={ShieldCheck} />
                <StatBar label="Mobilidade" value={selected.catalogo?.stat_mobilidade} icon={Gauge} />
              </div>
              <div className="border border-slate-200 bg-slate-50 p-4 text-[12px] leading-relaxed text-slate-700">
                A leitura segue a base normativa exibida no topo da tela e separa dados cadastrais,
                dados tecnicos, munições e registro para evitar duplicidade entre as guias.
              </div>
            </div>
          )}

          {activeTab === "ficha" && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Identificação comercial</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FieldBox label="Fabricante" value={selected.marca} />
                  <FieldBox label="Modelo" value={selected.modelo} />
                  <FieldBox label="Tipo" value={selected.tipo} />
                  <FieldBox label="Calibre nominal" value={selected.calibre} />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Classificação do catalogo</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FieldBox label="Apelido" value={selected.catalogo?.apelido || "Nao informado"} />
                  <FieldBox label="Origem" value={selected.catalogo?.origem || "Nao informado"} />
                  <FieldBox label="Classe legal" value={selected.catalogo?.classificacao_legal || "Nao informado"} />
                  <FieldBox label="Revisão" value={selected.catalogo?.status_revisao || "Pendente"} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "tecnica" && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Características tecnicas</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FieldBox label="Capacidade" value={selected.catalogo?.capacidade_carregador ? `${selected.catalogo.capacidade_carregador} cartuchos` : fabricante?.capacidade || "Nao informado"} />
                  <FieldBox label="Peso" value={selected.catalogo?.peso_gramas ? `${selected.catalogo.peso_gramas} g` : fabricante?.peso || "Nao informado"} />
                  <FieldBox label="Cano" value={selected.catalogo?.comprimento_cano_mm ? `${selected.catalogo.comprimento_cano_mm} mm` : fabricante?.cano || "Nao informado"} />
                  <FieldBox label="Comprimento" value={fabricante?.comprimento || "Nao informado"} />
                  <FieldBox label="Altura" value={fabricante?.altura || "Nao informado"} />
                  <FieldBox label="Largura" value={fabricante?.largura || "Nao informado"} />
                  <FieldBox label="Velocidade" value={selected.catalogo?.velocidade_projetil_ms ? `${selected.catalogo.velocidade_projetil_ms} m/s` : "Nao informado"} />
                  <FieldBox label="Energia" value={energiaEstimativa(selected.catalogo || null)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Carrossel tecnico</div>
                  <div className="font-mono text-[11px] font-black text-slate-500">
                    {String(tecnicaIndex + 1).padStart(2, "0")} / {String(tecnicaCarousel.length).padStart(2, "0")}
                  </div>
                </div>

                <div className="mt-3 border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{tecnicaAtual.label}</div>
                      <div className="mt-3 min-h-[64px] text-xl font-black leading-tight text-slate-950">
                        {tecnicaAtual.value}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setTecnicaIndex((idx) => (idx - 1 + tecnicaCarousel.length) % tecnicaCarousel.length)}
                        className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-950 hover:border-slate-950"
                        aria-label="Tecnica anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTecnicaIndex((idx) => (idx + 1) % tecnicaCarousel.length)}
                        className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-950 hover:border-slate-950"
                        aria-label="Proxima tecnica"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-6 gap-2">
                    {tecnicaCarousel.map((item, idx) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setTecnicaIndex(idx)}
                        className={`h-1.5 ${idx === tecnicaIndex ? "bg-slate-950" : "bg-slate-300"}`}
                        aria-label={`Ver ${item.label}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "municoes" && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Munições compatíveis</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {municoes.map((m) => (
                    <span key={m} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-black text-slate-950">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldBox label="Calibre base" value={selected.calibre} />
                <FieldBox label="Alcance efetivo" value={selected.catalogo?.alcance_efetivo_m ? `${selected.catalogo.alcance_efetivo_m} m` : "Nao informado"} />
                <FieldBox label="Energia estimada" value={energiaEstimativa(selected.catalogo || null)} />
                <FieldBox label="Observação" value="Valores variam conforme munição, lote e fabricante." />
              </div>
            </div>
          )}

          {activeTab === "craf" && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Registro documental</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FieldBox label="Numero de serie" value={selected.numeroSerie || "Nao informado"} />
                  <FieldBox label="CRAF" value={selected.numeroCraf || "Nao informado"} />
                  <FieldBox label="SIGMA" value={selected.numeroSigma || "Nao informado"} />
                  <FieldBox label="SINARM/CAD" value={selected.numeroSinarm || "Nao informado"} />
                  <FieldBox label="Sistema" value={selected.sistema} />
                  <FieldBox label="Validade" value={formatDate(selected.dataValidade)} />
                </div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-950">Origem do dossie</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FieldBox label="Fonte principal" value={selected.origem === "craf" ? "CRAF" : selected.origem === "manual" ? "Manual" : "Documento"} />
                  <FieldBox label="Arquivo" value={selected.fonteDocumento || "Hub de Documentos"} />
                  <FieldBox label="Catalogo" value={selected.catalogo?.fonte_dados || "Nao informado"} />
                  <FieldBox label="ID CRAF" value={selected.craf?.id ? String(selected.craf.id) : "Nao informado"} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "fabricante" && (
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-950">
                <BadgeCheck className="h-4 w-4" /> Dados expostos pelo fabricante
              </div>
              {fabricante ? (
                <div className="grid gap-2 text-[12px] leading-relaxed text-slate-700 md:grid-cols-2">
                  <FieldBox label="Item do fabricante" value={fabricante.item} />
                  <FieldBox label="Miras" value={fabricante.miras} />
                  <FieldBox label="Trilho" value={fabricante.trilho} />
                  <FieldBox label="Materiais" value={fabricante.materiais} />
                  <FieldBox label="Seguranças" value={fabricante.segurancas} />
                  <FieldBox label="Fonte" value="Taurus USA - TaurusTX 22" />
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-slate-600">
                  Dados do fabricante ainda nao vinculados para este modelo. A tela exibe o que foi identificado no CRAF,
                  no Hub de Documentos e no catalogo tecnico.
                </p>
              )}
              {selected.catalogo?.status_revisao !== "verificado" && (
                <div className="flex items-start gap-2 border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-950" />
                  <span>Ficha tecnica do catalogo marcada como revisao pendente. Exibir com auditoria da equipe.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "fontes" && (
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-950">
                <BookOpen className="h-4 w-4" /> Fontes do dossie
              </div>
              <div className="space-y-3 text-[12px] text-slate-700">
                <div className="border border-slate-200 bg-slate-50 p-3">
                  <div className="font-black text-slate-950">Documento do cliente</div>
                  <div>{selected.fonteDocumento || "Hub de Documentos"}</div>
                </div>
                {fabricante?.fonteUrl && (
                  <div className="border border-slate-200 bg-slate-50 p-3">
                    <div className="font-black text-slate-950">Fabricante</div>
                    <a className="break-all text-slate-950 underline" href={fabricante.fonteUrl} target="_blank" rel="noreferrer">
                      Taurus USA - TaurusTX 22
                    </a>
                  </div>
                )}
                {selected.catalogo?.fonte_url && (
                  <div className="border border-slate-200 bg-slate-50 p-3">
                    <div className="font-black text-slate-950">Catalogo tecnico</div>
                    <a className="break-all text-slate-950 underline" href={selected.catalogo.fonte_url} target="_blank" rel="noreferrer">
                      Fonte cadastrada
                    </a>
                  </div>
                )}
                <div className="border border-slate-200 bg-slate-50 p-3">
                  <div className="font-black text-slate-950">Base normativa</div>
                  <div>{BASE_NORMATIVA.join(" · ")}</div>
                </div>
              </div>
            </div>
          )}
          </div>
        </aside>
      </div>

    </section>
  );
}
