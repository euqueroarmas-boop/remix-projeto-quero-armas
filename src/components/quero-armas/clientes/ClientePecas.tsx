import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";
import {
  FileText, Download, Plus, Loader2, Eye, Clock, CheckCircle,
  AlertCircle, PenTool, User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ClientePecasGerador from "./ClientePecasGerador";

interface Props {
  cliente: {
    id: number;
    cpf: string;
    nome_completo: string;
    email?: string;
    celular?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    cidade?: string;
    estado?: string;
    complemento?: string;
    profissao?: string;
    estado_civil?: string;
    rg?: string;
    emissor_rg?: string;
    nacionalidade?: string;
  };
}

interface GeracaoRow {
  id: string;
  titulo_geracao: string;
  tipo_peca: string;
  status: string;
  status_revisao: string | null;
  score_confianca: number | null;
  created_at: string;
  docx_path: string | null;
}

interface CasoRow {
  id: string;
  titulo: string;
  tipo_peca: string | null;
  tipo_servico: string | null;
  status: string;
  created_at: string;
  geracao_id: string | null;
  nome_requerente: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  rascunho: { label: "RASCUNHO", color: "hsl(40 80% 50%)", icon: PenTool },
  aprovado: { label: "APROVADO", color: "hsl(145 60% 40%)", icon: CheckCircle },
  rejeitado: { label: "REJEITADO", color: "hsl(0 70% 55%)", icon: AlertCircle },
  concluido: { label: "CONCLUÍDO", color: "hsl(145 60% 40%)", icon: CheckCircle },
  gerando: { label: "GERANDO...", color: "hsl(210 60% 55%)", icon: Loader2 },
  erro: { label: "ERRO", color: "hsl(0 70% 55%)", icon: AlertCircle },
};

const TIPO_LABELS: Record<string, string> = {
  recurso_administrativo: "RECURSO ADMINISTRATIVO",
  mandado_seguranca: "MANDADO DE SEGURANÇA",
  acao_declaratoria: "AÇÃO DECLARATÓRIA",
  peticao_inicial: "PETIÇÃO INICIAL",
  defesa_administrativa: "DEFESA ADMINISTRATIVA",
  defesa_posse_arma: "DEFESA PARA POSSE",
  defesa_porte_arma: "DEFESA PARA PORTE",
  resposta_a_notificacao: "RESPOSTA À NOTIFICAÇÃO",
  impugnacao: "IMPUGNAÇÃO",
};

export default function ClientePecas({ cliente }: Props) {
  const [loading, setLoading] = useState(true);
  const [casos, setCasos] = useState<CasoRow[]>([]);
  const [geracoes, setGeracoes] = useState<GeracaoRow[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const cpfNorm = (cliente.cpf || "").replace(/\D/g, "");

  const loadData = useCallback(async () => {
    if (!cpfNorm) { setLoading(false); return; }
    try {
      const { data: casosData } = await supabase
        .from("qa_casos" as any)
        .select("id, titulo, tipo_peca, tipo_servico, status, created_at, geracao_id, nome_requerente")
        .eq("cpf_cnpj", cpfNorm)
        .order("created_at", { ascending: false });

      const rows = (casosData as any[]) || [];
      setCasos(rows);

      const geracaoIds = rows.map(c => c.geracao_id).filter(Boolean);
      if (geracaoIds.length > 0) {
        const { data: geracoesData } = await supabase
          .from("qa_geracoes_pecas" as any)
          .select("id, titulo_geracao, tipo_peca, status, status_revisao, score_confianca, created_at, docx_path")
          .in("id", geracaoIds)
          .order("created_at", { ascending: false });
        setGeracoes((geracoesData as any[]) || []);
      } else {
        setGeracoes([]);
      }
    } catch (err) {
      console.error("[ClientePecas] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [cpfNorm]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownload = async (g: GeracaoRow) => {
    setDownloading(g.id);
    try {
      await downloadGeracaoDocx(g.id, {
        titulo: g.titulo_geracao,
        tipoPeca: g.tipo_peca,
        nomeRequerente: cliente.nome_completo,
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleSaved = () => {
    loadData();
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "hsl(220 10% 55%)" }} />
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "hsl(220 10% 62%)" }}>
          CARREGANDO PEÇAS...
        </span>
      </div>
    );
  }

  // Show inline generator
  if (showGenerator) {
    return (
      <ClientePecasGerador
        cliente={cliente}
        onClose={() => setShowGenerator(false)}
        onSaved={handleSaved}
      />
    );
  }

  const total = geracoes.length;
  const aprovadas = geracoes.filter(g => g.status_revisao === "aprovado").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
            PEÇAS JURÍDICAS
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
            {total === 0 ? "NENHUMA PEÇA GERADA" : `${total} PEÇA${total > 1 ? "S" : ""} • ${aprovadas} APROVADA${aprovadas !== 1 ? "S" : ""}`}
          </p>
        </div>
        <Button
          onClick={() => setShowGenerator(true)}
          size="sm"
          className="h-8 px-4 text-[11px] font-semibold uppercase tracking-wide rounded-lg shadow-sm"
          style={{ background: "hsl(220 20% 18%)", color: "hsl(0 0% 100%)" }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> NOVA PEÇA
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "CASOS", value: casos.length, color: "hsl(210 60% 55%)" },
          { label: "PEÇAS", value: total, color: "hsl(260 50% 55%)" },
          { label: "APROVADAS", value: aprovadas, color: "hsl(145 60% 40%)" },
        ].map(k => (
          <div key={k.label} className="qa-card p-3 text-center">
            <div className="text-[18px] font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* Client context badge */}
      <div className="qa-card p-2.5 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(210 60% 55% / 0.1)" }}>
          <User className="h-3.5 w-3.5" style={{ color: "hsl(210 60% 55%)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>{cliente.nome_completo}</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: "hsl(220 10% 55%)" }}>
            CPF: {cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
            {cliente.cidade && ` • ${cliente.cidade}/${cliente.estado}`}
          </p>
        </div>
      </div>

      {/* Pieces List */}
      {geracoes.length === 0 && casos.length === 0 ? (
        <div className="qa-card p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto" style={{ color: "hsl(220 10% 75%)" }} />
          <div>
            <p className="text-[12px] font-semibold uppercase" style={{ color: "hsl(220 20% 30%)" }}>
              NENHUMA PEÇA ENCONTRADA
            </p>
            <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>
              CLIQUE EM "NOVA PEÇA" PARA GERAR A PRIMEIRA PEÇA DESTE CLIENTE
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {geracoes.map(g => {
            const caso = casos.find(c => c.geracao_id === g.id);
            const st = STATUS_MAP[g.status_revisao || g.status] || STATUS_MAP.rascunho;
            const StIcon = st.icon;
            const isDownloading = downloading === g.id;
            return (
              <div key={g.id} className="qa-card qa-hover-lift p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 group">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${st.color}15` }}>
                  <StIcon className="h-4 w-4" style={{ color: st.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                      {g.titulo_geracao || "SEM TÍTULO"}
                    </span>
                    <Badge variant="outline" className="text-[8px] font-bold uppercase border px-1.5 py-0 h-4" style={{ color: st.color, borderColor: `${st.color}40` }}>
                      {st.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium uppercase" style={{ color: "hsl(260 50% 55%)" }}>
                      {TIPO_LABELS[g.tipo_peca] || g.tipo_peca?.replace(/_/g, " ").toUpperCase() || "—"}
                    </span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "hsl(220 10% 55%)" }}>
                      <Clock className="h-3 w-3" /> {formatDate(g.created_at)}
                    </span>
                    {g.score_confianca != null && (
                      <span className="text-[10px] font-semibold" style={{
                        color: g.score_confianca >= 80 ? "hsl(145 60% 40%)" : g.score_confianca >= 50 ? "hsl(40 80% 50%)" : "hsl(0 70% 55%)"
                      }}>
                        {g.score_confianca}% CONFIANÇA
                      </span>
                    )}
                  </div>
                  {caso && (
                    <div className="text-[9px] mt-1 uppercase" style={{ color: "hsl(220 10% 65%)" }}>
                      CASO: {caso.titulo}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[10px] font-semibold uppercase bg-white border-slate-200 hover:border-slate-300"
                    disabled={isDownloading}
                    onClick={() => handleDownload(g)}
                  >
                    {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                    DOCX
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Cases without generation */}
          {casos.filter(c => !c.geracao_id).map(c => (
            <div key={c.id} className="qa-card p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 opacity-70">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(40 80% 50% / 0.12)" }}>
                <Clock className="h-4 w-4" style={{ color: "hsl(40 80% 50%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                  {c.titulo || "CASO EM ANDAMENTO"}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] uppercase" style={{ color: "hsl(40 80% 50%)" }}>
                    {c.status?.toUpperCase() || "EM ANDAMENTO"}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: "hsl(220 10% 55%)" }}>
                    <Clock className="h-3 w-3" /> {formatDate(c.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
