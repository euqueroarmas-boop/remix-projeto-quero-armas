import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CaseDetailPanel from "@/components/quero-armas/CaseDetailPanel";
import {
  Search, FolderOpen, PenTool, CheckCircle, XCircle, Clock, Eye,
  Shield, BookOpen, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "em_geracao", label: "Em geração" },
  { value: "gerado", label: "Gerado" },
  { value: "revisado", label: "Revisado" },
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "arquivado", label: "Arquivado" },
];

export default function QACasosPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [detailCase, setDetailCase] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("casos");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("qa_casos" as any).select("*").order("created_at", { ascending: false }).limit(100);
    if (statusFilter !== "todos") query = query.eq("status", statusFilter);
    const { data } = await query;
    setCases((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = cases.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.nome_requerente || "").toLowerCase().includes(s) ||
      (c.titulo || "").toLowerCase().includes(s) ||
      (c.tipo_servico || "").toLowerCase().includes(s) ||
      (c.unidade_pf || "").toLowerCase().includes(s) ||
      (c.cidade || "").toLowerCase().includes(s);
  });

  // Separate cases from services (deferido cases go to learning)
  const casosAtivos = filtered.filter(c => c.status !== "deferido");
  const servicosConcluidos = filtered.filter(c => c.status === "deferido");

  const statusColor = (s: string) => {
    if (s === "gerado" || s === "revisado") return "text-emerald-400";
    if (s === "deferido") return "text-green-400";
    if (s === "indeferido") return "text-red-400";
    if (s === "em_geracao") return "text-neutral-400";
    if (s === "arquivado") return "text-neutral-600";
    if (s === "rascunho") return "text-amber-400";
    return "text-neutral-500";
  };

  const handleSetDeferido = useCallback(async (casoId: string) => {
    try {
      // Update status to deferido
      await supabase.from("qa_casos" as any).update({
        status: "deferido",
        updated_at: new Date().toISOString(),
      }).eq("id", casoId);

      // Promote auxiliary docs to learning
      const { data: auxDocs } = await supabase.from("qa_documentos_conhecimento" as any)
        .select("id")
        .eq("caso_id", casoId)
        .eq("papel_documento", "auxiliar_caso");

      if (auxDocs && auxDocs.length > 0) {
        const docIds = (auxDocs as any[]).map(d => d.id);
        await supabase.from("qa_documentos_conhecimento" as any)
          .update({
            papel_documento: "aprendizado",
            ativo_na_ia: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", docIds);
      }

      // Audit log
      await supabase.from("qa_logs_auditoria" as any).insert({
        entidade: "qa_casos",
        entidade_id: casoId,
        acao: "marcar_deferido",
        detalhes_json: { docs_promovidos: auxDocs?.length || 0 },
      });

      toast.success("Caso marcado como deferido. Documentos promovidos para aprendizado da IA.");
      setDetailCase(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }, []);

  const handleSetIndeferido = useCallback(async (casoId: string) => {
    try {
      await supabase.from("qa_casos" as any).update({
        status: "indeferido",
        updated_at: new Date().toISOString(),
      }).eq("id", casoId);

      toast.success("Caso marcado como indeferido.");
      setDetailCase(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }, []);

  const renderCaseList = (items: any[]) => {
    if (loading) {
      return <div className="flex justify-center py-10"><div className="w-4 h-4 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" /></div>;
    }
    if (items.length === 0) {
      return <div className="text-center py-10 text-neutral-600 text-[11px]">Nenhum caso encontrado</div>;
    }

    return (
      <div className="bg-[#111111] border border-[#1c1c1c] rounded-lg overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-2 px-3 py-1.5 border-b border-[#1c1c1c] text-[9px] text-neutral-600 uppercase tracking-[0.12em]">
          <span>Requerente / Título</span><span>Serviço</span><span>Tipo Peça</span><span>Unidade PF</span><span>Status</span><span>Data</span><span></span>
        </div>
        {items.map((c: any) => (
          <div key={c.id} className="border-b border-[#1c1c1c]/40 hover:bg-[#1a1a1a] transition-colors">
            <div className="md:hidden px-2.5 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-neutral-200 truncate font-medium">{c.nome_requerente || "—"}</div>
                  <div className="text-[9px] text-neutral-600 truncate">{c.titulo || "Sem título"}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[9px] font-mono ${statusColor(c.status)}`}>{(c.status || "—").replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-neutral-600">
                <span className="truncate">{c.tipo_servico || "—"}</span>
                <span className="font-mono">{c.sigla_unidade_pf || "—"}</span>
                <span className="font-mono tabular-nums ml-auto">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={() => setDetailCase(c)} className="p-0.5 text-neutral-600 hover:text-[#c43b52]"><Eye className="h-3 w-3" /></button>
                <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="p-0.5 text-neutral-600 hover:text-[#c43b52]"><PenTool className="h-3 w-3" /></button>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-2 px-3 py-2 items-center">
              <div className="min-w-0">
                <div className="text-[12px] text-neutral-200 truncate font-medium">{c.nome_requerente || "—"}</div>
                <div className="text-[10px] text-neutral-600 truncate">{c.titulo || "Sem título"}</div>
              </div>
              <div className="text-[10px] text-neutral-500 truncate">{c.tipo_servico || "—"}</div>
              <div className="text-[10px] text-neutral-500 truncate">{(c.tipo_peca || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-neutral-600 font-mono truncate">{c.sigla_unidade_pf || "—"}</div>
              <div className={`text-[10px] font-mono ${statusColor(c.status)}`}>{(c.status || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-neutral-700 font-mono tabular-nums">{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
              <div className="flex gap-0.5 justify-end">
                <button onClick={() => setDetailCase(c)} className="p-1 text-neutral-600 hover:text-[#c43b52]"><Eye className="h-3.5 w-3.5" /></button>
                <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="p-1 text-neutral-600 hover:text-[#c43b52]"><PenTool className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 md:space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm md:text-base font-semibold text-neutral-200">Casos</h1>
        <Button size="sm" onClick={() => navigate("/quero-armas/gerar-peca")}
          className="bg-[#7a1528] hover:bg-[#a52338] text-white border-0 h-7 text-[10px] md:text-[11px] active:scale-[0.98]">
          <PenTool className="h-3 w-3 mr-1" /> Novo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-1.5 md:gap-2">
        <div className="relative flex-1">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="bg-[#0a0a0a] border-[#1c1c1c] text-neutral-300 pl-7 h-7 md:h-8 text-[11px] focus:border-[#7a1528]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-[#0a0a0a] border-[#1c1c1c] text-neutral-400 h-7 md:h-8 w-full sm:w-28 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0e0e0e] border border-[#1c1c1c] h-8">
          <TabsTrigger value="casos" className="text-[10px] data-[state=active]:bg-[#1c1c1c] data-[state=active]:text-neutral-200">
            <FolderOpen className="h-3 w-3 mr-1" /> Casos ({casosAtivos.length})
          </TabsTrigger>
          <TabsTrigger value="servicos" className="text-[10px] data-[state=active]:bg-[#1c1c1c] data-[state=active]:text-neutral-200">
            <Shield className="h-3 w-3 mr-1" /> Serviços Deferidos ({servicosConcluidos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="casos" className="mt-3">
          {renderCaseList(casosAtivos)}
        </TabsContent>

        <TabsContent value="servicos" className="mt-3">
          {servicosConcluidos.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <BookOpen className="h-6 w-6 text-neutral-700 mx-auto" />
              <div className="text-neutral-600 text-[11px]">Nenhum serviço deferido ainda</div>
              <div className="text-neutral-700 text-[10px]">Marque um caso como "Deferido" para promovê-lo ao aprendizado da IA.</div>
            </div>
          ) : (
            <>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 mb-3 text-[10px] text-emerald-400/80 flex items-start gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Casos deferidos têm seus documentos promovidos para aprendizado da IA. As defesas bem-sucedidas servem como modelo para futuros casos semelhantes.</span>
              </div>
              {renderCaseList(servicosConcluidos)}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="bg-[#111111] border-[#1c1c1c] text-neutral-300 max-w-3xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
          <DialogHeader><DialogTitle className="text-neutral-200 text-sm">{detailCase?.titulo || "Detalhes"}</DialogTitle></DialogHeader>
          {detailCase && (
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-neutral-600">Requerente:</span> <span className="text-neutral-300 ml-1">{detailCase.nome_requerente || "—"}</span></div>
                <div><span className="text-neutral-600">CPF/CNPJ:</span> <span className="text-neutral-300 ml-1">{detailCase.cpf_cnpj || "—"}</span></div>
                <div><span className="text-neutral-600">Serviço:</span> <span className="text-neutral-300 ml-1">{detailCase.tipo_servico || "—"}</span></div>
                <div><span className="text-neutral-600">Tipo:</span> <span className="text-neutral-300 ml-1">{(detailCase.tipo_peca || "—").replace(/_/g, " ")}</span></div>
                <div><span className="text-neutral-600">Local:</span> <span className="text-neutral-300 ml-1">{detailCase.cidade || "—"}/{detailCase.uf || "—"}</span></div>
                <div><span className="text-neutral-600">PF:</span> <span className="text-neutral-300 ml-1">{detailCase.unidade_pf || "—"}</span></div>
                <div><span className="text-neutral-600">Status:</span> <span className={`ml-1 ${statusColor(detailCase.status)}`}>{(detailCase.status || "—").replace(/_/g, " ")}</span></div>
                <div><span className="text-neutral-600">Data:</span> <span className="text-neutral-300 ml-1">{new Date(detailCase.created_at).toLocaleString("pt-BR")}</span></div>
              </div>

              {detailCase.descricao_caso && (
                <div>
                  <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em]">Descrição</span>
                  <div className="text-[10px] text-neutral-400 bg-[#0a0a0a] rounded-lg p-2 mt-1 whitespace-pre-wrap max-h-[100px] overflow-y-auto">{detailCase.descricao_caso}</div>
                </div>
              )}

              {detailCase.documentos_auxiliares_json?.length > 0 && (
                <div>
                  <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em]">Docs ({detailCase.documentos_auxiliares_json.length})</span>
                  <div className="space-y-0.5 mt-1">
                    {detailCase.documentos_auxiliares_json.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        {d.stage === "done" ? <CheckCircle className="h-2.5 w-2.5 text-emerald-400" /> : d.stage === "failed" ? <XCircle className="h-2.5 w-2.5 text-red-400" /> : <Clock className="h-2.5 w-2.5 text-neutral-600" />}
                        <span className="text-neutral-400 truncate">{d.nome}</span>
                        {d.error && <span className="text-red-400 text-[8px]">— {d.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailCase.minuta_gerada && (
                <div>
                  <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em]">Minuta</span>
                  <div className="text-[11px] text-neutral-400 whitespace-pre-wrap leading-relaxed bg-[#0a0a0a] rounded-lg p-2.5 max-h-[200px] overflow-y-auto mt-1 font-serif">{detailCase.minuta_gerada}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1c1c1c]">
                <Button size="sm" onClick={() => { setDetailCase(null); navigate(`/quero-armas/gerar-peca?caso=${detailCase.id}`); }}
                  className="bg-[#7a1528] hover:bg-[#a52338] text-white border-0 h-7 text-[10px]">
                  <PenTool className="h-3 w-3 mr-1" /> Editar
                </Button>

                {detailCase.status === "gerado" || detailCase.status === "revisado" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleSetDeferido(detailCase.id)}
                      className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-7 text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1" /> Deferido
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleSetIndeferido(detailCase.id)}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 text-[10px]">
                      <XCircle className="h-3 w-3 mr-1" /> Indeferido
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}