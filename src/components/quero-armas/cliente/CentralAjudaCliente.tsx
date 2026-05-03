import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, HelpCircle, ArrowLeft, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Article = {
  id: string; title: string; slug: string; category: string;
  module: string | null; body: string;
};

export function CentralAjudaCliente() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Article | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiHits, setAiHits] = useState<Array<{ id: string; title: string; category: string }>>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("qa_kb_artigos" as any)
        .select("id,title,slug,category,module,body")
        .eq("status", "published")
        .eq("audience", "cliente")
        .order("category")
        .order("title");
      if (!error) setArticles((data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

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