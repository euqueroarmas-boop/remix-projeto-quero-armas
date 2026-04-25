import { useEffect, useState } from "react";
import { Plus, Trash2, Boxes, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Municao {
  id: string;
  cliente_id: number;
  calibre: string;
  quantidade: number;
  marca: string | null;
  observacao: string | null;
}

interface Props {
  clienteId: number;
  onChange?: (totals: { total: number; byCalibre: { calibre: string; quantidade: number }[] }) => void;
}

const COMMON_CALIBRES = ["9MM", ".380", ".40", ".38", ".357", ".22LR", ".223", ".308", "CAL .12", "5.56"];

export function MunicoesManager({ clienteId, onChange }: Props) {
  const [items, setItems] = useState<Municao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ calibre: "9MM", quantidade: "", marca: "" });

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_municoes" as any)
      .select("*")
      .eq("cliente_id", clienteId)
      .order("calibre", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar munições");
      setLoading(false);
      return;
    }
    const list = (data as any as Municao[]) ?? [];
    setItems(list);
    setLoading(false);
    if (onChange) {
      const byCalibreMap = new Map<string, number>();
      list.forEach((m) => byCalibreMap.set(m.calibre, (byCalibreMap.get(m.calibre) ?? 0) + Number(m.quantidade || 0)));
      const byCalibre = Array.from(byCalibreMap.entries()).map(([calibre, quantidade]) => ({ calibre, quantidade }));
      const total = byCalibre.reduce((a, b) => a + b.quantidade, 0);
      onChange({ total, byCalibre });
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const handleAdd = async () => {
    const qtd = parseInt(form.quantidade, 10);
    if (!form.calibre.trim() || !Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe calibre e quantidade válida.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("qa_municoes" as any).insert({
      cliente_id: clienteId,
      calibre: form.calibre.trim().toUpperCase(),
      quantidade: qtd,
      marca: form.marca.trim() || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar munição.");
      return;
    }
    setForm({ calibre: "9MM", quantidade: "", marca: "" });
    toast.success("Munição registrada.");
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este lote de munição?")) return;
    const { error } = await supabase.from("qa_municoes" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover.");
      return;
    }
    toast.success("Removido.");
    reload();
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Boxes className="h-4 w-4 text-cyan-600" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Estoque de Munições
          </div>
          <div className="text-[10px] text-slate-400">Cadastre por calibre — somado automaticamente nos KPIs.</div>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          value={form.calibre}
          onChange={(e) => setForm((f) => ({ ...f, calibre: e.target.value }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-mono text-slate-700"
        >
          {COMMON_CALIBRES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Quantidade"
          value={form.quantidade}
          onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
        />
        <input
          type="text"
          placeholder="Marca (opcional)"
          value={form.marca}
          onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
        />
        <Button
          onClick={handleAdd}
          disabled={saving}
          className="h-9 bg-slate-900 px-3 text-[10px] uppercase tracking-wider text-white hover:bg-slate-800"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Registrar
        </Button>
      </div>

      {/* List */}
      <div className="mt-3 space-y-1.5">
        {loading ? (
          <div className="py-6 text-center text-[11px] text-slate-400">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
            Nenhuma munição cadastrada. Use o formulário acima.
          </div>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-700">
                  {m.calibre}
                </span>
                <span className="font-mono text-[13px] font-semibold text-slate-800">
                  {m.quantidade.toLocaleString("pt-BR")}
                </span>
                {m.marca && <span className="text-[10px] text-slate-500">· {m.marca}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className="text-slate-400 hover:text-red-500"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}