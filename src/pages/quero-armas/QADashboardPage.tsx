import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, XCircle, PenTool, BookOpen,
  ArrowRight, FileText, Shield,
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
        supabase.from("qa_geracoes_pecas" as any).select("id, titulo_geracao, tipo_peca, created_at, status_revisao").order("created_at", { ascending: false }).limit(6),
        supabase.from("qa_documentos_conhecimento" as any).select("id, titulo, tipo_documento, created_at, status_processamento").eq("ativo", true).order("created_at", { ascending: false }).limit(6),
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
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" />
      </div>
    );
  }

  const alerts = [
    stats.erros > 0 && { label: `${stats.erros} com erro`, icon: XCircle, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10", link: "/quero-armas/base-conhecimento" },
    stats.pendentes > 0 && { label: `${stats.pendentes} pendente(s)`, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10", link: "/quero-armas/base-conhecimento" },
    stats.rascunhos > 0 && { label: `${stats.rascunhos} rascunho(s)`, icon: Clock, color: "text-neutral-400", bg: "bg-neutral-500/5 border-neutral-500/10", link: "/quero-armas/historico" },
  ].filter(Boolean) as any[];

  const statusColor = (s: string) => {
    if (s === "concluido" || s === "aprovado" || s === "aprovado_como_referencia") return "text-emerald-400";
    if (s === "erro" || s === "texto_invalido" || s === "rejeitado") return "text-red-400";
    return "text-neutral-600";
  };

  return (
    <div className="space-y-3 md:space-y-5 max-w-6xl">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map((a, i) => (
            <Link key={i} to={a.link} className={`flex items-center gap-2 px-2.5 py-1.5 md:py-2 rounded-lg border ${a.bg} hover:opacity-80 transition-opacity`}>
              <a.icon className={`h-3 w-3 ${a.color} shrink-0`} />
              <span className={`text-[11px] md:text-[12px] ${a.color} flex-1`}>{a.label}</span>
              <ArrowRight className="h-2.5 w-2.5 text-neutral-700" />
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-1.5 md:gap-2">
        <Link to="/quero-armas/gerar-peca"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#7a1528] hover:bg-[#a52338] rounded-lg transition-colors text-[11px] text-white font-medium active:scale-[0.98]">
          <PenTool className="h-3 w-3" /> <span className="hidden xs:inline">Nova</span> Peça
        </Link>
        <Link to="/quero-armas/base-conhecimento"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] border border-[#1c1c1c] rounded-lg hover:border-neutral-600 transition-colors text-[11px] text-neutral-400 hover:text-neutral-300">
          <BookOpen className="h-3 w-3" /> Base
        </Link>
        <Link to="/quero-armas/ia"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] border border-[#1c1c1c] rounded-lg hover:border-neutral-600 transition-colors text-[11px] text-neutral-400 hover:text-neutral-300">
          <Shield className="h-3 w-3" /> IA
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6 md:gap-2">
        {[
          { label: "Docs", value: stats.documentos },
          { label: "Normas", value: stats.normas },
          { label: "Jurisp.", value: stats.jurisprudencias },
          { label: "Peças", value: stats.pecas },
          { label: "Aprovadas", value: stats.aprovadas },
          { label: "Refs", value: stats.referencias },
        ].map(m => (
          <div key={m.label} className="bg-[#111111] border border-[#1c1c1c] rounded-lg px-2 py-2 md:px-3 md:py-3 text-center hover:border-[#2a2a2a] transition-colors">
            <div className="text-sm md:text-lg font-semibold text-neutral-200 font-mono tabular-nums leading-tight">{m.value}</div>
            <div className="text-[8px] md:text-[9px] text-neutral-600 uppercase tracking-[0.1em] mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-lg p-2.5 md:p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Últimas Peças</span>
            <Link to="/quero-armas/historico" className="text-[9px] text-neutral-700 hover:text-[#c43b52] transition-colors">→</Link>
          </div>
          {recentPecas.length === 0 ? (
            <div className="text-[10px] text-neutral-700 py-3 text-center">Nenhuma peça</div>
          ) : (
            <div className="space-y-px">
              {recentPecas.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 py-1.5 px-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors">
                  <PenTool className="h-2.5 w-2.5 text-neutral-700 shrink-0" />
                  <span className="text-[11px] text-neutral-400 truncate flex-1 min-w-0">{p.titulo}</span>
                  <span className={`text-[8px] font-mono shrink-0 ${statusColor(p.status || "")}`}>
                    {(p.status || "—").replace(/_/g, " ")}
                  </span>
                  <span className="text-[8px] text-neutral-700 font-mono tabular-nums shrink-0 hidden sm:block">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#111111] border border-[#1c1c1c] rounded-lg p-2.5 md:p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-neutral-600 uppercase tracking-[0.12em] font-medium">Últimos Documentos</span>
            <Link to="/quero-armas/base-conhecimento" className="text-[9px] text-neutral-700 hover:text-[#c43b52] transition-colors">→</Link>
          </div>
          {recentDocs.length === 0 ? (
            <div className="text-[10px] text-neutral-700 py-3 text-center">Nenhum documento</div>
          ) : (
            <div className="space-y-px">
              {recentDocs.map(d => (
                <Link key={d.id} to={`/quero-armas/base-conhecimento/${d.id}`}
                  className="flex items-center gap-1.5 py-1.5 px-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors">
                  <FileText className="h-2.5 w-2.5 text-neutral-700 shrink-0" />
                  <span className="text-[11px] text-neutral-400 truncate flex-1 min-w-0">{d.titulo}</span>
                  <span className={`text-[8px] font-mono shrink-0 ${statusColor(d.status || "")}`}>
                    {(d.status || "—").replace(/_/g, " ")}
                  </span>
                  <span className="text-[8px] text-neutral-700 font-mono tabular-nums shrink-0 hidden sm:block">
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
