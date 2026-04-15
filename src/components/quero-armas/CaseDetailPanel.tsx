import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, BookOpen, User, MapPin, Shield, Clock, Copy, Check,
  ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Loader2, Download,
} from "lucide-react";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";
import { toast } from "sonner";

interface CaseDetailPanelProps {
  caso: any;
  onClose: () => void;
  onDeferido?: (id: string) => void;
  onIndeferido?: (id: string) => void;
  onEdit?: (id: string) => void;
  statusColor: (s: string) => string;
}

interface DocRecord {
  id: string;
  titulo: string;
  tipo_documento: string;
  categoria: string;
  nome_arquivo: string;
  texto_extraido: string | null;
  resumo_extraido: string | null;
  metadados_json: any;
  status_processamento: string;
  papel_documento: string;
  created_at: string;
}

export default function CaseDetailPanel({
  caso, onClose, onDeferido, onIndeferido, onEdit, statusColor,
}: CaseDetailPanelProps) {
  const [tab, setTab] = useState("resumo");
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [geracao, setGeracao] = useState<any>(null);
  const [loadingGeracao, setLoadingGeracao] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  useEffect(() => {
    if (!caso?.id) return;
    loadDocs();
    loadGeracao();
  }, [caso?.id]);

  const loadDocs = async () => {
    setLoadingDocs(true);
    const { data } = await supabase
      .from("qa_documentos_conhecimento" as any)
      .select("id, titulo, tipo_documento, categoria, nome_arquivo, texto_extraido, resumo_extraido, metadados_json, status_processamento, papel_documento, created_at")
      .eq("caso_id", caso.id)
      .order("created_at", { ascending: true });
    setDocs((data as any[]) ?? []);
    setLoadingDocs(false);
  };

  const loadGeracao = async () => {
    setLoadingGeracao(true);
    let found = false;

    // Strategy 1: by geracao_id FK
    if (caso.geracao_id) {
      const { data } = await supabase
        .from("qa_geracoes_pecas" as any)
        .select("*")
        .eq("id", caso.geracao_id)
        .limit(1);
      if (data && (data as any[]).length > 0) {
        setGeracao((data as any[])[0]);
        found = true;
      }
    }

    // Strategy 2: match by exact titulo
    if (!found && caso.titulo) {
      const { data } = await supabase
        .from("qa_geracoes_pecas" as any)
        .select("*")
        .eq("titulo_geracao", caso.titulo)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && (data as any[]).length > 0) {
        setGeracao((data as any[])[0]);
        found = true;
      }
    }

    // Strategy 3: match by nome_requerente in titulo_geracao
    if (!found) {
      const name = caso.nome_requerente || caso.titulo?.replace(/^Caso\s+/i, "") || "";
      if (name) {
        const { data } = await supabase
          .from("qa_geracoes_pecas" as any)
          .select("*")
          .ilike("titulo_geracao", `%${name}%`)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && (data as any[]).length > 0) {
          setGeracao((data as any[])[0]);
          found = true;
        }
      }
    }

    // Strategy 4: match by caso.descricao_caso snippet in entrada_caso
    if (!found && caso.descricao_caso) {
      const snippet = caso.descricao_caso.slice(0, 80).trim();
      if (snippet.length > 20) {
        const { data } = await supabase
          .from("qa_geracoes_pecas" as any)
          .select("*")
          .ilike("entrada_caso", `%${snippet}%`)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && (data as any[]).length > 0) {
          setGeracao((data as any[])[0]);
        }
      }
    }

    setLoadingGeracao(false);
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const docStatusIcon = (s: string) => {
    if (s === "concluido") return <CheckCircle className="h-3 w-3 text-emerald-400" />;
    if (s === "erro") return <XCircle className="h-3 w-3 text-red-400" />;
    if (s === "processando") return <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />;
    return <Clock className="h-3 w-3 text-slate-400" />;
  };

  const minutaText = caso.minuta_gerada || geracao?.minuta_gerada || null;

  const canDecide = caso.status === "gerado" || caso.status === "revisado";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-800 truncate">{caso.titulo || "Caso"}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-mono font-medium ${statusColor(caso.status)}`}>
              {(caso.status || "—").replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              {new Date(caso.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200 h-8 w-full">
          <TabsTrigger value="resumo" className="text-[10px] flex-1 data-[state=active]:bg-slate-800/30 data-[state=active]:text-slate-800">
            <User className="h-3 w-3 mr-1" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-[10px] flex-1 data-[state=active]:bg-slate-800/30 data-[state=active]:text-slate-800">
            <FileText className="h-3 w-3 mr-1" /> Docs ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="peticao" className="text-[10px] flex-1 data-[state=active]:bg-slate-800/30 data-[state=active]:text-slate-800">
            <BookOpen className="h-3 w-3 mr-1" /> Petição
          </TabsTrigger>
        </TabsList>

        {/* ── RESUMO ── */}
        <TabsContent value="resumo" className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {[
              { label: "Requerente", value: caso.nome_requerente, icon: User },
              { label: "CPF/CNPJ", value: caso.cpf_cnpj },
              { label: "Serviço", value: caso.tipo_servico },
              { label: "Tipo de Peça", value: (caso.tipo_peca || "").replace(/_/g, " ") },
              { label: "Cidade / UF", value: `${caso.cidade || "—"} / ${caso.uf || "—"}`, icon: MapPin },
              { label: "Unidade PF", value: caso.unidade_pf, icon: Shield },
              { label: "Nº Requerimento", value: caso.numero_requerimento },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-slate-400 min-w-[90px] shrink-0">{f.label}:</span>
                <span className="text-slate-700 font-medium">{f.value || "—"}</span>
              </div>
            ))}
          </div>

          {caso.descricao_caso && (
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-[0.12em] mb-1">Descrição do caso</div>
              <div className="text-[10px] text-slate-600 bg-white rounded-lg p-2.5 whitespace-pre-wrap max-h-[120px] overflow-y-auto border border-slate-200">
                {caso.descricao_caso}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── DOCUMENTOS ── */}
        <TabsContent value="documentos" className="mt-3">
          {loadingDocs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-[11px]">Nenhum documento vinculado a este caso.</div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => {
                const isExpanded = expandedDoc === doc.id;
                const meta = doc.metadados_json || {};
                const campos = meta.campos_extraidos || meta.extracted_fields || {};
                const hasCampos = Object.keys(campos).length > 0;

                return (
                  <div key={doc.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    {/* Doc header */}
                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                    >
                      {docStatusIcon(doc.status_processamento)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-700 truncate font-medium">
                          {doc.titulo || doc.nome_arquivo || "Documento"}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400">
                          <span className="font-mono">{(doc.tipo_documento || "—").replace(/_/g, " ")}</span>
                          <span>•</span>
                          <span className="font-mono">{doc.papel_documento === "aprendizado" ? "📚 Aprendizado" : "📎 Auxiliar"}</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 px-3 py-2.5 space-y-3">
                        {/* Extracted fields */}
                        {hasCampos && (
                          <div>
                            <div className="text-[9px] text-blue-600 uppercase tracking-[0.12em] mb-1.5 font-semibold">Dados Extraídos</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {Object.entries(campos).map(([key, val]) => (
                                <div key={key} className="flex items-start gap-1.5 text-[10px] bg-white rounded px-2 py-1 border border-[#1a1a1a]">
                                  <span className="text-slate-400 min-w-[80px] shrink-0 capitalize">{key.replace(/_/g, " ")}:</span>
                                  <span className="text-slate-700 font-medium break-all">{String(val) || "—"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary */}
                        {doc.resumo_extraido && (
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase tracking-[0.12em] mb-1">Resumo</div>
                            <div className="text-[10px] text-slate-600 bg-white rounded p-2 whitespace-pre-wrap max-h-[120px] overflow-y-auto border border-[#1a1a1a]">
                              {doc.resumo_extraido}
                            </div>
                          </div>
                        )}

                        {/* Full text */}
                        {doc.texto_extraido && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-slate-400 uppercase tracking-[0.12em]">Texto Extraído</span>
                              <button
                                onClick={() => copyText(doc.texto_extraido!)}
                                className="text-[9px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5"
                              >
                                <Copy className="h-2.5 w-2.5" /> Copiar
                              </button>
                            </div>
                            <ScrollArea className="max-h-[200px]">
                              <div className="text-[10px] text-slate-600 bg-white rounded p-2.5 whitespace-pre-wrap font-mono leading-relaxed border border-[#1a1a1a]">
                                {doc.texto_extraido}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── PETIÇÃO ── */}
        <TabsContent value="peticao" className="mt-3">
          {loadingGeracao ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          ) : !minutaText ? (
            <div className="text-center py-8 space-y-2">
              <BookOpen className="h-5 w-5 text-slate-300 mx-auto" />
              <div className="text-slate-400 text-[11px]">Nenhuma petição gerada para este caso.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Confidence score */}
              {geracao?.score_confianca && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400">Confiança:</span>
                  <div className="flex-1 max-w-[120px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(geracao.score_confianca * 100)}%`,
                        backgroundColor: geracao.score_confianca > 0.7 ? "#22c55e" : geracao.score_confianca > 0.5 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-slate-600 font-mono">{Math.round(geracao.score_confianca * 100)}%</span>
                </div>
              )}

              {/* Sources used */}
              {geracao?.fundamentos_utilizados_json?.length > 0 && (
                <div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-[0.12em] mb-1">Fundamentos ({geracao.fundamentos_utilizados_json.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {geracao.fundamentos_utilizados_json.map((f: any, i: number) => (
                      <span key={i} className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">{f.titulo || f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full petition text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-400 uppercase tracking-[0.12em]">
                    Petição completa ({minutaText.split(/\s+/).length} palavras)
                  </span>
                  <div className="flex items-center gap-2">
                    {geracao?.id && (
                      <button
                        onClick={async () => {
                          setDownloadingDocx(true);
                          await downloadGeracaoDocx(geracao.id, {
                            titulo: geracao.titulo_geracao || caso.titulo,
                            tipoPeca: geracao.tipo_peca || caso.tipo_peca,
                            nomeRequerente: caso.nome_requerente,
                          });
                          setDownloadingDocx(false);
                        }}
                        disabled={downloadingDocx}
                        className="flex items-center gap-1 text-[9px] text-blue-600 hover:text-blue-800 transition-colors font-medium"
                      >
                        {downloadingDocx ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                        {downloadingDocx ? "Gerando..." : "Baixar DOCX"}
                      </button>
                    )}
                    <button
                      onClick={() => copyText(minutaText)}
                      className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      {copied ? "Copiado" : "Copiar tudo"}
                    </button>
                  </div>
                </div>
                <ScrollArea className="max-h-[400px]">
                  <div className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-4 font-serif border border-slate-200">
                    {minutaText}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
        {onEdit && (
          <Button size="sm" onClick={() => onEdit(caso.id)}
            className="bg-slate-800 hover:bg-slate-900 text-white border-0 h-7 text-[10px]">
            Editar / Gerar
          </Button>
        )}
        {canDecide && onDeferido && (
          <Button size="sm" variant="outline" onClick={() => onDeferido(caso.id)}
            className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-7 text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1" /> Deferido
          </Button>
        )}
        {canDecide && onIndeferido && (
          <Button size="sm" variant="outline" onClick={() => onIndeferido(caso.id)}
            className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 text-[10px]">
            <XCircle className="h-3 w-3 mr-1" /> Indeferido
          </Button>
        )}
      </div>
    </div>
  );
}
