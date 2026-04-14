import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-neutral-100">Clubes de Tiro</h1>
          <p className="text-[10px] text-neutral-600">{clubes.length} cadastrados</p>
        </div>
        <Button size="sm" onClick={() => setModal({ open: true })} className="h-7 px-2 text-[10px] bg-[#7a1528] hover:bg-[#9a1b32]">
          <Plus className="h-3 w-3 mr-1" /> Novo Clube
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clube..." className="pl-8 h-8 text-[11px] bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-600" /></div>
      ) : (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-1.5">
            {filtered.map(c => (
              <div key={c.id} className="flex items-start gap-3 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-[#7a1528]/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-[#c43b52]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-neutral-200 font-medium">{c.nome_clube}</div>
                  <div className="text-[9px] text-neutral-500 mt-0.5 space-x-3">
                    {c.cnpj && <span>CNPJ: {c.cnpj}</span>}
                    {c.numero_cr && <span>CR: {c.numero_cr}</span>}
                    <span>Val: {formatDate(c.data_validade)}</span>
                  </div>
                  {c.endereco && <div className="text-[9px] text-neutral-600 mt-0.5 truncate">{c.endereco}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, item: c })} className="h-6 w-6 p-0 text-neutral-600 hover:text-neutral-300">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="h-6 w-6 p-0 text-neutral-600 hover:text-red-400">
                    {deleting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
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

// ─── Clube Form Modal ───
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
      <DialogContent className="max-w-md bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar Clube" : "Novo Clube de Tiro"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Nome do Clube *" value={f.nome_clube} onChange={v => setF(p => ({ ...p, nome_clube: v }))} />
          <div className="flex gap-2">
            <Inp label="CNPJ" value={f.cnpj} onChange={v => setF(p => ({ ...p, cnpj: v }))} />
            <Inp label="Nº CR" value={f.numero_cr} onChange={v => setF(p => ({ ...p, numero_cr: v }))} />
          </div>
          <Inp label="Validade CR" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} type="date" />
          <Inp label="Endereço Completo" value={f.endereco} onChange={v => setF(p => ({ ...p, endereco: v }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-[11px] h-7">Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-[#7a1528] hover:bg-[#9a1b32] text-[11px] h-7">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Inp({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex-1">
      <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200" />
    </div>
  );
}
