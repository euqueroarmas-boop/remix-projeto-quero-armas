import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, FolderOpen, PenTool, User, MapPin, Download, FileText,
  CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Eye,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "em_geracao", label: "Em geração" },
  { value: "gerado", label: "Gerado" },
  { value: "revisado", label: "Revisado" },
  { value: "arquivado", label: "Arquivado" },
];

export default function QACasosPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [detailCase, setDetailCase] = useState<any>(null);

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

  const statusColor = (s: string) => {
    if (s === "gerado" || s === "revisado") return "text-emerald-400";
    if (s === "em_geracao") return "text-slate-400";
    if (s === "arquivado") return "text-slate-600";
    if (s === "rascunho") return "text-amber-400";
    return "text-slate-500";
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-base font-semibold text-slate-300">Casos</h1>
        <Button size="sm" onClick={() => navigate("/quero-armas/gerar-peca")}
          className="bg-[#14142a] hover:bg-[#1a1a35] text-slate-300 border border-[#1a1a2e] h-7 text-[11px]">
          <PenTool className="h-3 w-3 mr-1" /> Novo Caso
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, título, serviço, cidade..."
            className="bg-[#08080f] border-[#1a1a2e] text-slate-300 pl-8 h-8 text-[12px]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-[#08080f] border-[#1a1a2e] text-slate-400 h-8 w-36 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-[12px]">Nenhum caso encontrado</div>
      ) : (
        <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-2 px-3 py-2 border-b border-[#1a1a2e] text-[9px] text-slate-600 uppercase tracking-[0.15em]">
            <span>Requerente / Título</span>
            <span>Serviço</span>
            <span>Tipo Peça</span>
            <span>Unidade PF</span>
            <span>Status</span>
            <span>Data</span>
            <span></span>
          </div>
          {filtered.map((c: any) => (
            <div key={c.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-1 md:gap-2 px-3 py-2.5 border-b border-[#1a1a2e]/50 hover:bg-[#14142a]/30 transition-colors items-center">
              <div className="min-w-0">
                <div className="text-[12px] text-slate-300 truncate font-medium">{c.nome_requerente || "—"}</div>
                <div className="text-[10px] text-slate-600 truncate">{c.titulo || "Sem título"}</div>
              </div>
              <div className="text-[10px] text-slate-500 truncate">{c.tipo_servico || "—"}</div>
              <div className="text-[10px] text-slate-500 truncate">{(c.tipo_peca || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-slate-600 font-mono truncate">{c.sigla_unidade_pf || "—"}</div>
              <div className={`text-[10px] font-mono ${statusColor(c.status)}`}>{(c.status || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-slate-700 font-mono tabular-nums">{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
              <div className="flex gap-0.5 justify-end">
                <button onClick={() => setDetailCase(c)} className="p-1 text-slate-600 hover:text-slate-400"><Eye className="h-3.5 w-3.5" /></button>
                <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="p-1 text-slate-600 hover:text-slate-400"><PenTool className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="bg-[#0a0a12] border-[#1a1a2e] text-slate-300 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-slate-300 text-sm">{detailCase?.titulo || "Detalhes do Caso"}</DialogTitle></DialogHeader>
          {detailCase && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div><span className="text-slate-600">Requerente:</span> <span className="text-slate-300 ml-1">{detailCase.nome_requerente || "—"}</span></div>
                <div><span className="text-slate-600">CPF/CNPJ:</span> <span className="text-slate-300 ml-1">{detailCase.cpf_cnpj || "—"}</span></div>
                <div><span className="text-slate-600">Serviço:</span> <span className="text-slate-300 ml-1">{detailCase.tipo_servico || "—"}</span></div>
                <div><span className="text-slate-600">Tipo Peça:</span> <span className="text-slate-300 ml-1">{(detailCase.tipo_peca || "—").replace(/_/g, " ")}</span></div>
                <div><span className="text-slate-600">Cidade/UF:</span> <span className="text-slate-300 ml-1">{detailCase.cidade || "—"}/{detailCase.uf || "—"}</span></div>
                <div><span className="text-slate-600">Unidade PF:</span> <span className="text-slate-300 ml-1">{detailCase.unidade_pf || "—"}</span></div>
                <div><span className="text-slate-600">Status:</span> <span className={`ml-1 ${statusColor(detailCase.status)}`}>{(detailCase.status || "—").replace(/_/g, " ")}</span></div>
                <div><span className="text-slate-600">Data:</span> <span className="text-slate-300 ml-1">{new Date(detailCase.created_at).toLocaleString("pt-BR")}</span></div>
              </div>

              {detailCase.descricao_caso && (
                <div>
                  <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Descrição</span>
                  <div className="text-[11px] text-slate-400 bg-[#08080f] rounded p-2.5 mt-1 whitespace-pre-wrap max-h-[120px] overflow-y-auto">{detailCase.descricao_caso}</div>
                </div>
              )}

              {/* Documents */}
              {detailCase.documentos_auxiliares_json?.length > 0 && (
                <div>
                  <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Documentos Auxiliares ({detailCase.documentos_auxiliares_json.length})</span>
                  <div className="space-y-1 mt-1.5">
                    {detailCase.documentos_auxiliares_json.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {d.stage === "done" ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : d.stage === "failed" ? <XCircle className="h-3 w-3 text-red-400" /> : <Clock className="h-3 w-3 text-slate-600" />}
                        <span className="text-slate-400">{d.nome}</span>
                        <span className="text-slate-700 text-[9px]">{d.tipo}</span>
                        {d.error && <span className="text-red-400 text-[9px]">— {d.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {detailCase.erros_documentos_json?.length > 0 && (
                <div>
                  <span className="text-[9px] text-red-400 uppercase tracking-[0.15em]">Erros em Documentos</span>
                  <div className="space-y-1 mt-1">
                    {detailCase.erros_documentos_json.map((e: any, i: number) => (
                      <div key={i} className="text-[10px] text-red-400/80 bg-red-500/5 rounded px-2 py-1">
                        <span className="text-red-400">{e.nome}</span>: {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minuta */}
              {detailCase.minuta_gerada && (
                <div>
                  <span className="text-[9px] text-slate-600 uppercase tracking-[0.15em]">Minuta</span>
                  <div className="text-[12px] text-slate-400 whitespace-pre-wrap leading-relaxed bg-[#08080f] rounded p-3 max-h-[300px] overflow-y-auto mt-1.5 font-serif">{detailCase.minuta_gerada}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[#1a1a2e]">
                <Button size="sm" onClick={() => { setDetailCase(null); navigate(`/quero-armas/gerar-peca?caso=${detailCase.id}`); }}
                  className="bg-[#14142a] hover:bg-[#1a1a35] text-slate-300 border border-[#1a1a2e] h-7 text-[10px]">
                  <PenTool className="h-3 w-3 mr-1" /> Editar / Regenerar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
