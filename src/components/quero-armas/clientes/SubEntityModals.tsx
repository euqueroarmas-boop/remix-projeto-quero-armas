import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ─── CRAF Modal ───
interface CrafModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; craf?: any;
}
export function CrafModal({ open, onClose, onSaved, clienteId, craf }: CrafModalProps) {
  const isEdit = !!craf;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ nome_arma: "", nome_craf: "", numero_arma: "", numero_sigma: "", data_validade: "" });

  useEffect(() => {
    if (craf) setF({ nome_arma: craf.nome_arma || "", nome_craf: craf.nome_craf || "", numero_arma: craf.numero_arma || "", numero_sigma: craf.numero_sigma || "", data_validade: craf.data_validade || "" });
    else setF({ nome_arma: "", nome_craf: "", numero_arma: "", numero_sigma: "", data_validade: "" });
  }, [craf, open]);

  const save = async () => {
    if (!f.nome_arma.trim()) { toast.error("Nome da arma é obrigatório"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("qa_crafs" as any).update(f).eq("id", craf.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_crafs" as any).insert({ ...f, cliente_id: clienteId });
        if (error) throw error;
      }
      toast.success(isEdit ? "CRAF atualizado" : "CRAF cadastrado");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar CRAF" : "Novo CRAF"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Nome da Arma *" value={f.nome_arma} onChange={v => setF(p => ({ ...p, nome_arma: v }))} />
          <Inp label="Nome CRAF" value={f.nome_craf} onChange={v => setF(p => ({ ...p, nome_craf: v }))} />
          <div className="flex gap-2">
            <Inp label="Nº Arma" value={f.numero_arma} onChange={v => setF(p => ({ ...p, numero_arma: v }))} />
            <Inp label="Nº SIGMA" value={f.numero_sigma} onChange={v => setF(p => ({ ...p, numero_sigma: v }))} />
          </div>
          <Inp label="Validade" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} type="date" />
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

// ─── GTE Modal ───
interface GteModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; gte?: any;
}
export function GteModal({ open, onClose, onSaved, clienteId, gte }: GteModalProps) {
  const isEdit = !!gte;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ nome_arma: "", nome_gte: "", numero_arma: "", numero_sigma: "", data_validade: "" });

  useEffect(() => {
    if (gte) setF({ nome_arma: gte.nome_arma || "", nome_gte: gte.nome_gte || "", numero_arma: gte.numero_arma || "", numero_sigma: gte.numero_sigma || "", data_validade: gte.data_validade || "" });
    else setF({ nome_arma: "", nome_gte: "", numero_arma: "", numero_sigma: "", data_validade: "" });
  }, [gte, open]);

  const save = async () => {
    if (!f.nome_arma.trim()) { toast.error("Nome da arma é obrigatório"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("qa_gtes" as any).update(f).eq("id", gte.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_gtes" as any).insert({ ...f, cliente_id: clienteId });
        if (error) throw error;
      }
      toast.success(isEdit ? "GTE atualizado" : "GTE cadastrado");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar GTE" : "Novo GTE"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Nome da Arma *" value={f.nome_arma} onChange={v => setF(p => ({ ...p, nome_arma: v }))} />
          <Inp label="Nome GTE" value={f.nome_gte} onChange={v => setF(p => ({ ...p, nome_gte: v }))} />
          <div className="flex gap-2">
            <Inp label="Nº Arma" value={f.numero_arma} onChange={v => setF(p => ({ ...p, numero_arma: v }))} />
            <Inp label="Nº SIGMA" value={f.numero_sigma} onChange={v => setF(p => ({ ...p, numero_sigma: v }))} />
          </div>
          <Inp label="Validade" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} type="date" />
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

// ─── CR/Cadastro Modal ───
interface CrModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; cadastro?: any;
}
export function CrModal({ open, onClose, onSaved, clienteId, cadastro }: CrModalProps) {
  const isEdit = !!cadastro;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ numero_cr: "", validade_cr: "", validade_laudo_psicologico: "", validade_exame_tiro: "", senha_gov: "", check_laudo_psi: false, check_exame_tiro: false });

  useEffect(() => {
    if (cadastro) setF({
      numero_cr: cadastro.numero_cr || "", validade_cr: cadastro.validade_cr || "",
      validade_laudo_psicologico: cadastro.validade_laudo_psicologico || "",
      validade_exame_tiro: cadastro.validade_exame_tiro || "", senha_gov: cadastro.senha_gov || "",
      check_laudo_psi: cadastro.check_laudo_psi || false, check_exame_tiro: cadastro.check_exame_tiro || false,
    });
    else setF({ numero_cr: "", validade_cr: "", validade_laudo_psicologico: "", validade_exame_tiro: "", senha_gov: "", check_laudo_psi: false, check_exame_tiro: false });
  }, [cadastro, open]);

  const save = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("qa_cadastro_cr" as any).update(f).eq("id", cadastro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_cadastro_cr" as any).insert({ ...f, cliente_id: clienteId });
        if (error) throw error;
      }
      toast.success(isEdit ? "CR atualizado" : "CR cadastrado");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar CR" : "Novo Cadastro CR"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Nº CR" value={f.numero_cr} onChange={v => setF(p => ({ ...p, numero_cr: v }))} />
          <Inp label="Validade CR" value={f.validade_cr} onChange={v => setF(p => ({ ...p, validade_cr: v }))} type="date" />
          <Inp label="Validade Laudo Psicológico" value={f.validade_laudo_psicologico} onChange={v => setF(p => ({ ...p, validade_laudo_psicologico: v }))} type="date" />
          <Inp label="Validade Exame de Tiro" value={f.validade_exame_tiro} onChange={v => setF(p => ({ ...p, validade_exame_tiro: v }))} type="date" />
          <Inp label="Senha Gov" value={f.senha_gov} onChange={v => setF(p => ({ ...p, senha_gov: v }))} />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[11px] text-neutral-300">
              <input type="checkbox" checked={f.check_laudo_psi} onChange={e => setF(p => ({ ...p, check_laudo_psi: e.target.checked }))} className="accent-emerald-500" /> Laudo Psicológico OK
            </label>
            <label className="flex items-center gap-2 text-[11px] text-neutral-300">
              <input type="checkbox" checked={f.check_exame_tiro} onChange={e => setF(p => ({ ...p, check_exame_tiro: e.target.checked }))} className="accent-emerald-500" /> Exame de Tiro OK
            </label>
          </div>
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

// ─── Venda Modal ───
interface VendaModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; venda?: any;
}
export function VendaModal({ open, onClose, onSaved, clienteId, venda }: VendaModalProps) {
  const isEdit = !!venda;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ forma_pagamento: "", desconto: "0", valor_a_pagar: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    if (venda) setF({
      forma_pagamento: venda.forma_pagamento || "", desconto: String(venda.desconto || 0),
      valor_a_pagar: String(venda.valor_a_pagar || 0), status: venda.status || "EM ANÁLISE",
      numero_processo: venda.numero_processo || "", data_cadastro: venda.data_cadastro || new Date().toISOString().slice(0, 10),
    });
    else setF({ forma_pagamento: "", desconto: "0", valor_a_pagar: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: new Date().toISOString().slice(0, 10) });
  }, [venda, open]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...f, desconto: Number(f.desconto), valor_a_pagar: Number(f.valor_a_pagar) };
      if (isEdit) {
        const { error } = await supabase.from("qa_vendas" as any).update(payload).eq("id", venda.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_vendas" as any).insert({ ...payload, cliente_id: clienteId });
        if (error) throw error;
      }
      toast.success(isEdit ? "Venda atualizada" : "Venda cadastrada");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar Venda" : "Nova Venda"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Data" value={f.data_cadastro} onChange={v => setF(p => ({ ...p, data_cadastro: v }))} type="date" />
          <div className="flex gap-2">
            <Inp label="Valor a Pagar" value={f.valor_a_pagar} onChange={v => setF(p => ({ ...p, valor_a_pagar: v }))} type="number" />
            <Inp label="Desconto" value={f.desconto} onChange={v => setF(p => ({ ...p, desconto: v }))} type="number" />
          </div>
          <Inp label="Forma de Pagamento" value={f.forma_pagamento} onChange={v => setF(p => ({ ...p, forma_pagamento: v }))} />
          <Inp label="Nº Processo" value={f.numero_processo} onChange={v => setF(p => ({ ...p, numero_processo: v }))} />
          <div>
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">Status</label>
            <Select value={f.status} onValueChange={v => setF(p => ({ ...p, status: v }))}>
              <SelectTrigger className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["EM ANÁLISE", "PRONTO PARA ANÁLISE", "DEFERIDO", "INDEFERIDO", "CONCLUÍDO"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

// ─── Delete confirmation ───
interface DeleteConfirmProps {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; loading?: boolean;
}
export function DeleteConfirm({ open, onClose, onConfirm, title, description, loading }: DeleteConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader><DialogTitle className="text-sm text-red-400">{title}</DialogTitle></DialogHeader>
        <p className="text-[11px] text-neutral-400">{description}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-[11px] h-7">Cancelar</Button>
          <Button size="sm" onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700 text-[11px] h-7">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />} Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared ───
function Inp({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex-1">
      <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200" />
    </div>
  );
}
