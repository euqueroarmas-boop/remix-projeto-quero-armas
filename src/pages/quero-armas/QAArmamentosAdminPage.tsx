import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Sparkles, Globe, Trash2, CheckCircle2, AlertCircle, Search, Image as ImageIcon, RefreshCcw, Camera, Eraser, Crosshair, Target, Layers, Flag, Shield } from "lucide-react";
import { ImageOff, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/quero-armas/LoadStates";

type Status = "rascunho" | "pendente_revisao" | "verificado" | "rejeitado";
type Fonte = "curado" | "ia_gerado" | "scrape_fabricante" | "importado";

interface Arma {
  id: string;
  marca: string; modelo: string; apelido: string | null;
  tipo: string; calibre: string;
  capacidade_carregador: number | null; peso_gramas: number | null;
  comprimento_cano_mm: number | null; alcance_efetivo_m: number | null;
  velocidade_projetil_ms: number | null;
  origem: string | null; classificacao_legal: string | null; descricao: string | null;
  stat_dano: number | null; stat_precisao: number | null; stat_alcance: number | null;
  stat_cadencia: number | null; stat_mobilidade: number | null; stat_controle: number | null;
  status_revisao: Status; fonte_dados: Fonte; fonte_url: string | null;
  observacoes: string | null; ativo: boolean;
  search_tokens: string | null;
  imagem: string | null;
  imagem_status: "pendente" | "gerando" | "pronta" | "erro" | null;
}

const TIPOS = ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"];
const STATUS_LABEL: Record<Status,string> = {
  rascunho: "Rascunho", pendente_revisao: "Pendente revisão", verificado: "Verificado", rejeitado: "Rejeitado",
};
const FONTE_LABEL: Record<Fonte,string> = {
  curado: "Curado", ia_gerado: "IA", scrape_fabricante: "Scrape", importado: "Importado",
};

const empty = (): Partial<Arma> => ({
  marca: "", modelo: "", tipo: "pistola", calibre: "", status_revisao: "rascunho", fonte_dados: "curado", ativo: true,
});

export default function QAArmamentosAdminPage() {
  const [items, setItems] = useState<Arma[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Arma> | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [imgBusyId, setImgBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const [semImagemFilter, setSemImagemFilter] = useState<boolean>(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("qa_armamentos_catalogo" as any).select("*").order("marca").order("modelo");
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setItems((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return items.filter((it) => {
      if (tipoFilter !== "todos" && it.tipo !== tipoFilter) return false;
      if (statusFilter !== "todos" && it.status_revisao !== statusFilter) return false;
      if (semImagemFilter && !!it.imagem) return false;
      if (!norm) return true;
      return [it.marca, it.modelo, it.apelido, it.calibre].filter(Boolean).join(" ").toLowerCase().includes(norm);
    });
  }, [items, q, tipoFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter(i => i.status_revisao === "pendente_revisao").length,
    verificados: items.filter(i => i.status_revisao === "verificado").length,
    ia: items.filter(i => i.fonte_dados === "ia_gerado").length,
    semImagem: items.filter(i => !i.imagem).length,
  }), [items]);

  const filtrosAtivos = q.trim() !== "" || tipoFilter !== "todos" || statusFilter !== "todos" || semImagemFilter;
  const limparFiltros = () => {
    setQ("");
    setTipoFilter("todos");
    setStatusFilter("todos");
    setSemImagemFilter(false);
  };

  function openNew() { setEditing(empty()); setScrapeUrl(""); setOpen(true); }
  function openEdit(it: Arma) { setEditing({ ...it }); setScrapeUrl(it.fonte_url || ""); setOpen(true); }

  async function save() {
    if (!editing?.marca || !editing?.modelo || !editing?.tipo || !editing?.calibre) {
      toast.error("Marca, modelo, tipo e calibre são obrigatórios"); return;
    }
    setSaving(true);
    const payload: any = { ...editing };
    payload.search_tokens = `${payload.marca} ${payload.modelo} ${payload.apelido || ""} ${payload.calibre}`.toUpperCase();
    if (payload.fonte_url !== undefined) payload.fonte_url = payload.fonte_url || null;
    const isUpdate = !!editing.id;
    const { error } = isUpdate
      ? await supabase.from("qa_armamentos_catalogo" as any).update(payload).eq("id", editing.id!)
      : await supabase.from("qa_armamentos_catalogo" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isUpdate ? "Atualizado" : "Criado");
    setOpen(false); load();
  }

  async function remove(it: Arma) {
    if (!confirm(`Excluir ${it.marca} ${it.modelo}?`)) return;
    const { error } = await supabase.from("qa_armamentos_catalogo" as any).delete().eq("id", it.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  }

  async function marcarVerificado(it: Arma) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("qa_armamentos_catalogo" as any)
      .update({ status_revisao: "verificado", revisado_em: new Date().toISOString(), revisado_por: u.user?.id || null })
      .eq("id", it.id);
    if (error) toast.error(error.message); else { toast.success("Marcado como verificado"); load(); }
  }

  async function gerarImagem(it: Pick<Arma, "id" | "marca" | "modelo">) {
    if (!it.id) { toast.error("Salve a arma antes de gerar a imagem"); return; }
    setImgBusyId(it.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-armamento-buscar-foto-real", { body: { id: it.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Foto real encontrada para ${it.marca} ${it.modelo}`);
      const url = (data as any)?.imagem as string | undefined;
      if (url) {
        setEditing((p) => (p && p.id === it.id ? { ...p, imagem: url, imagem_status: "pronta" } : p));
      }
      load();
    } catch (e: any) {
      toast.error(`Não encontrei foto real para ${it.marca} ${it.modelo}: ${e?.message || e}`);
    } finally {
      setImgBusyId(null);
    }
  }

  /** Busca foto real para todas as armas que ainda não têm foto pronta. */
  async function buscarTodasFotos() {
    const pendentes = items.filter((i) => !i.imagem || i.imagem_status !== "pronta");
    if (pendentes.length === 0) {
      toast.info("Todas as armas já possuem foto.");
      return;
    }
    if (!confirm(`Buscar foto real para ${pendentes.length} arma(s)? Pode demorar alguns minutos.`)) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: pendentes.length });
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < pendentes.length; i++) {
      const it = pendentes[i];
      try {
        const { data, error } = await supabase.functions.invoke(
          "qa-armamento-buscar-foto-real",
          { body: { id: it.id } },
        );
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok++;
      } catch (e: any) {
        console.warn(`Falha em ${it.marca} ${it.modelo}:`, e?.message || e);
        fail++;
      }
      setBulkProgress({ done: i + 1, total: pendentes.length });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    toast.success(`Concluído: ${ok} foto(s) encontrada(s), ${fail} falha(s).`);
    load();
  }

  /** Reprocessa o fundo (alpha real) de todas as armas que tenham imagem. */
  async function limparFundoTodas() {
    if (!confirm("Reprocessar o fundo de todas as armas com imagem? Pode levar alguns minutos.")) return;
    setBgBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-armamento-limpar-fundo-batch", {
        body: { force: true, limit: 100 },
      });
      if (error) throw error;
      const d = data as any;
      const ok = (d?.results || []).filter((r: any) => r.ok).length;
      const fail = (d?.results || []).filter((r: any) => !r.ok).length;
      toast.success(`Fundo limpo em ${ok} arma(s)${fail ? `, ${fail} falha(s)` : ""}.`);
      load();
    } catch (e: any) {
      toast.error("Erro ao limpar fundo: " + (e?.message || e));
    } finally {
      setBgBusy(false);
    }
  }

  async function gerarComIA() {
    if (!editing?.marca || !editing?.modelo) { toast.error("Preencha marca e modelo primeiro"); return; }
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("qa-armamento-gerar-ia", {
      body: { marca: editing.marca, modelo: editing.modelo, calibre: editing.calibre, tipo: editing.tipo },
    });
    setAiBusy(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = (data as any)?.data;
    if (!d) { toast.error("IA não retornou dados"); return; }
    setEditing((prev) => ({ ...(prev || {}), ...d, fonte_dados: "ia_gerado", status_revisao: "pendente_revisao" }));
    toast.success("Dados gerados pela IA — revise antes de salvar");
  }

  async function scrapeFabricante() {
    if (!scrapeUrl) { toast.error("Informe a URL do fabricante"); return; }
    setScrapeBusy(true);
    const { data, error } = await supabase.functions.invoke("qa-armamento-scrape", {
      body: { url: scrapeUrl, marca: editing?.marca, modelo: editing?.modelo },
    });
    setScrapeBusy(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = (data as any)?.data;
    if (!d) { toast.error("Scrape não retornou dados"); return; }
    setEditing((prev) => ({ ...(prev || {}), ...d, fonte_dados: "scrape_fabricante", fonte_url: scrapeUrl, status_revisao: "pendente_revisao" }));
    toast.success("Dados extraídos do fabricante — revise antes de salvar");
  }

  function setF<K extends keyof Arma>(k: K, v: any) { setEditing((p) => ({ ...(p || {}), [k]: v })); }

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-zinc-900">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER TÁTICO */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-br from-white via-[#fafaf7] to-[#f1efe9] p-6 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)]">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.5) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg border border-amber-500/50 bg-amber-500/10 grid place-items-center">
              <Crosshair className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-700">// ARSENAL · BASE TÉCNICA</div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">CATÁLOGO DE ARMAMENTOS</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Inventário técnico operacional · Armas reais utilizadas pelos clientes do Arsenal.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50" onClick={buscarTodasFotos} disabled={bulkBusy} title="Busca foto real em fontes públicas para cada arma sem foto">
            {bulkBusy
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando {bulkProgress?.done}/{bulkProgress?.total}</>
                : <><Camera className="h-4 w-4 mr-2" />Buscar fotos reais</>}
            </Button>
            <Button variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50" onClick={limparFundoTodas} disabled={bgBusy} title="Remove fundos brancos, cinzas e xadrez de todas as imagens (gera PNG com transparência real)">
              {bgBusy
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Limpando fundo…</>
                : <><Eraser className="h-4 w-4 mr-2" />Limpar fundo</>}
            </Button>
            <Button onClick={openNew} className="bg-amber-500 text-white hover:bg-amber-600 font-semibold">
              <Plus className="h-4 w-4 mr-2" />Nova arma
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs HUD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="TOTAL" value={stats.total} icon={<Layers className="h-4 w-4" />} />
        <Kpi label="VERIFICADOS" value={stats.verificados} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="PENDENTES" value={stats.pendentes} tone="warn" icon={<AlertCircle className="h-4 w-4" />} />
        <Kpi label="GERADOS · IA" value={stats.ia} icon={<Sparkles className="h-4 w-4" />} />
        <button
          type="button"
          onClick={() => { setSemImagemFilter(!semImagemFilter); setStatusFilter("todos"); setTipoFilter("todos"); }}
          title="Clique para filtrar armas sem imagem"
          className={`relative rounded-lg border bg-white p-3 text-left transition-all hover:shadow-sm ${
            semImagemFilter ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${stats.semImagem > 0 ? "text-amber-700" : "text-zinc-500"}`}>SEM IMAGEM</span>
            <ImageOff className={`h-4 w-4 ${stats.semImagem > 0 ? "text-amber-600" : "text-zinc-400"}`} />
          </div>
          <div className={`mt-1 text-2xl font-bold ${stats.semImagem > 0 ? "text-amber-700" : "text-zinc-700"}`}>{stats.semImagem}</div>
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <Card className="p-3 flex flex-col md:flex-row gap-3 bg-white border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-600" />
          <Input className="pl-9 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-amber-500/40" placeholder="Buscar marca, modelo, calibre…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="md:w-48 bg-white border-zinc-200 text-zinc-900"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-56 bg-white border-zinc-200 text-zinc-900"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {/* LINHA DE CONTAGEM E LIMPAR FILTROS */}
      <div className="flex items-center justify-between text-xs text-zinc-600 px-1 -mt-2">
        <div className="font-mono uppercase tracking-wider">
          {loading
            ? "Carregando…"
            : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}${filtered.length !== stats.total ? ` · de ${stats.total} total` : ""}`}
          {semImagemFilter && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 border border-amber-200">
              <ImageOff className="h-3 w-3" /> Sem imagem
            </span>
          )}
        </div>
        {filtrosAtivos && (
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* GRID DE CARDS DARK-TACTICAL */}
      {loading ? (
        <LoadingState label="Carregando catálogo…" />
      ) : filtered.length === 0 ? (
        <Card className="p-16 text-center bg-white border-zinc-200 text-zinc-500">Nenhum armamento corresponde aos filtros.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <WeaponCard
              key={it.id}
              it={it}
              busy={imgBusyId === it.id}
              onOpen={() => openEdit(it)}
              onGerarImagem={() => gerarImagem(it)}
              onVerificar={() => marcarVerificado(it)}
              onRemove={() => remove(it)}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar arma" : "Nova arma"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={aiBusy} onClick={gerarComIA}>
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar/Regerar com IA
                </Button>
                <div className="flex gap-2 flex-1 min-w-[260px]">
                  <Input placeholder="URL fabricante (ex: taurusarmas.com.br/...)" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} />
                  <Button type="button" variant="secondary" disabled={scrapeBusy} onClick={scrapeFabricante}>
                    {scrapeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                    Buscar no fabricante
                  </Button>
                </div>
              </div>
              {editing.status_revisao === "pendente_revisao" && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                  <AlertCircle className="h-4 w-4" /> Dados pendentes de revisão. Confirme a precisão antes de marcar como verificado.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Marca *"><Input value={editing.marca || ""} onChange={(e) => setF("marca", e.target.value)} /></Field>
                <Field label="Modelo *"><Input value={editing.modelo || ""} onChange={(e) => setF("modelo", e.target.value)} /></Field>
                <Field label="Apelido"><Input value={editing.apelido || ""} onChange={(e) => setF("apelido", e.target.value)} /></Field>
                <Field label="Tipo *">
                  <Select value={editing.tipo || "pistola"} onValueChange={(v) => setF("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Calibre *"><Input value={editing.calibre || ""} onChange={(e) => setF("calibre", e.target.value)} /></Field>
                <Field label="Origem"><Input value={editing.origem || ""} onChange={(e) => setF("origem", e.target.value)} /></Field>
                <Field label="Classificação legal">
                  <Select value={editing.classificacao_legal || ""} onValueChange={(v) => setF("classificacao_legal", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Uso Permitido">Uso Permitido</SelectItem>
                      <SelectItem value="Uso Restrito">Uso Restrito</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacidade carregador"><Input type="number" value={editing.capacidade_carregador ?? ""} onChange={(e) => setF("capacidade_carregador", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Peso (g)"><Input type="number" value={editing.peso_gramas ?? ""} onChange={(e) => setF("peso_gramas", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Comprimento cano (mm)"><Input type="number" value={editing.comprimento_cano_mm ?? ""} onChange={(e) => setF("comprimento_cano_mm", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Alcance efetivo (m)"><Input type="number" value={editing.alcance_efetivo_m ?? ""} onChange={(e) => setF("alcance_efetivo_m", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Velocidade (m/s)"><Input type="number" value={editing.velocidade_projetil_ms ?? ""} onChange={(e) => setF("velocidade_projetil_ms", e.target.value === "" ? null : Number(e.target.value))} /></Field>
              </div>

              <Field label="Descrição"><Textarea rows={2} value={editing.descricao || ""} onChange={(e) => setF("descricao", e.target.value)} /></Field>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Stats (0-100)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {(["stat_dano","stat_precisao","stat_alcance","stat_cadencia","stat_mobilidade","stat_controle"] as const).map(k => (
                    <Field key={k} label={k.replace("stat_","")}>
                      <Input type="number" min={0} max={100} value={(editing as any)[k] ?? ""} onChange={(e) => setF(k as any, e.target.value === "" ? null : Number(e.target.value))} />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Status revisão">
                  <Select value={editing.status_revisao || "rascunho"} onValueChange={(v) => setF("status_revisao", v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Fonte dos dados">
                  <Select value={editing.fonte_dados || "curado"} onValueChange={(v) => setF("fonte_dados", v as Fonte)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FONTE_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="URL fonte"><Input value={editing.fonte_url || ""} onChange={(e) => setF("fonte_url", e.target.value)} /></Field>
              </div>

              <Field label="Observações internas"><Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setF("observacoes", e.target.value)} /></Field>

              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Imagem fotorrealista da arma</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Render fiel gerado por IA (Nano Banana Pro) com base em marca, modelo e calibre.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!editing.id || imgBusyId === editing.id}
                    onClick={() => editing.id && gerarImagem({ id: editing.id, marca: editing.marca || "", modelo: editing.modelo || "" })}
                  >
                    {imgBusyId === editing.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (editing.imagem ? <RefreshCcw className="h-4 w-4 mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />)}
                    {editing.imagem ? "Regerar imagem" : "Gerar imagem"}
                  </Button>
                </div>
                {editing.imagem ? (
                  <div className="grid place-items-center rounded-md p-2" style={{ background: "transparent" }}>
                    <img src={editing.imagem} alt={`${editing.marca} ${editing.modelo}`} className="max-h-48 w-full object-contain mix-blend-multiply" />
                  </div>
                ) : (
                  <div className="grid place-items-center h-32 border border-dashed rounded-md text-muted-foreground text-sm">
                    {editing.id ? "Nenhuma imagem ainda. Clique em 'Gerar imagem'." : "Salve a arma primeiro para gerar a imagem."}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: number; tone?: "success" | "warn"; icon?: React.ReactNode }) {
  const toneMap: Record<string,{ value: string; ring: string; bg: string }> = {
    success: { value: "text-emerald-700", ring: "border-emerald-500/40", bg: "bg-emerald-500/10" },
    warn:    { value: "text-amber-700",   ring: "border-amber-500/40",   bg: "bg-amber-500/10" },
  };
  const t = tone ? toneMap[tone] : { value: "text-zinc-900", ring: "border-zinc-200", bg: "bg-zinc-100" };
  return (
    <Card className={`p-4 bg-white border ${t.ring} relative overflow-hidden shadow-sm`}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">{label}</div>
        <div className={`h-7 w-7 grid place-items-center rounded ${t.bg} ${t.value}`}>{icon}</div>
      </div>
      <div className={`text-3xl font-bold mt-2 tabular-nums ${t.value}`}>{value}</div>
    </Card>
  );
}

const TIPO_ICON: Record<string, string> = {
  pistola: "🔫", revolver: "🔫", espingarda: "🪖", carabina: "🎯", fuzil: "🎯", submetralhadora: "🎯", outra: "⚙️",
};

function WeaponCard({
  it, busy, onOpen, onGerarImagem, onVerificar, onRemove,
}: {
  it: Arma;
  busy: boolean;
  onOpen: () => void;
  onGerarImagem: () => void;
  onVerificar: () => void;
  onRemove: () => void;
}) {
  const verificado = it.status_revisao === "verificado";
  const pendente = it.status_revisao === "pendente_revisao";
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-amber-500/60 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_20px_50px_-20px_rgba(245,158,11,0.35)] transition-all duration-300"
    >
      {/* faixa superior tática */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#fafaf7] border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${verificado ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,.6)]" : pendente ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,.6)]" : "bg-zinc-400"}`} />
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            ID·{it.id.slice(0, 6).toUpperCase()}
          </span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{FONTE_LABEL[it.fonte_dados]}</span>
      </div>

      {/* visual da arma */}
      <div
        className="relative aspect-[16/10] grid place-items-center overflow-hidden isolate"
        style={{
          background:
            "radial-gradient(ellipse at center, #ffffff 0%, #f6f5f1 65%, #ecebe5 100%)",
        }}
      >
        {it.imagem ? (
          <img
            src={it.imagem}
            alt={`${it.marca} ${it.modelo}`}
            loading="lazy"
            className="relative z-10 max-h-[80%] max-w-[88%] w-auto h-auto object-contain mix-blend-multiply drop-shadow-[0_10px_20px_rgba(0,0,0,0.18)] group-hover:scale-[1.03] transition-transform duration-500 pointer-events-none select-none"
          />
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-2 text-zinc-400">
            <Target className="h-10 w-10" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em]">SEM IMAGEM</span>
          </div>
        )}

        {/* tag de tipo */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-amber-500/90 border border-amber-600 text-[9px] font-mono uppercase tracking-[0.25em] text-white shadow-sm">
          {it.tipo}
        </div>
      </div>

      {/* corpo */}
      <div className="p-3 space-y-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-700">{it.marca}</div>
          <div className="text-base font-bold text-zinc-900 leading-tight truncate">{it.modelo}</div>
          {it.apelido && <div className="text-[11px] text-zinc-500 italic mt-0.5">"{it.apelido}"</div>}
        </div>

        {/* specs em linha */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Spec icon={<Crosshair className="h-3 w-3" />} label="CAL" value={it.calibre || "—"} />
          <Spec icon={<Layers className="h-3 w-3" />} label="CAP" value={it.capacidade_carregador != null ? String(it.capacidade_carregador) : "—"} />
          <Spec icon={<Flag className="h-3 w-3" />} label="ORIG" value={it.origem || "—"} />
        </div>

        {/* status + classificação */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge s={it.status_revisao} />
          {it.classificacao_legal && (
            <span className={`text-[9px] font-mono uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border ${it.classificacao_legal === "Uso Restrito" ? "border-red-500/50 text-red-700 bg-red-500/10" : "border-emerald-500/50 text-emerald-700 bg-emerald-500/10"}`}>
              {it.classificacao_legal === "Uso Restrito" ? "UR" : "UP"}
            </span>
          )}
        </div>

        {/* ações */}
        <div className="flex items-center gap-1 pt-2 border-t border-zinc-200" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="flex-1 h-8 text-zinc-500 hover:text-amber-700 hover:bg-amber-500/10" onClick={onGerarImagem} disabled={busy} title={it.imagem ? "Regerar imagem" : "Gerar imagem"}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (it.imagem ? <RefreshCcw className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />)}
          </Button>
          {!verificado && (
            <Button size="sm" variant="ghost" className="flex-1 h-8 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={onVerificar} title="Marcar verificado">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="flex-1 h-8 text-zinc-500 hover:text-red-700 hover:bg-red-500/10" onClick={onRemove} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-[#fafaf7] px-1.5 py-1.5">
      <div className="flex items-center justify-center gap-1 text-zinc-500 text-[8px] font-mono uppercase tracking-[0.2em]">
        {icon}{label}
      </div>
      <div className="text-[11px] font-bold text-zinc-900 truncate mt-0.5">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-zinc-700">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, { cls: string; label: string }> = {
    rascunho:         { cls: "border-zinc-300 text-zinc-600 bg-zinc-100",                  label: "RASCUNHO" },
    pendente_revisao: { cls: "border-amber-500/50 text-amber-700 bg-amber-500/10",         label: "PENDENTE" },
    verificado:       { cls: "border-emerald-500/50 text-emerald-700 bg-emerald-500/10",   label: "VERIFICADO" },
    rejeitado:        { cls: "border-red-500/50 text-red-700 bg-red-500/10",               label: "REJEITADO" },
  };
  const c = map[s];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-[0.2em] ${c.cls}`}>{c.label}</span>;
}