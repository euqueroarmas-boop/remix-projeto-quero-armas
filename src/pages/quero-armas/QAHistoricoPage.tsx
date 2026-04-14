import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, PenTool, Eye, ThumbsUp, ThumbsDown, Star,
  Scale, Gavel, BookOpen, CheckCircle, MessageSquare,
} from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

type TabType = "consultas" | "geracoes";

export default function QAHistoricoPage() {
  const { user, profile } = useQAAuth();
  const [tab, setTab] = useState<TabType>("geracoes");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewJustificativa, setReviewJustificativa] = useState("");
  const [saving, setSaving] = useState(false);

  const canReview = profile?.perfil && ["administrador", "advogado"].includes(profile.perfil);

  const load = async () => {
    setLoading(true);
    if (tab === "consultas") {
      const { data } = await supabase.from("qa_consultas_ia" as any)
        .select("*").order("created_at", { ascending: false }).limit(50);
      setItems((data as any[]) ?? []);
    } else {
      const { data } = await supabase.from("qa_geracoes_pecas" as any)
        .select("*").order("created_at", { ascending: false }).limit(50);
      setItems((data as any[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const openReview = (item: any) => {
    setReviewItem(item);
    setReviewText(item.minuta_gerada || "");
    setReviewJustificativa("");
    setReviewOpen(true);
  };

  const submitReview = async (tipo: string, virarRef: boolean = false) => {
    if (!reviewItem) return;
    setSaving(true);
    try {
      await supabase.from("qa_revisoes_pecas" as any).insert({
        geracao_id: reviewItem.id,
        usuario_id: user?.id,
        texto_original: reviewItem.minuta_gerada,
        texto_revisado: tipo === "aprovacao" ? reviewItem.minuta_gerada : reviewText,
        tipo_revisao: tipo,
        justificativa: reviewJustificativa || null,
        aprovada: tipo === "aprovacao" || tipo === "referencia",
        virou_referencia: virarRef,
      });
      const newStatus = tipo === "rejeicao" ? "rejeitado" :
        virarRef ? "aprovado_como_referencia" :
        tipo === "aprovacao" ? "aprovado" : "corrigido";
      await supabase.from("qa_geracoes_pecas" as any)
        .update({ status_revisao: newStatus } as any)
        .eq("id", reviewItem.id);
      if (virarRef) {
        await supabase.from("qa_referencias_preferenciais" as any).insert({
          tipo_referencia: "geracao_aprovada",
          origem_id: reviewItem.id,
          motivo_priorizacao: reviewJustificativa || "Aprovada como referência",
          peso_manual: 1.5,
        });
      }
      await supabase.from("qa_logs_auditoria" as any).insert({
        usuario_id: user?.id,
        entidade: "qa_revisoes_pecas",
        entidade_id: reviewItem.id,
        acao: `revisao_${tipo}`,
        detalhes_json: { virou_referencia: virarRef, status: newStatus },
      });
      toast.success("Revisão salva");
      setReviewOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      rascunho: { bg: "bg-slate-100", text: "text-slate-600" },
      em_revisao: { bg: "bg-amber-50", text: "text-amber-700" },
      corrigido: { bg: "bg-blue-50", text: "text-blue-700" },
      aprovado: { bg: "bg-emerald-50", text: "text-emerald-700" },
      aprovado_como_referencia: { bg: "bg-purple-50", text: "text-purple-700" },
      rejeitado: { bg: "bg-red-50", text: "text-red-600" },
    };
    return map[s] || { bg: "bg-slate-100", text: "text-slate-500" };
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>Histórico</h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Peças geradas e consultas à IA</p>
        </div>
        <div className="flex gap-1 bg-white border rounded-xl p-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <button onClick={() => setTab("geracoes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "geracoes" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}>Peças</button>
          <button onClick={() => setTab("consultas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === "consultas" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}>Consultas</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16" style={{ color: "hsl(220 10% 55%)" }}>
          <p className="text-sm">Nenhum registro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const badge = statusBadge(item.status_revisao || "");
            return (
              <div key={item.id} className="qa-card qa-hover-lift p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate uppercase" style={{ color: "hsl(220 20% 18%)" }}>
                      {item.titulo_geracao || item.caso_titulo || "Sem título"}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="qa-badge text-[10px] uppercase">{(item.tipo_peca || "—").replace(/_/g, " ")}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text} uppercase`}>
                        {(item.status_revisao || "—").replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] tabular-nums" style={{ color: "hsl(220 10% 62%)" }}>
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setDetailItem(item)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ color: "hsl(220 10% 55%)" }}>
                      <Eye className="h-4 w-4" />
                    </button>
                    {tab === "geracoes" && canReview && (
                      <button onClick={() => openReview(item)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ color: "hsl(220 10% 55%)" }}>
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>
              {detailItem?.titulo_geracao || detailItem?.caso_titulo || "Detalhes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.length > 0 && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>Fontes</span>
                <div className="space-y-0.5 mt-1">
                  {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(220 10% 45%)" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span className="truncate uppercase">{f.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>{tab === "geracoes" ? "Minuta" : "Resposta"}</span>
              <div className="text-[13px] whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4 max-h-[350px] overflow-y-auto mt-1 font-serif" style={{ color: "hsl(220 20% 25%)" }}>
                {detailItem?.minuta_gerada || detailItem?.resposta_ia}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="bg-white border-slate-200 max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Revisão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Minuta (editável)</Label>
              <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                className="bg-white border-slate-200 min-h-[200px] md:min-h-[300px] font-serif text-[13px]" style={{ color: "hsl(220 20% 25%)" }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Justificativa</Label>
              <Textarea value={reviewJustificativa} onChange={e => setReviewJustificativa(e.target.value)}
                className="bg-white border-slate-200 min-h-[50px] text-sm uppercase" placeholder="Opcional" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => submitReview("aprovacao")} disabled={saving}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">
                <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
              </button>
              <button onClick={() => submitReview("referencia", true)} disabled={saving}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all">
                <Star className="h-3.5 w-3.5" /> Ref
              </button>
              <button onClick={() => submitReview("correcao")} disabled={saving}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all">
                <PenTool className="h-3.5 w-3.5" /> Corrigir
              </button>
              <button onClick={() => submitReview("rejeicao")} disabled={saving}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">
                <ThumbsDown className="h-3.5 w-3.5" /> Rejeitar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
