import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Sparkles, BookOpen, Edit3, Trash2, ArrowLeft, Tag, Wrench } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string;
  module: string | null;
  audience: "equipe" | "cliente";
  tags: string[];
  symptoms: string[];
  body: string;
  related_articles: string[];
  version: number;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  "Primeiros passos", "Dashboard", "Clientes", "Serviços", "Vendas",
  "Processos", "Checklist documental", "Hub de documentos",
  "Arsenal / Bancada Tática", "CR", "CRAF", "GTE", "Munições",
  "Peças jurídicas", "Monitoramento", "Portal do cliente",
  "Configurações", "Problemas frequentes", "Regras de negócio", "Manutenção técnica",
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80);

function emptyArticle(): Partial<Article> {
  return {
    title: "", slug: "", category: CATEGORIES[0], module: "",
    audience: "equipe", tags: [], symptoms: [], body: "",
    related_articles: [], version: 1, status: "published",
  };
}

export default function QABaseEquipePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("__all__");
  const [filterText, setFilterText] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [saving, setSaving] = useState(false);

  // IA search
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [aiHits, setAiHits] = useState<Array<{ id: string; title: string; category: string; module: string | null }>>([]);

  async function loadAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_kb_artigos" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar base: " + error.message);
      setArticles([]);
    } else {
      setArticles((data ?? []) as any as Article[]);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return articles.filter(a => {
      if (filterCat !== "__all__" && a.category !== filterCat) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.symptoms.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [articles, filterCat, filterText]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  async function runAiSearch() {
    if (aiQuery.trim().length < 3) {
      toast.error("Descreva o problema com mais detalhes.");
      return;
    }
    setAiLoading(true);
    setAiAnswer("");
    setAiHits([]);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-search", {
        body: { query: aiQuery, limit: 6 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiAnswer((data as any).answer ?? "");
      setAiHits((data as any).articles ?? []);
    } catch (e: any) {
      toast.error("Erro na busca IA: " + (e?.message ?? "desconhecido"));
    } finally {
      setAiLoading(false);
    }
  }

  function startNew() {
    setEditing(emptyArticle());
  }
  function startEdit(a: Article) {
    setEditing({ ...a });
  }

  async function saveArticle() {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.body?.trim()) {
      toast.error("Título e corpo são obrigatórios.");
      return;
    }
    setSaving(true);
    const slug = editing.slug?.trim() || slugify(editing.title);
    const payload = {
      title: editing.title.trim().toUpperCase(),
      slug,
      category: editing.category,
      module: (editing.module || "").toUpperCase() || null,
      audience: editing.audience ?? "equipe",
      tags: (editing.tags ?? []).map(t => t.trim()).filter(Boolean),
      symptoms: (editing.symptoms ?? []).map(t => t.trim()).filter(Boolean),
      body: editing.body,
      related_articles: editing.related_articles ?? [],
      status: editing.status ?? "published",
      version: editing.version ?? 1,
    };
    let res;
    if (editing.id) {
      res = await supabase.from("qa_kb_artigos" as any).update({ ...payload, version: (editing.version ?? 1) + 1 }).eq("id", editing.id);
    } else {
      res = await supabase.from("qa_kb_artigos" as any).insert(payload);
    }
    setSaving(false);
    if (res.error) {
      toast.error("Erro ao salvar: " + res.error.message);
      return;
    }
    toast.success("Artigo salvo.");
    setEditing(null);
    await loadAll();
  }

  async function deleteArticle(a: Article) {
    if (!confirm(`Remover artigo "${a.title}"?`)) return;
    const { error } = await supabase.from("qa_kb_artigos" as any).delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido.");
    if (selected?.id === a.id) setSelected(null);
    await loadAll();
  }

  // ===== READ VIEW =====
  if (selected) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button variant="ghost" onClick={() => setSelected(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar à base
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-mono uppercase">
                  <Badge variant="secondary">{selected.category}</Badge>
                  {selected.module && <span>· {selected.module}</span>}
                  <span>· v{selected.version}</span>
                </div>
                <CardTitle className="text-2xl uppercase">{selected.title}</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>
                  <Edit3 className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteArticle(selected)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <article className="prose prose-sm md:prose-base max-w-none">
              <ReactMarkdown>{selected.body}</ReactMarkdown>
            </article>
            {selected.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1">
                {selected.tags.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    <Tag className="h-2.5 w-2.5 mr-1" />{t}
                  </Badge>
                ))}
              </div>
            )}
            {selected.symptoms.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                <strong className="uppercase">Sintomas:</strong> {selected.symptoms.join(" · ")}
              </div>
            )}
          </CardContent>
        </Card>
        {renderEditor()}
      </div>
    );
  }

  function renderEditor() {
    if (!editing) return null;
    return (
      <Dialog open={!!editing} onOpenChange={() => !saving && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase">{editing.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-mono">Título</label>
              <Input value={editing.title ?? ""} onChange={e => setEditing({ ...editing, title: e.target.value })} className="uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-mono">Categoria</label>
                <Select value={editing.category} onValueChange={v => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase font-mono">Módulo</label>
                <Input value={editing.module ?? ""} onChange={e => setEditing({ ...editing, module: e.target.value })} placeholder="EX: CLIENTES, ARSENAL..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-mono">Público</label>
                <Select value={editing.audience} onValueChange={(v: any) => setEditing({ ...editing, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipe">Equipe Quero Armas</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase font-mono">Status</label>
                <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase font-mono">Tags (separadas por vírgula)</label>
              <Input value={(editing.tags ?? []).join(", ")} onChange={e => setEditing({ ...editing, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div>
              <label className="text-xs uppercase font-mono">Sintomas de busca (frases separadas por vírgula)</label>
              <Input value={(editing.symptoms ?? []).join(", ")} onChange={e => setEditing({ ...editing, symptoms: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="ex: cliente aprovou documento mas continua pendente" />
            </div>
            <div>
              <label className="text-xs uppercase font-mono">Corpo (Markdown)</label>
              <Textarea value={editing.body ?? ""} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={14} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveArticle} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Base de Conhecimento — Equipe
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase mt-1">
            Operação · Técnica · Regras de negócio
          </p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Novo artigo</Button>
      </header>

      {/* Busca IA */}
      <Card className="border-amber-500/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" /> Pergunte em linguagem natural
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="ex: cliente aprovou documento mas continua aparecendo pendente"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runAiSearch()}
            />
            <Button onClick={runAiSearch} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {aiAnswer && (
            <div className="border rounded-md p-3 bg-amber-50/50 prose prose-sm max-w-none">
              <ReactMarkdown>{aiAnswer}</ReactMarkdown>
            </div>
          )}
          {aiHits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aiHits.map(h => {
                const a = articles.find(x => x.id === h.id);
                return (
                  <Button key={h.id} size="sm" variant="outline" className="text-xs"
                    onClick={() => a && setSelected(a)}>
                    {h.title}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2">
        <Input
          placeholder="Filtrar por título, tag ou sintoma..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="md:max-w-md"
        />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="md:max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Nenhum artigo encontrado.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wider">
                {cat} <span className="opacity-60">({items.length})</span>
              </h2>
              <div className="grid gap-2">
                {items.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="text-left border rounded-md p-3 hover:bg-amber-50/50 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold uppercase text-sm">{a.title}</div>
                      {a.module && (
                        <div className="text-[11px] text-muted-foreground font-mono uppercase mt-0.5 flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {a.module}
                        </div>
                      )}
                      {a.symptoms.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                          {a.symptoms.slice(0, 2).join(" · ")}
                        </div>
                      )}
                    </div>
                    {a.status !== "published" && <Badge variant="outline" className="text-[10px]">{a.status}</Badge>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {renderEditor()}
    </div>
  );
}