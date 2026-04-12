import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Loader2, Database, Users, Shield, BarChart3 } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

export default function QAConfiguracoesPage() {
  const { profile } = useQAAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [docs, normas, jurisps, pecas, consultas, refs, revisoes] = await Promise.all([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_revisoes_pecas" as any).select("id", { count: "exact", head: true }),
      ]);
      setStats({
        documentos: docs.count ?? 0,
        normas: normas.count ?? 0,
        jurisprudencias: jurisps.count ?? 0,
        pecas: pecas.count ?? 0,
        consultas: consultas.count ?? 0,
        referencias: refs.count ?? 0,
        revisoes: revisoes.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-amber-500" /> Configurações
        </h1>
        <p className="text-sm text-slate-500 mt-1">Administração do módulo jurídico</p>
      </div>

      {/* System Status */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <Database className="h-4 w-4" /> Status da Base de Conhecimento
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Documentos", value: stats?.documentos },
            { label: "Normas", value: stats?.normas },
            { label: "Jurisprudências", value: stats?.jurisprudencias },
            { label: "Peças Geradas", value: stats?.pecas },
            { label: "Consultas IA", value: stats?.consultas },
            { label: "Referências Ativas", value: stats?.referencias },
            { label: "Revisões", value: stats?.revisoes },
          ].map(s => (
            <div key={s.label} className="bg-[#0c0c14] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-slate-100">{s.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking Parameters */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Parâmetros de Ranking (futuro)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs">Peso — Validação Humana</Label>
            <Input value="0.30" disabled className="bg-[#0c0c14] border-slate-700 text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs">Peso — Feedback Positivo</Label>
            <Input value="0.25" disabled className="bg-[#0c0c14] border-slate-700 text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs">Peso — Busca Textual</Label>
            <Input value="0.30" disabled className="bg-[#0c0c14] border-slate-700 text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs">Peso — Busca Semântica</Label>
            <Input value="0.15" disabled className="bg-[#0c0c14] border-slate-700 text-slate-500" />
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3">Configuração de pesos será editável na próxima fase.</p>
      </div>

      {/* Access Profile */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" /> Seu Perfil
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Nome:</span>
            <span className="text-slate-200 ml-2">{profile?.nome || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Perfil:</span>
            <span className="text-amber-400 ml-2 capitalize">{profile?.perfil?.replace(/_/g, " ") || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Email:</span>
            <span className="text-slate-200 ml-2">{profile?.email || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>
            <span className={`ml-2 ${profile?.ativo ? "text-emerald-400" : "text-red-400"}`}>
              {profile?.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
