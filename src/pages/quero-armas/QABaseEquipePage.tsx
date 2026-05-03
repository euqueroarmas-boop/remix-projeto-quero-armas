import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Sparkles, BookOpen, Edit3, Trash2, ArrowLeft, Tag, Wrench, Wand2, CheckCircle2, AlertCircle, Clock, Zap, RefreshCw, ScrollText, Image as ImageIcon, ThumbsUp, ThumbsDown, Camera, Upload } from "lucide-react";
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
  status: "draft" | "needs_review" | "audited" | "published" | "rejected" | "archived";
  visual_bug_detected?: boolean;
  last_review_reason?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  embedding_status?: "pendente" | "gerado" | "erro" | null;
  embedding_error?: string | null;
  embedding_updated_at?: string | null;
};

type ArticleImage = {
  id: string;
  article_id: string;
  step_number: number;
  step_title: string | null;
  caption: string | null;
  image_url: string | null;
  status: "draft" | "approved" | "archived" | "error";
  error_message: string | null;
  image_type?: "screenshot_real" | "upload_manual" | "imagem_ia";
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
  const [filterEmb, setFilterEmb] = useState<string>("__all__");
  const [filterReview, setFilterReview] = useState<string>("__all__");
  const [selected, setSelected] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [processingEmb, setProcessingEmb] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<Array<{ id: string; article_id: string; status: string; error_message: string | null; modelo: string | null; created_at: string }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [backfillingImages, setBackfillingImages] = useState(false);
  const [retryingErrors, setRetryingErrors] = useState(false);
  const [approvingDrafts, setApprovingDrafts] = useState(false);
  const [imgStats, setImgStats] = useState({ semImagem: 0, approved: 0, draft: 0, erro: 0 });

  // Revisão progressiva
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewArticle, setReviewArticle] = useState<Article | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [approvingArticle, setApprovingArticle] = useState(false);

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

  async function loadImageStats() {
    // contagens globais
    const [{ data: arts }, { data: imgs }] = await Promise.all([
      supabase.from("qa_kb_artigos" as any).select("id"),
      supabase.from("qa_kb_artigo_imagens" as any).select("article_id,status").neq("status", "archived"),
    ]);
    const allIds = new Set(((arts ?? []) as any[]).map(a => a.id));
    const withActive = new Set<string>();
    let approved = 0, draft = 0, erro = 0;
    for (const i of (imgs ?? []) as any[]) {
      if (i.status === "approved") { approved++; withActive.add(i.article_id); }
      else if (i.status === "draft") { draft++; withActive.add(i.article_id); }
      else if (i.status === "error") { erro++; }
    }
    setImgStats({ semImagem: allIds.size - withActive.size, approved, draft, erro });
  }
  useEffect(() => { loadImageStats(); }, [articles.length]);

  useEffect(() => {
    if (!selected) { setImages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("qa_kb_artigo_imagens" as any)
        .select("id,article_id,step_number,step_title,caption,image_url,status,error_message")
        .eq("article_id", selected.id)
        .neq("status", "archived")
        .order("step_number");
      setImages(((data ?? []) as any[]) as ArticleImage[]);
    })();
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return articles.filter(a => {
      if (filterCat !== "__all__" && a.category !== filterCat) return false;
      if (filterEmb !== "__all__") {
        const es = a.embedding_status ?? "pendente";
        if (es !== filterEmb) return false;
      }
      if (filterReview !== "__all__") {
        if (a.status !== filterReview) return false;
      }
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.symptoms.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [articles, filterCat, filterText, filterEmb, filterReview]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const embStats = useMemo(() => {
    const s = { gerado: 0, pendente: 0, erro: 0 };
    for (const a of articles) {
      const k = (a.embedding_status ?? "pendente") as "gerado" | "pendente" | "erro";
      if (k in s) s[k]++;
    }
    return s;
  }, [articles]);

  async function processPendingEmbeddings() {
    setProcessingEmb(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-embed", {
        body: { backfill: true, limit: 10 },
      });
      if (error) throw error;
      const d = data as any;
      toast.success(`Vetores: ${d?.processed ?? 0} processados, ${d?.failed ?? 0} falhas (lote de até 10).`);
      await loadAll();
    } catch (e: any) {
      toast.error("Erro ao processar vetores: " + (e?.message ?? "desconhecido"));
    } finally {
      setProcessingEmb(false);
    }
  }

  async function reprocessOne(articleId: string) {
    setReprocessingId(articleId);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-embed", {
        body: { article_id: articleId },
      });
      if (error) throw error;
      const d = data as any;
      if ((d?.processed ?? 0) > 0) toast.success("Vetor reprocessado.");
      else toast.error("Falha ao reprocessar vetor. Verifique os logs.");
      // pequeno delay para garantir que o trigger/log foi persistido
      await new Promise(r => setTimeout(r, 400));
      await Promise.all([
        loadAll(),
        loadLogs(),
      ]);
      if (selected?.id === articleId) {
        const { data: fresh } = await supabase.from("qa_kb_artigos" as any).select("*").eq("id", articleId).maybeSingle();
        if (fresh) setSelected(fresh as any as Article);
      }
    } catch (e: any) {
      toast.error("Erro ao reprocessar: " + (e?.message ?? "desconhecido"));
      await loadLogs().catch(() => {});
    } finally {
      setReprocessingId(null);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("qa_kb_embeddings_log" as any)
      .select("id, article_id, status, error_message, modelo, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error("Erro ao carregar logs: " + error.message);
    setLogs(((data ?? []) as any[]).map(r => ({
      id: r.id, article_id: r.article_id, status: r.status,
      error_message: r.error_message, modelo: r.modelo, created_at: r.created_at,
    })));
    setLogsLoading(false);
  }

  async function openLogs() {
    setShowLogs(true);
    await loadLogs();
  }

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
    setDraftDescription("");
  }
  function startEdit(a: Article) {
    setEditing({ ...a });
    setDraftDescription("");
  }

  async function generateWithAI() {
    if (!editing) return;
    if (!editing.title?.trim() && !draftDescription.trim()) {
      toast.error("Informe o título ou uma descrição para a IA gerar o rascunho.");
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-draft", {
        body: {
          title: editing.title || draftDescription.slice(0, 80),
          module: editing.module || "",
          audience: editing.audience || "equipe",
          description: draftDescription,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setEditing({
        ...editing,
        body: d.body || editing.body,
        tags: (d.tags?.length ? d.tags : editing.tags) ?? [],
        symptoms: (d.symptoms?.length ? d.symptoms : editing.symptoms) ?? [],
        status: "draft",
      });
      toast.success("Rascunho gerado pela IA. Revise e publique manualmente.");
    } catch (e: any) {
      toast.error("Erro ao gerar rascunho: " + (e?.message ?? "desconhecido"));
    } finally {
      setDrafting(false);
    }
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
    // dispara geração de embedding em background (não bloqueia)
    supabase.functions.invoke("qa-kb-embed", { body: { backfill: true } }).catch(() => {});
    // dispara geração automática de imagens em background (não bloqueia)
    const newId = (res as any)?.data?.[0]?.id ?? editing.id;
    if (newId) {
      supabase.functions.invoke("qa-kb-generate-article-images", {
        body: {
          article_id: newId,
          force: !editing.id ? false : true,
          // artigos da equipe e operacionais seguros já nascem aprovados
          approve: (editing.audience ?? "equipe") === "equipe" || (editing.audience === "cliente"),
        },
      }).catch(() => {});
      toast.message("Gerando imagens ilustrativas em segundo plano...");
    }
    setEditing(null);
    await loadAll();
  }

  async function regenerateImagesFor(articleId: string) {
    setGeneratingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-generate-article-images", {
        body: { article_id: articleId, force: true },
      });
      if (error) throw error;
      toast.success(`Imagens geradas (${(data as any)?.generated ?? 0}).`);
      // recarrega imagens do selecionado
      if (selected?.id === articleId) {
        const { data: imgs } = await supabase
          .from("qa_kb_artigo_imagens" as any)
          .select("id,article_id,step_number,step_title,caption,image_url,status,error_message")
          .eq("article_id", articleId).neq("status", "archived").order("step_number");
        setImages(((imgs ?? []) as any[]) as ArticleImage[]);
      }
    } catch (e: any) {
      toast.error("Erro ao gerar imagens: " + (e?.message ?? "desconhecido"));
    } finally {
      setGeneratingImages(false);
    }
  }

  async function backfillAllImages() {
    setBackfillingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-backfill-images", {
        body: { limit: 5, only_missing: true },
      });
      if (error) throw error;
      toast.success(`Lote processado: ${(data as any)?.processed ?? 0} artigo(s).`);
      await loadImageStats();
    } catch (e: any) {
      toast.error("Erro no backfill de imagens: " + (e?.message ?? "desconhecido"));
    } finally {
      setBackfillingImages(false);
    }
  }

  async function retryImageErrors() {
    setRetryingErrors(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-backfill-images", {
        body: { action: "retry_errors", limit: 10 },
      });
      if (error) throw error;
      toast.success(`Reprocessados: ${(data as any)?.retried ?? 0} artigo(s).`);
      await loadImageStats();
      if (selected) {
        const { data: imgs } = await supabase
          .from("qa_kb_artigo_imagens" as any)
          .select("id,article_id,step_number,step_title,caption,image_url,status,error_message")
          .eq("article_id", selected.id).neq("status", "archived").order("step_number");
        setImages(((imgs ?? []) as any[]) as ArticleImage[]);
      }
    } catch (e: any) {
      toast.error("Erro ao reprocessar: " + (e?.message ?? "desconhecido"));
    } finally {
      setRetryingErrors(false);
    }
  }

  async function approveSafeDrafts() {
    setApprovingDrafts(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-backfill-images", {
        body: { action: "approve_drafts" },
      });
      if (error) throw error;
      toast.success(`Aprovadas: ${(data as any)?.approved ?? 0} imagem(ns).`);
      await loadImageStats();
      if (selected) {
        const { data: imgs } = await supabase
          .from("qa_kb_artigo_imagens" as any)
          .select("id,article_id,step_number,step_title,caption,image_url,status,error_message")
          .eq("article_id", selected.id).neq("status", "archived").order("step_number");
        setImages(((imgs ?? []) as any[]) as ArticleImage[]);
      }
    } catch (e: any) {
      toast.error("Erro ao aprovar drafts: " + (e?.message ?? "desconhecido"));
    } finally {
      setApprovingDrafts(false);
    }
  }

  async function deleteArticle(a: Article) {
    if (!confirm(`Remover artigo "${a.title}"?`)) return;
    const { error } = await supabase.from("qa_kb_artigos" as any).delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido.");
    if (selected?.id === a.id) setSelected(null);
    await loadAll();
  }

  // ============ REVISÃO PROGRESSIVA ============
  async function approveArticle(a: Article) {
    setApprovingArticle(true);
    try {
      const newStatus = a.audience === "cliente" ? "published" : "audited";
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { error } = await supabase.from("qa_kb_artigos" as any).update({
        status: newStatus,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      }).eq("id", a.id);
      if (error) throw error;
      await supabase.from("qa_kb_article_reviews" as any).insert({
        article_id: a.id, action: "approved", reviewed_by: userId,
      });
      toast.success(`Artigo aprovado (${newStatus}).`);
      await loadAll();
      if (selected?.id === a.id) {
        const { data: fresh } = await supabase.from("qa_kb_artigos" as any).select("*").eq("id", a.id).maybeSingle();
        if (fresh) setSelected(fresh as any as Article);
      }
    } catch (e: any) {
      toast.error("Erro ao aprovar: " + (e?.message ?? "desconhecido"));
    } finally {
      setApprovingArticle(false);
    }
  }

  function openReview(a: Article) {
    setReviewArticle(a); setReviewReason(""); setReviewNotes(""); setReviewFile(null); setReviewOpen(true);
  }

  async function uploadReviewScreenshot(articleId: string, file: File): Promise<{ id: string | null; url: string | null }> {
    const path = `${articleId}/review-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("qa-kb-imagens").upload(path, file, {
      contentType: file.type || "image/png", upsert: false,
    });
    if (upErr) throw upErr;
    const url = supabase.storage.from("qa-kb-imagens").getPublicUrl(path).data.publicUrl;
    const { data: ins, error: insErr } = await supabase.from("qa_kb_artigo_imagens" as any).insert({
      article_id: articleId, step_number: 0, step_title: "Print de revisão",
      caption: "Print enviado durante revisão da equipe",
      image_url: url, storage_path: path, status: "approved",
      image_type: "upload_manual", route_path: window.location.pathname,
      captured_at: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    }).select("id").maybeSingle();
    if (insErr) throw insErr;
    return { id: (ins as any)?.id ?? null, url };
  }

  async function submitReviewRegenerate() {
    if (!reviewArticle) return;
    if (!reviewReason.trim()) { toast.error("Descreva o motivo da reprovação."); return; }
    setReviewSubmitting(true);
    try {
      let screenshotId: string | null = null;
      let screenshotUrl: string | null = null;
      if (reviewFile) {
        const r = await uploadReviewScreenshot(reviewArticle.id, reviewFile);
        screenshotId = r.id; screenshotUrl = r.url;
      }
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      // Marca rejeição antes de regenerar (registra o evento)
      await supabase.from("qa_kb_article_reviews" as any).insert({
        article_id: reviewArticle.id, action: "rejected",
        reason: reviewReason, notes: reviewNotes,
        screenshot_id: screenshotId, screenshot_url: screenshotUrl,
        reviewed_by: userId,
      });
      const { data, error } = await supabase.functions.invoke("qa-kb-regenerate-from-review", {
        body: {
          article_id: reviewArticle.id,
          reason: reviewReason, notes: reviewNotes,
          screenshot_id: screenshotId, screenshot_url: screenshotUrl,
          reviewed_by: userId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Artigo refeito pela IA — revise novamente.");
      setReviewOpen(false);
      await loadAll();
      const { data: fresh } = await supabase.from("qa_kb_artigos" as any).select("*").eq("id", reviewArticle.id).maybeSingle();
      if (fresh) setSelected(fresh as any as Article);
      // dispara embedding em background
      supabase.functions.invoke("qa-kb-embed", { body: { article_id: reviewArticle.id } }).catch(() => {});
    } catch (e: any) {
      toast.error("Erro ao refazer artigo: " + (e?.message ?? "desconhecido"));
    } finally {
      setReviewSubmitting(false);
    }
  }

  function statusBadgeColor(s: string) {
    switch (s) {
      case "published": return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "audited": return "bg-blue-100 text-blue-800 border-blue-300";
      case "needs_review": return "bg-amber-100 text-amber-800 border-amber-300";
      case "rejected": return "bg-red-100 text-red-800 border-red-300";
      case "draft": return "bg-slate-100 text-slate-700 border-slate-300";
      case "archived": return "bg-zinc-100 text-zinc-600 border-zinc-300";
      default: return "";
    }
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
                {(selected.status === "needs_review" || selected.status === "draft" || selected.status === "rejected") && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveArticle(selected)} disabled={approvingArticle}>
                    {approvingArticle ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
                    Aprovar artigo
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => openReview(selected)}>
                  <ThumbsDown className="h-4 w-4 mr-1" /> Reprovar e refazer
                </Button>
                <Button size="sm" variant="outline" onClick={() => reprocessOne(selected.id)} disabled={reprocessingId === selected.id}>
                  {reprocessingId === selected.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reprocessar vetor
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>
                  <Edit3 className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteArticle(selected)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={`${statusBadgeColor(selected.status)} text-[10px] uppercase`}>{selected.status}</Badge>
              {selected.visual_bug_detected && (
                <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] uppercase">⚠ bug visual detectado</Badge>
              )}
              {(() => {
                const hasReal = images.some(i => i.image_type === "screenshot_real" || i.image_type === "upload_manual");
                const hasIa = images.some(i => i.image_type === "imagem_ia" || !i.image_type);
                if (hasReal) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] uppercase">com print real</Badge>;
                if (hasIa) return <Badge className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] uppercase">apenas imagem IA</Badge>;
                return <Badge variant="outline" className="text-[10px] uppercase">sem print</Badge>;
              })()}
              {selected.last_review_reason && (
                <span className="text-[11px] text-muted-foreground italic">última reprovação: {selected.last_review_reason}</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2 text-[11px] uppercase font-mono text-muted-foreground">
              <span>Vetor:</span>
              {(() => {
                const es = selected.embedding_status ?? "pendente";
                if (es === "gerado") return <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> gerado</span>;
                if (es === "erro") return <span className="inline-flex items-center gap-1 text-red-700" title={selected.embedding_error ?? ""}><AlertCircle className="h-3 w-3" /> erro</span>;
                return <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="h-3 w-3" /> pendente</span>;
              })()}
              {selected.embedding_updated_at && <span>· {new Date(selected.embedding_updated_at).toLocaleString("pt-BR")}</span>}
            </div>
            <article className="prose prose-sm md:prose-base max-w-none">
              <ReactMarkdown>{selected.body}</ReactMarkdown>
            </article>
            {images.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Imagens ilustrativas ({images.length})
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => regenerateImagesFor(selected.id)} disabled={generatingImages}>
                    {generatingImages ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                    Regenerar imagens
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {images.map(img => (
                    <figure key={img.id} className="border rounded-md overflow-hidden bg-white">
                      {img.image_url ? (
                        <img src={img.image_url} alt={img.caption ?? img.step_title ?? "etapa"} className="w-full h-auto" loading="lazy" />
                      ) : (
                        <div className="aspect-video flex items-center justify-center bg-red-50 text-red-700 text-xs p-2">{img.error_message ?? "sem imagem"}</div>
                      )}
                      <figcaption className="p-2 text-[11px] uppercase font-mono flex items-center justify-between gap-2">
                        <span className="truncate">{img.step_number > 0 ? `${img.step_number}. ` : ""}{img.step_title ?? img.caption ?? "—"}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[9px] ${img.image_type === "screenshot_real" ? "border-emerald-400 text-emerald-700" : img.image_type === "upload_manual" ? "border-blue-400 text-blue-700" : "border-amber-400 text-amber-700"}`}>
                            {img.image_type === "screenshot_real" ? "PRINT REAL" : img.image_type === "upload_manual" ? "UPLOAD" : "IA"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">{img.status}</Badge>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
            {images.length === 0 && (
              <div className="mt-6 flex items-center justify-between border border-dashed rounded-md p-3">
                <span className="text-xs text-muted-foreground font-mono uppercase">Sem imagens vinculadas.</span>
                <Button size="sm" variant="outline" onClick={() => regenerateImagesFor(selected.id)} disabled={generatingImages}>
                  {generatingImages ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
                  Gerar imagens agora
                </Button>
              </div>
            )}
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
            {!editing.id && (
              <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase font-mono text-amber-700">
                  <Wand2 className="h-3.5 w-3.5" /> Gerar rascunho com IA
                </div>
                <Textarea
                  rows={2}
                  placeholder="Descreva o problema, a tela ou o fluxo. A IA vai gerar um rascunho operacional para revisão."
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={generateWithAI} disabled={drafting}>
                    {drafting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                    Gerar rascunho
                  </Button>
                </div>
                <p className="text-[10px] text-amber-700/80 uppercase font-mono">
                  O rascunho fica como DRAFT — revise antes de publicar.
                </p>
              </div>
            )}
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
            <Sparkles className="h-4 w-4 text-amber-600" /> Busca textual avançada + sintomas + tags
            <span className="text-[10px] font-normal text-muted-foreground normal-case">(com apoio vetorial experimental)</span>
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

      {/* Status técnico do vetor de apoio */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase font-mono flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" /> Vetor de apoio (experimental)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {embStats.gerado} gerado{embStats.gerado === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {embStats.pendente} pendente{embStats.pendente === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 text-red-700">
            <AlertCircle className="h-3.5 w-3.5" /> {embStats.erro} com erro
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={processPendingEmbeddings}
            disabled={processingEmb || (embStats.pendente === 0 && embStats.erro === 0)}
          >
            {processingEmb ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Processar embeddings pendentes
          </Button>
          <Button size="sm" variant="ghost" onClick={openLogs}>
            <ScrollText className="h-3.5 w-3.5 mr-1" /> Ver logs
          </Button>
          <Button size="sm" variant="ghost" onClick={backfillAllImages} disabled={backfillingImages}>
            {backfillingImages ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
            Gerar imagens pendentes
          </Button>
        </CardContent>
      </Card>

      {/* Painel de imagens da Base */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase font-mono flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" /> Base visual — status das imagens
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {imgStats.approved} approved
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {imgStats.draft} draft
          </span>
          <span className="inline-flex items-center gap-1 text-red-700">
            <AlertCircle className="h-3.5 w-3.5" /> {imgStats.erro} erro{imgStats.erro === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-700">
            <BookOpen className="h-3.5 w-3.5" /> {imgStats.semImagem} sem imagem
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={retryImageErrors} disabled={retryingErrors || imgStats.erro === 0}>
              {retryingErrors ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Reprocessar erros
            </Button>
            <Button size="sm" variant="outline" onClick={approveSafeDrafts} disabled={approvingDrafts || imgStats.draft === 0}>
              {approvingDrafts ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Aprovar drafts em lote
            </Button>
          </div>
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
        <Select value={filterEmb} onValueChange={setFilterEmb}>
          <SelectTrigger className="md:max-w-[200px]"><SelectValue placeholder="Status do vetor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Vetor: todos</SelectItem>
            <SelectItem value="gerado">Vetor: gerado</SelectItem>
            <SelectItem value="pendente">Vetor: pendente</SelectItem>
            <SelectItem value="erro">Vetor: erro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterReview} onValueChange={setFilterReview}>
          <SelectTrigger className="md:max-w-[220px]"><SelectValue placeholder="Status do artigo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Revisão: todos</SelectItem>
            <SelectItem value="needs_review">⏳ Aguardando revisão</SelectItem>
            <SelectItem value="audited">🔵 Auditado (equipe)</SelectItem>
            <SelectItem value="published">🟢 Publicado (cliente)</SelectItem>
            <SelectItem value="rejected">🔴 Reprovado</SelectItem>
            <SelectItem value="draft">📝 Rascunho</SelectItem>
            <SelectItem value="archived">📦 Arquivado</SelectItem>
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
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {a.status !== "published" && <Badge variant="outline" className="text-[10px]">{a.status}</Badge>}
                      {(() => {
                        const es = a.embedding_status ?? "pendente";
                        if (es === "gerado") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="vetor gerado" />;
                        if (es === "erro") return <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-label={a.embedding_error ?? "vetor com erro"} />;
                        return <Clock className="h-3.5 w-3.5 text-amber-600" aria-label="vetor pendente" />;
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {renderEditor()}

      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase font-mono text-sm flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Logs de geração de vetores
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="ghost" onClick={loadLogs} disabled={logsLoading}>
              {logsLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Atualizar
            </Button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8 uppercase font-mono">Nenhum registro.</p>
          ) : (
            <div className="space-y-1">
              {logs.map(l => {
                const art = articles.find(a => a.id === l.article_id);
                const ok = l.status === "sucesso";
                return (
                  <div key={l.id} className="border rounded-md p-2 text-xs flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          : <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold uppercase truncate">{art?.title ?? l.article_id}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase">
                        {l.status} · {new Date(l.created_at).toLocaleString("pt-BR")}{l.modelo ? ` · ${l.modelo}` : ""}
                      </div>
                      {l.error_message && (
                        <div className="text-[11px] text-red-700 mt-1 break-words">{l.error_message}</div>
                      )}
                    </div>
                    {art && !ok && (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => reprocessOne(art.id)} disabled={reprocessingId === art.id}>
                        {reprocessingId === art.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}