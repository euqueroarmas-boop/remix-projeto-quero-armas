import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Loader2, Database, Shield, BarChart3, Save } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

interface ConfigItem {
  id: string;
  chave: string;
  valor: number;
  descricao: string | null;
}

export default function QAConfiguracoesPage() {
  const { profile } = useQAAuth();
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [docs, normas, jurisps, pecas, consultas, refs, revisoes, configRes] = await Promise.all([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_fontes_normativas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_jurisprudencias" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_referencias_preferenciais" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("qa_revisoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_config" as any).select("*").order("chave"),
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
      const items = (configRes.data as any[]) ?? [];
      setConfig(items);
      const initial: Record<string, string> = {};
      items.forEach((c: any) => { initial[c.id] = String(c.valor); });
      setEditedValues(initial);
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveWeights = async () => {
    setSaving(true);
    try {
      for (const item of config) {
        const newVal = parseFloat(editedValues[item.id] || "0");
        if (newVal !== item.valor) {
          await supabase.from("qa_config" as any).update({ valor: newVal, updated_at: new Date().toISOString() }).eq("id", item.id);
        }
      }
      toast.success("Pesos de ranking atualizados");
      // Reload
      const { data } = await supabase.from("qa_config" as any).select("*").order("chave");
      setConfig((data as any[]) ?? []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = profile?.perfil === "administrador";

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

      {/* Ranking Weights - EDITABLE */}
      <div className="bg-[#12121c] border border-slate-800/40 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Pesos de Ranking
          </h2>
          {isAdmin && (
            <Button onClick={handleSaveWeights} disabled={saving} size="sm" className="bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.map(c => (
            <div key={c.id} className="space-y-1">
              <Label className="text-slate-400 text-xs">{c.descricao || c.chave}</Label>
              <Input
                value={editedValues[c.id] || ""}
                onChange={e => setEditedValues(prev => ({ ...prev, [c.id]: e.target.value }))}
                disabled={!isAdmin}
                type="number"
                step="0.01"
                className={`bg-[#0c0c14] border-slate-700 ${isAdmin ? "text-slate-100" : "text-slate-500"}`}
              />
              <div className="text-[10px] text-slate-600 font-mono">{c.chave}</div>
            </div>
          ))}
        </div>
        {!isAdmin && <p className="text-xs text-slate-600 mt-3">Apenas administradores podem editar os pesos de ranking.</p>}
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
