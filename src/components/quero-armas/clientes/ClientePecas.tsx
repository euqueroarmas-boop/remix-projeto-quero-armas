import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";
import {
  FileText, Download, Plus, Loader2, Clock, CheckCircle,
  AlertCircle, PenTool, User, Scale, Sparkles, ArrowRight,
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
    uf_emissor_rg?: string;
    nacionalidade?: string;
    data_nascimento?: string;
    naturalidade?: string;
    nome_mae?: string;
    nome_pai?: string;
    escolaridade?: string;
    titulo_eleitor?: string;
    expedicao_rg?: string;
    observacao?: string;
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

  const handleSaved = () => { loadData(); };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(220 15% 96%)" }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "hsl(220 10% 50%)" }} />
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "hsl(220 10% 55%)" }}>
          CARREGANDO PEÇAS...
        </span>
      </div>
    );
  }

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
  const cpfFormatted = cpfNorm.length === 11
    ? cpfNorm.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpfNorm;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(260 50% 50%), hsl(260 50% 60%))" }}>
            <Scale className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 18%)" }}>
              PEÇAS JURÍDICAS
            </h3>
            <p className="text-[10px] mt-0.5 uppercase font-semibold" style={{ color: "hsl(220 10% 50%)" }}>
              {total === 0 ? "NENHUMA PEÇA GERADA" : `${total} PEÇA${total > 1 ? "S" : ""} • ${aprovadas} APROVADA${aprovadas !== 1 ? "S" : ""}`}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowGenerator(true)}
          size="sm"
          className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, hsl(220 20% 18%), hsl(220 20% 28%))",
            color: "white",
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> NOVA PEÇA
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "CASOS", value: casos.length, color: "hsl(210 60% 50%)", bg: "hsl(210 60% 50% / 0.08)" },
          { label: "PEÇAS", value: total, color: "hsl(260 50% 55%)", bg: "hsl(260 50% 55% / 0.08)" },
          { label: "APROVADAS", value: aprovadas, color: "hsl(145 55% 38%)", bg: "hsl(145 55% 38% / 0.08)" },
        ].map(k => (
          <div key={k.label} className="rounded-xl border-2 p-3.5 text-center transition-all duration-200 hover:shadow-sm"
            style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
            <div className="text-[22px] font-black tracking-tight" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: "hsl(220 10% 55%)" }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Client Context ── */}
      <div className="rounded-xl border-2 p-3.5 flex items-center gap-3"
        style={{ borderColor: "hsl(220 15% 93%)", background: "hsl(220 15% 97.5%)" }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(210 60% 50%), hsl(210 60% 60%))" }}>
          <User className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
            {cliente.nome_completo}
          </p>
          <p className="text-[10px] font-mono uppercase mt-0.5" style={{ color: "hsl(220 10% 50%)" }}>
            CPF: {cpfFormatted}
            {cliente.cidade && ` • ${cliente.cidade}/${cliente.estado}`}
          </p>
        </div>
      </div>

      {/* ── Pieces List ── */}
      {geracoes.length === 0 && casos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center space-y-4"
          style={{ borderColor: "hsl(220 15% 88%)", background: "hsl(220 15% 98.5%)" }}>
          <div className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "hsl(220 15% 93%)" }}>
            <FileText className="h-6 w-6" style={{ color: "hsl(220 10% 65%)" }} />
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "hsl(220 20% 25%)" }}>
              NENHUMA PEÇA ENCONTRADA
            </p>
            <p className="text-[10px] mt-1.5 uppercase font-medium" style={{ color: "hsl(220 10% 55%)" }}>
              CLIQUE EM "NOVA PEÇA" PARA GERAR A PRIMEIRA PEÇA DESTE CLIENTE
            </p>
          </div>
          <Button
            onClick={() => setShowGenerator(true)}
            size="sm"
            className="h-9 px-5 text-[10px] font-bold uppercase tracking-wider rounded-xl mt-2"
            style={{
              background: "linear-gradient(135deg, hsl(260 50% 50%), hsl(260 50% 60%))",
              color: "white",
            }}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> GERAR PRIMEIRA PEÇA
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {geracoes.map(g => {
            const caso = casos.find(c => c.geracao_id === g.id);
            const st = STATUS_MAP[g.status_revisao || g.status] || STATUS_MAP.rascunho;
            const StIcon = st.icon;
            const isDownloading = downloading === g.id;
            return (
              <div key={g.id}
                className="rounded-xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 group transition-all duration-200 hover:shadow-md hover:border-slate-300"
                style={{ borderColor: "hsl(220 15% 93%)", background: "white" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${st.color}12` }}>
                  <StIcon className="h-4.5 w-4.5" style={{ color: st.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                      {g.titulo_geracao || "SEM TÍTULO"}
                    </span>
                    <Badge variant="outline"
                      className="text-[8px] font-bold uppercase border-2 px-2 py-0 h-[18px] rounded-md"
                      style={{ color: st.color, borderColor: `${st.color}35`, background: `${st.color}08` }}>
                      {st.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(260 50% 55%)" }}>
                      {TIPO_LABELS[g.tipo_peca] || g.tipo_peca?.replace(/_/g, " ").toUpperCase() || "—"}
                    </span>
                    <span className="text-[10px] flex items-center gap-1 font-medium" style={{ color: "hsl(220 10% 55%)" }}>
                      <Clock className="h-3 w-3" /> {formatDate(g.created_at)}
                    </span>
                    {g.score_confianca != null && (
                      <span className="text-[10px] font-bold" style={{
                        color: g.score_confianca >= 80 ? "hsl(145 60% 38%)" : g.score_confianca >= 50 ? "hsl(40 80% 45%)" : "hsl(0 70% 50%)"
                      }}>
                        {g.score_confianca}% CONFIANÇA
                      </span>
                    )}
                  </div>
                  {caso && (
                    <div className="text-[9px] mt-1.5 uppercase font-semibold" style={{ color: "hsl(220 10% 62%)" }}>
                      CASO: {caso.titulo}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3.5 text-[10px] font-bold uppercase tracking-wide rounded-lg border-2 transition-all duration-200 hover:shadow-sm"
                    style={{ borderColor: "hsl(220 15% 88%)", background: "white" }}
                    disabled={isDownloading}
                    onClick={() => handleDownload(g)}
                  >
                    {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    DOCX
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Cases without generation */}
          {casos.filter(c => !c.geracao_id).map(c => (
            <div key={c.id}
              className="rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 opacity-60"
              style={{ borderColor: "hsl(220 15% 88%)", background: "hsl(220 15% 98%)" }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "hsl(40 80% 50% / 0.1)" }}>
                <Clock className="h-4 w-4" style={{ color: "hsl(40 80% 50%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                  {c.titulo || "CASO EM ANDAMENTO"}
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase" style={{ color: "hsl(40 80% 45%)" }}>
                    {c.status?.toUpperCase() || "EM ANDAMENTO"}
                  </span>
                  <span className="text-[10px] flex items-center gap-1 font-medium" style={{ color: "hsl(220 10% 55%)" }}>
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
