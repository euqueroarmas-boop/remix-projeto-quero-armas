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
  Scale, Gavel, BookOpen, CheckCircle, MessageSquare, Bot,
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
      rascunho: "text-slate-500",
      em_revisao: "text-amber-400",
      corrigido: "text-blue-400",
      aprovado: "text-emerald-400",
      aprovado_como_referencia: "text-purple-400",
      rejeitado: "text-red-400",
    };
    return map[s] || "text-slate-500";
  };

  const scoreColor = (s: number) => {
    if (s >= 0.7) return "text-emerald-400";
    if (s >= 0.4) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-base font-semibold text-slate-300">Histórico</h1>
        <div className="flex gap-1">
          <button onClick={() => setTab("geracoes")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider font-medium transition-colors ${
              tab === "geracoes" ? "bg-[#14142a] text-slate-300" : "text-slate-600 hover:text-slate-400"
            }`}>
            Peças
          </button>
          <button onClick={() => setTab("consultas")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-wider font-medium transition-colors ${
              tab === "consultas" ? "bg-[#14142a] text-slate-300" : "text-slate-600 hover:text-slate-400"
            }`}>
            Consultas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-[12px]">Nenhum registro encontrado</div>
      ) : (
        <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_80px_80px_60px] gap-2 px-3 py-2 border-b border-[#1a1a2e] text-[9px] text-slate-600 uppercase tracking-[0.15em]">
            <span>Título</span>
            <span>Tipo</span>
            <span>Status</span>
            <span>Data</span>
            <span className="text-right">Ações</span>
          </div>
          {items.map((item: any) => (
            <div key={item.id} className="grid grid-cols-[1fr_120px_80px_80px_60px] gap-2 px-3 py-2 border-b border-[#1a1a2e]/50 hover:bg-[#14142a]/50 transition-colors items-center">
              <span className="text-[12px] text-slate-400 truncate">
                {item.titulo_geracao || item.caso_titulo || "Sem título"}
              </span>
              <span className="text-[10px] text-slate-600 font-mono truncate">
                {(item.tipo_peca || item.tipo_peca || "—").replace(/_/g, " ")}
              </span>
              <span className={`text-[10px] font-mono ${statusBadge(item.status_revisao || "")}`}>
                {(item.status_revisao || "—").replace(/_/g, " ")}
              </span>
              <span className="text-[10px] text-slate-700 font-mono tabular-nums">
                {new Date(item.created_at).toLocaleDateString("pt-BR")}
              </span>
              <div className="flex justify-end gap-0.5">
                <button onClick={() => setDetailItem(item)} className="p-1 text-slate-600 hover:text-slate-400 transition-colors">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                {tab === "geracoes" && canReview && (
                  <button onClick={() => openReview(item)} className="p-1 text-slate-600 hover:text-slate-400 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="bg-[#0a0a12] border-[#1a1a2e] text-slate-300 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-300 text-sm">
              {detailItem?.titulo_geracao || detailItem?.caso_titulo || "Detalhes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.length > 0 && (
              <div>
                <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Fontes Utilizadas</span>
                <div className="space-y-0.5 mt-1.5">
                  {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                      <span>{f.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">
                {tab === "geracoes" ? "Minuta" : "Resposta"}
              </span>
              <div className="text-[12px] text-slate-400 whitespace-pre-wrap leading-relaxed bg-[#08080f] rounded p-3 max-h-[400px] overflow-y-auto mt-1.5 font-serif">
                {detailItem?.minuta_gerada || detailItem?.resposta_ia}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="bg-[#0a0a12] border-[#1a1a2e] text-slate-300 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-300 text-sm">Revisão da Peça</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600 uppercase tracking-wider">Minuta (editável)</Label>
              <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-400 min-h-[300px] font-serif text-[12px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-slate-600 uppercase tracking-wider">Justificativa</Label>
              <Textarea value={reviewJustificativa} onChange={e => setReviewJustificativa(e.target.value)}
                className="bg-[#08080f] border-[#1a1a2e] text-slate-400 min-h-[60px] text-[12px]"
                placeholder="Opcional" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submitReview("aprovacao")} disabled={saving} size="sm"
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/20 h-8 text-[11px]">
                <ThumbsUp className="h-3 w-3 mr-1" /> Aprovar
              </Button>
              <Button onClick={() => submitReview("referencia", true)} disabled={saving} size="sm"
                className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-600/20 h-8 text-[11px]">
                <Star className="h-3 w-3 mr-1" /> Referência
              </Button>
              <Button onClick={() => submitReview("correcao")} disabled={saving} size="sm"
                className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/20 h-8 text-[11px]">
                <PenTool className="h-3 w-3 mr-1" /> Correção
              </Button>
              <Button onClick={() => submitReview("rejeicao")} disabled={saving} size="sm"
                className="bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20 h-8 text-[11px]">
                <ThumbsDown className="h-3 w-3 mr-1" /> Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
