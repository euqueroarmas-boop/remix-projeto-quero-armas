import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, HelpCircle, ArrowLeft, Sparkles, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Article = {
  id: string; title: string; slug: string; category: string;
  module: string | null; body: string;
};

interface CentralAjudaClienteProps {
  cliente: { id: number; nome_completo: string; cpf?: string | null } | null;
}

export function CentralAjudaCliente({ cliente }: CentralAjudaClienteProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Article | null>(null);
  const [selectedImages, setSelectedImages] = useState<Array<{ id: string; image_url: string | null; step_number: number; step_title: string | null; caption: string | null }>>([]);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiHits, setAiHits] = useState<Array<{ id: string; title: string; category: string }>>([]);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("qa_kb_artigos" as any)
        .select("id,title,slug,category,module,body")
        .eq("status", "published")
        .eq("audience", "cliente")
        .order("category")
        .order("title");
      if (!error) {
        const list = (data as any[]) ?? [];
        // Cliente só pode ver artigos que já tenham PRINT REAL ou UPLOAD MANUAL aprovado.
        // (Imagens geradas por IA não contam.)
        const ids = list.map((a) => a.id);
        if (ids.length === 0) { setArticles([]); setLoading(false); return; }
        const { data: imgs } = await supabase
          .from("qa_kb_artigo_imagens" as any)
          .select("article_id,image_type,status,is_ai_generated_blocked,original_image_type")
          .in("article_id", ids)
          .eq("status", "approved")
          .eq("is_ai_generated_blocked", false)
          .neq("original_image_type", "imagem_ia")
          .in("image_type", ["screenshot_real", "upload_manual", "documento_real", "auditoria_real"]);
        const okSet = new Set<string>(((imgs as any[]) ?? []).map((i) => i.article_id));
        setArticles(list.filter((a) => okSet.has(a.id)));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) { setSelectedImages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("qa_kb_artigo_imagens" as any)
        .select("id,image_url,step_number,step_title,caption,image_type")
        .eq("article_id", selected.id)
        .eq("status", "approved")
        .in("image_type", ["screenshot_real", "upload_manual", "documento_real", "auditoria_real"])
        .eq("is_ai_generated_blocked", false)
        .neq("original_image_type", "imagem_ia")
        .order("step_number");
      setSelectedImages(((data ?? []) as any[]));
    })();
  }, [selected?.id]);

  async function ask() {
    if (aiQuery.trim().length < 3) {
      toast.error("Digite sua dúvida com mais detalhes.");
      return;
    }
    setAiLoading(true); setAiAnswer(""); setAiHits([]);
    try {
      const { data, error } = await supabase.functions.invoke("qa-kb-search-cliente", {
        body: { query: aiQuery, limit: 5 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiAnswer((data as any).answer ?? "");
      setAiHits((data as any).articles ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar");
    } finally { setAiLoading(false); }
  }

  function escalarParaEquipe() {
    if (!cliente) {
      toast.error("Faça login novamente para falar com a equipe.");
      return;
    }
    if (!aiQuery.trim()) return;

    // 1) Monta URL e abre o WhatsApp SÍNCRONO (dentro do gesto do clique)
    //    para não ser bloqueado por popup blocker.
    const cpfPart = cliente.cpf ? `, CPF ${cliente.cpf}` : "";
    const respostaPart = aiAnswer ? `A resposta que recebi foi:\n${aiAnswer}\n\n` : "";
    const texto =
      `Olá! Sou ${cliente.nome_completo}${cpfPart}.\n\n` +
      `Perguntei na Central de Ajuda: "${aiQuery}"\n\n` +
      respostaPart +
      `Isso não resolveu minha dúvida, pode me ajudar?`;
    const url = `https://wa.me/5511978481919?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    // 2) Registra em segundo plano (sem bloquear o clique).
    setEscalating(true);
    supabase
      .from("qa_central_ajuda_perguntas" as any)
      .insert({
        cliente_id: cliente.id,
        pergunta: aiQuery,
        resposta_ia: aiAnswer || null,
        artigos_relacionados: aiHits.map((h) => ({ id: h.id, title: h.title })),
        status: "escalada_whatsapp",
      })
      .then(({ error }) => {
        if (error) {
          toast.error("Abrimos o WhatsApp, mas não foi possível registrar o histórico.");
        } else {
          toast.success("Sua pergunta foi registrada. Continue a conversa no WhatsApp que abrimos.");
        }
      })
      .finally(() => setEscalating(false));
  }

  if (selected) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selected.title}</CardTitle>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{selected.category}</p>
          </CardHeader>
          <CardContent>
            <article className="prose prose-sm max-w-none">
              <ReactMarkdown>{selected.body}</ReactMarkdown>
            </article>
            {selectedImages.length > 0 && (
              <div className="mt-4 grid gap-3">
                {selectedImages.map(img => (
                  <figure key={img.id} className="border rounded-md overflow-hidden bg-white">
                    {img.image_url && (
                      <img src={img.image_url} alt={img.caption ?? img.step_title ?? "ilustração"} className="w-full h-auto" loading="lazy" />
                    )}
                    {(img.step_title || img.caption) && (
                      <figcaption className="p-2 text-[11px] text-slate-600">
                        {img.step_number > 0 ? `${img.step_number}. ` : ""}{img.step_title ?? img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-amber-600" />
        <h2 className="font-bold text-base">Central de Ajuda</h2>
      </div>

      <Card className="border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" /> Pergunte com suas palavras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: como reenvio um documento que foi reprovado?"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
            />
            <Button onClick={ask} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {aiAnswer && (
            <div className="rounded-md bg-amber-50/60 border border-amber-200 p-3 prose prose-sm max-w-none">
              <ReactMarkdown>{aiAnswer}</ReactMarkdown>
            </div>
          )}
          {aiHits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {aiHits.map((h) => {
                const a = articles.find((x) => x.id === h.id);
                return (
                  <Button key={h.id} size="sm" variant="outline" className="text-xs"
                    onClick={() => a && setSelected(a)}>
                    {h.title}
                  </Button>
                );
              })}
            </div>
          )}
          {aiAnswer && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={escalarParaEquipe}
                disabled={escalating}
                className="border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {escalating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                )}
                Não resolveu? Falar com a equipe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : articles.length === 0 ? (
        <p className="text-sm text-center text-slate-500 py-6">Nenhum artigo disponível.</p>
      ) : (
        <div className="grid gap-2">
          {articles.map((a) => (
            <button key={a.id} onClick={() => setSelected(a)}
              className="text-left border rounded-md p-3 hover:bg-amber-50/40 transition-colors">
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-[11px] text-slate-500 uppercase mt-0.5">{a.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}