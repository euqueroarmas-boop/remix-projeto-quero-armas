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
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-700">
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
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-700">
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
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-700">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar CR" : "Novo Cadastro CR"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Inp label="Nº CR" value={f.numero_cr} onChange={v => setF(p => ({ ...p, numero_cr: v }))} />
          <Inp label="Validade CR" value={f.validade_cr} onChange={v => setF(p => ({ ...p, validade_cr: v }))} type="date" />
          <Inp label="Validade Laudo Psicológico" value={f.validade_laudo_psicologico} onChange={v => setF(p => ({ ...p, validade_laudo_psicologico: v }))} type="date" />
          <Inp label="Validade Exame de Tiro" value={f.validade_exame_tiro} onChange={v => setF(p => ({ ...p, validade_exame_tiro: v }))} type="date" />
          <Inp label="Senha Gov" value={f.senha_gov} onChange={v => setF(p => ({ ...p, senha_gov: v }))} />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={f.check_laudo_psi} onChange={e => setF(p => ({ ...p, check_laudo_psi: e.target.checked }))} className="accent-emerald-500" /> Laudo Psicológico OK
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-700">
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

// ─── Venda Modal (com seleção de serviços) ───
interface VendaModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; venda?: any;
}
export function VendaModal({ open, onClose, onSaved, clienteId, venda }: VendaModalProps) {
  const isEdit = !!venda;
  const [saving, setSaving] = useState(false);
  const [servicos, setServicos] = useState<{ id: number; nome_servico: string; valor_servico: number }[]>([]);
  const [selectedServicos, setSelectedServicos] = useState<Map<number, { valor: number; checked: boolean }>>(new Map());
  const [f, setF] = useState({ forma_pagamento: "", desconto: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    supabase.from("qa_servicos" as any).select("*").order("nome_servico").then(({ data }) => {
      setServicos((data as any[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (venda) {
      setF({
        forma_pagamento: venda.forma_pagamento || "", desconto: String(venda.desconto || 0),
        status: venda.status || "EM ANÁLISE", numero_processo: venda.numero_processo || "",
        data_cadastro: venda.data_cadastro || new Date().toISOString().slice(0, 10),
      });
      // Load existing items for this venda
      const vendaLegacyId = venda.id_legado ?? venda.id;
      supabase.from("qa_itens_venda" as any).select("*").eq("venda_id", vendaLegacyId).then(({ data }) => {
        const map = new Map<number, { valor: number; checked: boolean }>();
        ((data as any[]) ?? []).forEach((it: any) => {
          map.set(it.servico_id, { valor: Number(it.valor || 0), checked: true });
        });
        setSelectedServicos(map);
      });
    } else {
      setF({ forma_pagamento: "", desconto: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: new Date().toISOString().slice(0, 10) });
      setSelectedServicos(new Map());
    }
  }, [venda, open]);

  const toggleServico = (svc: { id: number; valor_servico: number }) => {
    setSelectedServicos(prev => {
      const next = new Map(prev);
      if (next.has(svc.id)) next.delete(svc.id);
      else next.set(svc.id, { valor: svc.valor_servico, checked: true });
      return next;
    });
  };

  const updateServicoValor = (id: number, valor: number) => {
    setSelectedServicos(prev => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, valor });
      return next;
    });
  };

  const subtotal = Array.from(selectedServicos.values()).reduce((sum, s) => sum + s.valor, 0);
  const desconto = Number(f.desconto) || 0;
  const total = Math.max(0, subtotal - desconto);

  const save = async () => {
    if (selectedServicos.size === 0) { toast.error("Selecione ao menos um serviço"); return; }
    setSaving(true);
    try {
      const payload: any = { ...f, desconto: desconto, valor_a_pagar: total };
      let vendaId: number;
      if (isEdit) {
        const { error } = await supabase.from("qa_vendas" as any).update(payload).eq("id", venda.id);
        if (error) throw error;
        vendaId = venda.id_legado ?? venda.id;
        // Delete old items and re-insert
        await supabase.from("qa_itens_venda" as any).delete().eq("venda_id", vendaId);
      } else {
        const { data, error } = await supabase.from("qa_vendas" as any).insert({ ...payload, cliente_id: clienteId }).select("id, id_legado").single();
        if (error) throw error;
        vendaId = (data as any).id_legado ?? (data as any).id;
      }
      // Insert service items
      const items = Array.from(selectedServicos.entries()).map(([servicoId, { valor }]) => ({
        venda_id: vendaId,
        servico_id: servicoId,
        valor,
        status: f.status,
      }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from("qa_itens_venda" as any).insert(items);
        if (itemErr) throw itemErr;
      }
      toast.success(isEdit ? "Venda atualizada" : "Venda cadastrada");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-700">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar Venda" : "Nova Venda"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-2">
            <Inp label="Data (dd/mm/aaaa)" value={f.data_cadastro} onChange={v => setF(p => ({ ...p, data_cadastro: v }))} placeholder="14/04/2026" />
            <Inp label="Nº Processo" value={f.numero_processo} onChange={v => setF(p => ({ ...p, numero_processo: v }))} />
          </div>
          <div className="flex gap-2">
            <Inp label="Forma Pagamento" value={f.forma_pagamento} onChange={v => setF(p => ({ ...p, forma_pagamento: v }))} />
            <div className="flex-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
              <Select value={f.status} onValueChange={v => setF(p => ({ ...p, status: v }))}>
                <SelectTrigger className="h-8 text-[11px] bg-white border-slate-200 text-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["EM ANÁLISE", "PRONTO PARA ANÁLISE", "À INICIAR", "DEFERIDO", "INDEFERIDO", "CONCLUÍDO", "PAGO"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-bold">Serviços Contratados</label>
              <span className="text-[9px] text-slate-400 font-mono">{selectedServicos.size} sel.</span>
            </div>
            <div className="max-h-[160px] overflow-y-auto space-y-0.5">
              {servicos.map(svc => {
                const isChecked = selectedServicos.has(svc.id);
                const svcData = selectedServicos.get(svc.id);
                return (
                  <label key={svc.id} className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer text-[11px] transition-colors ${isChecked ? 'bg-[#7a1528]/10 text-slate-700' : 'text-slate-500 hover:bg-[#111]'}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleServico(svc)} className="accent-[#c43b52] h-3 w-3 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{svc.nome_servico}</span>
                    {isChecked ? (
                      <Input type="number" value={String(svcData?.valor ?? svc.valor_servico)} onChange={e => updateServicoValor(svc.id, Number(e.target.value) || 0)} className="h-5 w-16 text-[10px] text-right bg-white border-slate-200 text-slate-700 px-1 shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">R$ {svc.valor_servico}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal ({selectedServicos.size})</span>
              <span className="text-slate-700 font-mono">R$ {subtotal.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Desconto</span>
              <Input type="number" value={f.desconto} onChange={e => setF(p => ({ ...p, desconto: e.target.value }))} className="h-5 w-16 text-[10px] text-right bg-white border-slate-200 text-slate-700 px-1 focus-visible:ring-0 focus-visible:ring-offset-0" />
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-700 font-semibold">Total</span>
              <span className="text-white font-bold font-mono text-[13px]">R$ {total.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-[11px] h-7">Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-[#7a1528] hover:bg-[#9a1b32] text-[11px] h-7">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              {isEdit ? "Salvar" : "Cadastrar Venda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
interface FiliacaoModalProps {
  open: boolean; onClose: () => void; onSaved: () => void;
  clienteId: number; filiacao?: any;
}
export function FiliacaoModal({ open, onClose, onSaved, clienteId, filiacao }: FiliacaoModalProps) {
  const isEdit = !!filiacao;
  const [saving, setSaving] = useState(false);
  const [clubes, setClubes] = useState<{ id: number; nome_clube: string }[]>([]);
  const [f, setF] = useState({ clube_id: "", numero_filiacao: "", validade_filiacao: "", nome_filiacao: "FILIACAO" });

  useEffect(() => {
    supabase.from("qa_clubes" as any).select("id, nome_clube").order("nome_clube").then(({ data }) => {
      setClubes((data as any[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (filiacao) setF({
      clube_id: String(filiacao.clube_id || ""),
      numero_filiacao: filiacao.numero_filiacao || "",
      validade_filiacao: filiacao.validade_filiacao || "",
      nome_filiacao: filiacao.nome_filiacao || "FILIACAO",
    });
    else setF({ clube_id: "", numero_filiacao: "", validade_filiacao: "", nome_filiacao: "FILIACAO" });
  }, [filiacao, open]);

  const save = async () => {
    if (!f.clube_id) { toast.error("Selecione um clube"); return; }
    setSaving(true);
    try {
      const payload = { ...f, clube_id: Number(f.clube_id), cliente_id: clienteId };
      if (isEdit) {
        const { error } = await supabase.from("qa_filiacoes" as any).update(payload).eq("id", filiacao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_filiacoes" as any).insert(payload);
        if (error) throw error;
      }
      toast.success(isEdit ? "Filiação atualizada" : "Filiação cadastrada");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-700">
        <DialogHeader><DialogTitle className="text-sm">{isEdit ? "Editar Filiação" : "Nova Filiação"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">Clube de Tiro *</label>
            <Select value={f.clube_id} onValueChange={v => setF(p => ({ ...p, clube_id: v }))}>
              <SelectTrigger className="h-7 text-[11px] bg-white border-slate-200 text-slate-700"><SelectValue placeholder="Selecionar clube" /></SelectTrigger>
              <SelectContent>
                {clubes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome_clube}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Inp label="Nº Filiação" value={f.numero_filiacao} onChange={v => setF(p => ({ ...p, numero_filiacao: v }))} />
            <Inp label="Validade" value={f.validade_filiacao} onChange={v => setF(p => ({ ...p, validade_filiacao: v }))} type="date" />
          </div>
          <Inp label="Tipo" value={f.nome_filiacao} onChange={v => setF(p => ({ ...p, nome_filiacao: v }))} />
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
      <DialogContent className="max-w-sm bg-white border-slate-200 text-slate-700">
        <DialogHeader><DialogTitle className="text-sm text-red-400">{title}</DialogTitle></DialogHeader>
        <p className="text-[11px] text-slate-600">{description}</p>
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
function Inp({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="flex-1">
      <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-[11px] bg-white border-slate-200 text-slate-700 focus-visible:ring-0 focus-visible:ring-offset-0" />
    </div>
  );
}
