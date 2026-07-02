import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Camera,
  Crosshair,
  Gauge,
  Image as ImageIcon,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
          <Icon className="h-3.5 w-3.5 text-[#7A1F2B]" /> {label}
        </div>
        <span className="font-mono text-[12px] font-bold text-slate-900">{safe || "—"}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-[#7A1F2B]" style={{ width: `${safe}%` }} />
      </div>
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

  const selected = armasView.find((a) => a.uid === selectedUid) || armasView[0] || null;
  const fotos = selected?.catalogo ? [selected.catalogo.imagem, ...(selected.catalogo.imagens || [])].filter(Boolean) as string[] : [];
  const fabricante = selected && isTx22(selected) ? TX22_FABRICANTE : null;
  const municoes = selected?.calibre === ".22 LR"
    ? [".22 LR", ".22 Long Rifle"]
    : selected?.calibre
      ? [selected.calibre]
      : ["Nao identificado"];

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#7A1F2B]" />
        <p className="mt-3 text-sm font-semibold">Carregando armas pelo Hub de Documentos...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
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
          <Button onClick={onOpenDocumentos} className="mt-5 bg-[#7A1F2B] text-white hover:bg-[#641722]">
            <Upload className="mr-2 h-4 w-4" /> Abrir Documentos
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">Armas e Munições</div>
          <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{selected.titulo}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Arma puxada dos documentos anexados pelo cliente no Hub de Documentos, com prioridade para CRAF,
            dados técnicos do catálogo e fonte do fabricante quando disponível.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Base normativa</div>
          <div className="mt-1 text-[12px] font-semibold text-slate-800">{BASE_NORMATIVA.join(" · ")}</div>
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
                  ? "border-[#7A1F2B] bg-[#7A1F2B] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#7A1F2B]/50"
              }`}
            >
              {arma.titulo}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-h-[420px] md:grid-cols-[1fr_0.92fr]">
            <div className="relative flex min-h-[320px] items-center justify-center bg-slate-950 p-6">
              {fotos[0] ? (
                <img src={fotos[0]} alt={selected.titulo} className="max-h-[360px] w-full object-contain drop-shadow-2xl" />
              ) : (
                <div className="text-center text-white/70">
                  <ImageIcon className="mx-auto h-12 w-12" />
                  <p className="mt-3 text-sm font-semibold">Foto pendente no catálogo técnico</p>
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                {selected.tipo}
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Identificação do CRAF</div>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{selected.titulo}</h2>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  {selected.origem === "craf" ? "CRAF" : selected.origem === "manual" ? "Manual" : "Documento"}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Calibre", selected.calibre],
                  ["Sistema", selected.sistema],
                  ["No. serie", selected.numeroSerie || "Nao informado"],
                  ["No. CRAF", selected.numeroCraf || "Nao informado"],
                  ["SIGMA", selected.numeroSigma || "Nao informado"],
                  ["SINARM/CAD", selected.numeroSinarm || "Nao informado"],
                  ["Validade", formatDate(selected.dataValidade)],
                  ["Fonte", selected.fonteDocumento || "Hub de Documentos"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                    <div className="mt-1 break-words text-[13px] font-bold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>

              {selected.catalogo?.status_revisao !== "verificado" && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Ficha técnica do catálogo ainda marcada como revisão pendente. Exibir, mas manter auditoria da equipe.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">
              <BadgeCheck className="h-4 w-4" /> Dados técnicos
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Capacidade", selected.catalogo?.capacidade_carregador ? `${selected.catalogo.capacidade_carregador} cartuchos` : fabricante?.capacidade || "Nao informado"],
                ["Peso", selected.catalogo?.peso_gramas ? `${selected.catalogo.peso_gramas} g` : fabricante?.peso || "Nao informado"],
                ["Cano", selected.catalogo?.comprimento_cano_mm ? `${selected.catalogo.comprimento_cano_mm} mm` : fabricante?.cano || "Nao informado"],
                ["Alcance", selected.catalogo?.alcance_efetivo_m ? `${selected.catalogo.alcance_efetivo_m} m` : "Nao informado"],
                ["Velocidade", selected.catalogo?.velocidade_projetil_ms ? `${selected.catalogo.velocidade_projetil_ms} m/s` : "Nao informado"],
                ["Potencia/energia", energiaEstimativa(selected.catalogo || null)],
                ["Ação", fabricante?.acao || "Nao informado"],
                ["Raiamento", fabricante?.passoRaiamento || "Nao informado"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                  <div className="mt-1 text-[13px] font-bold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
            {fabricante && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-[12px] text-slate-700">
                <div className="font-bold text-slate-900">Fabricante informa ainda:</div>
                <div className="mt-1 leading-relaxed">
                  item {fabricante.item}; {fabricante.miras}; {fabricante.trilho}; {fabricante.materiais}; seguranças:
                  {" "}{fabricante.segurancas}.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">
              <Gauge className="h-4 w-4" /> Performance comparativa
            </div>
            <div className="mt-4 grid gap-3">
              <StatBar label="Dano" value={selected.catalogo?.stat_dano} icon={Zap} />
              <StatBar label="Precisao" value={selected.catalogo?.stat_precisao} icon={Target} />
              <StatBar label="Alcance" value={selected.catalogo?.stat_alcance} icon={Crosshair} />
              <StatBar label="Cadencia" value={selected.catalogo?.stat_cadencia} icon={Gauge} />
              <StatBar label="Controle" value={selected.catalogo?.stat_controle} icon={ShieldCheck} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">
            <Sparkles className="h-4 w-4" /> Munições compatíveis
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {municoes.map((m) => (
              <span key={m} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-bold text-slate-800">
                {m}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
            Compatibilidade exibida a partir do CRAF/catálogo. A escolha e aquisição de munições deve seguir a legislação vigente,
            limites aplicáveis e documentação do acervo.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">
            <Camera className="h-4 w-4" /> Fotos
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {fotos.length ? fotos.slice(0, 6).map((src) => (
              <div key={src} className="aspect-square rounded-lg border border-slate-200 bg-slate-50 p-1">
                <img src={src} alt={selected.titulo} className="h-full w-full rounded-md object-contain" />
              </div>
            )) : (
              <div className="col-span-3 rounded-lg border border-dashed border-slate-300 p-4 text-center text-[12px] text-slate-500">
                Sem fotos aprovadas para esta arma.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7A1F2B]">
            <BookOpen className="h-4 w-4" /> Fontes
          </div>
          <div className="mt-4 space-y-3 text-[12px] text-slate-700">
            <div>
              <div className="font-bold text-slate-900">Documento do cliente</div>
              <div>{selected.fonteDocumento || "Hub de Documentos"}</div>
            </div>
            {fabricante?.fonteUrl && (
              <div>
                <div className="font-bold text-slate-900">Fabricante</div>
                <a className="break-all text-[#7A1F2B] underline" href={fabricante.fonteUrl} target="_blank" rel="noreferrer">
                  Taurus USA - TaurusTX 22
                </a>
              </div>
            )}
            {selected.catalogo?.fonte_url && (
              <div>
                <div className="font-bold text-slate-900">Catálogo interno</div>
                <a className="break-all text-[#7A1F2B] underline" href={selected.catalogo.fonte_url} target="_blank" rel="noreferrer">
                  Fonte cadastrada
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
