import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Eye, Send, RefreshCw, Sparkles, Upload, Image, X, Pencil, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Tecnologia Empresarial",
  "Infraestrutura de TI",
  "Segurança Digital",
  "Problemas de TI",
  "Custos de TI",
  "Conteúdo Regional",
  "Hospitais e Clínicas",
  "Cartórios",
  "Escritórios de Advocacia",
  "Escritórios de Contabilidade",
  "Empresas Corporativas",
];

const BATCH_TOPICS = [
  "Como escolher o melhor plano de suporte de TI para sua empresa",
  "Os 5 maiores riscos de não ter backup corporativo",
  "Por que trocar o servidor físico por infraestrutura em nuvem",
  "Como o firewall pfSense protege empresas contra ransomware",
  "Microsoft 365 vs Google Workspace: qual é melhor para empresas",
  "Quanto custa a terceirização de TI para pequenas empresas",
  "Sinais de que a rede da sua empresa precisa de reestruturação",
  "Como cartórios devem se adequar ao Provimento 213 do CNJ",
  "Locação de computadores vs compra: análise financeira completa",
  "Monitoramento de rede 24/7: por que sua empresa precisa",
];

interface AiPost {
  id: string;
  slug: string;
  title: string;
  status: string;
  category: string;
  tag: string;
  created_at: string;
  published_at: string | null;
  image_url?: string | null;
  image_source?: string | null;
  image_prompt?: string | null;
  image_alt_pt?: string | null;
}

type ImageSource = "manual_upload" | "ai_generated" | "url_input" | "library_select" | "fallback";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Map categories/tags to realistic visual scenarios
const CATEGORY_SCENES: Record<string, string> = {
  "Segurança": "cybersecurity breach alert on monitor screens, red warning lights, tense IT security team analyzing threat dashboard",
  "Infraestrutura": "server room with blinking status lights, IT technician inspecting rack-mounted servers and network cables",
  "Cloud": "modern data center with cloud infrastructure diagrams on glass board, IT team planning migration",
  "Redes": "corporate network operations center, ethernet cables, switches and routers, technician configuring equipment",
  "Suporte": "IT help desk professional assisting frustrated office worker at their desk, computer showing error screen",
  "Backup": "data recovery scenario, external drives and server backup systems, worried manager watching restore progress",
  "Locação": "brand new Dell computers being unboxed and set up in a modern corporate office by IT team",
  "Servidores": "enterprise server room with Dell PowerEdge servers, technician performing maintenance with monitoring screens",
  "Automação": "smart office with automated systems, digital dashboards controlling building systems, modern workspace",
  "Microsoft 365": "team collaborating on Microsoft 365 apps on multiple screens in a modern meeting room",
  "Firewall": "network security operations center, firewall rules on screen, IT analyst monitoring traffic logs",
  "Linux": "terminal screens with Linux commands, server administration, sysadmin working in data center",
};

function buildDefaultPrompt(context?: { title?: string; excerpt?: string; category?: string; tag?: string }) {
  const title = context?.title || "";
  const excerpt = context?.excerpt || "";
  const category = context?.category || "";
  const tag = context?.tag || "";

  // Find the best matching scene from category or tag
  const sceneKey = Object.keys(CATEGORY_SCENES).find(
    (k) => category.toLowerCase().includes(k.toLowerCase()) || tag.toLowerCase().includes(k.toLowerCase())
  );
  const sceneSuggestion = sceneKey ? CATEGORY_SCENES[sceneKey] : "corporate IT office environment with real employees and computer workstations";

  // Build a context-rich prompt based on the actual article content
  const prompt = [
    `Create a photorealistic, high-quality blog cover image for this specific article:`,
    `"${title}".`,
    excerpt ? `The article discusses: ${excerpt.slice(0, 200)}.` : "",
    `Visual scene: ${sceneSuggestion}.`,
    `MANDATORY STYLE RULES:`,
    `- Photorealistic, NOT abstract, NOT cartoon, NOT generic stock art`,
    `- Real people in a real corporate/business environment`,
    `- Natural lighting, professional photography look`,
    `- Show the actual problem or solution described in the title`,
    `- Emotional tone: urgency if about problems, confidence if about solutions`,
    `- NO glowing lines, NO futuristic abstract backgrounds, NO generic tech icons`,
    `- NO text or watermarks in the image`,
    `- 16:9 aspect ratio, suitable as a blog header`,
  ].filter(Boolean).join("\n");

  return prompt;
}

/* ── Cover Image Picker Component ── */
function CoverImagePicker({
  imageUrl,
  imageSource,
  onImageChange,
  disabled,
  context,
}: {
  imageUrl: string;
  imageSource: ImageSource;
  onImageChange: (url: string, source: ImageSource, meta?: { prompt?: string; alt_pt?: string }) => void;
  disabled?: boolean;
  context?: { title?: string; excerpt?: string; category?: string; tag?: string };
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGallery, setAiGallery] = useState<{ url: string; prompt: string }[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("blog-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(path);
      onImageChange(urlData.publicUrl, "manual_upload");
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message}`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateAi = async () => {
    const prompt = aiPrompt.trim() || buildDefaultPrompt(context);
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "generate_cover", topic: context?.title || "TI corporativa", image_prompt: prompt },
        headers: { "x-admin-token": sessionStorage.getItem("admin_token") || "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image_url) {
        setAiGallery((prev) => [...prev, { url: data.image_url, prompt }]);
        toast.success("Imagem gerada! Clique para selecionar.");
      } else {
        toast.error("Não foi possível gerar a imagem.");
      }
    } catch (err: any) {
      if (err.message?.includes("Rate limit")) {
        toast.error("Rate limit atingido. Aguarde alguns segundos e tente novamente.");
      } else if (err.message?.includes("Credits")) {
        toast.error("Créditos esgotados. Adicione fundos nas configurações.");
      } else {
        toast.error(`Erro ao gerar: ${err.message}`);
      }
    }
    setGeneratingAi(false);
  };

  const selectFromGallery = (item: { url: string; prompt: string }) => {
    onImageChange(item.url, "ai_generated", { prompt: item.prompt });
    toast.success("Imagem selecionada como capa!");
  };

  const removeFromGallery = (index: number) => {
    setAiGallery((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput.trim());
      onImageChange(urlInput.trim(), "url_input");
      setUrlInput("");
      setShowUrlInput(false);
      toast.success("URL da imagem definida!");
    } catch {
      toast.error("URL inválida.");
    }
  };

  const handleRemove = () => {
    onImageChange(FALLBACK_IMAGE, "fallback");
  };

  const sourceLabel: Record<ImageSource, string> = {
    manual_upload: "📤 Upload manual",
    ai_generated: "🤖 Gerada por IA",
    url_input: "🔗 URL externa",
    library_select: "📁 Biblioteca",
    fallback: "📷 Automática (fallback)",
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Imagem de Capa</label>

      {/* Preview */}
      <div className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-[16/9] max-h-48">
        <img
          src={imageUrl || FALLBACK_IMAGE}
          alt="Preview da capa"
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading}>
            <Upload size={14} className="mr-1" /> Trocar
          </Button>
          {imageSource !== "fallback" && (
            <Button size="sm" variant="destructive" onClick={handleRemove} disabled={disabled}>
              <X size={14} className="mr-1" /> Remover
            </Button>
          )}
        </div>
        <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/60 text-white px-2 py-0.5 rounded">
          {sourceLabel[imageSource]}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading}>
          {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
          Upload
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowAiPanel(!showAiPanel)} disabled={disabled}>
          <Sparkles size={14} className="mr-1" /> Gerar por IA
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowUrlInput(!showUrlInput)} disabled={disabled}>
          <Image size={14} className="mr-1" /> URL
        </Button>
      </div>

      {/* AI Generation Panel */}
      {showAiPanel && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">🎯 Gerar capa contextualizada por IA</p>
            {!aiPrompt && context?.title && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setAiPrompt(buildDefaultPrompt(context))}>
                Carregar prompt automático
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            O prompt é gerado automaticamente baseado no título e conteúdo do post. Você pode editá-lo livremente antes de gerar.
          </p>
          <textarea
            className="w-full h-28 p-2 text-xs bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground resize-none font-mono"
            placeholder={context?.title ? buildDefaultPrompt(context).slice(0, 300) + "..." : "Descreva a imagem desejada..."}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleGenerateAi} disabled={generatingAi}>
              {generatingAi ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
              {aiGallery.length > 0 ? "Gerar Mais" : "Gerar Imagem"}
            </Button>
            {aiGallery.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setAiGallery([])}>
                <Trash2 size={14} className="mr-1" /> Limpar galeria
              </Button>
            )}
          </div>

          {/* AI Gallery */}
          {aiGallery.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{aiGallery.length} imagem(ns) gerada(s) — clique para selecionar:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {aiGallery.map((item, i) => (
                  <div key={i} className="relative group/item rounded-md overflow-hidden border border-border aspect-[16/9] cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => selectFromGallery(item)}
                  >
                    <img src={item.url} alt={`Opção ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); selectFromGallery(item); }}>
                        <Check size={12} className="mr-1" /> Usar
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); removeFromGallery(i); }}>
                        <X size={12} />
                      </Button>
                    </div>
                    <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            placeholder="https://exemplo.com/imagem.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="bg-card text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          />
          <Button size="sm" onClick={handleUrlSubmit}>OK</Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}

/* ── Edit Cover Modal ── */
function EditCoverModal({
  post,
  onClose,
  onSaved,
}: {
  post: AiPost;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(post.image_url || FALLBACK_IMAGE);
  const [imageSource, setImageSource] = useState<ImageSource>((post.image_source as ImageSource) || "fallback");
  const [imagePrompt, setImagePrompt] = useState(post.image_prompt || "");
  const [altPt, setAltPt] = useState(post.image_alt_pt || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("generate-blog-post", {
        body: {
          action: "update_cover",
          post_id: post.id,
          image_url: imageUrl,
          image_source: imageSource,
          image_prompt: imagePrompt || undefined,
          image_alt_pt: altPt || undefined,
        },
        headers: { "x-admin-token": sessionStorage.getItem("admin_token") || "" },
      });
      if (error) throw error;
      toast.success("Capa atualizada!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Editar Capa — {post.title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <CoverImagePicker
          imageUrl={imageUrl}
          imageSource={imageSource}
          onImageChange={(url, src, meta) => {
            setImageUrl(url);
            setImageSource(src);
            if (meta?.prompt) setImagePrompt(meta.prompt);
          }}
          context={{ title: post.title, category: post.category, tag: post.tag }}
        />
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Texto alternativo (SEO)</label>
          <Input
            placeholder="Descrição da imagem para acessibilidade..."
            value={altPt}
            onChange={(e) => setAltPt(e.target.value)}
            className="bg-card text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Salvar Capa
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function AdminBlogGenerator() {
  const [posts, setPosts] = useState<AiPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Tecnologia Empresarial");
  const [customTopics, setCustomTopics] = useState("");

  // Cover image state for single generation
  const [coverUrl, setCoverUrl] = useState(FALLBACK_IMAGE);
  const [coverSource, setCoverSource] = useState<ImageSource>("fallback");
  const [coverPrompt, setCoverPrompt] = useState("");

  // Edit cover modal
  const [editingPost, setEditingPost] = useState<AiPost | null>(null);

  const getToken = () => sessionStorage.getItem("admin_token") || "";

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "list" },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      setPosts(data?.posts || []);
    } catch (e) {
      toast.error("Erro ao carregar posts");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error("Digite um tópico");
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: {
          action: "generate",
          topic,
          category,
          image_url: coverSource !== "fallback" ? coverUrl : undefined,
          image_source: coverSource,
          image_prompt: coverPrompt || undefined,
        },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Artigo gerado: ${data.post?.title}`);
      setTopic("");
      setCoverUrl(FALLBACK_IMAGE);
      setCoverSource("fallback");
      setCoverPrompt("");
      fetchPosts();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar artigo");
    }
    setGenerating(false);
  };

  const handlePublish = async (postId: string) => {
    try {
      const { error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "publish", post_id: postId },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      toast.success("Post publicado!");
      fetchPosts();
    } catch {
      toast.error("Erro ao publicar");
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Excluir este post?")) return;
    try {
      const { error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "delete", post_id: postId },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      toast.success("Post excluído");
      fetchPosts();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleBatchGenerate = async () => {
    const topics = customTopics.trim()
      ? customTopics.split("\n").map((t) => t.trim()).filter(Boolean)
      : BATCH_TOPICS;

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: topics.length });

    for (let i = 0; i < topics.length; i++) {
      setBatchProgress({ current: i + 1, total: topics.length });
      try {
        await supabase.functions.invoke("generate-blog-post", {
          body: { action: "generate", topic: topics[i], category },
          headers: { "x-admin-token": getToken() },
        });
        if (i < topics.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (e: any) {
        toast.error(`Erro no tópico ${i + 1}: ${e.message}`);
        if (e.message?.includes("Rate limit")) {
          toast.info("Aguardando rate limit... Continuando em 30s");
          await new Promise((r) => setTimeout(r, 30000));
        }
      }
    }

    setBatchRunning(false);
    toast.success(`Geração em lote concluída: ${topics.length} artigos`);
    fetchPosts();
  };

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const draftCount = posts.filter((p) => p.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{posts.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{draftCount}</p>
            <p className="text-xs text-muted-foreground">Rascunhos</p>
          </CardContent>
        </Card>
      </div>

      {/* Single Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Gerar Artigo com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Tópico do artigo (ex: Como proteger sua empresa contra ransomware)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="bg-card"
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cover Image Picker */}
          <CoverImagePicker
            imageUrl={coverUrl}
            imageSource={coverSource}
            onImageChange={(url, src, meta) => {
              setCoverUrl(url);
              setCoverSource(src);
              if (meta?.prompt) setCoverPrompt(meta.prompt);
            }}
            disabled={generating}
            context={{ title: topic, category }}
          />

          <Button onClick={handleGenerate} disabled={generating || !topic.trim()} className="w-full sm:w-auto">
            {generating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
            Gerar Artigo
          </Button>
        </CardContent>
      </Card>

      {/* Batch Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Geração em Lote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full h-32 p-3 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground resize-none"
            placeholder={`Cole os tópicos (um por linha) ou deixe vazio para usar os ${BATCH_TOPICS.length} tópicos sugeridos:\n\n${BATCH_TOPICS.slice(0, 3).join("\n")}...`}
            value={customTopics}
            onChange={(e) => setCustomTopics(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleBatchGenerate} disabled={batchRunning || generating} size="sm" variant="default">
              {batchRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                <>
                  <Sparkles size={14} className="mr-1" />
                  Gerar {customTopics.trim() ? customTopics.split("\n").filter(Boolean).length : BATCH_TOPICS.length} Artigos
                </>
              )}
            </Button>
            {batchRunning && (
              <p className="text-xs text-muted-foreground">
                Gerando artigo {batchProgress.current} de {batchProgress.total}...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Artigos Gerados</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPosts} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhum artigo gerado ainda</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-10 rounded overflow-hidden shrink-0 bg-muted border border-border">
                    <img
                      src={post.image_url || FALLBACK_IMAGE}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-[10px]">
                        {post.status === "published" ? "Publicado" : "Rascunho"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{post.category}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditingPost(post)} title="Editar capa">
                      <Pencil size={14} className="text-primary" />
                    </Button>
                    {post.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => handlePublish(post.id)} title="Publicar">
                        <Send size={14} className="text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => window.open(`/blog/${post.slug}`, "_blank")} title="Visualizar">
                      <Eye size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} title="Excluir">
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Cover Modal */}
      {editingPost && (
        <EditCoverModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={fetchPosts}
        />
      )}
    </div>
  );
}
