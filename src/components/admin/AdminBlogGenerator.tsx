import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Eye, Send, RefreshCw, Sparkles, Upload, Image, X, Pencil } from "lucide-react";
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
}

type ImageSource = "manual_upload" | "ai_generated" | "url_input" | "fallback";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/* ── Cover Image Picker Component ── */
function CoverImagePicker({
  imageUrl,
  imageSource,
  onImageChange,
  disabled,
}: {
  imageUrl: string;
  imageSource: ImageSource;
  onImageChange: (url: string, source: ImageSource) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

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
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "generate_cover", topic: "imagem de capa para blog de TI corporativa, tecnologia, servidores, redes" },
        headers: { "x-admin-token": sessionStorage.getItem("admin_token") || "" },
      });
      if (error) throw error;
      if (data?.image_url) {
        onImageChange(data.image_url, "ai_generated");
        toast.success("Capa gerada por IA!");
      } else {
        toast.error("Não foi possível gerar a imagem.");
      }
    } catch (err: any) {
      toast.error(`Erro ao gerar capa: ${err.message}`);
    }
    setGeneratingAi(false);
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
          Upload
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerateAi}
          disabled={disabled || generatingAi}
        >
          {generatingAi ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
          Gerar por IA
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowUrlInput(!showUrlInput)}
          disabled={disabled}
        >
          <Image size={14} className="mr-1" /> URL
        </Button>
      </div>

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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("generate-blog-post", {
        body: { action: "update_cover", post_id: post.id, image_url: imageUrl, image_source: imageSource },
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
      <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Editar Capa — {post.title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <CoverImagePicker
          imageUrl={imageUrl}
          imageSource={imageSource}
          onImageChange={(url, src) => { setImageUrl(url); setImageSource(src); }}
        />
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
        },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Artigo gerado: ${data.post?.title}`);
      setTopic("");
      setCoverUrl(FALLBACK_IMAGE);
      setCoverSource("fallback");
      fetchPosts();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar artigo");
    }
    setGenerating(false);
  };

  const handlePublish = async (postId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
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
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
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
            onImageChange={(url, src) => { setCoverUrl(url); setCoverSource(src); }}
            disabled={generating}
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
