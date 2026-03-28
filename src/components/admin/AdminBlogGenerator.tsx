import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Eye, Send, RefreshCw, Sparkles } from "lucide-react";
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
}

export default function AdminBlogGenerator() {
  const [posts, setPosts] = useState<AiPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Tecnologia Empresarial");
  const [customTopics, setCustomTopics] = useState("");

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
        body: { action: "generate", topic, category },
        headers: { "x-admin-token": getToken() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Artigo gerado: ${data.post?.title}`);
      setTopic("");
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
        // Delay between requests to avoid rate limiting
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
        <CardContent className="space-y-3">
          <Input
            placeholder="Tópico do artigo (ex: Como proteger sua empresa contra ransomware)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="bg-card"
          />
          <div className="flex gap-2">
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
            <Button onClick={handleGenerate} disabled={generating || !topic.trim()} size="sm">
              {generating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              Gerar
            </Button>
          </div>
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
                  className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50 border border-border"
                >
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
    </div>
  );
}
