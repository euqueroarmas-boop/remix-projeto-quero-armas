import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, XCircle, PenTool, BookOpen,
  Activity, ArrowRight, FileText, Loader2, Shield,
} from "lucide-react";

interface Stats {
  documentos: number;
  normas: number;
  jurisprudencias: number;
  pecas: number;
  pendentes: number;
  erros: number;
  consultas: number;
  aprovadas: number;
  referencias: number;
  rascunhos: number;
}

interface RecentItem {
  id: string;
  titulo: string;
  tipo: string;
  created_at: string;
  status?: string;
}

export default function QADashboardPage() {
  const [stats, setStats] = useState<Stats>({
    documentos: 0, normas: 0, jurisprudencias: 0, pecas: 0,
    pendentes: 0, erros: 0, consultas: 0, aprovadas: 0, referencias: 0, rascunhos: 0,
  });
  const [recentPecas, setRecentPecas] = useState<RecentItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [d, n, j, p, pend, erros, c, apr, ref, rasc, rPecas, rDocs] = await Promise.all([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado").eq("ativo", true),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).in("status_processamento", ["erro", "texto_invalido"]).eq("ativo", true),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "aprovado"),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "rascunho"),
        supabase.from("qa_geracoes_pecas" as any).select("id, titulo_geracao, tipo_peca, created_at, status_revisao").order("created_at", { ascending: false }).limit(5),
        supabase.from("qa_documentos_conhecimento" as any).select("id, titulo, tipo_documento, created_at, status_processamento").eq("ativo", true).order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        documentos: d.count ?? 0, normas: n.count ?? 0, jurisprudencias: j.count ?? 0,
        pecas: p.count ?? 0, pendentes: pend.count ?? 0, erros: erros.count ?? 0,
        consultas: c.count ?? 0, aprovadas: apr.count ?? 0, referencias: ref.count ?? 0,
        rascunhos: rasc.count ?? 0,
      });
      setRecentPecas((rPecas.data as any[] ?? []).map((r: any) => ({
        id: r.id, titulo: r.titulo_geracao || "Sem título",
        tipo: r.tipo_peca, created_at: r.created_at, status: r.status_revisao,
      })));
      setRecentDocs((rDocs.data as any[] ?? []).map((r: any) => ({
        id: r.id, titulo: r.titulo || "Sem título",
        tipo: r.tipo_documento, created_at: r.created_at, status: r.status_processamento,
      })));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  const alerts = [
    stats.erros > 0 && { label: `${stats.erros} documento(s) com erro`, icon: XCircle, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10", link: "/quero-armas/base-conhecimento" },
    stats.pendentes > 0 && { label: `${stats.pendentes} pendente(s) de validação`, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10", link: "/quero-armas/base-conhecimento" },
    stats.rascunhos > 0 && { label: `${stats.rascunhos} rascunho(s) aguardando revisão`, icon: Clock, color: "text-slate-400", bg: "bg-slate-500/5 border-slate-500/10", link: "/quero-armas/historico" },
  ].filter(Boolean) as any[];

  const statusColor = (s: string) => {
    if (s === "concluido" || s === "aprovado" || s === "aprovado_como_referencia") return "text-emerald-400";
    if (s === "erro" || s === "texto_invalido" || s === "rejeitado") return "text-red-400";
    if (s === "rascunho" || s === "pendente") return "text-slate-500";
    return "text-slate-500";
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <Link key={i} to={a.link} className={`flex items-center gap-2.5 px-3 py-2 rounded border ${a.bg} hover:opacity-80 transition-opacity`}>
              <a.icon className={`h-3.5 w-3.5 ${a.color} shrink-0`} />
              <span className={`text-[12px] ${a.color}`}>{a.label}</span>
              <ArrowRight className="h-3 w-3 text-slate-600 ml-auto" />
            </Link>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "Documentos", value: stats.documentos },
          { label: "Normas", value: stats.normas },
          { label: "Jurisprud.", value: stats.jurisprudencias },
          { label: "Peças", value: stats.pecas },
          { label: "Aprovadas", value: stats.aprovadas },
          { label: "Referências", value: stats.referencias },
        ].map(m => (
          <div key={m.label} className="bg-[#0c0c16] border border-[#1a1a2e] rounded px-3 py-2.5 text-center">
            <div className="text-lg font-semibold text-slate-300 font-mono tabular-nums">{m.value}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-[0.15em] mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/quero-armas/gerar-peca"
          className="flex items-center gap-2 px-3 py-2 bg-[#0c0c16] border border-[#1a1a2e] rounded hover:border-slate-600 transition-colors text-[12px] text-slate-400 hover:text-slate-300">
          <PenTool className="h-3.5 w-3.5" /> Nova Peça
        </Link>
        <Link to="/quero-armas/base-conhecimento"
          className="flex items-center gap-2 px-3 py-2 bg-[#0c0c16] border border-[#1a1a2e] rounded hover:border-slate-600 transition-colors text-[12px] text-slate-400 hover:text-slate-300">
          <BookOpen className="h-3.5 w-3.5" /> Base Jurídica
        </Link>
        <Link to="/quero-armas/ia"
          className="flex items-center gap-2 px-3 py-2 bg-[#0c0c16] border border-[#1a1a2e] rounded hover:border-slate-600 transition-colors text-[12px] text-slate-400 hover:text-slate-300">
          <Shield className="h-3.5 w-3.5" /> Assistente
        </Link>
      </div>

      {/* Two columns: Recent Pieces + Recent Docs */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent Pieces */}
        <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Últimas Peças</span>
            <Link to="/quero-armas/historico" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">Ver todas →</Link>
          </div>
          {recentPecas.length === 0 ? (
            <div className="text-[11px] text-slate-700 py-4 text-center">Nenhuma peça gerada</div>
          ) : (
            <div className="space-y-1">
              {recentPecas.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#14142a] transition-colors">
                  <PenTool className="h-3 w-3 text-slate-600 shrink-0" />
                  <span className="text-[12px] text-slate-400 truncate flex-1">{p.titulo}</span>
                  <span className={`text-[9px] font-mono ${statusColor(p.status || "")}`}>
                    {(p.status || "—").replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-slate-700 font-mono tabular-nums">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Docs */}
        <div className="bg-[#0c0c16] border border-[#1a1a2e] rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-medium">Últimos Documentos</span>
            <Link to="/quero-armas/base-conhecimento" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">Ver todos →</Link>
          </div>
          {recentDocs.length === 0 ? (
            <div className="text-[11px] text-slate-700 py-4 text-center">Nenhum documento</div>
          ) : (
            <div className="space-y-1">
              {recentDocs.map(d => (
                <Link key={d.id} to={`/quero-armas/base-conhecimento/${d.id}`}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#14142a] transition-colors">
                  <FileText className="h-3 w-3 text-slate-600 shrink-0" />
                  <span className="text-[12px] text-slate-400 truncate flex-1">{d.titulo}</span>
                  <span className={`text-[9px] font-mono ${statusColor(d.status || "")}`}>
                    {(d.status || "—").replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-slate-700 font-mono tabular-nums">
                    {new Date(d.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
