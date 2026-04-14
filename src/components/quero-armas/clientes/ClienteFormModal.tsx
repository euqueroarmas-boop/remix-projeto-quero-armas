import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface ClienteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cliente?: any;
}

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União Estável"];
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function ClienteFormModal({ open, onClose, onSaved, cliente }: ClienteFormModalProps) {
  const isEdit = !!cliente;
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nome_completo: "", cpf: "", rg: "", emissor_rg: "", expedicao_rg: "",
    data_nascimento: "", naturalidade: "", nacionalidade: "Brasileira",
    nome_mae: "", nome_pai: "", estado_civil: "", profissao: "", escolaridade: "",
    email: "", celular: "", titulo_eleitor: "",
    endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", pais: "Brasil",
    endereco2: "", numero2: "", complemento2: "", bairro2: "", cep2: "", cidade2: "", estado2: "", pais2: "",
    observacao: "", status: "ATIVO", cliente_lions: false,
  });

  useEffect(() => {
    if (cliente) {
      setF({
        nome_completo: cliente.nome_completo || "",
        cpf: cliente.cpf || "", rg: cliente.rg || "", emissor_rg: cliente.emissor_rg || "",
        expedicao_rg: cliente.expedicao_rg || "",
        data_nascimento: cliente.data_nascimento || "", naturalidade: cliente.naturalidade || "",
        nacionalidade: cliente.nacionalidade || "Brasileira",
        nome_mae: cliente.nome_mae || "", nome_pai: cliente.nome_pai || "",
        estado_civil: cliente.estado_civil || "", profissao: cliente.profissao || "",
        escolaridade: cliente.escolaridade || "",
        email: cliente.email || "", celular: cliente.celular || "", titulo_eleitor: cliente.titulo_eleitor || "",
        endereco: cliente.endereco || "", numero: cliente.numero || "",
        complemento: cliente.complemento || "", bairro: cliente.bairro || "",
        cep: cliente.cep || "", cidade: cliente.cidade || "", estado: cliente.estado || "",
        pais: cliente.pais || "Brasil",
        endereco2: cliente.endereco2 || "", numero2: cliente.numero2 || "",
        complemento2: cliente.complemento2 || "", bairro2: cliente.bairro2 || "",
        cep2: cliente.cep2 || "", cidade2: cliente.cidade2 || "", estado2: cliente.estado2 || "",
        pais2: cliente.pais2 || "",
        observacao: cliente.observacao || "", status: cliente.status || "ATIVO",
        cliente_lions: cliente.cliente_lions || false,
      });
    } else {
      setF(prev => ({ ...prev, nome_completo: "", cpf: "", rg: "", email: "", celular: "" }));
    }
  }, [cliente, open]);

  const set = (key: string, val: any) => setF(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    if (!f.nome_completo.trim()) { toast.error("Nome completo é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = { ...f };
      if (isEdit) {
        const { error } = await supabase.from("qa_clientes" as any).update(payload).eq("id", cliente.id);
        if (error) throw error;
        toast.success("Cliente atualizado");
      } else {
        const { error } = await supabase.from("qa_clientes" as any).insert(payload);
        if (error) throw error;
        toast.success("Cliente cadastrado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "h-9 text-xs bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200 rounded-md focus:border-[#7a1528] focus:ring-1 focus:ring-[#7a1528]/30 transition-colors";
  const labelCls = "text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 block font-medium";
  const selectTriggerCls = "h-9 text-xs bg-[#0a0a0a] border-[#1c1c1c] rounded-md";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200 p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold text-neutral-100">{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-5">
          {/* Identificação */}
          <Sec title="Identificação">
            <Grid cols={1}>
              <Field label="Nome Completo *" value={f.nome_completo} onChange={v => set("nome_completo", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid>
              <Field label="CPF" value={f.cpf} onChange={v => set("cpf", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="RG" value={f.rg} onChange={v => set("rg", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid>
              <Field label="Emissor RG" value={f.emissor_rg} onChange={v => set("emissor_rg", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="Expedição RG" value={f.expedicao_rg} onChange={v => set("expedicao_rg", v)} type="date" inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid>
              <Field label="Nascimento" value={f.data_nascimento} onChange={v => set("data_nascimento", v)} type="date" inputCls={inputCls} labelCls={labelCls} />
              <Field label="Naturalidade" value={f.naturalidade} onChange={v => set("naturalidade", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid>
              <Field label="Nacionalidade" value={f.nacionalidade} onChange={v => set("nacionalidade", v)} inputCls={inputCls} labelCls={labelCls} />
              <div>
                <label className={labelCls}>Estado Civil</label>
                <Select value={f.estado_civil} onValueChange={v => set("estado_civil", v)}>
                  <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Grid>
            <Grid>
              <Field label="Profissão" value={f.profissao} onChange={v => set("profissao", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="Escolaridade" value={f.escolaridade} onChange={v => set("escolaridade", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid cols={1}>
              <Field label="Título de Eleitor" value={f.titulo_eleitor} onChange={v => set("titulo_eleitor", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
          </Sec>

          {/* Filiação */}
          <Sec title="Filiação">
            <Grid>
              <Field label="Nome da Mãe" value={f.nome_mae} onChange={v => set("nome_mae", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="Nome do Pai" value={f.nome_pai} onChange={v => set("nome_pai", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
          </Sec>

          {/* Contato */}
          <Sec title="Contato">
            <Grid>
              <Field label="Celular" value={f.celular} onChange={v => set("celular", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="Email" value={f.email} onChange={v => set("email", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
          </Sec>

          {/* Endereço Principal */}
          <Sec title="Endereço Principal">
            <Grid cols={4}>
              <div className="col-span-4 sm:col-span-3">
                <Field label="Logradouro" value={f.endereco} onChange={v => set("endereco", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Field label="Número" value={f.numero} onChange={v => set("numero", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
            </Grid>
            <Grid>
              <Field label="Complemento" value={f.complemento} onChange={v => set("complemento", v)} inputCls={inputCls} labelCls={labelCls} />
              <Field label="Bairro" value={f.bairro} onChange={v => set("bairro", v)} inputCls={inputCls} labelCls={labelCls} />
            </Grid>
            <Grid cols={4}>
              <div className="col-span-4 sm:col-span-1">
                <Field label="CEP" value={f.cep} onChange={v => set("cep", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Field label="Cidade" value={f.cidade} onChange={v => set("cidade", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <label className={labelCls}>UF</label>
                <Select value={f.estado} onValueChange={v => set("estado", v)}>
                  <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Grid>
          </Sec>

          {/* Endereço Secundário */}
          <Sec title="Endereço Secundário (opcional)">
            <Grid cols={4}>
              <div className="col-span-4 sm:col-span-3">
                <Field label="Logradouro" value={f.endereco2} onChange={v => set("endereco2", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Field label="Número" value={f.numero2} onChange={v => set("numero2", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
            </Grid>
            <Grid cols={4}>
              <div className="col-span-4 sm:col-span-1">
                <Field label="Bairro" value={f.bairro2} onChange={v => set("bairro2", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Field label="Cidade" value={f.cidade2} onChange={v => set("cidade2", v)} inputCls={inputCls} labelCls={labelCls} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <label className={labelCls}>UF</label>
                <Select value={f.estado2} onValueChange={v => set("estado2", v)}>
                  <SelectTrigger className={selectTriggerCls}><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Grid>
          </Sec>

          {/* Configurações */}
          <Sec title="Configurações">
            <Grid>
              <div>
                <label className={labelCls}>Status</label>
                <Select value={f.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                    <SelectItem value="DESISTENTE">Desistente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input type="checkbox" checked={f.cliente_lions} onChange={e => set("cliente_lions", e.target.checked)} className="accent-amber-500 w-4 h-4" />
                  🦁 Cliente Lions
                </label>
              </div>
            </Grid>
            <div>
              <label className={labelCls}>Observações</label>
              <Textarea value={f.observacao} onChange={e => set("observacao", e.target.value)} className="text-xs bg-[#0a0a0a] border-[#1c1c1c] min-h-[60px] rounded-md focus:border-[#7a1528] focus:ring-1 focus:ring-[#7a1528]/30" />
            </div>
          </Sec>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#1c1c1c]">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-500 text-xs h-8 px-4">Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-[#7a1528] hover:bg-[#9a1b32] text-xs h-8 px-5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Primitives ── */

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] text-[#c43b52] uppercase tracking-[0.14em] font-semibold border-b border-[#1a1a1a] pb-1.5">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  const colClass = cols === 1
    ? "grid grid-cols-1 gap-3"
    : cols === 4
      ? "grid grid-cols-4 gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 gap-3";
  return <div className={colClass}>{children}</div>;
}

function Field({ label, value, onChange, type = "text", inputCls, labelCls }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; inputCls: string; labelCls: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}
