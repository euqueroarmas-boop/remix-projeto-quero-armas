import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
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
        documentos: docs.count ?? 0, normas: normas.count ?? 0,
        jurisprudencias: jurisps.count ?? 0, pecas: pecas.count ?? 0,
        consultas: consultas.count ?? 0, referencias: refs.count ?? 0,
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
      toast.success("Pesos atualizados");
      const { data } = await supabase.from("qa_config" as any).select("*").order("chave");
      setConfig((data as any[]) ?? []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = profile?.perfil === "administrador";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-4 h-4 border-2 border-[#1a1a1a] border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-5 max-w-4xl">
      <h1 className="text-sm md:text-base font-semibold text-slate-300">Configurações</h1>

      {/* System Status — compact grid */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2.5 md:p-4">
        <span className="text-[9px] text-slate-600 uppercase tracking-[0.12em] font-medium">Status</span>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-3 mt-2">
          {[
            { label: "Docs", value: stats?.documentos },
            { label: "Normas", value: stats?.normas },
            { label: "Jurisp.", value: stats?.jurisprudencias },
            { label: "Peças", value: stats?.pecas },
            { label: "Consultas", value: stats?.consultas },
            { label: "Refs", value: stats?.referencias },
            { label: "Revisões", value: stats?.revisoes },
          ].map(s => (
            <div key={s.label} className="bg-[#050505] rounded px-2 py-1.5 text-center">
              <div className="text-sm md:text-base font-semibold text-slate-300 font-mono tabular-nums leading-tight">{s.value}</div>
              <div className="text-[7px] md:text-[9px] text-slate-600 uppercase tracking-[0.08em]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking Weights */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2.5 md:p-4">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <span className="text-[9px] text-slate-600 uppercase tracking-[0.12em] font-medium">Pesos de Ranking</span>
          {isAdmin && (
            <Button onClick={handleSaveWeights} disabled={saving} size="sm"
              className="bg-[#161616] hover:bg-[#1f1f1f] text-slate-400 border border-[#1a1a1a] h-6 md:h-7 text-[9px] md:text-[10px]">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          {config.map(c => (
            <div key={c.id} className="space-y-0.5 md:space-y-1">
              <Label className="text-slate-500 text-[9px] md:text-[10px]">{c.descricao || c.chave}</Label>
              <Input
                value={editedValues[c.id] || ""}
                onChange={e => setEditedValues(prev => ({ ...prev, [c.id]: e.target.value }))}
                disabled={!isAdmin}
                type="number" step="0.01"
                className="bg-[#050505] border-[#1a1a1a] text-slate-400 h-7 md:h-8 text-[11px] font-mono"
              />
              <div className="text-[8px] text-slate-700 font-mono">{c.chave}</div>
            </div>
          ))}
        </div>
        {!isAdmin && <p className="text-[9px] text-slate-700 mt-2">Apenas administradores podem editar.</p>}
      </div>

      {/* Profile — compact */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2.5 md:p-4">
        <span className="text-[9px] text-slate-600 uppercase tracking-[0.12em] font-medium">Perfil</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-3 mt-2 text-[11px]">
          <div><span className="text-slate-600">Nome:</span> <span className="text-slate-400 ml-1">{profile?.nome || "—"}</span></div>
          <div><span className="text-slate-600">Perfil:</span> <span className="text-slate-400 ml-1 capitalize">{profile?.perfil?.replace(/_/g, " ") || "—"}</span></div>
          <div><span className="text-slate-600">Email:</span> <span className="text-slate-400 ml-1 truncate">{profile?.email || "—"}</span></div>
          <div><span className="text-slate-600">Status:</span> <span className={`ml-1 ${profile?.ativo ? "text-emerald-400" : "text-red-400"}`}>{profile?.ativo ? "Ativo" : "Inativo"}</span></div>
        </div>
      </div>
    </div>
  );
}
