import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
    const map: Record<string, string> = {
      rascunho: "text-slate-500", em_revisao: "text-amber-400", corrigido: "text-blue-400",
      aprovado: "text-emerald-400", aprovado_como_referencia: "text-purple-400", rejeitado: "text-red-400",
    };
    return map[s] || "text-slate-500";
  };

  return (
    <div className="space-y-3 md:space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm md:text-base font-semibold text-slate-700">Histórico</h1>
        <div className="flex gap-0.5">
          <button onClick={() => setTab("geracoes")}
            className={`px-2.5 py-1 rounded text-[10px] md:text-[11px] uppercase tracking-wider font-medium transition-colors ${
              tab === "geracoes" ? "bg-[#7a1528] text-slate-700" : "text-slate-400 hover:text-slate-600"
            }`}>Peças</button>
          <button onClick={() => setTab("consultas")}
            className={`px-2.5 py-1 rounded text-[10px] md:text-[11px] uppercase tracking-wider font-medium transition-colors ${
              tab === "consultas" ? "bg-[#7a1528] text-slate-700" : "text-slate-400 hover:text-slate-600"
            }`}>Consultas</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-[11px]">Nenhum registro</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[1fr_120px_80px_80px_60px] gap-2 px-3 py-1.5 border-b border-slate-200 text-[9px] text-slate-400 uppercase tracking-[0.12em]">
            <span>Título</span><span>Tipo</span><span>Status</span><span>Data</span><span className="text-right">Ações</span>
          </div>
          {items.map((item: any) => (
            <div key={item.id} className="border-b border-slate-200/40 hover:bg-[#7a1528]/50 transition-colors">
              {/* Mobile */}
              <div className="md:hidden px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{item.titulo_geracao || item.caso_titulo || "Sem título"}</span>
                  <span className={`text-[8px] font-mono shrink-0 ${statusBadge(item.status_revisao || "")}`}>
                    {(item.status_revisao || "—").replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-slate-400 font-mono truncate">{(item.tipo_peca || "—").replace(/_/g, " ")}</span>
                  <span className="text-[8px] text-slate-300 font-mono tabular-nums ml-auto">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                  <button onClick={() => setDetailItem(item)} className="p-0.5 text-slate-400 hover:text-slate-600"><Eye className="h-3 w-3" /></button>
                  {tab === "geracoes" && canReview && (
                    <button onClick={() => openReview(item)} className="p-0.5 text-slate-400 hover:text-slate-600"><MessageSquare className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden md:grid grid-cols-[1fr_120px_80px_80px_60px] gap-2 px-3 py-2 items-center">
                <span className="text-[12px] text-slate-600 truncate">{item.titulo_geracao || item.caso_titulo || "Sem título"}</span>
                <span className="text-[10px] text-slate-400 font-mono truncate">{(item.tipo_peca || "—").replace(/_/g, " ")}</span>
                <span className={`text-[10px] font-mono ${statusBadge(item.status_revisao || "")}`}>{(item.status_revisao || "—").replace(/_/g, " ")}</span>
                <span className="text-[10px] text-slate-300 font-mono tabular-nums">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                <div className="flex justify-end gap-0.5">
                  <button onClick={() => setDetailItem(item)} className="p-1 text-slate-400 hover:text-slate-600"><Eye className="h-3.5 w-3.5" /></button>
                  {tab === "geracoes" && canReview && (
                    <button onClick={() => openReview(item)} className="p-1 text-slate-400 hover:text-slate-600"><MessageSquare className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="bg-white border-slate-200 text-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-slate-700 text-sm">{detailItem?.titulo_geracao || detailItem?.caso_titulo || "Detalhes"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.length > 0 && (
              <div>
                <span className="text-[9px] text-slate-400 uppercase tracking-[0.12em]">Fontes</span>
                <div className="space-y-0.5 mt-1">
                  {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-neutral-700 shrink-0" />
                      <span className="truncate">{f.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-[9px] text-slate-400 uppercase tracking-[0.12em]">{tab === "geracoes" ? "Minuta" : "Resposta"}</span>
              <div className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed bg-white rounded p-2.5 max-h-[350px] overflow-y-auto mt-1 font-serif">
                {detailItem?.minuta_gerada || detailItem?.resposta_ia}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
          <DialogHeader><DialogTitle className="text-slate-700 text-sm">Revisão</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label className="text-[9px] text-slate-400 uppercase tracking-wider">Minuta (editável)</Label>
              <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                className="bg-white border-slate-200 text-slate-600 min-h-[200px] md:min-h-[300px] font-serif text-[11px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-slate-400 uppercase tracking-wider">Justificativa</Label>
              <Textarea value={reviewJustificativa} onChange={e => setReviewJustificativa(e.target.value)}
                className="bg-white border-slate-200 text-slate-600 min-h-[50px] text-[11px]" placeholder="Opcional" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button onClick={() => submitReview("aprovacao")} disabled={saving} size="sm"
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/20 h-7 text-[10px]">
                <ThumbsUp className="h-3 w-3 mr-1" /> Aprovar
              </Button>
              <Button onClick={() => submitReview("referencia", true)} disabled={saving} size="sm"
                className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-600/20 h-7 text-[10px]">
                <Star className="h-3 w-3 mr-1" /> Ref
              </Button>
              <Button onClick={() => submitReview("correcao")} disabled={saving} size="sm"
                className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/20 h-7 text-[10px]">
                <PenTool className="h-3 w-3 mr-1" /> Corrigir
              </Button>
              <Button onClick={() => submitReview("rejeicao")} disabled={saving} size="sm"
                className="bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20 h-7 text-[10px]">
                <ThumbsDown className="h-3 w-3 mr-1" /> Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
