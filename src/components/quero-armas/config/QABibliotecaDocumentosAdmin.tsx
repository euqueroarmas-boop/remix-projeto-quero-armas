import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BookMarked, Plus, Search, Loader2, RefreshCw, Save, Trash2,
  ChevronDown, ChevronUp, Archive, X, Upload,
} from "lucide-react";
import BibliotecaModelosParser, {
  SeloModeloParser, carregarResumoModelos, treinarModeloArquivo,
} from "./BibliotecaModelosParser";

type ResumoModelos = Map<string, { total: number; deterministico: number; ia: number }>;

type BibliotecaItem = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao_o_que_e: string | null;
  descricao_como_enviar: string | null;
  observacao_cliente: string | null;
  validade_dias: number | null;
  formato_aceito: string[];
  link_emissao: string | null;
  link_modelo: string | null;
  base_legal: string | null;
  emissor_padrao: string;
  ativo: boolean;
  usado_em_servicos?: number;
};

const CATEGORIAS: Array<{ valor: string; label: string }> = [
  { valor: "identificacao",    label: "Identificação" },
  { valor: "residencia",       label: "Residência" },
  { valor: "ocupacao_licita",  label: "Ocupação Lícita" },
  { valor: "certidoes",        label: "Certidões" },
  { valor: "laudos",           label: "Laudos" },
  { valor: "arma_acervo",      label: "Arma / Acervo" },
  { valor: "cac_atividade",    label: "Atividade CAC / Habitualidade" },
  { valor: "declaracoes",      label: "Declarações" },
  { valor: "efetiva_necessidade", label: "Efetiva Necessidade" },
  { valor: "documentos_processo", label: "Documentos do Processo" },
  { valor: "juridico",         label: "Jurídico" },
  { valor: "outros",           label: "Outros" },
];

const VALIDADE_OPCOES: Array<{ dias: number | null; label: string }> = [
  { dias: null,  label: "Não tem validade" },
  { dias: 15,    label: "15 dias" },
  { dias: 30,    label: "30 dias" },
  { dias: 90,    label: "90 dias" },
  { dias: 180,   label: "180 dias" },
  { dias: 365,   label: "1 ano" },
  { dias: 730,   label: "2 anos" },
  { dias: 1825,  label: "5 anos" },
];

function labelCategoria(v: string): string {
  return CATEGORIAS.find((c) => c.valor === v)?.label ?? v;
}

function labelValidade(d: number | null): string {
  if (d === null || d === undefined) return "Sem validade";
  const encontrada = VALIDADE_OPCOES.find((o) => o.dias === d);
  return encontrada?.label ?? `${d} dias`;
}

function gerarCodigo(nome: string): string {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

const BLANK: Omit<BibliotecaItem, "id" | "usado_em_servicos"> = {
  codigo: "",
  nome: "",
  categoria: "outros",
  descricao_o_que_e: "",
  descricao_como_enviar: "",
  observacao_cliente: "",
  validade_dias: null,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  link_emissao: "",
  link_modelo: "",
  base_legal: "",
  emissor_padrao: "cliente",
  ativo: true,
};

export default function QABibliotecaDocumentosAdmin() {
  const [itens, setItens] = useState<BibliotecaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novo, setNovo] = useState({ ...BLANK });
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [resumoModelos, setResumoModelos] = useState<ResumoModelos>(new Map());
  const [modelosNovo, setModelosNovo] = useState<File[]>([]);
  const [treinandoNovo, setTreinandoNovo] = useState(false);

  async function recarregarResumo() {
    try { setResumoModelos(await carregarResumoModelos()); } catch { /* silencioso */ }
  }

  async function carregar() {
    setCarregando(true);
    try {
      const { data: bib } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome");
      const { data: usos } = await supabase
        .from("qa_servicos_documentos" as any)
        .select("biblioteca_id")
        .eq("ativo", true)
        .not("biblioteca_id", "is", null);
      const contagem = new Map<string, number>();
      for (const u of ((usos as any[]) ?? [])) {
        const k = String((u as any).biblioteca_id);
        contagem.set(k, (contagem.get(k) ?? 0) + 1);
      }
      const lista = (((bib as any[]) ?? []) as BibliotecaItem[]).map((i) => ({
        ...i,
        usado_em_servicos: contagem.get(i.id) ?? 0,
      }));
      setItens(lista);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); void recarregarResumo(); }, []);

  const itensFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return itens
      .filter((i) => (categoriaFiltro ? i.categoria === categoriaFiltro : true))
      .filter((i) =>
        b
          ? i.nome.toLowerCase().includes(b) ||
            i.codigo.toLowerCase().includes(b) ||
            (i.descricao_o_que_e ?? "").toLowerCase().includes(b)
          : true,
      );
  }, [itens, busca, categoriaFiltro]);

  // Agrupa por CATEGORIA (Identificação, Residência, Certidões…) na ordem
  // canônica do catálogo; dentro de cada categoria, ordem alfabética.
  const grupos = useMemo(() => {
    const map = new Map<string, BibliotecaItem[]>();
    for (const item of itensFiltrados) {
      const cat = item.categoria || "outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    const peso = (c: string) => {
      const i = CATEGORIAS.findIndex((x) => x.valor === c);
      return i === -1 ? 999 : i;
    };
    return Array.from(map.entries())
      .map(([cat, lista]) => {
        lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return [cat, lista] as [string, BibliotecaItem[]];
      })
      .sort(([a], [b]) => peso(a) - peso(b) || a.localeCompare(b, "pt-BR"));
  }, [itensFiltrados]);

  async function salvarItem(item: BibliotecaItem) {
    setSalvandoId(item.id);
    try {
      const { error } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .update({
          nome: item.nome,
          categoria: item.categoria,
          descricao_o_que_e: item.descricao_o_que_e || null,
          descricao_como_enviar: item.descricao_como_enviar || null,
          observacao_cliente: item.observacao_cliente || null,
          validade_dias: item.validade_dias,
          formato_aceito: item.formato_aceito,
          link_emissao: item.link_emissao || null,
          link_modelo: item.link_modelo || null,
          base_legal: item.base_legal || null,
          emissor_padrao: item.emissor_padrao || "cliente",
          ativo: item.ativo,
        })
        .eq("id", item.id);
      if (error) throw error;
      toast.success(`"${item.nome}" salvo`);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSalvandoId(null);
    }
  }

  async function arquivarItem(item: BibliotecaItem) {
    if (item.usado_em_servicos && item.usado_em_servicos > 0) {
      if (!confirm(`Este documento está sendo usado em ${item.usado_em_servicos} serviço(s). Arquivar mesmo assim? Os serviços continuarão funcionando mas você não poderá adicioná-lo em novos serviços.`)) return;
    } else {
      if (!confirm(`Arquivar "${item.nome}"?`)) return;
    }
    const { error } = await supabase
      .from("qa_documentos_biblioteca" as any)
      .update({ ativo: false, arquivado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento arquivado");
    await carregar();
  }

  async function criarNovo() {
    if (!novo.nome.trim()) { toast.error("Informe o nome do documento"); return; }
    const codigo = novo.codigo.trim() || gerarCodigo(novo.nome);
    const { error } = await supabase
      .from("qa_documentos_biblioteca" as any)
      .insert({
        codigo,
        nome: novo.nome.trim(),
        categoria: novo.categoria,
        descricao_o_que_e: novo.descricao_o_que_e || null,
        descricao_como_enviar: novo.descricao_como_enviar || null,
        observacao_cliente: novo.observacao_cliente || null,
        validade_dias: novo.validade_dias,
        formato_aceito: novo.formato_aceito,
        link_emissao: novo.link_emissao || null,
        link_modelo: novo.link_modelo || null,
        base_legal: novo.base_legal || null,
        emissor_padrao: novo.emissor_padrao || "cliente",
        ativo: true,
      });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Já existe um documento com esse código." : error.message);
      return;
    }
    toast.success(`"${novo.nome}" adicionado à biblioteca`);

    if (modelosNovo.length > 0) {
      setTreinandoNovo(true);
      for (const f of modelosNovo) {
        try {
          const r = await treinarModeloArquivo(codigo, novo.nome.trim(), f);
          toast.success(
            `Modelo "${f.name}" treinado (${r?.deterministico ? "determinística ✓" : "determinística —"} · ${r?.ia ? "IA ✓" : "IA —"})`,
          );
        } catch (e: any) {
          toast.error(`Falha no modelo "${f.name}": ${e?.message ?? "erro"}`);
        }
      }
      setTreinandoNovo(false);
    }

    setNovo({ ...BLANK });
    setModelosNovo([]);
    setCriandoNovo(false);
    await carregar();
    await recarregarResumo();
  }

  return (
    <div className="bg-white rounded-2xl border p-4 md:p-5" style={{ borderColor: "hsl(220 15% 90%)" }}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
          <BookMarked className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} /> Biblioteca de Documentos
        </h2>
        <Button variant="ghost" size="sm" onClick={carregar} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
      <p className="text-xs mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Fonte única de todos os documentos que os serviços podem exigir do cliente. Cada item aqui traz o
        <b> passo a passo </b> que aparece no portal do cliente. Ao criar um serviço novo, você não escreve
        nada de novo — só marca quais documentos da biblioteca esse serviço consome.
      </p>

      {/* Toolbar de busca */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="h-8 text-xs border rounded-md px-2"
          style={{ borderColor: "hsl(220 15% 88%)" }}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.label}</option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() => setCriandoNovo((v) => !v)}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8"
        >
          {criandoNovo ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {criandoNovo ? "Cancelar" : "Adicionar documento"}
        </Button>
      </div>

      {/* Formulário de novo item */}
      {criandoNovo && (
        <div className="rounded-lg border border-dashed border-[#7B1C2E]/40 bg-[#7B1C2E]/[0.03] p-3 mb-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nome do documento</label>
              <Input
                value={novo.nome}
                onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
                placeholder="ex.: Comprovante de Residência"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
              <select
                value={novo.categoria}
                onChange={(e) => setNovo((n) => ({ ...n, categoria: e.target.value }))}
                className="h-8 w-full text-xs border rounded-md px-2"
                style={{ borderColor: "hsl(220 15% 88%)" }}
              >
                {CATEGORIAS.map((c) => (<option key={c.valor} value={c.valor}>{c.label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">O que é este documento?</label>
            <textarea
              value={novo.descricao_o_que_e ?? ""}
              onChange={(e) => setNovo((n) => ({ ...n, descricao_o_que_e: e.target.value }))}
              rows={2}
              placeholder="Explicação curta para o cliente."
              className="w-full rounded-md border px-2 py-1.5 text-xs resize-y"
              style={{ borderColor: "hsl(220 15% 88%)" }}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Como o cliente deve enviar?</label>
            <textarea
              value={novo.descricao_como_enviar ?? ""}
              onChange={(e) => setNovo((n) => ({ ...n, descricao_como_enviar: e.target.value }))}
              rows={3}
              placeholder="Passo a passo. Ex.: Envie foto legível da CIN frente e verso, sem cortes."
              className="w-full rounded-md border px-2 py-1.5 text-xs resize-y"
              style={{ borderColor: "hsl(220 15% 88%)" }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tem validade?</label>
              <select
                value={novo.validade_dias === null ? "null" : String(novo.validade_dias)}
                onChange={(e) => setNovo((n) => ({ ...n, validade_dias: e.target.value === "null" ? null : Number(e.target.value) }))}
                className="h-8 w-full text-xs border rounded-md px-2"
                style={{ borderColor: "hsl(220 15% 88%)" }}
              >
                {VALIDADE_OPCOES.map((v) => (
                  <option key={String(v.dias)} value={v.dias === null ? "null" : String(v.dias)}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Onde consegue (link)</label>
              <Input
                value={novo.link_emissao ?? ""}
                onChange={(e) => setNovo((n) => ({ ...n, link_emissao: e.target.value }))}
                placeholder="https://…"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base legal (opcional)</label>
              <Input
                value={novo.base_legal ?? ""}
                onChange={(e) => setNovo((n) => ({ ...n, base_legal: e.target.value }))}
                placeholder="Ex.: IN DG/PF 201"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="rounded-md border border-dashed p-2" style={{ borderColor: "hsl(220 15% 85%)" }}>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Modelos de referência para o parser (2 ou mais)
            </label>
            <p className="text-[10px] text-slate-400 mb-1.5">
              Envie exemplos reais deste documento. Cada arquivo é analisado de forma determinística
              (texto + palavras-chave) e por IA (embedding) e fica salvo para comparação futura.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={(e) => setModelosNovo(Array.from(e.target.files ?? []))}
                className="text-[11px]"
              />
              {modelosNovo.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                  <Upload className="w-3 h-3" /> {modelosNovo.length} arquivo(s) selecionado(s)
                </span>
              )}
            </div>
            {modelosNovo.length === 1 && (
              <p className="text-[10px] mt-1" style={{ color: "#B45309" }}>
                Recomendado enviar pelo menos 2 modelos para o parser comparar variações.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setNovo({ ...BLANK }); setModelosNovo([]); setCriandoNovo(false); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={criarNovo} disabled={treinandoNovo} className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-7">
              {treinandoNovo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {treinandoNovo ? "Treinando modelos…" : "Adicionar à biblioteca"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista agrupada por categoria */}
      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando biblioteca…
        </div>
      ) : itensFiltrados.length === 0 ? (
        <p className="text-center py-8 text-xs italic text-slate-400">
          Nenhum documento encontrado{busca || categoriaFiltro ? " para este filtro." : "."}
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map(([cat, lista]) => (
            <div key={cat}>
              <div className="flex items-center justify-between gap-2 mb-1.5 px-1 border-b border-slate-200 pb-1">
                <span className="text-[11px] font-bold tracking-[0.18em] text-[#7A1F2B] uppercase">
                  {labelCategoria(cat)}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                  {lista.length}
                </span>
              </div>
              <div className="space-y-1">
                {lista.map((item) => (
                  <ItemBiblioteca
                    key={item.id}
                    item={item}
                    resumoModelos={resumoModelos.get(item.codigo)}
                    onModelosChanged={recarregarResumo}
                    aberto={abertoId === item.id}
                    onToggle={() => setAbertoId((v) => (v === item.id ? null : item.id))}
                    onSalvar={salvarItem}
                    onArquivar={arquivarItem}
                    salvando={salvandoId === item.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Linha da biblioteca (accordion editável) ─────────────────────────────
function ItemBiblioteca({
  item, aberto, onToggle, onSalvar, onArquivar, salvando, resumoModelos, onModelosChanged,
}: {
  item: BibliotecaItem;
  aberto: boolean;
  onToggle: () => void;
  onSalvar: (i: BibliotecaItem) => void;
  onArquivar: (i: BibliotecaItem) => void;
  salvando: boolean;
  resumoModelos?: { total: number; deterministico: number; ia: number };
  onModelosChanged?: () => void;
}) {
  const [local, setLocal] = useState<BibliotecaItem>(item);
  useEffect(() => { setLocal(item); }, [item]);

  function set<K extends keyof BibliotecaItem>(k: K, v: BibliotecaItem[K]) {
    setLocal((prev) => ({ ...prev, [k]: v }));
  }

  const usoLabel = item.usado_em_servicos
    ? `usado em ${item.usado_em_servicos} serviço(s)`
    : "não usado ainda";

  return (
    <div className={`border rounded-lg overflow-hidden ${!item.ativo ? "opacity-60" : ""}`} style={{ borderColor: "hsl(220 15% 90%)" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-left gap-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 25%)" }}>
              {item.nome}
            </p>
            {!item.ativo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-slate-500 bg-slate-100 border-slate-200">
                arquivado
              </span>
            )}
            <SeloModeloParser resumo={resumoModelos} />
          </div>
          <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "hsl(220 10% 60%)" }}>
            {item.codigo} · {labelCategoria(item.categoria)} · {labelValidade(item.validade_dias)} · {usoLabel}
          </p>
        </div>
        {aberto ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {aberto && (
        <div className="border-t bg-slate-50/50 px-3 py-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nome</label>
              <Input value={local.nome} onChange={(e) => set("nome", e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
              <select
                value={local.categoria}
                onChange={(e) => set("categoria", e.target.value)}
                className="h-8 w-full text-xs border rounded-md px-2"
                style={{ borderColor: "hsl(220 15% 88%)" }}
              >
                {CATEGORIAS.map((c) => (<option key={c.valor} value={c.valor}>{c.label}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">O que é este documento?</label>
            <textarea
              value={local.descricao_o_que_e ?? ""}
              onChange={(e) => set("descricao_o_que_e", e.target.value)}
              rows={2}
              className="w-full rounded-md border px-2 py-1.5 text-xs resize-y"
              style={{ borderColor: "hsl(220 15% 88%)" }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Como o cliente deve enviar? (passo a passo)</label>
            <textarea
              value={local.descricao_como_enviar ?? ""}
              onChange={(e) => set("descricao_como_enviar", e.target.value)}
              rows={4}
              className="w-full rounded-md border px-2 py-1.5 text-xs resize-y"
              style={{ borderColor: "hsl(220 15% 88%)" }}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Observação curta ao cliente (aparece no card)</label>
            <Input
              value={local.observacao_cliente ?? ""}
              onChange={(e) => set("observacao_cliente", e.target.value)}
              placeholder="Ex.: emitido nos últimos 90 dias"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tem validade?</label>
              <select
                value={local.validade_dias === null ? "null" : String(local.validade_dias)}
                onChange={(e) => set("validade_dias", e.target.value === "null" ? null : Number(e.target.value))}
                className="h-8 w-full text-xs border rounded-md px-2"
                style={{ borderColor: "hsl(220 15% 88%)" }}
              >
                {VALIDADE_OPCOES.map((v) => (
                  <option key={String(v.dias)} value={v.dias === null ? "null" : String(v.dias)}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Link para emissão</label>
              <Input
                value={local.link_emissao ?? ""}
                onChange={(e) => set("link_emissao", e.target.value)}
                placeholder="https://…"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Link do modelo (opcional)</label>
              <Input
                value={local.link_modelo ?? ""}
                onChange={(e) => set("link_modelo", e.target.value)}
                placeholder="https://…"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base legal (opcional)</label>
            <Input
              value={local.base_legal ?? ""}
              onChange={(e) => set("base_legal", e.target.value)}
              placeholder="Ex.: IN DG/PF 201, art. 3º"
              className="h-8 text-xs"
            />
          </div>

          <BibliotecaModelosParser
            codigo={item.codigo}
            nomeDocumento={item.nome}
            onChanged={onModelosChanged}
          />

          <div className="flex justify-between items-center pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onArquivar(item)}
              className="text-xs h-7 text-slate-500 hover:text-red-600 gap-1"
            >
              {item.ativo ? <><Archive className="w-3 h-3" /> Arquivar</> : <><Trash2 className="w-3 h-3" /> Arquivado</>}
            </Button>
            <Button
              size="sm"
              onClick={() => onSalvar(local)}
              disabled={salvando}
              className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-7"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
