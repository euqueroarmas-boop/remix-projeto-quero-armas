import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Trash2, Shield, Crosshair, FileCheck, ShoppingCart, Users, CalendarDays, Hash, Key, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/* ─── Date helpers ─── */
const applyDateMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isoToBr = (iso: string | null): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
};

const brToIso = (br: string): string | null => {
  if (!br) return null;
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/* ─── Shared Premium Input ─── */
function PremiumField({ label, value, onChange, type = "text", placeholder, icon: Icon, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: any; required?: boolean;
}) {
  const isDate = type === "date";
  return (
    <div className="group flex-1">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">
        {Icon && <Icon className="h-3 w-3 text-indigo-400" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <Input
        type="text"
        value={isDate ? value : value}
        onChange={e => {
          if (isDate) {
            onChange(applyDateMask(e.target.value));
          } else {
            onChange(e.target.value);
          }
        }}
        placeholder={isDate ? "DD/MM/AAAA" : placeholder}
        maxLength={isDate ? 10 : undefined}
        className="h-10 text-sm bg-slate-50/80 border-slate-200/80 text-slate-800 rounded-lg
          placeholder:text-slate-300 font-medium
          transition-all duration-200
          hover:border-indigo-300 hover:bg-white
          focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0 focus-visible:border-indigo-400 focus-visible:bg-white"
      />
    </div>
  );
}

/* ─── Premium Modal Shell ───
   Mobile-first: bottom-sheet em telas pequenas, dialog centralizado no desktop.
   Estrutura: header fixo + body com scroll interno + footer opcional sticky.
*/
function PremiumModalShell({ open, onClose, title, icon: Icon, accentColor, children, footer }: {
  open: boolean; onClose: () => void; title: string; icon: any; accentColor: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="
          !p-0 border-0 bg-white shadow-2xl shadow-slate-200/60 overflow-hidden
          !fixed !left-1/2 !-translate-x-1/2
          !top-auto !bottom-0 !translate-y-0 !rounded-t-2xl !rounded-b-none
          sm:!top-1/2 sm:!bottom-auto sm:!-translate-y-1/2 sm:!rounded-2xl
          !w-full sm:!w-[calc(100vw-2rem)] !max-w-full sm:!max-w-lg
          flex flex-col
          !max-h-[100dvh] sm:!max-h-[calc(100dvh-2rem)]
        "
      >
        {/* Header (fixo) */}
        <div className="shrink-0">
          <div className={`h-1 w-full ${accentColor}`} />
          <div className="px-4 sm:px-6 pt-4 pb-3 pr-12">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800 tracking-tight">
                <div className={`h-8 w-8 rounded-lg ${accentColor} bg-opacity-10 flex items-center justify-center`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                {title}
              </DialogTitle>
            </DialogHeader>
          </div>
        </div>

        {/* Body (scroll interno) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 py-3"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>

        {/* Footer (sticky, respeita safe-area do iPhone) */}
        {footer && (
          <div
            className="shrink-0 border-t border-slate-100 bg-white px-4 sm:px-6 py-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Action Buttons ─── */
function ModalActions({ onClose, onSave, saving, saveLabel = "Salvar" }: {
  onClose: () => void; onSave: () => void; saving: boolean; saveLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2.5 pt-5 mt-5 border-t border-slate-100">
      <Button
        variant="ghost"
        onClick={onClose}
        className="h-9 px-4 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
      >
        Cancelar
      </Button>
      <Button
        onClick={onSave}
        disabled={saving}
        className="h-9 px-5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-200/60 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
        {saveLabel}
      </Button>
    </div>
  );
}

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
    <PremiumModalShell open={open} onClose={onClose} title={isEdit ? "Editar CRAF" : "Novo CRAF"} icon={Shield} accentColor="bg-indigo-600">
      <div className="space-y-4">
        <PremiumField label="Nome da Arma" value={f.nome_arma} onChange={v => setF(p => ({ ...p, nome_arma: v }))} icon={Crosshair} required />
        <PremiumField label="Nome CRAF" value={f.nome_craf} onChange={v => setF(p => ({ ...p, nome_craf: v }))} icon={FileCheck} />
        <div className="grid grid-cols-2 gap-3">
          <PremiumField label="Nº Arma" value={f.numero_arma} onChange={v => setF(p => ({ ...p, numero_arma: v }))} icon={Hash} />
          <PremiumField label="Nº SIGMA" value={f.numero_sigma} onChange={v => setF(p => ({ ...p, numero_sigma: v }))} icon={Hash} />
        </div>
        <PremiumField label="Validade" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} type="date" icon={CalendarDays} />
        <ModalActions onClose={onClose} onSave={save} saving={saving} />
      </div>
    </PremiumModalShell>
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
    <PremiumModalShell open={open} onClose={onClose} title={isEdit ? "Editar GTE" : "Novo GTE"} icon={Crosshair} accentColor="bg-emerald-600">
      <div className="space-y-4">
        <PremiumField label="Nome da Arma" value={f.nome_arma} onChange={v => setF(p => ({ ...p, nome_arma: v }))} icon={Crosshair} required />
        <PremiumField label="Nome GTE" value={f.nome_gte} onChange={v => setF(p => ({ ...p, nome_gte: v }))} icon={FileCheck} />
        <div className="grid grid-cols-2 gap-3">
          <PremiumField label="Nº Arma" value={f.numero_arma} onChange={v => setF(p => ({ ...p, numero_arma: v }))} icon={Hash} />
          <PremiumField label="Nº SIGMA" value={f.numero_sigma} onChange={v => setF(p => ({ ...p, numero_sigma: v }))} icon={Hash} />
        </div>
        <PremiumField label="Validade" value={f.data_validade} onChange={v => setF(p => ({ ...p, data_validade: v }))} type="date" icon={CalendarDays} />
        <ModalActions onClose={onClose} onSave={save} saving={saving} />
      </div>
    </PremiumModalShell>
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
      numero_cr: cadastro.numero_cr || "", validade_cr: isoToBr(cadastro.validade_cr),
      validade_laudo_psicologico: isoToBr(cadastro.validade_laudo_psicologico),
      validade_exame_tiro: isoToBr(cadastro.validade_exame_tiro), senha_gov: cadastro.senha_gov || "",
      check_laudo_psi: cadastro.check_laudo_psi || false, check_exame_tiro: cadastro.check_exame_tiro || false,
    });
    else setF({ numero_cr: "", validade_cr: "", validade_laudo_psicologico: "", validade_exame_tiro: "", senha_gov: "", check_laudo_psi: false, check_exame_tiro: false });
  }, [cadastro, open]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        numero_cr: f.numero_cr,
        validade_cr: brToIso(f.validade_cr),
        validade_laudo_psicologico: brToIso(f.validade_laudo_psicologico),
        validade_exame_tiro: brToIso(f.validade_exame_tiro),
        senha_gov: f.senha_gov,
        check_laudo_psi: f.check_laudo_psi,
        check_exame_tiro: f.check_exame_tiro,
      };
      if (isEdit) {
        const { error } = await supabase.from("qa_cadastro_cr" as any).update(payload).eq("id", cadastro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qa_cadastro_cr" as any).insert({ ...payload, cliente_id: clienteId });
        if (error) throw error;
      }
      toast.success(isEdit ? "CR atualizado" : "CR cadastrado");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <PremiumModalShell open={open} onClose={onClose} title={isEdit ? "Editar CR" : "Novo Cadastro CR"} icon={FileCheck} accentColor="bg-amber-600">
      <div className="space-y-4">
        <PremiumField label="Nº CR" value={f.numero_cr} onChange={v => setF(p => ({ ...p, numero_cr: v }))} icon={Hash} />
        <div className="grid grid-cols-2 gap-3">
          <PremiumField label="Validade CR" value={f.validade_cr} onChange={v => setF(p => ({ ...p, validade_cr: v }))} type="date" icon={CalendarDays} />
          <PremiumField label="Validade Laudo Psi." value={f.validade_laudo_psicologico} onChange={v => setF(p => ({ ...p, validade_laudo_psicologico: v }))} type="date" icon={CalendarDays} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PremiumField label="Validade Exame Tiro" value={f.validade_exame_tiro} onChange={v => setF(p => ({ ...p, validade_exame_tiro: v }))} type="date" icon={CalendarDays} />
          <PremiumField label="Senha Gov" value={f.senha_gov} onChange={v => setF(p => ({ ...p, senha_gov: v }))} icon={Key} />
        </div>

        {/* Premium checkboxes */}
        <div className="flex gap-3 pt-1">
          {[
            { label: "Laudo Psicológico", checked: f.check_laudo_psi, key: "check_laudo_psi" as const },
            { label: "Exame de Tiro", checked: f.check_exame_tiro, key: "check_exame_tiro" as const },
          ].map(item => (
            <label
              key={item.key}
              className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer border transition-all duration-200 text-xs font-medium ${
                item.checked
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-slate-200/80 text-slate-400 hover:border-slate-300"
              }`}
            >
              <div className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                item.checked ? "bg-emerald-500 text-white" : "bg-slate-200"
              }`}>
                {item.checked && <CheckCircle2 className="h-3 w-3" />}
              </div>
              {item.label}
            </label>
          ))}
        </div>
        <ModalActions onClose={onClose} onSave={save} saving={saving} />
      </div>
    </PremiumModalShell>
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
  const [servicos, setServicos] = useState<{ id: number; nome_servico: string; valor_servico: number }[]>([]);
  const [selectedServicos, setSelectedServicos] = useState<Map<number, { valor: number; checked: boolean }>>(new Map());
  const [f, setF] = useState({ forma_pagamento: "", desconto: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: "" });

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
        data_cadastro: isoToBr(venda.data_cadastro) || isoToBr(new Date().toISOString().slice(0, 10)),
      });
      const vendaLegacyId = venda.id_legado ?? venda.id;
      supabase.from("qa_itens_venda" as any).select("*").eq("venda_id", vendaLegacyId).then(({ data }) => {
        const map = new Map<number, { valor: number; checked: boolean }>();
        ((data as any[]) ?? []).forEach((it: any) => {
          map.set(it.servico_id, { valor: Number(it.valor || 0), checked: true });
        });
        setSelectedServicos(map);
      });
    } else {
      const today = new Date();
      const todayBr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
      setF({ forma_pagamento: "", desconto: "0", status: "EM ANÁLISE", numero_processo: "", data_cadastro: todayBr });
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
      const dataCadIso = brToIso(f.data_cadastro) || new Date().toISOString().slice(0, 10);
      const payload: any = { ...f, data_cadastro: dataCadIso, desconto: desconto, valor_a_pagar: total };
      let vendaId: number;
      if (isEdit) {
        const { error } = await supabase.from("qa_vendas" as any).update(payload).eq("id", venda.id);
        if (error) throw error;
        vendaId = venda.id_legado ?? venda.id;
        await supabase.from("qa_itens_venda" as any).delete().eq("venda_id", vendaId);
      } else {
        const { data, error } = await supabase.from("qa_vendas" as any).insert({ ...payload, cliente_id: clienteId }).select("id, id_legado").single();
        if (error) throw error;
        vendaId = (data as any).id_legado ?? (data as any).id;
      }
      const items = Array.from(selectedServicos.entries()).map(([servicoId, { valor }]) => ({
        venda_id: vendaId, servico_id: servicoId, valor, status: f.status,
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
    <PremiumModalShell
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Venda" : "Nova Venda"}
      icon={ShoppingCart}
      accentColor="bg-blue-600"
      footer={
        <div className="space-y-3">
          {/* Totals */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium">Subtotal ({selectedServicos.size})</span>
              <span className="text-slate-700 font-mono font-semibold">R$ {subtotal.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium shrink-0">Desconto (R$)</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={f.desconto}
                onChange={e => setF(p => ({ ...p, desconto: e.target.value }))}
                className="h-8 w-24 text-xs text-right bg-white border-slate-300 text-slate-700 px-2 rounded-md font-mono focus-visible:ring-1 focus-visible:ring-indigo-400 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200/80">
              <span className="text-slate-800 font-bold">Total</span>
              <span className="text-indigo-700 font-bold font-mono text-sm">R$ {total.toLocaleString('pt-BR')}</span>
            </div>
          </div>
          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-11 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="h-11 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200/50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isEdit ? "Salvar" : "Cadastrar Venda"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PremiumField label="Data da Venda" value={f.data_cadastro} onChange={v => setF(p => ({ ...p, data_cadastro: applyDateMask(v) }))} type="date" icon={CalendarDays} />
          <PremiumField label="Nº Processo" value={f.numero_processo} onChange={v => setF(p => ({ ...p, numero_processo: v }))} icon={Hash} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex-1 min-w-0">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Forma Pagamento</label>
            <Select value={f.forma_pagamento} onValueChange={v => setF(p => ({ ...p, forma_pagamento: v }))}>
              <SelectTrigger className="h-10 text-sm bg-slate-50/80 border-slate-200/80 text-slate-800 rounded-lg font-medium hover:border-indigo-300 hover:bg-white transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 focus:border-indigo-400">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 rounded-lg shadow-xl z-[100]">
                {[
                  { value: "PIX", label: "PIX" },
                  { value: "CARTAO_CREDITO", label: "Cartão de Crédito" },
                  { value: "CARTAO_DEBITO", label: "Cartão de Débito" },
                  { value: "QR_CODE", label: "QR Code" },
                  { value: "DINHEIRO", label: "Dinheiro" },
                ].map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-sm text-slate-700">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Status</label>
            <Select value={f.status} onValueChange={v => setF(p => ({ ...p, status: v }))}>
              <SelectTrigger className="h-10 text-sm bg-slate-50/80 border-slate-200/80 text-slate-800 rounded-lg font-medium hover:border-indigo-300 hover:bg-white transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 focus:border-indigo-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 rounded-lg shadow-xl">
                {["EM ANÁLISE", "PRONTO PARA ANÁLISE", "À INICIAR", "DEFERIDO", "INDEFERIDO", "CONCLUÍDO", "PAGO"].map(s => (
                  <SelectItem key={s} value={s} className="text-sm text-slate-700">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Services list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Serviços Contratados</label>
            <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">{selectedServicos.size} sel.</span>
          </div>
          <div className="max-h-[44vh] sm:max-h-[220px] overflow-y-auto space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/50 p-2">
            {servicos.map(svc => {
              const isChecked = selectedServicos.has(svc.id);
              const svcData = selectedServicos.get(svc.id);
              return (
                <label
                  key={svc.id}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer text-xs transition-all duration-200 ${
                    isChecked
                      ? "bg-indigo-50 border border-indigo-200/60 text-slate-800 shadow-sm"
                      : "text-slate-500 hover:bg-white border border-transparent"
                  }`}
                >
                  <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isChecked ? "bg-indigo-600 text-white" : "bg-slate-200"
                  }`}>
                    {isChecked && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleServico(svc)} className="sr-only" />
                  <span className="flex-1 min-w-0 truncate font-medium">{svc.nome_servico}</span>
                  {isChecked ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={String(svcData?.valor ?? svc.valor_servico)}
                      onChange={e => updateServicoValor(svc.id, Number(e.target.value) || 0)}
                      onClick={e => e.preventDefault()}
                      className="h-7 w-16 sm:w-20 text-xs text-right bg-white border-slate-200 text-slate-700 px-1.5 shrink-0 rounded-md focus-visible:ring-1 focus-visible:ring-indigo-400 focus-visible:ring-offset-0 font-mono"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">R$ {svc.valor_servico}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </PremiumModalShell>
  );
}

// ─── Filiação Modal ───
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
    <PremiumModalShell open={open} onClose={onClose} title={isEdit ? "Editar Filiação" : "Nova Filiação"} icon={Users} accentColor="bg-violet-600">
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">
            <Users className="h-3 w-3 text-indigo-400" />
            Clube de Tiro
            <span className="text-red-400">*</span>
          </label>
          <Select value={f.clube_id} onValueChange={v => setF(p => ({ ...p, clube_id: v }))}>
            <SelectTrigger className="h-10 text-sm bg-slate-50/80 border-slate-200/80 text-slate-800 rounded-lg font-medium hover:border-indigo-300 hover:bg-white transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 focus:border-indigo-400">
              <SelectValue placeholder="Selecionar clube" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 rounded-lg shadow-xl">
              {clubes.map(c => <SelectItem key={c.id} value={String(c.id)} className="text-sm text-slate-700">{c.nome_clube}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PremiumField label="Nº Filiação" value={f.numero_filiacao} onChange={v => setF(p => ({ ...p, numero_filiacao: v }))} icon={Hash} />
          <PremiumField label="Validade" value={f.validade_filiacao} onChange={v => setF(p => ({ ...p, validade_filiacao: v }))} type="date" icon={CalendarDays} />
        </div>
        <PremiumField label="Tipo" value={f.nome_filiacao} onChange={v => setF(p => ({ ...p, nome_filiacao: v }))} />
        <ModalActions onClose={onClose} onSave={save} saving={saving} />
      </div>
    </PremiumModalShell>
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
      <DialogContent className="max-w-sm border-0 shadow-2xl shadow-red-100/30 rounded-2xl overflow-hidden p-0 bg-white">
        <div className="h-1 w-full bg-red-500" />
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-red-600 tracking-tight">
              <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-white" />
              </div>
              {title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{description}</p>
          <div className="flex justify-end gap-2.5 pt-5 mt-4 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="h-9 px-5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md shadow-red-200/50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Excluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
