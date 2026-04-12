import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BookOpen, Scale, Gavel, PenTool, AlertTriangle, Clock, Bot, FileText } from "lucide-react";

interface Stats {
  documentos: number;
  normas: number;
  jurisprudencias: number;
  pecas: number;
  pendentes: number;
}

export default function QADashboardPage() {
  const [stats, setStats] = useState<Stats>({ documentos: 0, normas: 0, jurisprudencias: 0, pecas: 0, pendentes: 0 });

  useEffect(() => {
    const load = async () => {
      const [d, n, j, p, pend] = await Promise.all([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado"),
      ]);
      setStats({
        documentos: d.count ?? 0,
        normas: n.count ?? 0,
        jurisprudencias: j.count ?? 0,
        pecas: p.count ?? 0,
        pendentes: pend.count ?? 0,
      });
    };
    load();
  }, []);

  const cards = [
    { label: "Documentos", value: stats.documentos, icon: BookOpen, color: "text-blue-400", bg: "bg-blue-500/10", link: "/quero-armas/base-conhecimento" },
    { label: "Normas", value: stats.normas, icon: Scale, color: "text-emerald-400", bg: "bg-emerald-500/10", link: "/quero-armas/legislacao" },
    { label: "Jurisprudências", value: stats.jurisprudencias, icon: Gavel, color: "text-purple-400", bg: "bg-purple-500/10", link: "/quero-armas/jurisprudencia" },
    { label: "Peças Geradas", value: stats.pecas, icon: PenTool, color: "text-amber-400", bg: "bg-amber-500/10", link: "/quero-armas/historico" },
    { label: "Pendentes Validação", value: stats.pendentes, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", link: "/quero-armas/base-conhecimento" },
  ];

  const shortcuts = [
    { label: "Consultar IA", icon: Bot, link: "/quero-armas/ia" },
    { label: "Gerar Peça", icon: PenTool, link: "/quero-armas/gerar-peca" },
    { label: "Enviar Documento", icon: BookOpen, link: "/quero-armas/base-conhecimento" },
    { label: "Modelos DOCX", icon: FileText, link: "/quero-armas/modelos-docx" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral da base jurídica</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Link key={c.label} to={c.link} className={`${c.bg} border border-slate-800/40 rounded-xl p-4 hover:border-slate-700 transition-all`}>
            <c.icon className={`h-5 w-5 ${c.color} mb-2`} />
            <div className="text-2xl font-bold text-slate-100">{c.value}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Atalhos Rápidos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {shortcuts.map(s => (
            <Link key={s.label} to={s.link} className="flex items-center gap-3 bg-[#12121c] border border-slate-800/40 rounded-xl p-4 hover:border-amber-500/30 transition-all group">
              <s.icon className="h-5 w-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              <span className="text-sm text-slate-300">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
