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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0e0e0e] border-[#1c1c1c] text-neutral-200">
        <DialogHeader>
          <DialogTitle className="text-sm text-neutral-100">{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Identificação */}
          <Sec title="Identificação">
            <Row>
              <F label="Nome Completo *" value={f.nome_completo} onChange={v => set("nome_completo", v)} />
            </Row>
            <Row>
              <F label="CPF" value={f.cpf} onChange={v => set("cpf", v)} />
              <F label="RG" value={f.rg} onChange={v => set("rg", v)} />
            </Row>
            <Row>
              <F label="Emissor RG" value={f.emissor_rg} onChange={v => set("emissor_rg", v)} />
              <F label="Expedição RG" value={f.expedicao_rg} onChange={v => set("expedicao_rg", v)} type="date" />
            </Row>
            <Row>
              <F label="Nascimento" value={f.data_nascimento} onChange={v => set("data_nascimento", v)} type="date" />
              <F label="Naturalidade" value={f.naturalidade} onChange={v => set("naturalidade", v)} />
            </Row>
            <Row>
              <F label="Nacionalidade" value={f.nacionalidade} onChange={v => set("nacionalidade", v)} />
              <div className="flex-1">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">Estado Civil</label>
                <Select value={f.estado_civil} onValueChange={v => set("estado_civil", v)}>
                  <SelectTrigger className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{ESTADOS_CIVIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Row>
            <Row>
              <F label="Profissão" value={f.profissao} onChange={v => set("profissao", v)} />
              <F label="Escolaridade" value={f.escolaridade} onChange={v => set("escolaridade", v)} />
            </Row>
            <Row>
              <F label="Título de Eleitor" value={f.titulo_eleitor} onChange={v => set("titulo_eleitor", v)} />
            </Row>
          </Sec>

          {/* Filiação */}
          <Sec title="Filiação">
            <Row>
              <F label="Nome da Mãe" value={f.nome_mae} onChange={v => set("nome_mae", v)} />
              <F label="Nome do Pai" value={f.nome_pai} onChange={v => set("nome_pai", v)} />
            </Row>
          </Sec>

          {/* Contato */}
          <Sec title="Contato">
            <Row>
              <F label="Celular" value={f.celular} onChange={v => set("celular", v)} />
              <F label="Email" value={f.email} onChange={v => set("email", v)} />
            </Row>
          </Sec>

          {/* Endereço 1 */}
          <Sec title="Endereço Principal">
            <Row>
              <F label="Logradouro" value={f.endereco} onChange={v => set("endereco", v)} />
              <F label="Número" value={f.numero} onChange={v => set("numero", v)} className="sm:max-w-[80px]" />
            </Row>
            <Row>
              <F label="Complemento" value={f.complemento} onChange={v => set("complemento", v)} />
              <F label="Bairro" value={f.bairro} onChange={v => set("bairro", v)} />
            </Row>
            <Row>
              <F label="CEP" value={f.cep} onChange={v => set("cep", v)} className="sm:max-w-[120px]" />
              <F label="Cidade" value={f.cidade} onChange={v => set("cidade", v)} />
              <div className="flex-1 sm:max-w-[80px]">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">UF</label>
                <Select value={f.estado} onValueChange={v => set("estado", v)}>
                  <SelectTrigger className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c]"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Row>
          </Sec>

          {/* Endereço 2 */}
          <Sec title="Endereço Secundário (opcional)">
            <Row>
              <F label="Logradouro" value={f.endereco2} onChange={v => set("endereco2", v)} />
              <F label="Número" value={f.numero2} onChange={v => set("numero2", v)} className="sm:max-w-[80px]" />
            </Row>
            <Row>
              <F label="Bairro" value={f.bairro2} onChange={v => set("bairro2", v)} />
              <F label="Cidade" value={f.cidade2} onChange={v => set("cidade2", v)} />
              <div className="flex-1 sm:max-w-[80px]">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">UF</label>
                <Select value={f.estado2} onValueChange={v => set("estado2", v)}>
                  <SelectTrigger className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c]"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Row>
          </Sec>

          {/* Status */}
          <Sec title="Configurações">
            <Row>
              <div className="flex-1">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">Status</label>
                <Select value={f.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                    <SelectItem value="DESISTENTE">Desistente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 text-[11px] text-neutral-300 cursor-pointer">
                  <input type="checkbox" checked={f.cliente_lions} onChange={e => set("cliente_lions", e.target.checked)} className="accent-amber-500" />
                  🦁 Cliente Lions
                </label>
              </div>
            </Row>
            <div>
              <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">Observações</label>
              <Textarea value={f.observacao} onChange={e => set("observacao", e.target.value)} className="text-[11px] bg-[#0a0a0a] border-[#1c1c1c] min-h-[60px]" />
            </div>
          </Sec>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-500 text-[11px] h-7">Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-[#7a1528] hover:bg-[#9a1b32] text-[11px] h-7">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              {isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] mb-2 font-semibold">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col sm:flex-row gap-2">{children}</div>;
}

function F({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={`flex-1 ${className}`}>
      <label className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1 block">{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[11px] bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200" />
    </div>
  );
}
