import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  History, Loader2, Bot, PenTool, Eye, ThumbsUp, ThumbsDown, Star,
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
      // Save review
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

      // Update status
      const newStatus = tipo === "rejeicao" ? "rejeitado" :
        virarRef ? "aprovado_como_referencia" :
        tipo === "aprovacao" ? "aprovado" : "corrigido";

      await supabase.from("qa_geracoes_pecas" as any)
        .update({ status_revisao: newStatus } as any)
        .eq("id", reviewItem.id);

      // If virou referência, create preferential reference
      if (virarRef) {
        await supabase.from("qa_referencias_preferenciais" as any).insert({
          tipo_referencia: "geracao_aprovada",
          origem_id: reviewItem.id,
          motivo_priorizacao: reviewJustificativa || "Aprovada como referência",
          peso_manual: 1.5,
        });
      }

      // Audit log
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
      rascunho: "bg-slate-800 text-slate-400",
      em_revisao: "bg-amber-500/10 text-amber-400",
      corrigido: "bg-blue-500/10 text-blue-400",
      aprovado: "bg-emerald-500/10 text-emerald-400",
      aprovado_como_referencia: "bg-purple-500/10 text-purple-400",
      rejeitado: "bg-red-500/10 text-red-400",
    };
    return map[s] || "bg-slate-800 text-slate-400";
  };

  const scoreColor = (s: number) => {
    if (s >= 0.7) return "text-emerald-400";
    if (s >= 0.4) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="h-6 w-6 text-amber-500" /> Histórico
          </h1>
          <p className="text-sm text-slate-500 mt-1">Consultas e peças geradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "geracoes" ? "default" : "outline"} size="sm"
            onClick={() => setTab("geracoes")} className={tab === "geracoes" ? "bg-amber-600" : "border-slate-700 text-slate-300"}>
            <PenTool className="h-3.5 w-3.5 mr-1" /> Peças
          </Button>
          <Button variant={tab === "consultas" ? "default" : "outline"} size="sm"
            onClick={() => setTab("consultas")} className={tab === "consultas" ? "bg-amber-600" : "border-slate-700 text-slate-300"}>
            <Bot className="h-3.5 w-3.5 mr-1" /> Consultas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item.id} className="bg-[#12121c] border border-slate-800/40 rounded-lg p-4 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    {tab === "geracoes" ? (
                      <PenTool className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    )}
                    <span className="font-medium text-slate-200 truncate">
                      {item.titulo_geracao || item.caso_titulo || "Sem título"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                    {item.tipo_peca && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{item.tipo_peca.replace(/_/g, " ")}</span>}
                    <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                    {item.score_confianca != null && (
                      <span className={scoreColor(item.score_confianca)}>
                        {(item.score_confianca * 100).toFixed(0)}% confiança
                      </span>
                    )}
                    {/* Source counts */}
                    {item.fontes_recuperadas_json?.length > 0 && (
                      <span className="text-slate-500">{item.fontes_recuperadas_json.length} fontes</span>
                    )}
                    {item.fundamentos_utilizados_json?.length > 0 && (
                      <span className="text-slate-500">{item.fundamentos_utilizados_json.length} fontes</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tab === "geracoes" && item.status_revisao && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${statusBadge(item.status_revisao)}`}>
                      {item.status_revisao.replace(/_/g, " ")}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setDetailItem(item)} className="text-slate-400 hover:text-slate-200">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {tab === "geracoes" && canReview && (
                    <Button variant="ghost" size="icon" onClick={() => openReview(item)} className="text-amber-400 hover:text-amber-300">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="bg-[#12121c] border-slate-800 text-slate-100 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {detailItem?.titulo_geracao || detailItem?.caso_titulo || "Detalhes"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Sources */}
            {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Fontes Utilizadas</h4>
                <div className="space-y-1">
                  {(detailItem?.fontes_recuperadas_json || detailItem?.fundamentos_utilizados_json)?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {f.tipo === "norma" && <Scale className="h-3 w-3 text-emerald-400" />}
                      {f.tipo === "jurisprudencia" && <Gavel className="h-3 w-3 text-purple-400" />}
                      {f.tipo === "documento" && <BookOpen className="h-3 w-3 text-blue-400" />}
                      {f.tipo === "referencia_aprovada" && <CheckCircle className="h-3 w-3 text-amber-400" />}
                      <span className="text-slate-300">{f.titulo}</span>
                      {f.score_final && <span className="text-slate-600">({(f.score_final).toFixed(2)})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Content */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {tab === "geracoes" ? "Minuta" : "Resposta da IA"}
              </h4>
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#0c0c14] rounded-lg p-4 max-h-[400px] overflow-y-auto">
                {detailItem?.minuta_gerada || detailItem?.resposta_ia}
              </div>
            </div>
            {detailItem?.observacoes_ia && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
                <strong>Observações:</strong> {detailItem.observacoes_ia}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="bg-[#12121c] border-slate-800 text-slate-100 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Revisão da Peça</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Texto da Minuta (editável)</Label>
              <Textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[300px] font-serif text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Justificativa / Observações</Label>
              <Textarea value={reviewJustificativa} onChange={e => setReviewJustificativa(e.target.value)}
                className="bg-[#0c0c14] border-slate-700 text-slate-100 min-h-[60px]"
                placeholder="Opcional: explique correções ou motivo da aprovação/rejeição" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submitReview("aprovacao")} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700">
                <ThumbsUp className="h-4 w-4 mr-1" /> Aprovar
              </Button>
              <Button onClick={() => submitReview("referencia", true)} disabled={saving}
                className="bg-purple-600 hover:bg-purple-700">
                <Star className="h-4 w-4 mr-1" /> Aprovar como Referência
              </Button>
              <Button onClick={() => submitReview("correcao")} disabled={saving}
                className="bg-blue-600 hover:bg-blue-700">
                <PenTool className="h-4 w-4 mr-1" /> Salvar Correção
              </Button>
              <Button onClick={() => submitReview("rejeicao")} disabled={saving}
                variant="outline" className="border-red-700 text-red-400 hover:bg-red-500/10">
                <ThumbsDown className="h-4 w-4 mr-1" /> Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
