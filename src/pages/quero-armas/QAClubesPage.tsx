import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Loader2, Save, Search, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Clube {
  id: number; id_legado: number | null; nome_clube: string; cnpj: string | null;
  numero_cr: string | null; data_validade: string | null; endereco: string | null;
}

export default function QAClubesPage() {
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; item?: Clube }>({ open: false });
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("qa_clubes" as any).select("*").order("nome_clube");
    setClubes((data as any[]) ?? []);
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("qa_clubes" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Clube excluído");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setDeleting(null); }
  };

  const filtered = clubes.filter(c => {
    const s = search.toLowerCase();
    return !s || c.nome_clube?.toLowerCase().includes(s) || c.cnpj?.includes(s);
  });

  const formatDate = (d: string | null) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; } };

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>Clubes de Tiro</h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>{clubes.length} cadastrados</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="qa-btn-primary flex items-center gap-1.5 no-glow">
          <Plus className="h-3.5 w-3.5" /> Novo Clube
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(220 10% 55%)" }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clube..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border bg-white text-sm uppercase outline-none transition-all"
          style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
          onFocus={e => e.currentTarget.style.borderColor = "hsl(230 80% 56%)"}
          onBlur={e => e.currentTarget.style.borderColor = "hsl(220 13% 91%)"}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhum clube encontrado</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="qa-card qa-hover-lift p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
                  <Building2 className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_clube}</div>
                  <div className="flex items-center gap-3 text-[11px] mt-0.5 flex-wrap uppercase" style={{ color: "hsl(220 10% 55%)" }}>
                    {c.cnpj && <span>CNPJ: {c.cnpj}</span>}
                    {c.numero_cr && <span>CR: {c.numero_cr}</span>}
                    <span>Val: {formatDate(c.data_validade)}</span>
                  </div>
                  {c.endereco && <div className="text-[11px] mt-0.5 truncate uppercase" style={{ color: "hsl(220 10% 62%)" }}>{c.endereco}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setModal({ open: true, item: c })} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ color: "hsl(220 10% 55%)" }}>
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500">
                    {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <ClubeFormModal open={modal.open} onClose={() => setModal({ open: false })} onSaved={load} clube={modal.item} />
    </div>
  );
}

function ClubeFormModal({ open, onClose, onSaved, clube }: { open: boolean; onClose: () => void; onSaved: () => void; clube?: Clube }) {
  const isEdit = !!clube;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ nome_clube: "", cnpj: "", numero_cr: "", data_validade: "", endereco: "" });

  useEffect(() => {
    if (clube) setF({ nome_clube: clube.nome_clube, cnpj: clube.cnpj || "", numero_cr: clube.numero_cr || "", data_validade: clube.data_validade || "", endereco: clube.endereco || "" });
    else setF({ nome_clube: "", cnpj: "", numero_cr: "", data_validade: "", endereco: "" });
  }, [clube, open]);

  const save = async () => {
    if (!f.nome_clube.trim()) { toast.error("Nome do clube é obrigatório"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("qa_clubes" as any).update(f).eq("id", clube!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_clubes" as any).insert(f);
        if (error) throw error;
      }
      toast.success(isEdit ? "Clube atualizado" : "Clube cadastrado");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-white border-slate-200 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
            {isEdit ? "Editar Clube" : "Novo Clube de Tiro"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2 uppercase">
          <FormInput label="Nome do Clube *" value={f.nome_clube} onChange={v => setF(p => ({ ...p, nome_clube: v }))} />
          <div className="flex gap-3">
            <FormInput label="CNPJ" value={f.cnpj} onChange={v => setF(p => ({ ...p, cnpj: v }))} />
            <FormInput label="Nº CR" value={f.numero_cr} onChange={v => setF(p => ({ ...p, numero_cr: v }))} />
          </div>
          <FormInput label="Validade CR" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} placeholder="DD/MM/AAAA" />
          <FormInput label="Endereço Completo" value={f.endereco} onChange={v => setF(p => ({ ...p, endereco: v }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="qa-btn-outline h-9 px-4 text-xs">Cancelar</button>
            <button onClick={save} disabled={saving} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="flex-1 space-y-1.5">
      <label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 bg-white border-slate-200 text-slate-800 uppercase" />
    </div>
  );
}
