import { useEffect, useState } from "react";
import { Plus, Trash2, Boxes, Loader2, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { calcularValidadeMunicao } from "@/lib/quero-armas/municaoValidade";
import type { CorStatus } from "@/lib/quero-armas/statusUnificado";

interface Municao {
  id: string;
  cliente_id: number;
  calibre: string;
  quantidade: number;
  marca: string | null;
  observacao: string | null;
  data_fabricacao: string | null;
}

interface Props {
  clienteId: number;
  onChange?: (totals: { total: number; byCalibre: { calibre: string; quantidade: number }[] }) => void;
}

const COMMON_CALIBRES = [
  // Pistolas / submetralhadoras
  "9MM",
  ".380",
  ".40",
  ".45 ACP",
  "10MM",
  ".25 ACP",
  ".32 ACP",
  "9X21",
  ".357 SIG",
  // Revólveres
  ".38",
  ".357",
  ".44 MAGNUM",
  ".44 SPECIAL",
  ".22 MAGNUM",
  // Rimfire
  ".22LR",
  ".22 CURTO",
  ".17 HMR",
  // Fuzis / carabinas
  ".223",
  "5.56",
  ".308",
  "7.62X51",
  "7.62X39",
  "7.62X63 (.30-06)",
  ".300 BLACKOUT",
  ".30-30",
  ".338 LAPUA",
  ".338 MAGNUM",
  ".50 BMG",
  ".416",
  // Espingardas
  "CAL .12",
  "CAL .16",
  "CAL .20",
  "CAL .24",
  "CAL .28",
  "CAL .32",
  "CAL .36",
  "CAL .410",
  // Caça / esportivos comuns
  ".243 WIN",
  ".270 WIN",
  "7MM REM MAG",
  "6.5 CREEDMOOR",
];

// Máscara DD/MM/AAAA → ISO YYYY-MM-DD (segue padrão Quero Armas).
function applyDateMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function brToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : iso;
}
function isoToBr(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
const TONE_BG: Record<CorStatus, string> = {
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200",
  azul: "bg-[#FBF3F4] text-[#7A1F2B] border-[#E5C2C6]",
  amarelo: "bg-amber-50 text-amber-700 border-amber-200",
  laranja: "bg-orange-50 text-orange-700 border-orange-200",
  vermelho: "bg-red-50 text-red-700 border-red-200",
  cinza: "bg-slate-50 text-slate-500 border-slate-200",
};

export function MunicoesManager({ clienteId, onChange }: Props) {
  const [items, setItems] = useState<Municao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ calibre: "9MM", quantidade: "", marca: "", data_fabricacao: "" });

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
    let isoFab: string | null = null;
    if (form.data_fabricacao.trim()) {
      isoFab = brToIso(form.data_fabricacao.trim());
      if (!isoFab) {
        toast.error("Data de fabricação inválida (use DD/MM/AAAA).");
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("qa_municoes" as any).insert({
      cliente_id: clienteId,
      calibre: form.calibre.trim().toUpperCase(),
      quantidade: qtd,
      marca: form.marca.trim() || null,
      data_fabricacao: isoFab,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar munição.");
      return;
    }
    setForm({ calibre: "9MM", quantidade: "", marca: "", data_fabricacao: "" });
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
        <Boxes className="h-4 w-4 text-[#7A1F2B]" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Estoque de Munições
          </div>
          <div className="text-[10px] text-slate-400">Cadastre por calibre — somado automaticamente nos KPIs.</div>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
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
        <input
          type="text"
          inputMode="numeric"
          placeholder="Fabricação DD/MM/AAAA"
          value={form.data_fabricacao}
          onChange={(e) => setForm((f) => ({ ...f, data_fabricacao: applyDateMask(e.target.value) }))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-mono text-slate-700"
          maxLength={10}
        />
        <Button
          onClick={handleAdd}
          disabled={saving}
          className="h-9 bg-[#2563EB] px-3 text-[10px] uppercase tracking-wider text-white hover:bg-[#1D4ED8]"
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
          items.map((m) => {
            const v = calcularValidadeMunicao(m.data_fabricacao);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#FBF3F4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7A1F2B]">
                    {m.calibre}
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-slate-800">
                    {m.quantidade.toLocaleString("pt-BR")}
                  </span>
                  {m.marca && <span className="text-[10px] text-slate-500">· {m.marca}</span>}
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TONE_BG[v.status.cor]}`}
                    title={
                      v.sem_data
                        ? "Sem data de fabricação cadastrada"
                        : `Fabricação ${isoToBr(m.data_fabricacao)} · Validade ${isoToBr(v.data_validade)}`
                    }
                  >
                    <CalendarClock className="h-3 w-3" />
                    {v.sem_data
                      ? "SEM DATA"
                      : `VAL ${isoToBr(v.data_validade)}`}
                  </span>
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
            );
          })
        )}
      </div>
    </div>
  );
}